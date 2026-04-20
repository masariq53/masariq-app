import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import { useLocation } from "@/hooks/use-location";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";
import { fetchOsrmRoute, type OsrmRouteResult, type LatLng } from "@/lib/osrm";
import { useVoiceNavigation } from "@/hooks/use-voice-navigation";

// مراحل الرحلة من منظور السائق
type TripPhase = "pickup" | "arrived" | "in_trip" | "done";

const STATUS_TO_PHASE: Record<string, TripPhase> = {
  accepted: "pickup",
  driver_arrived: "arrived",
  in_progress: "in_trip",
  completed: "done",
};

export default function CaptainActiveTripScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ rideId?: string }>();
  const { driver } = useDriver();
  const { coords, heading, isRealLocation } = useLocation();
  const isFirstLocation = useRef(true);
  const [isFollowingDriver, setIsFollowingDriver] = useState(true);
  const [phase, setPhase] = useState<TripPhase>("pickup");
  const mapRef = useRef<MapView>(null);
  const localPhaseRef = useRef<TripPhase | null>(null);

  // مسارات الملاحة
  const [routeToPickup, setRouteToPickup] = useState<OsrmRouteResult | null>(null);
  const [routeToDropoff, setRouteToDropoff] = useState<OsrmRouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const prevDriverLatRef = useRef<number | null>(null);
  const prevDriverLngRef = useRef<number | null>(null);

  // الخطوة الحالية في الملاحة
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentInstruction, setCurrentInstruction] = useState<string>("");
  const [distanceToNext, setDistanceToNext] = useState<number>(0);

  // الملاحة الصوتية
  const voiceNav = useVoiceNavigation();

  const rideId = params.rideId ? parseInt(params.rideId) : 0;
  const driverId = driver?.id ?? 0;

  // عدد الرسائل غير المقروءة
  const { data: unreadData } = trpc.rides.unreadCount.useQuery(
    { rideId, readerType: "driver" },
    { enabled: rideId > 0 && phase !== "done", refetchInterval: 5000 }
  );
  const unreadCount = unreadData?.count ?? 0;

  // جلب بيانات الرحلة
  const rideQuery = trpc.rides.driverActiveRide.useQuery(
    { driverId, rideId: rideId || undefined },
    {
      enabled: driverId > 0 && rideId > 0,
      refetchInterval: 4000,
      staleTime: 0,
    }
  );

  const ride = rideQuery.data;

  const pickupCoord = ride
    ? { latitude: ride.pickupLat, longitude: ride.pickupLng }
    : { latitude: 36.3392, longitude: 43.1289 };

  const destCoord = ride
    ? { latitude: ride.dropoffLat, longitude: ride.dropoffLng }
    : { latitude: 36.3600, longitude: 43.1450 };

  // معالجة إلغاء الرحلة
  const setDriverAvailable = trpc.driver.setStatus.useMutation();
  const cancelledHandledRef = useRef(false);

  useEffect(() => {
    if (!ride?.status) return;
    if (ride.status === "cancelled" && !cancelledHandledRef.current) {
      cancelledHandledRef.current = true;
      voiceNav.stop();
      if (driverId > 0) {
        setDriverAvailable.mutate({ driverId, isOnline: true, isAvailable: true });
      }
      router.replace("/captain/home" as any);
      return;
    }
    const mappedPhase = STATUS_TO_PHASE[ride.status];
    if (!mappedPhase) return;
    const phaseOrder: TripPhase[] = ["pickup", "arrived", "in_trip", "done"];
    const dbPhaseIndex = phaseOrder.indexOf(mappedPhase);
    const currentPhaseIndex = phaseOrder.indexOf(localPhaseRef.current ?? phase);
    if (dbPhaseIndex > currentPhaseIndex) {
      localPhaseRef.current = mappedPhase;
      setPhase(mappedPhase);
    } else if (localPhaseRef.current === null) {
      localPhaseRef.current = mappedPhase;
      setPhase(mappedPhase);
    }
  }, [ride?.status]);

  // تمركز الخريطة عند أول تحميل
  useEffect(() => {
    if (ride && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: ride.pickupLat,
        longitude: ride.pickupLng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 800);
      isFirstLocation.current = false;
    }
  }, [ride?.id]);

  // تتبع موقع الكابتن بسلاسة
  useEffect(() => {
    if (!isRealLocation || !mapRef.current || isFirstLocation.current) return;
    if (!isFollowingDriver) return;
    mapRef.current.animateCamera(
      { center: { latitude: coords.latitude, longitude: coords.longitude } },
      { duration: 1000 }
    );
  }, [isRealLocation, coords.latitude, coords.longitude, isFollowingDriver]);

  // ─── منطق المسارات ───────────────────────────────────────────────────────────
  // مرحلة pickup/arrived: يُجلب مسار الكابتن → الراكب (أزرق) فقط
  // مرحلة in_trip: يُجلب مسار الراكب → الوجهة (ذهبي) فقط

  // جلب مسار الكابتن → الراكب (أزرق) - فقط في مرحلة pickup/arrived
  useEffect(() => {
    if (!ride || (phase !== "pickup" && phase !== "arrived")) return;
    // انتظر الموقع الحقيقي (تجنب الموقع الافتراضي)
    if (coords.latitude === 36.3392 && coords.longitude === 43.1289 && !isRealLocation) return;
    const prevLat = prevDriverLatRef.current;
    const prevLng = prevDriverLngRef.current;
    // جلب فوري أول مرة أو عند تحرك أكثر من 50م
    const shouldFetch = prevLat === null || prevLng === null ||
      Math.abs(coords.latitude - prevLat) > 0.0005 ||
      Math.abs(coords.longitude - prevLng) > 0.0005;
    if (!shouldFetch) return;
    prevDriverLatRef.current = coords.latitude;
    prevDriverLngRef.current = coords.longitude;
    const driverPos: LatLng = { latitude: coords.latitude, longitude: coords.longitude };
    const pickup: LatLng = { latitude: ride.pickupLat, longitude: ride.pickupLng };
    setIsLoadingRoute(true);
    fetchOsrmRoute(driverPos, pickup).then((res) => {
      if (res) {
        setRouteToPickup(res);
        setRouteToDropoff(null); // امسح مسار الوجهة في هذه المرحلة
        if (res.steps?.length) {
          voiceNav.setSteps(res.steps);
          setCurrentInstruction(res.steps[0].instruction);
          setDistanceToNext(res.steps[0].distanceM);
        }
      }
    }).finally(() => setIsLoadingRoute(false));
  }, [coords.latitude, coords.longitude, phase, ride?.id, isRealLocation]);

  // جلب مسار الراكب → الوجهة (ذهبي) - فقط عند بدء الرحلة (in_trip)
  useEffect(() => {
    if (!ride || phase !== "in_trip") return;
    const pickup: LatLng = { latitude: ride.pickupLat, longitude: ride.pickupLng };
    const dropoff: LatLng = { latitude: ride.dropoffLat, longitude: ride.dropoffLng };
    setRouteToPickup(null); // امسح مسار الاستلام
    setIsLoadingRoute(true);
    fetchOsrmRoute(pickup, dropoff).then((res) => {
      if (res) {
        setRouteToDropoff(res);
        if (res.steps?.length) {
          voiceNav.setSteps(res.steps);
          voiceNav.start(ride.dropoffAddress || "الوجهة");
          setCurrentInstruction(res.steps[0].instruction);
          setDistanceToNext(res.steps[0].distanceM);
        }
      }
    }).finally(() => setIsLoadingRoute(false));
  }, [ride?.id, phase]);

  // تحديث الملاحة الصوتية عند تحرك السائق
  useEffect(() => {
    if (!isRealLocation) return;
    voiceNav.onLocationUpdate({ latitude: coords.latitude, longitude: coords.longitude });
  }, [coords.latitude, coords.longitude, isRealLocation]);

  // تفعيل الملاحة الصوتية عند بدء مرحلة جديدة
  useEffect(() => {
    if (!ride) return;
    if (phase === "pickup") {
      voiceNav.start(ride.pickupAddress || "موقع الراكب");
    } else if (phase === "in_trip") {
      // عند بدء الرحلة: إذا المسار جاهز فعّله، وإلا سيُفعَّل في useEffect الجلب
      if (routeToDropoff?.steps?.length) {
        voiceNav.setSteps(routeToDropoff.steps);
        voiceNav.start(ride.dropoffAddress || "الوجهة");
        if (routeToDropoff.steps[0]) {
          setCurrentInstruction(routeToDropoff.steps[0].instruction);
          setDistanceToNext(routeToDropoff.steps[0].distanceM);
        }
      } else {
        // المسار لم يصل بعد - سيُفعَّل تلقائياً عند وصوله
        voiceNav.start(ride.dropoffAddress || "الوجهة");
        // إعادة ضبط الكاميرا لتشمل المسار
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: (ride.pickupLat + ride.dropoffLat) / 2,
            longitude: (ride.pickupLng + ride.dropoffLng) / 2,
            latitudeDelta: Math.abs(ride.pickupLat - ride.dropoffLat) * 2 + 0.02,
            longitudeDelta: Math.abs(ride.pickupLng - ride.dropoffLng) * 2 + 0.02,
          }, 1000);
        }
      }
    }
  }, [phase, ride?.id]);

  // تنظيف الملاحة الصوتية عند الخروج
  useEffect(() => {
    return () => {
      voiceNav.stop();
    };
  }, []);

  const updateStatus = trpc.rides.updateStatus.useMutation();

  const handlePhaseAction = () => {
    const actualRideId = ride?.id ?? rideId;
    if (!actualRideId) {
      Alert.alert("خطأ", "لم يتم تحميل بيانات الرحلة. تأكد من الاتصال بالإنترنت.");
      return;
    }
    if (updateStatus.isPending) return;

    if (phase === "pickup") {
      localPhaseRef.current = "arrived";
      setPhase("arrived");
      voiceNav.announceArrival("موقع الراكب");
      mapRef.current?.animateToRegion({ ...pickupCoord, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
      updateStatus.mutate(
        { rideId: actualRideId, status: "driver_arrived" },
        {
          onError: () => {
            localPhaseRef.current = "pickup";
            setPhase("pickup");
            Alert.alert("خطأ", "فشل تحديث الحالة. تأكد من الاتصال بالإنترنت.");
          },
        }
      );
    } else if (phase === "arrived") {
      localPhaseRef.current = "in_trip";
      setPhase("in_trip");
      mapRef.current?.animateToRegion({ ...destCoord, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 800);
      updateStatus.mutate(
        { rideId: actualRideId, status: "in_progress" },
        {
          onError: () => {
            localPhaseRef.current = "arrived";
            setPhase("arrived");
            Alert.alert("خطأ", "فشل تحديث الحالة. تأكد من الاتصال بالإنترنت.");
          },
        }
      );
    } else if (phase === "in_trip") {
      localPhaseRef.current = "done";
      setPhase("done");
      voiceNav.stop();
      const fareVal = ride?.fare?.toString() ?? "0";
      const distVal = ride?.estimatedDistance?.toString() ?? "0";
      const durVal = ride?.estimatedDuration?.toString() ?? "0";
      const pName = ride?.passengerName ?? "الراكب";
      const pickupAddr = ride?.pickupAddress ?? "";
      const dropoffAddr = ride?.dropoffAddress ?? "";
      updateStatus.mutate(
        { rideId: actualRideId, status: "completed" },
        {
          onSuccess: () => {
            router.replace({
              pathname: "/captain/trip-summary" as any,
              params: {
                rideId: actualRideId.toString(),
                fare: fareVal,
                distance: distVal,
                duration: durVal,
                passengerName: pName,
                pickupAddress: pickupAddr,
                dropoffAddress: dropoffAddr,
              },
            });
          },
          onError: () => {
            localPhaseRef.current = "in_trip";
            setPhase("in_trip");
            Alert.alert("خطأ", "فشل إنهاء الرحلة. تأكد من الاتصال بالإنترنت.");
          },
        }
      );
    } else if (phase === "done") {
      router.replace("/captain/home" as any);
    }
  };

  const phaseConfig = {
    pickup: {
      title: "في الطريق لاستلام الراكب 🚗",
      subtitle: `توجه إلى: ${ride?.pickupAddress || "موقع الراكب"}`,
      btnText: "وصلت لموقع الراكب ✓",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      navTarget: pickupCoord,
      navLabel: ride?.pickupAddress || "موقع الراكب",
      statusDotColor: "#FFD700",
    },
    arrived: {
      title: "وصلت لموقع الراكب 📍",
      subtitle: "في انتظار الراكب...",
      btnText: "بدء الرحلة ▶",
      btnColor: "#22C55E",
      btnTextColor: "#FFFFFF",
      navTarget: pickupCoord,
      navLabel: ride?.pickupAddress || "موقع الراكب",
      statusDotColor: "#22C55E",
    },
    in_trip: {
      title: "الرحلة جارية 🛣️",
      subtitle: `الوجهة: ${ride?.dropoffAddress || "الوجهة"}`,
      btnText: "إنهاء الرحلة ✓",
      btnColor: "#22C55E",
      btnTextColor: "#FFFFFF",
      navTarget: destCoord,
      navLabel: ride?.dropoffAddress || "الوجهة",
      statusDotColor: "#22C55E",
    },
    done: {
      title: "اكتملت الرحلة 🎉",
      subtitle: "شكراً لك!",
      btnText: "العودة للرئيسية",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      navTarget: destCoord,
      navLabel: "",
      statusDotColor: "#FFD700",
    },
  };

  const config = phaseConfig[phase];

  // حساب المسافة المتبقية والوقت
  const activeRoute = phase === "in_trip" ? routeToDropoff : routeToPickup;
  const remainingKm = activeRoute?.distanceKm ?? 0;
  const remainingMin = activeRoute?.durationMin ?? 0;

  // تنسيق المسافة
  function formatDistanceShort(km: number): string {
    if (km < 1) return `${Math.round(km * 1000)} م`;
    return `${km.toFixed(1)} كم`;
  }

  if (rideQuery.isLoading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: "#FFD700", marginTop: 12 }}>جاري تحميل بيانات الرحلة...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* خريطة Google Maps الحقيقية */}
      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: pickupCoord.latitude,
            longitude: pickupCoord.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsTraffic={true}
          showsCompass={true}
          onPanDrag={() => setIsFollowingDriver(false)}
        >
          {/* موقع الكابتن - سيارة تتدور حسب اتجاه السير */}
          <Marker
            coordinate={coords}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={heading ?? 0}
          >
            <View style={styles.driverMarker}>
              <Text style={{ fontSize: 26 }}>🚗</Text>
            </View>
          </Marker>

          {/* موقع الراكب */}
          <Marker coordinate={pickupCoord} title="موقع الراكب">
            <View style={styles.pickupMarker}>
              <Text style={{ fontSize: 22 }}>👤</Text>
            </View>
          </Marker>

          {/* الوجهة */}
          <Marker coordinate={destCoord} title="الوجهة">
            <View style={styles.destMarker}>
              <Text style={{ fontSize: 22 }}>🏁</Text>
            </View>
          </Marker>

          {/* مسار السائق → الراكب (أزرق متقطع) */}
          {(phase === "pickup" || phase === "arrived") &&
            routeToPickup && routeToPickup.coords.length >= 2 && (
              <Polyline
                coordinates={routeToPickup.coords}
                strokeColor="#2196F3"
                strokeWidth={5}
                lineDashPattern={[10, 4]}
              />
            )
          }

          {/* مسار الراكب → الوجهة (ذهبي) - يظهر فقط في مرحلة in_trip */}
          {phase === "in_trip" && routeToDropoff && routeToDropoff.coords.length >= 2 && (
            <Polyline
              coordinates={routeToDropoff.coords}
              strokeColor="#FFD700"
              strokeWidth={6}
              lineJoin="round"
              lineCap="round"
            />
          )}
        </MapView>
      ) : (
        <View style={[styles.map, styles.webMap]}>
          <Text style={{ fontSize: 56 }}>🗺️</Text>
          <Text style={styles.webMapLabel}>{config.title}</Text>
        </View>
      )}

      {/* مؤشر تحميل المسار */}
      {isLoadingRoute && (
        <View style={styles.routeLoadingBadge}>
          <ActivityIndicator size="small" color="#FFD700" style={{ marginRight: 6 }} />
          <Text style={styles.routeLoadingText}>جاري تحميل المسار...</Text>
        </View>
      )}

      {/* ─── لوحة الملاحة العلوية (التعليمة الحالية) ─── */}
      {Platform.OS !== "web" && currentInstruction !== "" && (phase === "pickup" || phase === "in_trip") && (
        <View style={[styles.navInstructionBar, { top: insets.top + 8 }]}>
          {/* أيقونة الاتجاه */}
          <View style={styles.navIconBox}>
            <Text style={styles.navIcon}>
              {currentInstruction.includes("يمين") || currentInstruction.includes("right") ? "➡️" :
               currentInstruction.includes("يسار") || currentInstruction.includes("left") ? "⬅️" :
               currentInstruction.includes("دوار") || currentInstruction.includes("roundabout") ? "🔄" :
               currentInstruction.includes("وصل") || currentInstruction.includes("destination") ? "🏁" :
               "⬆️"}
            </Text>
          </View>
          {/* التعليمة والمسافة */}
          <View style={styles.navTextBox}>
            <Text style={styles.navInstructionText} numberOfLines={2}>{currentInstruction}</Text>
            {distanceToNext > 0 && (
              <Text style={styles.navDistanceText}>
                {distanceToNext >= 1000
                  ? `${(distanceToNext / 1000).toFixed(1)} كم`
                  : `${Math.round(distanceToNext)} م`}
              </Text>
            )}
          </View>
          {/* المسافة الكلية والوقت */}
          {remainingKm > 0 && (
            <View style={styles.navEtaBox}>
              <Text style={styles.navEtaKm}>{formatDistanceShort(remainingKm)}</Text>
              <Text style={styles.navEtaMin}>{remainingMin} د</Text>
            </View>
          )}
        </View>
      )}

      {/* زر إعادة التمركز على الكابتن */}
      {Platform.OS !== "web" && !isFollowingDriver && (
        <TouchableOpacity
          style={[styles.recenterBtn, { bottom: insets.bottom + 180 }]}
          onPress={() => {
            setIsFollowingDriver(true);
            if (mapRef.current && isRealLocation) {
              mapRef.current.animateCamera(
                { center: { latitude: coords.latitude, longitude: coords.longitude } },
                { duration: 600 }
              );
            }
          }}
        >
          <Text style={{ fontSize: 22 }}>📍</Text>
        </TouchableOpacity>
      )}

      {/* زر الرجوع - مقيّد حسب مرحلة الرحلة */}
      {phase !== "in_trip" && phase !== "done" && (
        <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8, left: 16 }]} onPress={() => {
          if (phase === "pickup") {
            Alert.alert(
              "⚠️ إلغاء الرحلة",
              "هل تريد إلغاء الرحلة والرجوع؟ سيؤثر ذلك على تقييمك.",
              [
                { text: "لا، أكمل", style: "cancel" },
                {
                  text: "نعم، إلغاء",
                  style: "destructive",
                  onPress: () => {
                    voiceNav.stop();
                    updateStatus.mutate(
                      { rideId: ride?.id ?? rideId, status: "cancelled", cancelReason: "إلغاء من السائق" },
                      { onSettled: () => router.replace("/captain/home" as any) }
                    );
                  },
                },
              ]
            );
          } else if (phase === "arrived") {
            Alert.alert(
              "⚠️ إلغاء الرحلة",
              "وصلت لموقع الراكب بالفعل. هل تريد إلغاء الرحلة؟",
              [
                { text: "لا، انتظر الراكب", style: "cancel" },
                {
                  text: "نعم، إلغاء",
                  style: "destructive",
                  onPress: () => {
                    voiceNav.stop();
                    updateStatus.mutate(
                      { rideId: ride?.id ?? rideId, status: "cancelled", cancelReason: "إلغاء من السائق بعد الوصول" },
                      { onSettled: () => router.replace("/captain/home" as any) }
                    );
                  },
                },
              ]
            );
          }
        }}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
      )}

      {/* شريط الحالة */}
      {(currentInstruction === "" || phase === "arrived" || phase === "done") && (
        <View style={[styles.statusBar, { top: insets.top + 8 }]}>
          <View style={[styles.statusDot, { backgroundColor: config.statusDotColor }]} />
          <Text style={styles.statusTitle}>{config.title}</Text>
        </View>
      )}

      {/* لوحة الرحلة السفلية */}
      <View style={styles.tripSheet}>
        <View style={styles.handle} />

        {/* معلومات الراكب */}
        <View style={styles.passengerRow}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 26 }}>👤</Text>
          </View>
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{ride?.passengerName || "الراكب"}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>⭐ {ride?.passengerRating?.toFixed(1) ?? "5.0"}</Text>
              <Text style={styles.subtitleText}>{config.subtitle}</Text>
            </View>
          </View>
          <View style={styles.actionBtns}>
            {/* زر الاتصال */}
            {ride?.passengerPhone && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={async () => {
                  const cleanPhone = (ride.passengerPhone ?? "").replace(/[^+\d]/g, "");
                  try {
                    await Linking.openURL(`tel:${cleanPhone}`);
                  } catch {
                    Alert.alert("الاتصال", `رقم الراكب: ${cleanPhone}`);
                  }
                }}
              >
                <Text style={styles.actionIcon}>📞</Text>
              </TouchableOpacity>
            )}
            {/* زر الشات */}
            <View style={{ position: "relative" }}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: "#0a7ea4" }]}
                onPress={() => router.push({
                  pathname: "/captain/ride-chat" as any,
                  params: {
                    rideId: (ride?.id ?? rideId).toString(),
                    driverId: driverId.toString(),
                    passengerName: ride?.passengerName ?? "الراكب",
                    rideStatus: ride?.status ?? "accepted",
                  },
                })}
              >
                <Text style={styles.actionIcon}>💬</Text>
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            {/* زر الصوت - تشغيل/إيقاف الملاحة الصوتية */}
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: "#22C55E" }]}
              onPress={() => {
                if (phase === "pickup" || phase === "in_trip") {
                  voiceNav.start(config.navLabel);
                }
              }}
            >
              <Text style={styles.actionIcon}>🔊</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* تفاصيل المسار */}
        <View style={styles.routeBox}>
          <View style={styles.routeRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.routeText} numberOfLines={1}>{ride?.pickupAddress || "موقع الانطلاق"}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.dotRed} />
            <Text style={styles.routeText} numberOfLines={1}>{ride?.dropoffAddress || "الوجهة"}</Text>
          </View>
        </View>

        {/* الأجرة والمسافة والوقت */}
        <View style={styles.fareRow}>
          <Text style={styles.fareItem}>💰 {ride?.fare?.toLocaleString("ar-IQ") ?? "—"} دينار</Text>
          {remainingKm > 0 ? (
            <>
              <Text style={styles.fareItem}>📏 {formatDistanceShort(remainingKm)}</Text>
              <Text style={styles.fareItem}>⏱ {remainingMin} دقيقة</Text>
            </>
          ) : (
            <>
              <Text style={styles.fareItem}>📏 {ride?.estimatedDistance?.toFixed(1) ?? "—"} كم</Text>
              <Text style={styles.fareItem}>⏱ {ride?.estimatedDuration ?? "—"} دقيقة</Text>
            </>
          )}
        </View>

        {/* شريط تقدم المراحل */}
        <View style={styles.stepsRow}>
          {(["pickup", "arrived", "in_trip"] as TripPhase[]).map((p, i) => {
            const labels = ["في الطريق", "وصلت", "الرحلة"];
            const isDone = ["pickup", "arrived", "in_trip"].indexOf(phase) > i;
            const isCurrent = phase === p;
            return (
              <React.Fragment key={p}>
                <View style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    isCurrent && styles.stepDotActive,
                    isDone && styles.stepDotDone,
                  ]} />
                  <Text style={[styles.stepLabel, isCurrent && styles.stepLabelActive]}>{labels[i]}</Text>
                </View>
                {i < 2 && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* زر الإجراء الرئيسي */}
        <TouchableOpacity
          style={[styles.actionMainBtn, { backgroundColor: config.btnColor }]}
          onPress={handlePhaseAction}
          disabled={updateStatus.isPending}
        >
          <Text style={[styles.actionMainBtnText, { color: config.btnTextColor }]}>
            {updateStatus.isPending ? "جاري التحديث..." : config.btnText}
          </Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  map: { flex: 1 },
  webMap: {
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  webMapLabel: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  routeLoadingBadge: {
    position: "absolute",
    bottom: 200,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,5,51,0.92)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
    zIndex: 10,
  },
  routeLoadingText: { color: "#FFD700", fontSize: 12, fontWeight: "600" },

  // ─── لوحة الملاحة العلوية ───────────────────────────────────────────────────
  navInstructionBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A0533",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#FFD700",
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
    gap: 10,
  },
  navIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  navIcon: { fontSize: 22 },
  navTextBox: { flex: 1 },
  navInstructionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  navDistanceText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  navEtaBox: {
    alignItems: "center",
    backgroundColor: "#2D1B4E",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  navEtaKm: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
  navEtaMin: { color: "#9B8EC4", fontSize: 11 },

  // ─── باقي الـ styles ─────────────────────────────────────────────────────────
  backBtn: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(26,5,51,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  backBtnText: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  statusBar: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,5,51,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFD700",
  },
  statusTitle: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  driverMarker: { alignItems: "center" },
  pickupMarker: { alignItems: "center" },
  destMarker: { alignItems: "center" },
  tripSheet: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#3D2070",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#3D2070",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  passengerInfo: { flex: 1 },
  passengerName: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  ratingText: { color: "#FFD700", fontSize: 13 },
  subtitleText: { color: "#9B8EC4", fontSize: 12 },
  actionBtns: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  actionIcon: { fontSize: 16 },
  chatBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#1A0533",
  },
  chatBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" as const },
  routeBox: {
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeLine: { width: 2, height: 16, backgroundColor: "#3D2070", marginLeft: 5, marginVertical: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  routeText: { color: "#ECEDEE", fontSize: 13, flex: 1 },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  fareItem: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3D2070",
    borderWidth: 2,
    borderColor: "#3D2070",
  },
  stepDotActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  stepDotDone: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  stepLabel: { color: "#9B8EC4", fontSize: 10 },
  stepLabelActive: { color: "#FFD700", fontWeight: "bold" },
  stepLine: { flex: 1, height: 2, backgroundColor: "#3D2070", marginBottom: 14, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#22C55E" },
  actionMainBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  actionMainBtnText: { fontSize: 16, fontWeight: "bold" },
  recenterBtn: {
    position: "absolute",
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(26,5,51,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,215,0,0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 50,
  },
});

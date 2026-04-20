/**
 * app/captain/active-trip.tsx
 *
 * شاشة الرحلة النشطة للكابتن - تجربة مثل Google Maps
 *
 * المراحل:
 *  pickup   → الكابتن في الطريق لاستلام الراكب  (مسار أزرق)
 *  arrived  → وصل لموقع الراكب، ينتظره
 *  in_trip  → الرحلة جارية نحو الوجهة           (مسار ذهبي)
 *  done     → اكتملت الرحلة
 *
 * الميزات:
 * - Google Directions API مع بيانات الازدحام
 * - snap-to-road: موقع الكابتن يسير على الطريق بدقة
 * - ETA ديناميكي يتحدث كل 30 ثانية
 * - إعادة حساب المسار تلقائياً عند الانحراف > 80م
 * - تعليمات ملاحة صوتية بالعربي
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useLocation } from "@/hooks/use-location";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";
import { fetchOsrmRoute, type OsrmRouteResult, type LatLng } from "@/lib/osrm";
import { useVoiceNavigation } from "@/hooks/use-voice-navigation";
import { snapToRoads, getDistanceMatrix } from "@/lib/google-maps";

// أنواع 

type TripPhase = "pickup" | "arrived" | "in_trip" | "done";

const STATUS_TO_PHASE: Record<string, TripPhase> = {
  accepted: "pickup",
  driver_arrived: "arrived",
  in_progress: "in_trip",
  completed: "done",
};

const REROUTE_THRESHOLD_M = 80;
const ETA_UPDATE_INTERVAL_MS = 30_000;
const SNAP_BUFFER_SIZE = 4;

// مساعدات 

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function distanceToPolyline(point: LatLng, polyline: LatLng[]): number {
  if (!polyline.length) return Infinity;
  return Math.min(...polyline.map((p) => haversineM(point, p)));
}

function formatEta(minutes: number): string {
  if (minutes <= 0) return "وصلت";
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}س ${m}د` : `${h} ساعة`;
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} م`;
  return `${km.toFixed(1)} كم`;
}

// المكوّن الرئيسي 

export default function CaptainActiveTripScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ rideId?: string }>();
  const { driver } = useDriver();
  const { coords, heading, isRealLocation } = useLocation();
  const voiceNav = useVoiceNavigation();

  const rideId = params.rideId ? parseInt(params.rideId) : 0;
  const driverId = driver?.id ?? 0;

  // حالة الرحلة 
  const [phase, setPhase] = useState<TripPhase>("pickup");
  const localPhaseRef = useRef<TripPhase | null>(null);

  // المسارات 
  const [routeToPickup, setRouteToPickup] = useState<OsrmRouteResult | null>(null);
  const [routeToDropoff, setRouteToDropoff] = useState<OsrmRouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  // snap-to-road 
  const [snappedCoords, setSnappedCoords] = useState<LatLng | null>(null);
  const snapBufferRef = useRef<LatLng[]>([]);

  // ETA 
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);
  const etaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ملاحة 
  const [currentInstruction, setCurrentInstruction] = useState<string>("");
  const [distanceToNext, setDistanceToNext] = useState<number>(0);

  // خريطة 
  const mapRef = useRef<MapView>(null);
  const [isFollowingDriver, setIsFollowingDriver] = useState(true);
  const firstLoadRef = useRef(true);

  // إعادة الحساب 
  const isReroutingRef = useRef(false);

  // جلب بيانات الرحلة 
  const { data: unreadData } = trpc.rides.unreadCount.useQuery(
    { rideId, readerType: "driver" },
    { enabled: rideId > 0 && phase !== "done", refetchInterval: 5000 }
  );
  const unreadCount = unreadData?.count ?? 0;

  const rideQuery = trpc.rides.driverActiveRide.useQuery(
    { driverId, rideId: rideId || undefined },
    { enabled: driverId > 0 && rideId > 0, refetchInterval: 4000, staleTime: 0 }
  );
  const ride = rideQuery.data;

  const pickupCoord: LatLng = ride
    ? { latitude: ride.pickupLat, longitude: ride.pickupLng }
    : { latitude: 36.3392, longitude: 43.1289 };

  const destCoord: LatLng = ride
    ? { latitude: ride.dropoffLat, longitude: ride.dropoffLng }
    : { latitude: 36.3600, longitude: 43.1450 };

  // مزامنة حالة الرحلة مع الخادم 
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
    const dbIdx = phaseOrder.indexOf(mappedPhase);
    const curIdx = phaseOrder.indexOf(localPhaseRef.current ?? phase);
    if (dbIdx > curIdx || localPhaseRef.current === null) {
      localPhaseRef.current = mappedPhase;
      setPhase(mappedPhase);
    }
  }, [ride?.status]);

  // تمركز الخريطة عند أول تحميل 
  useEffect(() => {
    if (ride && mapRef.current && firstLoadRef.current) {
      firstLoadRef.current = false;
      mapRef.current.animateToRegion({
        latitude: pickupCoord.latitude,
        longitude: pickupCoord.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  }, [ride?.id]);

  // دالة جلب المسار 
  const fetchRoute = useCallback(async (from: LatLng, to: LatLng, isPickup: boolean) => {
    if (isReroutingRef.current) return;
    isReroutingRef.current = true;
    setIsLoadingRoute(true);
    try {
      const result = await fetchOsrmRoute(from, to);
      if (!result) return;
      if (isPickup) {
        setRouteToPickup(result);
        setRouteToDropoff(null);
      } else {
        setRouteToDropoff(result);
        setRouteToPickup(null);
      }
      if (result.steps?.length) {
        voiceNav.setSteps(result.steps);
        setCurrentInstruction(result.steps[0].instruction);
        setDistanceToNext(result.steps[0].distanceM);
      }
      setEtaMin(result.durationMin);
      setRemainingKm(result.distanceKm);
    } finally {
      isReroutingRef.current = false;
      setIsLoadingRoute(false);
    }
  }, [voiceNav]);

  // جلب المسار الأولي عند تغيير المرحلة أو توفر الموقع 
  const routeFetchedRef = useRef<{ phase: TripPhase | null; rideId: number | null }>({ phase: null, rideId: null });
  useEffect(() => {
    // انتظار بيانات الرحلة الحقيقية قبل جلب أي مسار
    if (!ride || !ride.pickupLat || !ride.pickupLng) return;
    const driverPos: LatLng = { latitude: coords.latitude, longitude: coords.longitude };
    const realPickup: LatLng = { latitude: ride.pickupLat, longitude: ride.pickupLng };
    const realDest: LatLng = { latitude: ride.dropoffLat, longitude: ride.dropoffLng };
    // تجنب إعادة الجلب لنفس المرحلة ونفس الرحلة
    if (routeFetchedRef.current.phase === phase && routeFetchedRef.current.rideId === ride.id) return;
    routeFetchedRef.current = { phase, rideId: ride.id };
    if (phase === "pickup") {
      // المسار الأزرق: من موقع الكابتن الحالي → موقع الراكب
      fetchRoute(driverPos, realPickup, true);
      voiceNav.start(ride.pickupAddress || "موقع الراكب");
      // تمركز الخريطة على المسار بين الكابتن والراكب
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: (driverPos.latitude + realPickup.latitude) / 2,
          longitude: (driverPos.longitude + realPickup.longitude) / 2,
          latitudeDelta: Math.abs(driverPos.latitude - realPickup.latitude) * 3 + 0.02,
          longitudeDelta: Math.abs(driverPos.longitude - realPickup.longitude) * 3 + 0.02,
        }, 1000);
      }
    } else if (phase === "in_trip") {
      // المسار الذهبي: من موقع الراكب → الوجهة
      fetchRoute(realPickup, realDest, false);
      voiceNav.start(ride.dropoffAddress || "الوجهة");
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: (realPickup.latitude + realDest.latitude) / 2,
          longitude: (realPickup.longitude + realDest.longitude) / 2,
          latitudeDelta: Math.abs(realPickup.latitude - realDest.latitude) * 2.5 + 0.04,
          longitudeDelta: Math.abs(realPickup.longitude - realDest.longitude) * 2.5 + 0.04,
        }, 1000);
      }
    }
  }, [phase, ride?.id, ride?.pickupLat, ride?.pickupLng, coords.latitude, coords.longitude]);

  // snap-to-road + إعادة حساب المسار عند تحرك الكابتن 
  useEffect(() => {
    if (!isRealLocation) return;
    const current: LatLng = { latitude: coords.latitude, longitude: coords.longitude };

    // تراكم نقاط snap-to-road
    snapBufferRef.current.push(current);
    if (snapBufferRef.current.length >= SNAP_BUFFER_SIZE) {
      const buffer = [...snapBufferRef.current];
      snapBufferRef.current = [];
      snapToRoads(buffer).then((snapped) => {
        if (snapped.length > 0) {
          setSnappedCoords(snapped[snapped.length - 1]);
        }
      }).catch(() => {});
    }

    // تحديث الملاحة الصوتية
    voiceNav.onLocationUpdate(current);

    // إعادة حساب المسار عند الانحراف
    if (isReroutingRef.current || !ride) return;
    const activeRoute = phase === "in_trip" ? routeToDropoff : routeToPickup;
    if (!activeRoute?.coords.length) return;

    const distToRoute = distanceToPolyline(current, activeRoute.coords);
    if (distToRoute > REROUTE_THRESHOLD_M) {
      if (phase === "pickup") {
        fetchRoute(current, pickupCoord, true);
      } else if (phase === "in_trip") {
        fetchRoute(current, destCoord, false);
      }
    }
  }, [coords.latitude, coords.longitude, isRealLocation]);

  // تتبع الكابتن على الخريطة 
  useEffect(() => {
    if (!isFollowingDriver || !mapRef.current) return;
    const displayCoord = snappedCoords ?? { latitude: coords.latitude, longitude: coords.longitude };
    mapRef.current.animateCamera({
      center: displayCoord,
      heading: heading ?? 0,
      pitch: 45,
      zoom: 17,
      altitude: 500,
    }, { duration: 800 });
  }, [coords.latitude, coords.longitude, snappedCoords, isFollowingDriver]);

  // ETA ديناميكي كل 30 ثانية 
  useEffect(() => {
    if (phase === "done" || phase === "arrived") {
      if (etaTimerRef.current) clearInterval(etaTimerRef.current);
      return;
    }
    const updateEta = async () => {
      if (!ride || !isRealLocation) return;
      const from: LatLng = { latitude: coords.latitude, longitude: coords.longitude };
      const to = phase === "in_trip" ? destCoord : pickupCoord;
      const result = await getDistanceMatrix(from, to);
      if (result) {
        setEtaMin(result.durationInTrafficMin);
        setRemainingKm(result.distanceKm);
      }
    };
    updateEta();
    etaTimerRef.current = setInterval(updateEta, ETA_UPDATE_INTERVAL_MS);
    return () => {
      if (etaTimerRef.current) clearInterval(etaTimerRef.current);
    };
  }, [phase, ride?.id, isRealLocation]);

  // تنظيف عند الخروج 
  useEffect(() => {
    return () => {
      voiceNav.stop();
      if (etaTimerRef.current) clearInterval(etaTimerRef.current);
    };
  }, []);

  // إجراءات الأزرار 
  const updateStatus = trpc.rides.updateStatus.useMutation();

  const handlePhaseAction = () => {
    const actualRideId = ride?.id ?? rideId;
    if (!actualRideId) {
      Alert.alert("خطأ", "لم يتم تحميل بيانات الرحلة.");
      return;
    }
    if (updateStatus.isPending) return;

    if (phase === "pickup") {
      localPhaseRef.current = "arrived";
      setPhase("arrived");
      routeFetchedRef.current = { phase: "arrived", rideId: ride?.id ?? null };
      voiceNav.announceArrival("موقع الراكب");
      if (etaTimerRef.current) clearInterval(etaTimerRef.current);
      setEtaMin(null);
      mapRef.current?.animateToRegion({ ...pickupCoord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 800);
      updateStatus.mutate(
        { rideId: actualRideId, status: "driver_arrived" },
        {
          onError: () => {
            localPhaseRef.current = "pickup";
            setPhase("pickup");
          routeFetchedRef.current = { phase: "arrived", rideId: null };
            Alert.alert("خطأ", "فشل تحديث الحالة.");
          },
        }
      );
    } else if (phase === "arrived") {
      localPhaseRef.current = "in_trip";
      setPhase("in_trip");
      routeFetchedRef.current = { phase: "in_trip", rideId: null }; // اسمح بجلب مسار جديد
      updateStatus.mutate(
        { rideId: actualRideId, status: "in_progress" },
        {
          onError: () => {
            localPhaseRef.current = "arrived";
            setPhase("arrived");
            routeFetchedRef.current = { phase: "arrived", rideId: ride?.id ?? null };
            Alert.alert("خطأ", "فشل تحديث الحالة.");
          },
        }
      );
    } else if (phase === "in_trip") {
      localPhaseRef.current = "done";
      setPhase("done");
      voiceNav.stop();
      if (etaTimerRef.current) clearInterval(etaTimerRef.current);

      const fareVal = ride?.fare?.toString() ?? "0";
      const distVal = routeToDropoff?.distanceKm?.toString() ?? ride?.estimatedDistance?.toString() ?? "0";
      const durVal = routeToDropoff?.durationMin?.toString() ?? ride?.estimatedDuration?.toString() ?? "0";
      const pName = ride?.passengerName ?? "الراكب";
      const pickupAddr = ride?.pickupAddress ?? "";
      const dropoffAddr = ride?.dropoffAddress ?? "";

      updateStatus.mutate(
        { rideId: actualRideId, status: "completed" },
        {
          onSuccess: () => {
            router.replace({
              pathname: "/captain/trip-summary" as any,
              params: { rideId: actualRideId.toString(), fare: fareVal, distance: distVal, duration: durVal, passengerName: pName, pickupAddress: pickupAddr, dropoffAddress: dropoffAddr },
            });
          },
          onError: () => {
            localPhaseRef.current = "in_trip";
            setPhase("in_trip");
            Alert.alert("خطأ", "فشل إنهاء الرحلة.");
          },
        }
      );
    } else if (phase === "done") {
      router.replace("/captain/home" as any);
    }
  };

  // إعداد كل مرحلة 
  const phaseConfig = {
    pickup: {
      title: "في الطريق لاستلام الراكب",
      subtitle: ride?.pickupAddress || "موقع الراكب",
      btnText: "وصلت لموقع الراكب ✓",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      statusDotColor: "#FFD700",
      navLabel: ride?.pickupAddress || "موقع الراكب",
    },
    arrived: {
      title: "وصلت لموقع الراكب 📍",
      subtitle: "في انتظار الراكب...",
      btnText: "بدء الرحلة ▶",
      btnColor: "#22C55E",
      btnTextColor: "#FFFFFF",
      statusDotColor: "#22C55E",
      navLabel: "",
    },
    in_trip: {
      title: "الرحلة جارية",
      subtitle: ride?.dropoffAddress || "الوجهة",
      btnText: "إنهاء الرحلة ✓",
      btnColor: "#22C55E",
      btnTextColor: "#FFFFFF",
      statusDotColor: "#22C55E",
      navLabel: ride?.dropoffAddress || "الوجهة",
    },
    done: {
      title: "اكتملت الرحلة 🎉",
      subtitle: "شكراً لك!",
      btnText: "العودة للرئيسية",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      statusDotColor: "#FFD700",
      navLabel: "",
    },
  };
  const config = phaseConfig[phase];
  const displayCoord = snappedCoords ?? { latitude: coords.latitude, longitude: coords.longitude };

  // شاشة التحميل 
  if (rideQuery.isLoading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: "#FFD700", marginTop: 12 }}>جاري تحميل بيانات الرحلة...</Text>
      </View>
    );
  }

  // الواجهة 
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/*  الخريطة  */}
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
          showsBuildings={true}
          onPanDrag={() => setIsFollowingDriver(false)}
        >
          {/* موقع الكابتن - مثبّت على الطريق */}
          <Marker coordinate={displayCoord} anchor={{ x: 0.5, y: 0.5 }} flat rotation={heading ?? 0}>
            <View style={styles.driverMarker}>
              <Text style={{ fontSize: 28 }}>🚗</Text>
            </View>
          </Marker>

          {/* موقع الراكب */}
          <Marker coordinate={pickupCoord} title="موقع الراكب">
            <View style={styles.pickupMarker}>
              <Text style={{ fontSize: 24 }}>👤</Text>
            </View>
          </Marker>

          {/* الوجهة */}
          <Marker coordinate={destCoord} title="الوجهة">
            <View style={styles.destMarker}>
              <Text style={{ fontSize: 24 }}>🏁</Text>
            </View>
          </Marker>

           {/* مسار الكابتن → الراكب - أزرق سميك مثل Google Maps */}
          {(phase === "pickup" || phase === "arrived") && routeToPickup && routeToPickup.coords.length >= 2 && (
            <>
              {/* حدود بيضاء خارجية */}
              <Polyline
                coordinates={routeToPickup.coords}
                strokeColor="#FFFFFF"
                strokeWidth={12}
                lineJoin="round"
                lineCap="round"
              />
              {/* الخط الأزرق الداكن السميك */}
              <Polyline
                coordinates={routeToPickup.coords}
                strokeColor="#1A73E8"
                strokeWidth={8}
                lineJoin="round"
                lineCap="round"
              />
            </>
          )}
          {/* مسار الراكب → الوجهة - بنفسجي سميك مثل Google Maps */}
          {phase === "in_trip" && routeToDropoff && routeToDropoff.coords.length >= 2 && (
            <>
              {/* حدود بيضاء خارجية */}
              <Polyline
                coordinates={routeToDropoff.coords}
                strokeColor="#FFFFFF"
                strokeWidth={12}
                lineJoin="round"
                lineCap="round"
              />
              {/* الخط البنفسجي السميك */}
              <Polyline
                coordinates={routeToDropoff.coords}
                strokeColor="#4A00E0"
                strokeWidth={8}
                lineJoin="round"
                lineCap="round"
              />
            </>
          )}
        </MapView>
      ) : (
        <View style={[styles.map, { backgroundColor: "#1A0533", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ color: "#FFD700", fontSize: 16 }}>الخريطة متاحة على iOS/Android فقط</Text>
        </View>
      )}

      {/*  لوحة الملاحة العلوية  */}
      {currentInstruction !== "" && phase !== "arrived" && phase !== "done" && (
        <View style={[styles.navBar, { top: insets.top + 8 }]}>
          <View style={styles.navBarLeft}>
            {etaMin !== null && (
              <>
                <Text style={styles.navEtaMin}>{formatEta(etaMin)}</Text>
                {remainingKm !== null && (
                  <Text style={styles.navEtaKm}>{formatDist(remainingKm)}</Text>
                )}
              </>
            )}
          </View>
          <View style={styles.navBarCenter}>
            <Text style={styles.navInstruction} numberOfLines={2}>
              {currentInstruction.includes("يمين") ? "➡️ " :
               currentInstruction.includes("يسار") ? "⬅️ " :
               currentInstruction.includes("دوار") ? "🔄 " :
               currentInstruction.includes("وصل") ? "🏁 " : "⬆️ "}
              {currentInstruction}
            </Text>
            {distanceToNext > 0 && (
              <Text style={styles.navDistance}>
                {distanceToNext >= 1000 ? `${(distanceToNext / 1000).toFixed(1)} كم` : `${Math.round(distanceToNext)} م`}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.navVoiceBtn}
            onPress={() => voiceNav.start(config.navLabel)}
          >
            <Text style={{ fontSize: 20 }}>🔊</Text>
          </TouchableOpacity>
        </View>
      )}

      {/*  شريط الحالة (عند عدم وجود تعليمة)  */}
      {(currentInstruction === "" || phase === "arrived" || phase === "done") && (
        <View style={[styles.statusBar, { top: insets.top + 8 }]}>
          <View style={[styles.statusDot, { backgroundColor: config.statusDotColor }]} />
          <Text style={styles.statusTitle}>{config.title}</Text>
        </View>
      )}

      {/*  مؤشر تحميل المسار  */}
      {isLoadingRoute && (
        <View style={[styles.rerouteIndicator, { top: insets.top + 70 }]}>
          <ActivityIndicator size="small" color="#FFD700" />
          <Text style={styles.rerouteText}>
            {isReroutingRef.current ? "إعادة حساب المسار..." : "جاري تحميل المسار..."}
          </Text>
        </View>
      )}

      {/*  زر إعادة التمركز  */}
      {!isFollowingDriver && (
        <TouchableOpacity
          style={[styles.recenterBtn, { bottom: 230 }]}
          onPress={() => {
            setIsFollowingDriver(true);
            mapRef.current?.animateCamera({
              center: displayCoord,
              heading: heading ?? 0,
              pitch: 45,
              zoom: 17,
            }, { duration: 600 });
          }}
        >
          <Text style={{ fontSize: 22 }}>📍</Text>
        </TouchableOpacity>
      )}

      {/*  زر الرجوع / الإلغاء  */}
      {phase !== "in_trip" && phase !== "done" && (
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8, left: 16 }]}
          onPress={() => {
            const msg = phase === "pickup"
              ? "هل تريد إلغاء الرحلة والرجوع؟ سيؤثر ذلك على تقييمك."
              : "وصلت لموقع الراكب بالفعل. هل تريد إلغاء الرحلة؟";
            const cancelReason = phase === "pickup" ? "إلغاء من السائق" : "إلغاء من السائق بعد الوصول";
            Alert.alert("⚠️ إلغاء الرحلة", msg, [
              { text: "لا، أكمل", style: "cancel" },
              {
                text: "نعم، إلغاء",
                style: "destructive",
                onPress: () => {
                  voiceNav.stop();
                  updateStatus.mutate(
                    { rideId: ride?.id ?? rideId, status: "cancelled", cancelReason },
                    { onSettled: () => router.replace("/captain/home" as any) }
                  );
                },
              },
            ]);
          }}
        >
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
      )}

      {/*  اللوحة السفلية  */}
      <View style={[styles.tripSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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
              <Text style={styles.subtitleText} numberOfLines={1}>{config.subtitle}</Text>
            </View>
          </View>
          <View style={styles.actionBtns}>
            {ride?.passengerPhone && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={async () => {
                  const cleanPhone = (ride.passengerPhone ?? "").replace(/[^+\d]/g, "");
                  try { await Linking.openURL(`tel:${cleanPhone}`); } catch { Alert.alert("الاتصال", `رقم الراكب: ${cleanPhone}`); }
                }}
              >
                <Text style={styles.actionIcon}>📞</Text>
              </TouchableOpacity>
            )}
            <View style={{ position: "relative" }}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: "#0a7ea4" }]}
                onPress={() => router.push({
                  pathname: "/captain/ride-chat" as any,
                  params: { rideId: (ride?.id ?? rideId).toString(), driverId: driverId.toString(), passengerName: ride?.passengerName ?? "الراكب", rideStatus: ride?.status ?? "accepted" },
                })}
              >
                <Text style={styles.actionIcon}>💬</Text>
              </TouchableOpacity>
              {unreadCount > 0 && (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: "#22C55E" }]}
              onPress={() => voiceNav.start(config.navLabel)}
            >
              <Text style={styles.actionIcon}>🔊</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* معلومات المسار */}
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

        {/* ETA والمسافة والأجرة */}
        <View style={styles.fareRow}>
          <View style={styles.fareItem}>
            <Text style={styles.fareLabel}>الوقت</Text>
            <Text style={styles.fareValue}>
              {etaMin !== null ? formatEta(etaMin) : (isLoadingRoute ? "..." : "--")}
            </Text>
          </View>
          <View style={styles.fareDivider} />
          <View style={styles.fareItem}>
            <Text style={styles.fareLabel}>المسافة</Text>
            <Text style={styles.fareValue}>
              {remainingKm !== null ? formatDist(remainingKm) : (isLoadingRoute ? "..." : "--")}
            </Text>
          </View>
          <View style={styles.fareDivider} />
          <View style={styles.fareItem}>
            <Text style={styles.fareLabel}>الأجرة</Text>
            <Text style={styles.fareValue}>
              {ride?.fare ? `${ride.fare.toLocaleString()} د.ع` : "--"}
            </Text>
          </View>
        </View>

        {/* مؤشر الخطوات */}
        <View style={styles.stepsRow}>
          {(["pickup", "arrived", "in_trip", "done"] as TripPhase[]).map((p, i, arr) => {
            const phaseOrder: TripPhase[] = ["pickup", "arrived", "in_trip", "done"];
            const curIdx = phaseOrder.indexOf(phase);
            const pIdx = phaseOrder.indexOf(p);
            const isDone = pIdx < curIdx;
            const isActive = pIdx === curIdx;
            const labels = ["استلام", "وصول", "رحلة", "اكتمال"];
            return (
              <React.Fragment key={p}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepDot, isDone && styles.stepDotDone, isActive && styles.stepDotActive]} />
                  <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{labels[i]}</Text>
                </View>
                {i < arr.length - 1 && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* زر الإجراء الرئيسي */}
        <TouchableOpacity
          style={[styles.actionMainBtn, { backgroundColor: config.btnColor }, updateStatus.isPending && { opacity: 0.7 }]}
          onPress={handlePhaseAction}
          disabled={updateStatus.isPending}
        >
          {updateStatus.isPending ? (
            <ActivityIndicator color={config.btnTextColor} />
          ) : (
            <Text style={[styles.actionMainBtnText, { color: config.btnTextColor }]}>{config.btnText}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Styles 

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  map: { flex: 1 },

  navBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,5,51,0.96)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#FFD700",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    gap: 10,
    zIndex: 100,
  },
  navBarLeft: { alignItems: "center", minWidth: 52 },
  navEtaMin: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  navEtaKm: { color: "#9B8EC4", fontSize: 11, marginTop: 2 },
  navBarCenter: { flex: 1 },
  navInstruction: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textAlign: "right" },
  navDistance: { color: "#FFD700", fontSize: 12, marginTop: 2, textAlign: "right" },
  navVoiceBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#3D2070",
  },

  statusBar: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,5,51,0.92)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
    zIndex: 100,
    gap: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { color: "#FFD700", fontSize: 13, fontWeight: "600" },

  rerouteIndicator: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,5,51,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#FFD700",
    zIndex: 99,
  },
  rerouteText: { color: "#FFD700", fontSize: 12 },

  recenterBtn: {
    position: "absolute",
    right: 16,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(26,5,51,0.92)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,215,0,0.6)",
    elevation: 6, zIndex: 50,
  },

  backBtn: {
    position: "absolute",
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(26,5,51,0.85)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#FFD700",
    zIndex: 100,
  },
  backBtnText: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },

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
  handle: { width: 40, height: 4, backgroundColor: "#3D2070", borderRadius: 2, alignSelf: "center", marginBottom: 14 },

  passengerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center",
    marginRight: 12, borderWidth: 2, borderColor: "#FFD700",
  },
  passengerInfo: { flex: 1 },
  passengerName: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  ratingText: { color: "#FFD700", fontSize: 13 },
  subtitleText: { color: "#9B8EC4", fontSize: 12, flex: 1 },
  actionBtns: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#3D2070",
  },
  actionIcon: { fontSize: 16 },
  chatBadge: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18,
    borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: "#1A0533",
  },
  chatBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" as const },

  routeBox: {
    backgroundColor: "#2D1B4E", borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: "#3D2070",
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeLine: { width: 2, height: 14, backgroundColor: "#3D2070", marginLeft: 4, marginVertical: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  routeText: { color: "#ECEDEE", fontSize: 13, flex: 1 },

  fareRow: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    backgroundColor: "#2D1B4E", borderRadius: 12, padding: 10, marginBottom: 10,
    borderWidth: 1, borderColor: "#3D2070",
  },
  fareItem: { alignItems: "center", flex: 1 },
  fareLabel: { color: "#9B8EC4", fontSize: 11, marginBottom: 2 },
  fareValue: { color: "#FFD700", fontSize: 14, fontWeight: "700" },
  fareDivider: { width: 1, height: 30, backgroundColor: "#3D2070" },

  stepsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10, paddingHorizontal: 8 },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#3D2070", borderWidth: 2, borderColor: "#3D2070" },
  stepDotActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  stepDotDone: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  stepLabel: { color: "#9B8EC4", fontSize: 10 },
  stepLabelActive: { color: "#FFD700", fontWeight: "bold" },
  stepLine: { flex: 1, height: 2, backgroundColor: "#3D2070", marginBottom: 14, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#22C55E" },

  actionMainBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 4 },
  actionMainBtnText: { fontSize: 16, fontWeight: "bold" },
});

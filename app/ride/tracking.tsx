import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  Linking,
  ActivityIndicator,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { trpc } from "@/lib/trpc";
import { fetchOsrmRoute, type OsrmRouteResult, type LatLng } from "@/lib/osrm";
import {
  notifyRideAccepted,
  notifyDriverArrived,
  notifyRideCompleted,
  notifyRideCancelled,
  notifyNoDriversAvailable,
  registerPassengerNotifications,
} from "@/lib/passenger-notifications";

// مراحل الرحلة من منظور الراكب
// 0 = searching: جاري البحث عن سائق
// 1 = accepted:  تم قبول الطلب، السائق في الطريق
// 2 = driver_arrived: السائق وصل لموقعك
// 3 = in_progress: الرحلة جارية
// 4 = completed: وصلت

const RIDE_STEPS = [
  { id: 0, label: "جاري البحث عن سائق...", icon: "🔍", dbStatus: "searching" },
  { id: 1, label: "تم العثور على سائق! في طريقه إليك 🚗", icon: "✅", dbStatus: "accepted" },
  { id: 2, label: "السائق وصل! ابحث عنه 📍", icon: "📍", dbStatus: "driver_arrived" },
  { id: 3, label: "في الطريق إلى وجهتك 🛣️", icon: "🛣️", dbStatus: "in_progress" },
  { id: 4, label: "وصلت إلى وجهتك! 🎉", icon: "🎉", dbStatus: "completed" },
];

const STATUS_TO_STEP: Record<string, number> = {
  searching: 0,
  accepted: 1,
  driver_arrived: 2,
  in_progress: 3,
  completed: 4,
  cancelled: -1,
};

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    rideId?: string;
    passengerId?: string;
    fare?: string;
    pickupLat?: string;
    pickupLng?: string;
    dropoffLat?: string;
    dropoffLng?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
  }>();

  const rideId = params.rideId ? parseInt(params.rideId) : 0;
  const passengerId = params.passengerId ? parseInt(params.passengerId) : 0;
  const fare = params.fare ? parseInt(params.fare) : 0;
  const pickupCoord = {
    latitude: params.pickupLat ? parseFloat(params.pickupLat) : 36.3392,
    longitude: params.pickupLng ? parseFloat(params.pickupLng) : 43.1289,
  };
  const dropoffCoord = {
    latitude: params.dropoffLat ? parseFloat(params.dropoffLat) : 36.3600,
    longitude: params.dropoffLng ? parseFloat(params.dropoffLng) : 43.1450,
  };

  const [currentStep, setCurrentStep] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const [noDrivers, setNoDrivers] = useState(false);
  // تتبع مرحلة الرحلة عند الإلغاء لتحديد نوع الاستجابة
  const [driverCancelledAtPhase, setDriverCancelledAtPhase] = useState<"pickup" | "arrived" | null>(null);
  // حالة إعادة البحث التلقائية عند إلغاء السائق في مرحلة pickup
  const [autoRetrying, setAutoRetrying] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView>(null);
  const prevStepRef = useRef(0);
  const navigatedToRatingRef = useRef(false);
  const noDriversTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [completed, setCompleted] = useState(false);
  // عداد البحث عن سائق (بالثواني)
  const [searchElapsed, setSearchElapsed] = useState(0);
  const SEARCH_TIMEOUT = 180; // 3 دقائق = 180 ثانية
  // رقم الرحلة الحالي (يتغير عند إعادة المحاولة)
  const [activeRideId, setActiveRideId] = useState(rideId);
  const [isRetrying, setIsRetrying] = useState(false);
  // مسارات OSRM الحقيقية
  const [routeDriverToPickup, setRouteDriverToPickup] = useState<OsrmRouteResult | null>(null);
  const [routePickupToDropoff, setRoutePickupToDropoff] = useState<OsrmRouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const prevDriverLatRef = useRef<number | null>(null);
  const prevDriverLngRef = useRef<number | null>(null);

  // mutation إعادة المحاولة - ينشئ طلب جديد حقيقي في السيرفر
  const requestRideMutation = trpc.rides.request.useMutation();

  // عدد الرسائل غير المقروءة للبادج على زر الشات
  const { data: unreadData } = trpc.rides.unreadCount.useQuery(
    { rideId: activeRideId || rideId, readerType: "passenger" },
    { enabled: (activeRideId || rideId) > 0 && currentStep > 0, refetchInterval: 5000 }
  );
  const unreadCount = unreadData?.count ?? 0;

  // طلب صلاحيات الإشعارات عند فتح الشاشة
  useEffect(() => {
    registerPassengerNotifications();
  }, []);

  // جلب مسار الراكب → الوجهة عند توفر الإحداثيات الحقيقية (params)
  useEffect(() => {
    // تجاهل الإحداثيات الافتراضية - انتظر حتى تصل البيانات الحقيقية
    if (!params.pickupLat || !params.dropoffLat) return;
    const pickup: LatLng = { latitude: pickupCoord.latitude, longitude: pickupCoord.longitude };
    const dropoff: LatLng = { latitude: dropoffCoord.latitude, longitude: dropoffCoord.longitude };
    setIsLoadingRoute(true);
    fetchOsrmRoute(pickup, dropoff).then((res) => {
      if (res) setRoutePickupToDropoff(res);
    }).finally(() => setIsLoadingRoute(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.pickupLat, params.pickupLng, params.dropoffLat, params.dropoffLng]);

  // عداد البحث المرئي - يعمل فقط عند currentStep === 0
  useEffect(() => {
    if (currentStep === 0 && !cancelled && !completed) {
      setSearchElapsed(0);
      searchTimerRef.current = setInterval(() => {
        setSearchElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    }
    return () => {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [currentStep, cancelled, completed]);

  // مؤقت "\u0644ا يوجد سائقون" — 3 دقائق بدون قبول
  useEffect(() => {
    if (noDriversTimerRef.current) clearTimeout(noDriversTimerRef.current);
    if (currentStep === 0 && !cancelled && !completed) {
      noDriversTimerRef.current = setTimeout(() => {
        setNoDrivers(true);
        notifyNoDriversAvailable();
      }, 3 * 60 * 1000); // 3 دقائق
    }
    return () => {
      if (noDriversTimerRef.current) clearTimeout(noDriversTimerRef.current);
    };
  }, [currentStep, cancelled, completed]);

  // Polling حقيقي لحالة الرحلة كل 5 ثوانّ - يستخدم activeRideId لدعم إعادة المحاولة
  const rideQuery = trpc.rides.passengerActiveRide.useQuery(
    { passengerId: passengerId ?? 0, rideId: activeRideId || undefined },
    {
      enabled: !!passengerId && !!activeRideId && !cancelled && !completed,
      refetchInterval: 5000,
      staleTime: 0,
    }
  );

  const ride = rideQuery.data;

  // مزامنة الخطوة مع حالة DB
  useEffect(() => {
    if (!ride) return;

    if (ride.status === "cancelled") {
      // تحديد مرحلة الرحلة عند الإلغاء
      const cancelReason = ride.cancelReason ?? "";
      const wasDriverCancel = cancelReason.includes("سائق") || cancelReason.includes("driver");
      const prevStep = prevStepRef.current;

      if (wasDriverCancel && prevStep === 1) {
        // الحالة الأولى: السائق ألغى وهو في الطريق للراكب (accepted)
        // إعادة بحث تلقائية
        setDriverCancelledAtPhase("pickup");
        setAutoRetrying(true);
        notifyRideCancelled();
        // إعادة بحث تلقائية بعد 2 ثانية
        setTimeout(() => {
          requestRideMutation.mutate(
            {
              passengerId,
              pickupLat: pickupCoord.latitude,
              pickupLng: pickupCoord.longitude,
              pickupAddress: params.pickupAddress ?? "",
              dropoffLat: dropoffCoord.latitude,
              dropoffLng: dropoffCoord.longitude,
              dropoffAddress: params.dropoffAddress ?? "",
              paymentMethod: "cash",
              quotedFare: fare,
            },
            {
              onSuccess: (data) => {
                setActiveRideId(data.ride.id);
                prevStepRef.current = 0;
                setCurrentStep(0);
                setSearchElapsed(0);
                setNoDrivers(false);
                setAutoRetrying(false);
                setDriverCancelledAtPhase(null);
              },
              onError: () => {
                setAutoRetrying(false);
                setCancelled(true);
                setDriverCancelledAtPhase(null);
              },
            }
          );
        }, 2000);
        return;
      } else if (wasDriverCancel && prevStep === 2) {
        // الحالة الثانية: السائق ألغى بعد الوصول لموقع الراكب
        // رسالة مع خيار إعادة البحث
        setCancelled(true);
        setDriverCancelledAtPhase("arrived");
        notifyRideCancelled();
        return;
      } else {
        // إلغاء عادي (من الراكب أو من السيرفر)
        setCancelled(true);
        notifyRideCancelled();
        Alert.alert("تم إلغاء الرحلة", "تم إلغاء الرحلة.", [
          { text: "حسناً", onPress: () => router.replace("/(tabs)" as any) },
        ]);
        return;
      }
    }

    const step = STATUS_TO_STEP[ride.status] ?? 0;
    if (step !== prevStepRef.current) {
      prevStepRef.current = step;
      setCurrentStep(step);
      // إشعارات عند تغيير المرحلة
      if (step === 1) notifyRideAccepted(ride.driver?.name ?? "السائق");
      if (step === 2) notifyDriverArrived(ride.driver?.name ?? "السائق");

      // تحريك الخريطة عند تغيير المرحلة
      if (step === 1 && ride.driver?.currentLat && ride.driver?.currentLng) {
        mapRef.current?.animateToRegion({
          latitude: ride.driver.currentLat,
          longitude: ride.driver.currentLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 800);
      } else if (step === 3) {
        mapRef.current?.animateToRegion({
          latitude: dropoffCoord.latitude,
          longitude: dropoffCoord.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 800);
      }
    }

    // انتقل لشاشة التقييم عند الاكتمال - مرة واحدة فقط
    if (ride.status === "completed" && !navigatedToRatingRef.current) {
      navigatedToRatingRef.current = true;
      setCompleted(true);
      notifyRideCompleted(ride.fare ?? fare);
      setCurrentStep(4); // عرض مرحلة "وصلت" فوراً
      const navParams = {
        driverName: ride.driver?.name ?? "السائق",
        driverAvatar: "👨",
        driverRating: ride.driver?.rating?.toString() ?? "5.0",
        fare: (ride.fare ?? fare).toString(),
        rideId: rideId.toString(),
        dropoffAddress: params.dropoffAddress ?? "",
        dropoffLat: dropoffCoord.latitude.toString(),
        dropoffLng: dropoffCoord.longitude.toString(),
      };
      // انتظر 1.8 ثانية حتى يرى الراكب رسالة "وصلت“ ثم ينتقل
      setTimeout(() => {
        router.replace({
          pathname: "/ride/rating" as any,
          params: navParams,
        });
      }, 1800);
    }
  }, [ride?.status]);

  // نبضة للتأثير البصري
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // إلغاء الرحلة الحقيقي
  const cancelMutation = trpc.rides.cancel.useMutation();
  const handleCancel = () => {
    Alert.alert("إلغاء الرحلة", "هل أنت متأكد من إلغاء الرحلة؟", [
      { text: "لا", style: "cancel" },
      {
        text: "نعم، إلغاء",
        style: "destructive",
        onPress: () => {
          cancelMutation.mutate(
            { rideId, passengerId, reason: "ألغى الراكب الرحلة" },
            {
              onSuccess: () => {
                setCancelled(true);
                router.replace("/(tabs)" as any);
              },
              onError: () => {
                // حتى لو فشل السيرفر، نرجع للرئيسية
                router.replace("/(tabs)" as any);
              },
            }
          );
        },
      },
    ]);
  };

  const step = RIDE_STEPS[currentStep] ?? RIDE_STEPS[0];
  const driverName = ride?.driver?.name ?? (currentStep > 0 ? "السائق" : "جاري البحث...");
  const driverCar = ride?.driver
    ? `${ride.driver.vehicleModel ?? ""} ${ride.driver.vehicleColor ?? ""}`.trim() || "—"
    : "—";
  const driverPlate = ride?.driver?.vehiclePlate ?? "—";
  const driverRating = ride?.driver?.rating ?? "5.0";
  const driverPhone = ride?.driver?.phone;
  const driverLat = ride?.driver?.currentLat;
  const driverLng = ride?.driver?.currentLng;
  const actualFare = ride?.fare ?? fare;

  // جلب/تحديث مسار السائق → الراكب عند تحرك السائق (المرحلة 1 و 2 فقط)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!driverLat || !driverLng) return;
    if (currentStep < 1 || currentStep > 2) return;
    // تحديث فقط إذا تحرك السائق بمقدار ملحوظ (> 0.0001 درجة ≈ 11 متر)
    const prevLat = prevDriverLatRef.current;
    const prevLng = prevDriverLngRef.current;
    if (
      prevLat !== null && prevLng !== null &&
      Math.abs(driverLat - prevLat) < 0.0001 &&
      Math.abs(driverLng - prevLng) < 0.0001
    ) return;
    prevDriverLatRef.current = driverLat;
    prevDriverLngRef.current = driverLng;
    const driverPos: LatLng = { latitude: driverLat, longitude: driverLng };
    const pickup: LatLng = { latitude: pickupCoord.latitude, longitude: pickupCoord.longitude };
    fetchOsrmRoute(driverPos, pickup).then((res) => {
      if (res) setRouteDriverToPickup(res);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng, currentStep]);

  // دالة إعادة المحاولة الحقيقية - تنشئ طلب جديد في السيرفر
  const handleRetry = () => {
    if (isRetrying) return;
    setIsRetrying(true);
    requestRideMutation.mutate(
      {
        passengerId: passengerId,
        pickupLat: pickupCoord.latitude,
        pickupLng: pickupCoord.longitude,
        pickupAddress: params.pickupAddress ?? "",
        dropoffLat: dropoffCoord.latitude,
        dropoffLng: dropoffCoord.longitude,
        dropoffAddress: params.dropoffAddress ?? "",
        paymentMethod: "cash",
        quotedFare: fare,
      },
      {
        onSuccess: (data) => {
          // تحديث رقم الرحلة وإعادة تشغيل البحث
          setActiveRideId(data.ride.id);
          prevStepRef.current = 0;
          setCurrentStep(0);
          setSearchElapsed(0);
          setNoDrivers(false);
          setIsRetrying(false);
        },
        onError: () => {
          setIsRetrying(false);
          Alert.alert("خطأ", "حدث خطأ أثناء إعادة المحاولة. حاول مرة أخرى.");
        },
      }
    );
  };

  // شاشة الحالة الأولى: السائق ألغى وهو في الطريق - إعادة بحث تلقائية
  if (driverCancelledAtPhase === "pickup") {
    return (
      <View style={[styles.container, styles.noDriversContainer]}>
        <StatusBar style="light" />
        <Text style={styles.noDriversEmoji}>{autoRetrying ? "🔄" : "😔"}</Text>
        <Text style={styles.noDriversTitle}>
          {autoRetrying ? "جاري البحث عن سائق جديد..." : "ألغى السائق الرحلة"}
        </Text>
        <Text style={styles.noDriversText}>
          {autoRetrying
            ? "ألغى السائق الرحلة أثناء توجهه إليك. نبحث لك عن سائق آخر تلقائياً..."
            : "لم نتمكن من إيجاد سائق بديل. يمكنك إعادة المحاولة."}
        </Text>
        {autoRetrying ? (
          <ActivityIndicator color="#FFD700" size="large" style={{ marginTop: 20 }} />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.retryBtn, isRetrying && { opacity: 0.6 }]}
              onPress={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <ActivityIndicator color="#1A1040" size="small" />
              ) : (
                <Text style={styles.retryBtnText}>🔄 إعادة البحث عن سائق</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goHomeBtn}
              onPress={() => router.replace("/(tabs)" as any)}
            >
              <Text style={styles.goHomeBtnText}>العودة للرئيسية</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  // شاشة الحالة الثانية: السائق ألغى بعد الوصول لموقع الراكب
  if (driverCancelledAtPhase === "arrived") {
    return (
      <View style={[styles.container, styles.noDriversContainer]}>
        <StatusBar style="light" />
        <Text style={styles.noDriversEmoji}>⚠️</Text>
        <Text style={styles.noDriversTitle}>ألغى السائق الرحلة</Text>
        <Text style={styles.noDriversText}>
          ألغى السائق الرحلة بعد وصوله لموقعك. نعتذر عن الإزعاج. هل تريد البحث عن سائق جديد؟
        </Text>
        <TouchableOpacity
          style={[styles.retryBtn, isRetrying && { opacity: 0.6 }]}
          onPress={() => {
            setDriverCancelledAtPhase(null);
            setCancelled(false);
            handleRetry();
          }}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator color="#1A1040" size="small" />
          ) : (
            <Text style={styles.retryBtnText}>🔄 البحث عن سائق جديد</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.goHomeBtn}
          onPress={() => router.replace("/(tabs)" as any)}
        >
          <Text style={styles.goHomeBtnText}>إلغاء والعودة للرئيسية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // شاشة "لا يوجد سائقون متاحون"
  if (noDrivers) {
    return (
      <View style={[styles.container, styles.noDriversContainer]}>
        <StatusBar style="light" />
        <Text style={styles.noDriversEmoji}>😔</Text>
        <Text style={styles.noDriversTitle}>لا يوجد سائقون متاحون</Text>
        <Text style={styles.noDriversText}>لم نتمكن من إيجاد سائق في منطقتك الآن. اضغط إعادة المحاولة لنبحث مجدداً.</Text>
        <TouchableOpacity
          style={[styles.retryBtn, isRetrying && { opacity: 0.6 }]}
          onPress={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator color="#1A1040" size="small" />
          ) : (
            <Text style={styles.retryBtnText}>🔄 إعادة البحث عن سائق</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.goHomeBtn}
          onPress={() => router.replace("/(tabs)" as any)}
        >
          <Text style={styles.goHomeBtnText}>العودة للرئيسية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* خريطة تتبع */}
      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: pickupCoord.latitude,
            longitude: pickupCoord.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* نقطة الانطلاق */}
          <Marker coordinate={pickupCoord} title="نقطة الانطلاق">
            <View style={styles.originMarker}>
              <Text style={{ fontSize: 20 }}>📍</Text>
            </View>
          </Marker>

          {/* الوجهة */}
          <Marker coordinate={dropoffCoord} title="وجهتك">
            <View style={styles.destMarker}>
              <Text style={{ fontSize: 22 }}>🏁</Text>
            </View>
          </Marker>

          {/* موقع السائق الحقيقي */}
          {driverLat && driverLng && (
            <Marker
              coordinate={{ latitude: driverLat, longitude: driverLng }}
              title={`السائق: ${driverName}`}
            >
              <Animated.View style={[styles.driverMarker, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={{ fontSize: 24 }}>🚗</Text>
              </Animated.View>
            </Marker>
          )}

          {/* مسار السائق → الراكب (أزرق) - يظهر فقط عند المرحلة 1 و 2 */}
          {routeDriverToPickup && routeDriverToPickup.coords.length >= 2 && currentStep >= 1 && currentStep <= 2 && (
            <Polyline
              coordinates={routeDriverToPickup.coords}
              strokeColor="#2196F3"
              strokeWidth={4}
              lineDashPattern={[8, 4]}
            />
          )}
          {/* مسار الراكب → الوجهة (ذهبي) - Mapbox حقيقي فقط */}
          {routePickupToDropoff && routePickupToDropoff.coords.length >= 2 && (
            <Polyline
              coordinates={routePickupToDropoff.coords}
              strokeColor="#FFD700"
              strokeWidth={5}
            />
          )}
        </MapView>
      ) : (
        <View style={[styles.map, styles.webMap]}>
          <Animated.Text style={[styles.webMapCar, { transform: [{ scale: pulseAnim }] }]}>
            {currentStep === 0 ? "🔍" : "🚗"}
          </Animated.Text>
          <Text style={styles.webMapLabel}>{step.label}</Text>
        </View>
      )}

      {/* مؤشر تحميل المسار */}
      {isLoadingRoute && (
        <View style={styles.routeLoadingBadge}>
          <ActivityIndicator size="small" color="#FFD700" style={{ marginRight: 6 }} />
          <Text style={styles.routeLoadingText}>جاري تحميل المسار...</Text>
        </View>
      )}

      {/* زر الرجوع */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      {/* شارة الحالة */}
      <View style={[styles.statusBadge, { top: insets.top + 12 }]}>
        <Text style={styles.statusIcon}>{step.icon}</Text>
        <Text style={styles.statusText} numberOfLines={1}>{step.label}</Text>
      </View>

      {/* لوحة السائق السفلية */}
      <View style={styles.driverSheet}>
        <View style={styles.handle} />

        {/* معلومات السائق */}
        <View style={styles.driverRow}>
          <View style={styles.avatarCircle}>
            {currentStep === 0 ? (
              <ActivityIndicator color="#FFD700" size="small" />
            ) : ride?.driver?.photoUrl ? (
              <Image
                source={{ uri: ride.driver.photoUrl }}
                style={{ width: 50, height: 50, borderRadius: 25 }}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarText}>👨</Text>
            )}
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverName}</Text>
            {currentStep > 0 && (
              <>
                <Text style={styles.driverCar}>{driverCar}</Text>
                <View style={styles.ratingRow}>
                  <Text style={styles.star}>⭐</Text>
                  <Text style={styles.rating}>{driverRating}</Text>
                  {driverPlate !== "—" && (
                    <Text style={styles.plate}> • {driverPlate}</Text>
                  )}
                </View>
              </>
            )}
            {currentStep === 0 && (
              <View style={{ marginTop: 4 }}>
                {/* رسالة تشجيعية ديناميكية */}
                <Text style={styles.searchingText}>
                  {searchElapsed < 15
                    ? "نبحث عن أقرب سائق لك..."
                    : searchElapsed < 45
                    ? "جاري التواصل مع السائقين القريبين..."
                    : searchElapsed < 90
                    ? "سيصلك سائق قريباً، انتظر قليلاً..."
                    : "نوسع نطاق البحث، شكراً لصبرك..."}
                </Text>
                {/* عداد الوقت */}
                <Text style={[styles.searchingText, { fontSize: 11, marginTop: 2, opacity: 0.7 }]}>
                  {"منذ "}{Math.floor(searchElapsed / 60) > 0 ? `${Math.floor(searchElapsed / 60)}د ${searchElapsed % 60}ث` : `${searchElapsed} ثانية`}
                </Text>
                {/* شريط تقدم البحث */}
                <View style={{ height: 3, backgroundColor: "#2D2060", borderRadius: 2, marginTop: 6, width: 140 }}>
                  <View style={{
                    height: 3,
                    backgroundColor: "#FFD700",
                    borderRadius: 2,
                    width: `${Math.min((searchElapsed / SEARCH_TIMEOUT) * 100, 100)}%`,
                  }} />
                </View>
              </View>
            )}
          </View>
          {currentStep > 0 && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {driverPhone && (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${driverPhone}`)}
                >
                  <Text style={styles.callIcon}>📞</Text>
                </TouchableOpacity>
              )}
              <View style={{ position: "relative" }}>
                <TouchableOpacity
                  style={[styles.callBtn, { backgroundColor: "#0a7ea4" }]}
                  onPress={() => router.push({
                    pathname: "/ride/chat" as any,
                    params: {
                      rideId: (activeRideId || rideId).toString(),
                      passengerId: passengerId.toString(),
                      driverName,
                      rideStatus: ride?.status ?? "accepted",
                    },
                  })}
                >
                  <Text style={styles.callIcon}>💬</Text>
                </TouchableOpacity>
                {unreadCount > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* شريط تقدم المراحل */}
        <View style={styles.stepsRow}>
          {RIDE_STEPS.slice(0, 4).map((s, i) => (
            <React.Fragment key={s.id}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  i < currentStep && styles.stepDotDone,
                  i === currentStep && styles.stepDotActive,
                ]} />
                <Text style={[styles.stepLabel, i === currentStep && styles.stepLabelActive]}>
                  {["بحث", "قبول", "وصل", "رحلة"][i]}
                </Text>
              </View>
              {i < 3 && (
                <View style={[styles.stepLine, i < currentStep && styles.stepLineDone]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* الأجرة */}
        <View style={styles.fareRow}>
          <View>
            <Text style={styles.fareLabel}>الأجرة المتوقعة</Text>
            <Text style={styles.fareValue}>{actualFare.toLocaleString("ar-IQ")} دينار</Text>
          </View>
          <Text style={styles.fareMethod}>💵 نقداً</Text>
        </View>

        {/* أزرار الإجراء */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.sosBtn} onPress={() => Linking.openURL("tel:122")}>
            <Text style={styles.sosBtnText}>🆘 طوارئ</Text>
          </TouchableOpacity>

          {currentStep < 3 ? (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
            >
              <Text style={styles.cancelBtnText}>
                {cancelMutation.isPending ? "جاري الإلغاء..." : "إلغاء الرحلة"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.cancelBtn, { backgroundColor: "#22C55E", borderColor: "#22C55E" }]}>
              <Text style={[styles.cancelBtnText, { color: "#fff" }]}>الرحلة جارية ✓</Text>
            </View>
          )}
        </View>

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
  webMapCar: { fontSize: 56 },
  webMapLabel: { color: "#FFD700", fontSize: 16, fontWeight: "bold", textAlign: "center", paddingHorizontal: 20 },
  routeLoadingBadge: {
    position: "absolute",
    bottom: 260,
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
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(26,5,51,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  backIcon: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  statusBadge: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,5,51,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
    gap: 6,
    maxWidth: "70%",
  },
  statusIcon: { fontSize: 16 },
  statusText: { color: "#FFD700", fontSize: 12, fontWeight: "600" },
  originMarker: { alignItems: "center" },
  destMarker: { alignItems: "center" },
  driverMarker: { alignItems: "center" },
  driverSheet: {
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
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  avatarText: { fontSize: 26 },
  driverInfo: { flex: 1 },
  driverName: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  driverCar: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
  searchingText: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  star: { fontSize: 12 },
  rating: { color: "#FFD700", fontSize: 13, fontWeight: "600", marginLeft: 2 },
  plate: { color: "#9B8EC4", fontSize: 12 },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  callIcon: { fontSize: 18 },
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
  chatBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    paddingHorizontal: 4,
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
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  fareLabel: { color: "#9B8EC4", fontSize: 12 },
  fareValue: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  fareMethod: { color: "#9B8EC4", fontSize: 14 },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  sosBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  sosBtnText: { color: "#EF4444", fontSize: 14, fontWeight: "600" },
  cancelBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#9B8EC4",
  },
  cancelBtnText: { color: "#9B8EC4", fontSize: 14, fontWeight: "600" },

  // No drivers screen
  noDriversContainer: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  noDriversEmoji: { fontSize: 80, marginBottom: 20 },
  noDriversTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginBottom: 12, textAlign: "center" },
  noDriversText: { color: "#9B8EC4", fontSize: 15, textAlign: "center", lineHeight: 24, marginBottom: 32 },
  retryBtn: {
    backgroundColor: "#FFD700", borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32,
    alignItems: "center", marginBottom: 12, width: "100%",
  },
  retryBtnText: { color: "#1A0533", fontSize: 16, fontWeight: "800" },
  goHomeBtn: {
    backgroundColor: "transparent", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32,
    alignItems: "center", borderWidth: 1, borderColor: "#3D2070", width: "100%",
  },
  goHomeBtnText: { color: "#9B8EC4", fontSize: 15, fontWeight: "600" },
});

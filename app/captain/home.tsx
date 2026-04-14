import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Animated,
  Dimensions,
  Image,
  Alert,
  Vibration,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Circle, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useMemo, useEffect as useEffectOsrm } from "react";
import { useDriver } from "@/lib/driver-context";
import { useLocation } from "@/hooks/use-location";
import { trpc } from "@/lib/trpc";
import { useT } from "@/lib/i18n";
import { fetchDualOsrmRoute, type OsrmRouteResult, type LatLng } from "@/lib/osrm";

const { width } = Dimensions.get("window");

// موقع الموصل المركزي (fallback فقط)
const MOSUL_CENTER = {
  latitude: 36.3392,
  longitude: 43.1289,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

type PendingRide = {
  id: number;
  passengerId: number;
  passengerName: string;
  passengerRating: number;
  passengerTotalRides: number;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  fare: number;
  estimatedDistance: number;
  estimatedDuration: number;
  createdAt: string;
};

export default function CaptainHomeScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { driver, logout } = useDriver();
  const walletBalanceQuery = trpc.driverWallet.getBalance.useQuery(
    { driverId: driver?.id ?? 0 },
    { enabled: !!driver?.id, refetchInterval: 60000 }
  );
  const walletBalance = walletBalanceQuery.data?.balance ?? driver?.walletBalance?.toString() ?? "0";
  const { coords, heading, isRealLocation } = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<PendingRide | null>(null);
  const [seenRideIds, setSeenRideIds] = useState<Set<number>>(new Set());
  // طلبات الطرود الفورية
  const [currentParcelRequest, setCurrentParcelRequest] = useState<any | null>(null);
  const [seenParcelIds, setSeenParcelIds] = useState<Set<number>>(new Set());
  const [timer, setTimer] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // OSRM dual route state
  const [routeToPassenger, setRouteToPassenger] = useState<OsrmRouteResult | null>(null);
  const [routePassengerTrip, setRoutePassengerTrip] = useState<OsrmRouteResult | null>(null);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number>(0);
  const [totalDurationMin, setTotalDurationMin] = useState<number>(0);
  const [isLoadingDualRoute, setIsLoadingDualRoute] = useState(false);
  // حساب دخل اليوم الحقيقي من السيرفر - يعمل دائماً بغض النظر عن حالة الاتصال
  const todayQuery = trpc.driver.getTrips.useQuery(
    { driverId: driver?.id ?? 0, limit: 200 },
    { enabled: !!driver?.id, refetchInterval: 30000 }
  );
  // دخل رحلات بين المدن لليوم الحالي
  const intercityEarningsQuery = trpc.intercity.todayEarnings.useQuery(
    { driverId: driver?.id ?? 0 },
    { enabled: !!driver?.id, refetchInterval: 30000 }
  );
  const todayEarnings = useMemo(() => {
    const now = new Date();
    // دخل رحلات المدينة
    const cityEarnings = (todayQuery.data?.trips ?? []).filter((t) => {
      if (t.status !== "completed") return false;
      const d = new Date(t.createdAt);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    }).reduce((sum, t) => sum + parseFloat(t.fare), 0);
    // دخل رحلات بين المدن
    const intercityEarnings = intercityEarningsQuery.data?.todayEarnings ?? 0;
    return cityEarnings + intercityEarnings;
  }, [todayQuery.data, intercityEarningsQuery.data]);
  const todayTrips = useMemo(() => {
    const now = new Date();
    const cityTrips = (todayQuery.data?.trips ?? []).filter((t) => {
      if (t.status !== "completed") return false;
      const d = new Date(t.createdAt);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    }).length;
    const intercityTrips = intercityEarningsQuery.data?.todayTrips ?? 0;
    return cityTrips + intercityTrips;
  }, [todayQuery.data, intercityEarningsQuery.data]);
  const rating = parseFloat(driver?.rating ?? "4.9");
  const mapRef = useRef<MapView>(null);

  // مشغل صوت التنبيه عند وصول طلب جديد
  const notificationPlayer = useAudioPlayer(
    require("@/assets/sounds/new-ride.mp3")
  );

  // جلب مسارات OSRM المزدوجة عند وصول طلب جديد
  useEffectOsrm(() => {
    if (!currentRequest) {
      setRouteToPassenger(null);
      setRoutePassengerTrip(null);
      setTotalDistanceKm(0);
      setTotalDurationMin(0);
      setIsLoadingDualRoute(false);
      return;
    }
    const driverLoc: LatLng = { latitude: coords.latitude, longitude: coords.longitude };
    const pickup: LatLng = { latitude: currentRequest.pickupLat, longitude: currentRequest.pickupLng };
    const dropoff: LatLng = { latitude: currentRequest.dropoffLat, longitude: currentRequest.dropoffLng };
    setIsLoadingDualRoute(true);
    fetchDualOsrmRoute(driverLoc, pickup, dropoff).then((res) => {
      setRouteToPassenger(res.toPassenger);
      setRoutePassengerTrip(res.passengerTrip);
      setTotalDistanceKm(res.totalDistanceKm);
      setTotalDurationMin(res.totalDurationMin);
    }).finally(() => setIsLoadingDualRoute(false));
  }, [currentRequest?.id]);

  // عند العودة لهذه الشاشة (بعد إلغاء أو اكتمال رحلة) - تغيير حالة السائق إلى متاح تلقائياً
  useFocusEffect(
    useRef(() => {
      if (driver?.id) {
        // تغيير حالة السائق إلى متاح فور العودة للشاشة
        setIsOnline(true);
        setStatusMutation.mutate({
          driverId: driver.id,
          isOnline: true,
          isAvailable: true,
        });
      }
    }).current
  );

  // تتبع موقع الكابتن على الخريطة بشكل مستمر وسلس
  // عند أول موقع حقيقي: تمركز الخريطة على الكابتن
  // عند كل تحديث: تحريك الكاميرا بسلاسة لمتابعة الكابتن
  const isFirstRealLocation = useRef(true);
  const [isFollowingDriver, setIsFollowingDriver] = useState(true); // يتتبع الكابتن ما لم يتحرك المستخدم الخريطة يدوياً

  useEffect(() => {
    if (!isRealLocation || !mapRef.current) return;
    if (!isFollowingDriver) return;

    if (isFirstRealLocation.current) {
      // أول موقع حقيقي: تمركز فوري مع zoom مناسب
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }, 800);
      isFirstRealLocation.current = false;
    } else {
      // تحديثات لاحقة: تحريك الكاميرا بسلاسة للموقع الجديد مع الحفاظ على zoom الحالي
      mapRef.current.animateCamera(
        {
          center: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
        },
        { duration: 1000 }
      );
    }
  }, [isRealLocation, coords.latitude, coords.longitude, isFollowingDriver]);

  // تحديث موقع السائق على السيرفر فورياً عند كل تغيير موقع حقيقي
  // مع throttle لمنع الإرسال الزائد للسيرفر (5 ثواني كحد أدنى)
  const updateLocationMutation = trpc.driver.updateLocation.useMutation();
  const lastLocationUpdateRef = useRef<number>(0);
  useEffect(() => {
    if (!isOnline || !driver?.id || !isRealLocation) return;
    const now = Date.now();
    // throttle: لا ترسل أكثر من مرة كل 5 ثواني
    if (now - lastLocationUpdateRef.current < 5000) return;
    lastLocationUpdateRef.current = now;
    updateLocationMutation.mutate({
      driverId: driver.id,
      lat: coords.latitude,
      lng: coords.longitude,
    });
  }, [isOnline, driver?.id, coords.latitude, coords.longitude, isRealLocation]);

  // تحديث حالة السائق على السيرفر
  const setStatusMutation = trpc.driver.setStatus.useMutation();
  const handleToggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    if (driver?.id) {
      setStatusMutation.mutate({
        driverId: driver.id,
        isOnline: newStatus,
        isAvailable: newStatus,
      });
    }
    if (!newStatus) {
      setCurrentRequest(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Polling للكشف عن تعطيل/تفعيل الحساب كل 5 ثوانٍ
  const blockCheckQuery = trpc.driver.checkStatus.useQuery(
    { phone: driver?.phone ?? "" },
    {
      enabled: !!driver?.phone,
      refetchInterval: 5000,
      staleTime: 0,
    }
  );
  useEffect(() => {
    if (!blockCheckQuery.data) return;
    const data = blockCheckQuery.data as any;
    if (data.isBlocked) {
      const reason = data.blockReason || "تم تعطيل حسابك من قِبل الإدارة";
      Alert.alert(
        "تم تعطيل حسابك 🚫",
        `سيتم تسجيل خروجك من وضع الكابتن.\n\nالسبب: ${reason}\n\nللاستفسار تواصل مع الدعم.`,
        [
          {
            text: "حسناً",
            onPress: async () => {
              await logout();
              // مسح الـ navigation stack بالكامل
              router.dismissAll();
              router.replace("/(tabs)/profile" as any);
            },
          },
        ],
        { cancelable: false }
      );
    }
  }, [blockCheckQuery.data]);

  // Polling لطلبات الطرود الفورية
  const pendingParcelsQuery = trpc.parcel.getPendingInstant.useQuery(undefined, {
    enabled: isOnline,
    refetchInterval: 5000,
    staleTime: 0,
  });
  useEffect(() => {
    if (!isOnline || !pendingParcelsQuery.data) return;
    const parcels = pendingParcelsQuery.data;
    if (parcels.length === 0) return;
    if (currentRequest || currentParcelRequest) return;
    const newParcel = parcels.find((p: any) => {
      if (seenParcelIds.has(p.id)) return false;
      const age = Date.now() - new Date(p.createdAt).getTime();
      return age < 3 * 60 * 1000;
    });
    if (!newParcel) return;
    setSeenParcelIds((prev) => new Set([...prev, newParcel.id]));
    setCurrentParcelRequest(newParcel);
    setTimer(30);
    if (Platform.OS !== "web") {
      try {
        setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
        notificationPlayer.seekTo(0);
        notificationPlayer.volume = 1.0;
        notificationPlayer.play();
      } catch (e) {}
      Vibration.vibrate([0, 400, 200, 400, 200, 400, 200, 600]);
    }
  }, [pendingParcelsQuery.data, isOnline, currentRequest, currentParcelRequest]);
  useEffect(() => {
    if (!currentParcelRequest || !pendingParcelsQuery.data) return;
    const stillPending = pendingParcelsQuery.data.some((p: any) => p.id === currentParcelRequest.id);
    if (!stillPending) {
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentParcelRequest(null);
      setTimer(30);
    }
  }, [pendingParcelsQuery.data, currentParcelRequest]);

  // Polling للطلبات الجديدة كل 5 ثوانّ عندما يكون متاحاً
  const pendingRidesQuery = trpc.rides.pendingRides.useQuery(undefined, {
    enabled: isOnline,
    refetchInterval: 5000,
    staleTime: 0,
  });

  // معالجة الطلبات الجديدة
  useEffect(() => {
    if (!isOnline || !pendingRidesQuery.data) return;
    const rides = pendingRidesQuery.data;
    if (rides.length === 0) return;

    // إذا في طلب حالي، لا تُظهر طلباً جديداً
    if (currentRequest) return;

    // ابحث عن أول طلب لم يُرَ بعد وأحدث من 3 دقائق (فلتر ثانٍ في التطبيق)
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
    const newRide = rides.find((r) => {
      if (seenRideIds.has(r.id)) return false;
      const rideAge = Date.now() - new Date(r.createdAt).getTime();
      return rideAge < 3 * 60 * 1000; // أحدث من 3 دقائق فقط
    });
    if (!newRide) return;

    // أضف الطلب للقائمة المرئية وأظهره
    setSeenRideIds((prev) => new Set([...prev, newRide.id]));
    setCurrentRequest(newRide);
    setTimer(30);

    // صوت تنبيه + اهتزاز عند وصول طلب جديد
    if (Platform.OS !== "web") {
      try {
        // تفعيل التشغيل في الوضع الصامت (iOS)
        setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        }).catch(() => {});
        notificationPlayer.seekTo(0);
        notificationPlayer.volume = 1.0;
        notificationPlayer.play();
      } catch (e) {
        // إذا فشل الصوت نستمر بالاهتزاز
      }
      // اهتزاز طويل ومتكرر للفت الانتباه
      Vibration.vibrate([0, 400, 200, 400, 200, 400, 200, 600]);
    }
  }, [pendingRidesQuery.data, isOnline, currentRequest]);

  // مراقبة حالة الطلب الحالي: إغلاق النافذة فوراً عند إلغاء الراكب للطلب
  useEffect(() => {
    if (!currentRequest || !pendingRidesQuery.data) return;
    // إذا اختفى الطلب الحالي من قائمة الطلبات المعلقة = تم إلغاؤه من الراكب
    const stillPending = pendingRidesQuery.data.some((r) => r.id === currentRequest.id);
    if (!stillPending) {
      // أغلق النافذة فوراً وامنع أي قبول أو رفض
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentRequest(null);
      setTimer(30);
    }
  }, [pendingRidesQuery.data, currentRequest]);

  // مؤقت الطلب (30 ثانية)
  useEffect(() => {
    if (!currentRequest) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setCurrentRequest(null);
          return 30;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentRequest]);

  // قبول طلب الطرد
  const acceptParcelMutation = trpc.parcel.accept.useMutation({
    onSuccess: () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const parcelId = currentParcelRequest!.id;
      setCurrentParcelRequest(null);
      setTimer(30);
      router.replace({ pathname: "/captain/active-parcel", params: { parcelId: parcelId.toString() } } as any);
    },
    onError: () => Alert.alert("خطأ", "لم نتمكن من قبول طلب الطرد."),
  });

  // قبول الطلب
  const acceptRideMutation = trpc.rides.accept.useMutation({
    onSuccess: (data: any) => {
      if (timerRef.current) clearInterval(timerRef.current);
      // إذا كانت الرحلة ملغاة أو مقبولة مسبقاً - أغلق النافذة فقط
      if (data?.success === false) {
        setCurrentRequest(null);
        setTimer(30);
        if (data?.reason === 'insufficient_balance') {
          const bal = data?.balance ? Math.floor(Number(data.balance)).toLocaleString() : '0';
          const min = data?.minimum ? Math.floor(Number(data.minimum)).toLocaleString() : '0';
          Alert.alert(
            '⚠️ رصيد غير كافي',
            `رصيدك الحالي: ${bal} د.ع\nالحد الأدنى المطلوب: ${min} د.ع\n\nيرجى شحن محفظتك لتتمكن من قبول الرحلات.`,
            [{ text: 'شحن الآن', onPress: () => router.push('/captain/wallet' as any) }, { text: 'لاحقاً', style: 'cancel' }]
          );
        }
        return;
      }
      const rideId = currentRequest!.id;
      setCurrentRequest(null);
      // استخدام replace بدل push لمنع الكابتن من الرجوع لشاشة Home أثناء الرحلة
      router.replace({
        pathname: "/captain/active-trip",
        params: { rideId: rideId.toString() },
      } as any);
    },
    onError: () => {
      Alert.alert("خطأ", "لم نتمكن من قبول الطلب. حاول مجدداً.");
    },
  });

  // رفض الطلب
  const rejectRideMutation = trpc.rides.reject.useMutation({
    onSuccess: () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentRequest(null);
    },
  });

  const handleAccept = () => {
    if (!currentRequest || !driver?.id) return;
    // تحقق من أن الطلب لا يزال معلقاً قبل القبول
    const stillPending = pendingRidesQuery.data?.some((r) => r.id === currentRequest.id);
    if (!stillPending) {
      // الطلب ألغي - أغلق النافذة فوراً
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentRequest(null);
      setTimer(30);
      return;
    }
    acceptRideMutation.mutate({
      rideId: currentRequest.id,
      driverId: driver.id,
    });
  };

  const handleReject = () => {
    if (!currentRequest || !driver?.id) return;
    rejectRideMutation.mutate({
      rideId: currentRequest.id,
      driverId: driver.id,
    });
  };

  // نبضة عند الاتصال
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isOnline) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isOnline]);

  const timerPercent = timer / 30;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* خريطة الموصل الحقيقية */}
      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={MOSUL_CENTER}
          showsUserLocation={false}
          showsMyLocationButton={false}
          onPanDrag={() => {
            // عند تحريك الخريطة يدوياً: إيقاف التتبع التلقائي
            setIsFollowingDriver(false);
          }}
        >
          {/* موقع الكابتن الحالي - مع تدوير حسب اتجاه السير */}
          <Marker
            coordinate={coords}
            title="موقعي"
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={heading ?? 0}
          >
            <Animated.View style={[styles.myMarker, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={{ fontSize: 26 }}>🚗</Text>
            </Animated.View>
          </Marker>

          {/* مسار السائق → الراكب (أزرق متقطع) - Mapbox حقيقي */}
          {routeToPassenger && routeToPassenger.coords.length >= 2 && (
            <Polyline
              coordinates={routeToPassenger.coords}
              strokeColor="#2196F3"
              strokeWidth={5}
              lineDashPattern={[10, 4]}
            />
          )}

          {/* مسار الراكب → الوجهة (ذهبي متصل) - Mapbox حقيقي */}
          {routePassengerTrip && routePassengerTrip.coords.length >= 2 && (
            <Polyline
              coordinates={routePassengerTrip.coords}
              strokeColor="#FFD700"
              strokeWidth={5}
            />
          )}

          {/* موقع الراكب إذا في طلب */}
          {currentRequest && (
            <Marker
              coordinate={{ latitude: currentRequest.pickupLat, longitude: currentRequest.pickupLng }}
              title="موقع الراكب"
            >
              <View style={styles.passengerMarker}>
                <Text style={{ fontSize: 24 }}>📍</Text>
              </View>
            </Marker>
          )}

          {/* وجهة الراكب */}
          {currentRequest && (
            <Marker
              coordinate={{ latitude: currentRequest.dropoffLat, longitude: currentRequest.dropoffLng }}
              title="الوجهة"
            >
              <View style={styles.passengerMarker}>
                <Text style={{ fontSize: 22 }}>🏁</Text>
              </View>
            </Marker>
          )}

          {/* دائرة نطاق الاستقبال */}
          {isOnline && (
            <Circle
              center={coords}
              radius={1500}
              fillColor="rgba(255,215,0,0.08)"
              strokeColor="rgba(255,215,0,0.3)"
              strokeWidth={1.5}
            />
          )}
        </MapView>
      ) : (
        <View style={[styles.map, styles.webMap]}>
          <Animated.Text style={[{ fontSize: 56 }, isOnline && { transform: [{ scale: pulseAnim }] }]}>
            {isOnline ? "⭐" : "🚗"}
          </Animated.Text>
          <Text style={styles.webMapLabel}>
            {isOnline ? t.captain.online + " — " + t.common.appName : t.captain.offline}
          </Text>
          <Text style={styles.webMapCoords}>36.3392° N, 43.1289° E</Text>
        </View>
      )}

      {/* زر إعادة التمركز على موقع الكابتن */}
      {Platform.OS !== "web" && !isFollowingDriver && (
        <TouchableOpacity
          style={[styles.recenterBtn, { bottom: insets.bottom + 120 }]}
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
          <Text style={styles.recenterIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(tabs)/profile' as any)}
        >
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerLeft} onPress={() => router.push("/captain/profile" as any)}>
          {driver?.photoUrl ? (
            <Image source={{ uri: driver.photoUrl }} style={styles.logoSmallImg} />
          ) : (
            <View style={styles.logoSmall}>
              <Text style={styles.logoText}>{driver?.name?.charAt(0) ?? "ك"}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{driver?.name ?? t.captain.captain + " " + t.common.appName}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.star}>⭐</Text>
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.walletBtn}
            onPress={() => router.push("/captain/wallet" as any)}
          >
            <Text style={styles.walletIcon}>💰</Text>
            <Text style={styles.walletAmount}>{Number(walletBalance).toLocaleString("ar-IQ")}</Text>
            <Text style={styles.walletCurrency}>د.ع</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.supportBtn}
            onPress={() => router.push("/support" as any)}
          >
            <Text style={styles.supportBtnIcon}>💬</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* زر الحالة */}
      <View style={styles.onlineContainer}>
        <TouchableOpacity
          style={[styles.onlineBtn, isOnline && styles.onlineBtnActive]}
          onPress={handleToggleOnline}
        >
          <Animated.View style={isOnline ? { transform: [{ scale: pulseAnim }] } : {}}>
            <Text style={styles.onlineBtnIcon}>{isOnline ? "🟢" : "⚫"}</Text>
          </Animated.View>
          <Text style={[styles.onlineBtnText, isOnline && styles.onlineBtnTextActive]}>
            {isOnline ? t.captain.online : t.captain.offline}
          </Text>
        </TouchableOpacity>
      </View>

      {/* إحصائيات اليوم */}
      <View style={[styles.statsBar, { bottom: insets.bottom + 16 }]}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{todayTrips}</Text>
          <Text style={styles.statLabel}>{t.captain.totalRides}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{todayEarnings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>{t.captain.todayEarnings}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{rating}</Text>
          <Text style={styles.statLabel}>{t.captain.rating}</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => router.push("/captain/earnings" as any)}
        >
          <Text style={styles.statValue}>📊</Text>
          <Text style={styles.statLabel}>{t.captain.tripHistory}</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => router.push("/captain/intercity-trips" as any)}
        >
          <Text style={styles.statValue}>🛣️</Text>
          <Text style={styles.statLabel}>{t.captain.intercityTrips}</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => router.push("/captain/my-parcels" as any)}
        >
          <Text style={styles.statValue}>📦</Text>
          <Text style={styles.statLabel}>طرودي</Text>
        </TouchableOpacity>
      </View>

      {/* Modal طلب طرد فوري */}
      <Modal
        visible={!!currentParcelRequest && !currentRequest}
        transparent
        animationType="slide"
        onRequestClose={() => { if (timerRef.current) clearInterval(timerRef.current); setCurrentParcelRequest(null); setTimer(30); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestCard}>
            <View style={styles.timerRow}>
              <View style={styles.timerCircle}>
                <Text style={styles.timerText}>{timer}</Text>
              </View>
              <View style={styles.timerBarBg}>
                <View style={[styles.timerBarFill, { width: `${(timer / 30) * 100}%` }]} />
              </View>
            </View>
            <Text style={styles.requestTitle}>📦 طلب توصيل طرد جديد</Text>
            <View style={styles.passengerRow}>
              <View style={styles.passengerAvatar}>
                <Text style={{ fontSize: 24 }}>📦</Text>
              </View>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>{currentParcelRequest?.senderName || "المرسل"}</Text>
                <Text style={[styles.passengerRatingText, { marginTop: 2 }]}>
                  {currentParcelRequest?.parcelSize === "small" ? "📦 صغير" : currentParcelRequest?.parcelSize === "medium" ? "📦 وسط" : "📦 كبير"}
                </Text>
              </View>
              <View style={styles.priceTag}>
                <Text style={styles.priceValue}>
                  {currentParcelRequest?.parcelSize === "small" ? "3,000" : currentParcelRequest?.parcelSize === "medium" ? "5,000" : "8,000"}
                </Text>
                <Text style={styles.priceCurrency}>د.ع</Text>
              </View>
            </View>
            <View style={styles.routeBox}>
              <View style={styles.routeRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.routeText} numberOfLines={1}>{currentParcelRequest?.pickupAddress || "موقع الاستلام"}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={styles.dotRed} />
                <Text style={styles.routeText} numberOfLines={1}>{currentParcelRequest?.dropoffAddress || "موقع التسليم"}</Text>
              </View>
            </View>
            {currentParcelRequest?.parcelDescription ? (
              <View style={{ paddingHorizontal: 4, marginBottom: 8 }}>
                <Text style={{ color: "#9B8EC4", fontSize: 13 }}>📝 {currentParcelRequest.parcelDescription}</Text>
              </View>
            ) : null}
            <View style={styles.requestBtns}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => { if (timerRef.current) clearInterval(timerRef.current); setCurrentParcelRequest(null); setTimer(30); }}
              >
                <Text style={styles.rejectText}>رفض</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => {
                  if (!currentParcelRequest || !driver?.id) return;
                  const stillPending = pendingParcelsQuery.data?.some((p: any) => p.id === currentParcelRequest.id);
                  if (!stillPending) { setCurrentParcelRequest(null); setTimer(30); return; }
                  const fare = currentParcelRequest.parcelSize === "small" ? 3000 : currentParcelRequest.parcelSize === "medium" ? 5000 : 8000;
                  trpc.parcel.accept.useMutation;
                  // نستخدم mutation مباشرة
                  acceptParcelMutation.mutate({ parcelId: currentParcelRequest.id, driverId: driver.id, price: fare });
                }}
                disabled={acceptParcelMutation.isPending}
              >
                <Text style={styles.acceptText}>
                  {acceptParcelMutation.isPending ? "جاري..." : "✅ قبول"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal طلب رحلة حقيقي */}
      <Modal
        visible={!!currentRequest}
        transparent
        animationType="slide"
        onRequestClose={handleReject}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestCard}>
            {/* مؤقت */}
            <View style={styles.timerRow}>
              <View style={styles.timerCircle}>
                <Text style={styles.timerText}>{timer}</Text>
              </View>
              <View style={styles.timerBarBg}>
                <View style={[styles.timerBarFill, { width: `${timerPercent * 100}%` }]} />
              </View>
            </View>

            <Text style={styles.requestTitle}>🚗 {t.captain.newRideRequest}</Text>

            {/* معلومات الراكب */}
            <View style={styles.passengerRow}>
              <View style={styles.passengerAvatar}>
                <Text style={{ fontSize: 24 }}>👤</Text>
              </View>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>{currentRequest?.passengerName || t.captain.passenger}</Text>
                <View style={styles.passengerRating}>
                  <Text style={styles.passengerRatingText}>⭐ {currentRequest?.passengerRating?.toFixed(1) || "5.0"}</Text>
                  {(currentRequest?.passengerTotalRides ?? 0) > 0 && (
                    <Text style={[styles.passengerRatingText, { color: "#9B8EC4", marginLeft: 6 }]}>
                      • {currentRequest?.passengerTotalRides} {t.captain.totalRides}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.priceTag}>
                <Text style={styles.priceValue}>{currentRequest?.fare?.toLocaleString()}</Text>
                <Text style={styles.priceCurrency}>{t.common.iqd}</Text>
              </View>
            </View>

            {/* المسار */}
            <View style={styles.routeBox}>
              <View style={styles.routeRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {currentRequest?.pickupAddress || t.ride.pickupLocation}
                </Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={styles.dotRed} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {currentRequest?.dropoffAddress || t.ride.destination}
                </Text>
              </View>
            </View>

            {/* تفاصيل OSRM المزدوجة */}
            <View style={styles.osrmDetailsBox}>
              {isLoadingDualRoute ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 6, gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFD700" />
                  <Text style={{ color: "#FFD700", fontSize: 12 }}>جاري تحميل المسارات...</Text>
                </View>
              ) : (
                <>
                  {/* للوصول إلى الراكب */}
                  <View style={styles.osrmRow}>
                    <View style={[styles.osrmDot, { backgroundColor: "#2196F3" }]} />
                    <Text style={styles.osrmLabel}>{t.captain.toPassenger}</Text>
                    <Text style={styles.osrmValue}>
                      {routeToPassenger
                        ? `${routeToPassenger.distanceKm} كم • ${routeToPassenger.durationMin} دقيقة`
                        : `${currentRequest?.estimatedDistance?.toFixed(1) ?? "--"} كم`}
                    </Text>
                  </View>
                  {/* رحلة الراكب */}
                  <View style={styles.osrmRow}>
                    <View style={[styles.osrmDot, { backgroundColor: "#FFD700" }]} />
                    <Text style={styles.osrmLabel}>{t.captain.passengerTrip}</Text>
                    <Text style={styles.osrmValue}>
                      {routePassengerTrip
                        ? `${routePassengerTrip.distanceKm} كم • ${routePassengerTrip.durationMin} دقيقة`
                        : `${currentRequest?.estimatedDistance?.toFixed(1) ?? "--"} كم`}
                    </Text>
                  </View>
                  {/* الإجمالي */}
                  <View style={[styles.osrmRow, styles.osrmTotalRow]}>
                    <View style={[styles.osrmDot, { backgroundColor: "#4CAF50" }]} />
                    <Text style={[styles.osrmLabel, { color: "#4CAF50", fontWeight: "bold" }]}>إجمالي</Text>
                    <Text style={[styles.osrmValue, { color: "#4CAF50", fontWeight: "bold" }]}>
                      {totalDistanceKm > 0
                        ? `${totalDistanceKm.toFixed(1)} كم • ${totalDurationMin} دقيقة`
                        : `${((currentRequest?.estimatedDistance ?? 0) * 1.3).toFixed(1)} كم`}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* التفاصيل القديمة مخفية */}
            <View style={[styles.detailsRow, { display: "none" }]}>
              <Text style={styles.detailItem}>
                📏 {currentRequest?.estimatedDistance?.toFixed(1)} كم
              </Text>
              <Text style={styles.detailItem}>
                ⏱ {currentRequest?.estimatedDuration} دقيقة
              </Text>
            </View>

            {/* أزرار */}
            <View style={styles.requestBtns}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={handleReject}
                disabled={rejectRideMutation.isPending}
              >
                <Text style={styles.rejectText}>{t.captain.reject}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={handleAccept}
                disabled={acceptRideMutation.isPending}
              >
                <Text style={styles.acceptText}>
                  {acceptRideMutation.isPending ? t.common.loading : `✅ ${t.captain.accept}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  webMapCoords: { color: "#9B8EC4", fontSize: 13 },
  header: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(26,5,51,0.9)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(108,63,197,0.3)", alignItems: "center", justifyContent: "center", marginLeft: 4 },
  backBtnText: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold" },
  logoSmallImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  logoSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#1A0533", fontSize: 18, fontWeight: "bold" },
  headerName: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  star: { fontSize: 11 },
  ratingText: { color: "#FFD700", fontSize: 12, fontWeight: "600" },
  earningsBtn: {
    backgroundColor: "#2D1B4E",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  earningsLabel: { color: "#9B8EC4", fontSize: 10 },
  earningsValue: { color: "#FFD700", fontSize: 13, fontWeight: "bold" },
  onlineContainer: {
    position: "absolute",
    bottom: 120,
    alignSelf: "center",
  },
  onlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(26,5,51,0.9)",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#3D2070",
  },
  onlineBtnActive: { borderColor: "#22C55E", backgroundColor: "rgba(34,197,94,0.15)" },
  onlineBtnIcon: { fontSize: 18 },
  onlineBtnText: { color: "#9B8EC4", fontSize: 16, fontWeight: "bold" },
  onlineBtnTextActive: { color: "#22C55E" },
  myMarker: { alignItems: "center" },
  passengerMarker: { alignItems: "center" },
  statsBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    backgroundColor: "rgba(26,5,51,0.95)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3D2070",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center" },
  statValue: { color: "#FFD700", fontSize: 16, fontWeight: "bold" },
  statLabel: { color: "#9B8EC4", fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#3D2070" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  requestCard: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 2,
    borderColor: "#FFD700",
  },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  timerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: { color: "#1A0533", fontSize: 18, fontWeight: "bold" },
  timerBarBg: { flex: 1, height: 6, backgroundColor: "#3D2070", borderRadius: 3, overflow: "hidden" },
  timerBarFill: { height: "100%", backgroundColor: "#FFD700", borderRadius: 3 },
  requestTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  passengerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  passengerAvatar: {
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
  passengerRating: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  passengerRatingText: { color: "#FFD700", fontSize: 13 },
  priceTag: {
    backgroundColor: "#2D1B4E",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  priceValue: { color: "#FFD700", fontSize: 16, fontWeight: "bold" },
  priceCurrency: { color: "#9B8EC4", fontSize: 11 },
  routeBox: {
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  routeLine: { width: 2, height: 20, backgroundColor: "#3D2070", marginLeft: 4, marginVertical: 4 },
  routeText: { color: "#FFFFFF", fontSize: 14 },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  detailItem: { color: "#9B8EC4", fontSize: 14 },
  requestBtns: { flexDirection: "row", gap: 12 },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#2D1B4E",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  rejectText: { color: "#EF4444", fontSize: 15, fontWeight: "bold" },
  acceptBtn: {
    flex: 2,
    backgroundColor: "#FFD700",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  acceptText: { color: "#1A0533", fontSize: 15, fontWeight: "bold" },
  osrmDetailsBox: {
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#3D2070",
    gap: 8,
  },
  osrmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  osrmTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#3D2070",
    paddingTop: 8,
    marginTop: 4,
  },
  osrmDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  osrmLabel: {
    color: "#9B8EC4",
    fontSize: 13,
    flex: 1,
  },
  osrmValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walletBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,215,0,0.15)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#FFD700",
    gap: 4,
  },
  walletIcon: { fontSize: 14 },
  walletAmount: { fontSize: 13, fontWeight: "800", color: "#FFD700" },
  walletCurrency: { fontSize: 10, color: "#FFD700", fontWeight: "600" },
  supportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  supportBtnIcon: {
    fontSize: 20,
  },
  recenterBtn: {
    position: "absolute",
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(28, 10, 60, 0.92)",
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
  recenterIcon: {
    fontSize: 22,
  },
});

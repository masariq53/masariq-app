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
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from "react-native-maps";
import { useMemo } from "react";
import { useDriver } from "@/lib/driver-context";
import { useLocation } from "@/hooks/use-location";
import { trpc } from "@/lib/trpc";

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
  const insets = useSafeAreaInsets();
  const { driver, logout } = useDriver();
  const { coords, isRealLocation } = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<PendingRide | null>(null);
  const [seenRideIds, setSeenRideIds] = useState<Set<number>>(new Set());
  const [timer, setTimer] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // حساب دخل اليوم الحقيقي من السيرفر - يعمل دائماً بغض النظر عن حالة الاتصال
  const todayQuery = trpc.driver.getTrips.useQuery(
    { driverId: driver?.id ?? 0, limit: 200 },
    { enabled: !!driver?.id, refetchInterval: 30000 }
  );
  const todayEarnings = useMemo(() => {
    if (!todayQuery.data?.trips) return 0;
    const now = new Date();
    return todayQuery.data.trips
      .filter((t) => {
        if (t.status !== "completed") return false;
        const d = new Date(t.createdAt);
        return d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate();
      })
      .reduce((sum, t) => sum + parseFloat(t.fare), 0);
  }, [todayQuery.data]);
  const todayTrips = useMemo(() => {
    if (!todayQuery.data?.trips) return 0;
    const now = new Date();
    return todayQuery.data.trips.filter((t) => {
      if (t.status !== "completed") return false;
      const d = new Date(t.createdAt);
      return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    }).length;
  }, [todayQuery.data]);
  const rating = parseFloat(driver?.rating ?? "4.9");
  const mapRef = useRef<MapView>(null);

  // مشغل صوت التنبيه عند وصول طلب جديد
  const notificationPlayer = useAudioPlayer(
    require("@/assets/sounds/new-ride.mp3")
  );

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

  // تمركز الخريطة على موقع GPS الحقيقي عند تحميل الشاشة
  useEffect(() => {
    if (isRealLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 800);
    }
  }, [isRealLocation, coords.latitude, coords.longitude]);

  // تحديث موقع السائق على السيرفر كل 15 ثانية عندما يكون متاحاً
  const updateLocationMutation = trpc.driver.updateLocation.useMutation();
  useEffect(() => {
    if (!isOnline || !driver?.id) return;
    const interval = setInterval(() => {
      if (isRealLocation) {
        updateLocationMutation.mutate({
          driverId: driver.id,
          lat: coords.latitude,
          lng: coords.longitude,
        });
      }
    }, 15000);
    return () => clearInterval(interval);
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
              router.replace("/(tabs)/profile" as any);
            },
          },
        ],
        { cancelable: false }
      );
    }
  }, [blockCheckQuery.data]);

  // Polling للطلبات الجديدة كل 5 ثوانٍ عندما يكون متاحاً
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

  // قبول الطلب
  const acceptRideMutation = trpc.rides.accept.useMutation({
    onSuccess: () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const rideId = currentRequest!.id;
      setCurrentRequest(null);
      router.push({
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
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* موقع الكابتن الحالي */}
          <Marker
            coordinate={coords}
            title="موقعي"
          >
            <Animated.View style={[styles.myMarker, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={{ fontSize: 24 }}>⭐</Text>
            </Animated.View>
          </Marker>

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
            {isOnline ? "أنت متاح — الموصل" : "غير متاح"}
          </Text>
          <Text style={styles.webMapCoords}>36.3392° N, 43.1289° E</Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.headerLeft} onPress={() => router.push("/captain/profile" as any)}>
          {driver?.photoUrl ? (
            <Image source={{ uri: driver.photoUrl }} style={styles.logoSmallImg} />
          ) : (
            <View style={styles.logoSmall}>
              <Text style={styles.logoText}>{driver?.name?.charAt(0) ?? "ك"}</Text>
            </View>
          )}
          <View>
            <Text style={styles.headerName}>{driver?.name ?? "كابتن مسار"}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.star}>⭐</Text>
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={{ width: 8 }} />
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
            {isOnline ? "متاح" : "غير متاح"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* إحصائيات اليوم */}
      <View style={[styles.statsBar, { bottom: insets.bottom + 16 }]}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{todayTrips}</Text>
          <Text style={styles.statLabel}>رحلة</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{todayEarnings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>دخل اليوم</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{rating}</Text>
          <Text style={styles.statLabel}>تقييم</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => router.push("/captain/earnings" as any)}
        >
          <Text style={styles.statValue}>📊</Text>
          <Text style={styles.statLabel}>الرحلات</Text>
        </TouchableOpacity>
      </View>

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

            <Text style={styles.requestTitle}>🚗 طلب رحلة جديد!</Text>

            {/* معلومات الراكب */}
            <View style={styles.passengerRow}>
              <View style={styles.passengerAvatar}>
                <Text style={{ fontSize: 24 }}>👤</Text>
              </View>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>{currentRequest?.passengerName || "راكب"}</Text>
                <View style={styles.passengerRating}>
                  <Text style={styles.passengerRatingText}>⭐ {currentRequest?.passengerRating?.toFixed(1) || "5.0"}</Text>
                  {(currentRequest?.passengerTotalRides ?? 0) > 0 && (
                    <Text style={[styles.passengerRatingText, { color: "#9B8EC4", marginLeft: 6 }]}>
                      • {currentRequest?.passengerTotalRides} رحلة
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.priceTag}>
                <Text style={styles.priceValue}>{currentRequest?.fare?.toLocaleString()}</Text>
                <Text style={styles.priceCurrency}>دينار</Text>
              </View>
            </View>

            {/* المسار */}
            <View style={styles.routeBox}>
              <View style={styles.routeRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {currentRequest?.pickupAddress || "موقع الراكب"}
                </Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={styles.dotRed} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {currentRequest?.dropoffAddress || "الوجهة"}
                </Text>
              </View>
            </View>

            {/* التفاصيل */}
            <View style={styles.detailsRow}>
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
                <Text style={styles.rejectText}>رفض</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={handleAccept}
                disabled={acceptRideMutation.isPending}
              >
                <Text style={styles.acceptText}>
                  {acceptRideMutation.isPending ? "جاري القبول..." : "✅ قبول"}
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
});

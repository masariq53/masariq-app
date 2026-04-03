import { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from "react-native-maps";
import { useDriver } from "@/lib/driver-context";
import { useLocation } from "@/hooks/use-location";

const { width } = Dimensions.get("window");

// موقع الموصل المركزي (fallback فقط)
const MOSUL_CENTER = {
  latitude: 36.3392,
  longitude: 43.1289,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

export default function CaptainHomeScreen() {
  const insets = useSafeAreaInsets();
  const { driver, logout } = useDriver();
  const { coords, isRealLocation } = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const todayEarnings = 0;
  const todayTrips = driver?.totalRides ?? 0;
  const rating = parseFloat(driver?.rating ?? "4.9");
  const mapRef = useRef<MapView>(null);

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

          {/* لا توجد سيارات وهمية - سيتم عرض السائقين الحقيقيين من قاعدة البيانات لاحقاً */}
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>←</Text>
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
            <Text style={styles.headerName}>{driver?.name ?? "كابتن مسار"}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.star}>⭐</Text>
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.earningsBtn}
          onPress={() => router.push("/captain/earnings" as any)}
        >
          <Text style={styles.earningsLabel}>اليوم</Text>
          <Text style={styles.earningsValue}>{todayEarnings.toLocaleString()} د</Text>
        </TouchableOpacity>
      </View>

      {/* زر الحالة */}
      <View style={styles.onlineContainer}>
        <TouchableOpacity
          style={[styles.onlineBtn, isOnline && styles.onlineBtnActive]}
          onPress={() => setIsOnline(!isOnline)}
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
          <Text style={styles.statLabel}>دينار</Text>
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
          <Text style={styles.statLabel}>الأرباح</Text>
        </TouchableOpacity>
      </View>

      {/* لا يوجد طلب تجريبي - الطلبات ستأتي من المستخدمين الحقيقيين فقط */}
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
  nearbyMarker: { alignItems: "center" },
  requestMarker: { alignItems: "center" },
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

"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Alert, Dimensions, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// حالات رحلة المسافر
type ApproachStatus = "idle" | "heading" | "arrived_at_pickup";

const STATUS_CONFIG: Record<ApproachStatus, { emoji: string; title: string; subtitle: string; color: string; bg: string }> = {
  idle: {
    emoji: "🕐",
    title: "في انتظار السائق",
    subtitle: "سيتم إشعارك عندما يتوجه السائق إليك",
    color: "#FFD700",
    bg: "#1A1200",
  },
  heading: {
    emoji: "🚗",
    title: "السائق في طريقه إليك",
    subtitle: "كن مستعداً — السائق يتجه نحو موقعك الآن",
    color: "#5B9BD5",
    bg: "#0D1B2E",
  },
  arrived_at_pickup: {
    emoji: "📍",
    title: "السائق وصل إلى موقعك!",
    subtitle: "توجه إلى السائق الآن",
    color: "#2ECC71",
    bg: "#0D2B1A",
  },
};

export default function IntercityTrackingScreen() {
  const router = useRouter();
  const { bookingId, tripId, driverId, driverName, driverPhone, carModel, carPlate, fromCity, toCity } =
    useLocalSearchParams<{
      bookingId: string;
      tripId: string;
      driverId: string;
      driverName: string;
      driverPhone: string;
      carModel: string;
      carPlate: string;
      fromCity: string;
      toCity: string;
    }>();
  const { passenger } = usePassenger();
  const mapRef = useRef<MapView>(null);

  const [approachStatus, setApproachStatus] = useState<ApproachStatus>("idle");
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);

  // جلب موقع السائق كل 5 ثوانٍ
  const locationQuery = trpc.intercity.getDriverLocation.useQuery(
    { tripId: parseInt(tripId || "0") },
    { enabled: !!tripId, refetchInterval: 5000 }
  );

  // جلب حالة الحجز كل 5 ثوانٍ
  const bookingStatusQuery = trpc.intercity.getBookingStatus.useQuery(
    { bookingId: parseInt(bookingId || "0"), passengerId: passenger?.id || 0 },
    { enabled: !!bookingId && !!passenger?.id, refetchInterval: 5000 }
  );

  // تحديث حالة التوجه عند تغيير بيانات الحجز
  useEffect(() => {
    if (bookingStatusQuery.data) {
      const status = (bookingStatusQuery.data as any).driverApproachStatus as ApproachStatus;
      if (status && status !== approachStatus) {
        setApproachStatus(status);
      }
    }
  }, [bookingStatusQuery.data]);

  // تحديث موقع السائق على الخريطة
  useEffect(() => {
    if (locationQuery.data) {
      const loc = locationQuery.data as any;
      if (loc?.lat && loc?.lng) {
        const newCoords = { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) };
        setDriverCoords(newCoords);
        // تحريك الخريطة لموقع السائق
        mapRef.current?.animateToRegion({
          latitude: newCoords.lat,
          longitude: newCoords.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 800);
      }
    }
  }, [locationQuery.data]);

  const handleCallDriver = () => {
    if (!driverPhone) return;
    const url = `tel:${driverPhone}`;
    Linking.canOpenURL(url).then((can) => {
      if (can) Linking.openURL(url);
      else Alert.alert("خطأ", "لا يمكن إجراء المكالمة");
    });
  };

  const statusConfig = STATUS_CONFIG[approachStatus];

  // الموقع الافتراضي (الموصل)
  const defaultRegion = {
    latitude: 36.3359,
    longitude: 43.1189,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{"<"}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>تتبع رحلتك</Text>
          <Text style={styles.headerRoute}>{fromCity} → {toCity}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={defaultRegion}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {driverCoords && (
            <Marker
              coordinate={{ latitude: driverCoords.lat, longitude: driverCoords.lng }}
              title={`🚗 ${driverName || "السائق"}`}
              description={`${carModel || ""} — ${carPlate || ""}`}
            >
              <View style={styles.driverMarker}>
                <Text style={styles.driverMarkerEmoji}>🚗</Text>
              </View>
            </Marker>
          )}
        </MapView>

        {/* No location overlay */}
        {!driverCoords && (
          <View style={styles.noLocationOverlay}>
            <ActivityIndicator color="#FFD700" size="small" />
            <Text style={styles.noLocationText}>جاري تحديد موقع السائق...</Text>
          </View>
        )}
      </View>

      {/* Status Card */}
      <View style={[styles.statusCard, { backgroundColor: statusConfig.bg, borderColor: statusConfig.color + "44" }]}>
        <View style={styles.statusRow}>
          <Text style={styles.statusEmoji}>{statusConfig.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: statusConfig.color }]}>{statusConfig.title}</Text>
            <Text style={styles.statusSubtitle}>{statusConfig.subtitle}</Text>
          </View>
          {bookingStatusQuery.isFetching && (
            <ActivityIndicator color={statusConfig.color} size="small" />
          )}
        </View>

        {/* Progress Steps */}
        <View style={styles.progressRow}>
          {(["idle", "heading", "arrived_at_pickup"] as ApproachStatus[]).map((step, idx) => {
            const steps = ["idle", "heading", "arrived_at_pickup"] as ApproachStatus[];
            const currentIdx = steps.indexOf(approachStatus);
            const isActive = idx <= currentIdx;
            const labels = ["انتظار", "في الطريق", "وصل"];
            return (
              <View key={step} style={styles.progressStep}>
                <View style={[styles.progressDot, isActive && { backgroundColor: statusConfig.color }]} />
                <Text style={[styles.progressLabel, isActive && { color: statusConfig.color }]}>
                  {labels[idx]}
                </Text>
                {idx < 2 && (
                  <View style={[styles.progressLine, isActive && idx < currentIdx && { backgroundColor: statusConfig.color }]} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Driver Info Card */}
      <View style={styles.driverCard}>
        <View style={styles.driverAvatarContainer}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>
              {(driverName || "S").charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driverName || "السائق"}</Text>
          <Text style={styles.driverCar}>{carModel || "السيارة"} • {carPlate || ""}</Text>
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
          <Text style={styles.callBtnText}>📞</Text>
        </TouchableOpacity>
      </View>

      {/* Refresh button */}
      <TouchableOpacity
        style={styles.refreshBtn}
        onPress={() => {
          locationQuery.refetch();
          bookingStatusQuery.refetch();
        }}
      >
        <Text style={styles.refreshBtnText}>🔄 تحديث الموقع</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0120" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === "ios" ? 54 : 14,
    backgroundColor: "#1A0533",
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  backBtn: { padding: 8, width: 40 },
  backIcon: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 16, fontWeight: "bold" },
  headerRoute: { color: "#9B8EC4", fontSize: 12, marginTop: 2 },
  headerRight: { width: 40 },
  mapContainer: {
    height: 260,
    backgroundColor: "#1A0533",
  },
  map: { flex: 1 },
  noLocationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A053388",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  noLocationText: { color: "#9B8EC4", fontSize: 13 },
  driverMarker: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: "#1A0533",
    borderWidth: 2,
    borderColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarkerEmoji: { fontSize: 22 },
  // Status Card
  statusCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  statusEmoji: { fontSize: 36 },
  statusTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  statusSubtitle: { color: "#9B8EC4", fontSize: 13, lineHeight: 18 },
  // Progress
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressStep: { alignItems: "center", flex: 1 },
  progressDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#2D1B4E", marginBottom: 4,
  },
  progressLabel: { color: "#4B3B8C", fontSize: 11, fontWeight: "600" },
  progressLine: {
    position: "absolute",
    top: 6,
    left: "50%",
    width: "100%",
    height: 2,
    backgroundColor: "#2D1B4E",
  },
  // Driver Card
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    backgroundColor: "#1E0A3C",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2D1B4E",
    gap: 12,
  },
  driverAvatarContainer: {},
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
  },
  driverAvatarText: { color: "#1A0533", fontSize: 20, fontWeight: "bold" },
  driverInfo: { flex: 1 },
  driverName: { color: "#E0D0FF", fontSize: 15, fontWeight: "bold" },
  driverCar: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#0D2B1A", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#2ECC71",
  },
  callBtnText: { fontSize: 20 },
  // Refresh
  refreshBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4B3B8C",
  },
  refreshBtnText: { color: "#C4B5E0", fontSize: 14, fontWeight: "600" },
});

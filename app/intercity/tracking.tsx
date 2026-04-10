import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Alert, Platform, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, PROVIDER_DEFAULT, AnimatedRegion } from "react-native-maps";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

type ApproachStatus = "idle" | "heading" | "arrived_at_pickup";

const STATUS_CONFIG: Record<ApproachStatus, {
  emoji: string; title: string; subtitle: string; color: string; bg: string;
}> = {
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

// حساب المسافة بالكيلومتر بين نقطتين (Haversine)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// تقدير وقت الوصول بالدقائق (fallback - سرعة متوسطة 30 كم/ساعة في المدينة)
function estimateMinutes(distKm: number) {
  const avgSpeedKmh = 30;
  return Math.max(1, Math.round((distKm / avgSpeedKmh) * 60));
}

// جلب ETA الحقيقي من OSRM (مثل Waze)
async function fetchOSRMEta(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<{ minutes: number; distKm: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === "Ok" && json.routes?.[0]) {
      const route = json.routes[0];
      return {
        minutes: Math.max(1, Math.round(route.duration / 60)),
        distKm: Math.round((route.distance / 1000) * 10) / 10,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default function IntercityTrackingScreen() {
  const router = useRouter();
  const {
    bookingId, tripId, driverId, driverName, driverPhone,
    carModel, carPlate, fromCity, toCity,
    passengerLat, passengerLng,
  } = useLocalSearchParams<{
    bookingId: string; tripId: string; driverId: string;
    driverName: string; driverPhone: string;
    carModel: string; carPlate: string;
    fromCity: string; toCity: string;
    passengerLat: string; passengerLng: string;
  }>();

  const { passenger } = usePassenger();
  const mapRef = useRef<MapView>(null);

  const [approachStatus, setApproachStatus] = useState<ApproachStatus>("idle");
  const [prevApproachStatus, setPrevApproachStatus] = useState<ApproachStatus>("idle");
  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [etaDistKm, setEtaDistKm] = useState<number | null>(null);
  const [soundPlayed, setSoundPlayed] = useState(false);

  // Animated marker position
  const markerCoords = useRef(
    new AnimatedRegion({
      latitude: 36.3359,
      longitude: 43.1189,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  // Audio player للإشعار الصوتي
  const arrivedPlayer = useAudioPlayer(
    require("@/assets/sounds/new-ride.mp3")
  );

  // تفعيل الصوت في الوضع الصامت
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      arrivedPlayer.release();
    };
  }, []);

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

  // تحديث حالة التوجه وتشغيل الصوت عند الوصول
  useEffect(() => {
    if (bookingStatusQuery.data) {
      const status = (bookingStatusQuery.data as any).driverApproachStatus as ApproachStatus;
      if (status && status !== approachStatus) {
        setPrevApproachStatus(approachStatus);
        setApproachStatus(status);

        // تشغيل الصوت عند وصول السائق
        if (status === "arrived_at_pickup" && !soundPlayed) {
          setSoundPlayed(true);
          try {
            arrivedPlayer.seekTo(0);
            arrivedPlayer.play();
          } catch {}
        }
      }
    }
  }, [bookingStatusQuery.data]);

  // تحديث موقع السائق بـ animation سلسة
  useEffect(() => {
    if (locationQuery.data) {
      const loc = locationQuery.data as any;
      if (loc?.lat && loc?.lng) {
        const newLat = parseFloat(loc.lat);
        const newLng = parseFloat(loc.lng);

        // حركة سلسة للـ marker
        markerCoords.timing({
          latitude: newLat,
          longitude: newLng,
          latitudeDelta: 0,
          longitudeDelta: 0,
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }).start();

        setDriverCoords({ lat: newLat, lng: newLng });

        // حساب وقت الوصول التقديري باستخدام OSRM
        if (passengerLat && passengerLng) {
          const pLat = parseFloat(passengerLat);
          const pLng = parseFloat(passengerLng);
          if (!isNaN(pLat) && !isNaN(pLng)) {
            // جلب ETA من OSRM أولاً، وإذا فشل استخدم الحساب البسيط
            fetchOSRMEta(newLat, newLng, pLat, pLng).then((result) => {
              if (result) {
                setEtaMinutes(result.minutes);
                setEtaDistKm(result.distKm);
              } else {
                const distKm = haversineKm(newLat, newLng, pLat, pLng);
                setEtaMinutes(estimateMinutes(distKm));
                setEtaDistKm(Math.round(distKm * 10) / 10);
              }
            });
          }
        }

        // تحريك الكاميرا لتشمل السائق والمستخدم
        if (passengerLat && passengerLng) {
          const pLat = parseFloat(passengerLat);
          const pLng = parseFloat(passengerLng);
          if (!isNaN(pLat) && !isNaN(pLng)) {
            const minLat = Math.min(newLat, pLat);
            const maxLat = Math.max(newLat, pLat);
            const minLng = Math.min(newLng, pLng);
            const maxLng = Math.max(newLng, pLng);
            const padding = 0.005;
            mapRef.current?.animateToRegion({
              latitude: (minLat + maxLat) / 2,
              longitude: (minLng + maxLng) / 2,
              latitudeDelta: Math.max(maxLat - minLat + padding, 0.01),
              longitudeDelta: Math.max(maxLng - minLng + padding, 0.01),
            }, 1000);
          }
        } else {
          mapRef.current?.animateToRegion({
            latitude: newLat,
            longitude: newLng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      }
    }
  }, [locationQuery.data]);

  const handleCallDriver = () => {
    if (!driverPhone) return;
    Linking.openURL(`tel:${driverPhone}`).catch(() =>
      Alert.alert("خطأ", "لا يمكن إجراء المكالمة")
    );
  };

  const statusConfig = STATUS_CONFIG[approachStatus];

  const defaultRegion = {
    latitude: 36.3359,
    longitude: 43.1189,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const steps: ApproachStatus[] = ["idle", "heading", "arrived_at_pickup"];
  const currentStepIdx = steps.indexOf(approachStatus);
  const stepLabels = ["انتظار", "في الطريق", "وصل"];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{"‹"}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>تتبع رحلتك</Text>
          <Text style={styles.headerRoute}>{fromCity} → {toCity}</Text>
        </View>
        <View style={styles.headerRight}>
          {bookingStatusQuery.isFetching && (
            <ActivityIndicator color="#FFD700" size="small" />
          )}
        </View>
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
            <Marker.Animated
              coordinate={markerCoords as any}
              title={`🚗 ${driverName || "السائق"}`}
              description={`${carModel || ""} — ${carPlate || ""}`}
            >
              <View style={[
                styles.driverMarker,
                approachStatus === "arrived_at_pickup" && styles.driverMarkerArrived,
              ]}>
                <Text style={styles.driverMarkerEmoji}>🚗</Text>
              </View>
            </Marker.Animated>
          )}
        </MapView>

        {/* ETA Badge */}
        {etaMinutes !== null && approachStatus === "heading" && (
          <View style={styles.etaBadge}>
            <Text style={styles.etaLabel}>وقت الوصول</Text>
            <View style={styles.etaRow}>
              <Text style={styles.etaTime}>{etaMinutes}</Text>
              <Text style={styles.etaUnit}>دقيقة</Text>
            </View>
            {etaDistKm !== null && (
              <Text style={styles.etaDist}>{etaDistKm} كم</Text>
            )}
          </View>
        )}

        {/* No location overlay */}
        {!driverCoords && (
          <View style={styles.noLocationOverlay}>
            <ActivityIndicator color="#FFD700" size="small" />
            <Text style={styles.noLocationText}>جاري تحديد موقع السائق...</Text>
          </View>
        )}
      </View>

      {/* Status Card */}
      <View style={[styles.statusCard, {
        backgroundColor: statusConfig.bg,
        borderColor: statusConfig.color + "55",
      }]}>
        <View style={styles.statusRow}>
          <Text style={styles.statusEmoji}>{statusConfig.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: statusConfig.color }]}>
              {statusConfig.title}
            </Text>
            <Text style={styles.statusSubtitle}>{statusConfig.subtitle}</Text>
          </View>
        </View>

        {/* Progress Steps */}
        <View style={styles.progressRow}>
          {steps.map((step, idx) => {
            const isActive = idx <= currentStepIdx;
            const isConnected = idx < currentStepIdx;
            return (
              <React.Fragment key={step}>
                <View style={styles.progressStep}>
                  <View style={[
                    styles.progressDot,
                    isActive && { backgroundColor: statusConfig.color, transform: [{ scale: 1.2 }] },
                  ]} />
                  <Text style={[
                    styles.progressLabel,
                    isActive && { color: statusConfig.color, fontWeight: "700" },
                  ]}>
                    {stepLabels[idx]}
                  </Text>
                </View>
                {idx < steps.length - 1 && (
                  <View style={[
                    styles.progressConnector,
                    isConnected && { backgroundColor: statusConfig.color },
                  ]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      {/* Driver Info Card */}
      <View style={styles.driverCard}>
        <View style={styles.driverAvatar}>
          <Text style={styles.driverAvatarText}>
            {(driverName || "S").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driverName || "السائق"}</Text>
          <Text style={styles.driverCar}>
            {carModel || "السيارة"}{carPlate ? ` • ${carPlate}` : ""}
          </Text>
          {etaMinutes !== null && approachStatus === "heading" && (
            <View style={styles.etaInlineRow}>
              <Text style={styles.etaInline}>⏱ يصل خلال {etaMinutes} دقيقة</Text>
              {etaDistKm !== null && (
                <Text style={styles.etaInlineDist}> • {etaDistKm} كم</Text>
              )}
            </View>
          )}
          {approachStatus === "arrived_at_pickup" && (
            <Text style={styles.arrivedInline}>✅ وصل إلى موقعك</Text>
          )}
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
          <Text style={styles.callBtnText}>📞</Text>
        </TouchableOpacity>
      </View>

      {/* Arrived Alert Banner */}
      {approachStatus === "arrived_at_pickup" && (
        <View style={styles.arrivedBanner}>
          <Text style={styles.arrivedBannerEmoji}>🎉</Text>
          <Text style={styles.arrivedBannerText}>السائق وصل! توجه إليه الآن</Text>
        </View>
      )}
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
  backBtn: { padding: 8, width: 40, alignItems: "center" },
  backIcon: { color: "#FFD700", fontSize: 28, fontWeight: "300", lineHeight: 28 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "#FFD700", fontSize: 16, fontWeight: "bold" },
  headerRoute: { color: "#9B8EC4", fontSize: 12, marginTop: 2 },
  headerRight: { width: 40, alignItems: "center" },
  mapContainer: {
    height: 240,
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
    width: 46, height: 46,
    borderRadius: 23,
    backgroundColor: "#1A0533",
    borderWidth: 2.5,
    borderColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  driverMarkerArrived: {
    borderColor: "#2ECC71",
    shadowColor: "#2ECC71",
  },
  driverMarkerEmoji: { fontSize: 22 },
  // ETA Badge on map
  etaBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#1A0533EE",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#5B9BD5",
    alignItems: "center",
  },
  etaLabel: { color: "#9B8EC4", fontSize: 10, fontWeight: "600", marginBottom: 2 },
  etaRow: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  etaTime: { color: "#5B9BD5", fontSize: 26, fontWeight: "900", lineHeight: 28 },
  etaUnit: { color: "#9B8EC4", fontSize: 12, marginBottom: 2 },
  etaDist: { color: "#5B9BD5", fontSize: 11, marginTop: 2, opacity: 0.8 },
  // Status Card
  statusCard: {
    margin: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  statusEmoji: { fontSize: 34 },
  statusTitle: { fontSize: 15, fontWeight: "800", marginBottom: 3 },
  statusSubtitle: { color: "#9B8EC4", fontSize: 12, lineHeight: 17 },
  // Progress
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  progressStep: { alignItems: "center", gap: 4 },
  progressDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#2D1B4E",
  },
  progressLabel: { color: "#4B3B8C", fontSize: 11, fontWeight: "600" },
  progressConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#2D1B4E",
    marginBottom: 16,
    marginHorizontal: 4,
  },
  // Driver Card
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    backgroundColor: "#1E0A3C",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2D1B4E",
    gap: 12,
  },
  driverAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
  },
  driverAvatarText: { color: "#1A0533", fontSize: 22, fontWeight: "bold" },
  driverInfo: { flex: 1 },
  driverName: { color: "#E0D0FF", fontSize: 15, fontWeight: "bold" },
  driverCar: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
  etaInlineRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  etaInline: { color: "#5B9BD5", fontSize: 12, fontWeight: "700" },
  etaInlineDist: { color: "#9B8EC4", fontSize: 11 },
  arrivedInline: { color: "#2ECC71", fontSize: 12, marginTop: 4, fontWeight: "700" },
  callBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#0D2B1A", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#2ECC71",
  },
  callBtnText: { fontSize: 20 },
  // Arrived Banner
  arrivedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: "#0D2B1A",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#2ECC71",
  },
  arrivedBannerEmoji: { fontSize: 24 },
  arrivedBannerText: { color: "#2ECC71", fontSize: 15, fontWeight: "800" },
});

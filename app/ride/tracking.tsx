import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { trpc } from "@/lib/trpc";

const { height } = Dimensions.get("window");

const steps = [
  { id: 0, label: "جاري البحث عن سائق...", icon: "🔍" },
  { id: 1, label: "تم العثور على سائق!", icon: "✅" },
  { id: 2, label: "السائق في طريقه إليك", icon: "🚗" },
  { id: 3, label: "السائق وصل! ابحث عنه", icon: "📍" },
  { id: 4, label: "في الطريق إلى وجهتك", icon: "🛣️" },
];

const STATUS_TO_STEP: Record<string, number> = {
  pending: 0,
  accepted: 1,
  driver_on_way: 2,
  arrived: 3,
  in_progress: 4,
  completed: 4,
};

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    rideId?: string;
    passengerId?: string;
    fare?: string;
    distance?: string;
    duration?: string;
    pickupLat?: string;
    pickupLng?: string;
    dropoffLat?: string;
    dropoffLng?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
  }>();

  const rideId = params.rideId ? parseInt(params.rideId) : 0;
  const fare = params.fare ? parseInt(params.fare) : 3500;
  const pickupCoord = {
    latitude: params.pickupLat ? parseFloat(params.pickupLat) : 36.3392,
    longitude: params.pickupLng ? parseFloat(params.pickupLng) : 43.1289,
  };
  const dropoffCoord = {
    latitude: params.dropoffLat ? parseFloat(params.dropoffLat) : 36.3600,
    longitude: params.dropoffLng ? parseFloat(params.dropoffLng) : 43.1450,
  };

  const [currentStep, setCurrentStep] = useState(0);
  const [passengerId, setPassengerId] = useState<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView>(null);

  // جلب passengerId من params أو AsyncStorage
  useEffect(() => {
    const pid = params.passengerId ? parseInt(params.passengerId as string) : null;
    if (pid) setPassengerId(pid);
  }, []);

  // Polling حقيقي لحالة الرحلة كل 5 ثوانٍ
  const rideQuery = trpc.rides.passengerActiveRide.useQuery(
    { passengerId: passengerId ?? 0 },
    {
      enabled: !!passengerId,
      refetchInterval: 5000,
      staleTime: 0,
    }
  );

  const ride = rideQuery.data;

  // تحديث الخطوة بناءً على حالة الرحلة من السيرفر
  useEffect(() => {
    if (!ride) return;
    const step = STATUS_TO_STEP[ride.status] ?? 0;
    setCurrentStep(step);

    // إذا اكتملت الرحلة، انتقل لشاشة التقييم
    if (ride.status === "completed") {
      router.replace({
        pathname: "/ride/rating" as any,
        params: {
          driverName: ride.driver?.name ?? "السائق",
          driverAvatar: "👨",
          driverRating: ride.driver?.rating ?? "5.0",
          fare: fare.toString(),
          rideId: rideId.toString(),
        },
      });
    }
  }, [ride?.status]);

  // نبضة
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

  // إلغاء الرحلة
  const [cancelling, setCancelling] = useState(false);
  const handleCancel = () => {
    setCancelling(true);
    router.replace("/(tabs)" as any);
  };

  const step = steps[currentStep];
  const driverName = ride?.driver?.name ?? "جاري البحث...";
  const driverCar = ride?.driver ? `${ride.driver.vehicleModel ?? ""} ${ride.driver.vehicleColor ?? ""}`.trim() || "—" : "—";
  const driverPlate = ride?.driver?.vehiclePlate ?? "—";
  const driverRating = ride?.driver?.rating ?? "5.0";
  const driverPhone = ride?.driver?.phone;
  const driverLat = ride?.driver?.currentLat;
  const driverLng = ride?.driver?.currentLng;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* خريطة تتبع حقيقية */}
      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: pickupCoord.latitude,
            longitude: pickupCoord.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* نقطة الانطلاق */}
          <Marker coordinate={pickupCoord} title="نقطة الانطلاق">
            <View style={styles.originMarker}>
              <Text style={{ fontSize: 18 }}>📍</Text>
            </View>
          </Marker>

          {/* نقطة الوجهة */}
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
                <Text style={{ fontSize: 22 }}>🚗</Text>
              </Animated.View>
            </Marker>
          )}

          {/* خط المسار */}
          <Polyline
            coordinates={[pickupCoord, dropoffCoord]}
            strokeColor="#FFD700"
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />
        </MapView>
      ) : (
        <View style={[styles.map, styles.webMap]}>
          <Animated.Text style={[styles.webMapCar, { transform: [{ scale: pulseAnim }] }]}>
            🚗
          </Animated.Text>
          <Text style={styles.webMapLabel}>تتبع السائق — الموصل</Text>
        </View>
      )}

      {/* زر الرجوع */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      {/* حالة الرحلة */}
      <View style={[styles.statusBadge, { top: insets.top + 12 }]}>
        <Text style={styles.statusIcon}>{step.icon}</Text>
        <Text style={styles.statusText}>{step.label}</Text>
      </View>

      {/* لوحة معلومات السائق */}
      <View style={styles.driverSheet}>
        <View style={styles.handle} />

        {/* معلومات السائق */}
        <View style={styles.driverRow}>
          <View style={styles.avatarCircle}>
            {currentStep === 0 ? (
              <ActivityIndicator color="#FFD700" />
            ) : (
              <Text style={styles.avatarText}>👨</Text>
            )}
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.driverCar}>{driverCar}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.star}>⭐</Text>
              <Text style={styles.rating}>{driverRating}</Text>
              {driverPlate !== "—" && <Text style={styles.plate}> • {driverPlate}</Text>}
            </View>
          </View>
          {currentStep > 0 && (
            <View style={styles.driverActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => driverPhone && Linking.openURL(`tel:${driverPhone}`)}
              >
                <Text style={styles.actionIcon}>📞</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* شريط التقدم */}
        <View style={styles.progressBar}>
          {steps.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.progressDot,
                i <= currentStep && styles.progressDotActive,
                i < currentStep && styles.progressDotDone,
              ]}
            />
          ))}
        </View>

        {/* معلومات الأجرة */}
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>الأجرة المتوقعة</Text>
          <Text style={styles.fareValue}>{fare.toLocaleString("ar-IQ")} دينار</Text>
          <Text style={styles.fareMethod}>💵 نقداً</Text>
        </View>

        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.sosBtn} onPress={() => Linking.openURL("tel:122")}>
            <Text style={styles.sosBtnText}>🆘 طوارئ</Text>
          </TouchableOpacity>
          {currentStep >= 4 ? (
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: "#22C55E", borderColor: "#22C55E" }]}
              onPress={() => {
                router.replace({
                  pathname: "/ride/rating" as any,
                  params: {
                    driverName: driverName,
                    driverAvatar: "👨",
                    driverRating: driverRating,
                    fare: fare.toString(),
                    rideId: rideId.toString(),
                  },
                });
              }}
            >
              <Text style={[styles.cancelBtnText, { color: "#FFFFFF" }]}>✅ إنهاء الرحلة</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                Alert.alert("إلغاء الرحلة", "هل أنت متأكد من إلغاء الرحلة؟", [
                  { text: "لا", style: "cancel" },
                  { text: "نعم", style: "destructive", onPress: handleCancel },
                ]);
              }}
            >
              <Text style={styles.cancelBtnText}>
                {cancelling ? "جاري الإلغاء..." : "إلغاء الرحلة"}
              </Text>
            </TouchableOpacity>
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
  },
  webMapCar: { fontSize: 64, marginBottom: 12 },
  webMapLabel: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
    gap: 8,
  },
  statusIcon: { fontSize: 16 },
  statusText: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  driverMarker: { alignItems: "center" },
  destMarker: { alignItems: "center" },
  originMarker: { alignItems: "center" },
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
    marginBottom: 16,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  star: { fontSize: 12 },
  rating: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  plate: { color: "#9B8EC4", fontSize: 12 },
  driverActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  actionIcon: { fontSize: 18 },
  progressBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3D2070",
  },
  progressDotActive: { backgroundColor: "#FFD700" },
  progressDotDone: { backgroundColor: "#22C55E" },
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  fareLabel: { color: "#9B8EC4", fontSize: 13 },
  fareValue: { color: "#FFD700", fontSize: 15, fontWeight: "bold" },
  fareMethod: { color: "#9B8EC4", fontSize: 13 },
  bottomRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  sosBtn: {
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  sosBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "bold" },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  cancelBtnText: { color: "#9B8EC4", fontSize: 14, fontWeight: "bold" },
});

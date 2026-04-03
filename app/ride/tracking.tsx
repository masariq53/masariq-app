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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Notifications from "expo-notifications";

// Configure notification handler for foreground display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function setupNotifications() {
  if (Platform.OS === "web") return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("masar-ride", {
      name: "تحديثات الرحلة",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
}

async function sendRideNotification(title: string, body: string) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // immediate
    });
  } catch (e) {
    // Silently fail if permissions not granted
  }
}

const { height } = Dimensions.get("window");

// مسار تجريبي في الموصل — من ساحة الحدباء إلى جامعة الموصل
const ROUTE_COORDS = [
  { latitude: 36.3392, longitude: 43.1289 }, // ساحة الحدباء
  { latitude: 36.3420, longitude: 43.1310 },
  { latitude: 36.3450, longitude: 43.1350 },
  { latitude: 36.3480, longitude: 43.1380 },
  { latitude: 36.3520, longitude: 43.1410 },
  { latitude: 36.3560, longitude: 43.1440 },
  { latitude: 36.3600, longitude: 43.1450 }, // جامعة الموصل
];

const driverInfo = {
  name: "أحمد محمد",
  rating: "4.9",
  car: "تويوتا كورولا - أبيض",
  plate: "م ٢٣٤٥ ن",
  phone: "07901234567",
  avatar: "👨",
};

const steps = [
  { id: 0, label: "جاري البحث عن سائق...", icon: "🔍" },
  { id: 1, label: "تم العثور على سائق!", icon: "✅" },
  { id: 2, label: "السائق في طريقه إليك", icon: "🚗" },
  { id: 3, label: "السائق وصل! ابحث عنه", icon: "📍" },
  { id: 4, label: "في الطريق إلى وجهتك", icon: "🛣️" },
];

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    rideId?: string;
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
  const fare = params.fare ? parseInt(params.fare) : 3500;
  const [currentStep, setCurrentStep] = useState(0);
  const [driverPos, setDriverPos] = useState(0); // index in ROUTE_COORDS
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Setup notifications on mount
    setupNotifications();

    // تقدم الخطوات تلقائياً للعرض
    const timers = [
      setTimeout(() => {
        setCurrentStep(1);
        sendRideNotification("تم العثور على سائق! 🚗", `${driverInfo.name} في طريقه إليك - ${driverInfo.car}`);
      }, 2000),
      setTimeout(() => setCurrentStep(2), 4500),
      setTimeout(() => {
        setCurrentStep(3);
        sendRideNotification("السائق وصل! 📍", `${driverInfo.name} ينتظرك - ${driverInfo.plate}`);
      }, 9000),
      setTimeout(() => setCurrentStep(4), 13000),
    ];

    // تحريك السائق على الخريطة
    let posIndex = 0;
    const moveDriver = setInterval(() => {
      posIndex = Math.min(posIndex + 1, ROUTE_COORDS.length - 1);
      setDriverPos(posIndex);
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...ROUTE_COORDS[posIndex],
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }, 800);
      }
      if (posIndex === ROUTE_COORDS.length - 1) clearInterval(moveDriver);
    }, 3000);

    // نبضة
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(moveDriver);
      pulse.stop();
    };
  }, []);

  const currentDriverCoord = ROUTE_COORDS[driverPos];
  const step = steps[currentStep];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* خريطة تتبع الموصل */}
      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: 36.3500,
            longitude: 43.1370,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* نقطة الراكب */}
          <Marker coordinate={ROUTE_COORDS[ROUTE_COORDS.length - 1]} title="وجهتك">
            <View style={styles.destMarker}>
              <Text style={{ fontSize: 22 }}>🏁</Text>
            </View>
          </Marker>

          {/* نقطة الانطلاق */}
          <Marker coordinate={ROUTE_COORDS[0]} title="نقطة الانطلاق">
            <View style={styles.originMarker}>
              <Text style={{ fontSize: 18 }}>📍</Text>
            </View>
          </Marker>

          {/* موقع السائق المتحرك */}
          <Marker coordinate={currentDriverCoord} title={`السائق: ${driverInfo.name}`}>
            <Animated.View style={[styles.driverMarker, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={{ fontSize: 22 }}>🚗</Text>
            </Animated.View>
          </Marker>

          {/* مسار الرحلة */}
          <Polyline
            coordinates={ROUTE_COORDS}
            strokeColor="#FFD700"
            strokeWidth={4}
            lineDashPattern={[10, 5]}
          />

          {/* المسار المقطوع */}
          <Polyline
            coordinates={ROUTE_COORDS.slice(0, driverPos + 1)}
            strokeColor="#22C55E"
            strokeWidth={4}
          />
        </MapView>
      ) : (
        <View style={[styles.map, styles.webMap]}>
          <Animated.Text style={[styles.webMapCar, { transform: [{ scale: pulseAnim }] }]}>
            🚗
          </Animated.Text>
          <Text style={styles.webMapLabel}>تتبع السائق — الموصل</Text>
          <Text style={styles.webMapCoords}>
            {currentDriverCoord.latitude.toFixed(4)}° N, {currentDriverCoord.longitude.toFixed(4)}° E
          </Text>
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
            <Text style={styles.avatarText}>{driverInfo.avatar}</Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverInfo.name}</Text>
            <Text style={styles.driverCar}>{driverInfo.car}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.star}>⭐</Text>
              <Text style={styles.rating}>{driverInfo.rating}</Text>
              <Text style={styles.plate}> • {driverInfo.plate}</Text>
            </View>
          </View>
          <View style={styles.driverActions}>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>💬</Text>
            </TouchableOpacity>
          </View>
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

        {/* زر الطوارئ */}
        {/* Fare info */}
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>الأجرة المتوقعة</Text>
          <Text style={styles.fareValue}>{fare.toLocaleString('ar-IQ')} دينار</Text>
          <Text style={styles.fareMethod}>💵 نقداً</Text>
        </View>

        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.sosBtn} onPress={() => Linking.openURL('tel:122')}>
            <Text style={styles.sosBtnText}>🆘 طوارئ</Text>
          </TouchableOpacity>
          {currentStep >= 4 ? (
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: '#22C55E', borderColor: '#22C55E' }]}
              onPress={() => {
                router.replace({
                  pathname: '/ride/rating' as any,
                  params: {
                    driverName: driverInfo.name,
                    driverAvatar: driverInfo.avatar,
                    driverRating: driverInfo.rating,
                    fare: fare.toString(),
                    rideId: params.rideId ?? '0',
                  },
                });
              }}
            >
              <Text style={[styles.cancelBtnText, { color: '#FFFFFF' }]}>✅ إنهاء الرحلة</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                Alert.alert('إلغاء الرحلة', 'هل أنت متأكد من إلغاء الرحلة؟', [
                  { text: 'لا', style: 'cancel' },
                  { text: 'نعم', style: 'destructive', onPress: () => router.replace('/(tabs)') },
                ]);
              }}
            >
              <Text style={styles.cancelBtnText}>إلغاء الرحلة</Text>
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
  webMapCoords: { color: "#9B8EC4", fontSize: 13, marginTop: 6 },
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
    borderWidth: 2,
    borderColor: "#FFD700",
    marginRight: 12,
  },
  avatarText: { fontSize: 26 },
  driverInfo: { flex: 1 },
  driverName: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  driverCar: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  star: { fontSize: 12 },
  rating: { color: "#FFD700", fontSize: 13, fontWeight: "bold", marginLeft: 2 },
  plate: { color: "#6B5B8A", fontSize: 12 },
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
  bottomRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  sosBtn: {
    flex: 1,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sosBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  cancelBtn: {
    flex: 2,
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  cancelBtnText: { color: "#9B8EC4", fontSize: 14, fontWeight: "600" },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  fareLabel: { color: "#9B8EC4", fontSize: 13 },
  fareValue: { color: "#FFD700", fontSize: 15, fontWeight: "800" },
  fareMethod: { color: "#C4B5D4", fontSize: 13 },
});

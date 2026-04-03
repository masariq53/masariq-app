import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useLocation } from "@/hooks/use-location";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";

type TripPhase = "pickup" | "in_trip" | "arrived";

// مسار الرحلة في الموصل
const PICKUP_COORD = { latitude: 36.3392, longitude: 43.1289 }; // ساحة الحدباء
const DEST_COORD = { latitude: 36.3600, longitude: 43.1450 };   // جامعة الموصل
const CAPTAIN_START = { latitude: 36.3350, longitude: 43.1220 }; // موقع الكابتن

const ROUTE_TO_PICKUP = [
  { latitude: 36.3350, longitude: 43.1220 },
  { latitude: 36.3370, longitude: 43.1250 },
  { latitude: 36.3392, longitude: 43.1289 },
];

const ROUTE_TO_DEST = [
  { latitude: 36.3392, longitude: 43.1289 },
  { latitude: 36.3430, longitude: 43.1330 },
  { latitude: 36.3500, longitude: 43.1390 },
  { latitude: 36.3600, longitude: 43.1450 },
];

export default function CaptainActiveTripScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ rideId?: string; passengerName?: string; fare?: string }>();
  const { driver } = usePassenger();
  const { coords } = useLocation();
  const [phase, setPhase] = useState<TripPhase>("pickup");
  const [captainPos, setCaptainPos] = useState(CAPTAIN_START);
  const mapRef = useRef<MapView>(null);

  const updateStatus = trpc.rides.updateStatus.useMutation();

  const rideId = params.rideId ? parseInt(params.rideId) : null;

  const phaseConfig = {
    pickup: {
      title: "في الطريق لاستلام الراكب",
      subtitle: "ساحة الحدباء، الموصل",
      btnText: "وصلت لموقع الراكب ✓",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      route: ROUTE_TO_PICKUP,
      target: PICKUP_COORD,
    },
    in_trip: {
      title: "الرحلة جارية 🛣️",
      subtitle: "جامعة الموصل، الدندان",
      btnText: "إنهاء الرحلة ✓",
      btnColor: "#22C55E",
      btnTextColor: "#FFFFFF",
      route: ROUTE_TO_DEST,
      target: DEST_COORD,
    },
    arrived: {
      title: "وصلنا للوجهة! 🎉",
      subtitle: "جامعة الموصل، الدندان",
      btnText: "تأكيد إنهاء الرحلة",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      route: ROUTE_TO_DEST,
      target: DEST_COORD,
    },
  };

  const config = phaseConfig[phase];

  const handlePhaseAction = () => {
    if (phase === "pickup") {
      // Driver arrived at pickup
      if (rideId) updateStatus.mutate({ rideId, status: "driver_arrived" });
      setPhase("in_trip");
      setCaptainPos(PICKUP_COORD);
      mapRef.current?.animateToRegion({ ...PICKUP_COORD, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 800);
    } else if (phase === "in_trip") {
      // Trip started
      if (rideId) updateStatus.mutate({ rideId, status: "in_progress" });
      setPhase("arrived");
      setCaptainPos(DEST_COORD);
      mapRef.current?.animateToRegion({ ...DEST_COORD, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 800);
    } else {
      // Trip completed
      if (rideId) updateStatus.mutate({ rideId, status: "completed" });
      router.push("/captain/trip-summary" as any);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* خريطة الموصل */}
      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude: 36.3500,
            longitude: 43.1350,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={false}
        >
          {/* موقع الكابتن */}
          <Marker coordinate={captainPos} title="موقعك">
            <View style={styles.captainMarker}>
              <Text style={{ fontSize: 22 }}>⭐</Text>
            </View>
          </Marker>

          {/* موقع الراكب */}
          <Marker coordinate={PICKUP_COORD} title="الراكب">
            <View style={styles.pickupMarker}>
              <Text style={{ fontSize: 20 }}>👤</Text>
            </View>
          </Marker>

          {/* الوجهة */}
          <Marker coordinate={DEST_COORD} title="الوجهة">
            <View style={styles.destMarker}>
              <Text style={{ fontSize: 20 }}>🏁</Text>
            </View>
          </Marker>

          {/* مسار الرحلة */}
          <Polyline
            coordinates={config.route}
            strokeColor="#FFD700"
            strokeWidth={4}
            lineDashPattern={[8, 4]}
          />
        </MapView>
      ) : (
        <View style={[styles.map, styles.webMap]}>
          <Text style={{ fontSize: 56 }}>🗺️</Text>
          <Text style={styles.webMapLabel}>{config.title}</Text>
          <Text style={styles.webMapSub}>خريطة الموصل — الرحلة النشطة</Text>
        </View>
      )}

      {/* شريط الحالة العلوي */}
      <View style={[styles.statusBar, { top: insets.top + 8 }]}>
        <View style={[styles.statusDot, phase === "in_trip" && styles.statusDotGreen]} />
        <Text style={styles.statusTitle}>{config.title}</Text>
      </View>

      {/* لوحة الرحلة السفلية */}
      <View style={styles.tripSheet}>
        <View style={styles.handle} />

        {/* معلومات الراكب */}
        <View style={styles.passengerRow}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 26 }}>👤</Text>
          </View>
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>محمد علي</Text>
            <Text style={styles.passengerDest}>{config.subtitle}</Text>
          </View>
          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL("tel:07901234567")}
            >
              <Text style={styles.actionIcon}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>💬</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* تفاصيل المسار */}
        <View style={styles.routeBox}>
          <View style={styles.routeRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.routeText}>ساحة الحدباء</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.dotRed} />
            <Text style={styles.routeText}>جامعة الموصل</Text>
          </View>
        </View>

        {/* زر الإجراء الرئيسي */}
        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: config.btnColor }]}
          onPress={handlePhaseAction}
        >
          <Text style={[styles.mainBtnText, { color: config.btnTextColor }]}>
            {config.btnText}
          </Text>
        </TouchableOpacity>

        {/* زر الطوارئ */}
        <TouchableOpacity style={styles.sosBtn}>
          <Text style={styles.sosBtnText}>🆘 الإبلاغ عن مشكلة</Text>
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
  webMapSub: { color: "#9B8EC4", fontSize: 13 },
  captainMarker: { alignItems: "center" },
  pickupMarker: { alignItems: "center" },
  destMarker: { alignItems: "center" },
  statusBar: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(26,5,51,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFD700" },
  statusDotGreen: { backgroundColor: "#22C55E" },
  statusTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
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
    marginBottom: 16,
  },
  passengerRow: {
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
  passengerInfo: { flex: 1 },
  passengerName: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  passengerDest: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
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
  routeBox: {
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  routeLine: { width: 2, height: 16, backgroundColor: "#3D2070", marginLeft: 4, marginVertical: 3 },
  routeText: { color: "#FFFFFF", fontSize: 14 },
  mainBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  mainBtnText: { fontSize: 15, fontWeight: "bold" },
  sosBtn: {
    backgroundColor: "transparent",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EF4444",
    marginBottom: 4,
  },
  sosBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
});

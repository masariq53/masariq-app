import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

const { height, width } = Dimensions.get("window");

// موقع الموصل — ساحة الحدباء
const MOSUL_CENTER = {
  latitude: 36.3392,
  longitude: 43.1289,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const rideTypes = [
  { id: "economy", icon: "🚗", label: "اقتصادي", desc: "أسرع وصول", price: "3,500", time: "3 دقائق", capacity: "4" },
  { id: "comfort", icon: "🚙", label: "مريح", desc: "سيارات فاخرة", price: "5,500", time: "5 دقائق", capacity: "4" },
  { id: "xl", icon: "🚐", label: "XL", desc: "للمجموعات", price: "7,000", time: "7 دقائق", capacity: "6" },
  { id: "women", icon: "👩", label: "سائقة", desc: "للسيدات فقط", price: "4,000", time: "8 دقائق", capacity: "4" },
];

// نقاط مقترحة في الموصل
const MOSUL_PLACES = [
  { id: "1", name: "المستشفى الجمهوري", lat: 36.3350, lng: 43.1210 },
  { id: "2", name: "جامعة الموصل", lat: 36.3600, lng: 43.1450 },
  { id: "3", name: "سوق الشعارين", lat: 36.3420, lng: 43.1320 },
  { id: "4", name: "مطار الموصل", lat: 36.3058, lng: 43.1474 },
  { id: "5", name: "جسر الحرية", lat: 36.3380, lng: 43.1380 },
];

export default function BookRideScreen() {
  const insets = useSafeAreaInsets();
  const [from, setFrom] = useState("موقعي الحالي");
  const [to, setTo] = useState("");
  const [selectedRide, setSelectedRide] = useState("economy");
  const [step, setStep] = useState<"map" | "confirm">("map");
  const [pickupPin, setPickupPin] = useState({ latitude: 36.3392, longitude: 43.1289 });
  const [dropPin, setDropPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  const handleMapPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    if (!dropPin) {
      setDropPin(coord);
      setTo("الوجهة المحددة");
    }
  };

  const handleConfirm = () => {
    router.push("/ride/tracking" as any);
  };

  const selectedType = rideTypes.find((r) => r.id === selectedRide)!;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* خريطة الموصل */}
      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={MOSUL_CENTER}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
          mapType="standard"
        >
          {/* علامة نقطة الانطلاق */}
          <Marker coordinate={pickupPin} title="نقطة الانطلاق">
            <View style={styles.pickupMarker}>
              <Text style={{ fontSize: 20 }}>📍</Text>
            </View>
          </Marker>

          {/* علامة الوجهة */}
          {dropPin && (
            <Marker coordinate={dropPin} title="الوجهة">
              <View style={styles.dropMarker}>
                <Text style={{ fontSize: 20 }}>🏁</Text>
              </View>
            </Marker>
          )}

          {/* خط المسار */}
          {dropPin && (
            <Polyline
              coordinates={[pickupPin, dropPin]}
              strokeColor="#FFD700"
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />
          )}

          {/* علامات مواقع الموصل */}
          {MOSUL_PLACES.map((place) => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              title={place.name}
            >
              <View style={styles.placeMarker}>
                <Text style={styles.placeMarkerText}>📌</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        // Web fallback - خريطة ثابتة
        <View style={[styles.map, styles.webMap]}>
          <Text style={styles.webMapText}>🗺️</Text>
          <Text style={styles.webMapLabel}>خريطة الموصل</Text>
          <Text style={styles.webMapSub}>36.3392° N, 43.1289° E</Text>
        </View>
      )}

      {/* زر الرجوع */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      {/* تلميح الخريطة */}
      {!dropPin && (
        <View style={[styles.mapHint, { top: insets.top + 60 }]}>
          <Text style={styles.mapHintText}>اضغط على الخريطة لتحديد وجهتك</Text>
        </View>
      )}

      {/* لوحة الحجز السفلية */}
      <View style={styles.bottomSheet}>
        {/* مؤشر السحب */}
        <View style={styles.handle} />

        {/* حقول الموقع */}
        <View style={styles.locationRow}>
          <View style={styles.locationDots}>
            <View style={styles.dotGreen} />
            <View style={styles.dotLine} />
            <View style={styles.dotRed} />
          </View>
          <View style={styles.locationInputs}>
            <TouchableOpacity style={styles.locationInput}>
              <Text style={styles.locationLabel}>من</Text>
              <Text style={styles.locationValue} numberOfLines={1}>{from}</Text>
            </TouchableOpacity>
            <View style={styles.inputDivider} />
            <TouchableOpacity style={styles.locationInput} onPress={() => setDropPin(null)}>
              <Text style={styles.locationLabel}>إلى</Text>
              <Text
                style={[styles.locationValue, !to && styles.locationPlaceholder]}
                numberOfLines={1}
              >
                {to || "اختر وجهتك..."}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* أنواع الرحلات */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ridesScroll}
        >
          {rideTypes.map((ride) => (
            <TouchableOpacity
              key={ride.id}
              style={[styles.rideCard, selectedRide === ride.id && styles.rideCardActive]}
              onPress={() => setSelectedRide(ride.id)}
            >
              <Text style={styles.rideIcon}>{ride.icon}</Text>
              <Text style={[styles.rideLabel, selectedRide === ride.id && styles.rideLabelActive]}>
                {ride.label}
              </Text>
              <Text style={[styles.ridePrice, selectedRide === ride.id && styles.ridePriceActive]}>
                {ride.price} د
              </Text>
              <Text style={styles.rideTime}>{ride.time}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* زر التأكيد */}
        <TouchableOpacity
          style={[styles.confirmBtn, !dropPin && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!dropPin && Platform.OS !== "web"}
        >
          <Text style={styles.confirmText}>
            {dropPin || Platform.OS === "web"
              ? `تأكيد الرحلة — ${selectedType.price} دينار`
              : "حدد وجهتك على الخريطة"}
          </Text>
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
  },
  webMapText: { fontSize: 64, marginBottom: 12 },
  webMapLabel: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  webMapSub: { color: "#9B8EC4", fontSize: 14, marginTop: 4 },
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
  mapHint: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(26,5,51,0.88)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  mapHintText: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  pickupMarker: { alignItems: "center" },
  dropMarker: { alignItems: "center" },
  placeMarker: { alignItems: "center" },
  placeMarkerText: { fontSize: 16 },
  bottomSheet: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#3D2070",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#3D2070",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  locationDots: { alignItems: "center", marginRight: 12, paddingVertical: 4 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#22C55E" },
  dotLine: { width: 2, height: 28, backgroundColor: "#3D2070", marginVertical: 4 },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#EF4444" },
  locationInputs: {
    flex: 1,
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  locationInput: { paddingHorizontal: 14, paddingVertical: 10 },
  inputDivider: { height: 1, backgroundColor: "#3D2070" },
  locationLabel: { color: "#9B8EC4", fontSize: 11, marginBottom: 2 },
  locationValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
  locationPlaceholder: { color: "#6B5B8A" },
  ridesScroll: { paddingBottom: 4, gap: 10, paddingRight: 4 },
  rideCard: {
    backgroundColor: "#2D1B4E",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    minWidth: 90,
    borderWidth: 1.5,
    borderColor: "#3D2070",
  },
  rideCardActive: {
    borderColor: "#FFD700",
    backgroundColor: "#3D2070",
  },
  rideIcon: { fontSize: 28, marginBottom: 4 },
  rideLabel: { color: "#9B8EC4", fontSize: 12, fontWeight: "600", marginBottom: 2 },
  rideLabelActive: { color: "#FFD700" },
  ridePrice: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  ridePriceActive: { color: "#FFD700" },
  rideTime: { color: "#6B5B8A", fontSize: 11, marginTop: 2 },
  confirmBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 14,
  },
  confirmBtnDisabled: { backgroundColor: "#3D2070" },
  confirmText: { color: "#1A0533", fontSize: 15, fontWeight: "bold" },
});

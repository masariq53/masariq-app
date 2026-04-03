import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";

const { height, width } = Dimensions.get("window");

// موقع الموصل — ساحة الحدباء
const MOSUL_CENTER = {
  latitude: 36.3392,
  longitude: 43.1289,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const rideTypes = [
  { id: "economy", icon: "🚗", label: "اقتصادي", desc: "أسرع وصول", capacity: "4" },
  { id: "comfort", icon: "🚙", label: "مريح", desc: "سيارات فاخرة", multiplier: 1.5, capacity: "4" },
  { id: "xl", icon: "🚐", label: "XL", desc: "للمجموعات", multiplier: 2, capacity: "6" },
  { id: "women", icon: "👩", label: "سائقة", desc: "للسيدات فقط", multiplier: 1.2, capacity: "4" },
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
  const { passenger } = usePassenger();
  const [from, setFrom] = useState("موقعي الحالي");
  const [to, setTo] = useState("");
  const [selectedRide, setSelectedRide] = useState("economy");
  const [pickupPin, setPickupPin] = useState({ latitude: 36.3392, longitude: 43.1289 });
  const [dropPin, setDropPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  // Fare estimate query
  const fareQuery = trpc.rides.estimateFare.useQuery(
    {
      pickupLat: pickupPin.latitude,
      pickupLng: pickupPin.longitude,
      dropoffLat: dropPin?.latitude ?? pickupPin.latitude,
      dropoffLng: dropPin?.longitude ?? pickupPin.longitude,
    },
    { enabled: !!dropPin }
  );

  // Request ride mutation
  const requestRide = trpc.rides.request.useMutation({
    onSuccess: (data) => {
      router.push({
        pathname: "/ride/tracking",
        params: {
          rideId: data.ride.id,
          fare: data.ride.fare,
          distance: data.ride.estimatedDistance,
          duration: data.ride.estimatedDuration,
          pickupLat: pickupPin.latitude,
          pickupLng: pickupPin.longitude,
          dropoffLat: dropPin!.latitude,
          dropoffLng: dropPin!.longitude,
          pickupAddress: from,
          dropoffAddress: to,
        },
      });
    },
    onError: (err) => {
      Alert.alert("خطأ", err.message || "فشل في طلب الرحلة، يرجى المحاولة مرة أخرى");
    },
  });

  const handleMapPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setDropPin(coord);
    setTo("الوجهة المحددة");
  };

  const handleConfirm = () => {
    if (!dropPin) {
      Alert.alert("تنبيه", "يرجى تحديد وجهتك على الخريطة");
      return;
    }

    const passengerId = passenger?.id ?? 1; // Use real passenger ID or dev fallback
    const multiplier = rideTypes.find((r) => r.id === selectedRide)?.multiplier ?? 1;
    const baseFare = fareQuery.data?.fare ?? 3000;
    const adjustedFare = Math.round(baseFare * multiplier);

    requestRide.mutate({
      passengerId,
      pickupLat: pickupPin.latitude,
      pickupLng: pickupPin.longitude,
      pickupAddress: from,
      dropoffLat: dropPin.latitude,
      dropoffLng: dropPin.longitude,
      dropoffAddress: to,
      paymentMethod: "cash",
    });
  };

  const getFareDisplay = () => {
    if (!dropPin) return "حدد وجهتك أولاً";
    if (fareQuery.isLoading) return "جاري الحساب...";
    if (!fareQuery.data) return "---";
    const multiplier = rideTypes.find((r) => r.id === selectedRide)?.multiplier ?? 1;
    const fare = Math.round(fareQuery.data.fare * multiplier);
    return `${fare.toLocaleString("ar-IQ")} دينار`;
  };

  const getDistanceDisplay = () => {
    if (!fareQuery.data) return "";
    return `${fareQuery.data.distance} كم • ${fareQuery.data.duration} دقيقة`;
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
        // Web fallback
        <View style={[styles.map, styles.webMap]}>
          <Text style={styles.webMapText}>🗺️</Text>
          <Text style={styles.webMapLabel}>خريطة الموصل</Text>
          <Text style={styles.webMapSub}>36.3392° N, 43.1289° E</Text>
          <TouchableOpacity
            style={styles.webSetDestBtn}
            onPress={() => {
              setDropPin({ latitude: 36.36, longitude: 43.145 });
              setTo("جامعة الموصل");
            }}
          >
            <Text style={styles.webSetDestText}>تحديد وجهة تجريبية</Text>
          </TouchableOpacity>
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

      {/* معلومات المسافة */}
      {dropPin && fareQuery.data && (
        <View style={[styles.distanceBadge, { top: insets.top + 60 }]}>
          <Text style={styles.distanceText}>{getDistanceDisplay()}</Text>
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
            <TouchableOpacity style={styles.locationInput} onPress={() => { setDropPin(null); setTo(""); }}>
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
          {rideTypes.map((ride) => {
            const multiplier = ride.multiplier ?? 1;
            const fare = fareQuery.data ? Math.round(fareQuery.data.fare * multiplier) : null;
            return (
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
                  {fare ? `${fare.toLocaleString("ar-IQ")} د` : "---"}
                </Text>
                <Text style={styles.rideTime}>{ride.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* زر التأكيد */}
        <TouchableOpacity
          style={[styles.confirmBtn, (!dropPin || requestRide.isPending) && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!dropPin || requestRide.isPending}
        >
          {requestRide.isPending ? (
            <ActivityIndicator color="#1A0533" />
          ) : (
            <Text style={styles.confirmText}>
              {dropPin
                ? `تأكيد الرحلة — ${getFareDisplay()}`
                : "حدد وجهتك على الخريطة"}
            </Text>
          )}
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
  webMapText: { fontSize: 64 },
  webMapLabel: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  webMapSub: { color: "#9B8EC4", fontSize: 14 },
  webSetDestBtn: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  webSetDestText: { color: "#1A0533", fontWeight: "700", fontSize: 14 },
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
  distanceBadge: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(26,5,51,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  distanceText: { color: "#4CAF50", fontSize: 12, fontWeight: "600" },
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
    backgroundColor: "#2D1B4E",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  locationDots: { alignItems: "center", gap: 4 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4CAF50" },
  dotLine: { width: 2, height: 20, backgroundColor: "#3D2070" },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  locationInputs: { flex: 1 },
  locationInput: { paddingVertical: 6 },
  locationLabel: { color: "#9B8EC4", fontSize: 11, marginBottom: 2 },
  locationValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  locationPlaceholder: { color: "#6B5A8E" },
  inputDivider: { height: 1, backgroundColor: "#3D2070", marginVertical: 4 },
  ridesScroll: { paddingBottom: 4, gap: 12 },
  rideCard: {
    width: 90,
    backgroundColor: "#2D1B4E",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  rideCardActive: {
    borderColor: "#FFD700",
    backgroundColor: "rgba(255,215,0,0.1)",
  },
  rideIcon: { fontSize: 28, marginBottom: 4 },
  rideLabel: { color: "#C4B5D4", fontSize: 13, fontWeight: "600" },
  rideLabelActive: { color: "#FFD700" },
  ridePrice: { color: "#9B8EC4", fontSize: 12, marginTop: 2 },
  ridePriceActive: { color: "#FFD700", fontWeight: "700" },
  rideTime: { color: "#6B5A8E", fontSize: 10, marginTop: 2, textAlign: "center" },
  confirmBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: "#1A0533", fontSize: 16, fontWeight: "800" },
});

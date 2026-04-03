import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { useLocation } from "@/hooks/use-location";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

// مراحل الرحلة من منظور السائق
// pickup   → السائق في طريقه لموقع الراكب
// arrived  → السائق وصل لموقع الراكب (driver_arrived في DB)
// in_trip  → الرحلة بدأت فعلاً (in_progress في DB)
// done     → الرحلة اكتملت
type TripPhase = "pickup" | "arrived" | "in_trip" | "done";

// خريطة حالة DB → مرحلة محلية
const STATUS_TO_PHASE: Record<string, TripPhase> = {
  accepted: "pickup",
  driver_arrived: "arrived",
  in_progress: "in_trip",
  completed: "done",
};

export default function CaptainActiveTripScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ rideId?: string }>();
  const { driver } = useDriver();
  const { coords } = useLocation();
  const [phase, setPhase] = useState<TripPhase>("pickup");
  const mapRef = useRef<MapView>(null);

  const rideId = params.rideId ? parseInt(params.rideId) : 0;
  const driverId = driver?.id ?? 0;

  // جلب بيانات الرحلة الحقيقية من السيرفر
  const rideQuery = trpc.rides.driverActiveRide.useQuery(
    { driverId },
    {
      enabled: driverId > 0,
      refetchInterval: 8000,
      staleTime: 0,
    }
  );

  const ride = rideQuery.data;

  const pickupCoord = ride
    ? { latitude: ride.pickupLat, longitude: ride.pickupLng }
    : { latitude: 36.3392, longitude: 43.1289 };

  const destCoord = ride
    ? { latitude: ride.dropoffLat, longitude: ride.dropoffLng }
    : { latitude: 36.3600, longitude: 43.1450 };

  // مزامنة المرحلة مع حالة DB
  useEffect(() => {
    if (ride?.status) {
      const mappedPhase = STATUS_TO_PHASE[ride.status];
      if (mappedPhase) setPhase(mappedPhase);
    }
  }, [ride?.status]);

  // تمركز الخريطة على موقع الراكب عند التحميل
  useEffect(() => {
    if (ride && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: ride.pickupLat,
        longitude: ride.pickupLng,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 800);
    }
  }, [ride?.id]);

  const updateStatus = trpc.rides.updateStatus.useMutation();

  // فتح خرائط Google Maps أو Apple Maps للملاحة
  const openNavigation = (targetLat: number, targetLng: number, label: string) => {
    const encodedLabel = encodeURIComponent(label);
    if (Platform.OS === "ios") {
      // iOS: نحاول Waze أولاً ثم Apple Maps
      const wazeUrl = `waze://?ll=${targetLat},${targetLng}&navigate=yes`;
      const appleMapsUrl = `maps://?daddr=${targetLat},${targetLng}&dirflg=d`;
      const googleMapsUrl = `comgooglemaps://?daddr=${targetLat},${targetLng}&directionsmode=driving`;
      
      Linking.canOpenURL(wazeUrl).then((supported) => {
        if (supported) {
          Linking.openURL(wazeUrl);
        } else {
          Linking.canOpenURL(googleMapsUrl).then((gSupported) => {
            if (gSupported) {
              Linking.openURL(googleMapsUrl);
            } else {
              Linking.openURL(appleMapsUrl);
            }
          });
        }
      });
    } else {
      // Android: Google Maps
      const googleMapsUrl = `google.navigation:q=${targetLat},${targetLng}&mode=d`;
      Linking.canOpenURL(googleMapsUrl).then((supported) => {
        if (supported) {
          Linking.openURL(googleMapsUrl);
        } else {
          // Fallback to browser Google Maps
          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`);
        }
      });
    }
  };

  const handlePhaseAction = () => {
    const actualRideId = ride?.id ?? rideId;
    if (!actualRideId) return;

    if (phase === "pickup") {
      // السائق وصل لموقع الراكب
      updateStatus.mutate({ rideId: actualRideId, status: "driver_arrived" });
      setPhase("arrived");
      mapRef.current?.animateToRegion({ ...pickupCoord, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
    } else if (phase === "arrived") {
      // بدأت الرحلة فعلاً
      updateStatus.mutate({ rideId: actualRideId, status: "in_progress" });
      setPhase("in_trip");
      mapRef.current?.animateToRegion({ ...destCoord, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 800);
    } else if (phase === "in_trip") {
      // إنهاء الرحلة
      updateStatus.mutate(
        { rideId: actualRideId, status: "completed" },
        {
          onSuccess: () => {
            router.replace({
              pathname: "/captain/trip-summary" as any,
              params: {
                rideId: actualRideId.toString(),
                fare: ride?.fare?.toString() ?? "0",
                distance: ride?.estimatedDistance?.toString() ?? "0",
                duration: ride?.estimatedDuration?.toString() ?? "0",
                passengerName: ride?.passengerName ?? "الراكب",
                pickupAddress: ride?.pickupAddress ?? "",
                dropoffAddress: ride?.dropoffAddress ?? "",
              },
            });
          },
        }
      );
    }
  };

  const phaseConfig = {
    pickup: {
      title: "في الطريق لاستلام الراكب 🚗",
      subtitle: `توجه إلى: ${ride?.pickupAddress || "موقع الراكب"}`,
      btnText: "وصلت لموقع الراكب ✓",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      navTarget: pickupCoord,
      navLabel: ride?.pickupAddress || "موقع الراكب",
      route: [coords, pickupCoord],
      statusDotColor: "#FFD700",
    },
    arrived: {
      title: "وصلت لموقع الراكب 📍",
      subtitle: "في انتظار الراكب...",
      btnText: "بدء الرحلة ▶",
      btnColor: "#22C55E",
      btnTextColor: "#FFFFFF",
      navTarget: pickupCoord,
      navLabel: ride?.pickupAddress || "موقع الراكب",
      route: [coords, pickupCoord],
      statusDotColor: "#22C55E",
    },
    in_trip: {
      title: "الرحلة جارية 🛣️",
      subtitle: `الوجهة: ${ride?.dropoffAddress || "الوجهة"}`,
      btnText: "إنهاء الرحلة ✓",
      btnColor: "#22C55E",
      btnTextColor: "#FFFFFF",
      navTarget: destCoord,
      navLabel: ride?.dropoffAddress || "الوجهة",
      route: [pickupCoord, destCoord],
      statusDotColor: "#22C55E",
    },
    done: {
      title: "اكتملت الرحلة 🎉",
      subtitle: "شكراً لك!",
      btnText: "العودة للرئيسية",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      navTarget: destCoord,
      navLabel: "",
      route: [pickupCoord, destCoord],
      statusDotColor: "#FFD700",
    },
  };

  const config = phaseConfig[phase];

  if (rideQuery.isLoading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={{ color: "#FFD700", marginTop: 12 }}>جاري تحميل بيانات الرحلة...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* خريطة حقيقية */}
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
          {/* موقع الراكب */}
          <Marker coordinate={pickupCoord} title="موقع الراكب">
            <View style={styles.pickupMarker}>
              <Text style={{ fontSize: 22 }}>👤</Text>
            </View>
          </Marker>

          {/* الوجهة */}
          <Marker coordinate={destCoord} title="الوجهة">
            <View style={styles.destMarker}>
              <Text style={{ fontSize: 22 }}>🏁</Text>
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
        </View>
      )}

      {/* زر الرجوع */}
      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8, left: 16 }]} onPress={() => {
        Alert.alert("تنبيه", "الرحلة لا تزال نشطة. هل تريد الرجوع؟", [
          { text: "لا", style: "cancel" },
          { text: "نعم", onPress: () => router.back() },
        ]);
      }}>
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>

      {/* شريط الحالة */}
      <View style={[styles.statusBar, { top: insets.top + 8 }]}>
        <View style={[styles.statusDot, { backgroundColor: config.statusDotColor }]} />
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
            <Text style={styles.passengerName}>{ride?.passengerName || "الراكب"}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>⭐ {ride?.passengerRating?.toFixed(1) ?? "5.0"}</Text>
              <Text style={styles.subtitleText}>{config.subtitle}</Text>
            </View>
          </View>
          <View style={styles.actionBtns}>
            {/* زر الاتصال */}
            {ride?.passengerPhone && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => Linking.openURL(`tel:${ride.passengerPhone}`)}
              >
                <Text style={styles.actionIcon}>📞</Text>
              </TouchableOpacity>
            )}
            {/* زر الملاحة GPS */}
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: "#FFD700" }]}
              onPress={() => openNavigation(config.navTarget.latitude, config.navTarget.longitude, config.navLabel)}
            >
              <Text style={styles.actionIcon}>🧭</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* تفاصيل المسار */}
        <View style={styles.routeBox}>
          <View style={styles.routeRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.routeText} numberOfLines={1}>{ride?.pickupAddress || "موقع الانطلاق"}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.dotRed} />
            <Text style={styles.routeText} numberOfLines={1}>{ride?.dropoffAddress || "الوجهة"}</Text>
          </View>
        </View>

        {/* الأجرة والمسافة */}
        <View style={styles.fareRow}>
          <Text style={styles.fareItem}>💰 {ride?.fare?.toLocaleString("ar-IQ") ?? "—"} دينار</Text>
          <Text style={styles.fareItem}>📏 {ride?.estimatedDistance?.toFixed(1) ?? "—"} كم</Text>
          <Text style={styles.fareItem}>⏱ {ride?.estimatedDuration ?? "—"} دقيقة</Text>
        </View>

        {/* شريط تقدم المراحل */}
        <View style={styles.stepsRow}>
          {(["pickup", "arrived", "in_trip"] as TripPhase[]).map((p, i) => {
            const labels = ["في الطريق", "وصلت", "الرحلة"];
            const isDone = ["pickup", "arrived", "in_trip"].indexOf(phase) > i;
            const isCurrent = phase === p;
            return (
              <React.Fragment key={p}>
                <View style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    isCurrent && styles.stepDotActive,
                    isDone && styles.stepDotDone,
                  ]} />
                  <Text style={[styles.stepLabel, isCurrent && styles.stepLabelActive]}>{labels[i]}</Text>
                </View>
                {i < 2 && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* زر الإجراء الرئيسي */}
        <TouchableOpacity
          style={[styles.actionMainBtn, { backgroundColor: config.btnColor }]}
          onPress={handlePhaseAction}
          disabled={updateStatus.isPending}
        >
          <Text style={[styles.actionMainBtnText, { color: config.btnTextColor }]}>
            {updateStatus.isPending ? "جاري التحديث..." : config.btnText}
          </Text>
        </TouchableOpacity>

        {/* زر الملاحة الكبير */}
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => openNavigation(config.navTarget.latitude, config.navTarget.longitude, config.navLabel)}
        >
          <Text style={styles.navBtnText}>🧭 فتح الملاحة (Google Maps / Waze)</Text>
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
  backBtn: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(26,5,51,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  backBtnText: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  statusBar: {
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFD700",
  },
  statusTitle: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  pickupMarker: { alignItems: "center" },
  destMarker: { alignItems: "center" },
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
    marginBottom: 14,
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarCircle: {
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
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  ratingText: { color: "#FFD700", fontSize: 13 },
  subtitleText: { color: "#9B8EC4", fontSize: 12 },
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
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeLine: { width: 2, height: 16, backgroundColor: "#3D2070", marginLeft: 5, marginVertical: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  routeText: { color: "#ECEDEE", fontSize: 13, flex: 1 },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  fareItem: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  stepsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3D2070",
    borderWidth: 2,
    borderColor: "#3D2070",
  },
  stepDotActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  stepDotDone: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  stepLabel: { color: "#9B8EC4", fontSize: 10 },
  stepLabelActive: { color: "#FFD700", fontWeight: "bold" },
  stepLine: { flex: 1, height: 2, backgroundColor: "#3D2070", marginBottom: 14, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#22C55E" },
  actionMainBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  actionMainBtnText: { fontSize: 16, fontWeight: "bold" },
  navBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 4,
    backgroundColor: "#2D1B4E",
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  navBtnText: { color: "#9B8EC4", fontSize: 14 },
});

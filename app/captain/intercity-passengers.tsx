import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, Linking,
  RefreshControl, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

// حساب المسافة بين نقطتين (كم)
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PICKUP_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: "في الانتظار", color: "#FFD700", bg: "#3D2B00" },
  picked_up: { label: "تم الالتقاط ✅", color: "#2ECC71", bg: "#0D2B1A" },
  arrived: { label: "وصل 🏁", color: "#9B8EC4", bg: "#2D1B4E" },
};

export default function IntercityPassengersScreen() {
  const router = useRouter();
  const { tripId, tripRoute } = useLocalSearchParams<{ tripId: string; tripRoute: string }>();
  const { driver } = useDriver();
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: passengers, isLoading, refetch } = trpc.intercity.tripPassengers.useQuery(
    { tripId: parseInt(tripId || "0"), driverId: driver?.id || 0 },
    { enabled: !!driver?.id && !!tripId, refetchInterval: 15000 }
  );

  const updateStatus = trpc.intercity.updatePickupStatus.useMutation({
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      refetch();
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const cancelPassenger = trpc.intercity.cancelPassenger.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      refetch();
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const getDriverLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDriverLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {}
  }, []);

  React.useEffect(() => {
    getDriverLocation();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await getDriverLocation();
    await refetch();
    setRefreshing(false);
  }, []);

  const handleCall = (phone: string) => {
    const url = `tel:${phone}`;
    Linking.canOpenURL(url).then((can) => {
      if (can) Linking.openURL(url);
      else Alert.alert("خطأ", "لا يمكن إجراء المكالمة");
    });
  };

  const handleOpenMap = (lat: string, lng: string, name: string) => {
    const url = Platform.OS === "ios"
      ? `maps://?q=${name}&ll=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${name})`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    });
  };

  const handleStatusChange = (bookingId: number, currentStatus: string) => {
    const options: { [key: string]: string } = {
      waiting: "تم الالتقاط",
      picked_up: "وصل",
      arrived: "في الانتظار",
    };
    const nextStatus: { [key: string]: "waiting" | "picked_up" | "arrived" } = {
      waiting: "picked_up",
      picked_up: "arrived",
      arrived: "waiting",
    };
    Alert.alert(
      "تحديث الحالة",
      `تغيير الحالة إلى: ${options[currentStatus] || "في الانتظار"}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تأكيد",
          onPress: () => {
            if (!driver?.id) return;
            updateStatus.mutate({
              bookingId,
              driverId: driver.id,
              pickupStatus: nextStatus[currentStatus] || "waiting",
            });
          },
        },
      ]
    );
  };

  const handleCancelPassenger = (bookingId: number, name: string) => {
    Alert.alert(
      "إلغاء حجز الراكب",
      `هل تريد إلغاء حجز ${name}؟ سيُستعاد مقعده.`,
      [
        { text: "لا", style: "cancel" },
        {
          text: "نعم، إلغاء",
          style: "destructive",
          onPress: () => {
            if (!driver?.id) return;
            cancelPassenger.mutate({ bookingId, driverId: driver.id });
          },
        },
      ]
    );
  };

  const confirmedCount = passengers?.length || 0;
  const pickedUpCount = passengers?.filter((p) => p.pickupStatus === "picked_up" || p.pickupStatus === "arrived").length || 0;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{"<"}</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>قائمة المسافرين</Text>
          {tripRoute ? <Text style={styles.headerRoute}>{tripRoute}</Text> : null}
        </View>
        <View style={styles.headerStats}>
          <Text style={styles.headerStatText}>{pickedUpCount}/{confirmedCount}</Text>
          <Text style={styles.headerStatLabel}>تم الالتقاط</Text>
        </View>
      </View>

      {/* Progress Bar */}
      {confirmedCount > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(pickedUpCount / confirmedCount) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round((pickedUpCount / confirmedCount) * 100)}% تم التجميع</Text>
        </View>
      )}

      {/* Driver Location Status */}
      <TouchableOpacity style={styles.locationBar} onPress={getDriverLocation}>
        <Text style={styles.locationBarText}>
          {driverLocation
            ? `📡 موقعك محدد — اضغط لتحديثه`
            : "📡 اضغط لتحديد موقعك (لحساب المسافات)"}
        </Text>
      </TouchableOpacity>

      {isLoading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : !passengers || passengers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🪑</Text>
          <Text style={styles.emptyTitle}>لا يوجد حجوزات بعد</Text>
          <Text style={styles.emptyDesc}>ستظهر هنا حجوزات المسافرين فور حجزهم</Text>
        </View>
      ) : (
        <FlatList
          data={passengers}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
          renderItem={({ item, index }) => {
            const statusInfo = PICKUP_STATUS_LABELS[item.pickupStatus || "waiting"];
            const distanceKm =
              driverLocation && item.pickupLat && item.pickupLng
                ? calcDistance(
                    driverLocation.lat,
                    driverLocation.lng,
                    parseFloat(item.pickupLat),
                    parseFloat(item.pickupLng)
                  )
                : null;

            return (
              <View style={[styles.passengerCard, item.pickupStatus === "arrived" && styles.passengerCardDone]}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.passengerIndex}>
                    <Text style={styles.passengerIndexText}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passengerName}>{item.passengerName || "مسافر"}</Text>
                    <Text style={styles.passengerPhone}>{item.passengerPhone}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                  </View>
                </View>

                {/* Seats */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>💺</Text>
                  <Text style={styles.infoText}>{item.seatsBooked} مقعد</Text>
                  <Text style={styles.infoSeparator}>•</Text>
                  <Text style={styles.infoText}>{parseInt(item.totalPrice).toLocaleString()} دينار كاش</Text>
                </View>

                {/* Pickup Address */}
                {item.pickupAddress ? (
                  <View style={styles.addressRow}>
                    <Text style={styles.infoIcon}>📍</Text>
                    <Text style={styles.addressText}>{item.pickupAddress}</Text>
                  </View>
                ) : null}

                {/* Distance */}
                {distanceKm !== null ? (
                  <View style={styles.distanceRow}>
                    <Text style={styles.distanceIcon}>📏</Text>
                    <Text style={[styles.distanceText, distanceKm < 1 && styles.distanceClose]}>
                      {distanceKm < 1
                        ? `${Math.round(distanceKm * 1000)} متر منك`
                        : `${distanceKm.toFixed(1)} كم منك`}
                    </Text>
                    {distanceKm < 0.5 && (
                      <View style={styles.nearbyBadge}>
                        <Text style={styles.nearbyBadgeText}>🎯 قريب جداً</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Passenger Note */}
                {item.passengerNote ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>💬 ملاحظة المسافر:</Text>
                    <Text style={styles.noteText}>{item.passengerNote}</Text>
                  </View>
                ) : null}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  {/* Call */}
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => handleCall(item.passengerPhone || "")}
                  >
                    <Text style={styles.callBtnText}>📞 اتصال</Text>
                  </TouchableOpacity>

                  {/* Map */}
                  {item.pickupLat && item.pickupLng ? (
                    <TouchableOpacity
                      style={styles.mapBtn}
                      onPress={() => handleOpenMap(item.pickupLat!, item.pickupLng!, item.passengerName || "مسافر")}
                    >
                      <Text style={styles.mapBtnText}>🗺️ الخريطة</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Status Toggle */}
                  {item.pickupStatus !== "arrived" ? (
                    <TouchableOpacity
                      style={[styles.statusBtn, item.pickupStatus === "picked_up" && styles.statusBtnGreen]}
                      onPress={() => handleStatusChange(item.id, item.pickupStatus || "waiting")}
                      disabled={updateStatus.isPending}
                    >
                      <Text style={styles.statusBtnText}>
                        {item.pickupStatus === "waiting" ? "✅ التقطت" : "🏁 وصل"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Cancel */}
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => handleCancelPassenger(item.id, item.passengerName || "المسافر")}
                  disabled={cancelPassenger.isPending}
                >
                  <Text style={styles.cancelBtnText}>إلغاء الحجز</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1A0533",
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  backBtn: { padding: 8 },
  backIcon: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  headerTitle: { color: "#FFD700", fontSize: 17, fontWeight: "bold" },
  headerRoute: { color: "#9B8EC4", fontSize: 12, marginTop: 2 },
  headerStats: { alignItems: "center" },
  headerStatText: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  headerStatLabel: { color: "#9B8EC4", fontSize: 10 },
  progressContainer: {
    backgroundColor: "#1A0533",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressBar: { flex: 1, height: 6, backgroundColor: "#2D1B4E", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#2ECC71", borderRadius: 3 },
  progressText: { color: "#9B8EC4", fontSize: 11, minWidth: 80 },
  locationBar: {
    backgroundColor: "#0D1B2E",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1B3A5C",
  },
  locationBarText: { color: "#5B9BD5", fontSize: 12, textAlign: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFD700", fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center" },
  passengerCard: {
    backgroundColor: "#1E0A3C",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  passengerCardDone: { opacity: 0.6, borderColor: "#1B4D2E" },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  passengerIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  passengerIndexText: { color: "#1A0533", fontSize: 14, fontWeight: "bold" },
  passengerName: { color: "#E0D0FF", fontSize: 15, fontWeight: "bold" },
  passengerPhone: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "600" },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 },
  infoIcon: { fontSize: 14 },
  infoText: { color: "#C0A8E8", fontSize: 13 },
  infoSeparator: { color: "#3D2B6E", fontSize: 14 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6, gap: 6 },
  addressText: { color: "#C0A8E8", fontSize: 13, flex: 1, lineHeight: 18 },
  distanceRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 },
  distanceIcon: { fontSize: 14 },
  distanceText: { color: "#9B8EC4", fontSize: 13 },
  distanceClose: { color: "#2ECC71", fontWeight: "bold" },
  nearbyBadge: { backgroundColor: "#0D2B1A", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  nearbyBadgeText: { color: "#2ECC71", fontSize: 11 },
  noteBox: { backgroundColor: "#2D1B4E", borderRadius: 8, padding: 10, marginBottom: 10 },
  noteLabel: { color: "#FFD700", fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  noteText: { color: "#C0A8E8", fontSize: 13 },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  callBtn: {
    flex: 1,
    backgroundColor: "#0D2B1A",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2ECC71",
  },
  callBtnText: { color: "#2ECC71", fontSize: 13, fontWeight: "600" },
  mapBtn: {
    flex: 1,
    backgroundColor: "#0D1B2E",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#5B9BD5",
  },
  mapBtnText: { color: "#5B9BD5", fontSize: 13, fontWeight: "600" },
  statusBtn: {
    flex: 1,
    backgroundColor: "#3D2B00",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  statusBtnGreen: { backgroundColor: "#0D2B1A", borderColor: "#2ECC71" },
  statusBtnText: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  cancelBtn: {
    backgroundColor: "transparent",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4D1B1B",
  },
  cancelBtnText: { color: "#FF6B6B", fontSize: 13 },
});

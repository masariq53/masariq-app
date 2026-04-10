import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ar-IQ", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "scheduled": return { text: "مجدولة", color: "#4ADE80" };
    case "in_progress": return { text: "جارية", color: "#FFD700" };
    case "completed": return { text: "مكتملة", color: "#9B8EC4" };
    case "cancelled": return { text: "ملغاة", color: "#F87171" };
    default: return { text: status, color: "#9B8EC4" };
  }
}

export default function CaptainIntercityTripsScreen() {
  const router = useRouter();
  const [driverId, setDriverId] = useState<number | null>(null);
  const [expandedTrip, setExpandedTrip] = useState<number | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem("driverSession").then((raw) => {
      if (raw) {
        try { setDriverId(JSON.parse(raw).id); } catch {}
      }
    });
  }, []);

  const { data: trips, isLoading, refetch } = trpc.intercity.myTrips.useQuery(
    { driverId: driverId! },
    { enabled: !!driverId }
  );

  const cancelTrip = trpc.intercity.cancelTrip.useMutation({
    onSuccess: () => { Alert.alert("تم", "تم إلغاء الرحلة"); refetch(); },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const handleCancel = (tripId: number) => {
    Alert.alert("إلغاء الرحلة", "هل أنت متأكد من إلغاء هذه الرحلة؟", [
      { text: "لا", style: "cancel" },
      { text: "نعم، إلغاء", style: "destructive", onPress: () => cancelTrip.mutate({ tripId, driverId: driverId! }) },
    ]);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>رحلاتي بين المدن</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/captain/intercity-schedule")}
        >
          <Text style={styles.addBtnText}>+ جديدة</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : !trips || trips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛣️</Text>
          <Text style={styles.emptyTitle}>لا توجد رحلات مجدولة</Text>
          <Text style={styles.emptyDesc}>اضغط "+ جديدة" لجدولة رحلتك الأولى بين المدن</Text>
          <TouchableOpacity
            style={styles.scheduleBtn}
            onPress={() => router.push("/captain/intercity-schedule")}
          >
            <Text style={styles.scheduleBtnText}>🚀 جدولة رحلة الآن</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const status = statusLabel(item.status);
            const isExpanded = expandedTrip === item.id;
            return (
              <TouchableOpacity
                style={styles.tripCard}
                onPress={() => setExpandedTrip(isExpanded ? null : item.id)}
                activeOpacity={0.85}
              >
                {/* Route */}
                <View style={styles.routeRow}>
                  <Text style={styles.cityText}>{item.fromCity}</Text>
                  <Text style={styles.arrow}>←</Text>
                  <Text style={styles.cityText}>{item.toCity}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.color + "22", borderColor: status.color }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                  </View>
                </View>

                {/* Info */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>🕐 {formatDate(item.departureTime)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>💺 {item.availableSeats}/{item.totalSeats} مقعد متاح</Text>
                  <Text style={styles.infoText}>💰 {parseInt(item.pricePerSeat).toLocaleString()} د.ع</Text>
                </View>

                {/* Expanded */}
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    {item.meetingPoint ? (
                      <Text style={styles.expandedText}>📌 {item.meetingPoint}</Text>
                    ) : null}
                    {item.notes ? (
                      <Text style={styles.expandedText}>📝 {item.notes}</Text>
                    ) : null}
                    <View style={styles.actionRow}>
                      {item.status === "scheduled" && (
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => handleCancel(item.id)}
                        >
                          <Text style={styles.cancelBtnText}>🚫 إلغاء الرحلة</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
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
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  backBtn: { padding: 8 },
  backIcon: { color: "#FFD700", fontSize: 22 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  addBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: "#1A0533", fontSize: 13, fontWeight: "800" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center", marginBottom: 24 },
  scheduleBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  scheduleBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  tripCard: {
    backgroundColor: "#1E1035",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  cityText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  arrow: { color: "#FFD700", fontSize: 18 },
  statusBadge: {
    marginLeft: "auto",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  infoText: { color: "#9B8EC4", fontSize: 12 },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2D1B4E",
  },
  expandedText: { color: "#FFFFFF", fontSize: 13, marginBottom: 6 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F8717122",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F87171",
  },
  cancelBtnText: { color: "#F87171", fontSize: 13, fontWeight: "700" },
});

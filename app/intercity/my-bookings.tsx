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
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "confirmed": return { text: "مؤكد", color: "#4ADE80" };
    case "pending": return { text: "قيد المراجعة", color: "#FFD700" };
    case "cancelled": return { text: "ملغى", color: "#F87171" };
    default: return { text: status, color: "#9B8EC4" };
  }
}

export default function MyIntercityBookingsScreen() {
  const router = useRouter();
  const [passengerId, setPassengerId] = useState<number | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem("passengerSession").then((raw) => {
      if (raw) {
        try { setPassengerId(JSON.parse(raw).id); } catch {}
      }
    });
  }, []);

  const { data: bookings, isLoading, refetch } = trpc.intercity.myBookings.useQuery(
    { passengerId: passengerId! },
    { enabled: !!passengerId }
  );

  const cancelBooking = trpc.intercity.cancelBooking.useMutation({
    onSuccess: () => { Alert.alert("تم", "تم إلغاء الحجز"); refetch(); },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const handleCancel = (bookingId: number) => {
    Alert.alert("إلغاء الحجز", "هل أنت متأكد من إلغاء هذا الحجز؟", [
      { text: "لا", style: "cancel" },
      {
        text: "نعم، إلغاء",
        style: "destructive",
        onPress: () => cancelBooking.mutate({ bookingId, passengerId: passengerId! }),
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>حجوزاتي بين المدن</Text>
        <View style={{ width: 40 }} />
      </View>

      {!passengerId ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔐</Text>
          <Text style={styles.emptyTitle}>يجب تسجيل الدخول</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/auth/login")}>
            <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : !bookings || bookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🎫</Text>
          <Text style={styles.emptyTitle}>لا توجد حجوزات</Text>
          <Text style={styles.emptyDesc}>ابحث عن رحلة واحجز مقعدك الآن</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace("/intercity")}>
            <Text style={styles.browseBtnText}>🛣️ تصفح الرحلات</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const status = statusLabel(item.status);
            return (
              <View style={styles.bookingCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.bookingId}>حجز #{item.id}</Text>
                  <View style={[styles.statusBadge, { borderColor: status.color, backgroundColor: status.color + "22" }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>المقاعد المحجوزة</Text>
                  <Text style={styles.infoValue}>{item.seatsBooked} مقعد</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>إجمالي السعر</Text>
                  <Text style={[styles.infoValue, { color: "#FFD700" }]}>
                    {parseInt(item.totalPrice).toLocaleString()} دينار (كاش)
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>تاريخ الحجز</Text>
                  <Text style={styles.infoValue}>{formatDate(item.createdAt)}</Text>
                </View>

                {item.status === "confirmed" && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => handleCancel(item.id)}
                    disabled={cancelBooking.isPending}
                  >
                    <Text style={styles.cancelBtnText}>🚫 إلغاء الحجز</Text>
                  </TouchableOpacity>
                )}
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
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  backBtn: { padding: 8 },
  backIcon: { color: "#FFD700", fontSize: 22 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center", marginBottom: 24 },
  loginBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  loginBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  browseBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  browseBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  bookingCard: {
    backgroundColor: "#1E1035",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  bookingId: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  infoLabel: { color: "#9B8EC4", fontSize: 13 },
  infoValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: "#F8717122",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F87171",
  },
  cancelBtnText: { color: "#F87171", fontSize: 13, fontWeight: "700" },
});

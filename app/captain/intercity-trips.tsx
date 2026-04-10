import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, Modal, ScrollView, RefreshControl, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

const STATUS_LABELS: Record<TripStatus, string> = {
  scheduled: "مجدولة",
  in_progress: "جارية 🔴",
  completed: "مكتملة ✅",
  cancelled: "ملغاة",
};

const STATUS_COLORS: Record<TripStatus, string> = {
  scheduled: "#FFD700",
  in_progress: "#22C55E",
  completed: "#60A5FA",
  cancelled: "#F87171",
};

function formatDate(val: string | Date | null | undefined) {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-IQ", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  }) + "  " + d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
}

export default function CaptainIntercityTripsScreen() {
  const router = useRouter();
  const { driver } = useDriver();
  const driverId = driver?.id ?? null;

  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [showBookings, setShowBookings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Cancel reason modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTripId, setCancelTripId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const CANCEL_PRESETS = [
    { label: "🔧 عطل في السيارة", value: "عطل مفاجئ في السيارة" },
    { label: "🚨 ظرف طارئ", value: "ظرف طارئ طارأ لا يسمح بالسفر" },
    { label: "📍 تغيير الخطة", value: "تغيير في خطط السفر" },
    { label: "🌧️ ظروف جوية", value: "ظروف جوية سيئة تمنع السفر" },
    { label: "🏥 ظرف صحي", value: "ظرف صحي طارئ" },
    { label: "✏️ سبب آخر", value: "" },
  ];

  const tripsQuery = trpc.intercity.myTrips.useQuery(
    { driverId: driverId! },
    { enabled: !!driverId, refetchInterval: 15000 }
  );

  const bookingsQuery = trpc.intercity.tripBookings.useQuery(
    { tripId: selectedTripId!, driverId: driverId! },
    { enabled: !!selectedTripId && !!driverId && showBookings }
  );

  const updateStatus = trpc.intercity.updateTripStatus.useMutation({
    onSuccess: () => tripsQuery.refetch(),
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const cancelTrip = trpc.intercity.cancelTrip.useMutation({
    onSuccess: () => {
      tripsQuery.refetch();
      setShowCancelModal(false);
      setCancelReason("");
      setCancelTripId(null);
      Alert.alert("✅", "تم إلغاء الرحلة وإشعار المسافرين");
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await tripsQuery.refetch();
    setRefreshing(false);
  };

  const handleStartTrip = (tripId: number) => {
    Alert.alert("🚗 انطلاق الرحلة", "هل أنت متأكد من بدء الرحلة الآن؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "نعم، انطلق", onPress: () => updateStatus.mutate({ tripId, driverId: driverId!, status: "in_progress" }) },
    ]);
  };

  const handleCompleteTrip = (tripId: number) => {
    Alert.alert("✅ اكتمال الرحلة", "هل وصلتم إلى الوجهة وانتهت الرحلة؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "نعم، اكتملت", onPress: () => updateStatus.mutate({ tripId, driverId: driverId!, status: "completed" }) },
    ]);
  };

  const handleCancelTrip = (tripId: number, status: TripStatus) => {
    if (status === "in_progress") {
      Alert.alert("تنبيه", "لا يمكن إلغاء رحلة جارية. أكمل الرحلة أولاً.");
      return;
    }
    if (status === "completed") {
      Alert.alert("تنبيه", "لا يمكن إلغاء رحلة مكتملة.");
      return;
    }
    // فتح modal إدخال سبب الإلغاء
    setCancelTripId(tripId);
    setCancelReason("");
    setSelectedPreset(null);
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    if (!cancelTripId || !driverId) return;
    const finalReason = cancelReason.trim();
    if (!finalReason) {
      Alert.alert("مطلوب", "يرجى اختيار سبب الإلغاء أو كتابته قبل المتابعة.");
      return;
    }
    cancelTrip.mutate({
      tripId: cancelTripId,
      driverId,
      cancelReason: finalReason,
    });
  };

  const handlePresetSelect = (preset: { label: string; value: string }) => {
    setSelectedPreset(preset.label);
    if (preset.value) {
      setCancelReason(preset.value);
    } else {
      // "سبب آخر" — clear so user types manually
      setCancelReason("");
    }
  };

  if (!driverId) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <Text style={styles.errorText}>يجب تسجيل الدخول كسائق أولاً</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>رحلاتي بين المدن</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/captain/intercity-schedule")}>
          <Text style={styles.addBtnText}>+ جديدة</Text>
        </TouchableOpacity>
      </View>

      {tripsQuery.isLoading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : !tripsQuery.data?.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛣️</Text>
          <Text style={styles.emptyTitle}>لا توجد رحلات مجدولة</Text>
          <Text style={styles.emptyDesc}>اضغط "+ جديدة" لجدولة رحلتك الأولى</Text>
          <TouchableOpacity style={styles.scheduleBtn} onPress={() => router.push("/captain/intercity-schedule")}>
            <Text style={styles.scheduleBtnText}>🚀 جدولة رحلة الآن</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tripsQuery.data}
          keyExtractor={(item: any) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFD700" />}
          renderItem={({ item }: { item: any }) => {
            const status = item.status as TripStatus;
            const bookedSeats = item.totalSeats - item.availableSeats;
            return (
              <View style={styles.tripCard}>
                {/* Status */}
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] + "22", borderColor: STATUS_COLORS[status] }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>{STATUS_LABELS[status]}</Text>
                </View>

                {/* Route */}
                <Text style={styles.route}>{item.fromCity}  →  {item.toCity}</Text>

                {/* Details */}
                <Text style={styles.detail}>🕐 {formatDate(item.departureTime)}</Text>
                <Text style={styles.detail}>💺 {item.availableSeats}/{item.totalSeats} مقعد متاح</Text>
                <Text style={styles.detail}>💰 {parseInt(item.pricePerSeat).toLocaleString()} دينار/مقعد</Text>
                {item.meetingPoint ? <Text style={styles.detail}>📌 {item.meetingPoint}</Text> : null}
                {item.notes ? <Text style={styles.notes}>📝 {item.notes}</Text> : null}

                {/* Cancel reason — if cancelled by driver */}
                {status === "cancelled" && item.cancelledBy === "driver" && item.cancelReason ? (
                  <View style={styles.cancelReasonBox}>
                    <Text style={styles.cancelReasonLabel}>سبب الإلغاء:</Text>
                    <Text style={styles.cancelReasonText}>{item.cancelReason}</Text>
                  </View>
                ) : null}

                {/* Bookings Button */}
                <TouchableOpacity
                  style={styles.bookingsBtn}
                  onPress={() => router.push({
                    pathname: "/captain/intercity-passengers",
                    params: { tripId: item.id.toString(), tripRoute: `${item.fromCity} ← ${item.toCity}` }
                  })}
                >
                  <Text style={styles.bookingsBtnText}>👥 قائمة المسافرين ({bookedSeats} حجز)</Text>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  {status === "scheduled" && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.startBtn]}
                        onPress={() => handleStartTrip(item.id)}
                        disabled={updateStatus.isPending}
                      >
                        <Text style={styles.actionBtnText}>🚗 انطلق</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.cancelBtnStyle]}
                        onPress={() => handleCancelTrip(item.id, status)}
                        disabled={cancelTrip.isPending}
                      >
                        <Text style={styles.cancelBtnText}>❌ إلغاء</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {status === "in_progress" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.completeBtn]}
                      onPress={() => handleCompleteTrip(item.id)}
                      disabled={updateStatus.isPending}
                    >
                      <Text style={styles.actionBtnText}>✅ اكتملت الرحلة</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Cancel Reason Modal */}
      <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setShowCancelModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
          <View style={styles.cancelModal}>
            <Text style={styles.cancelModalTitle}>❌ إلغاء الرحلة</Text>
            <Text style={styles.cancelModalDesc}>
              سيتم إشعار جميع المسافرين بإلغاء الرحلة. اختر سبباً أو اكتبه:
            </Text>

            {/* Preset reasons */}
            <View style={styles.presetsGrid}>
              {CANCEL_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[
                    styles.presetChip,
                    selectedPreset === preset.label && styles.presetChipActive,
                  ]}
                  onPress={() => handlePresetSelect(preset)}
                >
                  <Text style={[
                    styles.presetChipText,
                    selectedPreset === preset.label && styles.presetChipTextActive,
                  ]}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom text input — shown always for editing */}
            <TextInput
              style={styles.cancelReasonInput}
              placeholder="أضف تفاصيل إضافية أو اكتب سبباً آخر..."
              placeholderTextColor="#6B7280"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{cancelReason.length}/200</Text>
            <View style={styles.cancelModalActions}>
              <TouchableOpacity
                style={styles.cancelModalDismiss}
                onPress={() => { setShowCancelModal(false); setCancelReason(""); setCancelTripId(null); setSelectedPreset(null); }}
              >
                <Text style={styles.cancelModalDismissText}>تراجع</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cancelModalConfirm, cancelTrip.isPending && { opacity: 0.6 }]}
                onPress={confirmCancel}
                disabled={cancelTrip.isPending}
              >
                {cancelTrip.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.cancelModalConfirmText}>تأكيد الإلغاء</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Bookings Modal */}
      <Modal visible={showBookings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bookingsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>قائمة المسافرين</Text>
              <TouchableOpacity onPress={() => setShowBookings(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {bookingsQuery.isLoading ? (
              <ActivityIndicator color="#FFD700" style={{ margin: 20 }} />
            ) : !bookingsQuery.data?.length ? (
              <Text style={styles.noBookings}>لا توجد حجوزات على هذه الرحلة</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {(bookingsQuery.data as any[]).map((b, i) => (
                  <View key={b.id} style={styles.bookingItem}>
                    <Text style={styles.bookingNum}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bookingName}>{b.passengerName || "مسافر"}</Text>
                      <Text style={styles.bookingPhone}>📞 {b.passengerPhone}</Text>
                      {b.pickupAddress ? <Text style={styles.bookingPickup}>📍 {b.pickupAddress}</Text> : null}
                      <Text style={styles.bookingSeats}>💺 {b.seatsBooked} مقعد</Text>
                    </View>
                    <Text style={styles.bookingPrice}>{parseInt(b.totalPrice).toLocaleString()}{"\n"}دينار</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#EF4444", fontSize: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: "#2D1B4E" },
  backBtn: { padding: 8 },
  backIcon: { color: "#FFD700", fontSize: 22 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  addBtn: { backgroundColor: "#FFD700", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: "#1A0533", fontSize: 13, fontWeight: "800" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center", marginBottom: 24 },
  scheduleBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  scheduleBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  tripCard: { backgroundColor: "#1E1035", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#2D1B4E" },
  statusBadge: { alignSelf: "flex-start", borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  statusText: { fontSize: 12, fontWeight: "700" },
  route: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  detail: { color: "#C4B5E0", fontSize: 13, marginBottom: 4 },
  notes: { color: "#9B8EC4", fontSize: 12, marginTop: 4, fontStyle: "italic" },
  cancelReasonBox: { backgroundColor: "#2D0A0A", borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: "#EF444433" },
  cancelReasonLabel: { color: "#F87171", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  cancelReasonText: { color: "#FCA5A5", fontSize: 13 },
  bookingsBtn: { backgroundColor: "#2D1B4E", borderRadius: 10, padding: 10, alignItems: "center", marginTop: 10, marginBottom: 8 },
  bookingsBtnText: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  startBtn: { backgroundColor: "#22C55E" },
  completeBtn: { backgroundColor: "#60A5FA" },
  cancelBtnStyle: { backgroundColor: "#2D1B4E", borderWidth: 1, borderColor: "#EF4444" },
  actionBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  cancelBtnText: { color: "#EF4444", fontSize: 14, fontWeight: "700" },
  // Cancel reason modal
  cancelModal: { backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  cancelModalTitle: { color: "#F87171", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  cancelModalDesc: { color: "#C4B5E0", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 16 },
  cancelReasonInput: {
    backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14,
    color: "#FFFFFF", fontSize: 14, borderWidth: 1, borderColor: "#4B3B8C",
    minHeight: 90, textAlign: "right",
  },
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  presetChip: {
    backgroundColor: "#2D1B4E", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "#4B3B8C",
  },
  presetChipActive: { backgroundColor: "#EF444422", borderColor: "#EF4444" },
  presetChipText: { color: "#C4B5E0", fontSize: 12, fontWeight: "600" },
  presetChipTextActive: { color: "#F87171", fontWeight: "800" },
  charCount: { color: "#6B7280", fontSize: 11, textAlign: "left", marginTop: 4, marginBottom: 16 },
  cancelModalActions: { flexDirection: "row", gap: 12 },
  cancelModalDismiss: { flex: 1, backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#4B3B8C" },
  cancelModalDismissText: { color: "#C4B5E0", fontSize: 14, fontWeight: "700" },
  cancelModalConfirm: { flex: 1, backgroundColor: "#EF4444", borderRadius: 12, padding: 14, alignItems: "center" },
  cancelModalConfirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  // Bookings modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  bookingsModal: { backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { color: "#FFD700", fontSize: 18, fontWeight: "700" },
  modalClose: { color: "#9B8EC4", fontSize: 20, padding: 4 },
  noBookings: { color: "#9B8EC4", textAlign: "center", padding: 20, fontSize: 14 },
  bookingItem: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#2D1B4E", borderRadius: 12, padding: 12, marginBottom: 8 },
  bookingNum: { color: "#FFD700", fontWeight: "800", fontSize: 16, width: 24, textAlign: "center" },
  bookingName: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  bookingPhone: { color: "#9B8EC4", fontSize: 12, marginTop: 2 },
  bookingPickup: { color: "#60A5FA", fontSize: 12, marginTop: 2 },
  bookingSeats: { color: "#C4B5E0", fontSize: 12, marginTop: 2 },
  bookingPrice: { color: "#22C55E", fontWeight: "800", fontSize: 12, textAlign: "center" },
});

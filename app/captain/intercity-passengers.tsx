"use client";
import { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, Linking,
  RefreshControl, Platform, Modal, TextInput, ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

const CANCEL_PRESETS = [
  { label: "⚠️ ظرف طارئ" },
  { label: "🚗 عطل في السيارة" },
  { label: "🌧️ ظروف جوية" },
  { label: "🏥 ظرف صحي" },
  { label: "📋 تغيير الخطة" },
  { label: "✏️ سبب آخر" },
];

// حالة التوجه لكل راكب
type ApproachStatus = "idle" | "heading" | "arrived_at_pickup";

export default function IntercityPassengersScreen() {
  const router = useRouter();
  const { tripId, tripRoute } = useLocalSearchParams<{ tripId: string; tripRoute: string }>();
  const { driver } = useDriver();
  const [refreshing, setRefreshing] = useState(false);

  // حالة التوجه لكل راكب (bookingId → status)
  const [approachStatuses, setApproachStatuses] = useState<Record<number, ApproachStatus>>({});

  // Cancel passenger modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<number | null>(null);
  const [cancelPassengerName, setCancelPassengerName] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const { data: passengers, isLoading, refetch } = trpc.intercity.tripPassengers.useQuery(
    { tripId: parseInt(tripId || "0"), driverId: driver?.id || 0 },
    { enabled: !!driver?.id && !!tripId, refetchInterval: 8000 }
  );

  const cancelPassenger = trpc.intercity.cancelPassenger.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowCancelModal(false);
      setCancelBookingId(null);
      setCancelReason("");
      setSelectedPreset(null);
      refetch();
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const updateApproach = trpc.intercity.updateApproachStatus.useMutation({
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
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

  const handleHeadingToPassenger = (bookingId: number, passengerName: string) => {
    if (!driver?.id) return;
    Alert.alert(
      "🧭 التوجه إلى الراكب",
      `هل تريد إشعار ${passengerName} بأنك في طريقك إليه؟`,
      [
        { text: "تراجع", style: "cancel" },
        {
          text: "نعم، أبلغه",
          onPress: () => {
            setApproachStatuses((prev) => ({ ...prev, [bookingId]: "heading" }));
            updateApproach.mutate({
              bookingId,
              driverId: driver.id,
              status: "heading",
            });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const handleArrivedAtPickup = (bookingId: number, passengerName: string, phone: string) => {
    if (!driver?.id) return;
    Alert.alert(
      "📍 وصلت إلى موقع الراكب",
      `هل وصلت إلى موقع ${passengerName}؟ سيظهر لك رقمه بعد التأكيد.`,
      [
        { text: "تراجع", style: "cancel" },
        {
          text: "نعم، وصلت",
          onPress: () => {
            setApproachStatuses((prev) => ({ ...prev, [bookingId]: "arrived_at_pickup" }));
            updateApproach.mutate({
              bookingId,
              driverId: driver.id,
              status: "arrived_at_pickup",
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // عرض رقم الراكب فوراً
            setTimeout(() => {
              Alert.alert(
                "📞 رقم الراكب",
                `${passengerName}\n${phone}`,
                [
                  { text: "اتصال الآن", onPress: () => handleCall(phone) },
                  { text: "إغلاق", style: "cancel" },
                ]
              );
            }, 500);
          },
        },
      ]
    );
  };

  const openCancelModal = (bookingId: number, name: string) => {
    setCancelBookingId(bookingId);
    setCancelPassengerName(name);
    setCancelReason("");
    setSelectedPreset(null);
    setShowCancelModal(true);
  };

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== "✏️ سبب آخر") {
      setCancelReason(preset.replace(/^[^\s]+ /, ""));
    } else {
      setCancelReason("");
    }
  };

  const confirmCancelPassenger = () => {
    const reason = cancelReason.trim();
    if (!reason) {
      Alert.alert("مطلوب", "يرجى اختيار سبب الإلغاء أو كتابته");
      return;
    }
    if (!driver?.id || !cancelBookingId) return;
    cancelPassenger.mutate({
      bookingId: cancelBookingId,
      driverId: driver.id,
      reason,
    });
  };

  const getApproachStatus = (bookingId: number): ApproachStatus => {
    return approachStatuses[bookingId] || "idle";
  };

  const confirmedPassengers = passengers?.filter((p) => p.status !== "cancelled") || [];
  const cancelledPassengers = passengers?.filter((p) => p.status === "cancelled") || [];

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
          <Text style={styles.headerStatText}>{confirmedPassengers.length}</Text>
          <Text style={styles.headerStatLabel}>مسافر</Text>
        </View>
      </View>

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
          data={[...confirmedPassengers, ...cancelledPassengers]}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
          renderItem={({ item, index }) => {
            const isCancelled = item.status === "cancelled";
            const approachStatus = getApproachStatus(item.id);
            const isHeading = approachStatus === "heading";
            const isArrivedAtPickup = approachStatus === "arrived_at_pickup";

            return (
              <View style={[styles.passengerCard, isCancelled && styles.cancelledCard]}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.passengerIndex, isCancelled && { backgroundColor: "#4D1B1B" }]}>
                    <Text style={[styles.passengerIndexText, isCancelled && { color: "#FF6B6B" }]}>
                      {isCancelled ? "✕" : index + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.passengerName}>{item.passengerName || "مسافر"}</Text>
                    {/* رقم الهاتف يظهر فقط بعد الوصول */}
                    {isArrivedAtPickup ? (
                      <Text style={styles.passengerPhone}>{item.passengerPhone}</Text>
                    ) : (
                      <Text style={styles.phoneHidden}>🔒 يظهر عند الوصول</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, isCancelled && styles.cancelledBadge]}>
                    <Text style={[styles.statusText, isCancelled && styles.cancelledStatusText]}>
                      {isCancelled ? "❌ ملغي" : isArrivedAtPickup ? "📍 وصلت" : isHeading ? "🧭 في الطريق" : "✅ مؤكد"}
                    </Text>
                  </View>
                </View>

                {/* Seats & Price */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>💺</Text>
                  <Text style={styles.infoText}>{item.seatsBooked} مقعد</Text>
                  <Text style={styles.infoSeparator}>•</Text>
                  <Text style={styles.infoText}>{parseInt(item.totalPrice).toLocaleString()} دينار</Text>
                </View>

                {/* Pickup Address */}
                {item.pickupAddress ? (
                  <View style={styles.addressRow}>
                    <Text style={styles.infoIcon}>📍</Text>
                    <Text style={styles.addressText}>{item.pickupAddress}</Text>
                  </View>
                ) : null}

                {/* Passenger Note */}
                {item.passengerNote ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>💬 ملاحظة المسافر:</Text>
                    <Text style={styles.noteText}>{item.passengerNote}</Text>
                  </View>
                ) : null}

                {/* Cancellation reason if cancelled */}
                {isCancelled && item.cancelReason ? (
                  <View style={styles.cancelReasonBox}>
                    <Text style={styles.cancelReasonLabel}>سبب الإلغاء:</Text>
                    <Text style={styles.cancelReasonText}>{item.cancelReason}</Text>
                  </View>
                ) : null}

                {/* Actions - only for active passengers */}
                {!isCancelled && (
                  <>
                    {/* Approach Status Buttons */}
                    <View style={styles.approachRow}>
                      {/* زر التوجه */}
                      {!isHeading && !isArrivedAtPickup && (
                        <TouchableOpacity
                          style={styles.headingBtn}
                          onPress={() => handleHeadingToPassenger(item.id, item.passengerName || "الراكب")}
                          disabled={updateApproach.isPending}
                        >
                          <Text style={styles.headingBtnText}>🧭 التوجه إليه</Text>
                        </TouchableOpacity>
                      )}

                      {/* زر وصلت - يظهر فقط بعد التوجه */}
                      {isHeading && !isArrivedAtPickup && (
                        <TouchableOpacity
                          style={styles.arrivedBtn}
                          onPress={() => handleArrivedAtPickup(item.id, item.passengerName || "الراكب", item.passengerPhone || "")}
                          disabled={updateApproach.isPending}
                        >
                          <Text style={styles.arrivedBtnText}>📍 وصلت إلى موقعه</Text>
                        </TouchableOpacity>
                      )}

                      {/* حالة الوصول */}
                      {isArrivedAtPickup && (
                        <View style={styles.arrivedConfirmed}>
                          <Text style={styles.arrivedConfirmedText}>✅ وصلت — الرقم مكشوف</Text>
                        </View>
                      )}
                    </View>

                    {/* Secondary Actions */}
                    <View style={styles.actionsRow}>
                      {/* الاتصال يظهر فقط بعد الوصول */}
                      {isArrivedAtPickup && (
                        <TouchableOpacity
                          style={styles.callBtn}
                          onPress={() => handleCall(item.passengerPhone || "")}
                        >
                          <Text style={styles.callBtnText}>📞 اتصال</Text>
                        </TouchableOpacity>
                      )}

                      {item.pickupLat && item.pickupLng ? (
                        <TouchableOpacity
                          style={[styles.mapBtn, !isArrivedAtPickup && { flex: 1 }]}
                          onPress={() => handleOpenMap(item.pickupLat!, item.pickupLng!, item.passengerName || "مسافر")}
                        >
                          <Text style={styles.mapBtnText}>🗺️ موقع الراكب</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Cancel */}
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => openCancelModal(item.id, item.passengerName || "المسافر")}
                      disabled={cancelPassenger.isPending}
                    >
                      <Text style={styles.cancelBtnText}>إلغاء حجز هذا الراكب</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Cancel Passenger Modal */}
      <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setShowCancelModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
            <View style={styles.cancelModal}>
              <Text style={styles.cancelModalTitle}>إلغاء حجز {cancelPassengerName}</Text>
              <Text style={styles.cancelModalDesc}>
                سيتم إشعار المسافر بإلغاء حجزه واسترداد مقعده. اختر سبباً:
              </Text>

              {/* Preset reasons */}
              <View style={styles.presetsGrid}>
                {CANCEL_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.presetChip, selectedPreset === preset.label && styles.presetChipActive]}
                    onPress={() => handlePresetSelect(preset.label)}
                  >
                    <Text style={[styles.presetChipText, selectedPreset === preset.label && styles.presetChipTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom text input */}
              <TextInput
                style={styles.cancelReasonInput}
                placeholder="أضف تفاصيل أو اكتب سبباً آخر..."
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
                  onPress={() => { setShowCancelModal(false); setCancelReason(""); setSelectedPreset(null); }}
                >
                  <Text style={styles.cancelModalDismissText}>تراجع</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelModalConfirm, cancelPassenger.isPending && { opacity: 0.6 }]}
                  onPress={confirmCancelPassenger}
                  disabled={cancelPassenger.isPending}
                >
                  {cancelPassenger.isPending ? (
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
  cancelledCard: {
    backgroundColor: "#1A0808",
    borderColor: "#4D1B1B",
    opacity: 0.75,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 },
  passengerIndex: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
  },
  passengerIndexText: { color: "#1A0533", fontSize: 14, fontWeight: "bold" },
  passengerName: { color: "#E0D0FF", fontSize: 15, fontWeight: "bold" },
  passengerPhone: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
  phoneHidden: { color: "#4B3B8C", fontSize: 12, marginTop: 2, fontStyle: "italic" },
  statusBadge: { backgroundColor: "#0D2B1A", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: "#2ECC71", fontSize: 12, fontWeight: "600" },
  cancelledBadge: { backgroundColor: "#2B0D0D" },
  cancelledStatusText: { color: "#FF6B6B" },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 },
  infoIcon: { fontSize: 14 },
  infoText: { color: "#C0A8E8", fontSize: 13 },
  infoSeparator: { color: "#3D2B6E", fontSize: 14 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6, gap: 6 },
  addressText: { color: "#C0A8E8", fontSize: 13, flex: 1, lineHeight: 18 },
  noteBox: { backgroundColor: "#2D1B4E", borderRadius: 8, padding: 10, marginBottom: 10 },
  noteLabel: { color: "#FFD700", fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  noteText: { color: "#C0A8E8", fontSize: 13 },
  cancelReasonBox: { backgroundColor: "#2B0D0D", borderRadius: 8, padding: 10, marginBottom: 6 },
  cancelReasonLabel: { color: "#FF6B6B", fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  cancelReasonText: { color: "#FFAAAA", fontSize: 13 },
  // Approach buttons
  approachRow: { marginBottom: 8 },
  headingBtn: {
    backgroundColor: "#1A2B4E", borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
    borderWidth: 1.5, borderColor: "#5B9BD5",
  },
  headingBtnText: { color: "#5B9BD5", fontSize: 14, fontWeight: "700" },
  arrivedBtn: {
    backgroundColor: "#1A3B2E", borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
    borderWidth: 1.5, borderColor: "#2ECC71",
  },
  arrivedBtnText: { color: "#2ECC71", fontSize: 14, fontWeight: "700" },
  arrivedConfirmed: {
    backgroundColor: "#0D2B1A", borderRadius: 12,
    paddingVertical: 10, alignItems: "center",
    borderWidth: 1, borderColor: "#2ECC71",
  },
  arrivedConfirmedText: { color: "#2ECC71", fontSize: 13, fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  callBtn: {
    flex: 1, backgroundColor: "#0D2B1A", borderRadius: 10,
    paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#2ECC71",
  },
  callBtnText: { color: "#2ECC71", fontSize: 13, fontWeight: "600" },
  mapBtn: {
    flex: 1, backgroundColor: "#0D1B2E", borderRadius: 10,
    paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#5B9BD5",
  },
  mapBtnText: { color: "#5B9BD5", fontSize: 13, fontWeight: "600" },
  cancelBtn: {
    backgroundColor: "transparent", borderRadius: 10,
    paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#4D1B1B",
  },
  cancelBtnText: { color: "#FF6B6B", fontSize: 13 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA" },
  cancelModal: {
    backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  cancelModalTitle: { color: "#F87171", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  cancelModalDesc: { color: "#C4B5E0", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  presetsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  presetChip: {
    backgroundColor: "#2D1B4E", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: "#4B3B8C",
  },
  presetChipActive: { backgroundColor: "#EF444422", borderColor: "#EF4444" },
  presetChipText: { color: "#C4B5E0", fontSize: 12, fontWeight: "600" },
  presetChipTextActive: { color: "#F87171", fontWeight: "800" },
  cancelReasonInput: {
    backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14,
    color: "#FFFFFF", fontSize: 14, borderWidth: 1, borderColor: "#4B3B8C",
    minHeight: 80, textAlign: "right",
  },
  charCount: { color: "#6B7280", fontSize: 11, textAlign: "left", marginTop: 4, marginBottom: 16 },
  cancelModalActions: { flexDirection: "row", gap: 12 },
  cancelModalDismiss: {
    flex: 1, backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#4B3B8C",
  },
  cancelModalDismissText: { color: "#C4B5E0", fontSize: 14, fontWeight: "700" },
  cancelModalConfirm: { flex: 1, backgroundColor: "#EF4444", borderRadius: 12, padding: 14, alignItems: "center" },
  cancelModalConfirmText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});

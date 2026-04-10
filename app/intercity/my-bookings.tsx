import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, Modal,
  RefreshControl, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";

type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

const STATUS_LABELS: Record<TripStatus, string> = {
  scheduled: "مجدولة",
  in_progress: "جارية الآن",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const STATUS_COLORS: Record<TripStatus, string> = {
  scheduled: "#FFD700",
  in_progress: "#22C55E",
  completed: "#60A5FA",
  cancelled: "#F87171",
};

const STATUS_ICONS: Record<TripStatus, string> = {
  scheduled: "🕐",
  in_progress: "🚗",
  completed: "✅",
  cancelled: "❌",
};

function formatDate(val: string | Date | null | undefined) {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("ar-IQ", { weekday: "long", month: "short", day: "numeric" }) +
    "  " +
    d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function MyIntercityBookingsScreen() {
  const router = useRouter();
  const [passenger, setPassenger] = useState<{ id: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingModal, setRatingModal] = useState<{ bookingId: number; tripId: number } | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);

  React.useEffect(() => {
    AsyncStorage.getItem("@masar_passenger").then((raw) => {
      if (raw) {
        try { setPassenger(JSON.parse(raw)); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const bookingsQuery = trpc.intercity.myBookingsEnriched.useQuery(
    { passengerId: passenger?.id ?? 0 },
    { enabled: !!passenger?.id, refetchInterval: 20000 }
  );

  const cancelBooking = trpc.intercity.cancelBooking.useMutation({
    onSuccess: () => {
      bookingsQuery.refetch();
      Alert.alert("تم", "تم إلغاء الحجز بنجاح");
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const rateTrip = trpc.intercity.rateTrip.useMutation({
    onSuccess: () => {
      setRatingModal(null);
      bookingsQuery.refetch();
      Alert.alert("شكراً", "تم إرسال تقييمك");
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await bookingsQuery.refetch();
    setRefreshing(false);
  };

  const handleCancel = (bookingId: number, tripStatus: TripStatus) => {
    if (tripStatus === "in_progress" || tripStatus === "completed") {
      Alert.alert("تنبيه", "لا يمكن إلغاء الحجز بعد انطلاق الرحلة");
      return;
    }
    Alert.alert("إلغاء الحجز", "هل أنت متأكد من إلغاء هذا الحجز؟", [
      { text: "لا", style: "cancel" },
      {
        text: "نعم، ألغِ",
        style: "destructive",
        onPress: () => cancelBooking.mutate({ bookingId, passengerId: passenger!.id }),
      },
    ]);
  };

  const callDriver = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert("خطأ", "لا يمكن فتح تطبيق الهاتف")
    );
  };

  const handleRate = (bookingId: number, tripId: number) => {
    setSelectedRating(5);
    setRatingModal({ bookingId, tripId });
  };

  if (!loaded) {
    return (
      <ScreenContainer>
        <ActivityIndicator color="#FFD700" style={{ marginTop: 60 }} />
      </ScreenContainer>
    );
  }

  if (!passenger) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>حجوزاتي بين المدن</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🔐</Text>
          <Text style={styles.emptyTitle}>يجب تسجيل الدخول</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/auth/login")}>
            <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>حجوزاتي بين المدن</Text>
        <View style={{ width: 40 }} />
      </View>

      {bookingsQuery.isLoading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : !bookingsQuery.data?.length ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🎫</Text>
          <Text style={styles.emptyTitle}>لا توجد حجوزات</Text>
          <Text style={styles.emptyDesc}>احجز رحلتك الأولى بين المدن</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push("/intercity")}>
            <Text style={styles.browseBtnText}>تصفح الرحلات</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookingsQuery.data as any[]}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFD700" />
          }
          renderItem={({ item }) => {
            const trip = item.trip;
            const driver = item.driver;
            // حالة الحجز الفعلية (قد تختلف عن حالة الرحلة إذا ألغى الكابتن هذا الراكب تحديداً)
            const bookingStatus = item.status as "pending" | "confirmed" | "cancelled" | "completed";
            const tripStatus = (trip?.status || "scheduled") as TripStatus;
            // إذا كان الحجز ملغى أو الرحلة ملغاة → اعرض ملغى
            const isBookingCancelled = bookingStatus === "cancelled";
            const isTripCancelled = tripStatus === "cancelled";
            const displayStatus: TripStatus = isBookingCancelled || isTripCancelled ? "cancelled" : tripStatus;
            // هل ألغى الكابتن هذا الراكب تحديداً (item.cancelledBy يبدأ بـ driver:)
            const cancelledByDriverReason = isBookingCancelled && typeof item.cancelledBy === "string" && item.cancelledBy.startsWith("driver:")
              ? item.cancelledBy.replace("driver:", "")
              : null;
            // هل ألغيت الرحلة بالكامل من قبل السائق
            const tripCancelledByDriver = isTripCancelled && (trip?.cancelledBy === "driver" || trip?.cancelReason);
            const fromCity = trip?.fromCity ?? "—";
            const toCity = trip?.toCity ?? "—";
            const departureTime = trip?.departureTime ?? null;
            const canCancel = !isBookingCancelled && !isTripCancelled && tripStatus === "scheduled";

            return (
              <View style={styles.bookingCard}>
                {/* Status Badge */}
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[displayStatus] + "22", borderColor: STATUS_COLORS[displayStatus] },
                  ]}
                >
                  <Text style={[styles.statusText, { color: STATUS_COLORS[displayStatus] }]}>
                    {STATUS_ICONS[displayStatus]} {STATUS_LABELS[displayStatus]}
                  </Text>
                </View>

                {/* Route */}
                <Text style={styles.route}>
                  {fromCity} {"→"} {toCity}
                </Text>
                <Text style={styles.detail}>🕐 {formatDate(departureTime)}</Text>
                <Text style={styles.detail}>💺 {item.seatsBooked} مقعد</Text>
                <Text style={styles.detail}>💰 {parseInt(item.totalPrice ?? "0").toLocaleString()} دينار (كاش)</Text>
                {item.pickupAddress ? (
                  <Text style={styles.detail}>📍 موقع استلامك: {item.pickupAddress}</Text>
                ) : null}
                {trip?.meetingPoint ? (
                  <Text style={styles.detail}>📌 نقطة التجمع: {trip.meetingPoint}</Text>
                ) : null}
                {item.passengerNote ? (
                  <Text style={styles.detail}>📝 ملاحظتك: {item.passengerNote}</Text>
                ) : null}

                {/* Captain Info — يظهر دائماً بعد الحجز */}
                {driver ? (
                  <View style={styles.captainBox}>
                    <Text style={styles.captainTitle}>👨‍✈️ معلومات السائق</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={styles.captainDetail}>👤 {driver.name}</Text>
                      {driver.rating ? (
                        <Text style={{ color: "#FFD700", fontWeight: "bold" }}>⭐ {parseFloat(driver.rating).toFixed(1)}</Text>
                      ) : null}
                    </View>
                    {driver.vehicleModel ? (
                      <Text style={styles.captainDetail}>🚗 {driver.vehicleModel}{driver.vehicleColor ? ` (${driver.vehicleColor})` : ""}</Text>
                    ) : null}
                    {driver.vehiclePlate ? (
                      <Text style={styles.captainDetail}>🔢 {driver.vehiclePlate}</Text>
                    ) : null}
                    {driver.phone ? (
                      <TouchableOpacity
                        style={styles.callBtn}
                        onPress={() => callDriver(driver.phone)}
                      >
                        <Text style={styles.callBtnText}>📞 اتصل بالسائق</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}

                {/* Driver notes */}
                {trip?.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>📋 ملاحظات السائق:</Text>
                    <Text style={styles.notesText}>{trip.notes}</Text>
                  </View>
                ) : null}

                {/* Cancel reason — shown when booking cancelled by driver for this specific passenger */}
                {cancelledByDriverReason ? (
                  <View style={styles.cancelledByDriverBox}>
                    <Text style={styles.cancelledByDriverTitle}>❌ تم إلغاء حجزك من قبل السائق</Text>
                    <Text style={styles.cancelledByDriverReasonLabel}>سبب الإلغاء:</Text>
                    <Text style={styles.cancelledByDriverReason}>{cancelledByDriverReason}</Text>
                    <Text style={styles.cancelledByDriverNote}>يمكنك تصفح رحلات أخرى وحجز بديلاً.</Text>
                    <TouchableOpacity
                      style={styles.findAlternativeBtn}
                      onPress={() => router.push("/intercity" as any)}
                    >
                      <Text style={styles.findAlternativeBtnText}>🔍 ابحث عن رحلة بديلة</Text>
                    </TouchableOpacity>
                  </View>
                ) : tripCancelledByDriver ? (
                  <View style={styles.cancelledByDriverBox}>
                    <Text style={styles.cancelledByDriverTitle}>❌ تم إلغاء هذه الرحلة من قبل السائق</Text>
                    {trip?.cancelReason ? (
                      <>
                        <Text style={styles.cancelledByDriverReasonLabel}>سبب الإلغاء:</Text>
                        <Text style={styles.cancelledByDriverReason}>{trip.cancelReason}</Text>
                      </>
                    ) : (
                      <Text style={styles.cancelledByDriverReason}>لم يذكر السائق سبباً للإلغاء.</Text>
                    )}
                    <Text style={styles.cancelledByDriverNote}>يمكنك تصفح رحلات أخرى وحجز بديلاً.</Text>
                    <TouchableOpacity
                      style={styles.findAlternativeBtn}
                      onPress={() => router.push("/intercity" as any)}
                    >
                      <Text style={styles.findAlternativeBtnText}>🔍 ابحث عن رحلة بديلة</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Tracking Button — يظهر عندما الكابتن في الطريق أو وصل */}
                {(displayStatus === "scheduled" || displayStatus === "in_progress") && !isBookingCancelled && driver && (
                  <TouchableOpacity
                    style={styles.trackingBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/intercity/tracking",
                        params: {
                          bookingId: item.id.toString(),
                          tripId: item.tripId.toString(),
                          driverId: driver.id?.toString() || "",
                          driverName: driver.name || "",
                          driverPhone: driver.phone || "",
                          carModel: driver.vehicleModel || "",
                          carPlate: driver.vehiclePlate || "",
                          fromCity,
                          toCity,
                        },
                      } as any)
                    }
                  >
                    <Text style={styles.trackingBtnText}>🗺️ تتبع موقع السائق</Text>
                  </TouchableOpacity>
                )}

                {/* Actions */}
                <View style={styles.actionsRow}>
                  {canCancel && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancel(item.id, tripStatus)}
                      disabled={cancelBooking.isPending}
                    >
                      <Text style={styles.cancelBtnText}>إلغاء الحجز</Text>
                    </TouchableOpacity>
                  )}
                  {displayStatus === "in_progress" && (
                    <View style={[styles.statusBadge, { backgroundColor: "#22C55E22", borderColor: "#22C55E" }]}>
                      <Text style={{ color: "#22C55E", fontWeight: "bold" }}>🚗 الرحلة جارية</Text>
                    </View>
                  )}
                  {displayStatus === "completed" && !item.driverRating ? (
                    <TouchableOpacity
                      style={styles.rateBtn}
                      onPress={() => handleRate(item.id, item.tripId)}
                    >
                      <Text style={styles.rateBtnText}>⭐ قيّم الرحلة</Text>
                    </TouchableOpacity>
                  ) : null}
                  {displayStatus === "completed" && item.driverRating ? (
                    <View style={styles.ratedBadge}>
                      <Text style={styles.ratedText}>
                        {"⭐".repeat(item.driverRating)} تم التقييم
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Rating Modal */}
      <Modal visible={!!ratingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModal}>
            <Text style={styles.ratingTitle}>قيّم الرحلة</Text>
            <Text style={styles.ratingSubtitle}>كيف كانت تجربتك مع السائق؟</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setSelectedRating(star)}>
                  <Text style={[styles.star, selectedRating >= star && styles.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.ratingBtns}>
              <TouchableOpacity style={styles.ratingCancelBtn} onPress={() => setRatingModal(null)}>
                <Text style={styles.ratingCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ratingConfirmBtn}
                onPress={() => {
                  if (!ratingModal || !passenger) return;
                  rateTrip.mutate({
                    bookingId: ratingModal.bookingId,
                    raterId: passenger.id,
                    rating: selectedRating,
                    raterType: "passenger",
                  });
                }}
                disabled={rateTrip.isPending}
              >
                {rateTrip.isPending ? (
                  <ActivityIndicator color="#1A0533" />
                ) : (
                  <Text style={styles.ratingConfirmText}>إرسال التقييم</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: "#2D1B4E",
  },
  backBtn: { padding: 8 },
  backIcon: { color: "#FFD700", fontSize: 22 },
  headerTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center", marginBottom: 24 },
  browseBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  browseBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  loginBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 16 },
  loginBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  bookingCard: { backgroundColor: "#1E1035", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#2D1B4E" },
  statusBadge: { alignSelf: "flex-start", borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  statusText: { fontSize: 12, fontWeight: "700" },
  route: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  detail: { color: "#C4B5E0", fontSize: 13, marginBottom: 4 },
  captainBox: { backgroundColor: "#0F2A1A", borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "#22C55E44" },
  captainTitle: { color: "#22C55E", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  captainDetail: { color: "#FFFFFF", fontSize: 13, marginBottom: 3 },
  notesBox: { backgroundColor: "#2D1B4E", borderRadius: 10, padding: 10, marginTop: 8 },
  notesLabel: { color: "#FFD700", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  notesText: { color: "#FFFFFF", fontSize: 12, lineHeight: 18 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, backgroundColor: "#2D1B4E", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#EF4444" },
  cancelBtnText: { color: "#EF4444", fontSize: 13, fontWeight: "700" },
  rateBtn: { flex: 1, backgroundColor: "#FFD700", borderRadius: 12, padding: 12, alignItems: "center" },
  rateBtnText: { color: "#1A0533", fontSize: 13, fontWeight: "800" },
  ratedBadge: { flex: 1, backgroundColor: "#2D1B4E", borderRadius: 12, padding: 12, alignItems: "center" },
  ratedText: { color: "#FFD700", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "#000000BB", justifyContent: "flex-end" },
  ratingModal: { backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, alignItems: "center" },
  ratingTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  ratingSubtitle: { color: "#9B8EC4", fontSize: 14, marginBottom: 20 },
  starsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  star: { fontSize: 40, color: "#2D1B4E" },
  starActive: { color: "#FFD700" },
  ratingBtns: { flexDirection: "row", gap: 12, width: "100%" },
  ratingCancelBtn: { flex: 1, backgroundColor: "#2D1B4E", borderRadius: 14, padding: 14, alignItems: "center" },
  ratingCancelText: { color: "#9B8EC4", fontSize: 15, fontWeight: "700" },
  ratingConfirmBtn: { flex: 1, backgroundColor: "#FFD700", borderRadius: 14, padding: 14, alignItems: "center" },
  ratingConfirmText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  callBtn: { backgroundColor: "#22C55E22", borderRadius: 10, padding: 10, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: "#22C55E" },
  callBtnText: { color: "#22C55E", fontSize: 13, fontWeight: "700" },
  cancelledByDriverBox: {
    backgroundColor: "#2D0A0A",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#EF444444",
  },
  cancelledByDriverTitle: { color: "#F87171", fontSize: 14, fontWeight: "800", marginBottom: 8 },
  cancelledByDriverReasonLabel: { color: "#FCA5A5", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cancelledByDriverReason: { color: "#FCA5A5", fontSize: 13, lineHeight: 20, marginBottom: 8 },
  cancelledByDriverNote: { color: "#9B8EC4", fontSize: 11, fontStyle: "italic", marginBottom: 10 },
  findAlternativeBtn: {
    backgroundColor: "#1A0533", borderRadius: 10, padding: 12,
    alignItems: "center", borderWidth: 1, borderColor: "#7C3AED",
    marginTop: 4,
  },
  findAlternativeBtnText: { color: "#A78BFA", fontSize: 13, fontWeight: "700" },
  trackingBtn: {
    backgroundColor: "#0D1B2E",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#5B9BD5",
    marginBottom: 10,
  },
  trackingBtnText: { color: "#5B9BD5", fontSize: 14, fontWeight: "700" },
});

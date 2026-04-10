import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, ScrollView,
  TextInput, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";

const IRAQI_CITIES = [
  "الكل", "الموصل", "بغداد", "أربيل", "السليمانية", "كركوك",
  "البصرة", "النجف", "كربلاء", "الحلة", "الديوانية",
  "العمارة", "الناصرية", "الرمادي", "تكريت", "دهوك",
];

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("ar-IQ", { weekday: "long", month: "short", day: "numeric" }) +
    "  " +
    d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
  );
}

function timeUntil(dateStr: string | Date) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "انطلقت";
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return Math.floor(hours / 24) + " يوم";
  if (hours > 0) return hours + "س " + mins + "د";
  return mins + " دقيقة";
}

export default function IntercityBrowseScreen() {
  const router = useRouter();
  const [passenger, setPassenger] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [fromFilter, setFromFilter] = useState("الكل");
  const [toFilter, setToFilter] = useState("الكل");
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [pickupAddress, setPickupAddress] = useState("");
  const [showBookingModal, setShowBookingModal] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem("@masar_passenger").then((raw) => {
      if (raw) {
        try {
          setPassenger(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  const { data: trips, isLoading, refetch } = trpc.intercity.listTrips.useQuery({
    fromCity: fromFilter === "الكل" ? undefined : fromFilter,
    toCity: toFilter === "الكل" ? undefined : toFilter,
  });

  const bookTrip = trpc.intercity.bookTripWithPickup.useMutation({
    onSuccess: () => {
      setShowBookingModal(false);
      setSelectedTrip(null);
      setPickupAddress("");
      setSeatsToBook(1);
      Alert.alert("تم الحجز", "تم حجز مقعدك بنجاح. الدفع كاش عند الركوب.", [
        { text: "عرض حجوزاتي", onPress: () => router.push("/intercity/my-bookings") },
        { text: "حسناً" },
      ]);
      refetch();
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const openBookingModal = (trip: any) => {
    if (!passenger) {
      Alert.alert("تسجيل الدخول مطلوب", "يجب تسجيل الدخول لحجز رحلة", [
        { text: "تسجيل الدخول", onPress: () => router.push("/auth/login") },
        { text: "إلغاء", style: "cancel" },
      ]);
      return;
    }
    setSelectedTrip(trip);
    setSeatsToBook(1);
    setPickupAddress("");
    setShowBookingModal(true);
  };

  const handleConfirmBook = () => {
    if (!passenger || !selectedTrip) return;
    if (seatsToBook > selectedTrip.availableSeats) {
      Alert.alert("خطأ", "المقاعد المتاحة فقط " + selectedTrip.availableSeats);
      return;
    }
    bookTrip.mutate({
      tripId: selectedTrip.id,
      passengerId: passenger.id,
      seatsBooked: seatsToBook,
      passengerPhone: passenger.phone,
      passengerName: passenger.name || "مستخدم",
      pickupAddress: pickupAddress.trim() || undefined,
    });
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>السفر بين المدن</Text>
        <TouchableOpacity onPress={() => router.push("/intercity/my-bookings")} style={styles.myBookingsBtn}>
          <Text style={styles.myBookingsBtnText}>حجوزاتي</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>من:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {IRAQI_CITIES.map((city) => (
              <TouchableOpacity
                key={"from_" + city}
                style={[styles.filterChip, fromFilter === city && styles.filterChipActive]}
                onPress={() => setFromFilter(city)}
              >
                <Text style={[styles.filterChipText, fromFilter === city && styles.filterChipTextActive]}>
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.filterLabel}>إلى:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {IRAQI_CITIES.map((city) => (
              <TouchableOpacity
                key={"to_" + city}
                style={[styles.filterChip, toFilter === city && styles.filterChipActive]}
                onPress={() => setToFilter(city)}
              >
                <Text style={[styles.filterChipText, toFilter === city && styles.filterChipTextActive]}>
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Trips List */}
      {isLoading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : !trips || trips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛣️</Text>
          <Text style={styles.emptyTitle}>لا توجد رحلات متاحة</Text>
          <Text style={styles.emptyDesc}>جرب تغيير الفلاتر أو تحقق لاحقاً</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.tripCard}>
              <View style={styles.routeHeader}>
                <View style={styles.routeInfo}>
                  <Text style={styles.cityFrom}>{item.fromCity}</Text>
                  <Text style={styles.routeArrow}>{">"}</Text>
                  <Text style={styles.cityTo}>{item.toCity}</Text>
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceText}>{parseInt(item.pricePerSeat).toLocaleString()}</Text>
                  <Text style={styles.priceUnit}>دينار/مقعد</Text>
                </View>
              </View>
              <Text style={styles.detailText}>🕐 {formatDate(item.departureTime)}</Text>
              <Text style={styles.detailText}>⏱️ تغادر خلال {timeUntil(item.departureTime)}</Text>
              <Text style={styles.detailText}>💺 {item.availableSeats} مقعد متاح</Text>
              {item.meetingPoint ? (
                <Text style={styles.detailText}>📌 {item.meetingPoint}</Text>
              ) : null}
              {item.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>📝 ملاحظات السائق:</Text>
                  <Text style={styles.notesText}>{item.notes}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.bookBtn} onPress={() => openBookingModal(item)}>
                <Text style={styles.bookBtnText}>احجز الآن</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Booking Modal */}
      <Modal visible={showBookingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تأكيد الحجز</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Text style={styles.modalClose}>X</Text>
              </TouchableOpacity>
            </View>
            {selectedTrip && (
              <>
                {/* Trip Summary */}
                <View style={styles.tripSummary}>
                  <Text style={styles.tripSummaryRoute}>
                    {selectedTrip.fromCity} - {selectedTrip.toCity}
                  </Text>
                  <Text style={styles.tripSummaryDate}>🕐 {formatDate(selectedTrip.departureTime)}</Text>
                  {selectedTrip.meetingPoint ? (
                    <Text style={styles.tripSummaryDetail}>📌 {selectedTrip.meetingPoint}</Text>
                  ) : null}
                  {selectedTrip.notes ? (
                    <View style={[styles.notesBox, { marginTop: 8 }]}>
                      <Text style={styles.notesLabel}>📝 ملاحظات السائق:</Text>
                      <Text style={styles.notesText}>{selectedTrip.notes}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Seats Selector */}
                <Text style={styles.fieldLabel}>عدد المقاعد</Text>
                <View style={styles.seatsRow}>
                  <TouchableOpacity
                    style={styles.seatBtn}
                    onPress={() => setSeatsToBook((s) => Math.max(1, s - 1))}
                  >
                    <Text style={styles.seatBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.seatsCount}>{seatsToBook}</Text>
                  <TouchableOpacity
                    style={styles.seatBtn}
                    onPress={() => setSeatsToBook((s) => Math.min(selectedTrip.availableSeats, s + 1))}
                  >
                    <Text style={styles.seatBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Pickup Address */}
                <Text style={styles.fieldLabel}>📍 موقع الاستلام (اختياري)</Text>
                <TextInput
                  style={styles.pickupInput}
                  placeholder="أدخل عنوانك أو موقعك للسائق..."
                  placeholderTextColor="#6B5B8A"
                  value={pickupAddress}
                  onChangeText={setPickupAddress}
                  multiline
                  numberOfLines={2}
                />

                {/* Total */}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>الإجمالي (كاش عند الركوب)</Text>
                  <Text style={styles.totalAmount}>
                    {(seatsToBook * parseInt(selectedTrip.pricePerSeat)).toLocaleString()} دينار
                  </Text>
                </View>

                {/* Confirm */}
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleConfirmBook}
                  disabled={bookTrip.isPending}
                >
                  {bookTrip.isPending ? (
                    <ActivityIndicator color="#1A0533" />
                  ) : (
                    <Text style={styles.confirmBtnText}>تأكيد الحجز</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
  myBookingsBtn: { backgroundColor: "#2D1B4E", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  myBookingsBtnText: { color: "#FFD700", fontSize: 12, fontWeight: "700" },
  filtersContainer: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#1E1035", backgroundColor: "#0F0A1E" },
  filterLabel: { color: "#9B8EC4", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1E1035", borderWidth: 1, borderColor: "#2D1B4E" },
  filterChipActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  filterChipText: { color: "#9B8EC4", fontSize: 12 },
  filterChipTextActive: { color: "#1A0533", fontWeight: "700" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center" },
  tripCard: { backgroundColor: "#1E1035", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#2D1B4E" },
  routeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  routeInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  cityFrom: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  routeArrow: { color: "#FFD700", fontSize: 18 },
  cityTo: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  priceTag: { alignItems: "flex-end" },
  priceText: { color: "#FFD700", fontSize: 16, fontWeight: "800" },
  priceUnit: { color: "#9B8EC4", fontSize: 10 },
  detailText: { color: "#C4B5E0", fontSize: 12, marginBottom: 4 },
  notesBox: { backgroundColor: "#2D1B4E", borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 4 },
  notesLabel: { color: "#FFD700", fontSize: 11, fontWeight: "700", marginBottom: 4 },
  notesText: { color: "#FFFFFF", fontSize: 12, lineHeight: 18 },
  bookBtn: { backgroundColor: "#FFD700", borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 },
  bookBtnText: { color: "#1A0533", fontSize: 14, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: "#000000BB", justifyContent: "flex-end" },
  bookingModal: { backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { color: "#FFD700", fontSize: 18, fontWeight: "700" },
  modalClose: { color: "#9B8EC4", fontSize: 20, padding: 4 },
  tripSummary: { backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14, marginBottom: 16 },
  tripSummaryRoute: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  tripSummaryDate: { color: "#C4B5E0", fontSize: 13, marginBottom: 4 },
  tripSummaryDetail: { color: "#9B8EC4", fontSize: 12 },
  fieldLabel: { color: "#9B8EC4", fontSize: 12, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  seatsRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  seatBtn: { backgroundColor: "#2D1B4E", borderRadius: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  seatBtnText: { color: "#FFD700", fontSize: 20, fontWeight: "800" },
  seatsCount: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", minWidth: 30, textAlign: "center" },
  pickupInput: { backgroundColor: "#2D1B4E", borderRadius: 12, padding: 12, color: "#FFFFFF", fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: "#3D2B5E", textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14, marginBottom: 16 },
  totalLabel: { color: "#9B8EC4", fontSize: 13 },
  totalAmount: { color: "#22C55E", fontSize: 16, fontWeight: "800" },
  confirmBtn: { backgroundColor: "#FFD700", borderRadius: 14, padding: 16, alignItems: "center" },
  confirmBtnText: { color: "#1A0533", fontSize: 16, fontWeight: "800" },
});

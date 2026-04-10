import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, ScrollView,
  TextInput, Modal, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const router = useRouter();
  const [passenger, setPassenger] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [fromFilter, setFromFilter] = useState("الكل");
  const [toFilter, setToFilter] = useState("الكل");
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [passengerNote, setPassengerNote] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem("@masar_passenger").then((raw) => {
      if (raw) {
        try { setPassenger(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const { data: trips, isLoading, refetch } = trpc.intercity.listTrips.useQuery({
    fromCity: fromFilter === "الكل" ? undefined : fromFilter,
    toCity: toFilter === "الكل" ? undefined : toFilter,
  });

  const bookTrip = trpc.intercity.bookWithGPS.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowBookingModal(false);
      setSelectedTrip(null);
      setPickupAddress("");
      setPickupLat(null);
      setPickupLng(null);
      setPassengerNote("");
      setSeatsToBook(1);
      Alert.alert("✅ تم الحجز بنجاح", "تم حجز مقعدك. الدفع كاش عند الركوب.", [
        { text: "عرض حجوزاتي", onPress: () => router.push("/intercity/my-bookings") },
        { text: "حسناً" },
      ]);
      refetch();
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const handleGetGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تعذّر الوصول للموقع", "يرجى السماح بالوصول للموقع من الإعدادات");
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPickupLat(loc.coords.latitude);
      setPickupLng(loc.coords.longitude);
      // Reverse geocode
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo.length > 0) {
        const g = geo[0];
        const addr = [g.street, g.district, g.city].filter(Boolean).join("، ");
        if (addr) setPickupAddress(addr);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      Alert.alert("خطأ", "تعذّر الحصول على الموقع");
    }
    setGpsLoading(false);
  };

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
    setPickupLat(null);
    setPickupLng(null);
    setPassengerNote("");
    setShowBookingModal(true);
  };

  const handleConfirmBook = () => {
    if (!passenger || !selectedTrip) return;
    if (!pickupAddress.trim()) {
      Alert.alert("مطلوب", "يرجى إدخال عنوان موقعك");
      return;
    }
    if (!pickupLat || !pickupLng) {
      Alert.alert("مطلوب", "يرجى تحديد موقعك عبر GPS أولاً");
      return;
    }
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
      pickupAddress: pickupAddress.trim(),
      pickupLat,
      pickupLng,
      passengerNote: passengerNote.trim() || undefined,
    });
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.intercity.title}</Text>
        <TouchableOpacity onPress={() => router.push("/intercity/my-bookings")} style={styles.myBookingsBtn}>
          <Text style={styles.myBookingsBtnText}>{t.intercity.myBookings}</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>{t.common.from}:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {IRAQI_CITIES.map((city) => (
              <TouchableOpacity
                key={"from_" + city}
                style={[styles.filterChip, fromFilter === city && styles.filterChipActive]}
                onPress={() => setFromFilter(city)}
              >
                <Text style={[styles.filterChipText, fromFilter === city && styles.filterChipTextActive]}>{city}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.filterLabel}>{t.common.to}:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {IRAQI_CITIES.map((city) => (
              <TouchableOpacity
                key={"to_" + city}
                style={[styles.filterChip, toFilter === city && styles.filterChipActive]}
                onPress={() => setToFilter(city)}
              >
                <Text style={[styles.filterChipText, toFilter === city && styles.filterChipTextActive]}>{city}</Text>
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
          <Text style={styles.emptyTitle}>{t.intercity.noTrips}</Text>
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
                  <Text style={styles.priceUnit}>{t.common.iqd}/{t.common.seat}</Text>
                </View>
              </View>
              <Text style={styles.detailText}>🕐 {formatDate(item.departureTime)}</Text>
              <Text style={styles.detailText}>⏱️ تغادر خلال {timeUntil(item.departureTime)}</Text>
              <View style={styles.seatsAvailRow}>
                <Text style={styles.detailText}>💺 {item.availableSeats} {t.intercity.seatsAvailable}</Text>
                <View style={[styles.seatsBadge, item.availableSeats <= 2 && styles.seatsBadgeRed]}>
                  <Text style={styles.seatsBadgeText}>
                    {item.availableSeats <= 2 ? "🔥 أوشك على الامتلاء" : "✅ متاح"}
                  </Text>
                </View>
              </View>
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
                <Text style={styles.bookBtnText}>{t.intercity.bookSeat} 🎫</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Booking Modal */}
      <Modal visible={showBookingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={styles.bookingModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>تأكيد الحجز</Text>
                <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              {selectedTrip && (
                <>
                  {/* Trip Summary */}
                  <View style={styles.tripSummary}>
                    <Text style={styles.tripSummaryRoute}>
                      {selectedTrip.fromCity} ← {selectedTrip.toCity}
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
                    <TouchableOpacity style={styles.seatBtn} onPress={() => setSeatsToBook((s) => Math.max(1, s - 1))}>
                      <Text style={styles.seatBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.seatsCount}>{seatsToBook}</Text>
                    <TouchableOpacity style={styles.seatBtn} onPress={() => setSeatsToBook((s) => Math.min(selectedTrip.availableSeats, s + 1))}>
                      <Text style={styles.seatBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* GPS Location - MANDATORY */}
                  <View style={styles.gpsSection}>
                    <View style={styles.gpsSectionHeader}>
                      <Text style={styles.fieldLabel}>📍 موقع الاستلام <Text style={styles.requiredStar}>*</Text></Text>
                      <Text style={styles.requiredNote}>إلزامي</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.gpsBtn, pickupLat ? styles.gpsBtnSuccess : null]}
                      onPress={handleGetGPS}
                      disabled={gpsLoading}
                    >
                      {gpsLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.gpsBtnText}>
                          {pickupLat ? "✅ تم تحديد الموقع — اضغط لتحديثه" : "📡 تحديد موقعي عبر GPS"}
                        </Text>
                      )}
                    </TouchableOpacity>
                    {pickupLat ? (
                      <Text style={styles.gpsCoords}>
                        {pickupLat.toFixed(5)}, {pickupLng?.toFixed(5)}
                      </Text>
                    ) : null}
                    <TextInput
                      style={[styles.pickupInput, !pickupAddress.trim() && styles.pickupInputRequired]}
                      placeholder="وصف العنوان بالتفصيل (مثال: حي النور، قرب مسجد...)"
                      placeholderTextColor="#6B5B8A"
                      value={pickupAddress}
                      onChangeText={setPickupAddress}
                      multiline
                      numberOfLines={2}
                    />
                    {!pickupAddress.trim() && (
                      <Text style={styles.requiredHint}>⚠️ العنوان مطلوب لإتمام الحجز</Text>
                    )}
                  </View>

                  {/* Passenger Note - Optional */}
                  <Text style={styles.fieldLabel}>💬 ملاحظة للسائق (اختياري)</Text>
                  <TextInput
                    style={styles.pickupInput}
                    placeholder="مثال: معي حقيبة كبيرة، أنا أمام البوابة الرئيسية..."
                    placeholderTextColor="#6B5B8A"
                    value={passengerNote}
                    onChangeText={setPassengerNote}
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
                    style={[styles.confirmBtn, (!pickupAddress.trim() || !pickupLat) && styles.confirmBtnDisabled]}
                    onPress={handleConfirmBook}
                    disabled={bookTrip.isPending || !pickupAddress.trim() || !pickupLat}
                  >
                    {bookTrip.isPending ? (
                      <ActivityIndicator color="#1A0533" />
                    ) : (
                      <Text style={styles.confirmBtnText}>تأكيد الحجز 🎫</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
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
  headerTitle: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  myBookingsBtn: { backgroundColor: "#FFD700", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  myBookingsBtnText: { color: "#1A0533", fontSize: 13, fontWeight: "bold" },
  filtersContainer: { backgroundColor: "#1A0533", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  filterLabel: { color: "#9B8EC4", fontSize: 12, marginBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#2D1B4E", marginRight: 6 },
  filterChipActive: { backgroundColor: "#FFD700" },
  filterChipText: { color: "#9B8EC4", fontSize: 13 },
  filterChipTextActive: { color: "#1A0533", fontWeight: "bold" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFD700", fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center" },
  tripCard: {
    backgroundColor: "#1E0A3C",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  routeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  routeInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  cityFrom: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  routeArrow: { color: "#9B8EC4", fontSize: 16 },
  cityTo: { color: "#E0D0FF", fontSize: 18, fontWeight: "bold" },
  priceTag: { backgroundColor: "#2D1B4E", borderRadius: 10, padding: 8, alignItems: "center" },
  priceText: { color: "#FFD700", fontSize: 16, fontWeight: "bold" },
  priceUnit: { color: "#9B8EC4", fontSize: 10 },
  detailText: { color: "#C0A8E8", fontSize: 13, marginBottom: 4 },
  seatsAvailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  seatsBadge: { backgroundColor: "#1B4D2E", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  seatsBadgeRed: { backgroundColor: "#4D1B1B" },
  seatsBadgeText: { color: "#E0D0FF", fontSize: 11 },
  notesBox: { backgroundColor: "#2D1B4E", borderRadius: 8, padding: 10, marginBottom: 8 },
  notesLabel: { color: "#FFD700", fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  notesText: { color: "#C0A8E8", fontSize: 13 },
  bookBtn: { backgroundColor: "#FFD700", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  bookBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  bookingModal: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  modalClose: { color: "#9B8EC4", fontSize: 20, padding: 4 },
  tripSummary: { backgroundColor: "#2D1B4E", borderRadius: 12, padding: 12, marginBottom: 16 },
  tripSummaryRoute: { color: "#FFD700", fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  tripSummaryDate: { color: "#C0A8E8", fontSize: 13, marginBottom: 2 },
  tripSummaryDetail: { color: "#9B8EC4", fontSize: 12 },
  fieldLabel: { color: "#E0D0FF", fontSize: 14, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  requiredStar: { color: "#FF6B6B", fontSize: 16 },
  requiredNote: { color: "#FF6B6B", fontSize: 12, fontWeight: "bold" },
  seatsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 4 },
  seatBtn: { backgroundColor: "#2D1B4E", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  seatBtnText: { color: "#FFD700", fontSize: 22, fontWeight: "bold" },
  seatsCount: { color: "#FFD700", fontSize: 28, fontWeight: "bold", minWidth: 40, textAlign: "center" },
  gpsSection: { marginTop: 4 },
  gpsSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gpsBtn: {
    backgroundColor: "#3D2B6E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#5A3F8A",
  },
  gpsBtnSuccess: { backgroundColor: "#1B4D2E", borderColor: "#2ECC71" },
  gpsBtnText: { color: "#E0D0FF", fontSize: 14, fontWeight: "600" },
  gpsCoords: { color: "#9B8EC4", fontSize: 11, textAlign: "center", marginBottom: 6 },
  pickupInput: {
    backgroundColor: "#2D1B4E",
    borderRadius: 10,
    padding: 12,
    color: "#E0D0FF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#3D2B6E",
    textAlignVertical: "top",
    marginBottom: 4,
  },
  pickupInputRequired: { borderColor: "#FF6B6B" },
  requiredHint: { color: "#FF6B6B", fontSize: 11, marginBottom: 4 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2D1B4E",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  totalLabel: { color: "#9B8EC4", fontSize: 13 },
  totalAmount: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  confirmBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  confirmBtnDisabled: { backgroundColor: "#6B5B2E", opacity: 0.6 },
  confirmBtnText: { color: "#1A0533", fontSize: 16, fontWeight: "bold" },
});

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  TextInput,
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
  return d.toLocaleDateString("ar-IQ", {
    weekday: "long", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeUntil(dateStr: string | Date) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)} يوم`;
  if (hours > 0) return `${hours} ساعة و${mins} دقيقة`;
  return `${mins} دقيقة`;
}

export default function IntercityBrowseScreen() {
  const router = useRouter();
  const [passenger, setPassenger] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [fromFilter, setFromFilter] = useState("الكل");
  const [toFilter, setToFilter] = useState("الكل");
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [seatsToBook, setSeatsToBook] = useState("1");
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

  const bookTrip = trpc.intercity.bookTrip.useMutation({
    onSuccess: () => {
      setShowBookingModal(false);
      setSelectedTrip(null);
      Alert.alert("✅ تم الحجز!", "تم حجز مقعدك بنجاح. الدفع كاش عند الركوب.", [
        { text: "عرض حجوزاتي", onPress: () => router.push("/intercity/my-bookings") },
        { text: "حسناً" },
      ]);
      refetch();
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const handleBook = () => {
    if (!passenger) {
      Alert.alert("تسجيل الدخول مطلوب", "يجب تسجيل الدخول لحجز رحلة", [
        { text: "تسجيل الدخول", onPress: () => router.push("/auth/login") },
        { text: "إلغاء", style: "cancel" },
      ]);
      return;
    }
    if (!selectedTrip) return;
    const seats = parseInt(seatsToBook);
    if (isNaN(seats) || seats < 1) {
      Alert.alert("خطأ", "يرجى إدخال عدد مقاعد صحيح");
      return;
    }
    if (seats > selectedTrip.availableSeats) {
      Alert.alert("خطأ", `المقاعد المتاحة فقط ${selectedTrip.availableSeats}`);
      return;
    }
    const total = seats * parseInt(selectedTrip.pricePerSeat);
    Alert.alert(
      "تأكيد الحجز",
      `${selectedTrip.fromCity} ← ${selectedTrip.toCity}\n${seats} مقعد × ${parseInt(selectedTrip.pricePerSeat).toLocaleString()} دينار\nالإجمالي: ${total.toLocaleString()} دينار (كاش عند الركوب)`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تأكيد الحجز",
          onPress: () => bookTrip.mutate({
            tripId: selectedTrip.id,
            passengerId: passenger.id,
            seatsBooked: seats,
            passengerPhone: passenger.phone,
            passengerName: passenger.name || "مستخدم",
          }),
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛣️ السفر بين المدن</Text>
        <TouchableOpacity onPress={() => router.push("/intercity/my-bookings")} style={styles.myBookingsBtn}>
          <Text style={styles.myBookingsBtnText}>حجوزاتي</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>من:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {IRAQI_CITIES.map(city => (
              <TouchableOpacity
                key={city}
                style={[styles.filterChip, fromFilter === city && styles.filterChipActive]}
                onPress={() => setFromFilter(city)}
              >
                <Text style={[styles.filterChipText, fromFilter === city && styles.filterChipTextActive]}>{city}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.filterLabel}>إلى:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {IRAQI_CITIES.map(city => (
              <TouchableOpacity
                key={city}
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
              {/* Route Header */}
              <View style={styles.routeHeader}>
                <View style={styles.routeInfo}>
                  <Text style={styles.cityFrom}>{item.fromCity}</Text>
                  <Text style={styles.routeArrow}>←</Text>
                  <Text style={styles.cityTo}>{item.toCity}</Text>
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceText}>{parseInt(item.pricePerSeat).toLocaleString()}</Text>
                  <Text style={styles.priceUnit}>دينار/مقعد</Text>
                </View>
              </View>

              {/* Details */}
              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>🕐</Text>
                  <Text style={styles.detailText}>{formatDate(item.departureTime)}</Text>
                </View>
              </View>
              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>⏱️</Text>
                  <Text style={styles.detailText}>تغادر خلال {timeUntil(item.departureTime)}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailIcon}>💺</Text>
                  <Text style={styles.detailText}>{item.availableSeats} مقعد متاح</Text>
                </View>
              </View>

              {item.meetingPoint ? (
                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailIcon}>📌</Text>
                    <Text style={styles.detailText}>{item.meetingPoint}</Text>
                  </View>
                </View>
              ) : null}

              {/* Seats selector + Book */}
              <View style={styles.bookRow}>
                <View style={styles.seatsSelector}>
                  <TouchableOpacity
                    style={styles.seatBtn}
                    onPress={() => {
                      if (selectedTrip?.id === item.id) {
                        setSeatsToBook(s => Math.max(1, parseInt(s) - 1).toString());
                      }
                    }}
                  >
                    <Text style={styles.seatBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.seatsCount}>
                    {selectedTrip?.id === item.id ? seatsToBook : "1"} مقعد
                  </Text>
                  <TouchableOpacity
                    style={styles.seatBtn}
                    onPress={() => {
                      setSelectedTrip(item);
                      setSeatsToBook(s => Math.min(item.availableSeats, parseInt(s) + 1).toString());
                    }}
                  >
                    <Text style={styles.seatBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() => {
                    setSelectedTrip(item);
                    if (selectedTrip?.id !== item.id) setSeatsToBook("1");
                    handleBook();
                  }}
                  disabled={bookTrip.isPending}
                >
                  {bookTrip.isPending && selectedTrip?.id === item.id ? (
                    <ActivityIndicator color="#1A0533" size="small" />
                  ) : (
                    <Text style={styles.bookBtnText}>احجز الآن</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
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
  headerTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  myBookingsBtn: {
    backgroundColor: "#2D1B4E",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  myBookingsBtnText: { color: "#FFD700", fontSize: 12, fontWeight: "700" },
  filtersContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1035",
    backgroundColor: "#0F0A1E",
  },
  filterLabel: { color: "#9B8EC4", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: "#1E1035",
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  filterChipActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  filterChipText: { color: "#9B8EC4", fontSize: 12 },
  filterChipTextActive: { color: "#1A0533", fontWeight: "700" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center" },
  tripCard: {
    backgroundColor: "#1E1035",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  routeInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  cityFrom: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  routeArrow: { color: "#FFD700", fontSize: 20 },
  cityTo: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  priceTag: {
    backgroundColor: "#FFD70022",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  priceText: { color: "#FFD700", fontSize: 16, fontWeight: "800" },
  priceUnit: { color: "#9B8EC4", fontSize: 10 },
  detailsRow: { flexDirection: "row", gap: 16, marginBottom: 6 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  detailIcon: { fontSize: 13 },
  detailText: { color: "#9B8EC4", fontSize: 12, flex: 1 },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#2D1B4E",
    gap: 12,
  },
  seatsSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F0A1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2D1B4E",
    overflow: "hidden",
  },
  seatBtn: { padding: 10, paddingHorizontal: 14 },
  seatBtnText: { color: "#FFD700", fontSize: 18, fontWeight: "700" },
  seatsCount: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", paddingHorizontal: 8 },
  bookBtn: {
    flex: 1,
    backgroundColor: "#FFD700",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  bookBtnText: { color: "#1A0533", fontSize: 14, fontWeight: "800" },
});

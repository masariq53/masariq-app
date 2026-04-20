import React, { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, Modal,
  RefreshControl, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";

const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  "الموصل": { latitude: 36.3359, longitude: 43.1189 },
  "بغداد": { latitude: 33.3152, longitude: 44.3661 },
  "أربيل": { latitude: 36.1901, longitude: 44.0091 },
  "السليمانية": { latitude: 35.5575, longitude: 45.4329 },
  "كركوك": { latitude: 35.4681, longitude: 44.3922 },
  "البصرة": { latitude: 30.5085, longitude: 47.7804 },
  "النجف": { latitude: 31.9936, longitude: 44.3218 },
  "كربلاء": { latitude: 32.6166, longitude: 44.0247 },
  "الحلة": { latitude: 32.4769, longitude: 44.4422 },
  "الديوانية": { latitude: 31.9887, longitude: 44.9268 },
  "العمارة": { latitude: 31.8408, longitude: 47.1508 },
  "الناصرية": { latitude: 31.0433, longitude: 46.2592 },
  "الرمادي": { latitude: 33.4258, longitude: 43.2997 },
  "تكريت": { latitude: 34.5989, longitude: 43.6786 },
  "دهوك": { latitude: 36.8669, longitude: 42.9503 },
  "زاخو": { latitude: 37.1445, longitude: 42.6838 },
};

type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
type TimeFilter = "today" | "yesterday" | "week" | "month" | "all";

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

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: "today", label: "اليوم" },
  { key: "yesterday", label: "أمس" },
  { key: "week", label: "هذا الأسبوع" },
  { key: "month", label: "هذا الشهر" },
  { key: "all", label: "الكل" },
];

const PAGE_SIZE = 10;

function formatDate(val: string | Date | null | undefined) {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("ar-IQ", { weekday: "long", month: "short", day: "numeric", timeZone: "Asia/Baghdad" }) +
    "  " +
    d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" })
  );
}

function isInTimeRange(dateVal: string | Date | null | undefined, filter: TimeFilter): boolean {
  if (filter === "all") return true;
  if (!dateVal) return false;
  const d = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  switch (filter) {
    case "today": return d >= startOfToday;
    case "yesterday": return d >= startOfYesterday && d < startOfToday;
    case "week": return d >= startOfWeek;
    case "month": return d >= startOfMonth;
    default: return true;
  }
}

export default function MyIntercityBookingsScreen() {
  const router = useRouter();
  const { passenger: passengerCtx } = usePassenger();
  const passenger = passengerCtx ? { id: passengerCtx.id } : null;
  const loaded = true; // passenger is always ready from context
  const [refreshing, setRefreshing] = useState(false);
  const [ratingModal, setRatingModal] = useState<{ bookingId: number; tripId: number } | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [page, setPage] = useState(1);

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

  // تطبيق الفلتر الزمني
  const filteredBookings = useMemo(() => {
    const all = (bookingsQuery.data as any[]) ?? [];
    return all.filter((item) => {
      const departureTime = item.trip?.departureTime ?? null;
      return isInTimeRange(departureTime, timeFilter);
    });
  }, [bookingsQuery.data, timeFilter]);

  // Pagination
  const paginatedBookings = useMemo(() => {
    return filteredBookings.slice(0, page * PAGE_SIZE);
  }, [filteredBookings, page]);

  const hasMore = paginatedBookings.length < filteredBookings.length;

  const handleTimeFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    setPage(1);
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

      {/* Time Filters */}
      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TIME_FILTERS}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.filtersContainer}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterChip, timeFilter === f.key && styles.filterChipActive]}
              onPress={() => handleTimeFilterChange(f.key)}
            >
              <Text style={[styles.filterChipText, timeFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Count */}
      {!bookingsQuery.isLoading && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {filteredBookings.length} حجز
          </Text>
        </View>
      )}

      {bookingsQuery.isLoading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : filteredBookings.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🎫</Text>
          <Text style={styles.emptyTitle}>
            {timeFilter === "all" ? "لا توجد حجوزات" : "لا توجد حجوزات في هذه الفترة"}
          </Text>
          <Text style={styles.emptyDesc}>
            {timeFilter === "all" ? "احجز رحلتك الأولى بين المدن" : "جرب تغيير الفلتر الزمني"}
          </Text>
          {timeFilter === "all" ? (
            <TouchableOpacity style={styles.browseBtn} onPress={() => router.push("/intercity")}>
              <Text style={styles.browseBtnText}>تصفح الرحلات</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.browseBtn} onPress={() => handleTimeFilterChange("all")}>
              <Text style={styles.browseBtnText}>عرض الكل</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={paginatedBookings}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFD700" />
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setPage((p) => p + 1)}>
                <Text style={styles.loadMoreText}>تحميل المزيد ({filteredBookings.length - paginatedBookings.length} متبقي)</Text>
              </TouchableOpacity>
            ) : filteredBookings.length > PAGE_SIZE ? (
              <Text style={styles.allLoadedText}>✅ تم عرض جميع الحجوزات</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const trip = item.trip;
            const driver = item.driver;
            const bookingStatus = item.status as "pending" | "confirmed" | "cancelled" | "completed";
            const tripStatus = (trip?.status || "scheduled") as TripStatus;
            const isBookingCancelled = bookingStatus === "cancelled";
            const isTripCancelled = tripStatus === "cancelled";
            const displayStatus: TripStatus = isBookingCancelled || isTripCancelled ? "cancelled" : tripStatus;
            const cancelledByDriverReason = isBookingCancelled && typeof item.cancelledBy === "string" && item.cancelledBy.startsWith("driver:")
              ? item.cancelledBy.replace("driver:", "")
              : null;
            const tripCancelledByDriver = isTripCancelled && (trip?.cancelledBy === "driver" || trip?.cancelReason);
            const fromCity = trip?.fromCity ?? "—";
            const toCity = trip?.toCity ?? "—";
            const departureTime = trip?.departureTime ?? null;
            const approachStatus = (item as any).driverApproachStatus as string | null;
            const driverHeadingOrArrived = approachStatus === "heading" || approachStatus === "arrived_at_pickup";
            const canCancel = !isBookingCancelled && !isTripCancelled && tripStatus === "scheduled" && !driverHeadingOrArrived;

            return (
              <View style={styles.bookingCard}>
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[displayStatus] + "22", borderColor: STATUS_COLORS[displayStatus] }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[displayStatus] }]}>
                    {STATUS_ICONS[displayStatus]} {STATUS_LABELS[displayStatus]}
                  </Text>
                </View>

                {/* Route */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#9B8EC4', fontSize: 10, marginBottom: 2 }}>من</Text>
                    <Text style={[styles.route, { marginBottom: 0 }]}>{fromCity}</Text>
                  </View>
                  <Text style={{ color: '#9B8EC4', fontSize: 18, marginTop: 10 }}>→</Text>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#9B8EC4', fontSize: 10, marginBottom: 2 }}>إلى</Text>
                    <Text style={[styles.route, { marginBottom: 0 }]}>{toCity}</Text>
                  </View>
                </View>
                {/* Route Map */}
                {CITY_COORDS[fromCity] && CITY_COORDS[toCity] && (() => {
                  const from = CITY_COORDS[fromCity];
                  const to = CITY_COORDS[toCity];
                  const midLat = (from.latitude + to.latitude) / 2;
                  const midLng = (from.longitude + to.longitude) / 2;
                  const latDelta = Math.abs(from.latitude - to.latitude) * 1.6 + 0.5;
                  const lngDelta = Math.abs(from.longitude - to.longitude) * 1.6 + 0.5;
                  return (
                    <View style={{ height: 130, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                      <MapView
                        style={{ flex: 1 }}
                        provider={PROVIDER_GOOGLE}
                        initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        rotateEnabled={false}
                      >
                        <Polyline coordinates={[from, to]} strokeColor="#FFD700" strokeWidth={3} lineDashPattern={[8, 4]} />
                        <Marker coordinate={from}>
                          <View style={{ backgroundColor: '#22C55E', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{fromCity}</Text>
                          </View>
                        </Marker>
                        <Marker coordinate={to}>
                          <View style={{ backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{toCity}</Text>
                          </View>
                        </Marker>
                      </MapView>
                    </View>
                  );
                })()}
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

                {/* Captain Info */}
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
                      <TouchableOpacity style={styles.callBtn} onPress={() => callDriver(driver.phone)}>
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

                {/* Cancel reason */}
                {cancelledByDriverReason ? (
                  <View style={styles.cancelledByDriverBox}>
                    <Text style={styles.cancelledByDriverTitle}>❌ تم إلغاء حجزك من قبل السائق</Text>
                    <Text style={styles.cancelledByDriverReasonLabel}>سبب الإلغاء:</Text>
                    <Text style={styles.cancelledByDriverReason}>{cancelledByDriverReason}</Text>
                    <Text style={styles.cancelledByDriverNote}>يمكنك تصفح رحلات أخرى وحجز بديلاً.</Text>
                    <TouchableOpacity style={styles.findAlternativeBtn} onPress={() => router.push("/intercity" as any)}>
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
                    <TouchableOpacity style={styles.findAlternativeBtn} onPress={() => router.push("/intercity" as any)}>
                      <Text style={styles.findAlternativeBtnText}>🔍 ابحث عن رحلة بديلة</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Chat Button */}
                {!isBookingCancelled && passenger && (
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/intercity/chat",
                        params: {
                          bookingId: item.id.toString(),
                          tripId: item.tripId.toString(),
                          passengerId: passenger.id.toString(),
                          driverName: driver?.name || "السائق",
                          tripStatus: displayStatus,
                        },
                      } as any)
                    }
                  >
                    <Text style={styles.chatBtnText}>💬 رسائل السائق</Text>
                  </TouchableOpacity>
                )}

                {/* Tracking Button */}
                {displayStatus === "scheduled" && !isBookingCancelled && driver && (
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
                          passengerLat: item.pickupLat?.toString() || "",
                          passengerLng: item.pickupLng?.toString() || "",
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
                    <TouchableOpacity style={styles.rateBtn} onPress={() => handleRate(item.id, item.tripId)}>
                      <Text style={styles.rateBtnText}>⭐ قيّم الرحلة</Text>
                    </TouchableOpacity>
                  ) : null}
                  {displayStatus === "completed" && item.driverRating ? (
                    <View style={styles.ratedBadge}>
                      <Text style={styles.ratedText}>{"⭐".repeat(item.driverRating)} تم التقييم</Text>
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
  filtersWrapper: { borderBottomWidth: 1, borderBottomColor: "#2D1B4E" },
  filtersContainer: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#1E1035", borderWidth: 1, borderColor: "#2D1B4E",
  },
  filterChipActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  filterChipText: { color: "#9B8EC4", fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "#1A0533", fontWeight: "800" },
  countRow: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { color: "#9B8EC4", fontSize: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8, textAlign: "center" },
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
  cancelledByDriverBox: { backgroundColor: "#2D0A0A", borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: "#EF444444" },
  cancelledByDriverTitle: { color: "#F87171", fontSize: 14, fontWeight: "800", marginBottom: 8 },
  cancelledByDriverReasonLabel: { color: "#FCA5A5", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  cancelledByDriverReason: { color: "#FCA5A5", fontSize: 13, lineHeight: 20, marginBottom: 8 },
  cancelledByDriverNote: { color: "#9B8EC4", fontSize: 11, fontStyle: "italic", marginBottom: 10 },
  findAlternativeBtn: { backgroundColor: "#1A0533", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#7C3AED", marginTop: 4 },
  findAlternativeBtnText: { color: "#A78BFA", fontSize: 13, fontWeight: "700" },
  trackingBtn: { backgroundColor: "#0D1B2E", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#5B9BD5", marginBottom: 10 },
  trackingBtnText: { color: "#5B9BD5", fontSize: 14, fontWeight: "700" },
  chatBtn: { backgroundColor: "#1A2B3E", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1.5, borderColor: "#4A90D9", marginBottom: 10, marginTop: 4 },
  chatBtnText: { color: "#4A90D9", fontSize: 14, fontWeight: "700" },
  loadMoreBtn: { backgroundColor: "#1E1035", borderRadius: 14, padding: 14, alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: "#7C3AED" },
  loadMoreText: { color: "#A78BFA", fontSize: 14, fontWeight: "700" },
  allLoadedText: { color: "#9B8EC4", fontSize: 12, textAlign: "center", marginTop: 12, marginBottom: 8 },
});

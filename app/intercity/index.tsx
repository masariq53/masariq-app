import React, { useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StyleSheet, ScrollView,
  TextInput, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useT } from "@/lib/i18n";
import { usePassenger } from "@/lib/passenger-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

// إحداثيات المدن العراقية الرئيسية
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
  "سامراء": { latitude: 34.1987, longitude: 43.8741 },
  "بعقوبة": { latitude: 33.7456, longitude: 44.6498 },
  "الكوت": { latitude: 32.5000, longitude: 45.8333 },
  "الفلوجة": { latitude: 33.3500, longitude: 43.7833 },
};

const IRAQI_CITIES = [
  "الموصل", "بغداد", "أربيل", "السليمانية", "كركوك",
  "البصرة", "النجف", "كربلاء", "الحلة", "الديوانية",
  "العمارة", "الناصرية", "الرمادي", "تكريت", "دهوك",
];

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("ar-IQ", { weekday: "long", month: "short", day: "numeric", timeZone: "Asia/Baghdad" }) +
    "  " +
    d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" })
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

// Modal لاختيار المدينة
function CityPickerModal({
  visible,
  title,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  selected: string;
  onSelect: (city: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.cityModalOverlay}>
        <View style={styles.cityModalContainer}>
          <View style={styles.cityModalHeader}>
            <Text style={styles.cityModalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.cityModalCloseBtn}>
              <Text style={styles.cityModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* خيار "الكل" */}
          <TouchableOpacity
            style={[styles.cityItem, selected === "الكل" && styles.cityItemActive]}
            onPress={() => { onSelect("الكل"); onClose(); }}
          >
            <Text style={[styles.cityItemText, selected === "الكل" && styles.cityItemTextActive]}>
              🌍 الكل (جميع المدن)
            </Text>
            {selected === "الكل" && <Text style={styles.cityCheckmark}>✓</Text>}
          </TouchableOpacity>
          <FlatList
            data={IRAQI_CITIES}
            keyExtractor={(c) => c}
            renderItem={({ item: city }) => (
              <TouchableOpacity
                style={[styles.cityItem, selected === city && styles.cityItemActive]}
                onPress={() => { onSelect(city); onClose(); }}
              >
                <Text style={[styles.cityItemText, selected === city && styles.cityItemTextActive]}>
                  🏙️ {city}
                </Text>
                {selected === city && <Text style={styles.cityCheckmark}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function IntercityBrowseScreen() {
  const t = useT();
  const router = useRouter();
  const { passenger: passengerCtx, setIsBlockedOverlay } = usePassenger();
  // Use passengerCtx directly - no local passenger state needed
  const passenger = passengerCtx ? { id: passengerCtx.id, name: passengerCtx.name, phone: passengerCtx.phone } : null;
  const [fromFilter, setFromFilter] = useState("الكل");
  const [toFilter, setToFilter] = useState("الكل");
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [passengerNote, setPassengerNote] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

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
    // منع المحظورين من الحجز
    if (passengerCtx?.isBlocked) {
      setIsBlockedOverlay(true);
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

  // ملخص الفلتر
  const filterSummary = useMemo(() => {
    const from = fromFilter === "الكل" ? "أي مدينة" : fromFilter;
    const to = toFilter === "الكل" ? "أي مدينة" : toFilter;
    return `${from}  →  ${to}`;
  }, [fromFilter, toFilter]);

  const hasActiveFilter = fromFilter !== "الكل" || toFilter !== "الكل";

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.intercity.title}</Text>
        <TouchableOpacity onPress={() => router.push("/intercity/my-bookings")} style={styles.myBookingsBtn}>
          <Text style={styles.myBookingsBtnText}>حجوزاتي</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar - يبدو كـ Search field */}
      <View style={styles.searchSection}>
        <Text style={styles.searchLabel}>🔍 ابحث عن رحلة</Text>
        <View style={styles.searchRow}>
          {/* من */}
          <TouchableOpacity style={styles.citySelector} onPress={() => setShowFromPicker(true)}>
            <Text style={styles.citySelectorLabel}>من</Text>
            <Text style={[styles.citySelectorValue, fromFilter !== "الكل" && styles.citySelectorValueActive]}>
              {fromFilter === "الكل" ? "أي مدينة" : fromFilter}
            </Text>
            <Text style={styles.citySelectorArrow}>▼</Text>
          </TouchableOpacity>

          {/* سهم */}
          <View style={styles.searchArrowContainer}>
            <Text style={styles.searchArrow}>⇄</Text>
          </View>

          {/* إلى */}
          <TouchableOpacity style={styles.citySelector} onPress={() => setShowToPicker(true)}>
            <Text style={styles.citySelectorLabel}>إلى</Text>
            <Text style={[styles.citySelectorValue, toFilter !== "الكل" && styles.citySelectorValueActive]}>
              {toFilter === "الكل" ? "أي مدينة" : toFilter}
            </Text>
            <Text style={styles.citySelectorArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* إعادة تعيين */}
        {hasActiveFilter && (
          <TouchableOpacity
            style={styles.resetFilterBtn}
            onPress={() => { setFromFilter("الكل"); setToFilter("الكل"); }}
          >
            <Text style={styles.resetFilterText}>✕ إعادة تعيين الفلاتر</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* نتائج */}
      <View style={styles.resultsHeader}>
        {isLoading ? (
          <Text style={styles.resultsCount}>جاري البحث...</Text>
        ) : (
          <Text style={styles.resultsCount}>
            {trips?.length ?? 0} رحلة متاحة
            {hasActiveFilter ? ` · ${filterSummary}` : ""}
          </Text>
        )}
      </View>

      {/* Trips List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FFD700" size="large" />
          <Text style={styles.loadingText}>جاري البحث عن رحلات...</Text>
        </View>
      ) : !trips || trips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛣️</Text>
          <Text style={styles.emptyTitle}>{t.intercity.noTrips}</Text>
          <Text style={styles.emptyDesc}>
            {hasActiveFilter
              ? `لا توجد رحلات من ${fromFilter === "الكل" ? "أي مدينة" : fromFilter} إلى ${toFilter === "الكل" ? "أي مدينة" : toFilter}`
              : "لا توجد رحلات متاحة حالياً، تحقق لاحقاً"}
          </Text>
          {hasActiveFilter && (
            <TouchableOpacity
              style={styles.showAllBtn}
              onPress={() => { setFromFilter("الكل"); setToFilter("الكل"); }}
            >
              <Text style={styles.showAllBtnText}>عرض جميع الرحلات</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const urgency = item.availableSeats <= 2;
            const departed = new Date(item.departureTime).getTime() < Date.now();
            return (
              <View style={[styles.tripCard, urgency && styles.tripCardUrgent]}>
                {/* Route + Price */}
                <View style={styles.routeHeader}>
                  <View style={styles.routeInfo}>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 10, marginBottom: 2 }}>من</Text>
                      <Text style={styles.cityFrom}>{item.fromCity}</Text>
                    </View>
                    <Text style={styles.routeArrow}>→</Text>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 10, marginBottom: 2 }}>إلى</Text>
                      <Text style={styles.cityTo}>{item.toCity}</Text>
                    </View>
                  </View>
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>{parseInt(item.pricePerSeat).toLocaleString()}</Text>
                    <Text style={styles.priceUnit}>دينار/مقعد</Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Details */}
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailIcon}>📅</Text>
                    <Text style={styles.detailText}>{formatDate(item.departureTime)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailIcon}>⏱️</Text>
                    <Text style={[styles.detailText, departed && styles.detailTextDeparted]}>
                      {departed ? "انطلقت" : `تغادر خلال ${timeUntil(item.departureTime)}`}
                    </Text>
                  </View>
                </View>

                {/* Seats */}
                <View style={styles.seatsRow}>
                  <View style={[styles.seatsBadge, urgency ? styles.seatsBadgeRed : styles.seatsBadgeGreen]}>
                    <Text style={styles.seatsBadgeText}>
                      {urgency ? `🔥 ${item.availableSeats} مقاعد فقط!` : `💺 ${item.availableSeats} مقاعد متاحة`}
                    </Text>
                  </View>
                </View>

                {/* Meeting Point */}
                {item.meetingPoint ? (
                  <View style={styles.meetingPointRow}>
                    <Text style={styles.meetingPointIcon}>📌</Text>
                    <Text style={styles.meetingPointText}>{item.meetingPoint}</Text>
                  </View>
                ) : null}

                {/* Notes */}
                {item.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>📝 ملاحظات السائق:</Text>
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}

                {/* Book Button */}
                <TouchableOpacity
                  style={[styles.bookBtn, departed && styles.bookBtnDisabled]}
                  onPress={() => !departed && openBookingModal(item)}
                  disabled={departed}
                >
                  <Text style={styles.bookBtnText}>
                    {departed ? "⛔ الرحلة انطلقت" : "احجز مقعدك 🎫"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* City Pickers */}
      <CityPickerModal
        visible={showFromPicker}
        title="اختر مدينة الانطلاق"
        selected={fromFilter}
        onSelect={setFromFilter}
        onClose={() => setShowFromPicker(false)}
      />
      <CityPickerModal
        visible={showToPicker}
        title="اختر مدينة الوصول"
        selected={toFilter}
        onSelect={setToFilter}
        onClose={() => setShowToPicker(false)}
      />

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
                    {/* Route with from/to labels */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11, marginBottom: 3 }}>من</Text>
                        <Text style={styles.tripSummaryRoute}>{selectedTrip.fromCity}</Text>
                      </View>
                      <Text style={{ color: '#9B8EC4', fontSize: 22, marginTop: 14 }}>→</Text>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11, marginBottom: 3 }}>إلى</Text>
                        <Text style={styles.tripSummaryRoute}>{selectedTrip.toCity}</Text>
                      </View>
                    </View>
                    {/* Route Map */}
                    {CITY_COORDS[selectedTrip.fromCity] && CITY_COORDS[selectedTrip.toCity] && (() => {
                      const from = CITY_COORDS[selectedTrip.fromCity];
                      const to = CITY_COORDS[selectedTrip.toCity];
                      const midLat = (from.latitude + to.latitude) / 2;
                      const midLng = (from.longitude + to.longitude) / 2;
                      const latDelta = Math.abs(from.latitude - to.latitude) * 1.6 + 0.5;
                      const lngDelta = Math.abs(from.longitude - to.longitude) * 1.6 + 0.5;
                      return (
                        <View style={{ height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
                          <MapView
                            style={{ flex: 1 }}
                            provider={PROVIDER_DEFAULT}
                            initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                          >
                            <Polyline
                              coordinates={[from, to]}
                              strokeColor="#FFD700"
                              strokeWidth={3}
                              lineDashPattern={[8, 4]}
                            />
                            <Marker coordinate={from} title={selectedTrip.fromCity}>
                              <View style={{ backgroundColor: '#22C55E', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{selectedTrip.fromCity}</Text>
                              </View>
                            </Marker>
                            <Marker coordinate={to} title={selectedTrip.toCity}>
                              <View style={{ backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{selectedTrip.toCity}</Text>
                              </View>
                            </Marker>
                          </MapView>
                        </View>
                      );
                    })()}
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
                  <View style={styles.seatsSelector}>
                    <TouchableOpacity style={styles.seatBtn} onPress={() => setSeatsToBook((s) => Math.max(1, s - 1))}>
                      <Text style={styles.seatBtnText}>−</Text>
                    </TouchableOpacity>
                    <View style={styles.seatsCountContainer}>
                      <Text style={styles.seatsCount}>{seatsToBook}</Text>
                      <Text style={styles.seatsCountLabel}>مقعد</Text>
                    </View>
                    <TouchableOpacity style={styles.seatBtn} onPress={() => setSeatsToBook((s) => Math.min(selectedTrip.availableSeats, s + 1))}>
                      <Text style={styles.seatBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* GPS Location */}
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

                  {/* Passenger Note */}
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

  // Search Section
  searchSection: {
    backgroundColor: "#1E0A3C",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  searchLabel: { color: "#9B8EC4", fontSize: 12, marginBottom: 10 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  citySelector: {
    flex: 1,
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#3D2B6E",
  },
  citySelectorLabel: { color: "#9B8EC4", fontSize: 10, marginBottom: 2 },
  citySelectorValue: { color: "#C4B5E0", fontSize: 14, fontWeight: "600" },
  citySelectorValueActive: { color: "#FFD700", fontWeight: "800" },
  citySelectorArrow: { color: "#9B8EC4", fontSize: 10, position: "absolute", right: 10, top: 14 },
  searchArrowContainer: { alignItems: "center", justifyContent: "center", width: 32 },
  searchArrow: { color: "#FFD700", fontSize: 20 },
  resetFilterBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#2D1B4E",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  resetFilterText: { color: "#EF4444", fontSize: 12, fontWeight: "600" },

  // Results Header
  resultsHeader: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#1A0533" },
  resultsCount: { color: "#9B8EC4", fontSize: 12 },

  // Loading
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#9B8EC4", fontSize: 14 },

  // Empty State
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { color: "#FFD700", fontSize: 18, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center", marginBottom: 20 },
  showAllBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  showAllBtnText: { color: "#1A0533", fontSize: 14, fontWeight: "800" },

  // Trip Card
  tripCard: {
    backgroundColor: "#1E0A3C",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  tripCardUrgent: { borderColor: "#EF444466", borderWidth: 1.5 },
  routeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  routeInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  cityFrom: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  routeArrow: { color: "#9B8EC4", fontSize: 18 },
  cityTo: { color: "#E0D0FF", fontSize: 20, fontWeight: "bold" },
  priceTag: { backgroundColor: "#2D1B4E", borderRadius: 10, padding: 8, alignItems: "center", minWidth: 80 },
  priceText: { color: "#FFD700", fontSize: 15, fontWeight: "bold" },
  priceUnit: { color: "#9B8EC4", fontSize: 10 },
  divider: { height: 1, backgroundColor: "#2D1B4E", marginBottom: 10 },
  detailsGrid: { gap: 4, marginBottom: 8 },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailIcon: { fontSize: 13 },
  detailText: { color: "#C0A8E8", fontSize: 13 },
  detailTextDeparted: { color: "#EF4444" },
  seatsRow: { flexDirection: "row", marginBottom: 8 },
  seatsBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  seatsBadgeGreen: { backgroundColor: "#1B4D2E" },
  seatsBadgeRed: { backgroundColor: "#4D1B1B" },
  seatsBadgeText: { color: "#E0D0FF", fontSize: 12, fontWeight: "600" },
  meetingPointRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginBottom: 6 },
  meetingPointIcon: { fontSize: 13, marginTop: 1 },
  meetingPointText: { color: "#9B8EC4", fontSize: 12, flex: 1 },
  notesBox: { backgroundColor: "#2D1B4E", borderRadius: 8, padding: 10, marginBottom: 8 },
  notesLabel: { color: "#FFD700", fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  notesText: { color: "#C0A8E8", fontSize: 13 },
  bookBtn: { backgroundColor: "#FFD700", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  bookBtnDisabled: { backgroundColor: "#3D2B2B", opacity: 0.6 },
  bookBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "bold" },

  // City Picker Modal
  cityModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  cityModalContainer: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 30,
  },
  cityModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  cityModalTitle: { color: "#FFD700", fontSize: 17, fontWeight: "bold" },
  cityModalCloseBtn: { padding: 4 },
  cityModalCloseText: { color: "#9B8EC4", fontSize: 20 },
  cityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E22",
  },
  cityItemActive: { backgroundColor: "#2D1B4E" },
  cityItemText: { color: "#C4B5E0", fontSize: 15 },
  cityItemTextActive: { color: "#FFD700", fontWeight: "700" },
  cityCheckmark: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },

  // Booking Modal
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
  seatsSelector: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 4 },
  seatBtn: { backgroundColor: "#2D1B4E", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  seatBtnText: { color: "#FFD700", fontSize: 24, fontWeight: "bold" },
  seatsCountContainer: { alignItems: "center" },
  seatsCount: { color: "#FFD700", fontSize: 32, fontWeight: "bold" },
  seatsCountLabel: { color: "#9B8EC4", fontSize: 12 },
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

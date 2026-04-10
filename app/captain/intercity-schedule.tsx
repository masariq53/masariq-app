import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

// قائمة المدن العراقية
const IRAQI_CITIES = [
  "الموصل", "بغداد", "أربيل", "السليمانية", "كركوك",
  "البصرة", "النجف", "كربلاء", "الحلة", "الديوانية",
  "العمارة", "الناصرية", "الرمادي", "الفلوجة", "تكريت",
  "سامراء", "بعقوبة", "الكوت", "دهوك", "زاخو",
];

// ─── Date Picker Component ────────────────────────────────────────────────────
function DateTimePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  // Build year/month/day/hour/minute lists
  const now = new Date();
  const years = Array.from({ length: 2 }, (_, i) => now.getFullYear() + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from(
    { length: new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0).getDate() },
    (_, i) => i + 1
  );
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const formatDisplay = (d: Date) =>
    d.toLocaleDateString("ar-IQ", {
      weekday: "short", year: "numeric", month: "long", day: "numeric",
    }) + "  " + d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

  const confirm = () => {
    onChange(tempDate);
    setShowModal(false);
  };

  const setField = (field: string, val: number) => {
    const d = new Date(tempDate);
    if (field === "year") d.setFullYear(val);
    if (field === "month") d.setMonth(val - 1);
    if (field === "day") d.setDate(val);
    if (field === "hour") d.setHours(val);
    if (field === "minute") d.setMinutes(val);
    setTempDate(d);
  };

  return (
    <>
      <TouchableOpacity style={styles.dateBtn} onPress={() => { setTempDate(value); setShowModal(true); }}>
        <Text style={styles.dateBtnIcon}>📅</Text>
        <Text style={styles.dateBtnText}>{formatDisplay(value)}</Text>
        <Text style={styles.dateBtnChevron}>▼</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>اختر التاريخ والوقت</Text>

            {/* Date Row */}
            <View style={styles.pickerRow}>
              {/* Year */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>السنة</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[styles.pickerItem, tempDate.getFullYear() === y && styles.pickerItemActive]}
                      onPress={() => setField("year", y)}>
                      <Text style={[styles.pickerItemText, tempDate.getFullYear() === y && styles.pickerItemTextActive]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {/* Month */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>الشهر</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {months.map(m => (
                    <TouchableOpacity key={m} style={[styles.pickerItem, (tempDate.getMonth() + 1) === m && styles.pickerItemActive]}
                      onPress={() => setField("month", m)}>
                      <Text style={[styles.pickerItemText, (tempDate.getMonth() + 1) === m && styles.pickerItemTextActive]}>
                        {new Date(2000, m - 1).toLocaleString("ar", { month: "short" })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {/* Day */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>اليوم</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {days.map(d => (
                    <TouchableOpacity key={d} style={[styles.pickerItem, tempDate.getDate() === d && styles.pickerItemActive]}
                      onPress={() => setField("day", d)}>
                      <Text style={[styles.pickerItemText, tempDate.getDate() === d && styles.pickerItemTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {/* Hour */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>الساعة</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {hours.map(h => (
                    <TouchableOpacity key={h} style={[styles.pickerItem, tempDate.getHours() === h && styles.pickerItemActive]}
                      onPress={() => setField("hour", h)}>
                      <Text style={[styles.pickerItemText, tempDate.getHours() === h && styles.pickerItemTextActive]}>
                        {String(h).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {/* Minute */}
              <View style={styles.pickerCol}>
                <Text style={styles.pickerColLabel}>الدقيقة</Text>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                  {minutes.map(m => (
                    <TouchableOpacity key={m} style={[styles.pickerItem, tempDate.getMinutes() === m && styles.pickerItemActive]}
                      onPress={() => setField("minute", m)}>
                      <Text style={[styles.pickerItemText, tempDate.getMinutes() === m && styles.pickerItemTextActive]}>
                        {String(m).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Preview */}
            <Text style={styles.pickerPreview}>{formatDisplay(tempDate)}</Text>

            <View style={styles.pickerBtns}>
              <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.pickerCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerConfirmBtn} onPress={confirm}>
                <Text style={styles.pickerConfirmText}>تأكيد ✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function IntercityScheduleScreen() {
  const router = useRouter();
  const { driver } = useDriver();
  const driverId = driver?.id ?? null;

  const [fromCity, setFromCity] = useState("الموصل");
  const [toCity, setToCity] = useState("");
  const [departureDate, setDepartureDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [totalSeats, setTotalSeats] = useState("4");
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [notes, setNotes] = useState("");
  const [showFromCities, setShowFromCities] = useState(false);
  const [showToCities, setShowToCities] = useState(false);

  const scheduleTrip = trpc.intercity.scheduleTrip.useMutation({
    onSuccess: () => {
      Alert.alert("✅ تم الجدولة", "تم نشر رحلتك بنجاح وستظهر للمستخدمين الآن", [
        { text: "عرض رحلاتي", onPress: () => router.replace("/captain/intercity-trips") },
        { text: "إغلاق", onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert("خطأ", err.message),
  });

  const handleSubmit = () => {
    if (!driverId) { Alert.alert("خطأ", "يجب تسجيل الدخول كسائق أولاً"); return; }
    if (!fromCity || !toCity) { Alert.alert("خطأ", "يرجى اختيار مدينة المغادرة والوجهة"); return; }
    if (fromCity === toCity) { Alert.alert("خطأ", "مدينة المغادرة والوجهة لا يمكن أن تكونا نفس المدينة"); return; }
    if (!pricePerSeat || isNaN(Number(pricePerSeat)) || Number(pricePerSeat) <= 0) {
      Alert.alert("خطأ", "يرجى إدخال سعر صحيح للمقعد"); return;
    }
    if (departureDate <= new Date()) { Alert.alert("خطأ", "وقت المغادرة يجب أن يكون في المستقبل"); return; }

    scheduleTrip.mutate({
      driverId,
      fromCity,
      toCity,
      departureTime: departureDate.toISOString(),
      totalSeats: parseInt(totalSeats) || 4,
      pricePerSeat: parseInt(pricePerSeat),
      meetingPoint: meetingPoint || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>جدولة رحلة بين مدن</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* From City */}
        <View style={styles.card}>
          <Text style={styles.label}>🏙️ مدينة المغادرة</Text>
          <TouchableOpacity
            style={styles.citySelector}
            onPress={() => { setShowFromCities(!showFromCities); setShowToCities(false); }}
          >
            <Text style={styles.citySelectorText}>{fromCity || "اختر المدينة"}</Text>
            <Text style={styles.chevron}>{showFromCities ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {showFromCities && (
            <View style={styles.cityDropdown}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {IRAQI_CITIES.filter(c => c !== toCity).map(city => (
                  <TouchableOpacity key={city}
                    style={[styles.cityOption, fromCity === city && styles.cityOptionActive]}
                    onPress={() => { setFromCity(city); setShowFromCities(false); }}>
                    <Text style={[styles.cityOptionText, fromCity === city && styles.cityOptionTextActive]}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* To City */}
        <View style={styles.card}>
          <Text style={styles.label}>📍 مدينة الوصول</Text>
          <TouchableOpacity
            style={styles.citySelector}
            onPress={() => { setShowToCities(!showToCities); setShowFromCities(false); }}
          >
            <Text style={[styles.citySelectorText, !toCity && { color: "#6B7280" }]}>
              {toCity || "اختر الوجهة"}
            </Text>
            <Text style={styles.chevron}>{showToCities ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {showToCities && (
            <View style={styles.cityDropdown}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {IRAQI_CITIES.filter(c => c !== fromCity).map(city => (
                  <TouchableOpacity key={city}
                    style={[styles.cityOption, toCity === city && styles.cityOptionActive]}
                    onPress={() => { setToCity(city); setShowToCities(false); }}>
                    <Text style={[styles.cityOptionText, toCity === city && styles.cityOptionTextActive]}>{city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Date & Time — Visual Picker */}
        <View style={styles.card}>
          <Text style={styles.label}>📅 تاريخ ووقت المغادرة</Text>
          <DateTimePicker value={departureDate} onChange={setDepartureDate} />
        </View>

        {/* Seats & Price */}
        <View style={styles.card}>
          <Text style={styles.label}>💺 المقاعد والسعر</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.subLabel}>عدد المقاعد</Text>
              <View style={styles.seatsRow}>
                {["1","2","3","4","5","6","7"].map(n => (
                  <TouchableOpacity key={n}
                    style={[styles.seatChip, totalSeats === n && styles.seatChipActive]}
                    onPress={() => setTotalSeats(n)}>
                    <Text style={[styles.seatChipText, totalSeats === n && styles.seatChipTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>سعر المقعد (دينار)</Text>
              <TextInput
                style={styles.input}
                placeholder="15000"
                placeholderTextColor="#6B7280"
                value={pricePerSeat}
                onChangeText={setPricePerSeat}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </View>
          </View>
        </View>

        {/* Meeting Point */}
        <View style={styles.card}>
          <Text style={styles.label}>📌 نقطة التجمع (اختياري)</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: أمام محطة الوقود الرئيسية"
            placeholderTextColor="#6B7280"
            value={meetingPoint}
            onChangeText={setMeetingPoint}
            returnKeyType="next"
          />
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.label}>📝 ملاحظات للمسافرين (اختياري)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder="أي معلومات إضافية للمسافرين مثل: لا يُسمح بالتدخين، يوجد مكيف..."
            placeholderTextColor="#6B7280"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Summary */}
        {fromCity && toCity && pricePerSeat ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ملخص الرحلة</Text>
            <Text style={styles.summaryRow}>🛣️ {fromCity} ← {toCity}</Text>
            <Text style={styles.summaryRow}>
              🕐 {departureDate.toLocaleDateString("ar-IQ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {"  "}{departureDate.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
            </Text>
            <Text style={styles.summaryRow}>💺 {totalSeats} مقاعد × {parseInt(pricePerSeat || "0").toLocaleString()} دينار</Text>
            <Text style={styles.summaryTotal}>
              إجمالي محتمل: {(parseInt(totalSeats) * parseInt(pricePerSeat || "0")).toLocaleString()} دينار
            </Text>
          </View>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, scheduleTrip.isPending && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={scheduleTrip.isPending}
        >
          {scheduleTrip.isPending ? (
            <ActivityIndicator color="#1A0533" />
          ) : (
            <Text style={styles.submitText}>🚀 نشر الرحلة</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingTop: 4 },
  backBtn: { padding: 8 },
  backIcon: { color: "#FFD700", fontSize: 22 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  card: { backgroundColor: "#1E1035", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#2D1B4E" },
  label: { color: "#FFD700", fontSize: 14, fontWeight: "700", marginBottom: 10 },
  subLabel: { color: "#9B8EC4", fontSize: 12, marginBottom: 6 },
  citySelector: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#2D1B4E", borderRadius: 10, padding: 12 },
  citySelectorText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  chevron: { color: "#9B8EC4", fontSize: 12 },
  cityDropdown: { backgroundColor: "#2D1B4E", borderRadius: 10, marginTop: 6, overflow: "hidden" },
  cityOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#1E1035" },
  cityOptionActive: { backgroundColor: "#FFD70022" },
  cityOptionText: { color: "#FFFFFF", fontSize: 14 },
  cityOptionTextActive: { color: "#FFD700", fontWeight: "700" },
  // Date Picker Button
  dateBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#2D1B4E", borderRadius: 10, padding: 14, gap: 10 },
  dateBtnIcon: { fontSize: 20 },
  dateBtnText: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  dateBtnChevron: { color: "#9B8EC4", fontSize: 12 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  pickerModal: { backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  pickerTitle: { color: "#FFD700", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 16 },
  pickerRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  pickerCol: { flex: 1, alignItems: "center" },
  pickerColLabel: { color: "#9B8EC4", fontSize: 11, marginBottom: 6, fontWeight: "600" },
  pickerScroll: { maxHeight: 160, width: "100%" },
  pickerItem: { paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, alignItems: "center", marginBottom: 2 },
  pickerItemActive: { backgroundColor: "#FFD700" },
  pickerItemText: { color: "#FFFFFF", fontSize: 13 },
  pickerItemTextActive: { color: "#1A0533", fontWeight: "800" },
  pickerPreview: { color: "#FFFFFF", textAlign: "center", fontSize: 13, marginBottom: 16, backgroundColor: "#2D1B4E", padding: 10, borderRadius: 10 },
  pickerBtns: { flexDirection: "row", gap: 12 },
  pickerCancelBtn: { flex: 1, backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14, alignItems: "center" },
  pickerCancelText: { color: "#9B8EC4", fontSize: 15, fontWeight: "700" },
  pickerConfirmBtn: { flex: 1, backgroundColor: "#FFD700", borderRadius: 12, padding: 14, alignItems: "center" },
  pickerConfirmText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  // Form
  row: { flexDirection: "row", gap: 12 },
  input: { backgroundColor: "#2D1B4E", borderRadius: 10, padding: 12, color: "#FFFFFF", fontSize: 14, borderWidth: 1, borderColor: "#3D2B5E" },
  seatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  seatChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#3D2B5E" },
  seatChipActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  seatChipText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  seatChipTextActive: { color: "#1A0533", fontWeight: "800" },
  summaryCard: { backgroundColor: "#0D1F3C", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#1E3A5F" },
  summaryTitle: { color: "#60A5FA", fontSize: 14, fontWeight: "700", marginBottom: 10 },
  summaryRow: { color: "#FFFFFF", fontSize: 13, marginBottom: 6 },
  summaryTotal: { color: "#FFD700", fontSize: 15, fontWeight: "800", marginTop: 6 },
  submitBtn: { backgroundColor: "#FFD700", borderRadius: 16, padding: 18, alignItems: "center", marginTop: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: "#1A0533", fontSize: 16, fontWeight: "800" },
});

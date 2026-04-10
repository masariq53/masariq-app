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

export default function IntercityScheduleScreen() {
  const router = useRouter();
  const { driver } = useDriver();
  const driverId = driver?.id ?? null;
  const [fromCity, setFromCity] = useState("الموصل");
  const [toCity, setToCity] = useState("");
  const [departureDate, setDepartureDate] = useState(""); // YYYY-MM-DD
  const [departureTime, setDepartureTime] = useState(""); // HH:MM
  const [totalSeats, setTotalSeats] = useState("4");
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [meetingPoint, setMeetingPoint] = useState("");
  const [notes, setNotes] = useState("");
  const [showFromCities, setShowFromCities] = useState(false);
  const [showToCities, setShowToCities] = useState(false);
  const [loading, setLoading] = useState(false);

  const scheduleTrip = trpc.intercity.scheduleTrip.useMutation({
    onSuccess: () => {
      Alert.alert("✅ تم الجدولة", "تم نشر رحلتك بنجاح وستظهر للمستخدمين الآن", [
        { text: "عرض رحلاتي", onPress: () => router.replace("/captain/intercity-trips") },
        { text: "إغلاق", onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      Alert.alert("خطأ", err.message);
    },
  });

  const handleSubmit = async () => {
    if (!driverId) {
      Alert.alert("خطأ", "يجب تسجيل الدخول كسائق أولاً");
      return;
    }
    if (!fromCity || !toCity) {
      Alert.alert("خطأ", "يرجى اختيار مدينة المغادرة والوجهة");
      return;
    }
    if (fromCity === toCity) {
      Alert.alert("خطأ", "مدينة المغادرة والوجهة لا يمكن أن تكونا نفس المدينة");
      return;
    }
    if (!departureDate || !departureTime) {
      Alert.alert("خطأ", "يرجى تحديد تاريخ ووقت المغادرة");
      return;
    }
    if (!pricePerSeat || isNaN(Number(pricePerSeat)) || Number(pricePerSeat) <= 0) {
      Alert.alert("خطأ", "يرجى إدخال سعر صحيح للمقعد");
      return;
    }

    const departureISO = new Date(`${departureDate}T${departureTime}:00`).toISOString();
    if (new Date(departureISO) <= new Date()) {
      Alert.alert("خطأ", "وقت المغادرة يجب أن يكون في المستقبل");
      return;
    }

    setLoading(true);
    scheduleTrip.mutate({
      driverId,
      fromCity,
      toCity,
      departureTime: departureISO,
      totalSeats: parseInt(totalSeats) || 4,
      pricePerSeat: parseInt(pricePerSeat),
      meetingPoint: meetingPoint || undefined,
      notes: notes || undefined,
    });
    setLoading(false);
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
                  <TouchableOpacity
                    key={city}
                    style={[styles.cityOption, fromCity === city && styles.cityOptionActive]}
                    onPress={() => { setFromCity(city); setShowFromCities(false); }}
                  >
                    <Text style={[styles.cityOptionText, fromCity === city && styles.cityOptionTextActive]}>
                      {city}
                    </Text>
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
                  <TouchableOpacity
                    key={city}
                    style={[styles.cityOption, toCity === city && styles.cityOptionActive]}
                    onPress={() => { setToCity(city); setShowToCities(false); }}
                  >
                    <Text style={[styles.cityOptionText, toCity === city && styles.cityOptionTextActive]}>
                      {city}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Date & Time */}
        <View style={styles.card}>
          <Text style={styles.label}>📅 تاريخ ووقت المغادرة</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.subLabel}>التاريخ (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2025-12-31"
                placeholderTextColor="#6B7280"
                value={departureDate}
                onChangeText={setDepartureDate}
                keyboardType="numbers-and-punctuation"
                returnKeyType="next"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLabel}>الوقت (HH:MM)</Text>
              <TextInput
                style={styles.input}
                placeholder="08:00"
                placeholderTextColor="#6B7280"
                value={departureTime}
                onChangeText={setDepartureTime}
                keyboardType="numbers-and-punctuation"
                returnKeyType="next"
              />
            </View>
          </View>
        </View>

        {/* Seats & Price */}
        <View style={styles.card}>
          <Text style={styles.label}>💺 المقاعد والسعر</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.subLabel}>عدد المقاعد</Text>
              <View style={styles.seatsRow}>
                {["1","2","3","4","5","6","7"].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.seatChip, totalSeats === n && styles.seatChipActive]}
                    onPress={() => setTotalSeats(n)}
                  >
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
          <Text style={styles.label}>📝 ملاحظات (اختياري)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: "top" }]}
            placeholder="أي معلومات إضافية للمسافرين..."
            placeholderTextColor="#6B7280"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Summary */}
        {fromCity && toCity && pricePerSeat && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ملخص الرحلة</Text>
            <Text style={styles.summaryRow}>🛣️ {fromCity} ← {toCity}</Text>
            {departureDate && departureTime && (
              <Text style={styles.summaryRow}>🕐 {departureDate} الساعة {departureTime}</Text>
            )}
            <Text style={styles.summaryRow}>💺 {totalSeats} مقاعد × {parseInt(pricePerSeat || "0").toLocaleString()} دينار</Text>
            <Text style={styles.summaryTotal}>
              إجمالي محتمل: {(parseInt(totalSeats) * parseInt(pricePerSeat || "0")).toLocaleString()} دينار
            </Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (scheduleTrip.isPending || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={scheduleTrip.isPending || loading}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingTop: 4,
  },
  backBtn: { padding: 8 },
  backIcon: { color: "#FFD700", fontSize: 22 },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  card: {
    backgroundColor: "#1E1035",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  label: { color: "#FFD700", fontSize: 14, fontWeight: "700", marginBottom: 10 },
  subLabel: { color: "#9B8EC4", fontSize: 11, marginBottom: 6 },
  input: {
    backgroundColor: "#0F0A1E",
    borderRadius: 10,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  row: { flexDirection: "row", gap: 8 },
  citySelector: {
    backgroundColor: "#0F0A1E",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  citySelectorText: { color: "#FFFFFF", fontSize: 14 },
  chevron: { color: "#9B8EC4", fontSize: 12 },
  cityDropdown: {
    backgroundColor: "#0F0A1E",
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#2D1B4E",
    overflow: "hidden",
  },
  cityOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#1E1035" },
  cityOptionActive: { backgroundColor: "#2D1B4E" },
  cityOptionText: { color: "#FFFFFF", fontSize: 14 },
  cityOptionTextActive: { color: "#FFD700", fontWeight: "700" },
  seatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  seatChip: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#0F0A1E", borderWidth: 1, borderColor: "#2D1B4E",
    alignItems: "center", justifyContent: "center",
  },
  seatChipActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  seatChipText: { color: "#9B8EC4", fontSize: 13, fontWeight: "600" },
  seatChipTextActive: { color: "#1A0533" },
  summaryCard: {
    backgroundColor: "#0F0A1E",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  summaryTitle: { color: "#FFD700", fontSize: 14, fontWeight: "700", marginBottom: 10 },
  summaryRow: { color: "#FFFFFF", fontSize: 13, marginBottom: 6 },
  summaryTotal: { color: "#4ADE80", fontSize: 15, fontWeight: "700", marginTop: 8 },
  submitBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#1A0533", fontSize: 16, fontWeight: "800" },
});

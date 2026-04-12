import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";

const PARCEL_SIZES = [
  { id: "small", icon: "📦", label: "صغير", desc: "حتى 2 كغ", example: "مستندات، ملابس" },
  { id: "medium", icon: "🗃️", label: "متوسط", desc: "2-10 كغ", example: "أجهزة صغيرة، كتب" },
  { id: "large", icon: "📫", label: "كبير", desc: "10-30 كغ", example: "أجهزة كهربائية" },
];

const IRAQI_CITIES = [
  "الموصل", "بغداد", "البصرة", "أربيل", "السليمانية", "دهوك",
  "كركوك", "النجف", "كربلاء", "الحلة", "الرمادي", "تكريت",
  "الناصرية", "العمارة", "الديوانية", "سامراء", "بعقوبة",
];

type DeliveryType = "instant" | "scheduled" | "intercity";

export default function NewDeliveryScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = usePassenger();
  const params = useLocalSearchParams<{ type: string }>();
  const deliveryType = (params.type as DeliveryType) ?? "instant";

  const [parcelSize, setParcelSize] = useState("small");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [originCity, setOriginCity] = useState("الموصل");
  const [showCityPicker, setShowCityPicker] = useState<"origin" | "destination" | null>(null);

  const createParcel = trpc.parcel.create.useMutation({
    onSuccess: (data: any) => {
      router.replace({ pathname: "/delivery/tracking" as any, params: { parcelId: data.id } });
    },
    onError: (err: any) => {
      Alert.alert("خطأ", err.message || "حدث خطأ أثناء إنشاء الطلب");
    },
  });

  const TITLE_MAP: Record<DeliveryType, string> = {
    instant: "⚡ توصيل فوري",
    scheduled: "📅 توصيل مجدول",
    intercity: "🚚 توصيل بين المدن",
  };

  const handleSubmit = () => {
    if (!pickupAddress.trim()) { Alert.alert("تنبيه", "أدخل عنوان الاستلام"); return; }
    if (!dropoffAddress.trim()) { Alert.alert("تنبيه", "أدخل عنوان التسليم"); return; }
    if (!recipientName.trim()) { Alert.alert("تنبيه", "أدخل اسم المستلم"); return; }
    if (!recipientPhone.trim()) { Alert.alert("تنبيه", "أدخل رقم هاتف المستلم"); return; }
    if (deliveryType === "scheduled" && !scheduledTime.trim()) { Alert.alert("تنبيه", "حدد وقت التوصيل المطلوب"); return; }
    if (deliveryType === "intercity" && !destinationCity) { Alert.alert("تنبيه", "اختر مدينة الوجهة"); return; }

    createParcel.mutate({
      senderId: passenger!.id,
      senderName: passenger!.name || "المرسل",
      senderPhone: passenger!.phone || "",
      deliveryType,
      parcelSize: parcelSize as "small" | "medium" | "large",
      pickupAddress,
      dropoffAddress,
      recipientName,
      recipientPhone,
      parcelDescription: notes || undefined,
      scheduledTimeSlot: scheduledTime || undefined,
      fromCity: deliveryType === "intercity" ? originCity : undefined,
      toCity: deliveryType === "intercity" ? destinationCity : undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#1A0533" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{TITLE_MAP[deliveryType]}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Parcel Size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>حجم الطرد</Text>
          <View style={styles.sizesRow}>
            {PARCEL_SIZES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.sizeCard, parcelSize === s.id && styles.sizeCardActive]}
                onPress={() => setParcelSize(s.id)}
              >
                <Text style={styles.sizeIcon}>{s.icon}</Text>
                <Text style={[styles.sizeLabel, parcelSize === s.id && styles.sizeLabelActive]}>{s.label}</Text>
                <Text style={[styles.sizeDesc, parcelSize === s.id && styles.sizeDescActive]}>{s.desc}</Text>
                <Text style={[styles.sizeExample, parcelSize === s.id && styles.sizeExampleActive]}>{s.example}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Intercity city selection */}
        {deliveryType === "intercity" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>المدن</Text>
            <View style={styles.citiesRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cityLabel}>من</Text>
                <TouchableOpacity style={styles.cityPicker} onPress={() => setShowCityPicker("origin")}>
                  <Text style={styles.cityPickerText}>{originCity}</Text>
                  <Text style={styles.cityPickerArrow}>▼</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cityArrow}>→</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cityLabel}>إلى</Text>
                <TouchableOpacity
                  style={[styles.cityPicker, !destinationCity && styles.cityPickerEmpty]}
                  onPress={() => setShowCityPicker("destination")}
                >
                  <Text style={[styles.cityPickerText, !destinationCity && { color: "#9BA1A6" }]}>
                    {destinationCity || "اختر المدينة"}
                  </Text>
                  <Text style={styles.cityPickerArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
            {showCityPicker && (
              <View style={styles.cityPickerModal}>
                <Text style={styles.cityPickerModalTitle}>
                  {showCityPicker === "origin" ? "اختر مدينة الإرسال" : "اختر مدينة الوجهة"}
                </Text>
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {IRAQI_CITIES.map((city) => (
                    <TouchableOpacity
                      key={city}
                      style={styles.cityOption}
                      onPress={() => {
                        if (showCityPicker === "origin") setOriginCity(city);
                        else setDestinationCity(city);
                        setShowCityPicker(null);
                      }}
                    >
                      <Text style={styles.cityOptionText}>{city}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>العناوين</Text>
          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: "#22C55E" }]} />
              <TextInput
                style={styles.addressInput}
                placeholder="عنوان الاستلام (من أين؟)"
                placeholderTextColor="#6B5B8A"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                textAlign="right"
              />
            </View>
            <View style={styles.addressDivider} />
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
              <TextInput
                style={styles.addressInput}
                placeholder="عنوان التسليم (إلى أين؟)"
                placeholderTextColor="#6B5B8A"
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                textAlign="right"
              />
            </View>
          </View>
        </View>

        {/* Recipient */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات المستلم</Text>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="اسم المستلم"
              placeholderTextColor="#6B5B8A"
              value={recipientName}
              onChangeText={setRecipientName}
              textAlign="right"
            />
            <TextInput
              style={styles.input}
              placeholder="رقم هاتف المستلم"
              placeholderTextColor="#6B5B8A"
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              keyboardType="phone-pad"
              textAlign="right"
            />
          </View>
        </View>

        {/* Scheduled time */}
        {deliveryType === "scheduled" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>وقت التوصيل المطلوب</Text>
            <TextInput
              style={styles.input}
              placeholder="مثال: بعد الظهر بين 2-4 عصراً"
              placeholderTextColor="#6B5B8A"
              value={scheduledTime}
              onChangeText={setScheduledTime}
              textAlign="right"
            />
            <Text style={styles.hint}>سيتواصل معك المندوب لتأكيد الموعد</Text>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملاحظات (اختياري)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="أي تعليمات خاصة للكابتن..."
            placeholderTextColor="#6B5B8A"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlign="right"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, createParcel.isPending && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={createParcel.isPending}
        >
          {createParcel.isPending ? (
            <ActivityIndicator color="#1A0533" />
          ) : (
            <Text style={styles.submitBtnText}>
              {deliveryType === "instant" ? "⚡ إرسال الطلب الآن" :
               deliveryType === "scheduled" ? "📅 تأكيد الموعد" : "🚚 إرسال الطرد"}
            </Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#1A0533",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#2D1B69", alignItems: "center", justifyContent: "center",
  },
  backIcon: { color: "#FFD700", fontSize: 16, fontWeight: "bold" },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  scroll: { flex: 1, backgroundColor: "#1A0533" },
  scrollContent: { paddingBottom: 20 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 12 },
  sizesRow: { flexDirection: "row", gap: 10 },
  sizeCard: {
    flex: 1, backgroundColor: "#2D1B69", borderRadius: 14, padding: 12,
    alignItems: "center", gap: 3, borderWidth: 1.5, borderColor: "#3D2580",
  },
  sizeCardActive: {
    borderColor: "#FFD700", backgroundColor: "#1A0533",
    shadowColor: "#FFD700", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  sizeIcon: { fontSize: 24, marginBottom: 4 },
  sizeLabel: { color: "#C4B5D4", fontSize: 13, fontWeight: "700" },
  sizeLabelActive: { color: "#FFD700" },
  sizeDesc: { color: "#6B5B8A", fontSize: 10 },
  sizeDescActive: { color: "#FFD700", opacity: 0.8 },
  sizeExample: { color: "#4A3B6A", fontSize: 9, textAlign: "center" },
  sizeExampleActive: { color: "#FFD700", opacity: 0.6 },
  citiesRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  cityLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "right", marginBottom: 6 },
  cityPicker: {
    backgroundColor: "#2D1B69", borderRadius: 12, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: "#3D2580",
  },
  cityPickerEmpty: { borderColor: "#EF4444", borderStyle: "dashed" },
  cityPickerText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  cityPickerArrow: { color: "#9B8AB0", fontSize: 10 },
  cityArrow: { color: "#FFD700", fontSize: 20, marginBottom: 14, paddingHorizontal: 4 },
  cityPickerModal: {
    backgroundColor: "#2D1B69", borderRadius: 14, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: "#3D2580",
  },
  cityPickerModalTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textAlign: "right", marginBottom: 8 },
  cityOption: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#3D2580" },
  cityOptionText: { color: "#C4B5D4", fontSize: 14, textAlign: "right" },
  addressCard: { backgroundColor: "#2D1B69", borderRadius: 16, padding: 16 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  addressInput: { flex: 1, color: "#FFFFFF", fontSize: 14, paddingVertical: 8 },
  addressDivider: { height: 1, backgroundColor: "#3D2580", marginVertical: 8, marginLeft: 22 },
  inputGroup: { gap: 10 },
  input: {
    backgroundColor: "#2D1B69", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: "#FFFFFF", fontSize: 14, borderWidth: 1, borderColor: "#3D2580",
  },
  notesInput: { height: 80, textAlignVertical: "top", paddingTop: 14 },
  hint: { color: "#9B8AB0", fontSize: 11, textAlign: "right", marginTop: 6 },
  submitBtn: {
    marginHorizontal: 20, marginTop: 24, backgroundColor: "#FFD700",
    paddingVertical: 18, borderRadius: 16, alignItems: "center",
    shadowColor: "#FFD700", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#1A0533", fontSize: 17, fontWeight: "800" },
});

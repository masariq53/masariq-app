import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { WebView } from "react-native-webview";
import { Platform } from "react-native";

// ─── Types ─────────────────────────────────────────────────────────────────────
type PricingMethod = "per_km" | "per_minute" | "hybrid" | "zones";
type VehicleType = "sedan" | "suv" | "minivan" | "all";

// دائرة زون واحدة
interface ZoneCircle {
  name: string;      // اسم الزون مثل "المركز"
  lat: number;       // خط العرض للمركز
  lng: number;       // خط الطول للمركز
  radiusKm: number;  // نصف القطر بالكيلومتر
  flatFare: number;  // الأجرة الثابتة بالدينار
}

interface ZoneForm {
  cityName: string;
  cityNameAr: string;
  isActive: boolean;
  isDefault: boolean;
  pricingMethod: PricingMethod;
  vehicleType: VehicleType;
  baseFare: string;
  pricePerKm: string;
  pricePerMinute: string;
  minimumFare: string;
  maximumFare: string;
  surgeMultiplier: string;
  nightSurchargeStart: string;
  nightSurchargeEnd: string;
  nightSurchargeAmount: string;
  bookingFee: string;
  freeWaitMinutes: string;
  waitPricePerMinute: string;
  cancellationFee: string;
  captainRadiusKm: string;
  zonesConfig: ZoneCircle[];
  notes: string;
}

const DEFAULT_FORM: ZoneForm = {
  cityName: "",
  cityNameAr: "",
  isActive: true,
  isDefault: false,
  pricingMethod: "per_km",
  vehicleType: "all",
  baseFare: "2000",
  pricePerKm: "1000",
  pricePerMinute: "100",
  minimumFare: "3000",
  maximumFare: "0",
  surgeMultiplier: "1.00",
  nightSurchargeStart: "",
  nightSurchargeEnd: "",
  nightSurchargeAmount: "0",
  bookingFee: "0",
  freeWaitMinutes: "3",
  waitPricePerMinute: "0",
  cancellationFee: "0",
  captainRadiusKm: "2.00",
  zonesConfig: [],
  notes: "",
};

const PRICING_METHOD_LABELS: Record<PricingMethod, string> = {
  per_km: "📏 بالكيلومتر",
  per_minute: "⏱️ بالدقيقة",
  hybrid: "🔀 هجين (كم + دقيقة)",
  zones: "🎯 زونات (سعر ثابت)",
};

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  all: "🚗 جميع الأنواع",
  sedan: "🚗 سيدان",
  suv: "🚙 SUV",
  minivan: "🚐 ميني فان",
};

// قائمة المدن العراقية مع الإحداثيات الافتراضية
const IRAQI_CITIES_DATA: { ar: string; en: string; lat: number; lng: number }[] = [
  { ar: "الموصل",      en: "Mosul",       lat: 36.3359, lng: 43.1189 },
  { ar: "بغداد",       en: "Baghdad",     lat: 33.3152, lng: 44.3661 },
  { ar: "أربيل",       en: "Erbil",       lat: 36.1901, lng: 44.0091 },
  { ar: "السليمانية",  en: "Sulaymaniyah",lat: 35.5575, lng: 45.4329 },
  { ar: "كركوك",       en: "Kirkuk",      lat: 35.4681, lng: 44.3922 },
  { ar: "البصرة",      en: "Basra",       lat: 30.5085, lng: 47.7804 },
  { ar: "النجف",       en: "Najaf",       lat: 31.9936, lng: 44.3218 },
  { ar: "كربلاء",      en: "Karbala",     lat: 32.6166, lng: 44.0247 },
  { ar: "الحلة",       en: "Hilla",       lat: 32.4769, lng: 44.4422 },
  { ar: "الديوانية",   en: "Diwaniyah",   lat: 31.9887, lng: 44.9268 },
  { ar: "العمارة",     en: "Amarah",      lat: 31.8408, lng: 47.1508 },
  { ar: "الناصرية",    en: "Nasiriyah",   lat: 31.0433, lng: 46.2592 },
  { ar: "الرمادي",     en: "Ramadi",      lat: 33.4258, lng: 43.2997 },
  { ar: "تكريت",       en: "Tikrit",      lat: 34.5989, lng: 43.6786 },
  { ar: "دهوك",        en: "Duhok",       lat: 36.8669, lng: 42.9503 },
  { ar: "زاخو",        en: "Zakho",       lat: 37.1445, lng: 42.6838 },
  { ar: "سامراء",      en: "Samarra",     lat: 34.1987, lng: 43.8741 },
  { ar: "بعقوبة",      en: "Baqubah",     lat: 33.7456, lng: 44.6498 },
  { ar: "الكوت",       en: "Kut",         lat: 32.5000, lng: 45.8333 },
  { ar: "الفلوجة",     en: "Fallujah",    lat: 33.3500, lng: 43.7833 },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "—";
  const n = parseFloat(val.toString());
  return isNaN(n) ? "—" : n.toLocaleString("ar-IQ");
}

function fmtIQD(val: string | number | null | undefined): string {
  const n = parseFloat((val ?? "0").toString());
  if (isNaN(n) || n === 0) return "—";
  return `${n.toLocaleString("ar-IQ")} د.ع`;
}

// ─── Zone Card ─────────────────────────────────────────────────────────────────────
type ZoneData = {
  id: number;
  cityName: string;
  cityNameAr: string;
  isActive: boolean;
  isDefault: boolean;
  pricingMethod: PricingMethod;
  vehicleType: VehicleType;
  baseFare: string;
  pricePerKm: string;
  pricePerMinute: string;
  minimumFare: string;
  maximumFare: string;
  surgeMultiplier: string;
  nightSurchargeStart: string | null;
  nightSurchargeEnd: string | null;
  nightSurchargeAmount: string | null;
  bookingFee: string;
  freeWaitMinutes: number;
  waitPricePerMinute: string;
  cancellationFee: string;
  captainRadiusKm: string | null;
  zonesConfig: string | null; // JSON string
  notes: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function ZoneCard({
  zone,
  onEdit,
  onDelete,
  onHistory,
  onPreview,
}: {
  zone: ZoneData;
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
  onPreview: () => void;
}) {
  const isActive = zone.isActive as boolean;
  const isDefault = zone.isDefault as boolean;
  const method = zone.pricingMethod as PricingMethod;
  const vehicle = zone.vehicleType as VehicleType;

  return (
    <View style={[styles.zoneCard, !isActive && styles.zoneCardInactive]}>
      {/* Header */}
      <View style={styles.zoneHeader}>
        <View style={styles.zoneHeaderLeft}>
          <Text style={styles.zoneCityAr}>{zone.cityNameAr as string}</Text>
          <Text style={styles.zoneCityEn}>{zone.cityName as string}</Text>
          <View style={styles.zoneBadges}>
            <View style={[styles.badge, isActive ? styles.badgeGreen : styles.badgeGray]}>
              <Text style={styles.badgeText}>{isActive ? "✅ نشطة" : "⏸️ متوقفة"}</Text>
            </View>
            {isDefault && (
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={styles.badgeText}>⭐ افتراضية</Text>
              </View>
            )}
            <View style={[styles.badge, styles.badgePurple]}>
              <Text style={styles.badgeText}>{VEHICLE_TYPE_LABELS[vehicle]}</Text>
            </View>
          </View>
        </View>
        <View style={styles.zoneHeaderRight}>
          <Text style={styles.methodLabel}>{PRICING_METHOD_LABELS[method]}</Text>
        </View>
      </View>

      {/* Pricing Grid */}
      <View style={styles.priceGrid}>
        <PriceCell label="أجرة البداية" value={fmtIQD(zone.baseFare as string)} icon="🏁" />
        <PriceCell label="سعر الكم" value={`${fmt(zone.pricePerKm as string)} د.ع/كم`} icon="📏" />
        <PriceCell label="سعر الدقيقة" value={`${fmt(zone.pricePerMinute as string)} د.ع/د`} icon="⏱️" />
        <PriceCell label="الحد الأدنى" value={fmtIQD(zone.minimumFare as string)} icon="⬇️" />
        <PriceCell
          label="الحد الأقصى"
          value={parseFloat((zone.maximumFare as string) ?? "0") > 0 ? fmtIQD(zone.maximumFare as string) : "بلا سقف"}
          icon="⬆️"
        />
        <PriceCell label="رسوم الحجز" value={fmtIQD(zone.bookingFee as string)} icon="📋" />
        <PriceCell
          label="مضاعف الطلب"
          value={`×${parseFloat((zone.surgeMultiplier as string) ?? "1").toFixed(2)}`}
          icon="📈"
          highlight={parseFloat((zone.surgeMultiplier as string) ?? "1") > 1}
        />
        <PriceCell label="رسوم الإلغاء" value={fmtIQD(zone.cancellationFee as string)} icon="❌" />
      </View>

      {/* Night Surcharge */}
      {zone.nightSurchargeStart && parseFloat((zone.nightSurchargeAmount as string) ?? "0") > 0 && (
        <View style={styles.nightRow}>
          <Text style={styles.nightIcon}>🌙</Text>
          <Text style={styles.nightText}>
            رسوم ليلية: {fmtIQD(zone.nightSurchargeAmount as string)} من {zone.nightSurchargeStart as string} إلى {zone.nightSurchargeEnd as string}
          </Text>
        </View>
      )}

      {/* Wait Time */}
      {parseFloat((zone.waitPricePerMinute as string) ?? "0") > 0 && (
        <View style={styles.nightRow}>
          <Text style={styles.nightIcon}>⏳</Text>
          <Text style={styles.nightText}>
            انتظار مجاني {zone.freeWaitMinutes as number} دقائق، ثم {fmtIQD(zone.waitPricePerMinute as string)}/دقيقة
          </Text>
        </View>
      )}

      {/* Notes */}
      {zone.notes ? (
        <Text style={styles.zoneNotes}>📝 {zone.notes as string}</Text>
      ) : null}

      {/* Actions */}
      <View style={styles.zoneActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnBlue]} onPress={onPreview}>
          <Text style={styles.actionBtnText}>🧮 معاينة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGray]} onPress={onHistory}>
          <Text style={styles.actionBtnText}>📋 السجل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOrange]} onPress={onEdit}>
          <Text style={styles.actionBtnText}>✏️ تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRed]} onPress={onDelete}>
          <Text style={styles.actionBtnText}>🗑️ حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PriceCell({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.priceCell}>
      <Text style={styles.priceCellIcon}>{icon}</Text>
      <Text style={[styles.priceCellValue, highlight && styles.priceCellHighlight]}>{value}</Text>
      <Text style={styles.priceCellLabel}>{label}</Text>
    </View>
  );
}

// ─── Zone Form Modal ────────────────────────────────────────────────────────────
function ZoneFormModal({
  visible,
  initialData,
  onClose,
  onSave,
  isSaving,
  title,
}: {
  visible: boolean;
  initialData: ZoneForm;
  onClose: () => void;
  onSave: (form: ZoneForm, changeNote: string) => void;
  isSaving: boolean;
  title: string;
}) {
  const [form, setForm] = useState<ZoneForm>(initialData);
  const [changeNote, setChangeNote] = useState("");
  const [section, setSection] = useState<"basic" | "pricing" | "extras">("basic");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  // إعادة تهيئة النموذج عند فتح المودال أو تغيير السجل المُحرَّر
  // نستخدم JSON.stringify(initialData) كـ dependency لضمان إعادة التهيئة عند كل تغيير حقيقي
  useEffect(() => {
    setForm(initialData);
    setChangeNote("");
    setSection("basic");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialData.cityName, (initialData as any).id]);

  const update = (key: keyof ZoneForm, val: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const addZoneCircle = () => {
    setForm((prev) => ({
      ...prev,
      zonesConfig: [
        ...prev.zonesConfig,
        { name: `زون ${prev.zonesConfig.length + 1}`, lat: 36.3359, lng: 43.1189, radiusKm: 3, flatFare: 5000 },
      ],
    }));
  };

  const removeZoneCircle = (idx: number) => {
    setForm((prev) => ({ ...prev, zonesConfig: prev.zonesConfig.filter((_, i) => i !== idx) }));
  };

  const updateZoneCircle = (idx: number, field: keyof ZoneCircle, val: string) => {
    setForm((prev) => {
      const updated = [...prev.zonesConfig];
      if (field === "name") updated[idx] = { ...updated[idx], name: val };
      else updated[idx] = { ...updated[idx], [field]: parseFloat(val) || 0 };
      return { ...prev, zonesConfig: updated };
    });
  };

  const handleSave = () => {
    if (!form.cityName.trim() || !form.cityNameAr.trim()) {
      Alert.alert("خطأ", "يرجى إدخال اسم المدينة بالعربي والإنجليزي");
      return;
    }
    const base = parseFloat(form.baseFare);
    const min = parseFloat(form.minimumFare);
    if (isNaN(base) || base < 0) {
      Alert.alert("خطأ", "أجرة البداية يجب أن تكون رقماً صحيحاً");
      return;
    }
    if (isNaN(min) || min < 0) {
      Alert.alert("خطأ", "الحد الأدنى للأجرة يجب أن يكون رقماً صحيحاً");
      return;
    }
    onSave(form, changeNote);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <StatusBar style="dark" />
      <View style={styles.modalContainer}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseText}>إلغاء</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.modalSaveBtn} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.modalSaveText}>حفظ</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section Tabs */}
        <View style={styles.sectionTabs}>
          {(["basic", "pricing", "extras"] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sectionTab, section === s && styles.sectionTabActive]}
              onPress={() => setSection(s)}
            >
              <Text style={[styles.sectionTabText, section === s && styles.sectionTabTextActive]}>
                {s === "basic" ? "🏙️ أساسي" : s === "pricing" ? "💰 التسعير" : "⚙️ إضافات"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          {/* ── Basic Section ── */}
          {section === "basic" && (
            <View style={styles.formSection}>
              {/* City Picker */}
              <FormField label="المدينة *" hint="اختر من قائمة المدن العراقية">
                <TouchableOpacity
                  style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                  onPress={() => setShowCityPicker(true)}
                >
                  <Text style={{ color: form.cityNameAr ? "#1E293B" : "#94A3B8", fontSize: 15 }}>
                    {form.cityNameAr ? `${form.cityNameAr}  (${form.cityName})` : "اختر مدينة..."}
                  </Text>
                  <Text style={{ color: "#6C63FF", fontSize: 16 }}>▼</Text>
                </TouchableOpacity>
              </FormField>

              {/* City Picker Modal */}
              <Modal visible={showCityPicker} animationType="slide" presentationStyle="formSheet" onRequestClose={() => { setShowCityPicker(false); setCitySearch(""); }}>
                <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
                  <View style={[styles.modalHeader, { paddingTop: 16 }]}>
                    <TouchableOpacity onPress={() => { setShowCityPicker(false); setCitySearch(""); }} style={styles.modalCloseBtn}>
                      <Text style={styles.modalCloseText}>إغلاق</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>اختر مدينة عراقية</Text>
                    <View style={{ width: 60 }} />
                  </View>
                  {/* حقل بحث في المدن */}
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                    <TextInput
                      style={{ backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, textAlign: "right" }}
                      placeholder="ابحث عن مدينة..."
                      value={citySearch}
                      onChangeText={setCitySearch}
                      autoFocus
                    />
                  </View>
                  <ScrollView style={{ flex: 1 }}>
                    {IRAQI_CITIES_DATA.filter((c) =>
                      citySearch === "" ||
                      c.ar.includes(citySearch) ||
                      c.en.toLowerCase().includes(citySearch.toLowerCase())
                    ).map((city) => (
                      <TouchableOpacity
                        key={city.en}
                        style={{ paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: form.cityName === city.en ? "#EEF2FF" : "#fff" }}
                        onPress={() => {
                          // إذا الزونات فارغة أو كانت المدينة مختلفة وطريقة التسعير zones
                          const shouldSeedZones = form.zonesConfig.length === 0 || (form.pricingMethod === "zones" && form.cityName !== city.en);
                          setForm((prev) => ({
                            ...prev,
                            cityName: city.en,
                            cityNameAr: city.ar,
                            zonesConfig: shouldSeedZones
                              ? [
                                  { name: "المركز", lat: city.lat, lng: city.lng, radiusKm: 3, flatFare: 5000 },
                                  { name: "الضواحي", lat: city.lat, lng: city.lng, radiusKm: 8, flatFare: 8000 },
                                ]
                              : prev.zonesConfig,
                          }));
                          setShowCityPicker(false);
                          setCitySearch("");
                        }}
                      >
                        <Text style={{ fontSize: 17, color: "#1E293B", fontWeight: form.cityName === city.en ? "700" : "400" }}>{city.ar}</Text>
                        <Text style={{ fontSize: 13, color: "#94A3B8" }}>{city.en}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </Modal>

              <FormField label="طريقة التسعير">
                <View style={styles.optionGroup}>
                  {(["per_km", "per_minute", "hybrid", "zones"] as PricingMethod[]).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.optionBtn, form.pricingMethod === m && styles.optionBtnActive]}
                      onPress={() => update("pricingMethod", m)}
                    >
                      <Text style={[styles.optionBtnText, form.pricingMethod === m && styles.optionBtnTextActive]}>
                        {PRICING_METHOD_LABELS[m]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FormField>

              <FormField label="نوع المركبة">
                <View style={styles.optionGroup}>
                  {(["all", "sedan", "suv", "minivan"] as VehicleType[]).map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.optionBtn, form.vehicleType === v && styles.optionBtnActive]}
                      onPress={() => update("vehicleType", v)}
                    >
                      <Text style={[styles.optionBtnText, form.vehicleType === v && styles.optionBtnTextActive]}>
                        {VEHICLE_TYPE_LABELS[v]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FormField>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>المنطقة نشطة</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={(v) => update("isActive", v)}
                  trackColor={{ false: "#ccc", true: "#22C55E" }}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>منطقة افتراضية (fallback)</Text>
                <Switch
                  value={form.isDefault}
                  onValueChange={(v) => update("isDefault", v)}
                  trackColor={{ false: "#ccc", true: "#3B82F6" }}
                />
              </View>

              <FormField label="ملاحظات">
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={form.notes}
                  onChangeText={(v) => update("notes", v)}
                  placeholder="ملاحظات اختيارية..."
                  multiline
                  numberOfLines={3}
                  textAlign="right"
                />
              </FormField>
            </View>
          )}

          {/* ── Pricing Section ── */}
          {section === "pricing" && (
            <View style={styles.formSection}>
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  💡 الأسعار بالدينار العراقي (IQD). تُقرَّب تلقائياً لأقرب 250 دينار.
                </Text>
              </View>

              <FormField label="أجرة البداية (د.ع)" hint="تُضاف لكل رحلة بغض النظر عن المسافة">
                <TextInput
                  style={styles.input}
                  value={form.baseFare}
                  onChangeText={(v) => update("baseFare", v)}
                  keyboardType="numeric"
                  placeholder="2000"
                />
              </FormField>

              {/* Zones Config Editor */}
              {form.pricingMethod === "zones" && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={styles.subSectionTitle}>🎯 إدارة الزونات</Text>
                    <TouchableOpacity
                      style={{ backgroundColor: "#6C63FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
                      onPress={addZoneCircle}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>+ إضافة زون</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ backgroundColor: "#EEF2FF", borderRadius: 10, padding: 10, marginBottom: 12 }}>
                    <Text style={{ color: "#4338CA", fontSize: 12 }}>
                      💡 كل زون هي دائرة حول مركز المدينة. إذا كان الراكب داخل نصف القطر يدفع السعر الثابت لها. الزونات مرتبة من الأصغر للأكبر.
                    </Text>
                  </View>
                  {form.zonesConfig.length === 0 && (
                    <Text style={{ color: "#94A3B8", textAlign: "center", paddingVertical: 16 }}>لا توجد زونات. اضغط "إضافة زون" للبدء.</Text>
                  )}
                  {/* معاينة الزونات على خريطة Leaflet */}
                  {form.zonesConfig.length > 0 && (() => {
                    const centerLat = form.zonesConfig[0]?.lat ?? 36.3359;
                    const centerLng = form.zonesConfig[0]?.lng ?? 43.1189;
                    const circlesJson = JSON.stringify(form.zonesConfig.map((z, i) => ({
                      lat: z.lat, lng: z.lng, radiusKm: z.radiusKm, name: z.name, flatFare: z.flatFare,
                      color: ["#6C63FF", "#F59E0B", "#10B981", "#EF4444", "#3B82F6"][i % 5],
                    })));
                    const mapHtml = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>body,html,#map{margin:0;padding:0;height:100%;width:100%;}</style></head><body><div id="map"></div><script>var map=L.map('map',{zoomControl:true}).setView([${centerLat},${centerLng}],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM'}).addTo(map);var circles=${circlesJson};circles.forEach(function(c){L.circle([c.lat,c.lng],{radius:c.radiusKm*1000,color:c.color,fillColor:c.color,fillOpacity:0.15,weight:2}).addTo(map).bindPopup('<b>'+c.name+'</b><br>'+c.flatFare.toLocaleString()+' د.ع<br>نصف القطر: '+c.radiusKm+' كم');L.marker([c.lat,c.lng],{icon:L.divIcon({html:'<div style="background:'+c.color+';color:#fff;padding:2px 6px;border-radius:8px;font-size:11px;white-space:nowrap">'+c.name+'</div>',iconAnchor:[30,10]})}).addTo(map);});if(circles.length>0){var bounds=circles.map(function(c){return[[c.lat-c.radiusKm/111,c.lng-c.radiusKm/111],[c.lat+c.radiusKm/111,c.lng+c.radiusKm/111]]});map.fitBounds(bounds.flat());}</script></body></html>`;
                    return (
                      <View style={{ height: 220, borderRadius: 12, overflow: "hidden", marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" }}>
                        <Text style={{ backgroundColor: "#6C63FF", color: "#fff", textAlign: "center", paddingVertical: 6, fontSize: 12, fontWeight: "700" }}>🗺️ معاينة الزونات على الخريطة</Text>
                        {Platform.OS === "web" ? (
                          <iframe
                            srcDoc={mapHtml}
                            style={{ flex: 1, border: "none", width: "100%", height: 180 }}
                            sandbox="allow-scripts"
                          />
                        ) : (
                          <WebView
                            source={{ html: mapHtml }}
                            style={{ flex: 1 }}
                            scrollEnabled={false}
                            javaScriptEnabled
                          />
                        )}
                      </View>
                    );
                  })()}

                  {form.zonesConfig.map((z, idx) => (
                    <View key={idx} style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={{ fontWeight: "700", color: "#1E293B", fontSize: 14 }}>زون {idx + 1}</Text>
                        <TouchableOpacity onPress={() => removeZoneCircle(idx)} style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "600" }}>حذف</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[styles.input, { marginBottom: 8 }]}
                        value={z.name}
                        onChangeText={(v) => updateZoneCircle(idx, "name", v)}
                        placeholder="اسم الزون (مثال: المركز)"
                        textAlign="right"
                      />
                      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>خط العرض</Text>
                          <TextInput
                            style={styles.input}
                            value={String(z.lat)}
                            onChangeText={(v) => updateZoneCircle(idx, "lat", v)}
                            keyboardType="numeric"
                            placeholder="36.3359"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>خط الطول</Text>
                          <TextInput
                            style={styles.input}
                            value={String(z.lng)}
                            onChangeText={(v) => updateZoneCircle(idx, "lng", v)}
                            keyboardType="numeric"
                            placeholder="43.1189"
                          />
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>نصف القطر (كم)</Text>
                          <TextInput
                            style={styles.input}
                            value={String(z.radiusKm)}
                            onChangeText={(v) => updateZoneCircle(idx, "radiusKm", v)}
                            keyboardType="numeric"
                            placeholder="3"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>الأجرة الثابتة (د.ع)</Text>
                          <TextInput
                            style={styles.input}
                            value={String(z.flatFare)}
                            onChangeText={(v) => updateZoneCircle(idx, "flatFare", v)}
                            keyboardType="numeric"
                            placeholder="5000"
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {(form.pricingMethod === "per_km" || form.pricingMethod === "hybrid") && (
                <FormField label="سعر الكيلومتر (د.ع/كم)" hint="يُضرب في المسافة الفعلية">
                  <TextInput
                    style={styles.input}
                    value={form.pricePerKm}
                    onChangeText={(v) => update("pricePerKm", v)}
                    keyboardType="numeric"
                    placeholder="1000"
                  />
                </FormField>
              )}

              {(form.pricingMethod === "per_minute" || form.pricingMethod === "hybrid") && (
                <FormField label="سعر الدقيقة (د.ع/دقيقة)" hint="يُضرب في مدة الرحلة المقدرة">
                  <TextInput
                    style={styles.input}
                    value={form.pricePerMinute}
                    onChangeText={(v) => update("pricePerMinute", v)}
                    keyboardType="numeric"
                    placeholder="100"
                  />
                </FormField>
              )}

              <FormField label="الحد الأدنى للأجرة (د.ع)" hint="لا تنزل الأجرة عن هذا المبلغ">
                <TextInput
                  style={styles.input}
                  value={form.minimumFare}
                  onChangeText={(v) => update("minimumFare", v)}
                  keyboardType="numeric"
                  placeholder="3000"
                />
              </FormField>

              <FormField label="الحد الأقصى للأجرة (د.ع)" hint="0 = بلا سقف">
                <TextInput
                  style={styles.input}
                  value={form.maximumFare}
                  onChangeText={(v) => update("maximumFare", v)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </FormField>

              <FormField label="رسوم الحجز (د.ع)" hint="مبلغ ثابت يُضاف لكل رحلة">
                <TextInput
                  style={styles.input}
                  value={form.bookingFee}
                  onChangeText={(v) => update("bookingFee", v)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </FormField>

              <FormField label="مضاعف الطلب العالي" hint="1.0 = عادي، 1.5 = 50% زيادة">
                <TextInput
                  style={styles.input}
                  value={form.surgeMultiplier}
                  onChangeText={(v) => update("surgeMultiplier", v)}
                  keyboardType="numeric"
                  placeholder="1.00"
                />
              </FormField>
            </View>
          )}

          {/* ── Extras Section ── */}
          {section === "extras" && (
            <View style={styles.formSection}>
              <Text style={styles.subSectionTitle}>🌙 رسوم الليل</Text>
              <FormField label="بداية وقت الليل" hint="مثال: 22:00">
                <TextInput
                  style={styles.input}
                  value={form.nightSurchargeStart}
                  onChangeText={(v) => update("nightSurchargeStart", v)}
                  placeholder="22:00"
                />
              </FormField>
              <FormField label="نهاية وقت الليل" hint="مثال: 06:00">
                <TextInput
                  style={styles.input}
                  value={form.nightSurchargeEnd}
                  onChangeText={(v) => update("nightSurchargeEnd", v)}
                  placeholder="06:00"
                />
              </FormField>
              <FormField label="مبلغ رسوم الليل (د.ع)" hint="يُضاف للأجرة في ساعات الليل">
                <TextInput
                  style={styles.input}
                  value={form.nightSurchargeAmount}
                  onChangeText={(v) => update("nightSurchargeAmount", v)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </FormField>

              <View style={styles.divider} />
              <Text style={styles.subSectionTitle}>⏳ رسوم الانتظار</Text>
              <FormField label="دقائق الانتظار المجانية" hint="المدة المجانية قبل احتساب رسوم الانتظار">
                <TextInput
                  style={styles.input}
                  value={form.freeWaitMinutes}
                  onChangeText={(v) => update("freeWaitMinutes", v)}
                  keyboardType="numeric"
                  placeholder="3"
                />
              </FormField>
              <FormField label="سعر دقيقة الانتظار (د.ع)" hint="0 = لا رسوم انتظار">
                <TextInput
                  style={styles.input}
                  value={form.waitPricePerMinute}
                  onChangeText={(v) => update("waitPricePerMinute", v)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </FormField>

              <View style={styles.divider} />
              <Text style={styles.subSectionTitle}>❌ رسوم الإلغاء</Text>
              <FormField label="رسوم إلغاء الرحلة (د.ع)" hint="0 = إلغاء مجاني">
                <TextInput
                  style={styles.input}
                  value={form.cancellationFee}
                  onChangeText={(v) => update("cancellationFee", v)}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </FormField>

              <View style={styles.divider} />
              <Text style={styles.subSectionTitle}>📡 نطاق استقبال الكابتن</Text>
              <FormField label="نطاق إرسال الطلب للكابتن (كم)" hint="أقصى مسافة بين الكابتن والراكب لإرسال الطلب (افتراضي: 2 كم)">
                <TextInput
                  style={styles.input}
                  value={form.captainRadiusKm}
                  onChangeText={(v) => update("captainRadiusKm", v)}
                  keyboardType="numeric"
                  placeholder="2.00"
                />
              </FormField>

              <View style={styles.divider} />
              <FormField label="ملاحظة التغيير" hint="اختياري - لسجل التعديلات">
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={changeNote}
                  onChangeText={setChangeNote}
                  placeholder="سبب التعديل..."
                  multiline
                  numberOfLines={2}
                  textAlign="right"
                />
              </FormField>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      {children}
    </View>
  );
}

// ─── Preview Modal ──────────────────────────────────────────────────────────────
function PreviewModal({
  visible,
  cityName,
  onClose,
}: {
  visible: boolean;
  cityName: string;
  onClose: () => void;
}) {
  const [distance, setDistance] = useState("5");
  const [duration, setDuration] = useState("15");
  const [vehicle, setVehicle] = useState<"sedan" | "suv" | "minivan">("sedan");

  const { data, isLoading, refetch } = trpc.pricing.previewFare.useQuery(
    {
      distanceKm: parseFloat(distance) || 0,
      durationMinutes: parseFloat(duration) || 0,
      cityName,
      vehicleType: vehicle,
    },
    { enabled: visible }
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>🧮 معاينة الأجرة - {cityName}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.previewClose}>إغلاق</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.previewScroll}>
          <View style={styles.previewInputRow}>
            <View style={styles.previewInputGroup}>
              <Text style={styles.previewInputLabel}>المسافة (كم)</Text>
              <TextInput
                style={styles.previewInput}
                value={distance}
                onChangeText={setDistance}
                keyboardType="numeric"
                onBlur={() => refetch()}
              />
            </View>
            <View style={styles.previewInputGroup}>
              <Text style={styles.previewInputLabel}>المدة (دقيقة)</Text>
              <TextInput
                style={styles.previewInput}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                onBlur={() => refetch()}
              />
            </View>
          </View>

          <View style={styles.optionGroup}>
            {(["sedan", "suv", "minivan"] as const).map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.optionBtn, vehicle === v && styles.optionBtnActive]}
                onPress={() => setVehicle(v)}
              >
                <Text style={[styles.optionBtnText, vehicle === v && styles.optionBtnTextActive]}>
                  {VEHICLE_TYPE_LABELS[v]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.calcBtn} onPress={() => refetch()}>
            <Text style={styles.calcBtnText}>احسب الأجرة</Text>
          </TouchableOpacity>

          {isLoading && <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 20 }} />}

          {data && !isLoading && (
            <View style={styles.previewResult}>
              <Text style={styles.previewFare}>{data.fare.toLocaleString("ar-IQ")} دينار</Text>
              <Text style={styles.previewZone}>منطقة: {data.breakdown.zoneName}</Text>
              <Text style={styles.previewMethod}>
                طريقة التسعير: {PRICING_METHOD_LABELS[data.breakdown.pricingMethod as PricingMethod]}
              </Text>

              <View style={styles.breakdownTable}>
                <BreakdownRow label="أجرة البداية" value={data.breakdown.baseFare} />
                {data.breakdown.distanceFare > 0 && (
                  <BreakdownRow label="أجرة المسافة" value={data.breakdown.distanceFare} />
                )}
                {data.breakdown.timeFare > 0 && (
                  <BreakdownRow label="أجرة الوقت" value={data.breakdown.timeFare} />
                )}
                {data.breakdown.bookingFee > 0 && (
                  <BreakdownRow label="رسوم الحجز" value={data.breakdown.bookingFee} />
                )}
                {data.breakdown.nightSurcharge > 0 && (
                  <BreakdownRow label="رسوم الليل 🌙" value={data.breakdown.nightSurcharge} />
                )}
                {data.breakdown.surgeMultiplier > 1 && (
                  <BreakdownRow label={`مضاعف الطلب ×${data.breakdown.surgeMultiplier}`} value={0} isMultiplier />
                )}
                <View style={styles.breakdownDivider} />
                <BreakdownRow label="المجموع" value={data.fare} isTotal />
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function BreakdownRow({
  label,
  value,
  isTotal,
  isMultiplier,
}: {
  label: string;
  value: number;
  isTotal?: boolean;
  isMultiplier?: boolean;
}) {
  return (
    <View style={[styles.breakdownRow, isTotal && styles.breakdownRowTotal]}>
      <Text style={[styles.breakdownLabel, isTotal && styles.breakdownLabelTotal]}>{label}</Text>
      <Text style={[styles.breakdownValue, isTotal && styles.breakdownValueTotal]}>
        {isMultiplier ? "" : `${value.toLocaleString("ar-IQ")} د.ع`}
      </Text>
    </View>
  );
}

// ─── History Modal ──────────────────────────────────────────────────────────────
function HistoryModal({
  visible,
  zoneId,
  zoneName,
  onClose,
}: {
  visible: boolean;
  zoneId: number;
  zoneName: string;
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.pricing.getHistory.useQuery(
    { zoneId, limit: 30 },
    { enabled: visible && zoneId > 0 }
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>📋 سجل التغييرات - {zoneName}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.previewClose}>إغلاق</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.previewScroll}>
          {isLoading && <ActivityIndicator size="large" color="#6C63FF" style={{ marginTop: 20 }} />}
          {!isLoading && (!data || data.length === 0) && (
            <Text style={styles.emptyText}>لا توجد تغييرات مسجلة بعد</Text>
          )}
          {data?.map((h) => (
            <View key={h.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyBy}>👤 {h.changedBy ?? "admin"}</Text>
                <Text style={styles.historyDate}>
                  {new Date(h.createdAt).toLocaleDateString("ar-IQ", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              {h.changeNote && <Text style={styles.historyNote}>📝 {h.changeNote}</Text>}
              {h.newValues && (
                <View style={styles.historyValues}>
                  <Text style={styles.historyValuesLabel}>القيم الجديدة:</Text>
                  {Object.entries(JSON.parse(h.newValues) as Record<string, unknown>)
                    .filter(([k]) => !["id", "createdAt", "updatedAt"].includes(k))
                    .map(([k, v]) => (
                      <Text key={k} style={styles.historyValueRow}>
                        {k}: <Text style={styles.historyValueVal}>{String(v)}</Text>
                      </Text>
                    ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PricingManagement() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingZone, setEditingZone] = useState<ZoneData | null>(null);
  const [previewZone, setPreviewZone] = useState<{ id: number; cityName: string; cityNameAr: string } | null>(null);
  const [historyZone, setHistoryZone] = useState<{ id: number; cityNameAr: string } | null>(null);

  const { data: zones, isLoading, refetch } = trpc.pricing.getZones.useQuery();
  const utils = trpc.useUtils();

  const createZone = trpc.pricing.createZone.useMutation({
    onSuccess: async () => {
      await refetch();
      utils.pricing.getZones.invalidate();
      setShowForm(false);
      Alert.alert("✅ تم", "تم إنشاء منطقة التسعير بنجاح");
    },
    onError: (e) => Alert.alert("خطأ", e.message),
  });

  const updateZone = trpc.pricing.updateZone.useMutation({
    onSuccess: async () => {
      await refetch();
      utils.pricing.getZones.invalidate();
      setEditingZone(null);
      Alert.alert("✅ تم", "تم تحديث منطقة التسعير بنجاح");
    },
    onError: (e) => Alert.alert("خطأ", e.message),
  });

  const deleteZone = trpc.pricing.deleteZone.useMutation({
    onSuccess: async () => {
      await refetch();
      utils.pricing.getZones.invalidate();
      Alert.alert("✅ تم", "تم حذف منطقة التسعير");
    },
    onError: (e) => Alert.alert("خطأ", e.message),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // دالة مساعدة لتحويل قيمة نصية إلى رقم بأمان — تُرجع القيمة الافتراضية فقط إذا كانت القيمة null/undefined/NaN
  const safeNum = (val: string, fallback: number) => {
    const n = parseFloat(val);
    return isNaN(n) ? fallback : n;
  };
  const safeInt = (val: string, fallback: number) => {
    const n = parseInt(val);
    return isNaN(n) ? fallback : n;
  };

  const handleSaveNew = (form: ZoneForm, _note: string) => {
    createZone.mutate({
      cityName: form.cityName,
      cityNameAr: form.cityNameAr,
      isActive: form.isActive,
      isDefault: form.isDefault,
      pricingMethod: form.pricingMethod,
      vehicleType: form.vehicleType,
      baseFare: safeNum(form.baseFare, 0),
      pricePerKm: safeNum(form.pricePerKm, 0),
      pricePerMinute: safeNum(form.pricePerMinute, 0),
      minimumFare: safeNum(form.minimumFare, 0),
      maximumFare: safeNum(form.maximumFare, 0),
      surgeMultiplier: safeNum(form.surgeMultiplier, 1),
      nightSurchargeAmount: safeNum(form.nightSurchargeAmount, 0),
      bookingFee: safeNum(form.bookingFee, 0),
      freeWaitMinutes: safeInt(form.freeWaitMinutes, 3),
      waitPricePerMinute: safeNum(form.waitPricePerMinute, 0),
      cancellationFee: safeNum(form.cancellationFee, 0),
      captainRadiusKm: safeNum(form.captainRadiusKm, 2),
      zonesConfig: form.zonesConfig.length > 0 ? JSON.stringify(form.zonesConfig) : undefined,
      nightSurchargeStart: form.nightSurchargeStart || undefined,
      nightSurchargeEnd: form.nightSurchargeEnd || undefined,
      notes: form.notes || undefined,
    });
  };

  const handleSaveEdit = (form: ZoneForm, changeNote: string) => {
    if (!editingZone) return;
    updateZone.mutate({
      zoneId: editingZone.id as number,
      cityName: form.cityName,
      cityNameAr: form.cityNameAr,
      isActive: form.isActive,
      isDefault: form.isDefault,
      pricingMethod: form.pricingMethod,
      vehicleType: form.vehicleType,
      baseFare: safeNum(form.baseFare, 0),
      pricePerKm: safeNum(form.pricePerKm, 0),
      pricePerMinute: safeNum(form.pricePerMinute, 0),
      minimumFare: safeNum(form.minimumFare, 0),
      maximumFare: safeNum(form.maximumFare, 0),
      surgeMultiplier: safeNum(form.surgeMultiplier, 1),
      nightSurchargeAmount: safeNum(form.nightSurchargeAmount, 0),
      bookingFee: safeNum(form.bookingFee, 0),
      freeWaitMinutes: safeInt(form.freeWaitMinutes, 3),
      waitPricePerMinute: safeNum(form.waitPricePerMinute, 0),
      cancellationFee: safeNum(form.cancellationFee, 0),
      captainRadiusKm: safeNum(form.captainRadiusKm, 2),
      zonesConfig: form.zonesConfig.length > 0 ? JSON.stringify(form.zonesConfig) : undefined,
      nightSurchargeStart: form.nightSurchargeStart || undefined,
      nightSurchargeEnd: form.nightSurchargeEnd || undefined,
      notes: form.notes || undefined,
      changeNote: changeNote || undefined,
      updatedBy: "admin",
    });
  };

  const handleDelete = (zone: ZoneData) => {
    Alert.alert(
      "حذف منطقة التسعير",
      `هل أنت متأكد من حذف منطقة "${zone.cityNameAr}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: () => deleteZone.mutate({ zoneId: zone.id }),
        },
      ]
    );
  };

  const getEditForm = (zone: ZoneData): ZoneForm => ({
    cityName: zone.cityName ?? "",
    cityNameAr: zone.cityNameAr ?? "",
    isActive: zone.isActive ?? true,
    isDefault: zone.isDefault ?? false,
    pricingMethod: (zone.pricingMethod ?? "per_km") as PricingMethod,
    vehicleType: zone.vehicleType ?? "all",
    baseFare: zone.baseFare ?? "2000",
    pricePerKm: zone.pricePerKm ?? "1000",
    pricePerMinute: zone.pricePerMinute ?? "100",
    minimumFare: zone.minimumFare ?? "3000",
    maximumFare: zone.maximumFare ?? "0",
    surgeMultiplier: zone.surgeMultiplier ?? "1.00",
    nightSurchargeStart: zone.nightSurchargeStart ?? "",
    nightSurchargeEnd: zone.nightSurchargeEnd ?? "",
    nightSurchargeAmount: zone.nightSurchargeAmount ?? "0",
    bookingFee: zone.bookingFee ?? "0",
    freeWaitMinutes: String(zone.freeWaitMinutes ?? 3),
    waitPricePerMinute: zone.waitPricePerMinute ?? "0",
    cancellationFee: zone.cancellationFee ?? "0",
    captainRadiusKm: zone.captainRadiusKm ?? "2.00",
    zonesConfig: zone.zonesConfig ? (JSON.parse(zone.zonesConfig) as ZoneCircle[]) : [],
    notes: zone.notes ?? "",
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>💰 إدارة التسعير</Text>
          <Text style={styles.headerSub}>
            {zones?.length ?? 0} منطقة تسعير
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>+ إضافة</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          🔄 التعديلات تنعكس فوراً على التطبيق — لا حاجة لإعادة التشغيل
        </Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>جاري تحميل مناطق التسعير...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {(!zones || zones.length === 0) && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💰</Text>
              <Text style={styles.emptyTitle}>لا توجد مناطق تسعير</Text>
              <Text style={styles.emptyDesc}>
                اضغط "إضافة" لإنشاء منطقة تسعير جديدة. سيتم إنشاء منطقة الموصل الافتراضية تلقائياً عند أول طلب رحلة.
              </Text>
            </View>
          )}

          {zones?.map((zone) => (
            <ZoneCard
              key={zone.id}
              zone={zone as unknown as ZoneData}
              onEdit={() => setEditingZone(zone as unknown as ZoneData)}
              onDelete={() => handleDelete(zone as unknown as ZoneData)}
              onHistory={() => setHistoryZone({ id: zone.id, cityNameAr: zone.cityNameAr })}
              onPreview={() => setPreviewZone({ id: zone.id, cityName: zone.cityName, cityNameAr: zone.cityNameAr })}
            />
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Create Zone Modal */}
      {showForm && (
        <ZoneFormModal
          visible={showForm}
          initialData={DEFAULT_FORM}
          onClose={() => setShowForm(false)}
          onSave={handleSaveNew}
          isSaving={createZone.isPending}
          title="إضافة منطقة تسعير جديدة"
        />
      )}

      {/* Edit Zone Modal */}
      {editingZone && (
        <ZoneFormModal
          visible={!!editingZone}
          initialData={getEditForm(editingZone)}
          onClose={() => setEditingZone(null)}
          onSave={handleSaveEdit}
          isSaving={updateZone.isPending}
          title={`تعديل: ${editingZone.cityNameAr as string}`}
        />
      )}

      {/* Preview Modal */}
      {previewZone && (
        <PreviewModal
          visible={!!previewZone}
          cityName={previewZone.cityNameAr}
          onClose={() => setPreviewZone(null)}
        />
      )}

      {/* History Modal */}
      {historyZone && (
        <HistoryModal
          visible={!!historyZone}
          zoneId={historyZone.id}
          zoneName={historyZone.cityNameAr}
          onClose={() => setHistoryZone(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F2F8" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 8 },
  backIcon: { fontSize: 22, color: "#6C63FF" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  headerSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  addBtn: {
    backgroundColor: "#6C63FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Info Banner
  infoBanner: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#C7D2FE",
  },
  infoBannerText: { color: "#4338CA", fontSize: 13, textAlign: "center" },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Loading
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#64748B", fontSize: 15 },

  // Empty
  emptyContainer: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 22 },

  // Zone Card
  zoneCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  zoneCardInactive: { opacity: 0.6 },
  zoneHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  zoneHeaderLeft: { flex: 1 },
  zoneHeaderRight: { alignItems: "flex-end" },
  zoneCityAr: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
  zoneCityEn: { fontSize: 13, color: "#64748B", marginTop: 2 },
  zoneBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeGreen: { backgroundColor: "#DCFCE7" },
  badgeGray: { backgroundColor: "#F1F5F9" },
  badgeBlue: { backgroundColor: "#DBEAFE" },
  badgePurple: { backgroundColor: "#EDE9FE" },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  methodLabel: { fontSize: 13, color: "#6C63FF", fontWeight: "600", backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

  // Price Grid
  priceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  priceCell: { width: "23%", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 8, alignItems: "center" },
  priceCellIcon: { fontSize: 16, marginBottom: 2 },
  priceCellValue: { fontSize: 12, fontWeight: "700", color: "#1E293B", textAlign: "center" },
  priceCellHighlight: { color: "#EF4444" },
  priceCellLabel: { fontSize: 10, color: "#94A3B8", textAlign: "center", marginTop: 2 },

  // Night / Wait rows
  nightRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, backgroundColor: "#FFF7ED", borderRadius: 8, padding: 8 },
  nightIcon: { fontSize: 16 },
  nightText: { fontSize: 12, color: "#92400E", flex: 1 },

  // Notes
  zoneNotes: { fontSize: 12, color: "#64748B", fontStyle: "italic", marginBottom: 8 },

  // Zone Actions
  zoneActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  actionBtnBlue: { backgroundColor: "#EFF6FF" },
  actionBtnGray: { backgroundColor: "#F1F5F9" },
  actionBtnOrange: { backgroundColor: "#FFF7ED" },
  actionBtnRed: { backgroundColor: "#FEF2F2" },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },

  // Modal
  modalContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { color: "#EF4444", fontSize: 16, fontWeight: "600" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1E293B", flex: 1, textAlign: "center" },
  modalSaveBtn: { backgroundColor: "#6C63FF", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, minWidth: 60, alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalScroll: { flex: 1 },

  // Section Tabs
  sectionTabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  sectionTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  sectionTabActive: { borderBottomWidth: 3, borderBottomColor: "#6C63FF" },
  sectionTabText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  sectionTabTextActive: { color: "#6C63FF", fontWeight: "700" },

  // Form
  formSection: { padding: 16, gap: 4 },
  formField: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 4, textAlign: "right" },
  fieldHint: { fontSize: 12, color: "#94A3B8", marginBottom: 6, textAlign: "right" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1E293B",
    textAlign: "right",
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  optionGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  optionBtnActive: { backgroundColor: "#EEF2FF", borderColor: "#6C63FF" },
  optionBtnText: { fontSize: 13, color: "#64748B", fontWeight: "500" },
  optionBtnTextActive: { color: "#6C63FF", fontWeight: "700" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  switchLabel: { fontSize: 15, color: "#374151", fontWeight: "500" },
  subSectionTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 12, marginTop: 4 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 16 },
  infoBox: { backgroundColor: "#EEF2FF", borderRadius: 10, padding: 12, marginBottom: 16 },
  infoBoxText: { color: "#4338CA", fontSize: 13, textAlign: "center" },

  // Preview Modal
  previewContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  previewTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B", flex: 1 },
  previewClose: { color: "#6C63FF", fontSize: 16, fontWeight: "600" },
  previewScroll: { flex: 1, padding: 16 },
  previewInputRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  previewInputGroup: { flex: 1 },
  previewInputLabel: { fontSize: 13, color: "#64748B", marginBottom: 6, textAlign: "right" },
  previewInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlign: "center",
    color: "#1E293B",
  },
  calcBtn: { backgroundColor: "#6C63FF", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 12, marginBottom: 20 },
  calcBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  previewResult: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center" },
  previewFare: { fontSize: 36, fontWeight: "800", color: "#6C63FF", marginBottom: 4 },
  previewZone: { fontSize: 14, color: "#64748B", marginBottom: 2 },
  previewMethod: { fontSize: 13, color: "#94A3B8", marginBottom: 20 },
  breakdownTable: { width: "100%", gap: 8 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  breakdownRowTotal: { borderTopWidth: 2, borderTopColor: "#E5E7EB", paddingTop: 12, marginTop: 4 },
  breakdownLabel: { fontSize: 14, color: "#374151" },
  breakdownLabelTotal: { fontWeight: "700", color: "#1E293B", fontSize: 16 },
  breakdownValue: { fontSize: 14, color: "#374151" },
  breakdownValueTotal: { fontWeight: "800", color: "#6C63FF", fontSize: 16 },
  breakdownDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 4 },

  // History Modal
  historyCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  historyBy: { fontSize: 14, fontWeight: "600", color: "#374151" },
  historyDate: { fontSize: 12, color: "#94A3B8" },
  historyNote: { fontSize: 13, color: "#6C63FF", marginBottom: 8, fontStyle: "italic" },
  historyValues: { backgroundColor: "#F8FAFC", borderRadius: 8, padding: 10 },
  historyValuesLabel: { fontSize: 12, color: "#64748B", marginBottom: 6, fontWeight: "600" },
  historyValueRow: { fontSize: 12, color: "#374151", marginBottom: 3 },
  historyValueVal: { color: "#1E293B", fontWeight: "600" },

  emptyText: { textAlign: "center", color: "#94A3B8", fontSize: 15, marginTop: 40 },
});

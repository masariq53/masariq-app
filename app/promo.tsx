import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeContext } from "@/lib/theme-provider";

const PROMOS_KEY = "@masar_used_promos";

interface PromoCode {
  code: string;
  discount: string;
  description: string;
  usedAt: string;
  type: "percent" | "fixed";
  value: number;
}

// Valid promo codes database
const VALID_CODES: Record<string, Omit<PromoCode, "code" | "usedAt">> = {
  MASAR1: { discount: "رحلة مجانية", description: "أول رحلة مجانية للمستخدمين الجدد", type: "fixed", value: 100 },
  SAVE20: { discount: "خصم 20%", description: "خصم 20% على رحلتك القادمة", type: "percent", value: 20 },
  SAVE30: { discount: "خصم 30%", description: "خصم 30% على رحلتك القادمة", type: "percent", value: 30 },
  SUMMER25: { discount: "خصم 25%", description: "عرض الصيف - خصم 25%", type: "percent", value: 25 },
  WELCOME10: { discount: "خصم 10%", description: "خصم ترحيبي 10% على أول رحلة", type: "percent", value: 10 },
};

export default function PromoScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  const [codeInput, setCodeInput] = useState("");
  const [usedPromos, setUsedPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePromo, setActivePromo] = useState<PromoCode | null>(null);

  const colors = {
    bg: isDark ? "#0D0019" : "#F5F7FA",
    card: isDark ? "#1E0F4A" : "#FFFFFF",
    title: isDark ? "#FFFFFF" : "#1A0533",
    subtitle: isDark ? "#9B8AB0" : "#6B7A8D",
    inputBg: isDark ? "#1E0F4A" : "#FFFFFF",
    inputText: isDark ? "#FFFFFF" : "#1A0533",
    inputBorder: isDark ? "#3D2580" : "#E2E8F0",
    placeholder: isDark ? "#6B5A8A" : "#9BA1A6",
    sectionTitle: isDark ? "#C4B5D4" : "#1A0533",
    historyCard: isDark ? "#1E0F4A" : "#FFFFFF",
    historyBorder: isDark ? "#2D1B69" : "#F0F0F0",
  };

  useEffect(() => {
    loadUsedPromos();
  }, []);

  const loadUsedPromos = async () => {
    try {
      const saved = await AsyncStorage.getItem(PROMOS_KEY);
      if (saved) setUsedPromos(JSON.parse(saved));
    } catch (e) {
      console.error("Error loading promos", e);
    }
  };

  const handleApplyCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;

    setLoading(true);
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);

    const promoData = VALID_CODES[code];
    if (!promoData) {
      Alert.alert("كود غير صالح", "الكود الذي أدخلته غير صحيح أو منتهي الصلاحية");
      return;
    }

    const alreadyUsed = usedPromos.find((p) => p.code === code);
    if (alreadyUsed) {
      Alert.alert("تم الاستخدام", "لقد استخدمت هذا الكود من قبل");
      return;
    }

    const newPromo: PromoCode = {
      code,
      ...promoData,
      usedAt: new Date().toLocaleDateString("ar-IQ"),
    };

    setActivePromo(newPromo);
    const updated = [newPromo, ...usedPromos];
    setUsedPromos(updated);
    await AsyncStorage.setItem(PROMOS_KEY, JSON.stringify(updated));
    setCodeInput("");

    Alert.alert(
      "تم تفعيل الكود! 🎉",
      `${promoData.description}\nسيُطبق الخصم على رحلتك القادمة تلقائياً`,
      [{ text: "رائع!" }]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>أكواد الخصم</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.bg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Promo Banner */}
        {activePromo && (
          <View style={styles.activeBanner}>
            <Text style={styles.activeBannerEmoji}>🎉</Text>
            <View style={styles.activeBannerInfo}>
              <Text style={styles.activeBannerTitle}>كود نشط: {activePromo.code}</Text>
              <Text style={styles.activeBannerSub}>{activePromo.discount} على رحلتك القادمة</Text>
            </View>
            <TouchableOpacity onPress={() => setActivePromo(null)}>
              <Text style={styles.activeBannerClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input Section */}
        <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.inputCardTitle, { color: colors.title }]}>أدخل كود الخصم</Text>
          <Text style={[styles.inputCardSub, { color: colors.subtitle }]}>
            أدخل الكود واضغط تطبيق للحصول على خصمك
          </Text>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.applyBtn, loading && styles.applyBtnDisabled]}
              onPress={handleApplyCode}
              disabled={loading || !codeInput.trim()}
            >
              <Text style={styles.applyBtnText}>{loading ? "..." : "تطبيق"}</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.codeInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
              placeholder="مثال: MASAR1"
              placeholderTextColor={colors.placeholder}
              value={codeInput}
              onChangeText={(t) => setCodeInput(t.toUpperCase())}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleApplyCode}
              textAlign="right"
            />
          </View>
        </View>

        {/* Available Offers */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>عروض متاحة</Text>
          {[
            { code: "MASAR1", label: "أول رحلة مجانية", sub: "للمستخدمين الجدد فقط", emoji: "🎁" },
            { code: "SAVE20", label: "خصم 20%", sub: "على رحلتك القادمة", emoji: "💸" },
            { code: "SUMMER25", label: "خصم 25%", sub: "عرض الصيف المحدود", emoji: "☀️" },
          ].map((offer) => (
            <TouchableOpacity
              key={offer.code}
              style={[styles.offerCard, { backgroundColor: colors.card }]}
              onPress={() => setCodeInput(offer.code)}
            >
              <View style={styles.offerLeft}>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => setCodeInput(offer.code)}
                >
                  <Text style={styles.copyBtnText}>استخدم</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.offerInfo}>
                <Text style={[styles.offerLabel, { color: colors.title }]}>{offer.label}</Text>
                <Text style={[styles.offerSub, { color: colors.subtitle }]}>{offer.sub}</Text>
                <View style={styles.offerCodeBadge}>
                  <Text style={styles.offerCodeText}>{offer.code}</Text>
                </View>
              </View>
              <Text style={styles.offerEmoji}>{offer.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* History */}
        {usedPromos.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>الأكواد المستخدمة</Text>
            {usedPromos.map((promo, i) => (
              <View
                key={i}
                style={[styles.historyCard, { backgroundColor: colors.historyCard, borderColor: colors.historyBorder }]}
              >
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDate}>{promo.usedAt}</Text>
                </View>
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyCode, { color: colors.title }]}>{promo.code}</Text>
                  <Text style={[styles.historySub, { color: colors.subtitle }]}>{promo.discount}</Text>
                </View>
                <View style={styles.usedBadge}>
                  <Text style={styles.usedBadgeText}>مستخدم</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#1A0533",
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center",
  },
  backText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  scroll: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  activeBanner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#22C55E",
    margin: 16, borderRadius: 14, padding: 14, gap: 10,
  },
  activeBannerEmoji: { fontSize: 24 },
  activeBannerInfo: { flex: 1, alignItems: "flex-end" },
  activeBannerTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  activeBannerSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  activeBannerClose: { color: "rgba(255,255,255,0.7)", fontSize: 18, fontWeight: "700" },
  inputCard: {
    margin: 16, borderRadius: 20, padding: 20, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  inputCardTitle: { fontSize: 17, fontWeight: "800", textAlign: "right" },
  inputCardSub: { fontSize: 13, textAlign: "right" },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  codeInput: {
    flex: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, fontWeight: "700", borderWidth: 1.5, letterSpacing: 2,
  },
  applyBtn: {
    backgroundColor: "#FFD700", borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12,
  },
  applyBtnDisabled: { opacity: 0.5 },
  applyBtnText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "800", textAlign: "right", marginBottom: 12 },
  offerCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16,
    marginBottom: 10, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  offerLeft: { alignItems: "center" },
  copyBtn: {
    backgroundColor: "#FFD700", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  copyBtnText: { color: "#1A0533", fontSize: 12, fontWeight: "700" },
  offerInfo: { flex: 1, alignItems: "flex-end", gap: 4 },
  offerLabel: { fontSize: 15, fontWeight: "700" },
  offerSub: { fontSize: 12 },
  offerCodeBadge: {
    backgroundColor: "#1A0533", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  offerCodeText: { color: "#FFD700", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  offerEmoji: { fontSize: 32 },
  historyCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, gap: 10,
  },
  historyLeft: { alignItems: "center" },
  historyDate: { color: "#9BA1A6", fontSize: 11 },
  historyInfo: { flex: 1, alignItems: "flex-end" },
  historyCode: { fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  historySub: { fontSize: 12, marginTop: 2 },
  usedBadge: {
    backgroundColor: "#F5F7FA", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  usedBadgeText: { color: "#9BA1A6", fontSize: 11, fontWeight: "600" },
});

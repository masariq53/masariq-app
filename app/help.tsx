import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeContext } from "@/lib/theme-provider";

const faqs = [
  {
    id: "1",
    q: "كيف أطلب رحلة؟",
    a: "اضغط على 'توصيلة' من الشاشة الرئيسية، ثم حدد موقعك الحالي ووجهتك، وسيتم تعيين أقرب سائق لك.",
  },
  {
    id: "2",
    q: "كيف أشحن رصيد المحفظة؟",
    a: "اذهب إلى 'حسابي' ثم 'المحفظة'، واضغط على 'شحن الرصيد' واختر المبلغ الذي تريده.",
  },
  {
    id: "3",
    q: "هل يمكنني إلغاء الرحلة؟",
    a: "نعم، يمكنك إلغاء الرحلة قبل وصول السائق. قد تُطبق رسوم إلغاء إذا تأخرت في الإلغاء.",
  },
  {
    id: "4",
    q: "كيف أتواصل مع السائق؟",
    a: "بعد قبول الرحلة، ستظهر لك أيقونة الاتصال في شاشة تتبع الرحلة للتواصل مع السائق مباشرة.",
  },
  {
    id: "5",
    q: "ما هي طرق الدفع المتاحة؟",
    a: "يمكنك الدفع عبر محفظة مسار أو نقداً للسائق مباشرة.",
  },
  {
    id: "6",
    q: "كيف أُقيّم السائق؟",
    a: "بعد انتهاء الرحلة، ستظهر لك شاشة التقييم تلقائياً. يمكنك أيضاً تقييم رحلاتك السابقة من قسم 'رحلاتي'.",
  },
  {
    id: "7",
    q: "ماذا أفعل إذا نسيت شيئاً في السيارة؟",
    a: "تواصل معنا فوراً عبر واتساب أو الاتصال المباشر، وسنساعدك في التواصل مع السائق.",
  },
];

const contactOptions = [
  { id: "whatsapp", icon: "💬", label: "واتساب", sub: "+964 770 000 0000", color: "#25D366" },
  { id: "phone", icon: "📞", label: "اتصال مباشر", sub: "+964 770 000 0000", color: "#0a7ea4" },
  { id: "email", icon: "📧", label: "البريد الإلكتروني", sub: "support@masar.iq", color: "#6B7A8D" },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const colors = {
    bg: isDark ? "#0D0019" : "#F5F7FA",
    sectionTitle: isDark ? "#C4B5D4" : "#1A0533",
    faqCard: isDark ? "#1E0F4A" : "#FFFFFF",
    faqQ: isDark ? "#FFFFFF" : "#1A0533",
    faqA: isDark ? "#C4B5D4" : "#6B7A8D",
    faqBorder: isDark ? "#2D1B69" : "#F0EBF8",
    contactCard: isDark ? "#1E0F4A" : "#FFFFFF",
    contactLabel: isDark ? "#FFFFFF" : "#1A0533",
    contactSub: isDark ? "#9B8AB0" : "#6B7A8D",
  };

  const handleContact = (id: string) => {
    if (id === "whatsapp") {
      Linking.openURL("https://wa.me/9647700000000").catch(() =>
        Alert.alert("خطأ", "تعذّر فتح واتساب")
      );
    } else if (id === "phone") {
      Linking.openURL("tel:+9647700000000").catch(() =>
        Alert.alert("خطأ", "تعذّر إجراء الاتصال")
      );
    } else if (id === "email") {
      Linking.openURL("mailto:support@masar.iq").catch(() =>
        Alert.alert("خطأ", "تعذّر فتح البريد الإلكتروني")
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المساعدة والدعم</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.bg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🛟</Text>
          <Text style={[styles.heroTitle, { color: colors.sectionTitle }]}>كيف يمكننا مساعدتك؟</Text>
          <Text style={[styles.heroSub, { color: colors.faqA }]}>فريق الدعم متاح 24/7</Text>
        </View>

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>تواصل معنا</Text>
          {contactOptions.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.contactCard, { backgroundColor: colors.contactCard }]}
              onPress={() => handleContact(opt.id)}
            >
              <View style={[styles.contactIconBox, { backgroundColor: opt.color + "22" }]}>
                <Text style={styles.contactIcon}>{opt.icon}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, { color: colors.contactLabel }]}>{opt.label}</Text>
                <Text style={[styles.contactSub, { color: colors.contactSub }]}>{opt.sub}</Text>
              </View>
              <Text style={[styles.contactArrow, { color: opt.color }]}>←</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>الأسئلة الشائعة</Text>
          {faqs.map((faq) => (
            <TouchableOpacity
              key={faq.id}
              style={[styles.faqCard, { backgroundColor: colors.faqCard }]}
              onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
            >
              <View style={styles.faqHeader}>
                <Text style={[styles.faqArrow, { color: "#FFD700" }]}>
                  {expandedFaq === faq.id ? "▲" : "▼"}
                </Text>
                <Text style={[styles.faqQ, { color: colors.faqQ }]}>{faq.q}</Text>
              </View>
              {expandedFaq === faq.id && (
                <Text style={[styles.faqA, { color: colors.faqA, borderTopColor: colors.faqBorder }]}>
                  {faq.a}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

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
  hero: { alignItems: "center", paddingVertical: 28, gap: 6 },
  heroEmoji: { fontSize: 52 },
  heroTitle: { fontSize: 20, fontWeight: "800" },
  heroSub: { fontSize: 13 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "800", textAlign: "right", marginBottom: 12 },
  contactCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 16, padding: 16,
    marginBottom: 10, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  contactIconBox: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  contactIcon: { fontSize: 22 },
  contactInfo: { flex: 1, alignItems: "flex-end" },
  contactLabel: { fontSize: 15, fontWeight: "700" },
  contactSub: { fontSize: 12, marginTop: 2 },
  contactArrow: { fontSize: 18, fontWeight: "700" },
  faqCard: {
    borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  faqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  faqArrow: { fontSize: 12, fontWeight: "700" },
  faqQ: { flex: 1, fontSize: 14, fontWeight: "700", textAlign: "right" },
  faqA: {
    fontSize: 13, lineHeight: 22, textAlign: "right",
    marginTop: 12, paddingTop: 12, borderTopWidth: 1,
  },
});

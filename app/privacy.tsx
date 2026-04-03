import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeContext } from "@/lib/theme-provider";

const sections = [
  {
    title: "مقدمة",
    content:
      "تطبيق مسار ملتزم بحماية خصوصيتك وأمان بياناتك الشخصية. تصف هذه السياسة كيفية جمع معلوماتك واستخدامها وحمايتها عند استخدامك لخدماتنا في العراق.",
  },
  {
    title: "المعلومات التي نجمعها",
    content:
      "نجمع رقم هاتفك لأغراض التحقق وتسجيل الدخول، واسمك الذي تقدمه عند إنشاء الحساب، وموقعك الجغرافي لتحديد موقعك وتوجيه السائق إليك، وسجل رحلاتك لتحسين الخدمة وعرض تاريخك.",
  },
  {
    title: "كيف نستخدم معلوماتك",
    content:
      "نستخدم بياناتك لتقديم خدمة النقل وربطك بالسائقين المتاحين، ولإرسال رموز التحقق OTP عبر الرسائل النصية، ولتحسين جودة الخدمة وتطوير التطبيق، ولمعالجة المدفوعات وإدارة محفظتك الإلكترونية.",
  },
  {
    title: "مشاركة البيانات",
    content:
      "لا نبيع بياناتك الشخصية لأي طرف ثالث. نشارك موقعك مع السائق فقط أثناء الرحلة، ونشارك معلومات محدودة مع مزودي خدمة الرسائل النصية لإرسال رموز التحقق.",
  },
  {
    title: "أمان البيانات",
    content:
      "نستخدم تشفير SSL/TLS لحماية البيانات أثناء النقل، ونخزن بياناتك على خوادم آمنة في السحابة. لا نخزن كلمات مرور لأننا نعتمد على نظام OTP فقط.",
  },
  {
    title: "حقوقك",
    content:
      "يحق لك طلب الاطلاع على بياناتك الشخصية المخزنة، وطلب تصحيح أي معلومات غير دقيقة، وطلب حذف حسابك وجميع بياناتك المرتبطة به عبر التواصل مع فريق الدعم.",
  },
  {
    title: "الاتصال بنا",
    content:
      "إذا كان لديك أي استفسار حول سياسة الخصوصية، يمكنك التواصل معنا عبر البريد الإلكتروني: privacy@masar-iq.com أو عبر قسم المساعدة داخل التطبيق.",
  },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  const colors = {
    bg: isDark ? "#0D0019" : "#F5F7FA",
    header: isDark ? "#1A0533" : "#1A0533",
    card: isDark ? "#1E0F4A" : "#FFFFFF",
    title: isDark ? "#FFD700" : "#1A0533",
    body: isDark ? "#C4B5D4" : "#4B5563",
    sectionTitle: isDark ? "#FFD700" : "#1A0533",
    border: isDark ? "#2D1B69" : "#F0F0F0",
    badge: isDark ? "#2D1B69" : "#EDE9FE",
    badgeText: isDark ? "#C4B5D4" : "#6B21A8",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سياسة الخصوصية</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Intro Banner */}
        <View style={[styles.introBanner, { backgroundColor: isDark ? "#1A0533" : "#EDE9FE" }]}>
          <Text style={styles.introEmoji}>🔒</Text>
          <Text style={[styles.introText, { color: isDark ? "#C4B5D4" : "#6B21A8" }]}>
            خصوصيتك أولويتنا — نحن ملتزمون بحماية بياناتك الشخصية
          </Text>
        </View>

        {/* Last Updated */}
        <View style={[styles.badgeRow]}>
          <View style={[styles.badge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.badgeText, { color: colors.badgeText }]}>
              آخر تحديث: أبريل 2026
            </Text>
          </View>
        </View>

        {/* Sections */}
        {sections.map((s, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardNum, { color: isDark ? "#FFD700" : "#7C3AED" }]}>
                {String(i + 1).padStart(2, "0")}
              </Text>
              <Text style={[styles.cardTitle, { color: colors.sectionTitle }]}>{s.title}</Text>
            </View>
            <Text style={[styles.cardBody, { color: colors.body }]}>{s.content}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    color: "#fff",
    fontSize: 20,
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  introBanner: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  introEmoji: { fontSize: 32 },
  introText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
    textAlign: "right",
  },
  badgeRow: {
    alignItems: "flex-end",
    marginBottom: 4,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "flex-end",
  },
  cardNum: {
    fontSize: 22,
    fontWeight: "900",
    opacity: 0.4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 24,
    textAlign: "right",
  },
});

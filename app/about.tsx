import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeContext } from "@/lib/theme-provider";

const features = [
  { icon: "🚗", title: "توصيلة سريعة", desc: "احجز رحلتك في ثوانٍ وتتبعها مباشرة" },
  { icon: "📦", title: "توصيل الطرود", desc: "أرسل طرودك بأمان إلى أي مكان في الموصل" },
  { icon: "⭐", title: "اشتراكات شهرية", desc: "وفّر أكثر مع باقات الاشتراك المخصصة" },
  { icon: "🔒", title: "أمان وموثوقية", desc: "جميع السائقين موثّقون ومعتمدون" },
  { icon: "💰", title: "محفظة إلكترونية", desc: "ادفع بسهولة وتتبع معاملاتك" },
  { icon: "📍", title: "تتبع مباشر", desc: "اعرف موقع سائقك في كل لحظة" },
];

const team = [
  { role: "تطوير التطبيق", name: "فريق مسار التقني" },
  { role: "تصميم واجهة المستخدم", name: "فريق التصميم" },
  { role: "عمليات وخدمة العملاء", name: "فريق العمليات" },
];

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  const colors = {
    bg: isDark ? "#0D0019" : "#F5F7FA",
    header: "#1A0533",
    card: isDark ? "#1E0F4A" : "#FFFFFF",
    title: isDark ? "#FFFFFF" : "#1A0533",
    body: isDark ? "#C4B5D4" : "#4B5563",
    muted: isDark ? "#9B8AB0" : "#6B7A8D",
    border: isDark ? "#2D1B69" : "#F0F0F0",
    iconBg: isDark ? "#2D1B69" : "#EDE9FE",
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>عن التطبيق</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Logo & App Info */}
        <View style={[styles.heroCard, { backgroundColor: "#1A0533" }]}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>م</Text>
          </View>
          <Text style={styles.appName}>مسار</Text>
          <Text style={styles.appTagline}>تطبيق النقل الذكي في الموصل</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>الإصدار 1.0.0</Text>
          </View>
        </View>

        {/* Mission */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.title }]}>رسالتنا 🎯</Text>
          <Text style={[styles.cardBody, { color: colors.body }]}>
            مسار هو تطبيق النقل الذكي المصمم خصيصاً لمدينة الموصل والعراق. هدفنا توفير تجربة نقل آمنة وموثوقة وميسورة التكلفة لجميع سكان المدينة، مع دعم السائقين المحليين وتمكينهم من تحقيق دخل مستدام.
          </Text>
        </View>

        {/* Features */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.title }]}>مميزات التطبيق ✨</Text>
          <View style={styles.featuresGrid}>
            {features.map((f, i) => (
              <View key={i} style={[styles.featureItem, { borderBottomColor: colors.border, borderBottomWidth: i < features.length - 1 ? 1 : 0 }]}>
                <View style={[styles.featureIcon, { backgroundColor: colors.iconBg }]}>
                  <Text style={styles.featureEmoji}>{f.icon}</Text>
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.title }]}>{f.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.muted }]}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: "#1A0533" }]}>
          <Text style={styles.statsTitle}>مسار بالأرقام 📊</Text>
          <View style={styles.statsRow}>
            {[
              { num: "١٠٠٠+", label: "مستخدم نشط" },
              { num: "٥٠٠+", label: "سائق معتمد" },
              { num: "٤.٩", label: "تقييم المستخدمين" },
            ].map((s, i) => (
              <View key={i} style={styles.statItem}>
                <Text style={styles.statNum}>{s.num}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Team */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.title }]}>فريق العمل 👥</Text>
          {team.map((t, i) => (
            <View key={i} style={[styles.teamRow, { borderBottomColor: colors.border, borderBottomWidth: i < team.length - 1 ? 1 : 0 }]}>
              <Text style={[styles.teamName, { color: colors.title }]}>{t.name}</Text>
              <Text style={[styles.teamRole, { color: colors.muted }]}>{t.role}</Text>
            </View>
          ))}
        </View>

        {/* Contact */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.title }]}>تواصل معنا 📬</Text>
          {[
            { icon: "📧", label: "البريد الإلكتروني", value: "support@masar-iq.com" },
            { icon: "🌐", label: "الموقع الإلكتروني", value: "www.masar-iq.com" },
            { icon: "📱", label: "واتساب الدعم", value: "+964 770 000 0000" },
          ].map((c, i) => (
            <View key={i} style={[styles.contactRow, { borderBottomColor: colors.border, borderBottomWidth: i < 2 ? 1 : 0 }]}>
              <Text style={[styles.contactValue, { color: isDark ? "#FFD700" : "#7C3AED" }]}>{c.value}</Text>
              <View style={styles.contactLeft}>
                <Text style={[styles.contactLabel, { color: colors.muted }]}>{c.label}</Text>
                <Text style={styles.contactIcon}>{c.icon}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text style={[styles.footer, { color: colors.muted }]}>
          © 2026 مسار — جميع الحقوق محفوظة
        </Text>

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
  heroCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#1A0533",
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },
  appTagline: {
    color: "#C4B5D4",
    fontSize: 14,
    textAlign: "center",
  },
  versionBadge: {
    marginTop: 4,
    backgroundColor: "rgba(255,215,0,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  versionText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 26,
    textAlign: "right",
  },
  featuresGrid: {
    gap: 0,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureEmoji: { fontSize: 22 },
  featureText: {
    flex: 1,
    alignItems: "flex-end",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  featureDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  statsCard: {
    borderRadius: 18,
    padding: 20,
    gap: 16,
  },
  statsTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    color: "#FFD700",
    fontSize: 24,
    fontWeight: "900",
  },
  statLabel: {
    color: "#C4B5D4",
    fontSize: 11,
  },
  teamRow: {
    paddingVertical: 12,
    alignItems: "flex-end",
    gap: 2,
  },
  teamName: {
    fontSize: 14,
    fontWeight: "700",
  },
  teamRole: {
    fontSize: 12,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  contactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactIcon: { fontSize: 18 },
  contactLabel: { fontSize: 13 },
  contactValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 4,
  },
});

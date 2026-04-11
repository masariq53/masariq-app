import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePassenger } from "@/lib/passenger-context";
import { useDriver } from "@/lib/driver-context";
import { useThemeContext } from "@/lib/theme-provider";
import { trpc } from "@/lib/trpc";
import { getApiBaseUrl } from "@/constants/oauth";
import { getSessionToken } from "@/lib/_core/auth";
import { useLanguage, useT, type Language } from "@/lib/i18n";

const DARK_MODE_KEY = "@masar_dark_mode";

export default function ProfileScreen() {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [captainCheckLoading, setCaptainCheckLoading] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const { passenger, logout } = usePassenger();
  const { driver, logout: logoutDriver } = useDriver();
  const { colorScheme, setColorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  const { data: driverStatus } = trpc.driver.checkStatus.useQuery(
    { phone: passenger?.phone ?? "" },
    {
      enabled: !!passenger?.phone,
      staleTime: 0,
      refetchOnMount: true,
      refetchInterval: 30000,
      refetchIntervalInBackground: false,
    }
  );

  const fetchDriverStatusDirect = async (phone: string) => {
    try {
      const token = await getSessionToken();
      const normalizedPhone = phone.replace(/\s/g, "");
      const input = encodeURIComponent(JSON.stringify({ json: { phone: normalizedPhone } }));
      const res = await fetch(`${getApiBaseUrl()}/api/trpc/driver.checkStatus?input=${input}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      return json?.result?.data?.json ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    AsyncStorage.getItem(DARK_MODE_KEY).then((val) => {
      if (val === "dark") setColorScheme("dark");
      else if (val === "light") setColorScheme("light");
    });
  }, []);

  const handleDarkModeToggle = async (value: boolean) => {
    const scheme = value ? "dark" : "light";
    setColorScheme(scheme);
    await AsyncStorage.setItem(DARK_MODE_KEY, scheme);
  };

  const handleLogout = () => {
    Alert.alert(
      t.auth.logout,
      t.profile.logout + "?",
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.auth.logout,
          style: "destructive",
          onPress: async () => {
            await Promise.all([logout(), logoutDriver()]);
            router.replace("/auth/login" as any);
          },
        },
      ]
    );
  };

  const handleMenuItem = (id: string) => {
    if (id === "wallet") router.push("/wallet" as any);
    else if (id === "subscription") router.push("/subscription" as any);
    else if (id === "edit") router.push("/profile/edit" as any);
    else if (id === "about") router.push("/about" as any);
    else if (id === "privacy") router.push("/privacy" as any);
    else if (id === "help") router.push("/help" as any);
    else if (id === "addresses") router.push("/addresses" as any);
    else if (id === "promo") router.push("/promo" as any);
    else if (id === "language") setShowLangModal(true);
  };

  const handleLanguageSelect = async (lang: Language) => {
    await setLanguage(lang);
    setShowLangModal(false);
  };

  const goToCaptainMode = async () => {
    setCaptainCheckLoading(true);
    try {
      const freshStatus = await fetchDriverStatusDirect(passenger?.phone ?? "");

      if (freshStatus?.found) {
        const liveStatus = freshStatus.registrationStatus;

        if (freshStatus.isBlocked) {
          const reason = freshStatus.blockReason || "تم تعطيل حسابك من قِبل الإدارة";
          Alert.alert(
            "حسابك معطّل 🚫",
            `لا يمكنك الدخول لوضع الكابتن.\n\nالسبب: ${reason}\n\nللاستفسار تواصل مع الدعم.`,
            [
              { text: t.common.ok, style: "cancel" },
              {
                text: "💬 تواصل مع الدعم",
                onPress: () => router.push({ pathname: "/support/new" as any, params: { prefillSubject: "تعطيل الحساب", prefillMessage: `حسابي تم تعطيله. السبب: ${reason}` } }),
              },
            ]
          );
          return;
        }

        if (liveStatus === "approved") {
          const normalizePhone = (p: string) => p.replace(/\s/g, "").replace(/^0/, "+964").replace(/^(?!\+)/, "+964");
          const passengerPhone = normalizePhone(passenger?.phone ?? "");
          const driverPhone = driver?.phone ? normalizePhone(driver.phone) : null;

          if (driver?.id && driverPhone === passengerPhone) {
            router.replace("/captain/home" as any);
            return;
          }

          Alert.alert(
            "حسابك معتمد ✔️",
            "تم قبول حسابك كسائق. سجّل دخولك للبدء باستقبال الرحلات!",
            [
              { text: t.common.cancel, style: "cancel" },
              { text: "دخول كابتن 🚗", onPress: () => router.push({ pathname: "/driver/login" as any, params: { prefillPhone: passenger?.phone ?? "" } }) },
            ]
          );
          return;
        }

        if (liveStatus === "pending") {
          Alert.alert("طلبك قيد المراجعة ⏳", "تسجيلك كسائق لا يزال تحت المراجعة. سيتم إشعارك عند القبول.", [{ text: t.common.ok }]);
          return;
        }

        Alert.alert(
          "تم رفض طلبك ❌",
          "للأسف تم رفض طلب تسجيلك كسائق.\n\nهل تريد إعادة التسجيل ببيانات جديدة?",
          [
            { text: t.common.cancel, style: "cancel" },
            { text: "تسجيل جديد", onPress: () => router.push("/driver/register" as any) },
          ]
        );
        return;
      }

      Alert.alert(
        "لا تمتلك حساب كابتن 🚗",
        "هذا الخيار مخصص للسائقين المعتمدين فقط.\n\nهل تريد تسجيل حساب سائق والانضمام إلى فريق مسار?",
        [
          { text: t.common.no, style: "cancel" },
          { text: "نعم، سجّلني", onPress: () => router.push("/driver/register" as any) },
        ]
      );
    } finally {
      setCaptainCheckLoading(false);
    }
  };

  const colors = {
    bg: isDark ? "#0D0019" : "#F5F7FA",
    card: isDark ? "#1E0F4A" : "#FFFFFF",
    cardBorder: isDark ? "#2D1B69" : "#F0F0F0",
    sectionTitle: isDark ? "#9B8AB0" : "#6B7A8D",
    menuLabel: isDark ? "#FFFFFF" : "#1A0533",
    menuArrow: isDark ? "#4D3A6A" : "#C0C8D4",
    statValue: isDark ? "#FFFFFF" : "#1A0533",
    statLabel: isDark ? "#9B8AB0" : "#6B7A8D",
    profileName: isDark ? "#FFFFFF" : "#1A0533",
    profilePhone: isDark ? "#9B8AB0" : "#6B7A8D",
    editBtn: isDark ? "#2D1B69" : "#F5F7FA",
    editBtnBorder: isDark ? "#3D2580" : "#E2E8F0",
    editBtnText: isDark ? "#FFD700" : "#1A0533",
    version: isDark ? "#4D3A6A" : "#C0C8D4",
  };

  // Language display names
  const langNames: Record<Language, string> = {
    ar: "العربية 🇮🇶",
    en: "English 🇬🇧",
    ku: "کوردی 🏳️",
  };

  const menuSections = [
    {
      section: t.profile.myAccount,
      items: [
        { id: "edit", icon: "✏️", label: t.profile.editProfile, arrow: true },
        { id: "wallet", icon: "💰", label: t.profile.wallet, arrow: true },
        { id: "addresses", icon: "📍", label: "عناويني المحفوظة", arrow: true },
      ],
    },
    {
      section: "الخدمات",
      items: [
        { id: "subscription", icon: "⭐", label: t.profile.subscriptions, arrow: true },
        { id: "promo", icon: "🎁", label: t.profile.promoCode, arrow: true },
        { id: "invite", icon: "👥", label: "دعوة الأصدقاء", arrow: true },
      ],
    },
    {
      section: "الدعم",
      items: [
        { id: "help", icon: "❓", label: t.profile.help, arrow: true },
        { id: "about", icon: "ℹ️", label: t.profile.about, arrow: true },
        { id: "privacy", icon: "🔒", label: t.profile.privacy, arrow: true },
      ],
    },
  ];

  return (
    <View style={[styles.outerContainer, { backgroundColor: "#1A0533" }]}>
      <ScreenContainer
        containerClassName="bg-[#1A0533]"
        safeAreaClassName={isDark ? "bg-[#0D0019]" : "bg-[#F5F7FA]"}
      >
        <StatusBar style="light" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.profile.myAccount}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.bg }}>
          {/* Profile Card */}
          <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
            <TouchableOpacity onPress={() => router.push("/profile/edit" as any)}>
              {passenger?.photoUrl ? (
                <Image source={{ uri: passenger.photoUrl }} style={styles.avatarLarge} />
              ) : (
                <View style={[styles.avatarLarge, { backgroundColor: "#1A0533" }]}>
                  <Text style={styles.avatarText}>
                    {passenger?.name ? passenger.name.charAt(0).toUpperCase() : 'م'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.profileName }]}>
                {passenger?.name || 'مستخدم مسار'}
              </Text>
              <Text style={[styles.profilePhone, { color: colors.profilePhone }]}>
                {passenger?.phone ? `+964 ${passenger.phone}` : '+964 07XX XXX XXXX'}
              </Text>
              <View style={styles.ratingRow}>
                <Text style={styles.ratingText}>{passenger?.rating || '5.0'} ★</Text>
                <Text style={[styles.ratingCount, { color: colors.profilePhone }]}>
                  • {passenger?.totalRides || 0} {t.common.seats.replace("مقاعد", "رحلة")}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.editBtn, borderColor: colors.editBtnBorder }]}
              onPress={() => router.push("/profile/edit" as any)}
            >
              <Text style={[styles.editBtnText, { color: colors.editBtnText }]}>{t.common.edit}</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { label: t.captain.totalRides, value: String(passenger?.totalRides || 0), icon: "🚗" },
              { label: t.wallet.balance, value: `${passenger?.walletBalance || '0'} د`, icon: "💰" },
              { label: t.common.rating, value: String(passenger?.rating || '5.0'), icon: "⭐" },
            ].map((s, i) => (
              <View key={i} style={[styles.statCard, { backgroundColor: colors.card }]}>
                <Text style={styles.statIcon}>{s.icon}</Text>
                <Text style={[styles.statValue, { color: colors.statValue }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.statLabel }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Menu Sections */}
          {menuSections.map((section, si) => (
            <View key={si} style={styles.menuSection}>
              <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>
                {section.section}
              </Text>
              <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
                {section.items.map((item, ii) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.menuItem,
                      ii < section.items.length - 1 && [styles.menuItemBorder, { borderBottomColor: colors.cardBorder }],
                    ]}
                    onPress={() => handleMenuItem(item.id)}
                  >
                    <Text style={[styles.menuArrow, { color: colors.menuArrow }]}>←</Text>
                    <Text style={[styles.menuLabel, { color: colors.menuLabel }]}>{item.label}</Text>
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Preferences */}
          <View style={styles.menuSection}>
            <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>التفضيلات</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
              {/* Language Selector */}
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.cardBorder }]}
                onPress={() => setShowLangModal(true)}
              >
                <Text style={[styles.menuArrow, { color: colors.menuArrow }]}>←</Text>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={[styles.menuLabel, { color: colors.menuLabel, flex: 0 }]}>{t.profile.language}</Text>
                  <Text style={{ color: "#FFD700", fontSize: 12, marginTop: 2 }}>{langNames[language]}</Text>
                </View>
                <Text style={styles.menuIcon}>🌐</Text>
              </TouchableOpacity>

              <View style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.cardBorder }]}>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: "#E2E8F0", true: "#FFD700" }}
                  thumbColor="#FFFFFF"
                />
                <Text style={[styles.menuLabel, { color: colors.menuLabel }]}>الإشعارات</Text>
                <Text style={styles.menuIcon}>🔔</Text>
              </View>
              <View style={styles.menuItem}>
                <Switch
                  value={isDark}
                  onValueChange={handleDarkModeToggle}
                  trackColor={{ false: "#E2E8F0", true: "#1A0533" }}
                  thumbColor={isDark ? "#FFD700" : "#FFFFFF"}
                />
                <Text style={[styles.menuLabel, { color: colors.menuLabel }]}>الوضع الداكن</Text>
                <Text style={styles.menuIcon}>🌙</Text>
              </View>
            </View>
          </View>

          {/* Captain Mode Banner */}
          <TouchableOpacity
            style={[styles.captainBanner, captainCheckLoading && { opacity: 0.7 }]}
            onPress={goToCaptainMode}
            disabled={captainCheckLoading}
          >
            <View style={styles.captainBannerContent}>
              <View>
                <Text style={styles.captainBannerTitle}>🚗  {t.profile.captainMode}</Text>
                <Text style={styles.captainBannerSub}>اشتغل كسائق واكسب أرباحاً</Text>
              </View>
              {captainCheckLoading ? (
                <ActivityIndicator color="#FFD700" size="small" />
              ) : (
                <Text style={styles.captainBannerArrow}>←</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>🚪  {t.auth.logout}</Text>
          </TouchableOpacity>

          <Text style={[styles.version, { color: colors.version }]}>{t.common.appName} v1.0.0</Text>
          <View style={{ height: 100 }} />
        </ScrollView>
      </ScreenContainer>

      {/* Language Selection Modal */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLangModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLangModal(false)}
        >
          <View style={[styles.langModal, { backgroundColor: isDark ? "#1E0F4A" : "#FFFFFF" }]}>
            <Text style={[styles.langModalTitle, { color: isDark ? "#FFFFFF" : "#1A0533" }]}>
              🌐  {t.language.selectLanguage}
            </Text>
            {([
              { code: "ar" as Language, label: t.language.arabic, flag: "🇮🇶", flagImg: null },
              { code: "ku" as Language, label: t.language.kurdish, flag: null, flagImg: require("../../assets/images/kurdistan-flag.webp") },
              { code: "en" as Language, label: t.language.english, flag: "🇬🇧", flagImg: null },
            ]).map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langOption,
                  language === lang.code && styles.langOptionActive,
                  { borderColor: isDark ? "#2D1B69" : "#E2E8F0" },
                ]}
                onPress={() => handleLanguageSelect(lang.code)}
              >
                {lang.flagImg ? (
                  <Image source={lang.flagImg} style={styles.langFlagImg} />
                ) : (
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                )}
                <Text style={[styles.langLabel, { color: isDark ? "#FFFFFF" : "#1A0533" }]}>
                  {lang.label}
                </Text>
                {language === lang.code && (
                  <Text style={styles.langCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.langCancelBtn}
              onPress={() => setShowLangModal(false)}
            >
              <Text style={styles.langCancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1 },
  header: {
    backgroundColor: "#1A0533",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", textAlign: "right" },
  profileCard: {
    flexDirection: "row", alignItems: "center", margin: 16,
    borderRadius: 20, padding: 16, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  avatarLarge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarText: { color: "#FFD700", fontSize: 28, fontWeight: "800" },
  profileInfo: { flex: 1, alignItems: "flex-end" },
  profileName: { fontSize: 16, fontWeight: "800" },
  profilePhone: { fontSize: 13, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  ratingText: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
  ratingCount: { fontSize: 12 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  editBtnText: { fontSize: 13, fontWeight: "700" },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: "center", gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11 },
  menuSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "600", textAlign: "right", marginBottom: 8, marginRight: 4 },
  menuCard: {
    borderRadius: 18, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1 },
  menuIcon: { fontSize: 20, width: 28, textAlign: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "600", textAlign: "right" },
  menuArrow: { fontSize: 18 },
  logoutBtn: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#FEE2E2", borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  logoutText: { color: "#EF4444", fontSize: 16, fontWeight: "700" },
  captainBanner: {
    marginHorizontal: 20, marginBottom: 12, borderRadius: 16,
    overflow: 'hidden', backgroundColor: '#2D0A5E', borderWidth: 1.5, borderColor: '#FFD700',
  },
  captainBannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  captainBannerTitle: { color: '#FFD700', fontSize: 17, fontWeight: '700', textAlign: 'right' },
  captainBannerSub: { color: '#C8A8E9', fontSize: 13, marginTop: 4, textAlign: 'right' },
  captainBannerArrow: { color: '#FFD700', fontSize: 22, fontWeight: '700' },
  version: { fontSize: 12, textAlign: "center", marginBottom: 8 },
  // Language Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  langModal: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  langModalTitle: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 20 },
  langOption: {
    flexDirection: "row", alignItems: "center", paddingVertical: 16,
    paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5,
    marginBottom: 10, gap: 12,
  },
  langOptionActive: { borderColor: "#FFD700", backgroundColor: "rgba(255,215,0,0.08)" },
  langFlag: { fontSize: 24 },
  langFlagImg: { width: 22, height: 16, borderRadius: 3, resizeMode: "cover" },
  langLabel: { flex: 1, fontSize: 17, fontWeight: "600" },
  langCheck: { color: "#FFD700", fontSize: 20, fontWeight: "800" },
  langCancelBtn: {
    marginTop: 8, paddingVertical: 14, borderRadius: 14,
    backgroundColor: "#F5F7FA", alignItems: "center",
  },
  langCancelText: { color: "#6B7A8D", fontSize: 16, fontWeight: "600" },
});

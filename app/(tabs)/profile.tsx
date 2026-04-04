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

const DARK_MODE_KEY = "@masar_dark_mode";

export default function ProfileScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [captainCheckLoading, setCaptainCheckLoading] = useState(false);
  const { passenger, logout } = usePassenger();
  const { driver, logout: logoutDriver } = useDriver();
  const { colorScheme, setColorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  // Check if passenger has a linked driver account - always fresh from DB
  // refetchInterval ensures status is always up-to-date without user action
  const { data: driverStatus } = trpc.driver.checkStatus.useQuery(
    { phone: passenger?.phone ?? "" },
    {
      enabled: !!passenger?.phone,
      staleTime: 0,
      refetchOnMount: true,
      refetchInterval: 30000, // Poll every 30 seconds automatically
      refetchIntervalInBackground: false,
    }
  );

  // Direct fetch function that bypasses TanStack Query cache entirely
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

  // Load dark mode preference on mount
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
      "تسجيل الخروج",
      "هل أنت متأكد من تسجيل الخروج؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "خروج",
          style: "destructive",
          onPress: async () => {
            // Logout from both passenger AND driver sessions
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
  };

  const goToCaptainMode = async () => {
    setCaptainCheckLoading(true);
    try {
      // Direct fetch bypassing TanStack Query cache for 100% fresh data
      const freshStatus = await fetchDriverStatusDirect(passenger?.phone ?? "");

      if (freshStatus?.found) {
        const liveStatus = freshStatus.registrationStatus;

        // Check if account is blocked FIRST before anything else
        if (freshStatus.isBlocked) {
          const reason = freshStatus.blockReason || "تم تعطيل حسابك من قِبل الإدارة";
          Alert.alert(
            "حسابك معطّل 🚫",
            `لا يمكنك الدخول لوضع الكابتن.\n\nالسبب: ${reason}\n\nللاستفسار تواصل مع الدعم.`,
            [{ text: "حسناً" }]
          );
          return;
        }

        if (liveStatus === "approved") {
          // Normalize phone numbers for comparison
          const normalizePhone = (p: string) => p.replace(/\s/g, "").replace(/^0/, "+964").replace(/^(?!\+)/, "+964");
          const passengerPhone = normalizePhone(passenger?.phone ?? "");
          const driverPhone = driver?.phone ? normalizePhone(driver.phone) : null;

          // Check if already logged in as the SAME driver (matching phone)
          if (driver?.id && driverPhone === passengerPhone) {
            // Already logged in as the correct driver - go directly to captain home
            router.push("/captain/home" as any);
            return;
          }

          // Either not logged in, or logged in as a DIFFERENT driver account
          // Must re-authenticate with the passenger's phone number
          Alert.alert(
            "حسابك معتمد ✔️",
            "تم قبول حسابك كسائق. سجّل دخولك للبدء باستقبال الرحلات!",
            [
              { text: "إلغاء", style: "cancel" },
              { text: "دخول كابتن 🚗", onPress: () => router.push({ pathname: "/driver/login" as any, params: { prefillPhone: passenger?.phone ?? "" } }) },
            ]
          );
          return;
        }

        if (liveStatus === "pending") {
          Alert.alert(
            "طلبك قيد المراجعة ⏳",
            "تسجيلك كسائق لا يزال تحت المراجعة. سيتم إشعارك عند القبول.",
            [{ text: "حسناً" }]
          );
          return;
        }

        // rejected - guide to re-register from profile
        Alert.alert(
          "تم رفض طلبك ❌",
          "للأسف تم رفض طلب تسجيلك كسائق.\n\nهل تريد إعادة التسجيل ببيانات جديدة?",
          [
            { text: "إلغاء", style: "cancel" },
            { text: "تسجيل جديد", onPress: () => router.push("/driver/register" as any) },
          ]
        );
        return;
      }

      // No captain account at all - offer to register
      Alert.alert(
        "لا تمتلك حساب كابتن 🚗",
        "هذا الخيار مخصص للسائقين المعتمدين فقط.\n\nهل تريد تسجيل حساب سائق والانضمام إلى فريق مسار?",
        [
          { text: "لا، شكراً", style: "cancel" },
          { text: "نعم، سجّلني", onPress: () => router.push("/driver/register" as any) },
        ]
      );
    } finally {
      setCaptainCheckLoading(false);
    }
  };

  // Dynamic colors based on dark mode
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

  const menuSections = [
    {
      section: "الحساب",
      items: [
        { id: "edit", icon: "✏️", label: "تعديل الملف الشخصي", arrow: true },
        { id: "wallet", icon: "💰", label: "المحفظة والمدفوعات", arrow: true },
        { id: "addresses", icon: "📍", label: "عناويني المحفوظة", arrow: true },
      ],
    },
    {
      section: "الخدمات",
      items: [
        { id: "subscription", icon: "⭐", label: "اشتراكاتي", arrow: true },
        { id: "promo", icon: "🎁", label: "أكواد الخصم", arrow: true },
        { id: "invite", icon: "👥", label: "دعوة الأصدقاء", arrow: true },
      ],
    },
    {
      section: "الدعم",
      items: [
        { id: "help", icon: "❓", label: "المساعدة والدعم", arrow: true },
        { id: "about", icon: "ℹ️", label: "عن التطبيق", arrow: true },
        { id: "privacy", icon: "🔒", label: "سياسة الخصوصية", arrow: true },
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
          <Text style={styles.headerTitle}>الملف الشخصي</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: colors.bg }}
        >
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
                  • {passenger?.totalRides || 0} رحلة
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.editBtn, borderColor: colors.editBtnBorder }]}
              onPress={() => router.push("/profile/edit" as any)}
            >
              <Text style={[styles.editBtnText, { color: colors.editBtnText }]}>تعديل</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { label: "الرحلات", value: String(passenger?.totalRides || 0), icon: "🚗" },
              { label: "المحفظة", value: `${passenger?.walletBalance || '0'} د`, icon: "💰" },
              { label: "التقييم", value: String(passenger?.rating || '5.0'), icon: "⭐" },
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
                <Text style={styles.captainBannerTitle}>🚗  وضع الكابتن</Text>
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
            <Text style={styles.logoutText}>🚪  تسجيل الخروج</Text>
          </TouchableOpacity>

          <Text style={[styles.version, { color: colors.version }]}>مسار v1.0.0</Text>
          <View style={{ height: 100 }} />
        </ScrollView>
      </ScreenContainer>
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
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: {
    color: "#FFD700",
    fontSize: 28,
    fontWeight: "800",
  },
  profileInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
  },
  profilePhone: {
    fontSize: 13,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  ratingText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "700",
  },
  ratingCount: {
    fontSize: 12,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    fontSize: 22,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 11,
  },
  menuSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    marginBottom: 8,
    marginRight: 4,
  },
  menuCard: {
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
  },
  menuIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  menuArrow: {
    fontSize: 18,
  },
  logoutBtn: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
  },
  captainBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2D0A5E',
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  captainBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  captainBannerTitle: {
    color: '#FFD700',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'right',
  },
  captainBannerSub: {
    color: '#C8A8E9',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'right',
  },
  captainBannerArrow: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: '700',
  },
  version: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
});

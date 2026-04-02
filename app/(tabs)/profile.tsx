import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

const menuItems = [
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

export default function ProfileScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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
            await AsyncStorage.removeItem("user_logged_in");
            router.replace("/auth/login" as any);
          },
        },
      ]
    );
  };

  const handleMenuItem = (id: string) => {
    if (id === "wallet") router.push("/wallet" as any);
    else if (id === "subscription") router.push("/subscription" as any);
  };

  return (
    <ScreenContainer containerClassName="bg-[#1A2E4A]" safeAreaClassName="bg-[#F5F7FA]">
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>م</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>مستخدم موصل رايد</Text>
            <Text style={styles.profilePhone}>+964 07XX XXX XXXX</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>4.9 ★</Text>
              <Text style={styles.ratingCount}>• 23 رحلة</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.editBtnText}>تعديل</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "الرحلات", value: "23", icon: "🚗" },
            { label: "التوصيل", value: "7", icon: "📦" },
            { label: "النقاط", value: "450", icon: "⭐" },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Menu Sections */}
        {menuItems.map((section, si) => (
          <View key={si} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, ii) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuItem,
                    ii < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={() => handleMenuItem(item.id)}
                >
                  <Text style={styles.menuArrow}>←</Text>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Preferences */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>التفضيلات</Text>
          <View style={styles.menuCard}>
            <View style={[styles.menuItem, styles.menuItemBorder]}>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: "#E2E8F0", true: "#F5A623" }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.menuLabel}>الإشعارات</Text>
              <Text style={styles.menuIcon}>🔔</Text>
            </View>
            <View style={styles.menuItem}>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: "#E2E8F0", true: "#1A2E4A" }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.menuLabel}>الوضع الداكن</Text>
              <Text style={styles.menuIcon}>🌙</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪  تسجيل الخروج</Text>
        </TouchableOpacity>

        <Text style={styles.version}>موصل رايد v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1A2E4A",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#1A2E4A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#F5A623",
    fontSize: 28,
    fontWeight: "800",
  },
  profileInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  profileName: {
    color: "#1A2E4A",
    fontSize: 16,
    fontWeight: "800",
  },
  profilePhone: {
    color: "#6B7A8D",
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
    color: "#F5A623",
    fontSize: 13,
    fontWeight: "700",
  },
  ratingCount: {
    color: "#6B7A8D",
    fontSize: 12,
  },
  editBtn: {
    backgroundColor: "#F5F7FA",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  editBtnText: {
    color: "#1A2E4A",
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
    backgroundColor: "#FFFFFF",
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
    color: "#1A2E4A",
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    color: "#6B7A8D",
    fontSize: 11,
  },
  menuSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#6B7A8D",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    marginBottom: 8,
    marginRight: 4,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#F5F7FA",
  },
  menuIcon: {
    fontSize: 20,
    width: 28,
    textAlign: "center",
  },
  menuLabel: {
    flex: 1,
    color: "#1A2E4A",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
  },
  menuArrow: {
    color: "#C0C8D4",
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
  version: {
    color: "#C0C8D4",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
});

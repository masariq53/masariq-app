import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePassenger } from "@/lib/passenger-context";
import { useLocation } from "@/hooks/use-location";
import { useThemeContext } from "@/lib/theme-provider";
import { useT } from "@/lib/i18n";
import { getUnreadCount } from "@/lib/notification-store";

const { width } = Dimensions.get("window");

const serviceColors = {
  light: ["#E8E0F8", "#FFF5D6", "#E8F0FE", "#FDE8F8"],
  dark: ["#2D1B69", "#3D2800", "#1A2A5E", "#3D1A3D"],
};

export default function HomeScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { passenger, setIsBlockedOverlay } = usePassenger();
  const { coords, isRealLocation } = useLocation();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  const services = [
    { id: "ride", icon: "🚗", label: t.home.ride },
    { id: "delivery", icon: "📦", label: t.home.delivery },
    { id: "subscription", icon: "⭐", label: t.home.subscription },
    { id: "intercity", icon: "🛣️", label: t.home.intercity },
  ];

  const promos = [
    { id: "1", title: t.home.firstRideFree, subtitle: t.home.useCode + ": MASAR1", color: "#FFD700", textColor: "#1A0533", emoji: "🎉" },
    { id: "2", title: t.home.monthlySubscription, subtitle: t.home.saveUpTo40, color: "#1A0533", textColor: "#FFFFFF", emoji: "💰" },
  ];

  const quickDestinations = [
    { id: "1", name: t.home.republicanHospital, icon: "🏥", distance: "3.2 " + t.common.km },
    { id: "2", name: t.home.mosulUniversity, icon: "🎓", distance: "5.8 " + t.common.km },
    { id: "3", name: t.home.shaarMarket, icon: "🛒", distance: "1.5 " + t.common.km },
  ];

  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getUnreadCount().then(setUnreadCount).catch(() => {});
    }, [])
  );

  const colors = {
    scrollBg: isDark ? "#0D0019" : "#F0EBF8",
    searchBg: isDark ? "#1E0F4A" : "#FFFFFF",
    searchText: isDark ? "#FFFFFF" : "#2D1B69",
    searchPlaceholder: isDark ? "#6B5A8A" : "#9BA1A6",
    sectionTitle: isDark ? "#C4B5D4" : "#2D1B69",
    serviceLabel: isDark ? "#FFFFFF" : "#2D1B69",
    destCard: isDark ? "#1E0F4A" : "#FFFFFF",
    destName: isDark ? "#FFFFFF" : "#1A0533",
    destDist: isDark ? "#9B8AB0" : "#6B7A8D",
    destIconBg: isDark ? "#2D1B69" : "#F5F7FA",
  };

  const handleService = (id: string) => {
    // منع الحسابات المحظورة من الوصول لأي خدمة - الـ overlay يُعرض تلقائياً
    if (passenger?.isBlocked) {
      setIsBlockedOverlay(true);
      return;
    }
    if (id === "ride") router.push("/ride-type-select" as any);
    else if (id === "delivery") router.push("/(tabs)/delivery" as any);
    else if (id === "subscription") router.push("/subscription" as any);
    else if (id === "intercity") router.push("/intercity" as any);
  };

  const handleBlockedNavigation = (action: () => void) => {
    if (passenger?.isBlocked) {
      setIsBlockedOverlay(true);
      return;
    }
    action();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
            {passenger?.photoUrl ? (
              <Image source={{ uri: passenger.photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {passenger?.name ? passenger.name.charAt(0).toUpperCase() : "م"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.greeting}>{t.home.hello} 👋</Text>
            <Text style={styles.userName}>{passenger?.name || passenger?.phone || t.home.masarUser}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/support" as any)}>
            <Text style={styles.notifIcon}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/notifications" as any)}>
            <Text style={styles.notifIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                {unreadCount <= 9 && <Text style={styles.notifBadgeText}>{unreadCount}</Text>}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.scroll, { backgroundColor: colors.scrollBg }]}
      >
        {/* Search Bar */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.searchContainer, { backgroundColor: colors.searchBg }]}
          onPress={() => handleBlockedNavigation(() => router.push("/ride-type-select" as any))}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={[styles.searchInput, { color: colors.searchPlaceholder }]}>{t.home.whereToGo}</Text>
        </TouchableOpacity>

        {/* Services Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>{t.home.ourServices}</Text>
          <View style={styles.servicesGrid}>
            {services.map((s, i) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.serviceCard, { backgroundColor: serviceColors[isDark ? "dark" : "light"][i] }]}
                onPress={() => handleService(s.id)}
              >
                <Text style={styles.serviceEmoji}>{s.icon}</Text>
                <Text style={[styles.serviceLabel, { color: colors.serviceLabel }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Promo Banners */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>{t.home.specialOffers}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promoScroll}>
            {promos.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.promoCard, { backgroundColor: p.color }]}>
                <Text style={styles.promoEmoji}>{p.emoji}</Text>
                <Text style={[styles.promoTitle, { color: p.textColor }]}>{p.title}</Text>
                <Text style={[styles.promoSubtitle, { color: p.textColor, opacity: 0.8 }]}>{p.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Destinations */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>{t.home.suggestedDestinations}</Text>
          {quickDestinations.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.destCard, { backgroundColor: colors.destCard }]}
              onPress={() => handleBlockedNavigation(() => router.push("/ride-type-select" as any))}
            >
              <View style={[styles.destIcon, { backgroundColor: colors.destIconBg }]}>
                <Text style={styles.destEmoji}>{d.icon}</Text>
              </View>
              <View style={styles.destInfo}>
                <Text style={[styles.destName, { color: colors.destName }]}>{d.name}</Text>
                <Text style={[styles.destDist, { color: colors.destDist }]}>{d.distance}</Text>
              </View>
              <Text style={styles.destArrow}>←</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety Banner */}
        <TouchableOpacity style={styles.safetyBanner}>
          <Text style={styles.safetyEmoji}>🛡️</Text>
          <View style={styles.safetyText}>
            <Text style={styles.safetyTitle}>{t.home.safeRides}</Text>
            <Text style={styles.safetySubtitle}>{t.home.allDriversVerified}</Text>
          </View>
          <Text style={styles.safetyArrow}>←</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#1A0533",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
  },
  avatarImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "#FFD700" },
  avatarText: { color: "#1A0533", fontSize: 18, fontWeight: "800" },
  greeting: { color: "#C4B5D4", fontSize: 12 },
  userName: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  notifBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,215,0,0.15)", alignItems: "center", justifyContent: "center", position: "relative",
  },
  notifIcon: { fontSize: 20 },
  notifBadge: {
    position: "absolute", top: 6, right: 6, minWidth: 16, height: 16,
    borderRadius: 8, backgroundColor: "#EF4444", borderWidth: 2, borderColor: "#1A0533",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 2,
  },
  notifBadgeText: {
    color: "#FFFFFF", fontSize: 9, fontWeight: "800", lineHeight: 12,
  },
  scroll: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  searchContainer: {
    flexDirection: "row", alignItems: "center", borderRadius: 16,
    margin: 20, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, gap: 10,
  },
  searchIcon: { fontSize: 18 },
  searchInput: { flex: 1, fontSize: 15, textAlign: "right" },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 14, textAlign: "right" },
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  serviceCard: {
    width: (width - 52) / 2, borderRadius: 18, padding: 20,
    alignItems: "center", gap: 10, shadowColor: "#2D1B69",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  serviceEmoji: { fontSize: 36 },
  serviceLabel: { fontSize: 15, fontWeight: "700" },
  promoScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  promoCard: {
    borderRadius: 20, padding: 20, marginRight: 14, width: 200,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 4,
  },
  promoEmoji: { fontSize: 32, marginBottom: 8 },
  promoTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  promoSubtitle: { fontSize: 12, lineHeight: 18 },
  destCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 14,
    padding: 14, marginBottom: 10, shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, gap: 12,
  },
  destIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  destEmoji: { fontSize: 22 },
  destInfo: { flex: 1, alignItems: "flex-end" },
  destName: { fontSize: 15, fontWeight: "700" },
  destDist: { fontSize: 12, marginTop: 2 },
  destArrow: { color: "#FFD700", fontSize: 20, fontWeight: "700" },
  safetyBanner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#1A0533",
    borderRadius: 18, marginHorizontal: 20, marginBottom: 20, padding: 16,
    borderWidth: 1, borderColor: "#2D1B69", gap: 12,
  },
  safetyEmoji: { fontSize: 28 },
  safetyText: { flex: 1, alignItems: "flex-end" },
  safetyTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  safetySubtitle: { color: "#9B8AB0", fontSize: 12, marginTop: 2 },
  safetyArrow: { color: "#FFD700", fontSize: 20 },
});

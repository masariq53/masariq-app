import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePassenger } from "@/lib/passenger-context";
import { useLocation } from "@/hooks/use-location";

const { width } = Dimensions.get("window");

const services = [
  { id: "ride", icon: "🚗", label: "توصيلة", color: "#2D1B69", bg: "#E8E0F8" },
  { id: "delivery", icon: "📦", label: "توصيل طرود", color: "#2D1B69", bg: "#FFF5D6" },
  { id: "subscription", icon: "⭐", label: "اشتراكات", color: "#2D1B69", bg: "#E8F0FE" },
  { id: "women", icon: "👩", label: "سائقة", color: "#2D1B69", bg: "#FDE8F8" },
];

const promos = [
  {
    id: "1",
    title: "أول رحلة مجانية!",
    subtitle: "استخدم كود: MASAR1",
    color: "#FFD700",
    textColor: "#1A0533",
    emoji: "🎉",
  },
  {
    id: "2",
    title: "اشتراك شهري",
    subtitle: "وفّر حتى 40% على رحلاتك",
    color: "#1A0533",
    textColor: "#FFFFFF",
    emoji: "💰",
  },
];

const quickDestinations = [
  { id: "1", name: "المستشفى الجمهوري", icon: "🏥", distance: "3.2 كم" },
  { id: "2", name: "جامعة الموصل", icon: "🎓", distance: "5.8 كم" },
  { id: "3", name: "سوق الشعارين", icon: "🛒", distance: "1.5 كم" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState("");
  const { passenger } = usePassenger();
  const { coords, isRealLocation } = useLocation();

  const handleService = (id: string) => {
    if (id === "ride") router.push("/ride/book" as any);
    else if (id === "delivery") router.push("/delivery/new" as any);
    else if (id === "subscription") router.push("/subscription" as any);
    else if (id === "women") router.push("/ride/book" as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
            {passenger?.photoUrl ? (
              <Image
                source={{ uri: passenger.photoUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {passenger?.name ? passenger.name.charAt(0).toUpperCase() : "م"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View>
            <Text style={styles.greeting}>مرحباً 👋</Text>
            <Text style={styles.userName}>{passenger?.name || passenger?.phone || 'مستخدم مسار'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Text style={styles.notifIcon}>🔔</Text>
          <View style={styles.notifBadge} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="إلى أين تريد الذهاب؟"
            placeholderTextColor="#9BA1A6"
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => router.push("/ride/book" as any)}
          />
        </View>

        {/* Services Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>خدماتنا</Text>
          <View style={styles.servicesGrid}>
            {services.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.serviceCard, { backgroundColor: s.bg }]}
                onPress={() => handleService(s.id)}
              >
                <Text style={styles.serviceEmoji}>{s.icon}</Text>
                <Text style={[styles.serviceLabel, { color: s.color }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Promo Banners */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>عروض خاصة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promoScroll}>
            {promos.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.promoCard, { backgroundColor: p.color }]}
              >
                <Text style={styles.promoEmoji}>{p.emoji}</Text>
                <Text style={[styles.promoTitle, { color: p.textColor }]}>{p.title}</Text>
                <Text style={[styles.promoSubtitle, { color: p.textColor, opacity: 0.8 }]}>
                  {p.subtitle}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Destinations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>وجهات مقترحة</Text>
          {quickDestinations.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={styles.destCard}
              onPress={() => router.push("/ride/book" as any)}
            >
              <View style={styles.destIcon}>
                <Text style={styles.destEmoji}>{d.icon}</Text>
              </View>
              <View style={styles.destInfo}>
                <Text style={styles.destName}>{d.name}</Text>
                <Text style={styles.destDist}>{d.distance}</Text>
              </View>
              <Text style={styles.destArrow}>←</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety Banner */}
        <TouchableOpacity style={styles.safetyBanner}>
          <Text style={styles.safetyEmoji}>🛡️</Text>
          <View style={styles.safetyText}>
            <Text style={styles.safetyTitle}>رحلاتك آمنة دائماً</Text>
            <Text style={styles.safetySubtitle}>جميع السائقين موثّقون ومعتمدون</Text>
          </View>
          <Text style={styles.safetyArrow}>←</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0533",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#FFD700",
  },
  avatarText: {
    color: "#1A0533",
    fontSize: 18,
    fontWeight: "800",
  },
  greeting: {
    color: "#C4B5D4",
    fontSize: 12,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,215,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notifIcon: {
    fontSize: 20,
  },
  notifBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#1A0533",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#F0EBF8",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    margin: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 10,
  },
  searchIcon: {
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    color: "#2D1B69",
    fontSize: 15,
    textAlign: "right",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: "#2D1B69",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
    textAlign: "right",
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  serviceCard: {
    width: (width - 52) / 2,
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    gap: 10,
    shadowColor: "#2D1B69",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  serviceEmoji: {
    fontSize: 36,
  },
  serviceLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  promoScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  promoCard: {
    borderRadius: 20,
    padding: 20,
    marginRight: 14,
    width: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  promoEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  promoSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  destCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  destIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  destEmoji: {
    fontSize: 22,
  },
  destInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  destName: {
    color: "#1A0533",
    fontSize: 15,
    fontWeight: "700",
  },
  destDist: {
    color: "#6B7A8D",
    fontSize: 12,
    marginTop: 2,
  },
  destArrow: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "700",
  },
  safetyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A0533",
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 14,
  },
  safetyEmoji: {
    fontSize: 32,
  },
  safetyText: {
    flex: 1,
    alignItems: "flex-end",
  },
  safetyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  safetySubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 2,
  },
  safetyArrow: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "700",
  },
});

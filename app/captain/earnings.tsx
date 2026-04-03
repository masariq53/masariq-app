import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDriver } from "@/lib/driver-context";
import { trpc } from "@/lib/trpc";

const { width } = Dimensions.get("window");

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return "منذ قليل";
  if (diffH < 24) return `منذ ${diffH} ساعة`;
  if (diffD === 1) return "أمس";
  return d.toLocaleDateString("ar-IQ", { month: "short", day: "numeric" });
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    completed: "مكتملة ✅",
    cancelled: "ملغاة ❌",
    in_progress: "جارية 🚗",
    accepted: "مقبولة",
    searching: "بحث",
    driver_arrived: "وصلت",
  };
  return map[status] ?? status;
}

export default function CaptainEarningsScreen() {
  const insets = useSafeAreaInsets();
  const { driver } = useDriver();
  const [activeTab, setActiveTab] = useState<"day" | "week" | "month">("week");

  const { data, isLoading, refetch } = trpc.driver.getTrips.useQuery(
    { driverId: driver?.id ?? 0, limit: 50 },
    { enabled: !!driver?.id }
  );

  const trips = data?.trips ?? [];
  const totalEarnings = data?.totalEarnings ?? 0;
  const totalTrips = data?.totalTrips ?? 0;

  // Filter by period
  const filteredTrips = useMemo(() => {
    const now = new Date();
    return trips.filter((t) => {
      const d = new Date(t.createdAt);
      const diffMs = now.getTime() - d.getTime();
      if (activeTab === "day") return diffMs < 86400000;
      if (activeTab === "week") return diffMs < 7 * 86400000;
      return diffMs < 30 * 86400000;
    });
  }, [trips, activeTab]);

  const periodEarnings = filteredTrips
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + parseFloat(t.fare), 0);

  const periodTrips = filteredTrips.filter((t) => t.status === "completed").length;
  const avgPerTrip = periodTrips > 0 ? Math.round(periodEarnings / periodTrips) : 0;

  const TABS = [
    { key: "day", label: "اليوم" },
    { key: "week", label: "الأسبوع" },
    { key: "month", label: "الشهر" },
  ] as const;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>أرباحي</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Driver Info */}
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>
              {driver?.name?.charAt(0) ?? "ك"}
            </Text>
          </View>
          <View>
            <Text style={styles.driverName}>{driver?.name ?? "كابتن مسار"}</Text>
            <Text style={styles.driverMeta}>
              ⭐ {driver?.rating ?? "4.9"} · {driver?.vehicleModel ?? "سيارة مسار"}
            </Text>
          </View>
          <View style={styles.walletBox}>
            <Text style={styles.walletLabel}>المحفظة</Text>
            <Text style={styles.walletValue}>
              {parseFloat(driver?.walletBalance ?? "0").toLocaleString("ar-IQ")}
            </Text>
            <Text style={styles.walletCurrency}>دينار</Text>
          </View>
        </View>

        {/* Period Tabs */}
        <View style={styles.tabsRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Earnings Summary */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>
            إجمالي {activeTab === "day" ? "اليوم" : activeTab === "week" ? "الأسبوع" : "الشهر"}
          </Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalAmount}>{periodEarnings.toLocaleString("ar-IQ")}</Text>
            <Text style={styles.totalCurrency}>د.ع</Text>
          </View>
          <View style={styles.totalStats}>
            <View style={styles.totalStat}>
              <Text style={styles.totalStatValue}>{periodTrips}</Text>
              <Text style={styles.totalStatLabel}>رحلة</Text>
            </View>
            <View style={styles.totalStatDivider} />
            <View style={styles.totalStat}>
              <Text style={styles.totalStatValue}>
                {avgPerTrip.toLocaleString("ar-IQ")}
              </Text>
              <Text style={styles.totalStatLabel}>متوسط/رحلة</Text>
            </View>
            <View style={styles.totalStatDivider} />
            <View style={styles.totalStat}>
              <Text style={styles.totalStatValue}>{driver?.totalRides ?? 0}</Text>
              <Text style={styles.totalStatLabel}>إجمالي الرحلات</Text>
            </View>
          </View>
        </View>

        {/* Trips List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>سجل الرحلات</Text>

          {isLoading ? (
            <ActivityIndicator color="#FFD700" style={{ marginTop: 32 }} />
          ) : filteredTrips.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyText}>لا توجد رحلات في هذه الفترة</Text>
            </View>
          ) : (
            filteredTrips.map((trip) => (
              <View key={trip.id} style={styles.tripCard}>
                <View style={styles.tripIcon}>
                  <Text style={{ fontSize: 22 }}>🚗</Text>
                </View>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripRoute} numberOfLines={1}>
                    {trip.pickupAddress} ← {trip.dropoffAddress}
                  </Text>
                  <Text style={styles.tripMeta}>
                    {getStatusLabel(trip.status)} · {formatDate(trip.createdAt)}
                  </Text>
                </View>
                <View style={styles.tripFare}>
                  <Text style={[
                    styles.tripAmount,
                    trip.status !== "completed" && { color: "#6B7280" },
                  ]}>
                    {trip.status === "completed"
                      ? `+${parseFloat(trip.fare).toLocaleString("ar-IQ")}`
                      : "—"}
                  </Text>
                  {trip.status === "completed" && (
                    <Text style={styles.tripCurrency}>دينار</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0A1E" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#1E1035",
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#1E1035", alignItems: "center", justifyContent: "center",
  },
  backIcon: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },

  driverCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    margin: 20, backgroundColor: "#1E1035", borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: "#2D1B4E",
  },
  driverAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
  },
  driverAvatarText: { fontSize: 22, fontWeight: "900", color: "#1A0533" },
  driverName: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  driverMeta: { fontSize: 12, color: "#9B8EC4", marginTop: 2 },
  walletBox: { marginLeft: "auto", alignItems: "center" },
  walletLabel: { fontSize: 11, color: "#6B7280" },
  walletValue: { fontSize: 18, fontWeight: "900", color: "#22C55E" },
  walletCurrency: { fontSize: 11, color: "#9B8EC4" },

  tabsRow: {
    flexDirection: "row", marginHorizontal: 20, marginBottom: 16,
    backgroundColor: "#1E1035", borderRadius: 14, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#FFD700" },
  tabText: { color: "#6B7280", fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: "#1A0533", fontWeight: "800" },

  totalCard: {
    marginHorizontal: 20, marginBottom: 20,
    backgroundColor: "#1E1035", borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  totalLabel: { color: "#9B8EC4", fontSize: 13, marginBottom: 8 },
  totalRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginBottom: 16 },
  totalAmount: { color: "#FFD700", fontSize: 40, fontWeight: "900" },
  totalCurrency: { color: "#9B8EC4", fontSize: 16 },
  totalStats: { flexDirection: "row", justifyContent: "space-around" },
  totalStat: { alignItems: "center" },
  totalStatValue: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  totalStatLabel: { color: "#6B7280", fontSize: 12, marginTop: 2 },
  totalStatDivider: { width: 1, backgroundColor: "#2D1B4E" },

  section: { paddingHorizontal: 20 },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", marginBottom: 14 },

  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#6B7280", fontSize: 15 },

  tripCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1E1035", borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: "#2D1B4E",
  },
  tripIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center",
  },
  tripInfo: { flex: 1 },
  tripRoute: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  tripMeta: { color: "#6B7280", fontSize: 12, marginTop: 3 },
  tripFare: { alignItems: "flex-end" },
  tripAmount: { color: "#22C55E", fontSize: 16, fontWeight: "800" },
  tripCurrency: { color: "#6B7280", fontSize: 11 },
});

import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Modal,
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
  const [activeTab, setActiveTab] = useState<"day" | "week" | "month" | "custom">("week");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { data, isLoading, refetch } = trpc.driver.getTrips.useQuery(
    { driverId: driver?.id ?? 0, limit: 200 },
    { enabled: !!driver?.id }
  );

  const trips = data?.trips ?? [];
  const totalEarnings = data?.totalEarnings ?? 0;
  const totalTrips = data?.totalTrips ?? 0;

  // Filter by period
  const filteredTrips = useMemo(() => {
    const now = new Date();
    // بداية ونهاية اليوم الحالي
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    // بداية الأسبوع الحالي (من السبت الماضي)
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 6);
    // بداية الشهر الحالي
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    return trips.filter((t) => {
      const d = new Date(t.createdAt);
      if (activeTab === "day") return d >= todayStart && d <= todayEnd;
      if (activeTab === "week") return d >= weekStart && d <= todayEnd;
      if (activeTab === "month") return d >= monthStart && d <= todayEnd;
      if (activeTab === "custom" && customFrom && customTo) {
        const from = new Date(customFrom + "T00:00:00");
        const to = new Date(customTo + "T23:59:59");
        return d >= from && d <= to;
      }
      return d >= monthStart && d <= todayEnd;
    });
  }, [trips, activeTab, customFrom, customTo]);

  const periodEarnings = filteredTrips
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + parseFloat(t.fare), 0);

  const periodTrips = filteredTrips.filter((t) => t.status === "completed").length;
  const avgPerTrip = periodTrips > 0 ? Math.round(periodEarnings / periodTrips) : 0;

  const TABS = [
    { key: "day", label: "اليوم" },
    { key: "week", label: "الأسبوع" },
    { key: "month", label: "الشهر" },
    { key: "custom", label: "مخصص" },
  ] as const;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الرحلات</Text>
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
            إجمالي {activeTab === "day" ? "اليوم" : activeTab === "week" ? "الأسبوع" : activeTab === "month" ? "الشهر" : "الفترة المختارة"}
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
              <Text style={styles.totalStatValue}>{periodTrips}</Text>
              <Text style={styles.totalStatLabel}>إجمالي الرحلات</Text>
            </View>
          </View>
        </View>

        {/* فلتر التاريخ المخصص */}
        {activeTab === "custom" && (
          <View style={styles.dateFilterBox}>
            <Text style={styles.dateFilterTitle}>اختر نطاق التاريخ</Text>
            <View style={styles.dateFilterRow}>
              <View style={styles.dateInputWrap}>
                <Text style={styles.dateInputLabel}>من</Text>
                <TextInput
                  style={styles.dateInput}
                  value={customFrom}
                  onChangeText={setCustomFrom}
                  placeholder="2025-01-01"
                  placeholderTextColor="#6B5A8E"
                  keyboardType="numbers-and-punctuation"
                  textAlign="center"
                />
              </View>
              <Text style={styles.dateSeparator}>—</Text>
              <View style={styles.dateInputWrap}>
                <Text style={styles.dateInputLabel}>إلى</Text>
                <TextInput
                  style={styles.dateInput}
                  value={customTo}
                  onChangeText={setCustomTo}
                  placeholder="2025-12-31"
                  placeholderTextColor="#6B5A8E"
                  keyboardType="numbers-and-punctuation"
                  textAlign="center"
                />
              </View>
            </View>
          </View>
        )}

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
                  {trip.passengerName && (
                    <Text style={styles.passengerName}>👤 {trip.passengerName}</Text>
                  )}
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
  passengerName: { color: "#FFD700", fontSize: 12, fontWeight: "600", marginBottom: 2 },

  // Date filter styles
  dateFilterBox: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: "#1E1035", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  dateFilterTitle: { color: "#9B8EC4", fontSize: 13, fontWeight: "600", marginBottom: 12, textAlign: "center" },
  dateFilterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateSeparator: { color: "#9B8EC4", fontSize: 16, fontWeight: "bold" },
  dateInputWrap: { flex: 1, alignItems: "center" },
  dateInputLabel: { color: "#9B8EC4", fontSize: 11, marginBottom: 4 },
  dateInput: {
    backgroundColor: "#2D1B4E", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: "#FFFFFF", fontSize: 13, fontWeight: "600", width: "100%",
    borderWidth: 1, borderColor: "#3D2070",
  },
});

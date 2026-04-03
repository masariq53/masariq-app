import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";

type FilterType = "all" | "completed" | "cancelled";

function formatDate(isoStr: string) {
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return "منذ قليل";
  if (diffH < 24) return `منذ ${diffH} ساعة`;
  if (diffD === 1) return "أمس";
  if (diffD < 7) return `منذ ${diffD} أيام`;
  return d.toLocaleDateString("ar-IQ", { year: "numeric", month: "short", day: "numeric" });
}

function getStatusInfo(status: string): { label: string; color: string; bg: string } {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    completed: { label: "مكتملة ✅", color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
    cancelled: { label: "ملغاة ❌", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
    in_progress: { label: "جارية 🚗", color: "#FFD700", bg: "rgba(255,215,0,0.12)" },
    searching: { label: "بحث 🔍", color: "#9B8EC4", bg: "rgba(155,142,196,0.12)" },
    accepted: { label: "مقبولة ✓", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
    driver_arrived: { label: "السائق وصل 📍", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  };
  return map[status] ?? { label: status, color: "#9B8EC4", bg: "rgba(155,142,196,0.12)" };
}

type RideItem = {
  id: number;
  status: string;
  fare: number;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedDistance: number;
  estimatedDuration: number;
  paymentMethod: string;
  createdAt: string;
  completedAt: string | null;
  passengerRating: number | null;
  driver: {
    name: string;
    vehicleModel: string;
    vehicleColor: string;
    vehiclePlate: string;
    rating: string;
  } | null;
};

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "completed", label: "مكتملة" },
  { key: "cancelled", label: "ملغاة" },
];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = usePassenger();
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: rides, isLoading, refetch, isRefetching } = trpc.rides.passengerHistory.useQuery(
    { passengerId: passenger?.id ?? 0, limit: 50 },
    { enabled: !!passenger?.id }
  );

  const filteredRides = (rides ?? []).filter((r) => {
    if (filter === "all") return true;
    if (filter === "completed") return r.status === "completed";
    if (filter === "cancelled") return r.status === "cancelled";
    return true;
  });

  const totalSpent = (rides ?? [])
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + (r.fare ?? 0), 0);

  const completedCount = (rides ?? []).filter((r) => r.status === "completed").length;

  const renderItem = ({ item }: { item: RideItem }) => {
    const statusInfo = getStatusInfo(item.status);
    return (
      <View style={styles.card}>
        {/* رأس البطاقة */}
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* المسار */}
        <View style={styles.routeBox}>
          <View style={styles.routeRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.pickupAddress || "موقع الانطلاق"}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.dotRed} />
            <Text style={styles.routeText} numberOfLines={1}>
              {item.dropoffAddress || "الوجهة"}
            </Text>
          </View>
        </View>

        {/* معلومات السائق */}
        {item.driver && (
          <View style={styles.driverRow}>
            <Text style={styles.driverIcon}>👨</Text>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{item.driver.name}</Text>
              {item.driver.vehicleModel ? (
                <Text style={styles.driverCar}>
                  {item.driver.vehicleModel} {item.driver.vehicleColor}
                  {item.driver.vehiclePlate ? ` • ${item.driver.vehiclePlate}` : ""}
                </Text>
              ) : null}
            </View>
            <Text style={styles.driverRating}>⭐ {item.driver.rating}</Text>
          </View>
        )}

        {/* الأجرة والتفاصيل */}
        <View style={styles.cardFooter}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>الأجرة</Text>
            <Text style={styles.fareValue}>{(item.fare ?? 0).toLocaleString("ar-IQ")} دينار</Text>
          </View>
          {item.estimatedDistance > 0 && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>المسافة</Text>
              <Text style={styles.detailValue}>{item.estimatedDistance.toFixed(1)} كم</Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>الدفع</Text>
            <Text style={styles.detailValue}>{item.paymentMethod === "cash" ? "💵 نقداً" : "👛 محفظة"}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* رأس الصفحة */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>سجل الرحلات</Text>
        {!isLoading && (
          <Text style={styles.headerSub}>{completedCount} رحلة مكتملة</Text>
        )}
      </View>

      {/* إحصائيات سريعة */}
      {!isLoading && (rides ?? []).length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{(rides ?? []).length}</Text>
            <Text style={styles.statLabel}>إجمالي الرحلات</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>مكتملة</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalSpent.toLocaleString("ar-IQ")}</Text>
            <Text style={styles.statLabel}>دينار مصروف</Text>
          </View>
        </View>
      )}

      {/* فلاتر */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* القائمة */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>جاري تحميل سجل رحلاتك...</Text>
        </View>
      ) : !passenger?.id ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>يرجى تسجيل الدخول</Text>
          <Text style={styles.emptyText}>سجّل دخولك لعرض سجل رحلاتك</Text>
        </View>
      ) : filteredRides.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>لا توجد رحلات</Text>
          <Text style={styles.emptyText}>
            {filter === "all"
              ? "لم تقم بأي رحلة بعد. اطلب رحلتك الأولى الآن!"
              : `لا توجد رحلات ${filter === "completed" ? "مكتملة" : "ملغاة"}`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRides as RideItem[]}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#FFD700"
              colors={["#FFD700"]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#3D2070",
  },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "bold" },
  headerSub: { color: "#9B8EC4", fontSize: 13, marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#2D1B4E",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  statCard: { flex: 1, alignItems: "center" },
  statValue: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  statLabel: { color: "#9B8EC4", fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#3D2070" },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#2D1B4E",
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  filterBtnActive: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  filterText: { color: "#9B8EC4", fontSize: 13, fontWeight: "500" },
  filterTextActive: { color: "#1A0533", fontWeight: "bold" },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: "#2D1B4E",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  dateText: { color: "#9B8EC4", fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  routeBox: { marginBottom: 10 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeLine: { width: 2, height: 14, backgroundColor: "#3D2070", marginLeft: 4, marginVertical: 2 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  routeText: { color: "#ECEDEE", fontSize: 13, flex: 1 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,215,0,0.06)",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    gap: 8,
  },
  driverIcon: { fontSize: 20 },
  driverInfo: { flex: 1 },
  driverName: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  driverCar: { color: "#9B8EC4", fontSize: 12, marginTop: 1 },
  driverRating: { color: "#FFD700", fontSize: 13 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#3D2070",
    paddingTop: 10,
  },
  detailItem: { alignItems: "center" },
  detailLabel: { color: "#9B8EC4", fontSize: 11 },
  fareValue: { color: "#FFD700", fontSize: 14, fontWeight: "bold", marginTop: 2 },
  detailValue: { color: "#ECEDEE", fontSize: 13, fontWeight: "500", marginTop: 2 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#9B8EC4", fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  emptyText: { color: "#9B8EC4", fontSize: 14, textAlign: "center", lineHeight: 22 },
});

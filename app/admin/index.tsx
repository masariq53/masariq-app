import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";

const { width } = Dimensions.get("window");

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  searching:     { bg: "#FFF3CD", text: "#856404", label: "يبحث" },
  accepted:      { bg: "#D1ECF1", text: "#0C5460", label: "مقبولة" },
  driver_arrived:{ bg: "#CCE5FF", text: "#004085", label: "السائق وصل" },
  in_progress:   { bg: "#D4EDDA", text: "#155724", label: "جارية" },
  completed:     { bg: "#D4EDDA", text: "#155724", label: "مكتملة" },
  cancelled:     { bg: "#F8D7DA", text: "#721C24", label: "ملغاة" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_COLORS[status] || { bg: "#E2E8F0", text: "#4A5568", label: status };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color, onPress,
}: {
  icon: string; label: string; value: string | number; sub?: string; color: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Text style={styles.statEmoji}>{icon}</Text>
      </View>
      <View style={styles.statInfo}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {sub && <Text style={styles.statSub}>{sub}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "rides" | "drivers" | "passengers" | "pending">("overview");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.stats.useQuery();
  const { data: recentRides, isLoading: ridesLoading, refetch: refetchRides } = trpc.admin.recentRides.useQuery({ limit: 8 });
  const { data: allDrivers, isLoading: driversLoading, refetch: refetchDrivers } = trpc.admin.drivers.useQuery({ limit: 30 });
  const { data: allPassengers, isLoading: passengersLoading, refetch: refetchPassengers } = trpc.admin.passengers.useQuery({ limit: 30 });
  const { data: allRides, isLoading: allRidesLoading, refetch: refetchAllRides } = trpc.admin.rides.useQuery({ limit: 50 });
  const { data: pendingDrivers, isLoading: pendingLoading, refetch: refetchPending } = trpc.admin.pendingDrivers.useQuery();

  const verifyDriver = trpc.admin.verifyDriver.useMutation({
    onSuccess: () => refetchDrivers(),
  });
  const cancelRide = trpc.admin.cancelRide.useMutation({
    onSuccess: () => { refetchRides(); refetchAllRides(); refetchStats(); },
  });
  const reviewDriver = trpc.admin.reviewDriver.useMutation({
    onSuccess: () => { refetchPending(); refetchDrivers(); refetchStats(); },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchRides(), refetchDrivers(), refetchPassengers(), refetchAllRides(), refetchPending()]);
    setRefreshing(false);
  };

  const isLoading = statsLoading && ridesLoading && driversLoading;

  const pendingCount = pendingDrivers?.length ?? 0;

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: "📊" },
    { id: "rides", label: "الرحلات", icon: "🚗" },
    { id: "pending", label: `طلبات${pendingCount > 0 ? ` (${pendingCount})` : ""}`, icon: "⏳" },
    { id: "drivers", label: "السائقون", icon: "👨‍✈️" },
    { id: "passengers", label: "المستخدمون", icon: "👥" },
  ] as const;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>م</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>لوحة تحكم مسار</Text>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>مباشر</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>جاري تحميل البيانات...</Text>
          </View>
        ) : (
          <>
            {/* ── Overview Tab ── */}
            {activeTab === "overview" && (
              <>
                {/* Stats Grid */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>إحصائيات اليوم</Text>
                  <View style={styles.statsGrid}>
                    <StatCard icon="🚗" label="رحلات اليوم" value={stats?.todayRides ?? 0} color="#6C3FC5" onPress={() => setActiveTab("rides")} />
                    <StatCard icon="⚡" label="رحلات نشطة" value={stats?.activeRides ?? 0} color="#22C55E" />
                    <StatCard icon="💰" label="إيرادات اليوم" value={`${(stats?.todayRevenue ?? 0).toLocaleString()} د`} color="#FFD700" />
                    <StatCard icon="👨‍✈️" label="سائقون متاحون" value={stats?.onlineDrivers ?? 0} sub={`من ${stats?.totalDrivers ?? 0}`} color="#3B82F6" onPress={() => setActiveTab("drivers")} />
                  </View>
                </View>

                {/* Total Stats */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>الإجمالي الكلي</Text>
                  <View style={styles.totalRow}>
                    <View style={styles.totalCard}>
                      <Text style={styles.totalValue}>{stats?.totalRides ?? 0}</Text>
                      <Text style={styles.totalLabel}>إجمالي الرحلات</Text>
                    </View>
                    <View style={[styles.totalCard, styles.totalCardGold]}>
                      <Text style={[styles.totalValue, { color: "#1A0533" }]}>{`${(stats?.totalRevenue ?? 0).toLocaleString()}`}</Text>
                      <Text style={[styles.totalLabel, { color: "#1A0533" }]}>إجمالي الإيرادات (د)</Text>
                    </View>
                    <View style={styles.totalCard}>
                      <Text style={styles.totalValue}>{stats?.totalPassengers ?? 0}</Text>
                      <Text style={styles.totalLabel}>إجمالي المستخدمين</Text>
                    </View>
                  </View>
                </View>

                {/* Recent Rides */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>آخر الرحلات</Text>
                    <TouchableOpacity onPress={() => setActiveTab("rides")}>
                      <Text style={styles.seeAll}>عرض الكل ←</Text>
                    </TouchableOpacity>
                  </View>
                  {ridesLoading ? (
                    <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
                  ) : recentRides && recentRides.length > 0 ? (
                    recentRides.map((ride) => (
                      <View key={ride.id} style={styles.rideCard}>
                        <View style={styles.rideCardLeft}>
                          <Text style={styles.rideId}>#{ride.id}</Text>
                          <Text style={styles.rideAddress} numberOfLines={1}>
                            {ride.pickupAddress || `${parseFloat(ride.pickupLat?.toString() || "0").toFixed(3)}°`}
                          </Text>
                          <Text style={styles.rideArrow}>↓</Text>
                          <Text style={styles.rideAddress} numberOfLines={1}>
                            {ride.dropoffAddress || `${parseFloat(ride.dropoffLat?.toString() || "0").toFixed(3)}°`}
                          </Text>
                        </View>
                        <View style={styles.rideCardRight}>
                          <StatusBadge status={ride.status} />
                          <Text style={styles.rideFare}>{Math.round(parseFloat(ride.fare?.toString() || "0")).toLocaleString()} د</Text>
                          <Text style={styles.rideTime}>
                            {ride.createdAt ? new Date(ride.createdAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </Text>
                          {ride.status === "searching" && (
                            <TouchableOpacity
                              style={styles.cancelSmallBtn}
                              onPress={() => cancelRide.mutate({ rideId: ride.id, reason: "Admin cancelled" })}
                            >
                              <Text style={styles.cancelSmallText}>إلغاء</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>🚗</Text>
                      <Text style={styles.emptyText}>لا توجد رحلات بعد</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* ── Rides Tab ── */}
            {activeTab === "rides" && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>جميع الرحلات ({allRides?.length ?? 0})</Text>
                {allRidesLoading ? (
                  <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
                ) : allRides && allRides.length > 0 ? (
                  allRides.map((ride) => (
                    <View key={ride.id} style={styles.rideCard}>
                      <View style={styles.rideCardLeft}>
                        <Text style={styles.rideId}>#{ride.id}</Text>
                        <Text style={styles.rideAddress} numberOfLines={1}>
                          {ride.pickupAddress || `${parseFloat(ride.pickupLat?.toString() || "0").toFixed(4)}, ${parseFloat(ride.pickupLng?.toString() || "0").toFixed(4)}`}
                        </Text>
                        <Text style={styles.rideArrow}>↓</Text>
                        <Text style={styles.rideAddress} numberOfLines={1}>
                          {ride.dropoffAddress || `${parseFloat(ride.dropoffLat?.toString() || "0").toFixed(4)}, ${parseFloat(ride.dropoffLng?.toString() || "0").toFixed(4)}`}
                        </Text>
                        <Text style={styles.rideDate}>
                          {ride.createdAt ? new Date(ride.createdAt).toLocaleDateString("ar-IQ") : ""}
                        </Text>
                      </View>
                      <View style={styles.rideCardRight}>
                        <StatusBadge status={ride.status} />
                        <Text style={styles.rideFare}>{Math.round(parseFloat(ride.fare?.toString() || "0")).toLocaleString()} د</Text>
                        <Text style={styles.rideDistance}>{parseFloat(ride.estimatedDistance?.toString() || "0").toFixed(1)} كم</Text>
                        {(ride.status === "searching" || ride.status === "accepted") && (
                          <TouchableOpacity
                            style={styles.cancelSmallBtn}
                            onPress={() => cancelRide.mutate({ rideId: ride.id })}
                          >
                            <Text style={styles.cancelSmallText}>إلغاء</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🚗</Text>
                    <Text style={styles.emptyText}>لا توجد رحلات</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Drivers Tab ── */}
            {activeTab === "drivers" && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>السائقون ({allDrivers?.length ?? 0})</Text>
                {driversLoading ? (
                  <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
                ) : allDrivers && allDrivers.length > 0 ? (
                  allDrivers.map((driver) => (
                    <View key={driver.id} style={styles.driverCard}>
                      <View style={styles.driverAvatar}>
                        <Text style={styles.driverAvatarText}>
                          {(driver.name || "؟").charAt(0)}
                        </Text>
                      </View>
                      <View style={styles.driverInfo}>
                        <Text style={styles.driverName}>{driver.name || "بدون اسم"}</Text>
                        <Text style={styles.driverPhone}>{driver.phone}</Text>
                        <View style={styles.driverMeta}>
                          <Text style={styles.driverRating}>⭐ {driver.rating}</Text>
                          <Text style={styles.driverRides}>• {driver.totalRides} رحلة</Text>
                          <View style={[styles.onlineDot, { backgroundColor: driver.isOnline ? "#22C55E" : "#94A3B8" }]} />
                        </View>
                        {driver.vehicleModel && (
                          <Text style={styles.driverVehicle}>🚗 {driver.vehicleModel} — {driver.vehicleColor}</Text>
                        )}
                      </View>
                      <View style={styles.driverActions}>
                        <TouchableOpacity
                          style={[styles.verifyBtn, driver.isVerified && styles.verifyBtnActive]}
                          onPress={() => verifyDriver.mutate({ driverId: driver.id, isVerified: !driver.isVerified })}
                        >
                          <Text style={[styles.verifyBtnText, driver.isVerified && styles.verifyBtnTextActive]}>
                            {driver.isVerified ? "✓ موثّق" : "توثيق"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>👨‍✈️</Text>
                    <Text style={styles.emptyText}>لا يوجد سائقون مسجلون</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Pending Drivers Tab ── */}
            {activeTab === "pending" && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  طلبات تسجيل السائقين ({pendingDrivers?.length ?? 0})
                </Text>
                {pendingLoading ? (
                  <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
                ) : pendingDrivers && pendingDrivers.length > 0 ? (
                  pendingDrivers.map((driver) => (
                    <View key={driver.id} style={styles.pendingCard}>
                      {/* Driver Info */}
                      <View style={styles.pendingHeader}>
                        <View style={styles.pendingAvatar}>
                          <Text style={styles.pendingAvatarText}>
                            {(driver.name || "؟").charAt(0)}
                          </Text>
                        </View>
                        <View style={styles.pendingInfo}>
                          <Text style={styles.pendingName}>{driver.name || "بدون اسم"}</Text>
                          <Text style={styles.pendingPhone}>{driver.phone}</Text>
                          <Text style={styles.pendingDate}>
                            {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString("ar-IQ") : ""}
                          </Text>
                        </View>
                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>⏳ قيد المراجعة</Text>
                        </View>
                      </View>

                      {/* Vehicle Info */}
                      {(driver.vehicleModel || driver.vehiclePlate) && (
                        <View style={styles.pendingVehicle}>
                          <Text style={styles.pendingVehicleText}>
                            🚗 {driver.vehicleModel || ""} {driver.vehicleColor ? `• ${driver.vehicleColor}` : ""} {driver.vehicleYear ? `(${driver.vehicleYear})` : ""}
                          </Text>
                          {driver.vehiclePlate && (
                            <Text style={styles.pendingVehicleText}>🔢 {driver.vehiclePlate}</Text>
                          )}
                          {driver.nationalId && (
                            <Text style={styles.pendingVehicleText}>🪪 الهوية: {driver.nationalId}</Text>
                          )}
                        </View>
                      )}

                      {/* Documents */}
                      <View style={styles.pendingDocs}>
                        <Text style={styles.pendingDocsTitle}>الوثائق المرفوعة:</Text>
                        <View style={styles.pendingDocsRow}>
                          <Text style={[styles.pendingDoc, driver.photoUrl ? styles.pendingDocDone : styles.pendingDocMissing]}>
                            {driver.photoUrl ? "✅" : "❌"} صورة شخصية
                          </Text>
                          <Text style={[styles.pendingDoc, driver.nationalIdPhotoUrl ? styles.pendingDocDone : styles.pendingDocMissing]}>
                            {driver.nationalIdPhotoUrl ? "✅" : "❌"} الهوية
                          </Text>
                          <Text style={[styles.pendingDoc, driver.licensePhotoUrl ? styles.pendingDocDone : styles.pendingDocMissing]}>
                            {driver.licensePhotoUrl ? "✅" : "❌"} الرخصة
                          </Text>
                          <Text style={[styles.pendingDoc, driver.vehiclePhotoUrl ? styles.pendingDocDone : styles.pendingDocMissing]}>
                            {driver.vehiclePhotoUrl ? "✅" : "❌"} السيارة
                          </Text>
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={styles.pendingActions}>
                        <TouchableOpacity
                          style={styles.rejectBtn}
                          onPress={() =>
                            Alert.alert(
                              "رفض الطلب",
                              `هل تريد رفض طلب ${driver.name}؟`,
                              [
                                { text: "إلغاء", style: "cancel" },
                                {
                                  text: "رفض",
                                  style: "destructive",
                                  onPress: () =>
                                    reviewDriver.mutate({
                                      driverId: driver.id,
                                      status: "rejected",
                                      rejectionReason: "لا تستوفي المتطلبات",
                                    }),
                                },
                              ]
                            )
                          }
                        >
                          <Text style={styles.rejectBtnText}>❌ رفض</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.approveBtn}
                          onPress={() =>
                            Alert.alert(
                              "قبول الطلب",
                              `هل تريد قبول طلب ${driver.name}؟`,
                              [
                                { text: "إلغاء", style: "cancel" },
                                {
                                  text: "قبول",
                                  onPress: () =>
                                    reviewDriver.mutate({
                                      driverId: driver.id,
                                      status: "approved",
                                    }),
                                },
                              ]
                            )
                          }
                        >
                          <Text style={styles.approveBtnText}>✅ قبول</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>✅</Text>
                    <Text style={styles.emptyText}>لا توجد طلبات معلقة</Text>
                    <Text style={styles.emptySubText}>جميع الطلبات تمت مراجعتها</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Passengers Tab ── */}
            {activeTab === "passengers" && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>المستخدمون ({allPassengers?.length ?? 0})</Text>
                {passengersLoading ? (
                  <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
                ) : allPassengers && allPassengers.length > 0 ? (
                  allPassengers.map((p) => (
                    <View key={p.id} style={styles.passengerCard}>
                      <View style={styles.passengerAvatar}>
                        <Text style={styles.passengerAvatarText}>
                          {(p.name || p.phone || "؟").charAt(0)}
                        </Text>
                      </View>
                      <View style={styles.passengerInfo}>
                        <Text style={styles.passengerName}>{p.name || "بدون اسم"}</Text>
                        <Text style={styles.passengerPhone}>{p.phone}</Text>
                        <View style={styles.passengerMeta}>
                          <Text style={styles.passengerRating}>⭐ {p.rating}</Text>
                          <Text style={styles.passengerRides}>• {p.totalRides} رحلة</Text>
                        </View>
                      </View>
                      <View style={styles.passengerBalance}>
                        <Text style={styles.balanceValue}>{Math.round(parseFloat(p.walletBalance?.toString() || "0")).toLocaleString()}</Text>
                        <Text style={styles.balanceLabel}>دينار</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>👥</Text>
                    <Text style={styles.emptyText}>لا يوجد مستخدمون مسجلون</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0A1E" },

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "#1A0533", borderBottomWidth: 1, borderBottomColor: "#2D1B4E",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: 20, fontWeight: "900", color: "#1A0533" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  liveText: { fontSize: 11, color: "#22C55E", fontWeight: "600" },
  refreshBtn: { padding: 8, backgroundColor: "#2D1B4E", borderRadius: 10 },
  refreshIcon: { fontSize: 18 },

  // Tabs
  tabsScroll: { backgroundColor: "#1A0533", maxHeight: 56 },
  tabsContainer: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#2D1B4E",
  },
  tabActive: { backgroundColor: "#FFD700" },
  tabIcon: { fontSize: 14 },
  tabLabel: { fontSize: 13, color: "#9B8EC4", fontWeight: "600" },
  tabLabelActive: { color: "#1A0533" },

  // Scroll
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  loadingText: { color: "#9B8EC4", marginTop: 12, fontSize: 14 },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#FFFFFF", marginBottom: 12 },
  seeAll: { fontSize: 13, color: "#FFD700", fontWeight: "600" },

  // Stat Cards
  statsGrid: { gap: 10 },
  statCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#1E1035", borderRadius: 14, padding: 14,
    borderLeftWidth: 4,
  },
  statIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statEmoji: { fontSize: 22 },
  statInfo: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
  statLabel: { fontSize: 12, color: "#9B8EC4", marginTop: 2 },
  statSub: { fontSize: 11, color: "#6B7280", marginTop: 1 },

  // Total Row
  totalRow: { flexDirection: "row", gap: 10 },
  totalCard: {
    flex: 1, backgroundColor: "#1E1035", borderRadius: 14, padding: 14,
    alignItems: "center",
  },
  totalCardGold: { backgroundColor: "#FFD700" },
  totalValue: { fontSize: 20, fontWeight: "900", color: "#FFFFFF" },
  totalLabel: { fontSize: 10, color: "#9B8EC4", marginTop: 4, textAlign: "center" },

  // Ride Cards
  rideCard: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#1E1035", borderRadius: 14, padding: 14,
    marginBottom: 8,
  },
  rideCardLeft: { flex: 1, gap: 3 },
  rideCardRight: { alignItems: "flex-end", gap: 4 },
  rideId: { fontSize: 11, color: "#6B7280", fontWeight: "700" },
  rideAddress: { fontSize: 13, color: "#E2E8F0", maxWidth: 180 },
  rideArrow: { fontSize: 12, color: "#6B7280" },
  rideFare: { fontSize: 14, fontWeight: "800", color: "#FFD700" },
  rideTime: { fontSize: 11, color: "#9B8EC4" },
  rideDate: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  rideDistance: { fontSize: 11, color: "#9B8EC4" },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  // Cancel button
  cancelSmallBtn: {
    backgroundColor: "#EF4444", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, marginTop: 4,
  },
  cancelSmallText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  // Driver Cards
  driverCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1E1035", borderRadius: 14, padding: 14, marginBottom: 8,
  },
  driverAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#6C3FC5", alignItems: "center", justifyContent: "center",
  },
  driverAvatarText: { fontSize: 20, fontWeight: "800", color: "#FFFFFF" },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  driverPhone: { fontSize: 12, color: "#9B8EC4", marginTop: 2 },
  driverMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  driverRating: { fontSize: 12, color: "#FFD700" },
  driverRides: { fontSize: 12, color: "#9B8EC4" },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  driverVehicle: { fontSize: 11, color: "#6B7280", marginTop: 3 },
  driverActions: { alignItems: "flex-end" },
  verifyBtn: {
    backgroundColor: "#2D1B4E", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#3D2070",
  },
  verifyBtnActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  verifyBtnText: { fontSize: 12, color: "#9B8EC4", fontWeight: "700" },
  verifyBtnTextActive: { color: "#FFFFFF" },

  // Passenger Cards
  passengerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1E1035", borderRadius: 14, padding: 14, marginBottom: 8,
  },
  passengerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#3B82F6", alignItems: "center", justifyContent: "center",
  },
  passengerAvatarText: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  passengerInfo: { flex: 1 },
  passengerName: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  passengerPhone: { fontSize: 12, color: "#9B8EC4", marginTop: 2 },
  passengerMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  passengerRating: { fontSize: 12, color: "#FFD700" },
  passengerRides: { fontSize: 12, color: "#9B8EC4" },
  passengerBalance: { alignItems: "center" },
  balanceValue: { fontSize: 16, fontWeight: "800", color: "#22C55E" },
  balanceLabel: { fontSize: 10, color: "#9B8EC4" },

  // Empty State
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: "#9B8EC4" },
  emptySubText: { fontSize: 12, color: "#6B7280", marginTop: 4 },

  // Pending Driver Cards
  pendingCard: {
    backgroundColor: "#1E1035", borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#FFD70033",
  },
  pendingHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  pendingAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#FFD70033", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFD700",
  },
  pendingAvatarText: { fontSize: 20, fontWeight: "800", color: "#FFD700" },
  pendingInfo: { flex: 1 },
  pendingName: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
  pendingPhone: { fontSize: 12, color: "#9B8EC4", marginTop: 2 },
  pendingDate: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  pendingBadge: {
    backgroundColor: "#FFF3CD", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  pendingBadgeText: { fontSize: 11, color: "#856404", fontWeight: "700" },
  pendingVehicle: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10,
    marginBottom: 10, gap: 4,
  },
  pendingVehicleText: { fontSize: 12, color: "#CBD5E1" },
  pendingDocs: { marginBottom: 12 },
  pendingDocsTitle: { fontSize: 12, color: "#9B8EC4", marginBottom: 6, fontWeight: "600" },
  pendingDocsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pendingDoc: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  pendingDocDone: { backgroundColor: "#14532D", color: "#4ADE80" },
  pendingDocMissing: { backgroundColor: "#450A0A", color: "#F87171" },
  pendingActions: { flexDirection: "row", gap: 10 },
  rejectBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#450A0A", alignItems: "center",
    borderWidth: 1, borderColor: "#EF4444",
  },
  rejectBtnText: { color: "#F87171", fontSize: 14, fontWeight: "700" },
  approveBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#14532D", alignItems: "center",
    borderWidth: 1, borderColor: "#22C55E",
  },
  approveBtnText: { color: "#4ADE80", fontSize: 14, fontWeight: "700" },
});

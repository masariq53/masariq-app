import React, { useState } from "react";
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
  Image,
  Modal,
  TextInput,
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
  const [activeTab, setActiveTab] = useState<"overview" | "rides" | "drivers" | "passengers" | "pricing">("overview");

  const [driversPage, setDriversPage] = useState(0);
  const [passengersPage, setPassengersPage] = useState(0);
  const PAGE_SIZE = 10;

  // ─── Driver Filters ───────────────────────────────────────────────────────────
  const [driverSearch, setDriverSearch] = useState("");
  const [driverStatusFilter, setDriverStatusFilter] = useState<"all" | "active" | "blocked" | "pending" | "verified">("all");
  const [driverSortBy, setDriverSortBy] = useState<"name" | "rating" | "rides" | "newest">("newest");
  const [driverRatingFilter, setDriverRatingFilter] = useState<"all" | "4+" | "3+" | "below3">("all");
  const [showDriverFilters, setShowDriverFilters] = useState(false);

  // ─── Passenger Filters ────────────────────────────────────────────────────────
  const [passengerSearch, setPassengerSearch] = useState("");
  const [passengerStatusFilter, setPassengerStatusFilter] = useState<"all" | "active" | "blocked">("all");
  const [passengerSortBy, setPassengerSortBy] = useState<"name" | "rating" | "rides" | "newest">("newest");
  const [passengerRidesFilter, setPassengerRidesFilter] = useState<"all" | "0" | "1-5" | "6-20" | "20+">("all");
  const [showPassengerFilters, setShowPassengerFilters] = useState(false);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.stats.useQuery();
  const { data: recentRides, isLoading: ridesLoading, refetch: refetchRides } = trpc.admin.recentRides.useQuery({ limit: 8 });
  const { data: allDrivers, isLoading: driversLoading, refetch: refetchDrivers } = trpc.admin.drivers.useQuery({ limit: 500 });
  const { data: allPassengers, isLoading: passengersLoading, refetch: refetchPassengers } = trpc.admin.passengers.useQuery({ limit: 500 });
  const { data: allRides, isLoading: allRidesLoading, refetch: refetchAllRides } = trpc.admin.rides.useQuery({ limit: 50 });
  const { data: pendingDrivers, isLoading: pendingLoading, refetch: refetchPending } = trpc.admin.pendingDrivers.useQuery();

  const verifyDriver = trpc.admin.verifyDriver.useMutation({
    onSuccess: () => refetchDrivers(),
  });
  const blockDriver = trpc.admin.blockDriver.useMutation({
    onSuccess: () => refetchDrivers(),
  });
  const [docsDriver, setDocsDriver] = useState<NonNullable<typeof allDrivers>[number] | null>(null);
  const cancelRide = trpc.admin.cancelRide.useMutation({
    onSuccess: () => { refetchRides(); refetchAllRides(); refetchStats(); },
  });
  const reviewDriver = trpc.admin.reviewDriver.useMutation({
    onSuccess: () => { refetchPending(); refetchDrivers(); refetchStats(); },
  });
  const deleteDriverMutation = trpc.admin.deleteDriver.useMutation({
    onSuccess: () => { refetchPending(); refetchDrivers(); refetchStats(); },
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState("");

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
    { id: "drivers", label: "السائقون", icon: "👨‍✈️" },
    { id: "passengers", label: "المستخدمون", icon: "👥" },
    { id: "pricing", label: "التسعير", icon: "💰" },
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

                {/* Quick Actions */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>إدارة النظام</Text>
                  <TouchableOpacity
                    style={styles.pricingBanner}
                    onPress={() => router.push("/admin/pricing")}
                    activeOpacity={0.8}
                  >
                    <View style={styles.pricingBannerLeft}>
                      <Text style={styles.pricingBannerIcon}>💰</Text>
                      <View>
                        <Text style={styles.pricingBannerTitle}>إدارة أسعار الرحلات</Text>
                        <Text style={styles.pricingBannerSub}>تسعير المدن · أجرة الكم والدقيقة · رسوم الليل والانتظار</Text>
                      </View>
                    </View>
                    <Text style={styles.pricingBannerArrow}>←</Text>
                  </TouchableOpacity>
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
                {(() => {
                  // ─── Apply Filters ───────────────────────────────────────────
                  let filteredDrivers = (allDrivers ?? []);

                  // Text search
                  if (driverSearch.trim()) {
                    const q = driverSearch.trim().toLowerCase();
                    filteredDrivers = filteredDrivers.filter(d =>
                      (d.name || "").toLowerCase().includes(q) ||
                      (d.phone || "").toLowerCase().includes(q) ||
                      (d.vehicleModel || "").toLowerCase().includes(q) ||
                      (d.vehiclePlate || "").toLowerCase().includes(q)
                    );
                  }

                  // Status filter
                  if (driverStatusFilter === "blocked") {
                    filteredDrivers = filteredDrivers.filter(d => d.isBlocked);
                  } else if (driverStatusFilter === "active") {
                    filteredDrivers = filteredDrivers.filter(d => !d.isBlocked && d.isVerified);
                  } else if (driverStatusFilter === "pending") {
                    filteredDrivers = filteredDrivers.filter(d => !d.isVerified && !d.isBlocked);
                  } else if (driverStatusFilter === "verified") {
                    filteredDrivers = filteredDrivers.filter(d => d.isVerified);
                  }

                  // Rating filter
                  if (driverRatingFilter === "4+") {
                    filteredDrivers = filteredDrivers.filter(d => parseFloat(d.rating?.toString() || "0") >= 4);
                  } else if (driverRatingFilter === "3+") {
                    filteredDrivers = filteredDrivers.filter(d => parseFloat(d.rating?.toString() || "0") >= 3);
                  } else if (driverRatingFilter === "below3") {
                    filteredDrivers = filteredDrivers.filter(d => parseFloat(d.rating?.toString() || "0") < 3);
                  }

                  // Sort
                  if (driverSortBy === "name") {
                    filteredDrivers = [...filteredDrivers].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                  } else if (driverSortBy === "rating") {
                    filteredDrivers = [...filteredDrivers].sort((a, b) => parseFloat(b.rating?.toString() || "0") - parseFloat(a.rating?.toString() || "0"));
                  } else if (driverSortBy === "rides") {
                    filteredDrivers = [...filteredDrivers].sort((a, b) => (b.totalRides || 0) - (a.totalRides || 0));
                  }
                  // newest = default order from server

                  const pagedDrivers = filteredDrivers.slice(driversPage * PAGE_SIZE, (driversPage + 1) * PAGE_SIZE);
                  const totalDriverPages = Math.ceil(filteredDrivers.length / PAGE_SIZE);
                  return (
                    <>
                {/* ─── Search Bar ─────────────────────────────────────────── */}
                <View style={filterStyles.searchRow}>
                  <View style={filterStyles.searchBox}>
                    <Text style={filterStyles.searchIcon}>🔍</Text>
                    <TextInput
                      style={filterStyles.searchInput}
                      placeholder="بحث بالاسم أو الهاتف أو السيارة..."
                      placeholderTextColor="#6B7280"
                      value={driverSearch}
                      onChangeText={v => { setDriverSearch(v); setDriversPage(0); }}
                      returnKeyType="search"
                    />
                    {driverSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setDriverSearch("")}>
                        <Text style={{ color: '#9B8EC4', fontSize: 16, paddingHorizontal: 6 }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[filterStyles.filterToggleBtn, showDriverFilters && filterStyles.filterToggleBtnActive]}
                    onPress={() => setShowDriverFilters(v => !v)}
                  >
                    <Text style={{ fontSize: 16 }}>⚙️</Text>
                  </TouchableOpacity>
                </View>

                {/* ─── Filter Panel ────────────────────────────────────────── */}
                {showDriverFilters && (
                  <View style={filterStyles.filterPanel}>
                    {/* Status */}
                    <Text style={filterStyles.filterLabel}>الحالة</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {([
                          { key: 'all', label: 'الكل' },
                          { key: 'active', label: '✅ نشط' },
                          { key: 'pending', label: '⏳ قيد المراجعة' },
                          { key: 'verified', label: '✓ موثّق' },
                          { key: 'blocked', label: '🚫 محظور' },
                        ] as const).map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[filterStyles.chip, driverStatusFilter === opt.key && filterStyles.chipActive]}
                            onPress={() => { setDriverStatusFilter(opt.key); setDriversPage(0); }}
                          >
                            <Text style={[filterStyles.chipText, driverStatusFilter === opt.key && filterStyles.chipTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Rating */}
                    <Text style={filterStyles.filterLabel}>التقييم</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {([
                          { key: 'all', label: 'الكل' },
                          { key: '4+', label: '⭐ 4+ ممتاز' },
                          { key: '3+', label: '⭐ 3+ جيد' },
                          { key: 'below3', label: '⭐ أقل من 3' },
                        ] as const).map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[filterStyles.chip, driverRatingFilter === opt.key && filterStyles.chipActive]}
                            onPress={() => { setDriverRatingFilter(opt.key); setDriversPage(0); }}
                          >
                            <Text style={[filterStyles.chipText, driverRatingFilter === opt.key && filterStyles.chipTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Sort */}
                    <Text style={filterStyles.filterLabel}>ترتيب حسب</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {([
                          { key: 'newest', label: '🕐 الأحدث' },
                          { key: 'name', label: '🔤 الاسم' },
                          { key: 'rating', label: '⭐ التقييم' },
                          { key: 'rides', label: '🚗 الرحلات' },
                        ] as const).map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[filterStyles.chip, driverSortBy === opt.key && filterStyles.chipActive]}
                            onPress={() => { setDriverSortBy(opt.key); setDriversPage(0); }}
                          >
                            <Text style={[filterStyles.chipText, driverSortBy === opt.key && filterStyles.chipTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.sectionTitle}>السائقون ({filteredDrivers.length} من {allDrivers?.length ?? 0}) — صفحة {driversPage + 1} من {totalDriverPages || 1}</Text>
                {driversLoading ? (
                  <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
                ) : pagedDrivers && pagedDrivers.length > 0 ? (
                  pagedDrivers.map((driver) => (
                    <View key={driver.id} style={[styles.driverCard, driver.isBlocked && { borderLeftWidth: 3, borderLeftColor: '#EF4444' }]}>
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
                          <Text style={{ fontSize: 10, color: driver.isOnline ? "#22C55E" : "#94A3B8", marginLeft: 2 }}>
                            {driver.isOnline ? "متاح" : "غير متاح"}
                          </Text>
                        </View>
                        {/* Vehicle & Plate */}
                        {driver.vehicleModel ? (
                          <Text style={styles.driverVehicle}>🚗 {driver.vehicleModel}{driver.vehicleColor ? ` • ${driver.vehicleColor}` : ""}</Text>
                        ) : (
                          <Text style={[styles.driverVehicle, { color: '#64748B' }]}>🚗 لا توجد بيانات سيارة</Text>
                        )}
                        {driver.vehiclePlate ? (
                          <Text style={styles.driverVehicle}>🔢 {driver.vehiclePlate}</Text>
                        ) : (
                          <Text style={[styles.driverVehicle, { color: '#64748B' }]}>🔢 لا توجد لوحة</Text>
                        )}
                        {(driver as any).country || (driver as any).city ? (
                          <Text style={[styles.driverVehicle, { color: '#60A5FA' }]}>
                            📍 {[(driver as any).country, (driver as any).city].filter(Boolean).join("، ")}
                          </Text>
                        ) : null}
                        {driver.isBlocked && (
                          <Text style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}>🚫 محظور: {driver.blockReason || "بدون سبب"}</Text>
                        )}
                      </View>
                      <View style={styles.driverActions}>
                        {/* Verification - locked once verified */}
                        {driver.isVerified ? (
                          <View style={[styles.verifyBtn, styles.verifyBtnActive]}>
                            <Text style={[styles.verifyBtnText, styles.verifyBtnTextActive]}>✓ موثّق</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.verifyBtn}
                            onPress={() => verifyDriver.mutate({ driverId: driver.id, isVerified: true })}
                          >
                            <Text style={styles.verifyBtnText}>توثيق</Text>
                          </TouchableOpacity>
                        )}
                        {/* Documents icon */}
                        <TouchableOpacity
                          style={styles.docsBtn}
                          onPress={() => setDocsDriver(driver as any)}
                        >
                          <Text style={{ fontSize: 18 }}>👁️</Text>
                        </TouchableOpacity>
                        {/* Block/Unblock */}
                        <TouchableOpacity
                          style={[styles.blockBtn, driver.isBlocked && styles.unblockBtn]}
                          onPress={() => {
                            if (driver.isBlocked) {
                              Alert.alert("تفعيل الحساب", `هل تريد تفعيل حساب ${driver.name}؟`, [
                                { text: "إلغاء", style: "cancel" },
                                { text: "تفعيل", onPress: () => blockDriver.mutate({ driverId: driver.id, isBlocked: false }) },
                              ]);
                            } else {
                              Alert.prompt(
                                "تعطيل الحساب",
                                `سبب تعطيل حساب ${driver.name} (اختياري):`,
                                (reason) => blockDriver.mutate({ driverId: driver.id, isBlocked: true, blockReason: reason || undefined }),
                                "plain-text"
                              );
                            }
                          }}
                        >
                          <Text style={{ fontSize: 11, color: driver.isBlocked ? '#22C55E' : '#EF4444', fontWeight: '700' }}>
                            {driver.isBlocked ? "✓ تفعيل" : "🚫 تعطيل"}
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
                {/* Pagination */}
                {totalDriverPages > 1 && (
                  <View style={styles.paginationRow}>
                    <TouchableOpacity
                      style={[styles.pageBtn, driversPage === 0 && styles.pageBtnDisabled]}
                      onPress={() => setDriversPage(p => Math.max(0, p - 1))}
                      disabled={driversPage === 0}
                    >
                      <Text style={styles.pageBtnText}>→ السابق</Text>
                    </TouchableOpacity>
                    <Text style={styles.pageInfo}>{driversPage + 1} / {totalDriverPages}</Text>
                    <TouchableOpacity
                      style={[styles.pageBtn, driversPage >= totalDriverPages - 1 && styles.pageBtnDisabled]}
                      onPress={() => setDriversPage(p => Math.min(totalDriverPages - 1, p + 1))}
                      disabled={driversPage >= totalDriverPages - 1}
                    >
                      <Text style={styles.pageBtnText}>التالي ←</Text>
                    </TouchableOpacity>
                  </View>
                )}
                    </>
                  );
                })()}
              </View>
            )}

            {/* ── Passengers Tab ── */}
            {activeTab === "passengers" && (
              <View style={styles.section}>
                {(() => {
                  // ─── Apply Filters ───────────────────────────────────────────
                  let filteredPassengers = (allPassengers ?? []);

                  // Text search
                  if (passengerSearch.trim()) {
                    const q = passengerSearch.trim().toLowerCase();
                    filteredPassengers = filteredPassengers.filter(p =>
                      (p.name || "").toLowerCase().includes(q) ||
                      (p.phone || "").toLowerCase().includes(q)
                    );
                  }

                  // Status filter
                  if (passengerStatusFilter === "blocked") {
                    filteredPassengers = filteredPassengers.filter(p => (p as any).isBlocked);
                  } else if (passengerStatusFilter === "active") {
                    filteredPassengers = filteredPassengers.filter(p => !(p as any).isBlocked);
                  }

                  // Rides filter
                  if (passengerRidesFilter === "0") {
                    filteredPassengers = filteredPassengers.filter(p => (p.totalRides || 0) === 0);
                  } else if (passengerRidesFilter === "1-5") {
                    filteredPassengers = filteredPassengers.filter(p => (p.totalRides || 0) >= 1 && (p.totalRides || 0) <= 5);
                  } else if (passengerRidesFilter === "6-20") {
                    filteredPassengers = filteredPassengers.filter(p => (p.totalRides || 0) >= 6 && (p.totalRides || 0) <= 20);
                  } else if (passengerRidesFilter === "20+") {
                    filteredPassengers = filteredPassengers.filter(p => (p.totalRides || 0) > 20);
                  }

                  // Sort
                  if (passengerSortBy === "name") {
                    filteredPassengers = [...filteredPassengers].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                  } else if (passengerSortBy === "rating") {
                    filteredPassengers = [...filteredPassengers].sort((a, b) => parseFloat(b.rating?.toString() || "0") - parseFloat(a.rating?.toString() || "0"));
                  } else if (passengerSortBy === "rides") {
                    filteredPassengers = [...filteredPassengers].sort((a, b) => (b.totalRides || 0) - (a.totalRides || 0));
                  }

                  const pagedPassengers = filteredPassengers.slice(passengersPage * PAGE_SIZE, (passengersPage + 1) * PAGE_SIZE);
                  const totalPassengerPages = Math.ceil(filteredPassengers.length / PAGE_SIZE);
                  return (
                    <>
                {/* ─── Search Bar ─────────────────────────────────────────── */}
                <View style={filterStyles.searchRow}>
                  <View style={filterStyles.searchBox}>
                    <Text style={filterStyles.searchIcon}>🔍</Text>
                    <TextInput
                      style={filterStyles.searchInput}
                      placeholder="بحث بالاسم أو رقم الهاتف..."
                      placeholderTextColor="#6B7280"
                      value={passengerSearch}
                      onChangeText={v => { setPassengerSearch(v); setPassengersPage(0); }}
                      returnKeyType="search"
                    />
                    {passengerSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setPassengerSearch("")}>
                        <Text style={{ color: '#9B8EC4', fontSize: 16, paddingHorizontal: 6 }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[filterStyles.filterToggleBtn, showPassengerFilters && filterStyles.filterToggleBtnActive]}
                    onPress={() => setShowPassengerFilters(v => !v)}
                  >
                    <Text style={{ fontSize: 16 }}>⚙️</Text>
                  </TouchableOpacity>
                </View>

                {/* ─── Filter Panel ────────────────────────────────────────── */}
                {showPassengerFilters && (
                  <View style={filterStyles.filterPanel}>
                    {/* Status */}
                    <Text style={filterStyles.filterLabel}>الحالة</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {([
                          { key: 'all', label: 'الكل' },
                          { key: 'active', label: '✅ نشط' },
                          { key: 'blocked', label: '🚫 محظور' },
                        ] as const).map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[filterStyles.chip, passengerStatusFilter === opt.key && filterStyles.chipActive]}
                            onPress={() => { setPassengerStatusFilter(opt.key); setPassengersPage(0); }}
                          >
                            <Text style={[filterStyles.chipText, passengerStatusFilter === opt.key && filterStyles.chipTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Rides */}
                    <Text style={filterStyles.filterLabel}>عدد الرحلات</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {([
                          { key: 'all', label: 'الكل' },
                          { key: '0', label: 'لا رحلات' },
                          { key: '1-5', label: '1–5 رحلات' },
                          { key: '6-20', label: '6–20 رحلة' },
                          { key: '20+', label: '+20 رحلة' },
                        ] as const).map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[filterStyles.chip, passengerRidesFilter === opt.key && filterStyles.chipActive]}
                            onPress={() => { setPassengerRidesFilter(opt.key); setPassengersPage(0); }}
                          >
                            <Text style={[filterStyles.chipText, passengerRidesFilter === opt.key && filterStyles.chipTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>

                    {/* Sort */}
                    <Text style={filterStyles.filterLabel}>ترتيب حسب</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {([
                          { key: 'newest', label: '🕐 الأحدث' },
                          { key: 'name', label: '🔤 الاسم' },
                          { key: 'rating', label: '⭐ التقييم' },
                          { key: 'rides', label: '🚗 الرحلات' },
                        ] as const).map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[filterStyles.chip, passengerSortBy === opt.key && filterStyles.chipActive]}
                            onPress={() => { setPassengerSortBy(opt.key); setPassengersPage(0); }}
                          >
                            <Text style={[filterStyles.chipText, passengerSortBy === opt.key && filterStyles.chipTextActive]}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.sectionTitle}>المستخدمون ({filteredPassengers.length} من {allPassengers?.length ?? 0}) — صفحة {passengersPage + 1} من {totalPassengerPages || 1}</Text>
                {passengersLoading ? (
                  <ActivityIndicator color="#FFD700" style={{ marginVertical: 20 }} />
                ) : pagedPassengers && pagedPassengers.length > 0 ? (
                  pagedPassengers.map((p) => (
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
                {/* Pagination */}
                {totalPassengerPages > 1 && (
                  <View style={styles.paginationRow}>
                    <TouchableOpacity
                      style={[styles.pageBtn, passengersPage === 0 && styles.pageBtnDisabled]}
                      onPress={() => setPassengersPage(p => Math.max(0, p - 1))}
                      disabled={passengersPage === 0}
                    >
                      <Text style={styles.pageBtnText}>→ السابق</Text>
                    </TouchableOpacity>
                    <Text style={styles.pageInfo}>{passengersPage + 1} / {totalPassengerPages}</Text>
                    <TouchableOpacity
                      style={[styles.pageBtn, passengersPage >= totalPassengerPages - 1 && styles.pageBtnDisabled]}
                      onPress={() => setPassengersPage(p => Math.min(totalPassengerPages - 1, p + 1))}
                      disabled={passengersPage >= totalPassengerPages - 1}
                    >
                      <Text style={styles.pageBtnText}>التالي ←</Text>
                    </TouchableOpacity>
                  </View>
                )}
                    </>
                  );
                })()}
              </View>
            )}
          </>
        )}
        {/* Pricing Tab */}
        {activeTab === "pricing" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>إدارة أسعار الرحلات</Text>
            <View style={{ backgroundColor: 'rgba(108,63,197,0.12)', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(108,63,197,0.3)' }}>
              <Text style={{ color: '#C4B5FD', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                🔄 أي تعديل على الأسعار ينعكس فوراً على حساب أجرة الرحلة — لا حاجة لإعادة التشغيل
              </Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: '#6C3FC5', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 12 }}
              onPress={() => router.push('/admin/pricing' as any)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 32, marginBottom: 8 }}>💰</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginBottom: 4 }}>فتح مدير التسعير</Text>
              <Text style={{ color: '#C4B5FD', fontSize: 13 }}>إضافة مدن · تعديل الأسعار · معاينة الأجرة · سجل التغييرات</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { icon: '📏', title: 'بالكيلومتر', desc: 'تسعير حسب المسافة' },
                { icon: '⏱', title: 'بالدقيقة', desc: 'تسعير حسب الوقت' },
                { icon: '🔀', title: 'هجين', desc: 'كم + دقيقة معاً' },
                { icon: '🌙', title: 'رسوم ليلية', desc: 'مضاعف للساعات المتأخرة' },
                { icon: '⚡', title: 'طلب عالي', desc: 'مضاعف الذروة' },
                { icon: '🏙️', title: 'تعدد المدن', desc: 'سعر مختلف لكل مدينة' },
              ].map((feature, i) => (
                <View key={i} style={{ backgroundColor: '#1A0533', borderRadius: 12, padding: 12, width: '47%', borderWidth: 1, borderColor: '#2D1B4E' }}>
                  <Text style={{ fontSize: 22, marginBottom: 6 }}>{feature.icon}</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>{feature.title}</Text>
                  <Text style={{ color: '#9B8EC4', fontSize: 11 }}>{feature.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Driver Documents Modal */}
      <Modal visible={!!docsDriver} transparent animationType="slide" onRequestClose={() => setDocsDriver(null)}>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#1A0533', borderRadius: 20, padding: 20, width: '92%', maxHeight: '80%' }}>
            <Text style={{ color: '#FFD700', fontSize: 16, fontWeight: '800', marginBottom: 4, textAlign: 'center' }}>
              وثائق {docsDriver?.name || 'السائق'}
            </Text>
            <Text style={{ color: '#9B8EC4', fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
              {docsDriver?.phone} {docsDriver?.vehicleModel ? `• ${docsDriver.vehicleModel}` : ''} {docsDriver?.vehiclePlate ? `• ${docsDriver.vehiclePlate}` : ''}
            </Text>
            <ScrollView>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {[
                  { url: docsDriver?.photoUrl, label: 'صورة شخصية' },
                  { url: docsDriver?.nationalIdPhotoUrl, label: 'الهوية الوطنية' },
                  { url: docsDriver?.nationalIdPhotoBackUrl, label: 'الهوية الخلفية' },
                  { url: docsDriver?.licensePhotoUrl, label: 'رخصة القيادة' },
                  { url: docsDriver?.vehiclePhotoUrl, label: 'صورة السيارة' },
                ].map((doc, idx) => (
                  <TouchableOpacity key={idx} onPress={() => doc.url && setPreviewImage(doc.url)} disabled={!doc.url}
                    style={{ alignItems: 'center', width: 130 }}>
                    {doc.url ? (
                      <Image source={{ uri: doc.url }} style={{ width: 130, height: 100, borderRadius: 10, borderWidth: 1, borderColor: '#4ADE80' }} />
                    ) : (
                      <View style={{ width: 130, height: 100, borderRadius: 10, backgroundColor: '#450A0A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#7F1D1D' }}>
                        <Text style={{ fontSize: 28 }}>❌</Text>
                        <Text style={{ color: '#F87171', fontSize: 10, marginTop: 4 }}>غير مرفوع</Text>
                      </View>
                    )}
                    <Text style={{ color: '#9B8EC4', fontSize: 11, marginTop: 6, textAlign: 'center' }}>{doc.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* National ID text */}
              {docsDriver?.nationalId && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 10, marginTop: 12 }}>
                  <Text style={{ color: '#9B8EC4', fontSize: 12 }}>🪪 رقم الهوية: <Text style={{ color: '#FFFFFF' }}>{docsDriver.nationalId}</Text></Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.modalClose, { marginTop: 16 }]} onPress={() => setDocsDriver(null)}>
              <Text style={styles.modalCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.modalOverlay}>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={styles.modalImage} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewImage(null)}>
            <Text style={styles.modalCloseText}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ─// ─── Filter Styles ──────────────────────────────────────────────────────────
const filterStyles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1035',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2D1B4E',
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  filterToggleBtn: {
    backgroundColor: '#1E1035',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2D1B4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleBtnActive: {
    backgroundColor: '#2D1B4E',
    borderColor: '#FFD700',
  },
  filterPanel: {
    backgroundColor: '#1A0533',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D1B4E',
  },
  filterLabel: {
    color: '#9B8EC4',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#2D1B4E',
    borderWidth: 1,
    borderColor: '#3D2070',
  },
  chipActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  chipText: { color: '#9B8EC4', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#1A0533' },
});

// ─── Styles ───────────────────────────────────────────────────────────
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

  // Delete Button
  deleteBtn: {
    marginTop: 8, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#1a0000", alignItems: "center",
    borderWidth: 1, borderColor: "#7F1D1D",
  },
  deleteBtnText: { color: "#F87171", fontSize: 13, fontWeight: "700" },

  // Document Images
  docsImagesRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  docImageBox: { alignItems: "center", width: 70 },
  docImage: { width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: "#4ADE80" },
  docImageMissing: {
    width: 70, height: 70, borderRadius: 8,
    backgroundColor: "#450A0A", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#7F1D1D",
  },
  docImageMissingIcon: { fontSize: 24 },
  docImageLabel: { color: "#9B8EC4", fontSize: 10, marginTop: 4, textAlign: "center" },

  // Docs & Block Buttons
  docsBtn: {
    backgroundColor: "#1E3A5F", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6,
    alignItems: "center", justifyContent: "center",
    marginTop: 4,
  },
  blockBtn: {
    backgroundColor: "#450A0A", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 6,
    alignItems: "center", justifyContent: "center",
    marginTop: 4, borderWidth: 1, borderColor: "#EF4444",
  },
  unblockBtn: {
    backgroundColor: "#14532D", borderColor: "#22C55E",
  },

  // Image Preview Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  modalImage: { width: "90%", height: "70%", borderRadius: 12 },
  modalClose: {
    marginTop: 20, backgroundColor: "#FFD700",
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12,
  },
  modalCloseText: { color: "#1A0533", fontWeight: "800", fontSize: 16 },

  // Pagination
  paginationRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 12, paddingHorizontal: 4,
  },
  pageBtn: {
    backgroundColor: "#2D1B4E", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "#FFD700",
  },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
  pageInfo: { color: "#9B8EC4", fontSize: 13, fontWeight: "600" },

  // Filter Styles
  filterSearchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  filterSearchBox: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#1E1035',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#2D1B4E',
  },
  filterSearchIcon: { fontSize: 14, marginRight: 6 },
  filterSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  filterToggleBtn: {
    backgroundColor: '#1E1035',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2D1B4E',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  filterToggleBtnActive: {
    backgroundColor: '#2D1B4E',
    borderColor: '#FFD700',
  },
  filterPanel: {
    backgroundColor: '#1A0533',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D1B4E',
  },
  filterLabel: {
    color: '#9B8EC4',
    fontSize: 11,
    fontWeight: '700' as const,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#2D1B4E',
    borderWidth: 1,
    borderColor: '#3D2070',
  },
  filterChipActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  filterChipText: { color: '#9B8EC4', fontSize: 12, fontWeight: '600' as const },
  filterChipTextActive: { color: '#1A0533' },

  // Pricing Banner
  pricingBanner: {
    backgroundColor: "#1E1035",
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#FFD70033",
  },
  pricingBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  pricingBannerIcon: { fontSize: 32 },
  pricingBannerTitle: { fontSize: 16, fontWeight: "800", color: "#FFD700" },
  pricingBannerSub: { fontSize: 12, color: "#9B8EC4", marginTop: 2 },
  pricingBannerArrow: { fontSize: 20, color: "#FFD700", fontWeight: "700" },
});

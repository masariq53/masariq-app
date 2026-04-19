import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";
import { useT } from "@/lib/i18n";

type FilterType = "all" | "completed" | "cancelled";

const ACTIVE_STATUSES = ["searching", "accepted", "driver_arrived", "in_progress"];

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
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  estimatedDistance: number;
  estimatedDuration: number;
  paymentMethod: string;
  createdAt: string;
  completedAt: string | null;
  passengerRating: number | null;
  driver: {
    name: string;
    phone: string;
    vehicleModel: string;
    vehicleColor: string;
    vehiclePlate: string;
    rating: string;
  } | null;
};

const PAGE_SIZE = 15;

export default function HistoryScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { passenger } = usePassenger();
  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "completed", label: t.statusLabels.completed },
    { key: "cancelled", label: t.statusLabels.cancelled },
  ];
  const [filter, setFilter] = useState<FilterType>("all");
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [allRides, setAllRides] = useState<RideItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [isFirstPage, setIsFirstPage] = useState(true);
  // حالة الـ modal لتفاصيل الرحلة المكتملة/الملغاة
  const [selectedRide, setSelectedRide] = useState<RideItem | null>(null);
  // لمنع مسح الرحلات أثناء الـ refresh
  const isRefreshingRef = useRef(false);

  // First page query (no cursor)
  const firstPageQuery = trpc.rides.passengerHistory.useQuery(
    { passengerId: passenger?.id ?? 0, limit: PAGE_SIZE, status: filter },
    { enabled: !!passenger?.id && isFirstPage }
  );

  // Next page query (with cursor)
  const nextPageQuery = trpc.rides.passengerHistory.useQuery(
    { passengerId: passenger?.id ?? 0, limit: PAGE_SIZE, status: filter, cursor },
    { enabled: !!passenger?.id && !isFirstPage && !!cursor }
  );

  // Handle first page data - نحدّث allRides فقط عند وصول بيانات جديدة حقيقية
  useEffect(() => {
    if (firstPageQuery.data && "rides" in firstPageQuery.data) {
      setAllRides(firstPageQuery.data.rides as RideItem[]);
      setNextCursor(firstPageQuery.data.nextCursor);
      setTotalCompleted(firstPageQuery.data.totalCompleted);
      setTotalSpent(firstPageQuery.data.totalSpent);
      isRefreshingRef.current = false;
    }
  }, [firstPageQuery.data]);

  // Handle next page data
  useEffect(() => {
    if (!isFirstPage && nextPageQuery.data && "rides" in nextPageQuery.data) {
      setAllRides((prev) => [...prev, ...(nextPageQuery.data!.rides as RideItem[])]);
      setNextCursor(nextPageQuery.data.nextCursor);
      setIsLoadingMore(false);
    }
  }, [nextPageQuery.data, isFirstPage]);

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCursor(undefined);
    setAllRides([]);
    setNextCursor(null);
    setIsFirstPage(true);
  };

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setIsFirstPage(false);
    setCursor(nextCursor);
  }, [nextCursor, isLoadingMore]);

  // إصلاح bug 1: لا نمسح allRides عند الـ refresh - نتركها حتى تصل البيانات الجديدة
  const handleRefresh = useCallback(() => {
    isRefreshingRef.current = true;
    setCursor(undefined);
    setNextCursor(null);
    setIsFirstPage(true);
    firstPageQuery.refetch();
  }, [firstPageQuery]);

  const callDriver = async (phone: string) => {
    const cleanPhone = phone.replace(/[^+\d]/g, "");
    try {
      await Linking.openURL(`tel:${cleanPhone}`);
    } catch {
      Alert.alert("رقم السائق", cleanPhone);
    }
  };

  // إصلاح bug 2: الضغط على الرحلة
  const handleRidePress = useCallback((item: RideItem) => {
    if (ACTIVE_STATUSES.includes(item.status)) {
      // رحلة نشطة → انتقل لشاشة التتبع
      router.push({
        pathname: "/ride/tracking",
        params: {
          rideId: item.id,
          passengerId: passenger?.id ?? 0,
          fare: item.fare,
          pickupLat: item.pickupLat,
          pickupLng: item.pickupLng,
          dropoffLat: item.dropoffLat,
          dropoffLng: item.dropoffLng,
          pickupAddress: item.pickupAddress,
          dropoffAddress: item.dropoffAddress,
        },
      });
    } else {
      // رحلة مكتملة أو ملغاة → اعرض التفاصيل في modal
      setSelectedRide(item);
    }
  }, [passenger?.id]);

  const renderItem = ({ item }: { item: RideItem }) => {
    const statusInfo = getStatusInfo(item.status);
    const isActive = ACTIVE_STATUSES.includes(item.status);
    return (
      <TouchableOpacity
        style={[styles.card, isActive && styles.cardActive]}
        onPress={() => handleRidePress(item)}
        activeOpacity={0.75}
      >
        {/* رأس البطاقة */}
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
            {isActive && (
              <Text style={{ color: "#FFD700", fontSize: 16 }}>›</Text>
            )}
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
            <Text style={styles.driverIcon}>👨‍✈️</Text>
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
            <Text style={styles.detailLabel}>{t.history.fare}</Text>
            <Text style={styles.fareValue}>{(item.fare ?? 0).toLocaleString("ar-IQ")} دينار</Text>
          </View>
          {item.estimatedDistance > 0 && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>{t.ride.distance}</Text>
              <Text style={styles.detailValue}>{item.estimatedDistance.toFixed(1)} كم</Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t.ride.paymentMethod}</Text>
            <Text style={styles.detailValue}>{item.paymentMethod === "cash" ? "💵 نقداً" : "👛 محفظة"}</Text>
          </View>
        </View>

        {/* زر متابعة الرحلة للرحلات النشطة */}
        {isActive && (
          <View style={styles.activeRideBanner}>
            <Text style={styles.activeRideBannerText}>اضغط لمتابعة رحلتك الحالية →</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#FFD700" />
        <Text style={styles.footerLoaderText}>جاري تحميل المزيد...</Text>
      </View>
    );
  };

  const isLoading = firstPageQuery.isLoading;
  const isRefetching = firstPageQuery.isRefetching;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* رأس الصفحة */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.history.myRides}</Text>
        {!isLoading && (
          <Text style={styles.headerSub}>{totalCompleted} {t.statusLabels.completed}</Text>
        )}
      </View>

      {/* إحصائيات سريعة */}
      {!isLoading && totalCompleted > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{allRides.length}</Text>
            <Text style={styles.statLabel}>{t.captain.totalRides}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>{t.statusLabels.completed}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalSpent.toLocaleString("ar-IQ")}</Text>
            <Text style={styles.statLabel}>{t.common.iqd}</Text>
          </View>
        </View>
      )}

      {/* فلاتر احترافية */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => handleFilterChange(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
            {f.key === "completed" && totalCompleted > 0 && (
              <View style={[styles.badge, filter === f.key && styles.badgeActive]}>
                <Text style={[styles.badgeText, filter === f.key && styles.badgeTextActive]}>
                  {totalCompleted}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* القائمة */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>{t.common.loading}</Text>
        </View>
      ) : !passenger?.id ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>{t.auth.login}</Text>
          <Text style={styles.emptyText}>{t.errors.sessionExpired}</Text>
        </View>
      ) : allRides.length === 0 && !isRefetching ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>{t.history.noRides}</Text>
          <Text style={styles.emptyText}>
            {filter === "all"
              ? "لم تقم بأي رحلة بعد. اطلب رحلتك الأولى الآن!"
              : `لا توجد رحلات ${filter === "completed" ? "مكتملة" : "ملغاة"}`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={allRides}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor="#FFD700"
              colors={["#FFD700"]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal تفاصيل الرحلة */}
      <Modal
        visible={!!selectedRide}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedRide(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedRide && (
              <>
                {/* رأس الـ modal */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>تفاصيل الرحلة</Text>
                  <TouchableOpacity onPress={() => setSelectedRide(null)} style={styles.modalCloseBtn}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* الحالة */}
                  <View style={{ alignItems: "center", marginBottom: 16 }}>
                    {(() => {
                      const si = getStatusInfo(selectedRide.status);
                      return (
                        <View style={[styles.statusBadge, { backgroundColor: si.bg, paddingHorizontal: 16, paddingVertical: 8 }]}>
                          <Text style={[styles.statusText, { color: si.color, fontSize: 15 }]}>{si.label}</Text>
                        </View>
                      );
                    })()}
                    <Text style={{ color: "#9B8EC4", fontSize: 12, marginTop: 6 }}>{formatDate(selectedRide.createdAt)}</Text>
                  </View>

                  {/* المسار */}
                  <View style={[styles.routeBox, { backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14, marginBottom: 12 }]}>
                    <Text style={{ color: "#9B8EC4", fontSize: 11, marginBottom: 6 }}>المسار</Text>
                    <View style={styles.routeRow}>
                      <View style={styles.dotGreen} />
                      <Text style={[styles.routeText, { flexShrink: 1 }]}>{selectedRide.pickupAddress || "موقع الانطلاق"}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                      <View style={styles.dotRed} />
                      <Text style={[styles.routeText, { flexShrink: 1 }]}>{selectedRide.dropoffAddress || "الوجهة"}</Text>
                    </View>
                  </View>

                  {/* معلومات السائق */}
                  {selectedRide.driver && (
                    <View style={[styles.driverRow, { marginBottom: 12 }]}>
                      <Text style={styles.driverIcon}>👨‍✈️</Text>
                      <View style={styles.driverInfo}>
                        <Text style={styles.driverName}>{selectedRide.driver.name}</Text>
                        {selectedRide.driver.phone ? (
                          <TouchableOpacity onPress={() => callDriver(selectedRide.driver!.phone)}>
                            <Text style={styles.driverPhone}>📞 {selectedRide.driver.phone}</Text>
                          </TouchableOpacity>
                        ) : null}
                        {selectedRide.driver.vehicleModel ? (
                          <Text style={styles.driverCar}>
                            {selectedRide.driver.vehicleModel} {selectedRide.driver.vehicleColor}
                            {selectedRide.driver.vehiclePlate ? ` • ${selectedRide.driver.vehiclePlate}` : ""}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.driverRating}>⭐ {selectedRide.driver.rating}</Text>
                    </View>
                  )}

                  {/* تفاصيل مالية */}
                  <View style={{ backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14, gap: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "#9B8EC4", fontSize: 13 }}>الأجرة</Text>
                      <Text style={{ color: "#FFD700", fontSize: 15, fontWeight: "bold" }}>{(selectedRide.fare ?? 0).toLocaleString("ar-IQ")} دينار</Text>
                    </View>
                    {selectedRide.estimatedDistance > 0 && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: "#9B8EC4", fontSize: 13 }}>المسافة</Text>
                        <Text style={{ color: "#ECEDEE", fontSize: 13 }}>{selectedRide.estimatedDistance.toFixed(1)} كم</Text>
                      </View>
                    )}
                    {selectedRide.estimatedDuration > 0 && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: "#9B8EC4", fontSize: 13 }}>المدة</Text>
                        <Text style={{ color: "#ECEDEE", fontSize: 13 }}>{selectedRide.estimatedDuration} دقيقة</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "#9B8EC4", fontSize: 13 }}>طريقة الدفع</Text>
                      <Text style={{ color: "#ECEDEE", fontSize: 13 }}>{selectedRide.paymentMethod === "cash" ? "💵 نقداً" : "👛 محفظة"}</Text>
                    </View>
                  </View>
                </ScrollView>

                <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setSelectedRide(null)}>
                  <Text style={styles.modalDoneBtnText}>إغلاق</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#2D1B4E",
    borderWidth: 1,
    borderColor: "#3D2070",
    gap: 6,
  },
  filterBtnActive: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  filterText: { color: "#9B8EC4", fontSize: 13, fontWeight: "500" },
  filterTextActive: { color: "#1A0533", fontWeight: "bold" },
  badge: {
    backgroundColor: "#3D2070",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  badgeActive: { backgroundColor: "#1A0533" },
  badgeText: { color: "#9B8EC4", fontSize: 11, fontWeight: "bold" },
  badgeTextActive: { color: "#FFD700" },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: {
    backgroundColor: "#2D1B4E",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  cardActive: {
    borderColor: "#FFD700",
    borderWidth: 1.5,
  },
  activeRideBanner: {
    backgroundColor: "rgba(255,215,0,0.1)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
    alignItems: "center",
  },
  activeRideBannerText: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "600",
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
    alignItems: "flex-start",
    backgroundColor: "rgba(255,215,0,0.06)",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
    gap: 8,
  },
  driverIcon: { fontSize: 20, marginTop: 2 },
  driverInfo: { flex: 1 },
  driverName: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  driverPhone: { color: "#60A5FA", fontSize: 12, marginTop: 2 },
  driverCar: { color: "#9B8EC4", fontSize: 12, marginTop: 2 },
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
  footerLoader: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  footerLoaderText: { color: "#9B8EC4", fontSize: 13 },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderColor: "#3D2070",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: { color: "#9B8EC4", fontSize: 16 },
  modalDoneBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  modalDoneBtnText: { color: "#1A0533", fontSize: 16, fontWeight: "bold" },
});

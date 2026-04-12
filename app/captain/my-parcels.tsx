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
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "بانتظار", color: "#F59E0B", bg: "#FFF8E1" },
  accepted:   { label: "مقبول",   color: "#3B82F6", bg: "#EFF6FF" },
  picked_up:  { label: "مستلم",   color: "#8B5CF6", bg: "#F5F3FF" },
  in_transit: { label: "في الطريق", color: "#6366F1", bg: "#EEF2FF" },
  inTransit:  { label: "في الطريق", color: "#6366F1", bg: "#EEF2FF" },
  delivered:  { label: "مُسلَّم ✓", color: "#22C55E", bg: "#F0FDF4" },
  cancelled:  { label: "ملغي",    color: "#EF4444", bg: "#FEF2F2" },
  returned:   { label: "مُعاد",   color: "#6B7280", bg: "#F9FAFB" },
};

const TYPE_LABELS: Record<string, string> = {
  instant:   "⚡ فوري",
  scheduled: "📅 مجدول",
  intercity: "🚚 بين المدن",
};

const SIZE_LABELS: Record<string, string> = {
  small:  "📦 صغير",
  medium: "🗃️ متوسط",
  large:  "📫 كبير",
};

type FilterStatus = "all" | "delivered" | "active" | "cancelled";

export default function CaptainMyParcelsScreen() {
  const router = useRouter();
  const { driver } = useDriver();
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const PAGE_SIZE = 20;

  const { data, isLoading, refetch, isRefetching } = trpc.parcel.getDriverAll.useQuery(
    { driverId: driver?.id ?? 0, page, limit: PAGE_SIZE },
    { enabled: !!driver?.id }
  );

  const allParcels = data?.parcels ?? [];
  const stats = data?.stats;
  const total = data?.total ?? 0;

  // Client-side filter
  const filtered = allParcels.filter((p) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "delivered") return p.status === "delivered";
    if (filterStatus === "active") return ["accepted", "picked_up", "in_transit"].includes(p.status);
    if (filterStatus === "cancelled") return p.status === "cancelled";
    return true;
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <ScreenContainer containerClassName="bg-[#1A0533]">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📦 طرودي</Text>
          <Text style={styles.headerSub}>سجل جميع الطرود التي وصّلتها</Text>
        </View>
      </View>

      {/* Stats Row */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: "#9B8EC4" }]}>
            <Text style={styles.statVal}>{stats.total}</Text>
            <Text style={styles.statLbl}>الكل</Text>
          </View>
          <View style={[styles.statCard, { borderColor: "#22C55E" }]}>
            <Text style={[styles.statVal, { color: "#22C55E" }]}>{stats.delivered}</Text>
            <Text style={styles.statLbl}>مُسلَّمة</Text>
          </View>
          <View style={[styles.statCard, { borderColor: "#6366F1" }]}>
            <Text style={[styles.statVal, { color: "#6366F1" }]}>{stats.active}</Text>
            <Text style={styles.statLbl}>نشطة</Text>
          </View>
          <View style={[styles.statCard, { borderColor: "#FFD700" }]}>
            <Text style={[styles.statVal, { color: "#FFD700" }]}>
              {stats.totalEarnings > 0 ? (stats.totalEarnings / 1000).toFixed(0) + "k" : "0"}
            </Text>
            <Text style={styles.statLbl}>الدخل د.ع</Text>
          </View>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["all", "active", "delivered", "cancelled"] as FilterStatus[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filterStatus === f && styles.filterBtnActive]}
            onPress={() => setFilterStatus(f)}
          >
            <Text style={[styles.filterTxt, filterStatus === f && styles.filterTxtActive]}>
              {f === "all" ? "الكل" : f === "active" ? "نشطة" : f === "delivered" ? "مُسلَّمة" : "ملغاة"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingTxt}>جاري التحميل...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>📭</Text>
          <Text style={styles.emptyTxt}>لا توجد طرود</Text>
          <Text style={styles.emptySubTxt}>ستظهر هنا الطرود التي تقبلها وتوصّلها</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FFD700" />
          }
          ListFooterComponent={
            total > PAGE_SIZE ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <Text style={[styles.pageBtnTxt, page === 0 && { color: "#4A3B6A" }]}>→ السابق</Text>
                </TouchableOpacity>
                <Text style={styles.pageInfo}>
                  {page + 1} / {totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
                  onPress={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <Text style={[styles.pageBtnTxt, page >= totalPages - 1 && { color: "#4A3B6A" }]}>التالي ←</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const st = STATUS_LABELS[item.status] ?? { label: item.status, color: "#9B8EC4", bg: "#1E1035" };
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  if (["accepted", "picked_up", "in_transit"].includes(item.status)) {
                    router.push({ pathname: "/captain/active-parcel", params: { parcelId: item.id.toString() } } as any);
                  }
                }}
                activeOpacity={0.85}
              >
                {/* Row 1: tracking + status */}
                <View style={styles.cardRow}>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <Text style={styles.trackingNum}>{item.trackingNumber}</Text>
                </View>

                {/* Row 2: type + size */}
                <View style={[styles.cardRow, { marginTop: 6 }]}>
                  <Text style={styles.metaTxt}>{SIZE_LABELS[item.parcelSize] ?? item.parcelSize}</Text>
                  <Text style={styles.metaTxt}>{TYPE_LABELS[item.deliveryType] ?? item.deliveryType}</Text>
                </View>

                {/* Addresses */}
                <View style={styles.addrBlock}>
                  <View style={styles.addrRow}>
                    <View style={[styles.dot, { backgroundColor: "#22C55E" }]} />
                    <Text style={styles.addrTxt} numberOfLines={1}>{item.pickupAddress}</Text>
                  </View>
                  <View style={styles.addrRow}>
                    <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                    <Text style={styles.addrTxt} numberOfLines={1}>{item.dropoffAddress}</Text>
                  </View>
                </View>

                {/* Row 3: recipient + price + date */}
                <View style={[styles.cardRow, { marginTop: 6 }]}>
                  <Text style={styles.dateTxt}>
                    {new Date(item.createdAt).toLocaleDateString("ar-IQ", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </Text>
                  {item.price ? (
                    <Text style={styles.priceTxt}>{Number(item.price).toLocaleString()} د.ع</Text>
                  ) : null}
                </View>

                {/* Active indicator */}
                {["accepted", "picked_up", "in_transit"].includes(item.status) && (
                  <View style={styles.activeBanner}>
                    <Text style={styles.activeBannerTxt}>▶ اضغط لمتابعة هذا الطرد</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1A0533",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", textAlign: "right" },
  headerSub: { color: "#9B8EC4", fontSize: 12, textAlign: "right", marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#1A0533",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  statVal: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  statLbl: { color: "#9B8EC4", fontSize: 10, marginTop: 2 },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
    backgroundColor: "#1A0533",
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3D2580",
  },
  filterBtnActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  filterTxt: { color: "#9B8EC4", fontSize: 11, fontWeight: "600" },
  filterTxtActive: { color: "#1A0533", fontWeight: "800" },
  listContent: { padding: 12, gap: 10, paddingBottom: 32 },
  card: {
    backgroundColor: "#2D1B4E",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3D2580",
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusTxt: { fontSize: 12, fontWeight: "700" },
  trackingNum: { color: "#C4B5D4", fontSize: 12, fontWeight: "600" },
  metaTxt: { color: "#9B8EC4", fontSize: 12 },
  addrBlock: { marginTop: 8, gap: 4 },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  addrTxt: { flex: 1, color: "#C4B5D4", fontSize: 12, textAlign: "right" },
  dateTxt: { color: "#6B5A8A", fontSize: 11 },
  priceTxt: { color: "#FFD700", fontSize: 13, fontWeight: "700" },
  activeBanner: {
    marginTop: 10,
    backgroundColor: "#6366F122",
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#6366F1",
  },
  activeBannerTxt: { color: "#6366F1", fontSize: 12, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingTxt: { color: "#9B8EC4", fontSize: 14 },
  emptyTxt: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  emptySubTxt: { color: "#9B8EC4", fontSize: 13, textAlign: "center" },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  pageBtn: {
    backgroundColor: "#2D1B69",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pageBtnDisabled: { backgroundColor: "#1E0F4A" },
  pageBtnTxt: { color: "#FFD700", fontWeight: "700" },
  pageInfo: { color: "#9B8EC4", fontSize: 13 },
});

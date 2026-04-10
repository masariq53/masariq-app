import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator,
  StyleSheet, RefreshControl, TextInput, ScrollView, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

type TripStatus = "all" | "scheduled" | "in_progress" | "completed" | "cancelled";
type SortOption = "newest" | "oldest" | "highest_price" | "most_seats";

const STATUS_LABELS: Record<string, string> = {
  all: "الكل",
  scheduled: "مجدولة",
  in_progress: "جارية",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#FFD700",
  in_progress: "#22C55E",
  completed: "#60A5FA",
  cancelled: "#F87171",
};

const STATUS_ICONS: Record<string, string> = {
  scheduled: "🕐",
  in_progress: "🚗",
  completed: "✅",
  cancelled: "❌",
};

function formatDate(val: string | Date | null | undefined) {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar-IQ", { weekday: "short", month: "short", day: "numeric" }) +
    "  " + d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
}

export default function CaptainIntercityHistoryScreen() {
  const router = useRouter();
  const { driver } = useDriver();
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TripStatus>("all");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showSortModal, setShowSortModal] = useState(false);

  const tripsQuery = trpc.intercity.myTrips.useQuery(
    { driverId: driver?.id ?? 0 },
    { enabled: !!driver?.id, refetchInterval: 30000 }
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await tripsQuery.refetch();
    setRefreshing(false);
  }, []);

  const filteredTrips = useMemo(() => {
    let trips = (tripsQuery.data as any[]) ?? [];

    // Filter by status
    if (statusFilter !== "all") {
      trips = trips.filter((t) => t.status === statusFilter);
    }

    // Filter by search (city name)
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      trips = trips.filter(
        (t) =>
          t.fromCity?.toLowerCase().includes(q) ||
          t.toCity?.toLowerCase().includes(q) ||
          t.meetingPoint?.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case "oldest":
        trips = [...trips].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "highest_price":
        trips = [...trips].sort((a, b) => parseFloat(b.pricePerSeat) - parseFloat(a.pricePerSeat));
        break;
      case "most_seats":
        trips = [...trips].sort((a, b) => (b.totalSeats - b.availableSeats) - (a.totalSeats - a.availableSeats));
        break;
      default: // newest
        trips = [...trips].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return trips;
  }, [tripsQuery.data, statusFilter, searchText, sortBy]);

  // Summary stats
  const stats = useMemo(() => {
    const all = (tripsQuery.data as any[]) ?? [];
    const completed = all.filter((t) => t.status === "completed");
    const totalEarnings = completed.reduce((sum, t) => {
      const bookedSeats = t.totalSeats - t.availableSeats;
      return sum + bookedSeats * parseFloat(t.pricePerSeat || "0");
    }, 0);
    return {
      total: all.length,
      completed: completed.length,
      scheduled: all.filter((t) => t.status === "scheduled").length,
      cancelled: all.filter((t) => t.status === "cancelled").length,
      totalEarnings,
    };
  }, [tripsQuery.data]);

  const SORT_OPTIONS: { key: SortOption; label: string }[] = [
    { key: "newest", label: "الأحدث أولاً" },
    { key: "oldest", label: "الأقدم أولاً" },
    { key: "highest_price", label: "أعلى سعر" },
    { key: "most_seats", label: "أكثر مقاعد محجوزة" },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل رحلاتي بين المدن</Text>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortModal(true)}>
          <Text style={styles.sortBtnText}>⇅ ترتيب</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>إجمالي</Text>
        </View>
        <View style={[styles.statCard, { borderColor: "#60A5FA" }]}>
          <Text style={[styles.statValue, { color: "#60A5FA" }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>مكتملة</Text>
        </View>
        <View style={[styles.statCard, { borderColor: "#FFD700" }]}>
          <Text style={[styles.statValue, { color: "#FFD700" }]}>{stats.scheduled}</Text>
          <Text style={styles.statLabel}>مجدولة</Text>
        </View>
        <View style={[styles.statCard, { borderColor: "#F87171" }]}>
          <Text style={[styles.statValue, { color: "#F87171" }]}>{stats.cancelled}</Text>
          <Text style={styles.statLabel}>ملغاة</Text>
        </View>
        <View style={[styles.statCard, { borderColor: "#22C55E", minWidth: 120 }]}>
          <Text style={[styles.statValue, { color: "#22C55E", fontSize: 14 }]}>{stats.totalEarnings.toLocaleString()}</Text>
          <Text style={styles.statLabel}>إجمالي الدخل (د.ع)</Text>
        </View>
      </ScrollView>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 ابحث بالمدينة أو نقطة التجمع..."
          placeholderTextColor="#6B7280"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText("")} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {(["all", "scheduled", "in_progress", "completed", "cancelled"] as TripStatus[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.filterTab, statusFilter === s && styles.filterTabActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.filterTabText, statusFilter === s && styles.filterTabTextActive]}>
              {s !== "all" ? STATUS_ICONS[s] + " " : ""}{STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Count */}
      <Text style={styles.resultsCount}>
        {filteredTrips.length} رحلة
        {statusFilter !== "all" ? ` — ${STATUS_LABELS[statusFilter]}` : ""}
      </Text>

      {/* Trips List */}
      {tripsQuery.isLoading ? (
        <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
      ) : filteredTrips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>لا توجد نتائج</Text>
          <Text style={styles.emptyDesc}>جرّب تغيير الفلتر أو البحث</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          keyExtractor={(item: any) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
          renderItem={({ item }: { item: any }) => {
            const status = item.status as string;
            const bookedSeats = item.totalSeats - item.availableSeats;
            const tripEarnings = status === "completed" ? bookedSeats * parseFloat(item.pricePerSeat || "0") : 0;
            return (
              <View style={styles.tripCard}>
                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[status] || "#9B8EC4") + "22", borderColor: STATUS_COLORS[status] || "#9B8EC4" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[status] || "#9B8EC4" }]}>
                    {STATUS_ICONS[status] || "🔘"} {STATUS_LABELS[status] || status}
                  </Text>
                </View>

                {/* Route */}
                <Text style={styles.route}>{item.fromCity}  →  {item.toCity}</Text>

                {/* Details */}
                <Text style={styles.detail}>🕐 {formatDate(item.departureTime)}</Text>
                <View style={styles.seatsRow}>
                  <Text style={styles.detail}>💺 {bookedSeats}/{item.totalSeats} مقعد محجوز</Text>
                  {/* Seat fill bar */}
                  <View style={styles.seatBar}>
                    <View style={[styles.seatFill, { width: `${item.totalSeats > 0 ? (bookedSeats / item.totalSeats) * 100 : 0}%` as any }]} />
                  </View>
                </View>
                <Text style={styles.detail}>💰 {parseInt(item.pricePerSeat).toLocaleString()} د.ع/مقعد</Text>
                {item.meetingPoint ? <Text style={styles.detail}>📌 {item.meetingPoint}</Text> : null}

                {/* Earnings for completed trips */}
                {status === "completed" && tripEarnings > 0 ? (
                  <View style={styles.earningsBox}>
                    <Text style={styles.earningsLabel}>💵 دخل هذه الرحلة:</Text>
                    <Text style={styles.earningsValue}>{tripEarnings.toLocaleString()} دينار</Text>
                  </View>
                ) : null}

                {/* Cancel reason */}
                {status === "cancelled" && item.cancelReason ? (
                  <View style={styles.cancelReasonBox}>
                    <Text style={styles.cancelReasonLabel}>سبب الإلغاء:</Text>
                    <Text style={styles.cancelReasonText}>{item.cancelReason}</Text>
                  </View>
                ) : null}

                {/* View Passengers Button */}
                {bookedSeats > 0 ? (
                  <TouchableOpacity
                    style={styles.passengersBtn}
                    onPress={() => router.push({
                      pathname: "/captain/intercity-passengers",
                      params: { tripId: item.id.toString(), tripRoute: `${item.fromCity} → ${item.toCity}` }
                    })}
                  >
                    <Text style={styles.passengersBtnText}>👥 عرض المسافرين ({bookedSeats})</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* Sort Modal */}
      <Modal visible={showSortModal} transparent animationType="slide" onRequestClose={() => setShowSortModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.sortModal}>
            <Text style={styles.sortModalTitle}>ترتيب الرحلات</Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortOption, sortBy === opt.key && styles.sortOptionActive]}
                onPress={() => { setSortBy(opt.key); setShowSortModal(false); }}
              >
                <Text style={[styles.sortOptionText, sortBy === opt.key && styles.sortOptionTextActive]}>
                  {sortBy === opt.key ? "✓ " : "   "}{opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.sortModalClose} onPress={() => setShowSortModal(false)}>
              <Text style={styles.sortModalCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#1A0533", borderBottomWidth: 1, borderBottomColor: "#2D1B4E",
  },
  backBtn: { padding: 8 },
  backIcon: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  headerTitle: { color: "#FFD700", fontSize: 17, fontWeight: "bold" },
  sortBtn: { backgroundColor: "#2D1B4E", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  sortBtnText: { color: "#C4B5E0", fontSize: 13, fontWeight: "600" },
  statsScroll: { flexShrink: 0, paddingVertical: 12 },
  statCard: {
    backgroundColor: "#1E0A3C", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
    alignItems: "center", borderWidth: 1.5, borderColor: "#9B8EC4", minWidth: 88,
    justifyContent: "center",
  },
  statValue: { color: "#9B8EC4", fontSize: 20, fontWeight: "800", lineHeight: 26 },
  statLabel: { color: "#6B5A8E", fontSize: 10, marginTop: 4, textAlign: "center" },
  searchContainer: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginTop: 10, marginBottom: 6,
    backgroundColor: "#1E0A3C", borderRadius: 12, borderWidth: 1, borderColor: "#2D1B4E",
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 14, paddingVertical: 10, textAlign: "right" },
  clearBtn: { padding: 6 },
  clearBtnText: { color: "#9B8EC4", fontSize: 16 },
  filterScroll: { maxHeight: 50, marginBottom: 4 },
  filterTab: {
    backgroundColor: "#1E0A3C", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  filterTabActive: { backgroundColor: "#FFD70022", borderColor: "#FFD700" },
  filterTabText: { color: "#9B8EC4", fontSize: 13, fontWeight: "600" },
  filterTabTextActive: { color: "#FFD700", fontWeight: "800" },
  resultsCount: { color: "#6B5A8E", fontSize: 12, paddingHorizontal: 16, marginBottom: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyTitle: { color: "#FFD700", fontSize: 18, fontWeight: "bold", marginBottom: 6 },
  emptyDesc: { color: "#9B8EC4", fontSize: 14, textAlign: "center" },
  tripCard: {
    backgroundColor: "#1E0A3C", borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  statusText: { fontSize: 12, fontWeight: "700" },
  route: { color: "#E0D0FF", fontSize: 17, fontWeight: "bold", marginBottom: 8, textAlign: "right" },
  detail: { color: "#C0A8E8", fontSize: 13, marginBottom: 4 },
  seatsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  seatBar: { flex: 1, height: 4, backgroundColor: "#2D1B4E", borderRadius: 2, overflow: "hidden" },
  seatFill: { height: "100%", backgroundColor: "#22C55E", borderRadius: 2 },
  earningsBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0D2B1A", borderRadius: 10, padding: 10, marginTop: 8,
    borderWidth: 1, borderColor: "#22C55E",
  },
  earningsLabel: { color: "#9B8EC4", fontSize: 13 },
  earningsValue: { color: "#22C55E", fontSize: 15, fontWeight: "800" },
  cancelReasonBox: { backgroundColor: "#2D1B1B", borderRadius: 10, padding: 10, marginTop: 8 },
  cancelReasonLabel: { color: "#F87171", fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  cancelReasonText: { color: "#C0A8E8", fontSize: 13 },
  passengersBtn: {
    backgroundColor: "#2D1B4E", borderRadius: 10, paddingVertical: 10, alignItems: "center",
    marginTop: 10, borderWidth: 1, borderColor: "#4B3B8C",
  },
  passengersBtnText: { color: "#C4B5E0", fontSize: 13, fontWeight: "700" },
  // Sort Modal
  modalOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  sortModal: {
    backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  sortModalTitle: { color: "#FFD700", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 16 },
  sortOption: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
    marginBottom: 8, backgroundColor: "#2D1B4E",
  },
  sortOptionActive: { backgroundColor: "#FFD70022", borderWidth: 1, borderColor: "#FFD700" },
  sortOptionText: { color: "#C4B5E0", fontSize: 15, textAlign: "right" },
  sortOptionTextActive: { color: "#FFD700", fontWeight: "800" },
  sortModalClose: {
    backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 8,
  },
  sortModalCloseText: { color: "#9B8EC4", fontSize: 14, fontWeight: "700" },
});

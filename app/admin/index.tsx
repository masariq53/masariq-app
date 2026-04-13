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
  const [activeTab, setActiveTab] = useState<"overview" | "rides" | "drivers" | "passengers" | "pricing" | "intercity" | "support" | "agents" | "parcels">("overview");
  // Parcel filters
  const [parcelSearch, setParcelSearch] = useState("");
  const [parcelStatusFilter, setParcelStatusFilter] = useState<"all" | "pending" | "accepted" | "picked_up" | "in_transit" | "delivered" | "cancelled" | "returned">("all");
  const [parcelTypeFilter, setParcelTypeFilter] = useState<"all" | "instant" | "intercity">("all");
  const [parcelPage, setParcelPage] = useState(0);
  const PARCEL_PAGE_SIZE = 10;
  const [selectedParcelId, setSelectedParcelId] = useState<number | null>(null);
  const [showParcelModal, setShowParcelModal] = useState(false);

  const [driversPage, setDriversPage] = useState(0);
  const [passengersPage, setPassengersPage] = useState(0);
  const [ridesPage, setRidesPage] = useState(0);
  const [ridesStatusFilter, setRidesStatusFilter] = useState<"all" | "searching" | "accepted" | "driver_arrived" | "in_progress" | "completed" | "cancelled">("all");
  const [ridesSearch, setRidesSearch] = useState("");
  const [showRidesFilters, setShowRidesFilters] = useState(false);
  const [selectedRide, setSelectedRide] = useState<any | null>(null);
  const [showRideModal, setShowRideModal] = useState(false);
  const PAGE_SIZE = 10;

  // ─── Driver Filters ───────────────────────────────────────────────────────────
  const [driverSearch, setDriverSearch] = useState("");
  const [driverStatusFilter, setDriverStatusFilter] = useState<"all" | "active" | "blocked" | "pending" | "verified">("all");
  const [driverSortBy, setDriverSortBy] = useState<"name" | "rating" | "rides" | "newest">("newest");
  const [driverRatingFilter, setDriverRatingFilter] = useState<"all" | "4+" | "3+" | "below3">("all");
  const [showDriverFilters, setShowDriverFilters] = useState(false);

  // ─── Passenger Filters ────────────────────────────────────────────
  const [passengerSearch, setPassengerSearch] = useState("");
  const [passengerStatusFilter, setPassengerStatusFilter] = useState<"all" | "active" | "blocked">("all");
  const [passengerSortBy, setPassengerSortBy] = useState<"name" | "rating" | "rides" | "newest">("newest");
  const [passengerRidesFilter, setPassengerRidesFilter] = useState<"all" | "0" | "1-5" | "6-20" | "20+">("all");
  const [showPassengerFilters, setShowPassengerFilters] = useState(false);
  const [passengerCityFilter, setPassengerCityFilter] = useState("");
  // ─── Passenger Block/Unblock ──────────────────────────────────────────
  const [showPassengerBlockModal, setShowPassengerBlockModal] = useState(false);
  const [showPassengerUnblockModal, setShowPassengerUnblockModal] = useState(false);
  const [blockTargetPassenger, setBlockTargetPassenger] = useState<{ id: number; name: string } | null>(null);
  const [unblockTargetPassenger, setUnblockTargetPassenger] = useState<{ id: number; name: string } | null>(null);
  const [passengerBlockReasonInput, setPassengerBlockReasonInput] = useState("");

  // ─── Profile Photo Preview ────────────────────────────────────────────
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewPhotoName, setPreviewPhotoName] = useState<string>("");

  const [historyDriverId, setHistoryDriverId] = useState<number | null>(null);
  const [historyDriverName, setHistoryDriverName] = useState<string>('');
  const [historyDriverPhone, setHistoryDriverPhone] = useState<string>('');
  const [historyDriverModel, setHistoryDriverModel] = useState<string>('');
  const [historyTabState, setHistoryTabState] = useState<'city' | 'intercity' | 'parcels'>('city');

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.stats.useQuery();
  const { data: recentRides, isLoading: ridesLoading, refetch: refetchRides } = trpc.admin.recentRides.useQuery({ limit: 8 });
  const { data: allDrivers, isLoading: driversLoading, refetch: refetchDrivers } = trpc.admin.drivers.useQuery({ limit: 500 });
  const { data: driverCityRides, isLoading: cityRidesLoading } = trpc.admin.driverCityRides.useQuery(
    { driverId: historyDriverId ?? 0 },
    { enabled: !!historyDriverId && historyTabState === 'city' }
  );
  const { data: driverIntercityTrips, isLoading: intercityTripsLoading } = trpc.admin.driverIntercityTrips.useQuery(
    { driverId: historyDriverId ?? 0 },
    { enabled: !!historyDriverId && historyTabState === 'intercity' }
  );
  const { data: driverParcelHistory, isLoading: parcelHistoryLoading } = trpc.admin.driverParcelHistory.useQuery(
    { driverId: historyDriverId ?? 0 },
    { enabled: !!historyDriverId && historyTabState === 'parcels' }
  );
  const { data: allPassengers, isLoading: passengersLoading, refetch: refetchPassengers } = trpc.admin.passengers.useQuery({ limit: 500 });
  const { data: allRides, isLoading: allRidesLoading, refetch: refetchAllRides } = trpc.admin.rides.useQuery({ limit: 50 });
  const { data: ridesDetailedData, isLoading: ridesDetailedLoading, refetch: refetchRidesDetailed } = trpc.admin.ridesDetailed.useQuery(
    { page: ridesPage, pageSize: PAGE_SIZE, statusFilter: ridesStatusFilter === "all" ? undefined : ridesStatusFilter },
    { enabled: activeTab === "rides" }
  );
  const { data: pendingDrivers, isLoading: pendingLoading, refetch: refetchPending } = trpc.admin.pendingDrivers.useQuery();

  const verifyDriver = trpc.admin.verifyDriver.useMutation({
    onSuccess: () => refetchDrivers(),
  });
  const blockDriver = trpc.admin.blockDriver.useMutation({
    onSuccess: async () => {
      await refetchDrivers();
      await refetchStats();
    },
    onError: (err) => Alert.alert("خطأ", err.message || "حدث خطأ أثناء تحديث الحساب"),
  });
  const blockPassenger = trpc.admin.blockPassenger.useMutation({
    onSuccess: async () => {
      await refetchPassengers();
      setShowPassengerBlockModal(false);
      setShowPassengerUnblockModal(false);
      setPassengerBlockReasonInput("");
    },
    onError: (err) => Alert.alert("خطأ", err.message || "حدث خطأ أثناء تحديث حساب المستخدم"),
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
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockTargetDriver, setBlockTargetDriver] = useState<{ id: number; name: string } | null>(null);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const [unblockTargetDriver, setUnblockTargetDriver] = useState<{ id: number; name: string } | null>(null);

  // ──  // ─── Intercity Trips ─────────────────────────────────────────────
  const [intercityStatusFilter, setIntercityStatusFilter] = useState<"all" | "scheduled" | "in_progress" | "completed" | "cancelled">("all");
  const [intercityCityFilter, setIntercityCityFilter] = useState("");
  const [intercityDriverFilter, setIntercityDriverFilter] = useState("");
  const [intercitySortBy, setIntercitySortBy] = useState<"newest" | "date" | "seats" | "price">("newest");
  const [intercityShowFilters, setIntercityShowFilters] = useState(false);
  const [selectedPassengersTripId, setSelectedPassengersTripId] = useState<number | null>(null);
  const [showPassengersModal, setShowPassengersModal] = useState(false);
  // شات: المحادثة المختارة
  const [chatBookingId, setChatBookingId] = useState<number | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatPassengerName, setChatPassengerName] = useState("");
  const [chatDriverName, setChatDriverName] = useState("");
  const [passengersModalTab, setPassengersModalTab] = useState<"passengers" | "chat">("passengers");
  const { data: allIntercityTrips, isLoading: intercityLoading, refetch: refetchIntercity } = trpc.admin.intercityTrips.useQuery({ limit: 200 });
  const { data: tripPassengersData, isLoading: passengersModalLoading } = trpc.admin.intercityTripPassengers.useQuery(
    { tripId: selectedPassengersTripId! },
    { enabled: !!selectedPassengersTripId && showPassengersModal }
  );
  const { data: chatMessages, isLoading: chatMessagesLoading } = trpc.intercity.getMessages.useQuery(
    { bookingId: chatBookingId! },
    { enabled: !!chatBookingId && showChatModal, refetchInterval: 5000 }
  );
  const cancelIntercityTripMutation = trpc.admin.cancelIntercityTrip.useMutation({
    onSuccess: () => refetchIntercity(),
  });

  // ─── Support State ───────────────────────────────────────────────────────────
  const [agentStatusFilter, setAgentStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "suspended">("all");
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [agentTopupAmount, setAgentTopupAmount] = useState("");
  const [agentTopupLoading, setAgentTopupLoading] = useState(false);
  const [showAgentRejectModal, setShowAgentRejectModal] = useState(false);
  const [agentRejectReason, setAgentRejectReason] = useState("");
  const [agentModalTab, setAgentModalTab] = useState<'details' | 'ledger'>('details');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'admin_topup' | 'recharge'>('all');
  const [agentSearch, setAgentSearch] = useState("");
  const [agentPage, setAgentPage] = useState(0);
  const AGENT_PAGE_SIZE = 10;
  // ─── Confirm Dialog (web-compatible replacement for Alert.alert) ───
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText: string;
    confirmColor: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'تأكيد',
    confirmColor: '#22C55E',
    onConfirm: () => {},
  });
  const showConfirm = (opts: { title: string; message: string; confirmText: string; confirmColor: string; onConfirm: () => void }) => {
    setConfirmDialog({ visible: true, ...opts });
  };
  const hideConfirm = () => setConfirmDialog(prev => ({ ...prev, visible: false }));
  const [supportStatusFilter, setSupportStatusFilter] = useState<"all" | "open" | "in_progress" | "resolved" | "closed">("all");
  const [supportUserTypeFilter, setSupportUserTypeFilter] = useState<"all" | "passenger" | "driver">("all");
  const [selectedSupportTicketId, setSelectedSupportTicketId] = useState<number | null>(null);
  const [showSupportChatModal, setShowSupportChatModal] = useState(false);
  const [adminReplyText, setAdminReplyText] = useState("");
  const [selectedTicketSubject, setSelectedTicketSubject] = useState("");

  const { data: supportTickets, isLoading: supportLoading, refetch: refetchSupport } = trpc.support.adminGetTickets.useQuery(
    { status: supportStatusFilter, userType: supportUserTypeFilter, limit: 100, offset: 0 },
    { enabled: activeTab === "support", refetchInterval: 15000 }
  );
  const { data: supportUnreadData } = trpc.support.adminUnreadCount.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  const { data: supportMessages, isLoading: supportMsgsLoading, refetch: refetchSupportMsgs } = trpc.support.getMessages.useQuery(
    { ticketId: selectedSupportTicketId! },
    { enabled: !!selectedSupportTicketId && showSupportChatModal, refetchInterval: 5000 }
  );
  const sendSupportReplyMutation = trpc.support.sendMessage.useMutation({
    onSuccess: () => { refetchSupportMsgs(); refetchSupport(); },
  });
  const updateSupportStatusMutation = trpc.support.updateStatus.useMutation({
    onSuccess: () => refetchSupport(),
  });
  const markSupportReadMutation = trpc.support.markRead.useMutation();
  const { data: allAgents, isLoading: agentsLoading, refetch: refetchAgents } = trpc.agents.getAll.useQuery(
    { status: agentStatusFilter },
    { enabled: activeTab === "agents" }
  );
  const approveAgentMutation = trpc.agents.approve.useMutation({ onSuccess: () => refetchAgents() });
  const rejectAgentMutation = trpc.agents.reject.useMutation({ onSuccess: () => refetchAgents() });
  const suspendAgentMutation = trpc.agents.suspend.useMutation({ onSuccess: () => refetchAgents() });
  const topupAgentMutation = trpc.agents.topup.useMutation({ onSuccess: () => { refetchAgents(); refetchAgentLedger(); } });
  const deleteAgentMutation = trpc.agents.delete.useMutation({ onSuccess: () => { refetchAgents(); setShowAgentModal(false); } });

  const { data: agentLedger, isLoading: ledgerLoading, refetch: refetchAgentLedger } = trpc.agents.getFullLedger.useQuery(
    { agentId: selectedAgent?.id ?? 0 },
    { enabled: !!selectedAgent?.id && showAgentModal && agentModalTab === 'ledger' }
  );

  const { data: ratingStats } = trpc.support.adminRatingStats.useQuery(
    undefined,
    { enabled: activeTab === "support" }
  );
  // Parcel admin queries
  const { data: adminParcelsData, isLoading: parcelsLoading, refetch: refetchParcels } = trpc.parcel.admin.getAll.useQuery(
    {
      deliveryType: parcelTypeFilter === "all" ? undefined : parcelTypeFilter,
      status: parcelStatusFilter === "all" ? undefined : parcelStatusFilter,
      search: parcelSearch || undefined,
      page: parcelPage + 1,
      limit: PARCEL_PAGE_SIZE,
    },
    { enabled: activeTab === "parcels" }
  );
  const { data: parcelStats, refetch: refetchParcelStats } = trpc.parcel.admin.getStats.useQuery(
    undefined,
    { enabled: activeTab === "parcels" || activeTab === "overview" }
  );
  const adminUpdateParcelStatus = trpc.parcel.updateStatus.useMutation({ onSuccess: () => { refetchParcels(); } });
  const { data: selectedParcelData, isLoading: parcelDetailLoading } = trpc.parcel.getById.useQuery(
    { parcelId: selectedParcelId! },
    { enabled: !!selectedParcelId && showParcelModal }
  );

  const supportUnreadCount = supportUnreadData?.count ?? 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchRides(), refetchDrivers(), refetchPassengers(), refetchAllRides(), refetchPending(), refetchIntercity(), refetchSupport(), refetchRidesDetailed()]);
    setRefreshing(false);
  };

  const isLoading = statsLoading && ridesLoading && driversLoading;

  const pendingCount = pendingDrivers?.length ?? 0;

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: "📊" },
    { id: "rides", label: "داخل المدن", icon: "🚗" },
    { id: "drivers", label: "السائقون", icon: "👨‍✈️" },
    { id: "passengers", label: "المستخدمون", icon: "👥" },
    { id: "pricing", label: "التسعير", icon: "💰" },
    { id: "intercity", label: "بين المدن", icon: "🗣️" },
    { id: "support", label: "الدعم الفني", icon: "🎟️" },
    { id: "agents", label: "الوكلاء", icon: "💼" },
    { id: "parcels", label: "الطرود", icon: "📦" },
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
            <View style={{ position: "relative" }}>
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              {tab.id === "support" && supportUnreadCount > 0 && (
                <View style={{ position: "absolute", top: -4, right: -4, backgroundColor: "#EF4444", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>{supportUnreadCount > 99 ? "99+" : supportUnreadCount}</Text>
                </View>
              )}
            </View>
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

                {/* Intercity Stats */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>رحلات بين المدن</Text>
                  <View style={styles.statsGrid}>
                    <StatCard
                      icon="🚨"
                      label="إجمالي الرحلات"
                      value={allIntercityTrips?.length ?? 0}
                      color="#8B5CF6"
                      onPress={() => setActiveTab("intercity")}
                    />
                    <StatCard
                      icon="✅"
                      label="مكتملة"
                      value={allIntercityTrips?.filter((t: any) => t.status === "completed").length ?? 0}
                      color="#22C55E"
                      onPress={() => setActiveTab("intercity")}
                    />
                    <StatCard
                      icon="📅"
                      label="مجدولة"
                      value={allIntercityTrips?.filter((t: any) => t.status === "scheduled").length ?? 0}
                      color="#FFD700"
                      onPress={() => setActiveTab("intercity")}
                    />
                    <StatCard
                      icon="👥"
                      label="إجمالي الحجوز"
                      value={allIntercityTrips?.reduce((acc: number, t: any) => acc + (t.totalPassengers ?? 0), 0) ?? 0}
                      color="#3B82F6"
                      onPress={() => setActiveTab("intercity")}
                    />
                  </View>
                  {/* Intercity Revenue */}
                  <View style={[styles.totalRow, { marginTop: 10 }]}>
                    <View style={[styles.totalCard, { flex: 1 }]}>
                      <Text style={styles.totalValue}>
                        {(allIntercityTrips?.filter((t: any) => t.status === "completed")
                          .reduce((acc: number, t: any) => acc + (t.totalPassengers ?? 0) * parseFloat(t.pricePerSeat ?? "0"), 0) ?? 0
                        ).toLocaleString()}
                      </Text>
                      <Text style={styles.totalLabel}>إجمالي إيرادات بين المدن (د.ع)</Text>
                    </View>
                    <View style={[styles.totalCard, { flex: 1 }]}>
                      <Text style={styles.totalValue}>
                        {allIntercityTrips?.filter((t: any) => t.status === "in_progress").length ?? 0}
                      </Text>
                      <Text style={styles.totalLabel}>رحلات جارية الآن</Text>
                    </View>
                  </View>
                </View>

                {/* Parcel Stats in Overview */}
                {parcelStats && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>📦 إحصائيات الطرود</Text>
                      <TouchableOpacity onPress={() => setActiveTab("parcels")}>
                        <Text style={styles.seeAll}>عرض الكل ←</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.statsGrid}>
                      <StatCard icon="📦" label="إجمالي الطرود" value={parcelStats.total ?? 0} color="#9B8EC4" onPress={() => setActiveTab("parcels")} />
                      <StatCard icon="⏳" label="بانتظار" value={parcelStats.pending ?? 0} color="#F59E0B" onPress={() => setActiveTab("parcels")} />
                      <StatCard icon="✅" label="مسلّمة" value={parcelStats.delivered ?? 0} color="#22C55E" onPress={() => setActiveTab("parcels")} />
                      <StatCard icon="📅" label="اليوم" value={parcelStats.todayTotal ?? 0} color="#FFD700" onPress={() => setActiveTab("parcels")} />
                    </View>
                  </View>
                )}
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

            {/* ── Rides Tab (داخل المدن) ── */}
            {activeTab === "rides" && (() => {
              const rides = ridesDetailedData?.rides ?? [];
              const totalRides = ridesDetailedData?.total ?? 0;
              const totalPages = Math.max(1, Math.ceil(totalRides / PAGE_SIZE));

              // Client-side search filter
              const filteredRides = ridesSearch.trim()
                ? rides.filter((r: any) => {
                    const q = ridesSearch.trim().toLowerCase();
                    return (
                      (r.passengerName || "").toLowerCase().includes(q) ||
                      (r.passengerPhone || "").toLowerCase().includes(q) ||
                      (r.driverName || "").toLowerCase().includes(q) ||
                      (r.driverPhone || "").toLowerCase().includes(q) ||
                      (r.pickupAddress || "").toLowerCase().includes(q) ||
                      (r.dropoffAddress || "").toLowerCase().includes(q) ||
                      String(r.id).includes(q)
                    );
                  })
                : rides;

              return (
                <View style={styles.section}>
                  {/* Header */}
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>🚗 رحلات داخل المدن</Text>
                    <Text style={{ color: "#9B8EC4", fontSize: 12 }}>{totalRides} رحلة إجمالاً</Text>
                  </View>

                  {/* Search Bar */}
                  <View style={styles.filterSearchRow}>
                    <View style={styles.filterSearchBox}>
                      <Text style={styles.filterSearchIcon}>🔍</Text>
                      <TextInput
                        style={styles.filterSearchInput}
                        placeholder="بحث بالاسم أو الهاتف أو العنوان..."
                        placeholderTextColor="#6B7280"
                        value={ridesSearch}
                        onChangeText={v => setRidesSearch(v)}
                        returnKeyType="search"
                      />
                      {ridesSearch.length > 0 && (
                        <TouchableOpacity onPress={() => setRidesSearch("")}>
                          <Text style={{ color: "#9B8EC4", fontSize: 16, paddingHorizontal: 6 }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.filterToggleBtn, showRidesFilters && styles.filterToggleBtnActive]}
                      onPress={() => setShowRidesFilters(v => !v)}
                    >
                      <Text style={{ fontSize: 16 }}>⚙️</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Status Filter Panel */}
                  {showRidesFilters && (
                    <View style={styles.filterPanel}>
                      <Text style={styles.filterLabel}>تصفية حسب الحالة</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {([
                            { key: "all", label: "الكل" },
                            { key: "searching", label: "🔍 يبحث" },
                            { key: "accepted", label: "✅ مقبولة" },
                            { key: "driver_arrived", label: "📍 السائق وصل" },
                            { key: "in_progress", label: "🚗 جارية" },
                            { key: "completed", label: "✔️ مكتملة" },
                            { key: "cancelled", label: "❌ ملغاة" },
                          ] as const).map(opt => (
                            <TouchableOpacity
                              key={opt.key}
                              style={[styles.filterChip, ridesStatusFilter === opt.key && styles.filterChipActive]}
                              onPress={() => { setRidesStatusFilter(opt.key); setRidesPage(0); }}
                            >
                              <Text style={[styles.filterChipText, ridesStatusFilter === opt.key && styles.filterChipTextActive]}>{opt.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Page Info */}
                  <Text style={[styles.pageInfo, { marginBottom: 10, textAlign: "center" }]}>
                    صفحة {ridesPage + 1} من {totalPages} — {totalRides} رحلة
                  </Text>

                  {/* Rides List */}
                  {ridesDetailedLoading ? (
                    <ActivityIndicator color="#FFD700" style={{ marginVertical: 30 }} />
                  ) : filteredRides.length > 0 ? (
                    filteredRides.map((ride: any) => (
                      <TouchableOpacity
                        key={ride.id}
                        style={styles.rideDetailCard}
                        onPress={() => { setSelectedRide(ride); setShowRideModal(true); }}
                        activeOpacity={0.8}
                      >
                        {/* Header Row */}
                        <View style={styles.rideDetailHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={styles.rideDetailId}>#{ride.id}</Text>
                            <StatusBadge status={ride.status} />
                          </View>
                          <Text style={styles.rideDetailTime}>
                            {ride.createdAt ? new Date(ride.createdAt).toLocaleString("ar-IQ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                          </Text>
                        </View>

                        {/* Route */}
                        <View style={styles.rideDetailRoute}>
                          <View style={styles.rideDetailRouteRow}>
                            <View style={styles.rideDetailDot} />
                            <Text style={styles.rideDetailAddress} numberOfLines={1}>
                              {ride.pickupAddress || `${parseFloat(ride.pickupLat?.toString() || "0").toFixed(4)}°, ${parseFloat(ride.pickupLng?.toString() || "0").toFixed(4)}°`}
                            </Text>
                          </View>
                          <View style={styles.rideDetailLine} />
                          <View style={styles.rideDetailRouteRow}>
                            <View style={[styles.rideDetailDot, styles.rideDetailDotEnd]} />
                            <Text style={styles.rideDetailAddress} numberOfLines={1}>
                              {ride.dropoffAddress || `${parseFloat(ride.dropoffLat?.toString() || "0").toFixed(4)}°, ${parseFloat(ride.dropoffLng?.toString() || "0").toFixed(4)}°`}
                            </Text>
                          </View>
                        </View>

                        {/* Meta Info */}
                        <View style={styles.rideDetailMeta}>
                          <View style={styles.rideDetailMetaItem}>
                            <Text style={styles.rideDetailMetaLabel}>📏</Text>
                            <Text style={styles.rideDetailMetaValue}>{parseFloat(ride.estimatedDistance?.toString() || "0").toFixed(1)} كم</Text>
                          </View>
                          <View style={styles.rideDetailMetaItem}>
                            <Text style={styles.rideDetailMetaLabel}>⏱️</Text>
                            <Text style={styles.rideDetailMetaValue}>
                              {ride.estimatedDuration ? `${ride.estimatedDuration} د` : "—"}
                            </Text>
                          </View>
                          <View style={styles.rideDetailMetaItem}>
                            <Text style={styles.rideDetailMetaLabel}>💳</Text>
                            <Text style={styles.rideDetailMetaValue}>{ride.paymentMethod === "wallet" ? "محفظة" : "نقداً"}</Text>
                          </View>
                          {ride.passengerRating && (
                            <View style={styles.rideDetailMetaItem}>
                              <Text style={styles.rideDetailMetaLabel}>⭐</Text>
                              <Text style={styles.rideDetailMetaValue}>{ride.passengerRating}/5</Text>
                            </View>
                          )}
                        </View>

                        {/* Passenger & Driver */}
                        <View style={styles.rideDetailPeople}>
                          <View style={styles.rideDetailPerson}>
                            <Text style={styles.rideDetailPersonLabel}>👤 المستخدم</Text>
                            <Text style={styles.rideDetailPersonName}>{ride.passengerName || "غير معروف"}</Text>
                            <Text style={styles.rideDetailPersonPhone}>{ride.passengerPhone || "—"}</Text>
                          </View>
                          <View style={styles.rideDetailPerson}>
                            <Text style={styles.rideDetailPersonLabel}>🚗 السائق</Text>
                            <Text style={styles.rideDetailPersonName}>{ride.driverName || (ride.status === "searching" ? "لم يُعيَّن بعد" : "غير معروف")}</Text>
                            <Text style={styles.rideDetailPersonPhone}>{ride.driverPhone || "—"}</Text>
                            {ride.driverVehicleModel && (
                              <Text style={styles.rideDetailPersonVehicle}>{ride.driverVehicleModel} {ride.driverVehiclePlate ? `· ${ride.driverVehiclePlate}` : ""}</Text>
                            )}
                          </View>
                        </View>

                        {/* Fare & Cancel */}
                        <View style={styles.rideDetailFareRow}>
                          <View>
                            <Text style={styles.rideDetailFare}>{Math.round(parseFloat(ride.fare?.toString() || "0")).toLocaleString()} د.ع</Text>
                            <Text style={styles.rideDetailFareSub}>أجرة الرحلة</Text>
                          </View>
                          {(ride.status === "searching" || ride.status === "accepted") && (
                            <TouchableOpacity
                              style={styles.rideDetailCancelBtn}
                              onPress={(e) => { e.stopPropagation?.(); cancelRide.mutate({ rideId: ride.id, reason: "إلغاء من الإدارة" }); }}
                            >
                              <Text style={styles.rideDetailCancelText}>إلغاء الرحلة</Text>
                            </TouchableOpacity>
                          )}
                          {ride.cancelReason && (
                            <Text style={{ fontSize: 11, color: "#F87171", flex: 1, textAlign: "right" }} numberOfLines={2}>
                              سبب الإلغاء: {ride.cancelReason}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>🚗</Text>
                      <Text style={styles.emptyText}>لا توجد رحلات</Text>
                      <Text style={styles.emptySubText}>جرّب تغيير فلتر الحالة</Text>
                    </View>
                  )}

                  {/* Pagination */}
                  {!ridesSearch.trim() && (
                    <View style={styles.paginationRow}>
                      <TouchableOpacity
                        style={[styles.pageBtn, ridesPage === 0 && styles.pageBtnDisabled]}
                        onPress={() => setRidesPage(p => Math.max(0, p - 1))}
                        disabled={ridesPage === 0}
                      >
                        <Text style={styles.pageBtnText}>→ السابق</Text>
                      </TouchableOpacity>
                      <Text style={styles.pageInfo}>صفحة {ridesPage + 1} / {totalPages}</Text>
                      <TouchableOpacity
                        style={[styles.pageBtn, ridesPage >= totalPages - 1 && styles.pageBtnDisabled]}
                        onPress={() => setRidesPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={ridesPage >= totalPages - 1}
                      >
                        <Text style={styles.pageBtnText}>التالي ←</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* ── Ride Detail Modal ── */}
            <Modal visible={showRideModal} transparent animationType="slide" onRequestClose={() => setShowRideModal(false)}>
              <View style={styles.rideModalOverlay}>
                <View style={styles.rideModalSheet}>
                  <View style={styles.rideModalHandle} />
                  <Text style={styles.rideModalTitle}>تفاصيل الرحلة #{selectedRide?.id}</Text>
                  {selectedRide && (
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {/* Status */}
                      <View style={styles.rideModalSection}>
                        <Text style={styles.rideModalSectionTitle}>الحالة</Text>
                        <View style={{ alignItems: "flex-start" }}>
                          <StatusBadge status={selectedRide.status} />
                        </View>
                      </View>

                      {/* Route */}
                      <View style={styles.rideModalSection}>
                        <Text style={styles.rideModalSectionTitle}>المسار</Text>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>📍 نقطة الانطلاق</Text>
                          <Text style={styles.rideModalValue} numberOfLines={2}>{selectedRide.pickupAddress || `${selectedRide.pickupLat}, ${selectedRide.pickupLng}`}</Text>
                        </View>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>🏁 الوجهة</Text>
                          <Text style={styles.rideModalValue} numberOfLines={2}>{selectedRide.dropoffAddress || `${selectedRide.dropoffLat}, ${selectedRide.dropoffLng}`}</Text>
                        </View>
                      </View>

                      {/* Passenger */}
                      <View style={styles.rideModalSection}>
                        <Text style={styles.rideModalSectionTitle}>المستخدم</Text>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>الاسم</Text>
                          <Text style={styles.rideModalValue}>{selectedRide.passengerName || "غير معروف"}</Text>
                        </View>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>الهاتف</Text>
                          <Text style={styles.rideModalValue}>{selectedRide.passengerPhone || "—"}</Text>
                        </View>
                        {selectedRide.passengerRating && (
                          <View style={styles.rideModalRow}>
                            <Text style={styles.rideModalLabel}>تقييم المستخدم للرحلة</Text>
                            <Text style={styles.rideModalValue}>⭐ {selectedRide.passengerRating}/5</Text>
                          </View>
                        )}
                      </View>

                      {/* Driver */}
                      <View style={styles.rideModalSection}>
                        <Text style={styles.rideModalSectionTitle}>السائق</Text>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>الاسم</Text>
                          <Text style={styles.rideModalValue}>{selectedRide.driverName || (selectedRide.status === "searching" ? "لم يُعيَّن بعد" : "غير معروف")}</Text>
                        </View>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>الهاتف</Text>
                          <Text style={styles.rideModalValue}>{selectedRide.driverPhone || "—"}</Text>
                        </View>
                        {selectedRide.driverVehicleModel && (
                          <View style={styles.rideModalRow}>
                            <Text style={styles.rideModalLabel}>السيارة</Text>
                            <Text style={styles.rideModalValue}>{selectedRide.driverVehicleModel} {selectedRide.driverVehiclePlate ? `· ${selectedRide.driverVehiclePlate}` : ""}</Text>
                          </View>
                        )}
                        {selectedRide.driverRating && (
                          <View style={styles.rideModalRow}>
                            <Text style={styles.rideModalLabel}>تقييم السائق للرحلة</Text>
                            <Text style={styles.rideModalValue}>⭐ {selectedRide.driverRating}/5</Text>
                          </View>
                        )}
                      </View>

                      {/* Financial */}
                      <View style={styles.rideModalSection}>
                        <Text style={styles.rideModalSectionTitle}>المالية</Text>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>الأجرة</Text>
                          <Text style={[styles.rideModalValue, { color: "#FFD700" }]}>{Math.round(parseFloat(selectedRide.fare?.toString() || "0")).toLocaleString()} د.ع</Text>
                        </View>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>طريقة الدفع</Text>
                          <Text style={styles.rideModalValue}>{selectedRide.paymentMethod === "wallet" ? "💳 محفظة" : "💵 نقداً"}</Text>
                        </View>
                      </View>

                      {/* Trip Details */}
                      <View style={styles.rideModalSection}>
                        <Text style={styles.rideModalSectionTitle}>تفاصيل الرحلة</Text>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>المسافة التقديرية</Text>
                          <Text style={styles.rideModalValue}>{parseFloat(selectedRide.estimatedDistance?.toString() || "0").toFixed(1)} كم</Text>
                        </View>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>الوقت التقديري</Text>
                          <Text style={styles.rideModalValue}>{selectedRide.estimatedDuration ? `${selectedRide.estimatedDuration} دقيقة` : "—"}</Text>
                        </View>
                        <View style={styles.rideModalRow}>
                          <Text style={styles.rideModalLabel}>وقت الطلب</Text>
                          <Text style={styles.rideModalValue}>
                            {selectedRide.createdAt ? new Date(selectedRide.createdAt).toLocaleString("ar-IQ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                          </Text>
                        </View>
                        {selectedRide.startedAt && (
                          <View style={styles.rideModalRow}>
                            <Text style={styles.rideModalLabel}>وقت البدء</Text>
                            <Text style={styles.rideModalValue}>
                              {new Date(selectedRide.startedAt).toLocaleString("ar-IQ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                        )}
                        {selectedRide.completedAt && (
                          <View style={styles.rideModalRow}>
                            <Text style={styles.rideModalLabel}>وقت الإكمال</Text>
                            <Text style={styles.rideModalValue}>
                              {new Date(selectedRide.completedAt).toLocaleString("ar-IQ", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                        )}
                        {selectedRide.cancelReason && (
                          <View style={styles.rideModalRow}>
                            <Text style={styles.rideModalLabel}>سبب الإلغاء</Text>
                            <Text style={[styles.rideModalValue, { color: "#F87171" }]}>{selectedRide.cancelReason}</Text>
                          </View>
                        )}
                      </View>

                      {/* Cancel Action */}
                      {(selectedRide.status === "searching" || selectedRide.status === "accepted") && (
                        <TouchableOpacity
                          style={[styles.rideDetailCancelBtn, { marginTop: 8, paddingVertical: 12, alignItems: "center" }]}
                          onPress={() => {
                            cancelRide.mutate({ rideId: selectedRide.id, reason: "إلغاء من الإدارة" });
                            setShowRideModal(false);
                          }}
                        >
                          <Text style={[styles.rideDetailCancelText, { fontSize: 14 }]}>🚫 إلغاء هذه الرحلة</Text>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  )}
                  <TouchableOpacity style={styles.rideModalCloseBtn} onPress={() => setShowRideModal(false)}>
                    <Text style={styles.rideModalCloseBtnText}>إغلاق</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

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
                      <TouchableOpacity
                        onPress={() => {
                          if ((driver as any).photoUrl) {
                            setPreviewPhotoUrl((driver as any).photoUrl);
                            setPreviewPhotoName(driver.name || driver.phone || "سائق");
                          }
                        }}
                        activeOpacity={(driver as any).photoUrl ? 0.8 : 1}
                      >
                        {(driver as any).photoUrl ? (
                          <Image
                            source={{ uri: (driver as any).photoUrl }}
                            style={styles.driverAvatar}
                          />
                        ) : (
                          <View style={styles.driverAvatar}>
                            <Text style={styles.driverAvatarText}>
                              {(driver.name || "؟").charAt(0)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
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
                        {/* Wallet Balance */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                          <Text style={{ fontSize: 11, color: driver.isBlocked ? '#F59E0B' : '#22C55E', fontWeight: '700' }}>
                            💰 {Math.round(parseFloat((driver as any).walletBalance?.toString() || '0')).toLocaleString('ar-IQ')} د.ع
                          </Text>
                        </View>
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
                        {/* Ride History icon */}
                        <TouchableOpacity
                          style={[styles.docsBtn, { backgroundColor: '#1E3A5F' }]}
                          onPress={() => { setHistoryDriverId(driver.id); setHistoryDriverName(driver.name || ''); setHistoryDriverPhone(driver.phone || ''); setHistoryDriverModel(driver.vehicleModel || ''); setHistoryTabState('city'); }}
                        >
                          <Text style={{ fontSize: 18 }}>📋</Text>
                        </TouchableOpacity>
                        {/* Block/Unblock */}
                        <TouchableOpacity
                          style={[styles.blockBtn, driver.isBlocked && styles.unblockBtn]}
                          onPress={() => {
                            if (driver.isBlocked) {
                              setUnblockTargetDriver({ id: driver.id, name: driver.name });
                              setShowUnblockModal(true);
                            } else {
                              setBlockTargetDriver({ id: driver.id, name: driver.name });
                              setBlockReasonInput("");
                              setShowBlockModal(true);
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

                  // City filter
                  if (passengerCityFilter.trim()) {
                    const cityQ = passengerCityFilter.trim().toLowerCase();
                    filteredPassengers = filteredPassengers.filter(p =>
                      ((p as any).city || "").toLowerCase().includes(cityQ) ||
                      ((p as any).country || "").toLowerCase().includes(cityQ)
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

                    {/* City Filter */}
                    <Text style={filterStyles.filterLabel}>📍 المدينة / الدولة</Text>
                    <View style={[filterStyles.searchBox, { marginBottom: 10 }]}>
                      <TextInput
                        style={{ flex: 1, color: '#ECEDEE', fontSize: 13, textAlign: 'right' }}
                        placeholder="مثال: العراق أو موصل..."
                        placeholderTextColor="#9B8EC4"
                        value={passengerCityFilter}
                        onChangeText={(v) => { setPassengerCityFilter(v); setPassengersPage(0); }}
                      />
                      {passengerCityFilter.length > 0 && (
                        <TouchableOpacity onPress={() => setPassengerCityFilter("")}>
                          <Text style={{ color: '#9B8EC4', fontSize: 16, paddingHorizontal: 6 }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
                  pagedPassengers.map((p) => {
                    const isBlocked = (p as any).isBlocked;
                    const city = (p as any).city;
                    const country = (p as any).country;
                    const locationStr = city && country ? `${country}، ${city}` : city || country || null;
                    return (
                    <View key={p.id} style={[styles.passengerCard, isBlocked && { borderLeftWidth: 3, borderLeftColor: '#EF4444', opacity: 0.9 }]}>
                      <TouchableOpacity
                        onPress={() => {
                          if ((p as any).photoUrl) {
                            setPreviewPhotoUrl((p as any).photoUrl);
                            setPreviewPhotoName(p.name || p.phone || "مستخدم");
                          }
                        }}
                        activeOpacity={(p as any).photoUrl ? 0.8 : 1}
                      >
                        {(p as any).photoUrl ? (
                          <Image
                            source={{ uri: (p as any).photoUrl }}
                            style={[styles.passengerAvatar, { borderWidth: 2, borderColor: isBlocked ? '#EF4444' : '#6C3FC5' }]}
                          />
                        ) : (
                          <View style={[styles.passengerAvatar, isBlocked && { backgroundColor: '#7f1d1d' }]}>
                            <Text style={styles.passengerAvatarText}>
                              {(p.name || p.phone || "؟").charAt(0)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={[styles.passengerInfo, { flex: 1 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.passengerName, { textAlign: 'right', flex: 1 }]}>{p.name || "بدون اسم"}</Text>
                          {isBlocked && <Text style={{ fontSize: 11, color: '#EF4444', backgroundColor: '#7f1d1d33', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>محظور</Text>}
                        </View>
                        <Text style={[styles.passengerPhone, { textAlign: 'right' }]}>{p.phone}</Text>
                        {locationStr && <Text style={{ fontSize: 11, color: '#9B8EC4', textAlign: 'right', marginTop: 2 }}>📍 {locationStr}</Text>}
                        <View style={[styles.passengerMeta, { justifyContent: 'flex-end' }]}>
                          <Text style={styles.passengerRating}>⭐ {p.rating}</Text>
                          <Text style={styles.passengerRides}>• {p.totalRides} رحلة</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'center', gap: 6 }}>
                        <View style={styles.passengerBalance}>
                          <Text style={styles.balanceValue}>{Math.round(parseFloat(p.walletBalance?.toString() || "0")).toLocaleString()}</Text>
                          <Text style={styles.balanceLabel}>دينار</Text>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: isBlocked ? '#22C55E22' : '#EF444422', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: isBlocked ? '#22C55E' : '#EF4444' }}
                          onPress={() => {
                            if (isBlocked) {
                              setUnblockTargetPassenger({ id: p.id, name: p.name || p.phone });
                              setShowPassengerUnblockModal(true);
                            } else {
                              setBlockTargetPassenger({ id: p.id, name: p.name || p.phone });
                              setShowPassengerBlockModal(true);
                            }
                          }}
                        >
                          <Text style={{ fontSize: 11, color: isBlocked ? '#22C55E' : '#EF4444', fontWeight: '600' }}>{isBlocked ? '✅ تفعيل' : '🚫 حظر'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    );
                  })
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
        {/* Intercity Trips Tab - Professional */}
        {activeTab === "intercity" && (() => {
          // ─── Filter & Sort Logic
          const formatIntercityDate = (val: string | Date | null | undefined) => {
            if (!val) return "—";
            const d = typeof val === "string" ? new Date(val) : val;
            if (isNaN(d.getTime())) return "—";
            return d.toLocaleDateString("ar-IQ", { weekday: "short", month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
          };
          const trips = allIntercityTrips ?? [];
          const filtered = trips
            .filter(t => intercityStatusFilter === "all" || t.status === intercityStatusFilter)
            .filter(t => {
              if (!intercityCityFilter.trim()) return true;
              const q = intercityCityFilter.trim().toLowerCase();
              return (t.fromCity?.toLowerCase().includes(q) || t.toCity?.toLowerCase().includes(q));
            })
            .filter(t => {
              if (!intercityDriverFilter.trim()) return true;
              const q = intercityDriverFilter.trim().toLowerCase();
              return (t.driver?.name?.toLowerCase().includes(q) || t.driver?.phone?.includes(q));
            })
            .sort((a, b) => {
              if (intercitySortBy === "date") return new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime();
              if (intercitySortBy === "seats") return b.totalPassengers - a.totalPassengers;
              if (intercitySortBy === "price") return Number(b.pricePerSeat) - Number(a.pricePerSeat);
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

          // ─── Quick Stats
          const totalTrips = trips.length;
          const activeTrips = trips.filter(t => t.status === "in_progress").length;
          const scheduledTrips = trips.filter(t => t.status === "scheduled").length;
          const completedTrips = trips.filter(t => t.status === "completed").length;
          const cancelledTrips = trips.filter(t => t.status === "cancelled").length;
          const totalRevenue = trips.reduce((sum, t) => sum + (t.totalPassengers * Number(t.pricePerSeat)), 0);

          // ─── Cancel Reason Stats
          const cancelledWithReason = trips.filter(t => t.status === "cancelled" && t.cancelReason);
          const reasonCounts: Record<string, number> = {};
          cancelledWithReason.forEach(t => {
            const reason = t.cancelReason as string;
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
          });
          const topReasons = Object.entries(reasonCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          return (
            <View style={styles.section}>
              {/* Section Header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={styles.sectionTitle}>🗯️ رحلات بين المدن</Text>
                <TouchableOpacity
                  style={{ backgroundColor: intercityShowFilters ? "#FFD700" : "#2D1B4E", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                  onPress={() => setIntercityShowFilters(!intercityShowFilters)}
                >
                  <Text style={{ fontSize: 14 }}>⚙️</Text>
                  <Text style={{ color: intercityShowFilters ? "#1A0533" : "#9B8EC4", fontSize: 12, fontWeight: "700" }}>فلاتر</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Stats Row */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#2D1B4E" }}>
                  <Text style={{ color: "#FFD700", fontSize: 20, fontWeight: "800" }}>{totalTrips}</Text>
                  <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>إجمالي</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#22C55E44" }}>
                  <Text style={{ color: "#22C55E", fontSize: 20, fontWeight: "800" }}>{activeTrips}</Text>
                  <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>جارية</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#FFD70044" }}>
                  <Text style={{ color: "#FFD700", fontSize: 20, fontWeight: "800" }}>{scheduledTrips}</Text>
                  <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>مجدولة</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#60A5FA44" }}>
                  <Text style={{ color: "#60A5FA", fontSize: 20, fontWeight: "800" }}>{completedTrips}</Text>
                  <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>مكتملة</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#EF444444" }}>
                  <Text style={{ color: "#F87171", fontSize: 20, fontWeight: "800" }}>{cancelledTrips}</Text>
                  <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>ملغاة</Text>
                </View>
              </View>

              {/* Cancellation Stats Card */}
              {cancelledTrips > 0 && (
                <View style={{ backgroundColor: "rgba(239,68,68,0.07)", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ color: "#F87171", fontSize: 13, fontWeight: "800" }}>❌ إحصائيات الإلغاء</Text>
                    <Text style={{ color: "#F87171", fontSize: 12 }}>{cancelledTrips} رحلة ملغاة</Text>
                  </View>
                  <Text style={{ color: "#9B8EC4", fontSize: 11, marginBottom: 8 }}>
                    نسبة الإلغاء: {totalTrips > 0 ? ((cancelledTrips / totalTrips) * 100).toFixed(1) : 0}%
                    {cancelledWithReason.length > 0 ? `  •  ${cancelledWithReason.length} رحلة بسبب موثق` : ""}
                  </Text>
                  {topReasons.length > 0 && (
                    <>
                      <Text style={{ color: "#9B8EC4", fontSize: 11, fontWeight: "700", marginBottom: 6 }}>أشهر أسباب الإلغاء:</Text>
                      {topReasons.map(([reason, count], i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#EF444422", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: "#F87171", fontSize: 10, fontWeight: "800" }}>{i + 1}</Text>
                          </View>
                          <Text style={{ flex: 1, color: "#FCA5A5", fontSize: 12 }} numberOfLines={1}>{reason}</Text>
                          <Text style={{ color: "#F87171", fontSize: 12, fontWeight: "700" }}>{count}x</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}

              {/* Revenue Card */}
              <View style={{ backgroundColor: "rgba(74,222,128,0.08)", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(74,222,128,0.25)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: "#9B8EC4", fontSize: 12 }}>💰 إجمالي الإيرادات (تقديري)</Text>
                  <Text style={{ color: "#4ADE80", fontSize: 22, fontWeight: "800", marginTop: 4 }}>{totalRevenue.toLocaleString()} دينار</Text>
                </View>
                <Text style={{ fontSize: 32 }}>📊</Text>
              </View>

              {/* Filters Panel */}
              {intercityShowFilters && (
                <View style={{ backgroundColor: "#0D0820", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#2D1B4E" }}>
                  {/* Status Filter */}
                  <Text style={{ color: "#9B8EC4", fontSize: 12, fontWeight: "700", marginBottom: 8 }}>حالة الرحلة</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                    {(["all", "scheduled", "in_progress", "completed", "cancelled"] as const).map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.filterChip, intercityStatusFilter === s && styles.filterChipActive]}
                        onPress={() => setIntercityStatusFilter(s)}
                      >
                        <Text style={[styles.filterChipText, intercityStatusFilter === s && styles.filterChipTextActive]}>
                          {s === "all" ? "الكل" : s === "scheduled" ? "⏰ مجدولة" : s === "in_progress" ? "🚗 جارية" : s === "completed" ? "✅ مكتملة" : "❌ ملغاة"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* City Filter */}
                  <Text style={{ color: "#9B8EC4", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>🏙️ فلتر المدينة</Text>
                  <TextInput
                    style={{ backgroundColor: "#1A0533", borderRadius: 10, padding: 10, color: "#FFFFFF", fontSize: 13, borderWidth: 1, borderColor: "#2D1B4E", marginBottom: 12, textAlign: "right" }}
                    placeholder="ابحث باسم المدينة (مصدر أو وجهة)..."
                    placeholderTextColor="#4A3B6B"
                    value={intercityCityFilter}
                    onChangeText={setIntercityCityFilter}
                  />

                  {/* Driver Filter */}
                  <Text style={{ color: "#9B8EC4", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>👨‍✈️ فلتر السائق</Text>
                  <TextInput
                    style={{ backgroundColor: "#1A0533", borderRadius: 10, padding: 10, color: "#FFFFFF", fontSize: 13, borderWidth: 1, borderColor: "#2D1B4E", marginBottom: 12, textAlign: "right" }}
                    placeholder="ابحث باسم السائق أو رقم هاتفه..."
                    placeholderTextColor="#4A3B6B"
                    value={intercityDriverFilter}
                    onChangeText={setIntercityDriverFilter}
                  />

                  {/* Sort */}
                  <Text style={{ color: "#9B8EC4", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>ترتيب حسب</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {(["newest", "date", "seats", "price"] as const).map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.filterChip, intercitySortBy === s && styles.filterChipActive]}
                        onPress={() => setIntercitySortBy(s)}
                      >
                        <Text style={[styles.filterChipText, intercitySortBy === s && styles.filterChipTextActive]}>
                          {s === "newest" ? "الأحدث" : s === "date" ? "تاريخ السفر" : s === "seats" ? "عدد المسافرين" : "السعر"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Reset */}
                  {(intercityStatusFilter !== "all" || intercityCityFilter || intercityDriverFilter || intercitySortBy !== "newest") && (
                    <TouchableOpacity
                      style={{ backgroundColor: "#2D1B4E", borderRadius: 10, padding: 10, alignItems: "center", marginTop: 12 }}
                      onPress={() => { setIntercityStatusFilter("all"); setIntercityCityFilter(""); setIntercityDriverFilter(""); setIntercitySortBy("newest"); }}
                    >
                      <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "700" }}>🔄 إعادة تعيين الفلاتر</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Results Count */}
              <Text style={{ color: "#9B8EC4", fontSize: 12, marginBottom: 10 }}>
                عرض {filtered.length} رحلة من إجمالي {totalTrips}
              </Text>

              {/* Trip Cards */}
              {intercityLoading ? (
                <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
              ) : filtered.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🗺️</Text>
                  <Text style={{ color: "#9B8EC4", fontSize: 14 }}>لا توجد رحلات تطابق الفلاتر</Text>
                </View>
              ) : (
                filtered.map((trip) => {
                  const bookedPct = trip.totalSeats > 0 ? Math.round((trip.totalPassengers / trip.totalSeats) * 100) : 0;
                  const statusColor = trip.status === "scheduled" ? "#FFD700" : trip.status === "in_progress" ? "#22C55E" : trip.status === "completed" ? "#60A5FA" : "#F87171";
                  const statusLabel = trip.status === "scheduled" ? "⏰ مجدولة" : trip.status === "in_progress" ? "🚗 جارية" : trip.status === "completed" ? "✅ مكتملة" : "❌ ملغاة";

                  return (
                    <View key={trip.id} style={{ backgroundColor: "#1A0533", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#2D1B4E" }}>
                      {/* Top Row: Route + Status */}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "800" }}>
                            {trip.fromCity} → {trip.toCity}
                          </Text>
                          <Text style={{ color: "#9B8EC4", fontSize: 12, marginTop: 3 }}>
                            🕐 {formatIntercityDate(trip.departureTime)}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: statusColor + "22", borderRadius: 20, borderWidth: 1, borderColor: statusColor, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ color: statusColor, fontSize: 12, fontWeight: "700" }}>{statusLabel}</Text>
                        </View>
                      </View>

                      {/* Driver Info */}
                      {trip.driver && (
                        <View style={{ backgroundColor: "rgba(255,215,0,0.06)", borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,215,0,0.15)" }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <View>
                              <Text style={{ color: "#FFD700", fontSize: 12, fontWeight: "700" }}>👨‍✈️ {trip.driver.name}</Text>
                              <Text style={{ color: "#9B8EC4", fontSize: 11, marginTop: 2 }}>{trip.driver.phone}</Text>
                            </View>
                            {trip.driver.vehicleModel && (
                              <Text style={{ color: "#9B8EC4", fontSize: 11 }}>🚗 {trip.driver.vehicleModel}{trip.driver.vehiclePlate ? ` • ${trip.driver.vehiclePlate}` : ""}</Text>
                            )}
                          </View>
                        </View>
                      )}

                      {/* Stats Grid */}
                      <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                        <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 10, padding: 10, alignItems: "center" }}>
                          <Text style={{ color: "#FFD700", fontSize: 16, fontWeight: "800" }}>{trip.totalPassengers}/{trip.totalSeats}</Text>
                          <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>مقاعد</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 10, padding: 10, alignItems: "center" }}>
                          <Text style={{ color: "#4ADE80", fontSize: 16, fontWeight: "800" }}>{Number(trip.pricePerSeat).toLocaleString()}</Text>
                          <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>دينار/مقعد</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 10, padding: 10, alignItems: "center" }}>
                          <Text style={{ color: "#60A5FA", fontSize: 16, fontWeight: "800" }}>{trip.bookingsCount}</Text>
                          <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>حجز</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: "#0D0820", borderRadius: 10, padding: 10, alignItems: "center" }}>
                          <Text style={{ color: bookedPct >= 80 ? "#F87171" : bookedPct >= 50 ? "#FBBF24" : "#4ADE80", fontSize: 16, fontWeight: "800" }}>{bookedPct}%</Text>
                          <Text style={{ color: "#9B8EC4", fontSize: 10, marginTop: 2 }}>إشغال</Text>
                        </View>
                      </View>

                      {/* Progress Bar */}
                      <View style={{ backgroundColor: "#2D1B4E", borderRadius: 4, height: 6, marginBottom: 10 }}>
                        <View style={{ backgroundColor: bookedPct >= 80 ? "#F87171" : bookedPct >= 50 ? "#FBBF24" : "#4ADE80", borderRadius: 4, height: 6, width: `${bookedPct}%` as any }} />
                      </View>

                      {/* Meeting Point */}
                      {trip.meetingPoint && (
                        <Text style={{ color: "#9B8EC4", fontSize: 12, marginBottom: 8 }}>📍 نقطة التجمع: {trip.meetingPoint}</Text>
                      )}

                      {/* Notes */}
                      {trip.notes && (
                        <Text style={{ color: "#9B8EC4", fontSize: 12, marginBottom: 8, fontStyle: "italic" }}>📝 {trip.notes}</Text>
                      )}

                      {/* Action Buttons */}
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {/* View Passengers Button */}
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: "#2D1B4E", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#6C3FC5" }}
                          onPress={() => {
                            setSelectedPassengersTripId(trip.id);
                            setShowPassengersModal(true);
                          }}
                        >
                          <Text style={{ color: "#A78BFA", fontSize: 13, fontWeight: "700" }}>👥 المسافرون ({trip.totalPassengers})</Text>
                        </TouchableOpacity>

                        {/* Cancel Button - only for scheduled */}
                        {trip.status === "scheduled" && (
                          <TouchableOpacity
                            style={{ backgroundColor: "#7F1D1D", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#991B1B", paddingHorizontal: 14 }}
                            onPress={() => Alert.alert("إلغاء الرحلة", `هل تريد إلغاء رحلة ${trip.fromCity} → ${trip.toCity}؟`, [
                              { text: "تراجع", style: "cancel" },
                              { text: "إلغاء", style: "destructive", onPress: () => cancelIntercityTripMutation.mutate({ tripId: trip.id }) },
                            ])}
                            activeOpacity={0.8}
                          >
                            <Text style={{ color: "#FCA5A5", fontSize: 13, fontWeight: "700" }}>❌ إلغاء</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}

              {/* Passengers Modal */}
              <Modal visible={showPassengersModal} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: "#000000BB", justifyContent: "flex-end" }}>
                  <View style={{ backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: "85%" }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Text style={{ color: "#FFD700", fontSize: 18, fontWeight: "700" }}>👥 بيانات الرحلة</Text>
                      <TouchableOpacity onPress={() => { setShowPassengersModal(false); setSelectedPassengersTripId(null); setPassengersModalTab("passengers"); }}>
                        <Text style={{ color: "#9B8EC4", fontSize: 20, padding: 4 }}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: passengersModalTab === "passengers" ? "#6C3FC5" : "#2D1B4E" }}
                        onPress={() => setPassengersModalTab("passengers")}
                      >
                        <Text style={{ color: passengersModalTab === "passengers" ? "#FFD700" : "#9B8EC4", fontWeight: "700", fontSize: 13 }}>👥 المسافرون</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: passengersModalTab === "chat" ? "#6C3FC5" : "#2D1B4E" }}
                        onPress={() => setPassengersModalTab("chat")}
                      >
                        <Text style={{ color: passengersModalTab === "chat" ? "#FFD700" : "#9B8EC4", fontWeight: "700", fontSize: 13 }}>💬 المحادثات</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Passengers Tab */}
                    {passengersModalTab === "passengers" && (
                      passengersModalLoading ? (
                        <ActivityIndicator color="#FFD700" style={{ margin: 20 }} />
                      ) : !tripPassengersData?.length ? (
                        <View style={{ alignItems: "center", paddingVertical: 30 }}>
                          <Text style={{ fontSize: 36, marginBottom: 8 }}>👤</Text>
                          <Text style={{ color: "#9B8EC4", fontSize: 14 }}>لا يوجد مسافرون على هذه الرحلة</Text>
                        </View>
                      ) : (
                        <ScrollView showsVerticalScrollIndicator={false}>
                          {(tripPassengersData as any[]).map((b, i) => (
                            <View key={b.id} style={{ backgroundColor: "#2D1B4E", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#6C3FC5", justifyContent: "center", alignItems: "center" }}>
                                  <Text style={{ color: "#FFD700", fontWeight: "800", fontSize: 14 }}>{i + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{b.passengerName || "مسافر"}</Text>
                                  <Text style={{ color: "#9B8EC4", fontSize: 12, marginTop: 2 }}>📞 {b.passengerPhone}</Text>
                                  {b.pickupAddress && <Text style={{ color: "#60A5FA", fontSize: 12, marginTop: 2 }}>📍 {b.pickupAddress}</Text>}
                                  {b.passengerNote && <Text style={{ color: "#9B8EC4", fontSize: 11, marginTop: 2, fontStyle: "italic" }}>📝 {b.passengerNote}</Text>}
                                </View>
                                <View style={{ alignItems: "flex-end" }}>
                                  <Text style={{ color: "#4ADE80", fontWeight: "800", fontSize: 13 }}>{parseInt(b.totalPrice ?? "0").toLocaleString()}</Text>
                                  <Text style={{ color: "#9B8EC4", fontSize: 10 }}>دينار</Text>
                                  <Text style={{ color: "#FFD700", fontSize: 11, marginTop: 4 }}>💺 {b.seatsBooked} مقعد</Text>
                                  {b.driverRating ? (
                                    <Text style={{ color: "#FFD700", fontSize: 11, marginTop: 4 }}>⭐ {b.driverRating}/5</Text>
                                  ) : (
                                    <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 4 }}>لم يُقيّم</Text>
                                  )}
                                </View>
                              </View>
                              {/* زر عرض المحادثة */}
                              <TouchableOpacity
                                style={{ marginTop: 8, backgroundColor: "#1A2B3E", borderRadius: 8, paddingVertical: 8, alignItems: "center", borderWidth: 1, borderColor: "#4A90D9" }}
                                onPress={() => {
                                  setChatBookingId(b.id);
                                  setChatPassengerName(b.passengerName || "مسافر");
                                  setPassengersModalTab("chat");
                                }}
                              >
                                <Text style={{ color: "#4A90D9", fontSize: 12, fontWeight: "700" }}>💬 عرض محادثة هذا الراكب</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </ScrollView>
                      )
                    )}

                    {/* Chat Tab */}
                    {passengersModalTab === "chat" && (
                      <View style={{ flex: 1 }}>
                        {!chatBookingId ? (
                          <View style={{ alignItems: "center", paddingVertical: 30 }}>
                            <Text style={{ fontSize: 36, marginBottom: 8 }}>💬</Text>
                            <Text style={{ color: "#9B8EC4", fontSize: 14 }}>اختر راكباً من تبويب المسافرين لعرض محادثته</Text>
                          </View>
                        ) : (
                          <View style={{ flex: 1 }}>
                            {/* Chat header */}
                            <View style={{ backgroundColor: "#2D1B4E", borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Text style={{ fontSize: 20 }}>💬</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: "#FFD700", fontWeight: "700", fontSize: 13 }}>محادثة: {chatPassengerName}</Text>
                                <Text style={{ color: "#9B8EC4", fontSize: 11 }}>حجز #{chatBookingId}</Text>
                              </View>
                              <TouchableOpacity onPress={() => { setChatBookingId(null); setPassengersModalTab("passengers"); }}>
                                <Text style={{ color: "#9B8EC4", fontSize: 16 }}>← رجوع</Text>
                              </TouchableOpacity>
                            </View>

                            {chatMessagesLoading ? (
                              <ActivityIndicator color="#FFD700" style={{ margin: 20 }} />
                            ) : !chatMessages?.length ? (
                              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                                <Text style={{ fontSize: 32, marginBottom: 8 }}>📤</Text>
                                <Text style={{ color: "#9B8EC4", fontSize: 14 }}>لا توجد رسائل في هذه المحادثة</Text>
                              </View>
                            ) : (
                              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
                                {(chatMessages as any[]).map((msg) => {
                                  const isDriver = msg.senderType === "driver";
                                  const d = new Date(msg.createdAt);
                                  const timeStr = isNaN(d.getTime()) ? "" : d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
                                  return (
                                    <View key={msg.id} style={{ marginBottom: 8, alignItems: isDriver ? "flex-start" : "flex-end" }}>
                                      <View style={{ backgroundColor: isDriver ? "#1A2B4E" : "#2D1B4E", borderRadius: 12, padding: 10, maxWidth: "80%" }}>
                                        <Text style={{ color: isDriver ? "#60A5FA" : "#FFD700", fontSize: 11, fontWeight: "700", marginBottom: 4 }}>
                                          {isDriver ? "🚗 السائق" : "👤 الراكب"}
                                        </Text>
                                        <Text style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 18 }}>{msg.message}</Text>
                                        <Text style={{ color: "#6B7280", fontSize: 10, marginTop: 4, textAlign: "right" }}>{timeStr}</Text>
                                      </View>
                                    </View>
                                  );
                                })}
                              </ScrollView>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </Modal>
            </View>
          );
        })()}

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

        {/* ─── Support Tab ─────────────────────────────────────────────────────────── */}
        {activeTab === "support" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎟️ إدارة الدعم الفني</Text>

            {/* Rating Stats Card */}
            {ratingStats && ratingStats.totalRated > 0 && (
              <View style={{
                backgroundColor: "#1E0F4A", borderRadius: 14, padding: 14, marginBottom: 16,
                borderWidth: 1, borderColor: "#FFD70033",
              }}>
                <Text style={{ color: "#FFD700", fontSize: 13, fontWeight: "700", marginBottom: 10 }}>
                  ⭐ تقييمات الدعم الفني
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 32, fontWeight: "800" }}>
                      {ratingStats.avgRating > 0 ? ratingStats.avgRating.toFixed(1) : "-"}
                    </Text>
                    <Text style={{ color: "#9B8EC4", fontSize: 11 }}>من 5</Text>
                    <Text style={{ fontSize: 16, marginTop: 2 }}>
                      {"⭐".repeat(Math.round(ratingStats.avgRating))}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = ratingStats.distribution?.[star - 1] ?? 0;
                      const pct = ratingStats.totalRated > 0 ? (count / ratingStats.totalRated) * 100 : 0;
                      return (
                        <View key={star} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ color: "#9B8EC4", fontSize: 10, width: 14 }}>{star}⭐</Text>
                          <View style={{ flex: 1, height: 6, backgroundColor: "#2D1B4E", borderRadius: 3 }}>
                            <View style={{ width: `${pct}%`, height: 6, backgroundColor: "#FFD700", borderRadius: 3 }} />
                          </View>
                          <Text style={{ color: "#9B8EC4", fontSize: 10, width: 20 }}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
                <Text style={{ color: "#6B5A8A", fontSize: 11, marginTop: 8, textAlign: "center" }}>
                  إجمالي التقييمات: {ratingStats.totalRated} تذكرة
                </Text>
              </View>
            )}

            {/* Filters */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {(["all", "open", "in_progress", "resolved", "closed"] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, supportStatusFilter === s && styles.filterChipActive]}
                  onPress={() => setSupportStatusFilter(s)}
                >
                  <Text style={[styles.filterChipText, supportStatusFilter === s && styles.filterChipTextActive]}>
                    {s === "all" ? "الكل" : s === "open" ? "مفتوحة" : s === "in_progress" ? "قيد المعالجة" : s === "resolved" ? "محلولة" : "مغلقة"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {(["all", "passenger", "driver"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterChip, supportUserTypeFilter === t && styles.filterChipActive]}
                  onPress={() => setSupportUserTypeFilter(t)}
                >
                  <Text style={[styles.filterChipText, supportUserTypeFilter === t && styles.filterChipTextActive]}>
                    {t === "all" ? "الجميع" : t === "passenger" ? "👤 مستخدم" : "🚗 كابتن"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tickets List */}
            {supportLoading ? (
              <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} />
            ) : !supportTickets || (supportTickets as any).tickets?.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🎟️</Text>
                <Text style={{ color: "#9B8EC4", fontSize: 15 }}>لا توجد تذاكر دعم</Text>
              </View>
            ) : (
              ((supportTickets as any).tickets as any[]).map((ticket: any) => (
                <TouchableOpacity
                  key={ticket.id}
                  style={{
                    backgroundColor: "#1E0F4A",
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: ticket.unreadByAdmin > 0 ? "#FFD700" : "#2D1B4E",
                  }}
                  onPress={() => {
                    setSelectedSupportTicketId(ticket.id);
                    setSelectedTicketSubject(ticket.subject);
                    setShowSupportChatModal(true);
                    markSupportReadMutation.mutateAsync({ ticketId: ticket.id, readerType: "admin" }).catch(() => {});
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700", flex: 1 }} numberOfLines={1}>{ticket.subject}</Text>
                    {ticket.unreadByAdmin > 0 && (
                      <View style={{ backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>{ticket.unreadByAdmin}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
                      backgroundColor: ticket.status === "open" ? "#F59E0B22" : ticket.status === "in_progress" ? "#3B82F622" : ticket.status === "resolved" ? "#10B98122" : "#6B728022",
                    }}>
                      <Text style={{
                        fontSize: 11, fontWeight: "600",
                        color: ticket.status === "open" ? "#F59E0B" : ticket.status === "in_progress" ? "#3B82F6" : ticket.status === "resolved" ? "#10B981" : "#6B7280",
                      }}>
                        {ticket.status === "open" ? "مفتوحة" : ticket.status === "in_progress" ? "قيد المعالجة" : ticket.status === "resolved" ? "محلولة" : "مغلقة"}
                      </Text>
                    </View>
                    <Text style={{ color: "#9B8EC4", fontSize: 11 }}>
                      {ticket.userType === "passenger" ? "👤" : "🚗"} {ticket.userName || ticket.userPhone || ("#" + ticket.userId)}
                    </Text>
                    <Text style={{ color: "#6B5A8A", fontSize: 11 }}>
                      {new Date(ticket.updatedAt || ticket.createdAt).toLocaleDateString("ar-IQ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Agents Section */}
        {activeTab === "agents" && (() => {
          // ── filter + search ──
          const filteredAgents = (allAgents ?? []).filter((a: any) => {
            const q = agentSearch.trim().toLowerCase();
            if (!q) return true;
            return (
              (a.name ?? '').toLowerCase().includes(q) ||
              (a.phone ?? '').includes(q) ||
              (a.officeAddress ?? '').toLowerCase().includes(q)
            );
          });
          const totalAgentPages = Math.ceil(filteredAgents.length / AGENT_PAGE_SIZE);
          const pagedAgents = filteredAgents.slice(agentPage * AGENT_PAGE_SIZE, (agentPage + 1) * AGENT_PAGE_SIZE);

          const fmtDate = (d: any) => {
            if (!d) return '—';
            const dt = new Date(d);
            const day = dt.getDate().toString().padStart(2, '0');
            const mon = (dt.getMonth() + 1).toString().padStart(2, '0');
            const yr = dt.getFullYear();
            const hr = dt.getHours().toString().padStart(2, '0');
            const mn = dt.getMinutes().toString().padStart(2, '0');
            return `${day}/${mon}/${yr} - ${hr}:${mn}`;
          };

          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💼 إدارة الوكلاء المعتمدين</Text>

              {/* Stats Row */}
              {allAgents && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {[
                    { label: 'الكل', value: allAgents.length, color: '#9B8EC4' },
                    { label: 'قيد المراجعة', value: allAgents.filter((a: any) => a.status === 'pending').length, color: '#F59E0B' },
                    { label: 'معتمدون', value: allAgents.filter((a: any) => a.status === 'approved').length, color: '#22C55E' },
                    { label: 'مرفوضون', value: allAgents.filter((a: any) => a.status === 'rejected').length, color: '#EF4444' },
                  ].map((stat: any) => (
                    <View key={stat.label} style={{ backgroundColor: '#1E0F4A', borderRadius: 10, padding: 10, minWidth: 80, alignItems: 'center', borderWidth: 1, borderColor: stat.color + '44' }}>
                      <Text style={{ color: stat.color, fontSize: 20, fontWeight: '800' }}>{stat.value}</Text>
                      <Text style={{ color: '#9B8EC4', fontSize: 11, marginTop: 2 }}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Search Bar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1035', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#2D1B4E', marginBottom: 10 }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
                <TextInput
                  value={agentSearch}
                  onChangeText={(t) => { setAgentSearch(t); setAgentPage(0); }}
                  placeholder="بحث بالاسم أو الهاتف أو العنوان..."
                  placeholderTextColor="#6B5A8A"
                  style={{ flex: 1, color: '#FFFFFF', fontSize: 13, paddingVertical: 0 }}
                  returnKeyType="search"
                />
                {agentSearch ? (
                  <TouchableOpacity onPress={() => { setAgentSearch(''); setAgentPage(0); }}>
                    <Text style={{ color: '#9B8EC4', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Status Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['all', 'pending', 'approved', 'rejected', 'suspended'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.filterChip, agentStatusFilter === s && styles.filterChipActive]}
                      onPress={() => { setAgentStatusFilter(s); setAgentPage(0); }}
                    >
                      <Text style={[styles.filterChipText, agentStatusFilter === s && styles.filterChipTextActive]}>
                        {s === 'all' ? 'الكل' : s === 'pending' ? 'قيد المراجعة' : s === 'approved' ? 'معتمد' : s === 'rejected' ? 'مرفوض' : 'موقوف'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {agentsLoading ? (
                <ActivityIndicator color="#FFD700" size="large" />
              ) : filteredAgents.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 32 }}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>💼</Text>
                  <Text style={{ color: '#9B8EC4', fontSize: 15 }}>{agentSearch ? 'لا توجد نتائج للبحث' : 'لا يوجد وكلاء'}</Text>
                </View>
              ) : (
                <>
                  {/* Agents List */}
                  {pagedAgents.map((agent: any) => (
                    <TouchableOpacity
                      key={agent.id}
                      style={{ backgroundColor: '#1E0F4A', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2D1B4E' }}
                      onPress={() => { setSelectedAgent(agent); setAgentModalTab('details'); setLedgerFilter('all'); setShowAgentModal(true); }}
                    >
                      {/* Row 1: Name + Status */}
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{agent.name}</Text>
                          <Text style={{ color: '#9B8EC4', fontSize: 13, marginTop: 2 }}>{agent.phone}</Text>
                        </View>
                        <View style={{
                          backgroundColor: agent.status === 'approved' ? '#22C55E22' : agent.status === 'pending' ? '#F59E0B22' : agent.status === 'rejected' ? '#EF444422' : '#6B728022',
                          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8,
                        }}>
                          <Text style={{
                            color: agent.status === 'approved' ? '#22C55E' : agent.status === 'pending' ? '#F59E0B' : agent.status === 'rejected' ? '#EF4444' : '#9CA3AF',
                            fontSize: 12, fontWeight: '700',
                          }}>
                            {agent.status === 'approved' ? '✅ معتمد' : agent.status === 'pending' ? '⏳ قيد المراجعة' : agent.status === 'rejected' ? '❌ مرفوض' : '🚫 موقوف'}
                          </Text>
                        </View>
                      </View>
                      {/* Row 2: Address + Balance */}
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 12 }}>📍 {agent.officeAddress}</Text>
                        {(agent.status === 'approved' || agent.status === 'suspended') && (
                          <Text style={{ color: agent.status === 'approved' ? '#22C55E' : '#F59E0B', fontSize: 13, fontWeight: '700' }}>
                            💰 {Number(agent.balance).toLocaleString('ar-IQ')} د.ع
                          </Text>
                        )}
                      </View>
                      {/* Row 3: Registration Date */}
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2D1B4E', paddingTop: 6, marginTop: 2 }}>
                        <Text style={{ color: '#6B5A8A', fontSize: 11 }}>🗓️ تاريخ التسجيل: </Text>
                        <Text style={{ color: '#9B8EC4', fontSize: 11, fontWeight: '600' }}>{fmtDate(agent.createdAt)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Pagination Controls */}
                  {totalAgentPages > 1 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 4 }}>
                      <TouchableOpacity
                        onPress={() => setAgentPage(p => Math.max(0, p - 1))}
                        disabled={agentPage === 0}
                        style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: agentPage === 0 ? '#1E0F4A' : '#2D1B4E', borderWidth: 1, borderColor: '#3D2B5E', opacity: agentPage === 0 ? 0.4 : 1 }}
                      >
                        <Text style={{ color: '#ECEDEE', fontSize: 14 }}>→ السابق</Text>
                      </TouchableOpacity>

                      <Text style={{ color: '#9B8EC4', fontSize: 13 }}>
                        {agentPage + 1} / {totalAgentPages}
                      </Text>

                      <TouchableOpacity
                        onPress={() => setAgentPage(p => Math.min(totalAgentPages - 1, p + 1))}
                        disabled={agentPage >= totalAgentPages - 1}
                        style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: agentPage >= totalAgentPages - 1 ? '#1E0F4A' : '#2D1B4E', borderWidth: 1, borderColor: '#3D2B5E', opacity: agentPage >= totalAgentPages - 1 ? 0.4 : 1 }}
                      >
                        <Text style={{ color: '#ECEDEE', fontSize: 14 }}>التالي ←</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Results Count */}
                  <Text style={{ color: '#6B5A8A', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 8 }}>
                    عرض {pagedAgents.length} من {filteredAgents.length} وكيل
                  </Text>
                </>
              )}
            </View>
          );
        })()}


        {/* ── Parcels Admin Tab ── */}
        {activeTab === "parcels" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 إدارة الطرود</Text>

            {/* Stats Row */}
            {parcelStats && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'الكل', value: parcelStats.total ?? 0, color: '#9B8EC4' },
                  { label: 'بانتظار', value: parcelStats.pending ?? 0, color: '#F59E0B' },
                  { label: 'نشطة', value: (parcelStats.accepted ?? 0) + (parcelStats.inTransit ?? 0), color: '#6366F1' },
                  { label: 'مسلّمة', value: parcelStats.delivered ?? 0, color: '#22C55E' },
                  { label: 'ملغاة', value: parcelStats.cancelled ?? 0, color: '#EF4444' },
                ].map((stat: any) => (
                  <View key={stat.label} style={{ backgroundColor: '#1E0F4A', borderRadius: 10, padding: 10, minWidth: 70, alignItems: 'center', borderWidth: 1, borderColor: stat.color + '44' }}>
                    <Text style={{ color: stat.color, fontSize: 18, fontWeight: '800' }}>{stat.value}</Text>
                    <Text style={{ color: '#9B8EC4', fontSize: 11, marginTop: 2 }}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Search Bar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1035', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#2D1B4E', marginBottom: 10 }}>
              <Text style={{ fontSize: 14, marginRight: 6 }}>🔍</Text>
              <TextInput
                value={parcelSearch}
                onChangeText={(t) => { setParcelSearch(t); setParcelPage(0); }}
                placeholder="بحث برقم التتبع أو الاسم أو الهاتف..."
                placeholderTextColor="#6B5A8A"
                style={{ flex: 1, color: '#FFFFFF', fontSize: 13, paddingVertical: 0 }}
                returnKeyType="search"
              />
              {parcelSearch ? (
                <TouchableOpacity onPress={() => setParcelSearch('')}>
                  <Text style={{ color: '#9B8EC4', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Status Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {([
                  { id: 'all', label: 'الكل' },
                  { id: 'pending', label: 'بانتظار' },
                  { id: 'accepted', label: 'مقبول' },
                  { id: 'picked_up', label: 'مستلم' },
                  { id: 'in_transit', label: 'في الطريق' },
                  { id: 'delivered', label: 'مسلّم' },
                  { id: 'cancelled', label: 'ملغي' },
                  { id: 'returned', label: 'مُعاد' },
                ] as const).map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: parcelStatusFilter === s.id ? '#FFD700' : '#1E1035', borderWidth: 1, borderColor: parcelStatusFilter === s.id ? '#FFD700' : '#2D1B4E' }}
                    onPress={() => { setParcelStatusFilter(s.id); setParcelPage(0); }}
                  >
                    <Text style={{ color: parcelStatusFilter === s.id ? '#1A0533' : '#9B8EC4', fontSize: 12, fontWeight: '600' }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Type Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {([
                  { id: 'all', label: '🔖 الكل' },
                  { id: 'instant', label: '⚡ فوري' },
                  { id: 'intercity', label: '🚚 بين المدن' },
                ] as const).map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: parcelTypeFilter === t.id ? '#6366F1' : '#1E1035', borderWidth: 1, borderColor: parcelTypeFilter === t.id ? '#6366F1' : '#2D1B4E' }}
                    onPress={() => { setParcelTypeFilter(t.id); setParcelPage(0); }}
                  >
                    <Text style={{ color: parcelTypeFilter === t.id ? '#FFFFFF' : '#9B8EC4', fontSize: 12, fontWeight: '600' }}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>



            {/* Parcels List */}
            {parcelsLoading ? (
              <View style={{ alignItems: 'center', padding: 24 }}>
                <ActivityIndicator size="large" color="#FFD700" />
              </View>
            ) : !adminParcelsData?.parcels || adminParcelsData.parcels.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 32 }}>
                <Text style={{ fontSize: 40 }}>📭</Text>
                <Text style={{ color: '#9B8EC4', fontSize: 15, marginTop: 8 }}>لا توجد طرود</Text>
              </View>
            ) : (
              <>
                {adminParcelsData.parcels.map((parcel: any) => {
                  const STATUS_COLORS: Record<string, string> = {
                    pending: '#F59E0B', accepted: '#3B82F6', picked_up: '#8B5CF6',
                    in_transit: '#6366F1', delivered: '#22C55E', cancelled: '#EF4444', returned: '#6B7280'
                  };
                  const STATUS_LABELS: Record<string, string> = {
                    pending: 'بانتظار الكابتن', accepted: 'تم القبول', picked_up: 'تم الاستلام',
                    in_transit: 'في الطريق', delivered: 'تم التسليم', cancelled: 'ملغي', returned: 'مُعاد'
                  };
                  const TYPE_LABELS: Record<string, string> = {
                    instant: '⚡ فوري', scheduled: '📅 مجدول', intercity: '🚚 بين المدن'
                  };
                  const statusColor = STATUS_COLORS[parcel.status] ?? '#9B8EC4';
                  return (
                    <TouchableOpacity key={parcel.id} activeOpacity={0.85} onPress={() => { setSelectedParcelId(parcel.id); setShowParcelModal(true); }} style={{ backgroundColor: '#1E0F4A', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: statusColor + '44' }}>
                      {/* Header Row */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ backgroundColor: statusColor + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                          <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700' }}>{STATUS_LABELS[parcel.status] ?? parcel.status}</Text>
                        </View>
                        <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700' }}>#{parcel.trackingNumber}</Text>
                      </View>
                      {/* Type & Size */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 12 }}>{TYPE_LABELS[parcel.deliveryType] ?? parcel.deliveryType}</Text>
                        <Text style={{ color: '#9B8EC4', fontSize: 12 }}>
                          {parcel.parcelSize === 'small' ? '📦 صغير' : parcel.parcelSize === 'medium' ? '🗃️ متوسط' : '📫 كبير'}
                        </Text>
                      </View>
                      {/* Addresses */}
                      <View style={{ gap: 4, marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                          <Text style={{ color: '#C4B5D4', fontSize: 12, flex: 1 }} numberOfLines={1}>{parcel.pickupAddress}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                          <Text style={{ color: '#C4B5D4', fontSize: 12, flex: 1 }} numberOfLines={1}>{parcel.dropoffAddress}</Text>
                        </View>
                      </View>
                      {/* Sender / Recipient */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11 }}>📤 {parcel.senderName || parcel.senderPhone}</Text>
                        <Text style={{ color: '#9B8EC4', fontSize: 11 }}>📥 {parcel.recipientName}</Text>
                      </View>
                      {/* Price & Date */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: '#6B5A8A', fontSize: 11 }}>
                          {new Date(parcel.createdAt).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                        {parcel.price && (
                          <Text style={{ color: '#FFD700', fontSize: 13, fontWeight: '700' }}>
                            {Number(parcel.price).toLocaleString()} د.ع
                          </Text>
                        )}
                      </View>
                      {/* Admin Actions */}
                      {parcel.status !== 'delivered' && parcel.status !== 'cancelled' && parcel.status !== 'returned' && (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          {parcel.status === 'pending' && (
                            <TouchableOpacity
                              style={{ backgroundColor: '#EF444422', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#EF4444' }}
                              onPress={() => Alert.alert('إلغاء الطرد', 'هل تريد إلغاء هذا الطرد؟', [
                                { text: 'لا', style: 'cancel' },
                                { text: 'نعم', style: 'destructive', onPress: () => adminUpdateParcelStatus.mutate({ parcelId: parcel.id, status: 'cancelled', updatedBy: 'admin', note: 'إلغاء من الإدارة' }) }
                              ])}
                            >
                              <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>❌ إلغاء</Text>
                            </TouchableOpacity>
                          )}
                          {(parcel.status === 'accepted' || parcel.status === 'picked_up' || parcel.status === 'in_transit') && (
                            <TouchableOpacity
                              style={{ backgroundColor: '#22C55E22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#22C55E' }}
                              onPress={() => Alert.alert('تسليم الطرد', 'هل تريد تعليم هذا الطرد كمُسلَّم؟', [
                                { text: 'لا', style: 'cancel' },
                                { text: 'نعم', onPress: () => adminUpdateParcelStatus.mutate({ parcelId: parcel.id, status: 'delivered', updatedBy: 'admin', note: 'تسليم يدوي من الإدارة' }) }
                              ])}
                            >
                              <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600' }}>✅ تسليم يدوي</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {/* Pagination */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <TouchableOpacity
                    style={{ backgroundColor: parcelPage > 0 ? '#2D1B69' : '#1E0F4A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
                    onPress={() => setParcelPage(p => Math.max(0, p - 1))}
                    disabled={parcelPage === 0}
                  >
                    <Text style={{ color: parcelPage > 0 ? '#FFD700' : '#4A3B6A', fontWeight: '700' }}>→ السابق</Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#9B8EC4', fontSize: 13 }}>صفحة {parcelPage + 1} / {adminParcelsData?.total ? Math.ceil(adminParcelsData.total / PARCEL_PAGE_SIZE) : 1}</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: adminParcelsData.parcels.length >= PARCEL_PAGE_SIZE ? '#2D1B69' : '#1E0F4A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
                    onPress={() => setParcelPage(p => p + 1)}
                    disabled={adminParcelsData.parcels.length < PARCEL_PAGE_SIZE}
                  >
                    <Text style={{ color: adminParcelsData.parcels.length >= PARCEL_PAGE_SIZE ? '#FFD700' : '#4A3B6A', fontWeight: '700' }}>التالي ←</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      {/* Parcel Detail Modal */}
      <Modal
        visible={showParcelModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowParcelModal(false); setSelectedParcelId(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#1A0533', borderRadius: 20, width: '95%', maxHeight: '90%', overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ backgroundColor: '#2D1B4E', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#FFD700', fontSize: 16, fontWeight: '800' }}>📦 تفاصيل الطرد</Text>
              <TouchableOpacity onPress={() => { setShowParcelModal(false); setSelectedParcelId(null); }} style={{ backgroundColor: '#1A0533', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#9B8EC4', fontSize: 18, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            {parcelDetailLoading ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={{ color: '#9B8EC4', marginTop: 12 }}>جاري التحميل...</Text>
              </View>
            ) : !selectedParcelData ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Text style={{ fontSize: 40 }}>❌</Text>
                <Text style={{ color: '#9B8EC4', marginTop: 8 }}>لم يتم العثور على الطرد</Text>
              </View>
            ) : (() => {
              const p = selectedParcelData;
              const STATUS_COLORS_M: Record<string, string> = {
                pending: '#F59E0B', accepted: '#3B82F6', picked_up: '#8B5CF6',
                in_transit: '#6366F1', delivered: '#22C55E', cancelled: '#EF4444', returned: '#6B7280'
              };
              const STATUS_LABELS_M: Record<string, string> = {
                pending: 'بانتظار الكابتن', accepted: 'تم القبول', picked_up: 'تم الاستلام',
                in_transit: 'في الطريق', delivered: 'تم التسليم', cancelled: 'ملغي', returned: 'مُعاد'
              };
              const TYPE_LABELS_M: Record<string, string> = {
                instant: '⚡ فوري داخل المدينة', scheduled: '📅 مجدول', intercity: '🚚 بين المدن'
              };
              const SIZE_LABELS: Record<string, string> = {
                small: '📦 صغير (حتى 2 كغ)', medium: '📦 متوسط (2-10 كغ)', large: '📦 كبير (10-30 كغ)', extra_large: '📦 كبير جداً (30+ كغ)'
              };
              const sc = STATUS_COLORS_M[p.status] ?? '#9B8EC4';
              const formatDate = (d: any) => d ? new Date(d).toLocaleString('ar-IQ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
              return (
                <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                  {/* Tracking & Status */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ backgroundColor: sc + '22', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: sc + '55' }}>
                      <Text style={{ color: sc, fontSize: 13, fontWeight: '800' }}>{STATUS_LABELS_M[p.status] ?? p.status}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#FFD700', fontSize: 14, fontWeight: '800' }}>#{p.trackingNumber}</Text>
                      <Text style={{ color: '#9B8EC4', fontSize: 11, marginTop: 2 }}>{TYPE_LABELS_M[p.deliveryType] ?? p.deliveryType}</Text>
                    </View>
                  </View>

                  {/* Addresses */}
                  <View style={{ backgroundColor: '#0F0628', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2D1B4E' }}>
                    <Text style={{ color: '#9B8EC4', fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>📍 العناوين</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', marginTop: 3 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11, marginBottom: 2 }}>عنوان الاستلام</Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{p.pickupAddress || '—'}</Text>
                        {p.pickupLat && p.pickupLng && (
                          <Text style={{ color: '#6B5A8A', fontSize: 10, marginTop: 2 }}>📌 {Number(p.pickupLat).toFixed(5)}, {Number(p.pickupLng).toFixed(5)}</Text>
                        )}
                      </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: '#2D1B4E', marginBottom: 10 }} />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginTop: 3 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11, marginBottom: 2 }}>عنوان التسليم</Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{p.dropoffAddress || '—'}</Text>
                        {p.dropoffLat && p.dropoffLng && (
                          <Text style={{ color: '#6B5A8A', fontSize: 10, marginTop: 2 }}>📌 {Number(p.dropoffLat).toFixed(5)}, {Number(p.dropoffLng).toFixed(5)}</Text>
                        )}
                        {p.fromCity && p.toCity && (
                          <Text style={{ color: '#9B8EC4', fontSize: 11, marginTop: 2 }}>🏙️ {p.fromCity} → {p.toCity}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Sender & Recipient */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <View style={{ flex: 1, backgroundColor: '#0F0628', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2D1B4E' }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>📤 المُرسِل</Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{p.senderName || '—'}</Text>
                      <Text style={{ color: '#9B8EC4', fontSize: 12, marginTop: 3 }}>{p.senderPhone || '—'}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#0F0628', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#2D1B4E' }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>📥 المُستلِم</Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{p.recipientName || '—'}</Text>
                      <Text style={{ color: '#9B8EC4', fontSize: 12, marginTop: 3 }}>{p.recipientPhone || '—'}</Text>
                    </View>
                  </View>

                  {/* Parcel Details */}
                  <View style={{ backgroundColor: '#0F0628', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2D1B4E' }}>
                    <Text style={{ color: '#9B8EC4', fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>📋 تفاصيل الطرد</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 12 }}>الحجم</Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{SIZE_LABELS[p.parcelSize ?? ''] ?? p.parcelSize ?? '—'}</Text>
                    </View>
                    {p.estimatedWeight && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 12 }}>الوزن التقريبي</Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{p.estimatedWeight} كغ</Text>
                      </View>
                    )}
                    {p.parcelDescription && (
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 12, marginBottom: 4 }}>الوصف</Text>
                        <Text style={{ color: '#C4B5D4', fontSize: 12 }}>{p.parcelDescription}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 12 }}>طريقة الدفع</Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{p.paymentMethod === 'cash' ? '💵 نقدي' : p.paymentMethod === 'wallet' ? '👛 محفظة' : p.paymentMethod ?? '—'}</Text>
                    </View>
                    {p.price && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 12 }}>الأجرة</Text>
                        <Text style={{ color: '#FFD700', fontSize: 14, fontWeight: '800' }}>{Number(p.price).toLocaleString()} د.ع</Text>
                      </View>
                    )}
                  </View>

                  {/* Captain Info */}
                  <View style={{ backgroundColor: '#0F0628', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: p.driverId ? '#9B8EC455' : '#2D1B4E' }}>
                    <Text style={{ color: '#9B8EC4', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>🚗 الكابتن</Text>
                    {p.driverId ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>{(p as any).driverName || 'كابتن'}</Text>
                          <Text style={{ color: '#9B8EC4', fontSize: 12, marginTop: 3 }}>{(p as any).driverPhone || '—'}</Text>
                        </View>
                        <View style={{ backgroundColor: '#22C55E22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>مُعيَّن</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ color: '#F59E0B', fontSize: 13 }}>⏳ لم يُعيَّن كابتن بعد</Text>
                    )}
                  </View>

                  {/* Timeline */}
                  <View style={{ backgroundColor: '#0F0628', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2D1B4E' }}>
                    <Text style={{ color: '#9B8EC4', fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>🕐 سجل الحالات</Text>
                    {[
                      { label: 'تاريخ الطلب', value: formatDate(p.createdAt), icon: '📝', color: '#9B8EC4', always: true },
                      { label: 'تاريخ القبول', value: formatDate(p.acceptedAt), icon: '✅', color: '#3B82F6', always: false },
                      { label: 'تاريخ الاستلام', value: formatDate(p.pickedUpAt), icon: '📦', color: '#8B5CF6', always: false },
                      { label: 'تاريخ التسليم', value: formatDate(p.deliveredAt), icon: '🎉', color: '#22C55E', always: false },
                    ].filter(e => e.always || e.value !== '—').map((event, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: event.color + '22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: event.color + '55' }}>
                          <Text style={{ fontSize: 13 }}>{event.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#9B8EC4', fontSize: 11 }}>{event.label}</Text>
                          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginTop: 2 }}>{event.value}</Text>
                        </View>
                      </View>
                    ))}
                    {p.cancelReason && (
                      <View style={{ backgroundColor: '#EF444422', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#EF444455', marginTop: 4 }}>
                        <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>❌ سبب الإلغاء</Text>
                        <Text style={{ color: '#FCA5A5', fontSize: 12 }}>{p.cancelReason}</Text>
                      </View>
                    )}
                  </View>

                  {/* Admin Actions */}
                  {p.status !== 'delivered' && p.status !== 'cancelled' && p.status !== 'returned' && (
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                      {p.status === 'pending' && (
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: '#EF444422', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EF4444' }}
                          onPress={() => Alert.alert('إلغاء الطرد', 'هل تريد إلغاء هذا الطرد؟', [
                            { text: 'لا', style: 'cancel' },
                            { text: 'نعم', style: 'destructive', onPress: () => { adminUpdateParcelStatus.mutate({ parcelId: p.id, status: 'cancelled', updatedBy: 'admin', note: 'إلغاء من الإدارة' }); setShowParcelModal(false); } }
                          ])}
                        >
                          <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700' }}>❌ إلغاء الطرد</Text>
                        </TouchableOpacity>
                      )}
                      {(p.status === 'accepted' || p.status === 'picked_up' || p.status === 'in_transit') && (
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: '#22C55E22', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#22C55E' }}
                          onPress={() => Alert.alert('تسليم الطرد', 'هل تريد تعليم هذا الطرد كمُسلَّم؟', [
                            { text: 'لا', style: 'cancel' },
                            { text: 'نعم', onPress: () => { adminUpdateParcelStatus.mutate({ parcelId: p.id, status: 'delivered', updatedBy: 'admin', note: 'تسليم يدوي من الإدارة' }); setShowParcelModal(false); } }
                          ])}
                        >
                          <Text style={{ color: '#22C55E', fontSize: 14, fontWeight: '700' }}>✅ تسليم يدوي</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  <View style={{ height: 20 }} />
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Support Chat Modal */}
      <Modal
        visible={showSupportChatModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowSupportChatModal(false); setAdminReplyText(""); }}
      >
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: "#1A0533", borderRadius: 20, width: "95%", maxHeight: "88%", overflow: "hidden" }}>
            {/* Modal Header */}
            <View style={{ backgroundColor: "#2D1B4E", padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFD700", fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
                  💬 {selectedTicketSubject}
                </Text>
              </View>
              {/* Status Buttons */}
              <View style={{ flexDirection: "row", gap: 6 }}>
                {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={{
                      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                      backgroundColor: s === "open" ? "#F59E0B22" : s === "in_progress" ? "#3B82F622" : s === "resolved" ? "#10B98122" : "#6B728022",
                    }}
                    onPress={() => {
                      if (selectedSupportTicketId) {
                        updateSupportStatusMutation.mutate({ ticketId: selectedSupportTicketId, status: s, closedBy: "admin" });
                      }
                    }}
                  >
                    <Text style={{
                      fontSize: 10, fontWeight: "700",
                      color: s === "open" ? "#F59E0B" : s === "in_progress" ? "#3B82F6" : s === "resolved" ? "#10B981" : "#6B7280",
                    }}>
                      {s === "open" ? "مفتوح" : s === "in_progress" ? "معالجة" : s === "resolved" ? "محلول" : "مغلق"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => { setShowSupportChatModal(false); setAdminReplyText(""); }}>
                <Text style={{ color: "#9B8EC4", fontSize: 22 }}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView style={{ flex: 1, padding: 12 }} showsVerticalScrollIndicator={false}>
              {supportMsgsLoading ? (
                <ActivityIndicator color="#FFD700" style={{ marginTop: 20 }} />
              ) : !supportMessages || (supportMessages as any[]).length === 0 ? (
                <Text style={{ color: "#9B8EC4", textAlign: "center", marginTop: 20 }}>لا توجد رسائل</Text>
              ) : (
                (supportMessages as any[]).map((msg: any) => (
                  <View
                    key={msg.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: msg.senderType === "admin" ? "flex-end" : "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        maxWidth: "75%",
                        backgroundColor: msg.senderType === "admin" ? "#7C3AED" : "#2D1B4E",
                        borderRadius: 14,
                        padding: 10,
                        borderBottomRightRadius: msg.senderType === "admin" ? 4 : 14,
                        borderBottomLeftRadius: msg.senderType === "admin" ? 14 : 4,
                      }}
                    >
                      {msg.senderType !== "admin" && (
                        <Text style={{ color: "#FFD700", fontSize: 11, fontWeight: "700", marginBottom: 3 }}>
                          {msg.senderName || "المستخدم"}
                        </Text>
                      )}
                      {msg.imageUrl ? (
                        <Image
                          source={{ uri: msg.imageUrl }}
                          style={{ width: 200, height: 150, borderRadius: 10, marginBottom: msg.message ? 6 : 0 }}
                          resizeMode="cover"
                        />
                      ) : null}
                      {msg.message ? (
                        <Text style={{ color: "#FFFFFF", fontSize: 13, lineHeight: 19 }}>{msg.message}</Text>
                      ) : null}
                      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, alignSelf: "flex-end", marginTop: 3 }}>
                        {new Date(msg.createdAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Quick Replies */}
            <View style={{ paddingHorizontal: 12, paddingTop: 10, gap: 6 }}>
              <Text style={{ color: "#9B8EC4", fontSize: 11, fontWeight: "700", marginBottom: 4 }}>ردود جاهزة:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  "تم استلام طلبك، سيتم مراجعته خلال 24 ساعة إن شاء الله",
                  "شكراً على تواصلك، تم حل المشكلة بنجاح ✔️",
                  "يرجى تزويدنا بمزيد من التفاصيل حتى نتمكن من مساعدتك",
                  "تم تحويل طلبك إلى الفريق المختص، سيتواصلون معك قريباً",
                  "نعتذر عن الإزعاج، سنعمل على حل المشكلة فوراً",
                  "تم استرداد المبلغ بنجاح إلى حسابك",
                  "هل تحتاج إلى مساعدة إضافية؟",
                ].map((reply, i) => (
                  <TouchableOpacity
                    key={i}
                    style={{
                      backgroundColor: "#2D1B4E", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7,
                      borderWidth: 1, borderColor: "#3D2070",
                    }}
                    onPress={() => setAdminReplyText(reply)}
                  >
                    <Text style={{ color: "#C4B5FD", fontSize: 12 }}>{reply}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Reply Input */}
            <View style={{ flexDirection: "row", padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: "#2D1B4E", marginTop: 8 }}>
              <TextInput
                style={{
                  flex: 1, backgroundColor: "#2D1B4E", borderRadius: 20,
                  paddingHorizontal: 14, paddingVertical: 10, color: "#FFFFFF", fontSize: 14,
                }}
                value={adminReplyText}
                onChangeText={setAdminReplyText}
                placeholder="اكتب ردك..."
                placeholderTextColor="#6B5A8A"
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: adminReplyText.trim() ? "#7C3AED" : "#2D1B4E",
                  alignItems: "center", justifyContent: "center",
                }}
                disabled={!adminReplyText.trim() || sendSupportReplyMutation.isPending}
                onPress={async () => {
                  if (!selectedSupportTicketId || !adminReplyText.trim()) return;
                  const text = adminReplyText.trim();
                  setAdminReplyText("");
                  try {
                    await sendSupportReplyMutation.mutateAsync({
                      ticketId: selectedSupportTicketId,
                      senderType: "admin",
                      senderName: "فريق الدعم",
                      message: text,
                    });
                  } catch (e) {
                    setAdminReplyText(text);
                    Alert.alert("خطأ", "فشل إرسال الرسالة");
                  }
                }}
              >
                {sendSupportReplyMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>↑</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block Driver Modal */}
      {/* Unblock Confirmation Modal */}
      <Modal visible={showUnblockModal} transparent animationType="fade" onRequestClose={() => setShowUnblockModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#1e0a3c', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'right' }}>✅ تفعيل الحساب</Text>
            <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 24, textAlign: 'right' }}>هل تريد تفعيل حساب {unblockTargetDriver?.name}؟</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#22C55E', borderRadius: 10, padding: 12, alignItems: 'center' }}
                onPress={() => {
                  if (unblockTargetDriver) {
                    blockDriver.mutate(
                      { driverId: unblockTargetDriver.id, isBlocked: false },
                    );
                  }
                  setShowUnblockModal(false);
                  setUnblockTargetDriver(null);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>تفعيل</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#333', borderRadius: 10, padding: 12, alignItems: 'center' }}
                onPress={() => { setShowUnblockModal(false); setUnblockTargetDriver(null); }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block Modal */}
      <Modal visible={showBlockModal} transparent animationType="fade" onRequestClose={() => setShowBlockModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#1e0a3c', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'right' }}>🚫 تعطيل الحساب</Text>
            <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 16, textAlign: 'right' }}>سبب تعطيل حساب {blockTargetDriver?.name} (اختياري):</Text>
            <TextInput
              value={blockReasonInput}
              onChangeText={setBlockReasonInput}
              placeholder="اكتب سبب التعطيل..."
              placeholderTextColor="#888"
              style={{ backgroundColor: '#2a1050', color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, textAlign: 'right', marginBottom: 20, borderWidth: 1, borderColor: '#4a2080' }}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 10, padding: 12, alignItems: 'center' }}
                onPress={() => {
                  if (blockTargetDriver) {
                    blockDriver.mutate({ driverId: blockTargetDriver.id, isBlocked: true, blockReason: blockReasonInput || undefined });
                  }
                  setShowBlockModal(false);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>تعطيل</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#333', borderRadius: 10, padding: 12, alignItems: 'center' }}
                onPress={() => setShowBlockModal(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Passenger Block Modal ─────────────────────────────────── */}
      <Modal visible={showPassengerBlockModal} transparent animationType="fade" onRequestClose={() => setShowPassengerBlockModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#1A0533', borderRadius: 16, padding: 20, width: '88%' }}>
            <Text style={{ color: '#FFD700', fontSize: 16, fontWeight: '800', marginBottom: 8, textAlign: 'right' }}>🚫 حظر المستخدم</Text>
            <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 12, textAlign: 'right' }}>سيتم تعطيل حساب {blockTargetPassenger?.name} فوراً.</Text>
            <Text style={{ color: '#9B8EC4', fontSize: 12, marginBottom: 6, textAlign: 'right' }}>سبب الحظر (اختياري)</Text>
            <TextInput
              style={{ backgroundColor: '#2D1B4E', color: '#ECEDEE', borderRadius: 8, padding: 10, marginBottom: 16, textAlign: 'right', fontSize: 13 }}
              placeholder="مثال: انتهاك السياسات..."
              placeholderTextColor="#9B8EC4"
              value={passengerBlockReasonInput}
              onChangeText={setPassengerBlockReasonInput}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => {
                  if (blockTargetPassenger) {
                    blockPassenger.mutate({ passengerId: blockTargetPassenger.id, isBlocked: true, blockReason: passengerBlockReasonInput || undefined });
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>🚫 تأكيد الحظر</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#2D1B4E', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => { setShowPassengerBlockModal(false); setPassengerBlockReasonInput(""); }}
              >
                <Text style={{ color: '#ccc', fontWeight: '700' }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* ─── Passenger Unblock Modal ──────────────────────────────────── */}
      <Modal visible={showPassengerUnblockModal} transparent animationType="fade" onRequestClose={() => setShowPassengerUnblockModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#1A0533', borderRadius: 16, padding: 20, width: '88%' }}>
            <Text style={{ color: '#FFD700', fontSize: 16, fontWeight: '800', marginBottom: 8, textAlign: 'right' }}>✅ تفعيل المستخدم</Text>
            <Text style={{ color: '#ccc', fontSize: 13, marginBottom: 20, textAlign: 'right' }}>هل تريد إعادة تفعيل حساب {unblockTargetPassenger?.name}؟</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#22C55E', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => {
                  if (unblockTargetPassenger) {
                    blockPassenger.mutate({ passengerId: unblockTargetPassenger.id, isBlocked: false });
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>✅ تفعيل الحساب</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#2D1B4E', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => setShowPassengerUnblockModal(false)}
              >
                <Text style={{ color: '#ccc', fontWeight: '700' }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Agent Detail Modal */}
      <Modal visible={showAgentModal} transparent animationType="slide" onRequestClose={() => setShowAgentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#1A0533', borderRadius: 20, padding: 20, width: '92%', maxHeight: '88%' }}>
            <Text style={{ color: '#FFD700', fontSize: 16, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
              {selectedAgent?.name}
            </Text>
            {/* Tabs */}
            <View style={{ flexDirection: 'row-reverse', backgroundColor: '#2D1B4E', borderRadius: 10, padding: 3, marginBottom: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: agentModalTab === 'details' ? '#7C3AED' : 'transparent' }}
                onPress={() => setAgentModalTab('details')}
              >
                <Text style={{ color: agentModalTab === 'details' ? '#fff' : '#9B8EC4', fontWeight: '700', fontSize: 13 }}>📋 التفاصيل</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: agentModalTab === 'ledger' ? '#7C3AED' : 'transparent' }}
                onPress={() => setAgentModalTab('ledger')}
              >
                <Text style={{ color: agentModalTab === 'ledger' ? '#fff' : '#9B8EC4', fontWeight: '700', fontSize: 13 }}>💰 السجل المالي</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedAgent && (
                <>
                  {/* ─── Tab: Details ─── */}
                  {agentModalTab === 'details' && (<>
                  {/* Status */}
                  <View style={{ backgroundColor: '#2D1B4E', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 13 }}>الحالة:</Text>
                      <Text style={{ color: selectedAgent.status === 'approved' ? '#22C55E' : selectedAgent.status === 'pending' ? '#F59E0B' : '#EF4444', fontWeight: '700' }}>
                        {selectedAgent.status === 'approved' ? '✅ معتمد' : selectedAgent.status === 'pending' ? '⏳ قيد المراجعة' : selectedAgent.status === 'rejected' ? '❌ مرفوض' : '🚫 موقوف'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 13 }}>الاسم:</Text>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{selectedAgent.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 13 }}>الهاتف:</Text>
                      <Text style={{ color: '#fff' }}>{selectedAgent.phone}</Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 13 }}>العنوان:</Text>
                      <Text style={{ color: '#fff', flex: 1, textAlign: 'right', marginRight: 8 }}>{selectedAgent.officeAddress}</Text>
                    </View>
                    {(selectedAgent.status === 'approved' || selectedAgent.status === 'suspended') && (
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 13 }}>الرصيد:</Text>
                        <Text style={{ color: selectedAgent.status === 'approved' ? '#22C55E' : '#F59E0B', fontWeight: '800', fontSize: 16 }}>
                          {Number(selectedAgent.balance).toLocaleString('ar-IQ')} د.ع
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Documents */}
                  <Text style={{ color: '#9B8EC4', fontSize: 13, fontWeight: '700', marginBottom: 8, textAlign: 'right' }}>الوثائق:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {[
                      { key: 'facePhotoUrl', label: 'بصمة الوجه' },
                      { key: 'idFrontUrl', label: 'هوية أمامية' },
                      { key: 'idBackUrl', label: 'هوية خلفية' },
                      { key: 'officePhotoUrl', label: 'صورة المكتب' },
                    ].map(doc => selectedAgent[doc.key] ? (
                      <View key={doc.key} style={{ alignItems: 'center' }}>
                        <Image source={{ uri: selectedAgent[doc.key] }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                        <Text style={{ color: '#9B8EC4', fontSize: 10, marginTop: 2 }}>{doc.label}</Text>
                      </View>
                    ) : null)}
                  </View>

                  {/* Topup */}
                  {selectedAgent.status === 'approved' && (
                    <View style={{ backgroundColor: '#2D1B4E', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                      <Text style={{ color: '#FFD700', fontSize: 14, fontWeight: '700', marginBottom: 8, textAlign: 'right' }}>💰 شحن رصيد الوكيل</Text>
                      <TextInput
                        value={agentTopupAmount}
                        onChangeText={setAgentTopupAmount}
                        placeholder="المبلغ بالدينار العراقي"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        style={{ backgroundColor: '#1A0533', color: '#fff', borderRadius: 8, padding: 10, fontSize: 14, textAlign: 'right', marginBottom: 8, borderWidth: 1, borderColor: '#4a2080' }}
                      />
                      <TouchableOpacity
                        style={{ backgroundColor: '#22C55E', borderRadius: 10, padding: 12, alignItems: 'center' }}
                        disabled={agentTopupLoading}
                        onPress={() => {
                          const amt = parseFloat(agentTopupAmount);
                          if (!amt || amt <= 0) {
                            showConfirm({ title: 'خطأ', message: 'أدخل مبلغاً صحيحاً أكبر من صفر', confirmText: 'حسناً', confirmColor: '#6366F1', onConfirm: hideConfirm });
                            return;
                          }
                          showConfirm({
                            title: 'تأكيد شحن الرصيد',
                            message: `هل تريد شحن ${amt.toLocaleString('ar-IQ')} د.ع لحساب الوكيل ${selectedAgent.name}؟`,
                            confirmText: '✅ تأكيد الشحن',
                            confirmColor: '#22C55E',
                            onConfirm: async () => {
                              hideConfirm();
                              setAgentTopupLoading(true);
                              try {
                                await topupAgentMutation.mutateAsync({ agentId: selectedAgent.id, amount: amt });
                                setAgentTopupAmount('');
                                setShowAgentModal(false);
                              } catch (e: any) {
                                showConfirm({ title: 'خطأ', message: (e as any).message ?? 'حدث خطأ أثناء الشحن', confirmText: 'حسناً', confirmColor: '#6366F1', onConfirm: hideConfirm });
                              }
                              setAgentTopupLoading(false);
                            },
                          });
                        }}
                      >
                        {agentTopupLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>شحن الرصيد</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={{ gap: 8 }}>
                    {selectedAgent.status === 'pending' && (
                      <>
                        <TouchableOpacity
                          style={{ backgroundColor: '#22C55E', borderRadius: 10, padding: 12, alignItems: 'center' }}
                          onPress={() => {
                            approveAgentMutation.mutate({ agentId: selectedAgent.id });
                            setShowAgentModal(false);
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>✅ قبول الطلب</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ backgroundColor: '#EF4444', borderRadius: 10, padding: 12, alignItems: 'center' }}
                          onPress={() => { setShowAgentRejectModal(true); }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700' }}>❌ رفض الطلب</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {selectedAgent.status === 'approved' && (
                      <TouchableOpacity
                        style={{ backgroundColor: '#F59E0B', borderRadius: 10, padding: 12, alignItems: 'center' }}
                        onPress={() => {
                          showConfirm({
                            title: '⚠️ تأكيد إيقاف الحساب',
                            message: `هل تريد إيقاف حساب الوكيل ${selectedAgent.name} مؤقتاً؟\nلن يتمكن من الوصول إلى التطبيق حتى إعادة التفعيل.`,
                            confirmText: '🚫 إيقاف الحساب',
                            confirmColor: '#F59E0B',
                            onConfirm: () => {
                              hideConfirm();
                              suspendAgentMutation.mutate({ agentId: selectedAgent.id });
                              setShowAgentModal(false);
                            },
                          });
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700' }}>🚫 إيقاف الحساب</Text>
                      </TouchableOpacity>
                    )}
                    {selectedAgent.status === 'suspended' && (
                      <TouchableOpacity
                        style={{ backgroundColor: '#22C55E', borderRadius: 10, padding: 12, alignItems: 'center' }}
                        onPress={() => {
                          showConfirm({
                            title: '✅ تأكيد إعادة التفعيل',
                            message: `هل تريد إعادة تفعيل حساب الوكيل ${selectedAgent.name}؟\nسيتمكن من الوصول إلى التطبيق ومزاولة نشاطه مجدداً.`,
                            confirmText: '✅ إعادة التفعيل',
                            confirmColor: '#22C55E',
                            onConfirm: () => {
                              hideConfirm();
                              approveAgentMutation.mutate({ agentId: selectedAgent.id });
                              setShowAgentModal(false);
                            },
                          });
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700' }}>✅ إعادة تفعيل</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={{ backgroundColor: '#333', borderRadius: 10, padding: 12, alignItems: 'center' }}
                      onPress={() => setShowAgentModal(false)}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700' }}>إغلاق</Text>
                    </TouchableOpacity>
                  </View>
                  </>)}

                  {/* ─── Tab: Ledger ─── */}
                  {agentModalTab === 'ledger' && (
                    <View>
                      {/* Filter Tabs */}
                      <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 12 }}>
                        {([['all', 'الكل'], ['admin_topup', 'شحن من الإدارة'], ['recharge', 'شحن للعملاء']] as const).map(([key, label]) => (
                          <TouchableOpacity
                            key={key}
                            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: ledgerFilter === key ? '#7C3AED' : '#2D1B4E' }}
                            onPress={() => setLedgerFilter(key)}
                          >
                            <Text style={{ color: ledgerFilter === key ? '#fff' : '#9B8EC4', fontSize: 12, fontWeight: '600' }}>{label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {ledgerLoading ? (
                        <ActivityIndicator color="#7C3AED" style={{ marginTop: 20 }} />
                      ) : !agentLedger || agentLedger.length === 0 ? (
                        <Text style={{ color: '#9B8EC4', textAlign: 'center', marginTop: 20 }}>لا توجد حركات مالية</Text>
                      ) : (
                        agentLedger
                          .filter(item => ledgerFilter === 'all' || item.type === ledgerFilter)
                          .map((item) => (
                            <View key={item.id} style={{ backgroundColor: '#2D1B4E', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                              {/* Row 1: Type badge + Amount */}
                              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <View style={{ backgroundColor: item.type === 'admin_topup' ? '#14532D' : '#1E3A5F', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                                  <Text style={{ color: item.type === 'admin_topup' ? '#4ADE80' : '#60A5FA', fontSize: 11, fontWeight: '700' }}>
                                    {item.type === 'admin_topup' ? '⬆️ شحن من الإدارة' : '⬇️ شحن لعميل'}
                                  </Text>
                                </View>
                                <Text style={{ color: item.type === 'admin_topup' ? '#4ADE80' : '#F87171', fontWeight: '800', fontSize: 15 }}>
                                  {item.type === 'admin_topup' ? '+' : '-'}{item.amount.toLocaleString('ar-IQ')} د.ع
                                </Text>
                              </View>
                              {/* Row 2: Recipient (for recharge) */}
                              {item.type === 'recharge' && item.recipientName && (
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text style={{ color: '#9B8EC4', fontSize: 12 }}>المستفيد:</Text>
                                  <Text style={{ color: '#fff', fontSize: 12 }}>
                                    {item.recipientName} ({item.recipientType === 'driver' ? 'سائق' : 'مستخدم'})
                                  </Text>
                                </View>
                              )}
                              {item.type === 'recharge' && item.recipientPhone && (
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text style={{ color: '#9B8EC4', fontSize: 12 }}>الهاتف:</Text>
                                  <Text style={{ color: '#fff', fontSize: 12 }}>{item.recipientPhone}</Text>
                                </View>
                              )}
                              {/* Row 3: Balance before/after */}
                              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ color: '#9B8EC4', fontSize: 11 }}>رصيد قبل/بعد:</Text>
                                <Text style={{ color: '#ccc', fontSize: 11 }}>
                                  {item.balanceBefore.toLocaleString('ar-IQ')} → {item.balanceAfter.toLocaleString('ar-IQ')} د.ع
                                </Text>
                              </View>
                              {/* Row 4: Notes */}
                              {item.notes ? (
                                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text style={{ color: '#9B8EC4', fontSize: 11 }}>ملاحظة:</Text>
                                  <Text style={{ color: '#ccc', fontSize: 11, flex: 1, textAlign: 'right', marginRight: 6 }}>{item.notes}</Text>
                                </View>
                              ) : null}
                              {/* Row 5: Date */}
                              <Text style={{ color: '#6B7280', fontSize: 11, textAlign: 'left', marginTop: 2 }}>
                                {new Date(item.createdAt).toLocaleString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                          ))
                      )}
                      <TouchableOpacity
                        style={{ backgroundColor: '#333', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 }}
                        onPress={() => setShowAgentModal(false)}
                      >
                        <Text style={{ color: '#fff', fontWeight: '700' }}>إغلاق</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Agent Reject Reason Modal */}
      <Modal visible={showAgentRejectModal} transparent animationType="fade" onRequestClose={() => setShowAgentRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#1e0a3c', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'right' }}>❌ رفض طلب الوكيل</Text>
            <TextInput
              value={agentRejectReason}
              onChangeText={setAgentRejectReason}
              placeholder="سبب الرفض (اختياري)..."
              placeholderTextColor="#888"
              style={{ backgroundColor: '#2a1050', color: '#fff', borderRadius: 10, padding: 12, fontSize: 14, textAlign: 'right', marginBottom: 20, borderWidth: 1, borderColor: '#4a2080' }}
              multiline numberOfLines={3}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 10, padding: 12, alignItems: 'center' }}
                onPress={() => {
                  if (selectedAgent) {
                    rejectAgentMutation.mutate({ agentId: selectedAgent.id, rejectionReason: agentRejectReason || "" });
                  }
                  setShowAgentRejectModal(false);
                  setShowAgentModal(false);
                  setAgentRejectReason('');
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>رفض</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#333', borderRadius: 10, padding: 12, alignItems: 'center' }}
                onPress={() => setShowAgentRejectModal(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Driver Ride History Modal */}
      <Modal visible={!!historyDriverId} transparent animationType="slide" onRequestClose={() => setHistoryDriverId(null)}>
        <View style={styles.modalOverlay}>
          <View style={{ backgroundColor: '#0D0A1E', borderRadius: 20, padding: 0, width: '95%', maxHeight: '88%', overflow: 'hidden' }}>
            {/* Header */}
            <View style={{ backgroundColor: '#1A0533', padding: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
              <Text style={{ color: '#FFD700', fontSize: 16, fontWeight: '800', textAlign: 'center' }}>
                📋 سجل رحلات {historyDriverName || 'السائق'}
              </Text>
              <Text style={{ color: '#9B8EC4', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                {historyDriverPhone} {historyDriverModel ? `• ${historyDriverModel}` : ''}
              </Text>
            </View>
            {/* Tabs */}
            <View style={{ flexDirection: 'row', backgroundColor: '#120828', borderBottomWidth: 1, borderBottomColor: '#2D1B4E' }}>
              {([{ key: 'city', label: '🚗 داخل المدن' }, { key: 'intercity', label: '🛮 بين المدن' }, { key: 'parcels', label: '📦 الطرود' }] as const).map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: historyTabState === tab.key ? '#FFD700' : 'transparent' }}
                  onPress={() => setHistoryTabState(tab.key)}
                >
                  <Text style={{ color: historyTabState === tab.key ? '#FFD700' : '#9B8EC4', fontSize: 12, fontWeight: historyTabState === tab.key ? '700' : '400' }}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
              {/* City Rides Tab */}
              {historyTabState === 'city' && (
                cityRidesLoading ? <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} /> :
                !driverCityRides || driverCityRides.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingTop: 40 }}>
                    <Text style={{ fontSize: 40 }}>🚗</Text>
                    <Text style={{ color: '#9B8EC4', marginTop: 8 }}>لا توجد رحلات داخل المدن</Text>
                  </View>
                ) : driverCityRides.map((ride, idx) => (
                  <View key={ride.id} style={{ backgroundColor: '#1A0533', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: ride.status === 'completed' ? '#22C55E33' : ride.status === 'cancelled' ? '#EF444433' : '#2D1B4E' }}>
                    {/* Row 1: ID + Status + Date */}
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: '700' }}>#رحلة {ride.id}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ backgroundColor: ride.status === 'completed' ? '#14532D' : ride.status === 'cancelled' ? '#450A0A' : '#1E3A5F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ color: ride.status === 'completed' ? '#4ADE80' : ride.status === 'cancelled' ? '#F87171' : '#60A5FA', fontSize: 10, fontWeight: '700' }}>
                            {ride.status === 'completed' ? '✅ مكتملة' : ride.status === 'cancelled' ? '❌ ملغاة' : ride.status === 'in_progress' ? '⏳ جارية' : '• ' + ride.status}
                          </Text>
                        </View>
                        <Text style={{ color: '#6B5A8A', fontSize: 10 }}>{new Date(ride.createdAt).toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                    </View>
                    {/* Row 2: Passenger */}
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 11, marginLeft: 6 }}>👤 الراكب:</Text>
                      <Text style={{ color: '#fff', fontSize: 11 }}>{(ride as any).passengerName || 'غير معروف'} {(ride as any).passengerPhone ? `(${(ride as any).passengerPhone})` : ''}</Text>
                    </View>
                    {/* Row 3: Route */}
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ color: '#60A5FA', fontSize: 11, textAlign: 'right' }}>📍 من: {ride.pickupAddress || `${ride.pickupLat}, ${ride.pickupLng}`}</Text>
                      <Text style={{ color: '#F472B6', fontSize: 11, textAlign: 'right', marginTop: 2 }}>🏁 إلى: {ride.dropoffAddress || `${ride.dropoffLat}, ${ride.dropoffLng}`}</Text>
                    </View>
                    {/* Row 4: Financial */}
                    <View style={{ backgroundColor: 'rgba(255,215,0,0.05)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#2D1B4E' }}>
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11 }}>💰 أجرة الرحلة:</Text>
                        <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: '700' }}>{ride.fare ? `${Math.round(parseFloat(ride.fare.toString())).toLocaleString('ar-IQ')} د.ع` : 'غير محدد'}</Text>
                      </View>
                      {(ride as any).walletTx ? (
                        <>
                          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: '#9B8EC4', fontSize: 11 }}>🟥 عمولة الشركة (10%):</Text>
                            <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>- {Math.round(parseFloat((ride as any).walletTx.amount)).toLocaleString('ar-IQ')} د.ع</Text>
                          </View>
                          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: '#9B8EC4', fontSize: 11 }}>📊 رصيد قبل الرحلة:</Text>
                            <Text style={{ color: '#60A5FA', fontSize: 11 }}>{(ride as any).walletTx.balanceBefore ? `${Math.round(parseFloat((ride as any).walletTx.balanceBefore)).toLocaleString('ar-IQ')} د.ع` : 'غير متاح'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#9B8EC4', fontSize: 11 }}>📊 رصيد بعد الرحلة:</Text>
                            <Text style={{ color: '#22C55E', fontSize: 11 }}>{(ride as any).walletTx.balanceAfter ? `${Math.round(parseFloat((ride as any).walletTx.balanceAfter)).toLocaleString('ar-IQ')} د.ع` : 'غير متاح'}</Text>
                          </View>
                        </>
                      ) : (
                        <Text style={{ color: '#6B5A8A', fontSize: 10, textAlign: 'center', marginTop: 4 }}>لا توجد معاملة محفظة مسجلة</Text>
                      )}
                    </View>
                    {ride.estimatedDistance && (
                      <Text style={{ color: '#6B5A8A', fontSize: 10, textAlign: 'right', marginTop: 4 }}>📐 المسافة: {parseFloat(ride.estimatedDistance.toString()).toFixed(1)} كم</Text>
                    )}
                  </View>
                ))
              )}
              {/* Intercity Trips Tab */}
              {historyTabState === 'intercity' && (
                intercityTripsLoading ? <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} /> :
                !driverIntercityTrips || driverIntercityTrips.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingTop: 40 }}>
                    <Text style={{ fontSize: 40 }}>🛮</Text>
                    <Text style={{ color: '#9B8EC4', marginTop: 8 }}>لا توجد رحلات بين المدن</Text>
                  </View>
                ) : driverIntercityTrips.map((trip) => (
                  <View key={trip.id} style={{ backgroundColor: '#1A0533', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: trip.status === 'completed' ? '#22C55E33' : trip.status === 'cancelled' ? '#EF444433' : '#2D1B4E' }}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: '700' }}>🛮 {trip.fromCity} ← {trip.toCity}</Text>
                      <View style={{ backgroundColor: trip.status === 'completed' ? '#14532D' : trip.status === 'cancelled' ? '#450A0A' : '#1E3A5F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: trip.status === 'completed' ? '#4ADE80' : trip.status === 'cancelled' ? '#F87171' : '#60A5FA', fontSize: 10, fontWeight: '700' }}>
                          {trip.status === 'completed' ? '✅ مكتملة' : trip.status === 'cancelled' ? '❌ ملغاة' : trip.status === 'scheduled' ? '🗓️ مجدولة' : '⏳ جارية'}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: '#9B8EC4', fontSize: 11, textAlign: 'right', marginBottom: 4 }}>🗓️ {new Date(trip.departureTime).toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 11 }}>👥 الركاب: {(trip as any).confirmedBookings}/{trip.totalSeats} مقعد</Text>
                      <Text style={{ color: '#9B8EC4', fontSize: 11 }}>💵 سعر المقعد: {Math.round(parseFloat(trip.pricePerSeat.toString())).toLocaleString('ar-IQ')} د.ع</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(255,215,0,0.05)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#2D1B4E' }}>
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11 }}>💰 إجمالي الإيرادات:</Text>
                        <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: '700' }}>{((trip as any).totalEarnings || 0).toLocaleString('ar-IQ')} د.ع</Text>
                      </View>
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11 }}>🟥 عمولة الشركة (10%):</Text>
                        <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>- {((trip as any).commission || 0).toLocaleString('ar-IQ')} د.ع</Text>
                      </View>
                    </View>
                    {(trip as any).passengers && (trip as any).passengers.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ color: '#9B8EC4', fontSize: 11, textAlign: 'right', marginBottom: 4 }}>👥 قائمة الركاب:</Text>
                        {(trip as any).passengers.map((p: any, i: number) => (
                          <Text key={i} style={{ color: '#ccc', fontSize: 10, textAlign: 'right', marginBottom: 2 }}>• {p.name || 'غير معروف'} ({p.phone}) - {p.seats} مقعد - {Math.round(parseFloat(p.price || '0')).toLocaleString('ar-IQ')} د.ع</Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))
              )}
              {/* Parcels Tab */}
              {historyTabState === 'parcels' && (
                parcelHistoryLoading ? <ActivityIndicator color="#FFD700" style={{ marginTop: 40 }} /> :
                !driverParcelHistory || driverParcelHistory.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingTop: 40 }}>
                    <Text style={{ fontSize: 40 }}>📦</Text>
                    <Text style={{ color: '#9B8EC4', marginTop: 8 }}>لا توجد طرود مسجلة</Text>
                  </View>
                ) : driverParcelHistory.map((parcel) => (
                  <View key={parcel.id} style={{ backgroundColor: '#1A0533', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: parcel.status === 'delivered' ? '#22C55E33' : parcel.status === 'cancelled' ? '#EF444433' : '#2D1B4E' }}>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: '700' }}>📦 #{parcel.trackingNumber}</Text>
                      <View style={{ backgroundColor: parcel.status === 'delivered' ? '#14532D' : parcel.status === 'cancelled' ? '#450A0A' : '#1E3A5F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: parcel.status === 'delivered' ? '#4ADE80' : parcel.status === 'cancelled' ? '#F87171' : '#60A5FA', fontSize: 10, fontWeight: '700' }}>
                          {parcel.status === 'delivered' ? '✅ مسلم' : parcel.status === 'cancelled' ? '❌ ملغى' : parcel.status === 'in_transit' ? '🚚 في الطريق' : parcel.status === 'picked_up' ? '📫 تم الاستلام' : '⏳ ' + parcel.status}
                        </Text>
                      </View>
                    </View>
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ color: '#60A5FA', fontSize: 11, textAlign: 'right' }}>📍 من: {parcel.pickupAddress}</Text>
                      <Text style={{ color: '#F472B6', fontSize: 11, textAlign: 'right', marginTop: 2 }}>🏁 إلى: {parcel.dropoffAddress}</Text>
                    </View>
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#9B8EC4', fontSize: 11 }}>👤 المستلم: {parcel.recipientName} ({parcel.recipientPhone})</Text>
                    </View>
                    {parcel.price && (
                      <View style={{ backgroundColor: 'rgba(255,215,0,0.05)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#2D1B4E', marginTop: 4 }}>
                        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                          <Text style={{ color: '#9B8EC4', fontSize: 11 }}>💰 أجرة التوصيل:</Text>
                          <Text style={{ color: '#FFD700', fontSize: 12, fontWeight: '700' }}>{Math.round(parseFloat((parcel.price ?? 0).toString())).toLocaleString('ar-IQ')} د.ع</Text>
                        </View>
                      </View>
                    )}
                    <Text style={{ color: '#6B5A8A', fontSize: 10, textAlign: 'right', marginTop: 4 }}>🗓️ {new Date(parcel.createdAt).toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.modalClose, { margin: 12 }]} onPress={() => setHistoryDriverId(null)}>
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

      {/* ── Profile Photo Preview Modal (إنستجرام ستايل) ── */}
      <Modal
        visible={!!previewPhotoUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhotoUrl(null)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.88)",
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={1}
          onPress={() => setPreviewPhotoUrl(null)}
        >
          {/* Circular enlarged photo */}
          {previewPhotoUrl && (
            <View style={{ alignItems: "center", gap: 16 }}>
              <Image
                source={{ uri: previewPhotoUrl }}
                style={{
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  borderWidth: 4,
                  borderColor: "#FFD700",
                }}
                resizeMode="cover"
              />
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                {previewPhotoName}
              </Text>
              <Text style={{ color: "#9B8EC4", fontSize: 12 }}>
                اضغط في أي مكان للإغلاق
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* ── Confirm Dialog Modal (web-compatible) ── */}
      <Modal
        visible={confirmDialog.visible}
        transparent
        animationType="fade"
        onRequestClose={hideConfirm}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#1E0F4A', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#3D2B5E' }}>
            {/* Title */}
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
              {confirmDialog.title}
            </Text>
            {/* Message */}
            <Text style={{ color: '#C4B5D4', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              {confirmDialog.message}
            </Text>
            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={hideConfirm}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#2D1B4E', alignItems: 'center', borderWidth: 1, borderColor: '#4D3B6E' }}
              >
                <Text style={{ color: '#C4B5D4', fontSize: 15, fontWeight: '700' }}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDialog.onConfirm}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: confirmDialog.confirmColor, alignItems: 'center' }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{confirmDialog.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    overflow: "hidden",
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
    overflow: "hidden",
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

  // Ride Detail Card
  rideDetailCard: {
    backgroundColor: "#1E1035", borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  rideDetailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  rideDetailId: { fontSize: 13, fontWeight: "800", color: "#FFD700" },
  rideDetailTime: { fontSize: 11, color: "#6B7280" },
  rideDetailRoute: { marginBottom: 10 },
  rideDetailRouteRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  rideDetailDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  rideDetailDotEnd: { backgroundColor: "#EF4444" },
  rideDetailAddress: { fontSize: 12, color: "#ECEDEE", flex: 1 },
  rideDetailLine: { width: 2, height: 14, backgroundColor: "#2D1B4E", marginLeft: 3, marginBottom: 2 },
  rideDetailMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  rideDetailMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  rideDetailMetaLabel: { fontSize: 11, color: "#6B7280" },
  rideDetailMetaValue: { fontSize: 11, color: "#9B8EC4", fontWeight: "600" },
  rideDetailPeople: { flexDirection: "row", gap: 10, marginBottom: 10 },
  rideDetailPerson: { flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10 },
  rideDetailPersonLabel: { fontSize: 10, color: "#6B7280", marginBottom: 4, fontWeight: "700", textTransform: "uppercase" as const },
  rideDetailPersonName: { fontSize: 13, color: "#FFFFFF", fontWeight: "700" },
  rideDetailPersonPhone: { fontSize: 11, color: "#9B8EC4", marginTop: 2 },
  rideDetailPersonVehicle: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  rideDetailFareRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rideDetailFare: { fontSize: 18, fontWeight: "800", color: "#FFD700" },
  rideDetailFareSub: { fontSize: 11, color: "#6B7280" },
  rideDetailCancelBtn: {
    backgroundColor: "#450A0A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "#EF4444",
  },
  rideDetailCancelText: { color: "#F87171", fontSize: 12, fontWeight: "700" },

  // Ride Detail Modal
  rideModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  rideModalSheet: {
    backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: "85%",
  },
  rideModalHandle: { width: 40, height: 4, backgroundColor: "#3D2070", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  rideModalTitle: { fontSize: 18, fontWeight: "800", color: "#FFD700", marginBottom: 16, textAlign: "center" },
  rideModalSection: { marginBottom: 14 },
  rideModalSectionTitle: { fontSize: 12, color: "#9B8EC4", fontWeight: "700", marginBottom: 8, textTransform: "uppercase" as const },
  rideModalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#2D1B4E" },
  rideModalLabel: { fontSize: 13, color: "#9B8EC4" },
  rideModalValue: { fontSize: 13, color: "#FFFFFF", fontWeight: "600", flex: 1, textAlign: "right" },
  rideModalCloseBtn: {
    backgroundColor: "#2D1B4E", borderRadius: 12, paddingVertical: 12, alignItems: "center",
    marginTop: 16, borderWidth: 1, borderColor: "#FFD700",
  },
  rideModalCloseBtnText: { color: "#FFD700", fontSize: 15, fontWeight: "800" },
});

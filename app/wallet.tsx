import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeContext } from "@/lib/theme-provider";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function getTxIcon(description: string | null, type: string): string {
  const desc = description ?? "";
  if (desc.includes("رحلة") || desc.includes("ride")) return "🚗";
  if (desc.includes("طرد") || desc.includes("parcel")) return "📦";
  if (desc.includes("بين المدن") || desc.includes("intercity")) return "🚌";
  if (desc.includes("شحن") || desc.includes("topup") || desc.includes("credit")) return "💰";
  if (desc.includes("استرداد") || desc.includes("refund")) return "↩️";
  if (desc.includes("تحويل") || desc.includes("transfer")) return "↗️";
  if (type === "credit") return "💰";
  return "🚗";
}

function getTxLabel(description: string | null, type: string): string {
  if (description) return description;
  return type === "credit" ? "إضافة رصيد" : "خصم رصيد";
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";
  const { passenger } = usePassenger();

  const colors = {
    scrollBg: isDark ? "#0D0019" : "#F5F7FA",
    sectionTitle: isDark ? "#C4B5D4" : "#1A0533",
    txCard: isDark ? "#1E0F4A" : "#FFFFFF",
    txLabel: isDark ? "#FFFFFF" : "#1A0533",
    txIconBg: isDark ? "#2D1B69" : "#F5F7FA",
    emptyText: isDark ? "#6B5A8A" : "#9BA1A6",
  };

  const txQuery = trpc.rides.getPassengerTransactions.useQuery(
    { passengerId: passenger?.id ?? 0, limit: 50 },
    { enabled: !!passenger?.id }
  );

  const walletBalance = passenger?.walletBalance
    ? parseFloat(passenger.walletBalance).toLocaleString("ar-IQ")
    : "0";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المحفظة</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
        <Text style={styles.balanceAmount}>{walletBalance} د.ع</Text>
        <View style={styles.balanceRow}>
          <TouchableOpacity style={styles.topupBtn} onPress={() => router.push("/topup")}>
            <Text style={styles.topupBtnText}>+ شحن الرصيد</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Transactions */}
      <View style={[styles.scroll, { backgroundColor: colors.scrollBg }]}>
        <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>سجل المعاملات</Text>

        {txQuery.isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#FFD700" size="large" />
            <Text style={[styles.loadingText, { color: colors.emptyText }]}>جاري التحميل...</Text>
          </View>
        )}

        {!txQuery.isLoading && (!txQuery.data || txQuery.data.length === 0) && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={[styles.emptyText, { color: colors.emptyText }]}>لا توجد معاملات بعد</Text>
            <Text style={[styles.emptySubText, { color: colors.emptyText }]}>ستظهر هنا جميع عمليات الشحن والخصم</Text>
          </View>
        )}

        {!txQuery.isLoading && txQuery.data && txQuery.data.length > 0 && (
          <FlatList
            data={txQuery.data}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isCredit = item.type === "credit";
              const amount = parseFloat(item.amount?.toString() ?? "0");
              const icon = getTxIcon(item.description, item.type);
              const label = getTxLabel(item.description, item.type);
              const dateStr = formatDate(item.createdAt);
              const txStatus = (item as any).status ?? "completed";
              const isPending = txStatus === "pending";
              const isRejected = txStatus === "rejected";
              // لون المبلغ: رمادي إذا pending، أحمر إذا rejected، أخضر/أحمر حسب النوع
              const amountColor = isPending ? "#9BA1A6" : isRejected ? "#EF4444" : isCredit ? "#22C55E" : "#EF4444";
              return (
                <View style={[styles.txCard, { backgroundColor: colors.txCard, opacity: isRejected ? 0.75 : 1 }]}>
                  <View style={styles.txLeft}>
                    <Text style={[styles.txAmount, { color: amountColor }]}>
                      {isPending ? "" : isRejected ? "" : isCredit ? "+" : "-"}{amount.toLocaleString("ar-IQ")} د.ع
                    </Text>
                    {isPending && (
                      <View style={styles.statusBadgePending}>
                        <Text style={styles.statusBadgePendingText}>⏳ قيد المراجعة</Text>
                      </View>
                    )}
                    {isRejected && (
                      <View style={styles.statusBadgeRejected}>
                        <Text style={styles.statusBadgeRejectedText}>❌ مرفوض</Text>
                      </View>
                    )}
                    {!isPending && !isRejected && (
                      <Text style={styles.txDate}>{dateStr}</Text>
                    )}
                    {(isPending || isRejected) && (
                      <Text style={styles.txDate}>{dateStr}</Text>
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txLabel, { color: colors.txLabel }]} numberOfLines={2}>{label}</Text>
                  </View>
                  <View style={[styles.txIcon, { backgroundColor: colors.txIconBg }]}>
                    <Text style={styles.txIconText}>{icon}</Text>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#1A0533",
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center",
  },
  backText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 24, margin: 16,
    padding: 24, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  balanceAmount: { color: "#FFD700", fontSize: 36, fontWeight: "800" },
  balanceRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  topupBtn: { backgroundColor: "#FFD700", borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 },
  topupBtnText: { color: "#1A0533", fontSize: 14, fontWeight: "700" },
  scroll: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "800", textAlign: "right", marginBottom: 14 },
  txCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14,
    marginBottom: 10, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  txIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txIconText: { fontSize: 20 },
  txInfo: { flex: 1, alignItems: "flex-end" },
  txLabel: { fontSize: 14, fontWeight: "600", textAlign: "right" },
  txLeft: { alignItems: "flex-end" },
  txAmount: { fontSize: 15, fontWeight: "800" },
  txDate: { color: "#9BA1A6", fontSize: 11, marginTop: 2 },
  loadingBox: { alignItems: "center", paddingTop: 60, gap: 12 },
  loadingText: { fontSize: 14 },
  emptyBox: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 56 },
  emptyText: { fontSize: 16, fontWeight: "700" },
  emptySubText: { fontSize: 13, textAlign: "center" },
  statusBadgePending: { backgroundColor: "rgba(251,191,36,0.2)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  statusBadgeRejected: { backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 },
  statusBadgeText: { fontSize: 10, fontWeight: "700", color: "inherit" },
  statusBadgePendingText: { fontSize: 10, fontWeight: "700", color: "#F59E0B" },
  statusBadgeRejectedText: { fontSize: 10, fontWeight: "700", color: "#EF4444" },
});

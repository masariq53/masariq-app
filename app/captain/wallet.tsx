import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDriver } from "@/lib/driver-context";
import { trpc } from "@/lib/trpc";

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: string | number) {
  return Number(amount).toLocaleString("ar-IQ");
}

export default function DriverWalletScreen() {
  const insets = useSafeAreaInsets();
  const { driver } = useDriver();

  const balanceQuery = trpc.driverWallet.getBalance.useQuery(
    { driverId: driver?.id ?? 0 },
    { enabled: !!driver?.id, refetchInterval: 30000 }
  );

  const txQuery = trpc.driverWallet.getTransactions.useQuery(
    { driverId: driver?.id ?? 0, limit: 100 },
    { enabled: !!driver?.id }
  );

  const balance = balanceQuery.data?.balance ?? driver?.walletBalance?.toString() ?? "0";
  const transactions = txQuery.data ?? [];

  const renderItem = ({ item }: { item: any }) => {
    const isCredit = item.type === "credit";
    return (
      <View style={styles.txCard}>
        <View style={styles.txLeft}>
          <Text style={styles.txIcon}>{isCredit ? "⬆️" : "⬇️"}</Text>
        </View>
        <View style={styles.txMiddle}>
          <Text style={styles.txDesc} numberOfLines={2}>{item.description ?? (isCredit ? "شحن رصيد" : "استقطاع")}</Text>
          <Text style={styles.txDate}>{formatDate(item.createdAt)}</Text>
          {item.balanceBefore != null && item.balanceAfter != null && (
            <Text style={styles.txBalance}>
              الرصيد: {formatAmount(item.balanceBefore)} ← {formatAmount(item.balanceAfter)} د.ع
            </Text>
          )}
        </View>
        <View style={styles.txRight}>
          <Text style={[styles.txAmount, isCredit ? styles.txCredit : styles.txDebit]}>
            {isCredit ? "+" : "-"}{formatAmount(item.amount)}
          </Text>
          <Text style={styles.txCurrency}>د.ع</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>محفظة السائق</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>رصيد المحفظة الحالي</Text>
        {balanceQuery.isLoading ? (
          <ActivityIndicator color="#FFD700" size="large" />
        ) : (
          <Text style={styles.balanceAmount}>
            {formatAmount(balance)} <Text style={styles.balanceCurrency}>د.ع</Text>
          </Text>
        )}
        <Text style={styles.balanceNote}>تُخصم عمولة الشركة تلقائياً من كل رحلة مكتملة</Text>
        <TouchableOpacity style={styles.topupBtn} onPress={() => router.push("/captain/topup")}>
          <Text style={styles.topupBtnText}>⬆️ شحن الرصيد</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions */}
      <View style={styles.txHeader}>
        <Text style={styles.txHeaderTitle}>سجل المعاملات</Text>
        {txQuery.isRefetching && <ActivityIndicator size="small" color="#9B8EC4" />}
      </View>

      {txQuery.isLoading ? (
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color="#6C3FC5" />
          <Text style={styles.loadingText}>جاري تحميل المعاملات...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyView}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyText}>لا توجد معاملات بعد</Text>
          <Text style={styles.emptySubText}>ستظهر هنا عمليات الشحن والاستقطاعات</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0225" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#3D2070",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 22, color: "#FFD700" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  balanceCard: {
    margin: 16,
    backgroundColor: "#1A0533",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  balanceLabel: { fontSize: 14, color: "#9B8EC4", marginBottom: 8 },
  balanceAmount: { fontSize: 36, fontWeight: "900", color: "#FFD700" },
  balanceCurrency: { fontSize: 18, fontWeight: "600", color: "#FFD700" },
  balanceNote: {
    fontSize: 12,
    color: "#9B8EC4",
    marginTop: 10,
    textAlign: "center",
    backgroundColor: "rgba(108,63,197,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  txHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  txHeaderTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  listContent: { paddingHorizontal: 16, paddingBottom: 30 },
  txCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#1A0533",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  txLeft: { marginLeft: 12 },
  txIcon: { fontSize: 24 },
  txMiddle: { flex: 1, alignItems: "flex-end" },
  txDesc: { fontSize: 14, fontWeight: "600", color: "#FFFFFF", textAlign: "right" },
  txDate: { fontSize: 11, color: "#9B8EC4", marginTop: 3 },
  txBalance: { fontSize: 10, color: "#6B7280", marginTop: 2 },
  txRight: { alignItems: "center", marginRight: 12 },
  txAmount: { fontSize: 18, fontWeight: "800" },
  txCurrency: { fontSize: 10, color: "#9B8EC4", marginTop: 2 },
  txCredit: { color: "#2ECC71" },
  txDebit: { color: "#EF4444" },
  separator: { height: 8 },
  loadingView: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#9B8EC4", fontSize: 14 },
  emptyView: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  emptySubText: { fontSize: 13, color: "#9B8EC4", textAlign: "center" },
  topupBtn: {
    marginTop: 14,
    backgroundColor: "#6C3FC5",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  topupBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});

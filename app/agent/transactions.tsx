import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";

type FilterType = "all" | "admin_topup" | "recharge";

export default function AgentTransactionsScreen() {
  const { passenger } = usePassenger();
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  const { data: agentStatus } = trpc.agents.getMyStatus.useQuery(
    { passengerId: passenger?.id ?? 0 },
    { enabled: !!passenger?.id }
  );

  const { data: transactions, isLoading, refetch } = trpc.agents.getFullLedger.useQuery(
    { agentId: agentStatus?.id ?? 0 },
    { enabled: !!agentStatus?.id }
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (d: Date | string) => {
    const date = new Date(d);
    return date.toLocaleDateString("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filtered = (transactions ?? []).filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سجل المعاملات</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(
          [
            ["all", "الكل"],
            ["admin_topup", "⬆️ شحن من الإدارة"],
            ["recharge", "⬇️ شحن للعملاء"],
          ] as [FilterType, string][]
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterBtn, filter === key && styles.filterBtnActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2ECC71" />
        </View>
      ) : !filtered || filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>لا توجد معاملات بعد</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ECC71" />
          }
          renderItem={({ item }) => {
            const isTopup = item.type === "admin_topup";
            return (
              <View style={[styles.txCard, isTopup ? styles.txCardTopup : styles.txCardRecharge]}>
                <View style={styles.txHeader}>
                  <Text style={[styles.txAmount, isTopup ? styles.amountGreen : styles.amountRed]}>
                    {isTopup ? "+" : "-"}
                    {Number(item.amount).toLocaleString("ar-IQ")} د.ع
                  </Text>
                  <View style={[styles.typeBadge, isTopup ? styles.badgeGreen : styles.badgeBlue]}>
                    <Text style={[styles.typeText, isTopup ? styles.typeTextGreen : styles.typeTextBlue]}>
                      {isTopup ? "⬆️ شحن من الإدارة" : item.recipientType === "driver" ? "🚗 سائق" : "👤 مستخدم"}
                    </Text>
                  </View>
                </View>

                {/* Recipient info (for recharge) */}
                {!isTopup && (item.recipientName || item.recipientPhone) && (
                  <>
                    {item.recipientName && (
                      <Text style={styles.txName}>{item.recipientName}</Text>
                    )}
                    {item.recipientPhone && (
                      <Text style={styles.txPhone}>{item.recipientPhone}</Text>
                    )}
                  </>
                )}

                {/* Notes */}
                {item.notes ? (
                  <Text style={styles.txNotes}>{item.notes}</Text>
                ) : null}

                {/* Balance before/after */}
                <View style={styles.txFooter}>
                  <Text style={styles.txBalance}>
                    {Number(item.balanceBefore).toLocaleString("ar-IQ")} ← {Number(item.balanceAfter).toLocaleString("ar-IQ")} د.ع
                  </Text>
                  <Text style={styles.txDate}>{formatDate(item.createdAt)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 22, color: "#2ECC71" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#ECEDEE" },
  filterRow: {
    flexDirection: "row-reverse",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  filterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1A3A2A",
  },
  filterBtnActive: { backgroundColor: "#14532D" },
  filterText: { fontSize: 12, color: "#A8D8C0", fontWeight: "600" },
  filterTextActive: { color: "#4ADE80" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#A8D8C0" },
  list: { padding: 16, paddingBottom: 40 },
  txCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  txCardTopup: {
    backgroundColor: "#0D2A1A",
    borderColor: "#2ECC71",
  },
  txCardRecharge: {
    backgroundColor: "#1A1A2E",
    borderColor: "#3D2B5E",
  },
  txHeader: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  txAmount: { fontSize: 18, fontWeight: "800" },
  amountGreen: { color: "#16A34A" },
  amountRed: { color: "#EF4444" },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeGreen: { backgroundColor: "#14532D" },
  badgeBlue: { backgroundColor: "#1E3A5F" },
  typeText: { fontSize: 11, fontWeight: "700" },
  typeTextGreen: { color: "#4ADE80" },
  typeTextBlue: { color: "#60A5FA" },
  txName: { fontSize: 15, fontWeight: "600", color: "#ECEDEE", textAlign: "right", marginBottom: 2 },
  txPhone: { fontSize: 13, color: "#A8D8C0", textAlign: "right", marginBottom: 4 },
  txNotes: { fontSize: 13, color: "#6B9E80", textAlign: "right", marginBottom: 4, fontStyle: "italic" },
  txFooter: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#2D1B4E",
    paddingTop: 8,
    marginTop: 4,
  },
  txBalance: { fontSize: 12, color: "#2ECC71", fontWeight: "600" },
  txDate: { fontSize: 12, color: "#6B9E80" },
});

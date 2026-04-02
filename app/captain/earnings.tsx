import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const weekData = [
  { day: "السبت", amount: 42000, trips: 7 },
  { day: "الأحد", amount: 55000, trips: 9 },
  { day: "الاثنين", amount: 38000, trips: 6 },
  { day: "الثلاثاء", amount: 61000, trips: 10 },
  { day: "الأربعاء", amount: 47500, trips: 8 },
  { day: "الخميس", amount: 72000, trips: 12 },
  { day: "الجمعة", amount: 35000, trips: 5 },
];

const maxAmount = Math.max(...weekData.map((d) => d.amount));

const transactions = [
  { id: "1", type: "ride", name: "محمد علي", amount: 8000, time: "منذ ساعة", icon: "🚗" },
  { id: "2", type: "ride", name: "سارة أحمد", amount: 12000, time: "منذ 2 ساعة", icon: "🚗" },
  { id: "3", type: "delivery", name: "توصيل طرد", amount: 5000, time: "منذ 3 ساعات", icon: "📦" },
  { id: "4", type: "ride", name: "عمر خالد", amount: 9500, time: "منذ 4 ساعات", icon: "🚗" },
  { id: "5", type: "ride", name: "فاطمة حسن", amount: 13000, time: "أمس", icon: "🚗" },
];

export default function CaptainEarningsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"day" | "week" | "month">("week");

  const totalWeek = weekData.reduce((sum, d) => sum + d.amount, 0);
  const totalTrips = weekData.reduce((sum, d) => sum + d.trips, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>أرباحي</Text>
        <TouchableOpacity style={styles.withdrawBtn}>
          <Text style={styles.withdrawText}>سحب</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Total Earnings Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>إجمالي الأسبوع</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalAmount}>{totalWeek.toLocaleString()}</Text>
            <Text style={styles.totalCurrency}>د.ع</Text>
          </View>
          <View style={styles.totalStats}>
            <View style={styles.totalStat}>
              <Text style={styles.totalStatValue}>{totalTrips}</Text>
              <Text style={styles.totalStatLabel}>رحلة</Text>
            </View>
            <View style={styles.totalStatDivider} />
            <View style={styles.totalStat}>
              <Text style={styles.totalStatValue}>
                {Math.round(totalWeek / totalTrips).toLocaleString()}
              </Text>
              <Text style={styles.totalStatLabel}>متوسط/رحلة</Text>
            </View>
            <View style={styles.totalStatDivider} />
            <View style={styles.totalStat}>
              <Text style={[styles.totalStatValue, { color: "#22C55E" }]}>+12%</Text>
              <Text style={styles.totalStatLabel}>مقارنة بالأسبوع</Text>
            </View>
          </View>
        </View>

        {/* Period Tabs */}
        <View style={styles.tabsContainer}>
          {(["day", "week", "month"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "day" ? "اليوم" : tab === "week" ? "الأسبوع" : "الشهر"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bar Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>أرباح الأسبوع</Text>
          <View style={styles.chart}>
            {weekData.map((d, i) => (
              <View key={i} style={styles.barGroup}>
                <Text style={styles.barAmount}>
                  {Math.round(d.amount / 1000)}k
                </Text>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: (d.amount / maxAmount) * 100,
                        backgroundColor: i === 4 ? "#FFD700" : "#3D2580",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barDay}>{d.day.slice(0, 3)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>آخر المعاملات</Text>
          {transactions.map((t) => (
            <View key={t.id} style={styles.transactionCard}>
              <View style={styles.transactionIcon}>
                <Text style={styles.transactionEmoji}>{t.icon}</Text>
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionName}>{t.name}</Text>
                <Text style={styles.transactionTime}>{t.time}</Text>
              </View>
              <Text style={styles.transactionAmount}>+{t.amount.toLocaleString()} د.ع</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0533",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2D1B69",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  withdrawBtn: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  withdrawText: {
    color: "#1A0533",
    fontSize: 14,
    fontWeight: "bold",
  },
  totalCard: {
    margin: 20,
    backgroundColor: "#2D1B69",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  totalLabel: {
    color: "#9B8AB0",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  totalAmount: {
    color: "#FFD700",
    fontSize: 42,
    fontWeight: "bold",
  },
  totalCurrency: {
    color: "#9B8AB0",
    fontSize: 16,
  },
  totalStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  totalStat: { alignItems: "center" },
  totalStatValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  totalStatLabel: {
    color: "#9B8AB0",
    fontSize: 10,
    marginTop: 2,
  },
  totalStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#3D2580",
  },
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: "#FFD700",
  },
  tabText: {
    color: "#9B8AB0",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#1A0533",
  },
  chartContainer: {
    marginHorizontal: 20,
    backgroundColor: "#2D1B69",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  chartTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "right",
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 130,
  },
  barGroup: {
    alignItems: "center",
    flex: 1,
  },
  barAmount: {
    color: "#9B8AB0",
    fontSize: 9,
    marginBottom: 4,
  },
  barWrapper: {
    height: 100,
    justifyContent: "flex-end",
    width: "70%",
  },
  bar: {
    width: "100%",
    borderRadius: 6,
    minHeight: 8,
  },
  barDay: {
    color: "#9B8AB0",
    fontSize: 9,
    marginTop: 6,
  },
  transactionsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 14,
    textAlign: "right",
  },
  transactionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "#3D2580",
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A0533",
    alignItems: "center",
    justifyContent: "center",
  },
  transactionEmoji: { fontSize: 22 },
  transactionInfo: { flex: 1 },
  transactionName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  transactionTime: {
    color: "#9B8AB0",
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "bold",
  },
});

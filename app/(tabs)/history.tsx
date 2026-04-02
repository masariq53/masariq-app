import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StatusBar } from "expo-status-bar";

const tabs = ["الكل", "رحلات", "توصيل", "اشتراكات"];

const mockHistory = [
  {
    id: "1",
    type: "ride",
    from: "حي الجامعة",
    to: "المستشفى الجمهوري",
    date: "اليوم، 10:30 ص",
    price: "3,500",
    status: "مكتملة",
    statusColor: "#22C55E",
    driver: "أحمد محمد",
    rating: 5,
  },
  {
    id: "2",
    type: "delivery",
    from: "سوق الشعارين",
    to: "حي النور",
    date: "أمس، 3:15 م",
    price: "5,000",
    status: "مكتملة",
    statusColor: "#22C55E",
    driver: "علي حسن",
    rating: 4,
  },
  {
    id: "3",
    type: "ride",
    from: "جامعة الموصل",
    to: "حي الزهور",
    date: "01/04/2026",
    price: "4,000",
    status: "ملغاة",
    statusColor: "#EF4444",
    driver: "—",
    rating: 0,
  },
  {
    id: "4",
    type: "subscription",
    from: "اشتراك شهري",
    to: "20 رحلة",
    date: "01/04/2026",
    price: "50,000",
    status: "نشط",
    statusColor: "#FFD700",
    driver: "—",
    rating: 0,
  },
  {
    id: "5",
    type: "ride",
    from: "حي الرشيدية",
    to: "مطعم الفردوس",
    date: "30/03/2026",
    price: "2,500",
    status: "مكتملة",
    statusColor: "#22C55E",
    driver: "كريم سالم",
    rating: 5,
  },
];

const typeIcons: Record<string, string> = {
  ride: "🚗",
  delivery: "📦",
  subscription: "⭐",
};

export default function HistoryScreen() {
  const [activeTab, setActiveTab] = useState(0);

  const filtered = mockHistory.filter((item) => {
    if (activeTab === 0) return true;
    if (activeTab === 1) return item.type === "ride";
    if (activeTab === 2) return item.type === "delivery";
    if (activeTab === 3) return item.type === "subscription";
    return true;
  });

  const renderItem = ({ item }: { item: (typeof mockHistory)[0] }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.typeTag}>
          <Text style={styles.typeIcon}>{typeIcons[item.type]}</Text>
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.cardDate}>{item.date}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.statusColor + "20" }]}>
            <Text style={[styles.statusText, { color: item.statusColor }]}>{item.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.route}>
        <View style={styles.routePoint}>
          <View style={[styles.dot, { backgroundColor: "#22C55E" }]} />
          <Text style={styles.routeText}>{item.from}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
          <Text style={styles.routeText}>{item.to}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        {item.driver !== "—" && (
          <Text style={styles.driverText}>السائق: {item.driver}</Text>
        )}
        <Text style={styles.priceText}>{item.price} د.ع</Text>
      </View>

      {item.rating > 0 && (
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Text key={s} style={{ fontSize: 14, color: s <= item.rating ? "#FFD700" : "#E2E8F0" }}>
              ★
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-[#1A0533]" safeAreaClassName="bg-[#F5F7FA]">
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>سجل الرحلات</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🗂️</Text>
            <Text style={styles.emptyText}>لا توجد رحلات في هذه الفئة</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1A0533",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  tabActive: {
    backgroundColor: "#1A0533",
  },
  tabText: {
    color: "#6B7A8D",
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  typeTag: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  typeIcon: {
    fontSize: 22,
  },
  cardHeaderInfo: {
    alignItems: "flex-end",
    gap: 6,
  },
  cardDate: {
    color: "#6B7A8D",
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  route: {
    gap: 6,
    marginBottom: 14,
  },
  routePoint: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: "#E2E8F0",
    marginRight: 4,
    alignSelf: "flex-end",
  },
  routeText: {
    color: "#1A0533",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F5F7FA",
    paddingTop: 12,
  },
  driverText: {
    color: "#6B7A8D",
    fontSize: 12,
  },
  priceText: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "800",
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 2,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    color: "#6B7A8D",
    fontSize: 15,
  },
});

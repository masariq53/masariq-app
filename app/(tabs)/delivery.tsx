import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";

const DELIVERY_TYPES = [
  {
    id: "instant",
    icon: "⚡",
    title: "توصيل فوري",
    subtitle: "داخل المدينة",
    desc: "يصلك أقرب كابتن متاح خلال دقائق — نفس تسعيرة الأجرة",
    color: "#FFD700",
    bg: "#FFF8E1",
    border: "#FFD700",
  },
  {
    id: "intercity",
    icon: "🚚",
    title: "توصيل بين المدن",
    subtitle: "خارج المدينة",
    desc: "عبر شبكة وكلائنا في جميع أنحاء العراق",
    color: "#6366F1",
    bg: "#EEF2FF",
    border: "#A5B4FC",
  },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "بانتظار الكابتن", color: "#F59E0B" },
  accepted: { label: "تم القبول", color: "#3B82F6" },
  picked_up: { label: "تم الاستلام", color: "#8B5CF6" },
  in_transit: { label: "في الطريق", color: "#6366F1" },
  inTransit: { label: "في الطريق", color: "#6366F1" },
  delivered: { label: "تم التسليم ✓", color: "#22C55E" },
  cancelled: { label: "ملغي", color: "#EF4444" },
  returned: { label: "مُعاد", color: "#6B7280" },
};

export default function DeliveryScreen() {
  const { passenger } = usePassenger();
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  const { data: myParcels, isLoading: loadingParcels, refetch } = trpc.parcel.getSenderParcels.useQuery(
    { senderId: passenger?.id ?? 0 },
    { enabled: !!passenger?.id && activeTab === "history" }
  );

  const handleSelectType = (typeId: string) => {
    if (!passenger) {
      router.push("/login" as any);
      return;
    }
    router.push({ pathname: "/delivery/new" as any, params: { type: typeId } });
  };

  return (
    <ScreenContainer containerClassName="bg-[#1A0533]" safeAreaClassName="bg-[#F5F7FA]">
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📦 توصيل الطرود</Text>
        <Text style={styles.headerSubtitle}>اختر نوع التوصيل المناسب لك</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "new" && styles.tabActive]}
          onPress={() => setActiveTab("new")}
        >
          <Text style={[styles.tabText, activeTab === "new" && styles.tabTextActive]}>طلب جديد</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>طلباتي</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "new" ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {DELIVERY_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeCard, { backgroundColor: type.bg, borderColor: type.border }]}
              onPress={() => handleSelectType(type.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.typeIconWrap, { backgroundColor: type.color + "30" }]}>
                <Text style={styles.typeIcon}>{type.icon}</Text>
              </View>
              <View style={styles.typeCardBody}>
                <Text style={styles.typeTitle}>{type.title}</Text>
                <Text style={[styles.typeSubtitle, { color: type.color }]}>{type.subtitle}</Text>
                <Text style={styles.typeDesc}>{type.desc}</Text>
              </View>
              <View style={[styles.typeArrow, { backgroundColor: type.color }]}>
                <Text style={styles.typeArrowText}>←</Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoBannerTitle}>كيف يعمل التوصيل الفوري؟</Text>
              <Text style={styles.infoBannerText}>
                يذهب طلبك لأقرب كابتن متاح — نفس كباتن الأجرة — يستلم طردك ويوصله فوراً بنفس تسعيرة الرحلة.
              </Text>
            </View>
          </View>

          <View style={[styles.infoBanner, { backgroundColor: "#EEF2FF", borderColor: "#A5B4FC" }]}>
            <Text style={styles.infoBannerIcon}>🚚</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoBannerTitle, { color: "#4338CA" }]}>كيف يعمل التوصيل بين المدن؟</Text>
              <Text style={[styles.infoBannerText, { color: "#6366F1" }]}>
                يُرسل طردك عبر شبكة وكلائنا المعتمدين في جميع أنحاء العراق مع رقم تتبع خاص.
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
          {loadingParcels ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1A0533" />
            </View>
          ) : !myParcels || myParcels.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>لا توجد طلبات بعد</Text>
              <TouchableOpacity style={styles.newOrderBtn} onPress={() => setActiveTab("new")}>
                <Text style={styles.newOrderBtnText}>أرسل طردك الأول</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={myParcels}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              onRefresh={refetch}
              refreshing={loadingParcels}
              renderItem={({ item }) => {
                const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: "#6B7280" };
                const typeInfo = DELIVERY_TYPES.find((t) => t.id === item.deliveryType);
                return (
                  <TouchableOpacity
                    style={styles.parcelCard}
                    onPress={() => router.push({ pathname: "/delivery/tracking" as any, params: { parcelId: item.id } })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.parcelCardHeader}>
                      <Text style={styles.trackingNum}>#{item.trackingNumber}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + "20" }]}>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                      </View>
                    </View>
                    <View style={styles.parcelCardRow}>
                      <Text style={styles.parcelCardLabel}>{typeInfo?.icon} {typeInfo?.title ?? item.deliveryType}</Text>
                      <Text style={styles.parcelCardLabel}>
                        {item.parcelSize === "small" ? "📦 صغير" : item.parcelSize === "medium" ? "🗃️ متوسط" : "📫 كبير"}
                      </Text>
                    </View>
                    <View style={styles.parcelAddressRow}>
                      <View style={[styles.dot, { backgroundColor: "#22C55E" }]} />
                      <Text style={styles.parcelAddress} numberOfLines={1}>{item.pickupAddress}</Text>
                    </View>
                    <View style={styles.parcelAddressRow}>
                      <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
                      <Text style={styles.parcelAddress} numberOfLines={1}>{item.dropoffAddress}</Text>
                    </View>
                    <Text style={styles.parcelDate}>
                      {new Date(item.createdAt).toLocaleDateString("ar-IQ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1A0533",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textAlign: "right",
    marginTop: 4,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#1A0533",
  },
  tabText: {
    color: "#9BA1A6",
    fontSize: 15,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#1A0533",
    fontWeight: "800",
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    backgroundColor: "#F5F7FA",
    flexGrow: 1,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  typeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  typeIcon: { fontSize: 26 },
  typeCardBody: { flex: 1 },
  typeTitle: {
    color: "#1A0533",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "right",
  },
  typeSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 2,
  },
  typeDesc: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
    lineHeight: 17,
  },
  typeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  typeArrowText: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "bold",
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoBannerIcon: { fontSize: 22 },
  infoBannerTitle: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 4,
  },
  infoBannerText: {
    color: "#3B82F6",
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "600",
  },
  newOrderBtn: {
    backgroundColor: "#1A0533",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  newOrderBtnText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "700",
  },
  parcelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  parcelCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackingNum: {
    color: "#1A0533",
    fontSize: 13,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  parcelCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  parcelCardLabel: {
    color: "#6B7280",
    fontSize: 12,
  },
  parcelAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  parcelAddress: {
    flex: 1,
    color: "#374151",
    fontSize: 13,
    textAlign: "right",
  },
  parcelDate: {
    color: "#9BA1A6",
    fontSize: 11,
    textAlign: "right",
  },
});

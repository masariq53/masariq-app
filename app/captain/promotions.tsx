import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

export default function CaptainPromotionsScreen() {
  const router = useRouter();
  const { driver } = useDriver();

  const { data: freeRides, isLoading, refetch, isRefetching } = trpc.discounts.getDriverFreeRides.useQuery(
    { driverId: driver?.id ?? 0 },
    { enabled: !!driver?.id }
  );

  const remaining = freeRides?.remaining ?? 0;
  const total = freeRides?.totalFreeRides ?? 0;
  const used = freeRides?.usedFreeRides ?? 0;
  const isActive = freeRides?.isActive ?? false;
  const progress = total > 0 ? used / total : 0;

  return (
    <ScreenContainer containerClassName="bg-[#0f172a]">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>عروضي</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FFD700" />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>جاري التحميل...</Text>
          </View>
        ) : !freeRides ? (
          /* لا توجد عروض */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎁</Text>
            <Text style={styles.emptyTitle}>لا توجد عروض حالياً</Text>
            <Text style={styles.emptySubtitle}>
              ستظهر هنا العروض والمزايا الخاصة بك عند تفعيلها من الإدارة
            </Text>
          </View>
        ) : (
          <>
            {/* بطاقة الرحلات المجانية */}
            <View style={[styles.card, !isActive && styles.cardInactive]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>✨</Text>
                <View style={styles.cardTitleBlock}>
                  <Text style={styles.cardTitle}>رحلات مجانية بدون عمولة</Text>
                  <Text style={styles.cardSubtitle}>{freeRides.grantReason ?? "عرض ترحيبي"}</Text>
                </View>
                <View style={[styles.badge, isActive && remaining > 0 ? styles.badgeActive : styles.badgeDone]}>
                  <Text style={styles.badgeText}>{isActive && remaining > 0 ? "نشط" : "منتهي"}</Text>
                </View>
              </View>

              {/* شريط التقدم */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressUsed}>{used} مستخدمة</Text>
                  <Text style={styles.progressTotal}>{total} إجمالي</Text>
                </View>
              </View>

              {/* الأرقام الكبيرة */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: "#FFD700" }]}>{remaining}</Text>
                  <Text style={styles.statLabel}>متبقية</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: "#4ADE80" }]}>{used}</Text>
                  <Text style={styles.statLabel}>مستخدمة</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: "#94a3b8" }]}>{total}</Text>
                  <Text style={styles.statLabel}>إجمالي</Text>
                </View>
              </View>
            </View>

            {/* شرح العرض */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>🔥 كيف يعمل العرض؟</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✅</Text>
                <Text style={styles.infoText}>
                  أول <Text style={styles.infoHighlight}>{total} رحلة</Text> تكملها لن تُخصم منها عمولة الشركة
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✅</Text>
                <Text style={styles.infoText}>
                  العرض يُطبّق تلقائياً على رحلات المدينة الداخلية
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>✅</Text>
                <Text style={styles.infoText}>
                  ستتلقى إشعاراً بعد كل رحلة مجانية يُخبرك بعدد الرحلات المتبقية
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoBullet}>💡</Text>
                <Text style={styles.infoText}>
                  بعد انتهاء الرحلات المجانية، ستُستقطع العمولة المعتادة تلقائياً
                </Text>
              </View>
            </View>

            {/* تاريخ منح العرض */}
            {freeRides.createdAt && (
              <View style={styles.dateCard}>
                <Text style={styles.dateLabel}>📅 تاريخ منح العرض</Text>
                <Text style={styles.dateValue}>
                  {new Date(freeRides.createdAt).toLocaleDateString("ar-IQ", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow: { color: "#FFD700", fontSize: 22 },
  headerTitle: { color: "#FFD700", fontSize: 20, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { alignItems: "center", marginTop: 80, gap: 12 },
  loadingText: { color: "#94a3b8", fontSize: 15 },
  emptyContainer: { alignItems: "center", marginTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { color: "#e2e8f0", fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 22 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardInactive: { opacity: 0.6 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  cardIcon: { fontSize: 32 },
  cardTitleBlock: { flex: 1 },
  cardTitle: { color: "#f1f5f9", fontSize: 16, fontWeight: "700" },
  cardSubtitle: { color: "#94a3b8", fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeActive: { backgroundColor: "#166534" },
  badgeDone: { backgroundColor: "#374151" },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  progressContainer: { marginBottom: 16 },
  progressBar: {
    height: 10,
    backgroundColor: "#334155",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 5,
  },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressUsed: { color: "#94a3b8", fontSize: 12 },
  progressTotal: { color: "#94a3b8", fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 16,
  },
  statItem: { alignItems: "center", gap: 4 },
  statNumber: { fontSize: 32, fontWeight: "800" },
  statLabel: { color: "#94a3b8", fontSize: 13 },
  statDivider: { width: 1, height: 40, backgroundColor: "#334155" },
  infoCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  infoTitle: { color: "#FFD700", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  infoItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  infoBullet: { fontSize: 16, marginTop: 1 },
  infoText: { color: "#cbd5e1", fontSize: 14, flex: 1, lineHeight: 22 },
  infoHighlight: { color: "#FFD700", fontWeight: "700" },
  dateCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  dateLabel: { color: "#94a3b8", fontSize: 14 },
  dateValue: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
});

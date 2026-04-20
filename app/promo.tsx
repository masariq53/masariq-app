import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";
import { ScreenContainer } from "@/components/screen-container";

export default function PromoScreen() {
  const router = useRouter();
  const { passenger } = usePassenger();

  const { data: discount, isLoading, refetch, isRefetching } = trpc.discounts.getMyDiscount.useQuery(
    { passengerId: passenger?.id ?? 0, serviceType: "city_ride" },
    { enabled: !!passenger?.id }
  );

  const hasDiscount = !!discount;
  const isFreeRides = discount?.type === "free_rides";
  const remaining = discount?.remainingFreeRides ?? 0;
  const total = discount?.totalFreeRides ?? 0;
  const used = total - remaining;
  const progress = total > 0 ? used / total : 0;

  return (
    <ScreenContainer containerClassName="bg-[#0a0a1a]">
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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>جاري التحميل...</Text>
          </View>
        ) : !hasDiscount ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎁</Text>
            <Text style={styles.emptyTitle}>لا توجد عروض حالياً</Text>
            <Text style={styles.emptySubtitle}>
              ستظهر هنا عروضك وخصوماتك الخاصة عند تفعيلها
            </Text>
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>💡 كيف تحصل على عروض؟</Text>
              <Text style={styles.tipItem}>• دعوة أصدقائك للانضمام لمسار</Text>
              <Text style={styles.tipItem}>• المتابعة على وسائل التواصل الاجتماعي</Text>
              <Text style={styles.tipItem}>• العروض الموسمية والمناسبات الخاصة</Text>
            </View>
          </View>
        ) : (
          <>
            {isFreeRides ? (
              <View style={styles.freeRidesCard}>
                <View style={styles.cardGlow} />
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>🎉</Text>
                  <View style={styles.cardTitleBlock}>
                    <Text style={styles.cardTitle}>رحلات مجانية</Text>
                    <Text style={styles.cardSubtitle}>عرض ترحيبي خاص بك</Text>
                  </View>
                  <View style={[styles.badge, remaining > 0 ? styles.badgeActive : styles.badgeDone]}>
                    <Text style={styles.badgeText}>{remaining > 0 ? "نشط" : "منتهي"}</Text>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressUsed}>{used} مستخدمة</Text>
                    <Text style={styles.progressTotal}>{total} إجمالي</Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: "#818cf8" }]}>{remaining}</Text>
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
            ) : discount?.type === "percentage" ? (
              <View style={styles.percentCard}>
                <Text style={styles.percentIcon}>🏷️</Text>
                <Text style={styles.percentValue}>{discount.discountValue}%</Text>
                <Text style={styles.percentLabel}>خصم على جميع رحلاتك</Text>
                <View style={[styles.badge, styles.badgeActive, { alignSelf: "center", marginTop: 8 }]}>
                  <Text style={styles.badgeText}>نشط</Text>
                </View>
              </View>
            ) : (
              <View style={styles.fixedCard}>
                <Text style={styles.fixedIcon}>💸</Text>
                <Text style={styles.fixedValue}>
                  {parseFloat(discount?.discountValue?.toString() ?? "0").toLocaleString()} د.ع
                </Text>
                <Text style={styles.fixedLabel}>خصم ثابت على كل رحلة</Text>
                <View style={[styles.badge, styles.badgeActive, { alignSelf: "center", marginTop: 8 }]}>
                  <Text style={styles.badgeText}>نشط</Text>
                </View>
              </View>
            )}

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>✨ كيف يعمل العرض؟</Text>
              {isFreeRides ? (
                <>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoBullet}>✅</Text>
                    <Text style={styles.infoText}>
                      أول <Text style={styles.infoHighlight}>{total} رحلة</Text> ستكون مجانية تماماً
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoBullet}>✅</Text>
                    <Text style={styles.infoText}>
                      العرض يُطبّق تلقائياً عند تأكيد الرحلة بدون أي إجراء منك
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoBullet}>✅</Text>
                    <Text style={styles.infoText}>صالح لرحلات المدينة الداخلية</Text>
                  </View>
                </>
              ) : (
                <View style={styles.infoItem}>
                  <Text style={styles.infoBullet}>✅</Text>
                  <Text style={styles.infoText}>
                    الخصم يُطبّق تلقائياً على كل رحلة تقوم بها
                  </Text>
                </View>
              )}
            </View>

            {remaining > 0 && (
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => router.push("/(tabs)/index" as any)}
              >
                <Text style={styles.bookBtnText}>احجز رحلتك الآن 🚗</Text>
              </TouchableOpacity>
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
    borderBottomColor: "#1e1e3a",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backArrow: { color: "#818cf8", fontSize: 22 },
  headerTitle: { color: "#818cf8", fontSize: 20, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { alignItems: "center", marginTop: 80, gap: 12 },
  loadingText: { color: "#94a3b8", fontSize: 15 },
  emptyContainer: { alignItems: "center", marginTop: 60, paddingHorizontal: 24, gap: 12 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { color: "#e2e8f0", fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 22 },
  tipsCard: {
    backgroundColor: "#1e1e3a",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    width: "100%",
    gap: 8,
  },
  tipsTitle: { color: "#818cf8", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  tipItem: { color: "#cbd5e1", fontSize: 14, lineHeight: 22 },
  freeRidesCard: {
    backgroundColor: "#1e1e3a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#4338ca",
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#6366f133",
  },
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
  progressFill: { height: "100%", backgroundColor: "#818cf8", borderRadius: 5 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressUsed: { color: "#94a3b8", fontSize: 12 },
  progressTotal: { color: "#94a3b8", fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#0f0f2a",
    borderRadius: 12,
    padding: 16,
  },
  statItem: { alignItems: "center", gap: 4 },
  statNumber: { fontSize: 32, fontWeight: "800" },
  statLabel: { color: "#94a3b8", fontSize: 13 },
  statDivider: { width: 1, height: 40, backgroundColor: "#334155" },
  percentCard: {
    backgroundColor: "#1e1e3a",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4338ca",
    gap: 8,
  },
  percentIcon: { fontSize: 48 },
  percentValue: { color: "#818cf8", fontSize: 48, fontWeight: "800" },
  percentLabel: { color: "#cbd5e1", fontSize: 16 },
  fixedCard: {
    backgroundColor: "#1e1e3a",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4338ca",
    gap: 8,
  },
  fixedIcon: { fontSize: 48 },
  fixedValue: { color: "#4ADE80", fontSize: 36, fontWeight: "800" },
  fixedLabel: { color: "#cbd5e1", fontSize: 16 },
  infoCard: {
    backgroundColor: "#1e1e3a",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  infoTitle: { color: "#818cf8", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  infoItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  infoBullet: { fontSize: 16, marginTop: 1 },
  infoText: { color: "#cbd5e1", fontSize: 14, flex: 1, lineHeight: 22 },
  infoHighlight: { color: "#818cf8", fontWeight: "700" },
  bookBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  bookBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

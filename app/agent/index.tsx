import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function AgentIndexScreen() {
  const { passenger } = usePassenger();
  const colors = useColors();

  const { data: agentStatus, isLoading, refetch } = trpc.agents.getMyStatus.useQuery(
    { passengerId: passenger?.id ?? 0 },
    { enabled: !!passenger?.id }
  );
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const { data: monthlyStats } = trpc.agents.getMonthlyStats.useQuery(
    { agentId: agentStatus?.id ?? 0, months: 6 },
    { enabled: !!agentStatus?.id && agentStatus?.status === "approved" }
  );

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2ECC71" />
        </View>
      </ScreenContainer>
    );
  }

  // لم يتقدم بعد
  if (!agentStatus) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>كن وكيلاً معتمداً</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroCard}>
            <Text style={styles.heroIcon}>💼</Text>
            <Text style={styles.heroTitle}>وكيل معتمد مسار</Text>
            <Text style={styles.heroDesc}>
              انضم لشبكة وكلاء مسار المعتمدين وابدأ بشحن رصيد الكابتنات والمستخدمين في منطقتك
            </Text>
          </View>

          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>مزايا الوكيل المعتمد</Text>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>💰</Text>
              <Text style={styles.benefitText}>اشحن رصيد الكابتنات والمستخدمين من رصيدك</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>📊</Text>
              <Text style={styles.benefitText}>تتبع جميع معاملاتك وأرباحك</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>🏆</Text>
              <Text style={styles.benefitText}>شارة وكيل معتمد موثوق</Text>
            </View>
            <View style={styles.benefit}>
              <Text style={styles.benefitIcon}>🔒</Text>
              <Text style={styles.benefitText}>نظام آمن ومضمون</Text>
            </View>
          </View>

          <View style={styles.requirementsCard}>
            <Text style={styles.requirementsTitle}>متطلبات التسجيل</Text>
            <Text style={styles.requirementItem}>• صورة بصمة الوجه</Text>
            <Text style={styles.requirementItem}>• صورة البطاقة الوطنية (أمامية + خلفية)</Text>
            <Text style={styles.requirementItem}>• صورة المكتب أو نقطة العمل</Text>
            <Text style={styles.requirementItem}>• عنوان المكتب (نصي + GPS)</Text>
          </View>

          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => router.push("/agent/register" as any)}
          >
            <Text style={styles.applyBtnText}>تقديم طلب الانضمام</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // قيد المراجعة
  if (agentStatus.status === "pending") {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>طلب الوكيل</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.statusContainer}>
          <Text style={styles.statusIcon}>⏳</Text>
          <Text style={styles.statusTitle}>طلبك قيد المراجعة</Text>
          <Text style={styles.statusDesc}>
            تم استلام طلبك وسيتم مراجعته من قِبل فريق مسار خلال 24-48 ساعة.
            ستصلك إشعار عند اتخاذ القرار.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // مرفوض
  if (agentStatus.status === "rejected") {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>طلب الوكيل</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.statusContainer}>
          <Text style={styles.statusIcon}>❌</Text>
          <Text style={styles.statusTitle}>تم رفض طلبك</Text>
          {agentStatus.rejectionReason && (
            <Text style={styles.statusDesc}>السبب: {agentStatus.rejectionReason}</Text>
          )}
          <TouchableOpacity
            style={[styles.applyBtn, { marginTop: 24 }]}
            onPress={() => router.push("/agent/register" as any)}
          >
            <Text style={styles.applyBtnText}>إعادة التقديم</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // معلق
  if (agentStatus.status === "suspended") {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>→</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>حساب الوكيل</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.statusContainer}>
          <Text style={styles.statusIcon}>🚫</Text>
          <Text style={styles.statusTitle}>حسابك موقوف مؤقتاً</Text>
          <Text style={styles.statusDesc}>
            تم إيقاف حسابك مؤقتاً. تواصل مع الدعم الفني لمزيد من المعلومات.
          </Text>
          <TouchableOpacity
            style={[styles.applyBtn, { marginTop: 24 }]}
            onPress={() => router.push("/support/new" as any)}
          >
            <Text style={styles.applyBtnText}>تواصل مع الدعم</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // مقبول - لوحة الوكيل
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>لوحة الوكيل</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {/* بطاقة الرصيد */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>رصيدك الحالي</Text>
          <Text style={styles.balanceAmount}>
            {Number(agentStatus.balance).toLocaleString("ar-IQ")} د.ع
          </Text>
          <View style={styles.balanceStats}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatValue}>{agentStatus.totalRecharges}</Text>
              <Text style={styles.balanceStatLabel}>عملية شحن</Text>
            </View>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatValue}>
                {Number(agentStatus.totalRechargeAmount).toLocaleString("ar-IQ")}
              </Text>
              <Text style={styles.balanceStatLabel}>إجمالي المشحون (د.ع)</Text>
            </View>
          </View>
        </View>

        {/* زر الشحن */}
        <TouchableOpacity
          style={styles.rechargeBtn}
          onPress={() => router.push("/agent/recharge" as any)}
        >
          <Text style={styles.rechargeBtnIcon}>⚡</Text>
          <Text style={styles.rechargeBtnText}>شحن رصيد كابتن أو مستخدم</Text>
        </TouchableOpacity>

        {/* سجل المعاملات */}
        <TouchableOpacity
          style={styles.transactionsBtn}
          onPress={() => router.push("/agent/transactions" as any)}
        >
          <Text style={styles.transactionsBtnText}>📋  سجل المعاملات</Text>
        </TouchableOpacity>

        {/* التقرير المالي الشهري */}
        {monthlyStats && monthlyStats.length > 0 && (
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>📊 التقرير المالي الشهري</Text>

            {/* Month Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {monthlyStats.map((m, idx) => {
                  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.monthChip, selectedMonthIdx === idx && styles.monthChipActive]}
                      onPress={() => setSelectedMonthIdx(idx)}
                    >
                      <Text style={[styles.monthChipText, selectedMonthIdx === idx && styles.monthChipTextActive]}>
                        {monthNames[m.month - 1]}
                      </Text>
                      <Text style={[styles.monthChipYear, selectedMonthIdx === idx && styles.monthChipTextActive]}>
                        {m.year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Selected Month Stats */}
            {monthlyStats[selectedMonthIdx] && (() => {
              const m = monthlyStats[selectedMonthIdx]!;
              return (
                <View>
                  <View style={styles.reportStatsRow}>
                    <View style={styles.reportStatBox}>
                      <Text style={styles.reportStatIcon}>💰</Text>
                      <Text style={styles.reportStatValue}>
                        {m.totalAmount.toLocaleString("ar-IQ")}
                      </Text>
                      <Text style={styles.reportStatLabel}>إجمالي المشحون (د.ع)</Text>
                    </View>
                    <View style={styles.reportStatBox}>
                      <Text style={styles.reportStatIcon}>🔢</Text>
                      <Text style={styles.reportStatValue}>{m.operationsCount}</Text>
                      <Text style={styles.reportStatLabel}>عدد العمليات</Text>
                    </View>
                  </View>
                  <View style={styles.reportStatsRow}>
                    <View style={[styles.reportStatBox, { borderColor: "#3B82F6" }]}>
                      <Text style={styles.reportStatIcon}>🚗</Text>
                      <Text style={[styles.reportStatValue, { color: "#3B82F6" }]}>{m.driversCount}</Text>
                      <Text style={styles.reportStatLabel}>شحن للكابتنات</Text>
                    </View>
                    <View style={[styles.reportStatBox, { borderColor: "#8B5CF6" }]}>
                      <Text style={styles.reportStatIcon}>👤</Text>
                      <Text style={[styles.reportStatValue, { color: "#8B5CF6" }]}>{m.passengersCount}</Text>
                      <Text style={styles.reportStatLabel}>شحن للمستخدمين</Text>
                    </View>
                  </View>
                  {m.operationsCount === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 12 }}>
                      <Text style={{ color: "#9CA3AF", fontSize: 14 }}>لا توجد عمليات هذا الشهر</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* 6-Month Bar Chart (simple visual) */}
            <View style={{ marginTop: 16 }}>
              <Text style={styles.reportChartTitle}>مقارنة آخر 6 أشهر</Text>
              <View style={styles.barChart}>
                {[...monthlyStats].reverse().map((m, idx) => {
                  const maxAmount = Math.max(...monthlyStats.map(x => x.totalAmount), 1);
                  const barHeight = Math.max((m.totalAmount / maxAmount) * 80, 4);
                  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
                  const isSelected = selectedMonthIdx === (monthlyStats.length - 1 - idx);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={styles.barItem}
                      onPress={() => setSelectedMonthIdx(monthlyStats.length - 1 - idx)}
                    >
                      <Text style={[styles.barAmount, isSelected && { color: "#2ECC71" }]}>
                        {m.totalAmount > 0 ? (m.totalAmount / 1000).toFixed(0) + "k" : ""}
                      </Text>
                      <View style={[styles.bar, { height: barHeight, backgroundColor: isSelected ? "#2ECC71" : "#1A3A2A" }]} />
                      <Text style={[styles.barLabel, isSelected && { color: "#2ECC71" }]}>
                        {monthNames[m.month - 1]?.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 22, color: "#2ECC71" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#11181C" },
  content: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: "#1A3A2A",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  heroIcon: { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#2ECC71", marginBottom: 8 },
  heroDesc: { fontSize: 14, color: "#A8D8C0", textAlign: "center", lineHeight: 22 },
  benefitsCard: {
    backgroundColor: "#F8FFF9",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  benefitsTitle: { fontSize: 16, fontWeight: "700", color: "#065F46", marginBottom: 12, textAlign: "right" },
  benefit: { flexDirection: "row-reverse", alignItems: "center", marginBottom: 10 },
  benefitIcon: { fontSize: 18, marginLeft: 10 },
  benefitText: { fontSize: 14, color: "#374151", flex: 1, textAlign: "right" },
  requirementsCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  requirementsTitle: { fontSize: 16, fontWeight: "700", color: "#92400E", marginBottom: 10, textAlign: "right" },
  requirementItem: { fontSize: 14, color: "#78350F", marginBottom: 6, textAlign: "right" },
  applyBtn: {
    backgroundColor: "#2ECC71",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  applyBtnText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  statusContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  statusIcon: { fontSize: 64, marginBottom: 16 },
  statusTitle: { fontSize: 22, fontWeight: "800", color: "#11181C", marginBottom: 12 },
  statusDesc: { fontSize: 15, color: "#687076", textAlign: "center", lineHeight: 24 },
  balanceCard: {
    backgroundColor: "#1A3A2A",
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    alignItems: "center",
  },
  balanceLabel: { fontSize: 14, color: "#A8D8C0", marginBottom: 8 },
  balanceAmount: { fontSize: 32, fontWeight: "800", color: "#2ECC71", marginBottom: 16 },
  balanceStats: { flexDirection: "row", gap: 32 },
  balanceStat: { alignItems: "center" },
  balanceStatValue: { fontSize: 18, fontWeight: "700", color: "#fff" },
  balanceStatLabel: { fontSize: 12, color: "#A8D8C0", marginTop: 2 },
  rechargeBtn: {
    backgroundColor: "#2ECC71",
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  rechargeBtnIcon: { fontSize: 20 },
  rechargeBtnText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  transactionsBtn: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  transactionsBtnText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  reportCard: {
    backgroundColor: "#0D1F17",
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#1A3A2A",
  },
  reportTitle: { fontSize: 16, fontWeight: "800", color: "#2ECC71", marginBottom: 16, textAlign: "right" as const },
  monthChip: {
    backgroundColor: "#1A3A2A",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center" as const,
    minWidth: 70,
  },
  monthChipActive: { backgroundColor: "#2ECC71" },
  monthChipText: { fontSize: 13, color: "#A8D8C0", fontWeight: "600" as const },
  monthChipYear: { fontSize: 10, color: "#6B9E80", marginTop: 2 },
  monthChipTextActive: { color: "#0D1F17" },
  reportStatsRow: { flexDirection: "row" as const, gap: 10, marginBottom: 10 },
  reportStatBox: {
    flex: 1,
    backgroundColor: "#1A3A2A",
    borderRadius: 14,
    padding: 14,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "#2ECC71",
  },
  reportStatIcon: { fontSize: 22, marginBottom: 4 },
  reportStatValue: { fontSize: 18, fontWeight: "800" as const, color: "#2ECC71", marginBottom: 2 },
  reportStatLabel: { fontSize: 11, color: "#A8D8C0", textAlign: "center" as const },
  reportChartTitle: { fontSize: 13, color: "#A8D8C0", fontWeight: "700" as const, marginBottom: 10, textAlign: "right" as const },
  barChart: { flexDirection: "row" as const, alignItems: "flex-end" as const, justifyContent: "space-around" as const, height: 110 },
  barItem: { alignItems: "center" as const, flex: 1 },
  barAmount: { fontSize: 9, color: "#6B9E80", marginBottom: 2 },
  bar: { width: 24, borderRadius: 4, marginBottom: 4 },
  barLabel: { fontSize: 10, color: "#6B9E80" },
});

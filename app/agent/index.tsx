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
});

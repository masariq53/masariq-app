import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeContext } from "@/lib/theme-provider";

const transactions = [
  { id: "1", type: "credit", label: "شحن رصيد", amount: "+25,000", date: "اليوم", icon: "💰" },
  { id: "2", type: "debit", label: "رحلة - حي الجامعة", amount: "-3,500", date: "أمس", icon: "🚗" },
  { id: "3", type: "debit", label: "توصيل طرد", amount: "-5,000", date: "01/04", icon: "📦" },
  { id: "4", type: "credit", label: "استرداد رحلة ملغاة", amount: "+4,000", date: "30/03", icon: "↩️" },
  { id: "5", type: "debit", label: "رحلة - المستشفى", amount: "-2,500", date: "29/03", icon: "🚗" },
];

const quickAmounts = ["10,000", "25,000", "50,000", "100,000"];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("");
  const [showTopup, setShowTopup] = useState(false);
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  const colors = {
    scrollBg: isDark ? "#0D0019" : "#F5F7FA",
    sectionTitle: isDark ? "#C4B5D4" : "#1A0533",
    txCard: isDark ? "#1E0F4A" : "#FFFFFF",
    txLabel: isDark ? "#FFFFFF" : "#1A0533",
    txIconBg: isDark ? "#2D1B69" : "#F5F7FA",
    topupForm: isDark ? "#1E0F4A" : "#FFFFFF",
    topupTitle: isDark ? "#FFFFFF" : "#1A0533",
    inputBg: isDark ? "#2D1B69" : "#F5F7FA",
    inputText: isDark ? "#FFFFFF" : "#1A0533",
    inputBorder: isDark ? "#3D2580" : "#E2E8F0",
    qaChip: isDark ? "#2D1B69" : "#F5F7FA",
    qaText: isDark ? "#C4B5D4" : "#6B7A8D",
    placeholder: isDark ? "#6B5A8A" : "#9BA1A6",
  };

  const handleTopup = () => {
    if (!amount) return;
    Alert.alert("تم الشحن!", `تم إضافة ${amount} د.ع إلى محفظتك بنجاح ✅`);
    setAmount("");
    setShowTopup(false);
  };

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
        <Text style={styles.balanceAmount}>18,000 د.ع</Text>
        <View style={styles.balanceRow}>
          <TouchableOpacity style={styles.topupBtn} onPress={() => router.push("/topup")}>
            <Text style={styles.topupBtnText}>+ شحن الرصيد</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.transferBtn}>
            <Text style={styles.transferBtnText}>↗ تحويل</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top-up Form */}
      {showTopup && (
        <View style={[styles.topupForm, { backgroundColor: colors.topupForm }]}>
          <Text style={[styles.topupTitle, { color: colors.topupTitle }]}>شحن الرصيد</Text>
          <View style={styles.quickAmounts}>
            {quickAmounts.map((qa) => (
              <TouchableOpacity
                key={qa}
                style={[
                  styles.qaChip,
                  { backgroundColor: colors.qaChip },
                  amount === qa && styles.qaChipActive,
                ]}
                onPress={() => setAmount(qa)}
              >
                <Text style={[styles.qaText, { color: colors.qaText }, amount === qa && styles.qaTextActive]}>
                  {qa}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.amountInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
            placeholder="أو أدخل مبلغاً آخر"
            placeholderTextColor={colors.placeholder}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            textAlign="right"
          />
          <TouchableOpacity style={styles.confirmTopupBtn} onPress={handleTopup}>
            <Text style={styles.confirmTopupText}>تأكيد الشحن</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Transactions */}
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.scrollBg }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>سجل المعاملات</Text>
        {transactions.map((tx) => (
          <View key={tx.id} style={[styles.txCard, { backgroundColor: colors.txCard }]}>
            <View style={styles.txLeft}>
              <Text style={[styles.txAmount, { color: tx.type === "credit" ? "#22C55E" : "#EF4444" }]}>
                {tx.amount} د.ع
              </Text>
              <Text style={styles.txDate}>{tx.date}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={[styles.txLabel, { color: colors.txLabel }]}>{tx.label}</Text>
            </View>
            <View style={[styles.txIcon, { backgroundColor: colors.txIconBg }]}>
              <Text style={styles.txIconText}>{tx.icon}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  transferBtn: {
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  transferBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  topupForm: { marginHorizontal: 16, borderRadius: 20, padding: 16, marginBottom: 8, gap: 12 },
  topupTitle: { fontSize: 16, fontWeight: "800", textAlign: "right" },
  quickAmounts: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  qaChip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: "transparent" },
  qaChipActive: { borderColor: "#FFD700", backgroundColor: "#FFF8EC" },
  qaText: { fontSize: 13, fontWeight: "600" },
  qaTextActive: { color: "#FFD700" },
  amountInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1.5 },
  confirmTopupBtn: { backgroundColor: "#FFD700", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  confirmTopupText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
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
  txLabel: { fontSize: 14, fontWeight: "600" },
  txLeft: { alignItems: "flex-end" },
  txAmount: { fontSize: 15, fontWeight: "800" },
  txDate: { color: "#9BA1A6", fontSize: 11, marginTop: 2 },
});

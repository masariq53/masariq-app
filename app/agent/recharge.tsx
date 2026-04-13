import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";

export default function AgentRechargeScreen() {
  const { passenger } = usePassenger();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<{
    id: number;
    name: string | null;
    phone: string;
    walletBalance: string;
    type: "driver" | "passenger";
  } | null>(null);

  const { data: agentStatus } = trpc.agents.getMyStatus.useQuery(
    { passengerId: passenger?.id ?? 0 },
    { enabled: !!passenger?.id }
  );

  const searchMutation = trpc.agents.searchRecipient.useQuery(
    { phone: phone.trim() },
    { enabled: false }
  );

  const rechargeMutation = trpc.agents.recharge.useMutation();

  const normalizePhone = (p: string) => {
    let ph = p.replace(/\s/g, "");
    if (ph.startsWith("0")) ph = "+964" + ph.slice(1);
    else if (!ph.startsWith("+")) ph = "+964" + ph;
    return ph;
  };

  const handleSearch = async () => {
    if (!phone.trim()) {
      Alert.alert("خطأ", "أدخل رقم الهاتف");
      return;
    }
    setSearching(true);
    setRecipient(null);
    try {
      const normalized = normalizePhone(phone.trim());
      const result = await searchMutation.refetch();
      if (result.data) {
        setRecipient(result.data as any);
      } else {
        Alert.alert("غير موجود", "لم يتم العثور على مستخدم بهذا الرقم");
      }
    } catch (err: any) {
      Alert.alert("خطأ", err.message);
    }
    setSearching(false);
  };

  const handleRecharge = async () => {
    if (!agentStatus || agentStatus.status !== "approved") {
      Alert.alert("خطأ", "حسابك غير مفعّل");
      return;
    }
    if (!recipient) {
      Alert.alert("خطأ", "ابحث عن المستخدم أولاً");
      return;
    }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert("خطأ", "أدخل مبلغاً صحيحاً");
      return;
    }
    if (amountNum > Number(agentStatus.balance)) {
      Alert.alert("رصيد غير كافٍ", `رصيدك الحالي: ${Number(agentStatus.balance).toLocaleString("ar-IQ")} د.ع`);
      return;
    }

    Alert.alert(
      "تأكيد الشحن",
      `هل تريد شحن ${amountNum.toLocaleString("ar-IQ")} د.ع لـ ${recipient.name || recipient.phone}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تأكيد",
          onPress: async () => {
            try {
              await rechargeMutation.mutateAsync({
                agentId: agentStatus.id,
                recipientType: recipient.type,
                recipientId: recipient.id,
                amount: amountNum,
                notes: notes.trim() || undefined,
              });
              Alert.alert(
                "تم الشحن",
                `تم شحن ${amountNum.toLocaleString("ar-IQ")} د.ع بنجاح!`,
                [{ text: "حسناً", onPress: () => router.back() }]
              );
            } catch (err: any) {
              Alert.alert("خطأ", err.message || "فشل الشحن");
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>شحن رصيد</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* رصيد الوكيل */}
        {agentStatus && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>رصيدك المتاح</Text>
            <Text style={styles.balanceAmount}>
              {Number(agentStatus.balance).toLocaleString("ar-IQ")} د.ع
            </Text>
          </View>
        )}

        {/* البحث عن المستخدم */}
        <Text style={styles.sectionTitle}>رقم هاتف المستخدم أو السائق</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.phoneInput}
            placeholder="07xxxxxxxxx"
            placeholderTextColor="#9CA3AF"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textAlign="right"
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>بحث</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* نتيجة البحث */}
        {recipient && (
          <View style={styles.recipientCard}>
            <Text style={styles.recipientType}>
              {recipient.type === "driver" ? "🚗 سائق" : "👤 مستخدم"}
            </Text>
            <Text style={styles.recipientName}>{recipient.name || "—"}</Text>
            <Text style={styles.recipientPhone}>{recipient.phone}</Text>
            <Text style={styles.recipientBalance}>
              الرصيد الحالي: {Number(recipient.walletBalance).toLocaleString("ar-IQ")} د.ع
            </Text>
          </View>
        )}

        {/* المبلغ */}
        <Text style={styles.sectionTitle}>المبلغ (دينار عراقي)</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="مثال: 10000"
          placeholderTextColor="#9CA3AF"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          textAlign="right"
        />

        {/* مبالغ سريعة */}
        <View style={styles.quickAmounts}>
          {[5000, 10000, 25000, 50000].map((a) => (
            <TouchableOpacity
              key={a}
              style={styles.quickAmountBtn}
              onPress={() => setAmount(String(a))}
            >
              <Text style={styles.quickAmountText}>{a.toLocaleString("ar-IQ")}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ملاحظات */}
        <Text style={styles.sectionTitle}>ملاحظات (اختياري)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="أي ملاحظات إضافية..."
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
          textAlign="right"
          multiline
        />

        {/* زر الشحن */}
        <TouchableOpacity
          style={[styles.rechargeBtn, rechargeMutation.isPending && { opacity: 0.7 }]}
          onPress={handleRecharge}
          disabled={rechargeMutation.isPending}
        >
          {rechargeMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.rechargeBtnText}>⚡  تأكيد الشحن</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  content: { padding: 16, paddingBottom: 60 },
  balanceCard: {
    backgroundColor: "#1A3A2A",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  balanceLabel: { fontSize: 13, color: "#A8D8C0", marginBottom: 6 },
  balanceAmount: { fontSize: 28, fontWeight: "800", color: "#2ECC71" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#A8D8C0", marginBottom: 8, textAlign: "right" },
  searchRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  phoneInput: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3D2B5E",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#ECEDEE",
  },
  searchBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  recipientCard: {
    backgroundColor: "#0D2A1A",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2ECC71",
    alignItems: "flex-end",
  },
  recipientType: { fontSize: 13, color: "#A8D8C0", marginBottom: 4 },
  recipientName: { fontSize: 18, fontWeight: "700", color: "#ECEDEE", marginBottom: 2 },
  recipientPhone: { fontSize: 14, color: "#A8D8C0", marginBottom: 4 },
  recipientBalance: { fontSize: 14, color: "#2ECC71", fontWeight: "600" },
  amountInput: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3D2B5E",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    color: "#ECEDEE",
    marginBottom: 10,
    fontWeight: "700",
  },
  quickAmounts: {
    flexDirection: "row-reverse",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  quickAmountBtn: {
    backgroundColor: "#1A3A2A",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#2ECC71",
  },
  quickAmountText: { fontSize: 14, color: "#2ECC71", fontWeight: "600" },
  notesInput: {
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3D2B5E",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#ECEDEE",
    marginBottom: 20,
    minHeight: 60,
  },
  rechargeBtn: {
    backgroundColor: "#2ECC71",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  rechargeBtnText: { fontSize: 17, fontWeight: "700", color: "#fff" },
});

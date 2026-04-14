import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";

type PaymentMethod = "mastercard" | "zaincash" | "fib";

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

function formatAmount(n: number) {
  return n.toLocaleString("ar-IQ");
}

export default function PassengerTopupScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = usePassenger();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const paymentMethodsQuery = trpc.wallet.getPaymentMethods.useQuery();
  const requestTopupMutation = trpc.wallet.requestTopup.useMutation();

  const methods = (paymentMethodsQuery.data ?? []).filter((m: any) => m.isActive);
  const selectedMethodData = methods.find((m: any) => m.method === selectedMethod);

  const amountNum = parseInt(amount.replace(/,/g, ""), 10);
  const isValidAmount = !isNaN(amountNum) && amountNum >= 1000;

  const handleSubmit = async () => {
    if (!passenger?.id || !selectedMethod || !isValidAmount) return;
    try {
      await requestTopupMutation.mutateAsync({
        userId: passenger.id,
        userType: "passenger",
        paymentMethod: selectedMethod,
        amount: amountNum,
        note: note.trim() || undefined,
      });
      setShowConfirm(false);
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "حدث خطأ، حاول مجدداً");
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>تم إرسال طلبك بنجاح!</Text>
          <Text style={styles.successSubtitle}>
            سيتم مراجعة طلبك من قِبل الإدارة وإضافة الرصيد إلى محفظتك خلال وقت قصير.
          </Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.back()}>
            <Text style={styles.successBtnText}>العودة للمحفظة</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>شحن المحفظة</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Amount Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المبلغ المطلوب شحنه</Text>
          <View style={styles.amountInputRow}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="أدخل المبلغ"
              placeholderTextColor="#9BA1A6"
              textAlign="right"
            />
            <Text style={styles.currencyLabel}>د.ع</Text>
          </View>
          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.quickBtn, amount === q.toString() && styles.quickBtnActive]}
                onPress={() => setAmount(q.toString())}
              >
                <Text style={[styles.quickBtnText, amount === q.toString() && styles.quickBtnTextActive]}>
                  {formatAmount(q)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>طريقة الدفع</Text>
          {paymentMethodsQuery.isLoading ? (
            <ActivityIndicator color="#0a7ea4" />
          ) : methods.length === 0 ? (
            <Text style={styles.noMethodsText}>لا توجد طرق دفع متاحة حالياً</Text>
          ) : (
            methods.map((m: any) => (
              <TouchableOpacity
                key={m.method}
                style={[styles.methodCard, selectedMethod === m.method && styles.methodCardActive]}
                onPress={() => setSelectedMethod(m.method)}
              >
                <View style={styles.methodRow}>
                  <View style={[styles.radioCircle, selectedMethod === m.method && styles.radioCircleActive]}>
                    {selectedMethod === m.method && <View style={styles.radioDot} />}
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodName}>{m.displayName ?? m.method}</Text>
                    {m.accountNumber && (
                      <Text style={styles.methodAccount}>رقم الحساب: {m.accountNumber}</Text>
                    )}
                    {m.accountName && (
                      <Text style={styles.methodAccountName}>الاسم: {m.accountName}</Text>
                    )}
                  </View>
                  <Text style={styles.methodIcon}>
                    {m.method === "mastercard" ? "💳" : m.method === "zaincash" ? "📱" : "🏦"}
                  </Text>
                </View>
                {selectedMethod === m.method && m.instructions && (
                  <View style={styles.instructionsBox}>
                    <Text style={styles.instructionsText}>{m.instructions}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملاحظة (اختياري)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="مثال: تم التحويل الساعة 3 مساءً"
            placeholderTextColor="#9BA1A6"
            multiline
            numberOfLines={3}
            textAlign="right"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!selectedMethod || !isValidAmount) && styles.submitBtnDisabled]}
          onPress={() => setShowConfirm(true)}
          disabled={!selectedMethod || !isValidAmount}
        >
          <Text style={styles.submitBtnText}>إرسال طلب الشحن</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          * بعد إرسال الطلب، سيتم مراجعته من الإدارة وإضافة الرصيد خلال وقت قصير.
        </Text>
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>تأكيد طلب الشحن</Text>
            <Text style={styles.modalLine}>المبلغ: <Text style={styles.modalValue}>{formatAmount(amountNum)} د.ع</Text></Text>
            <Text style={styles.modalLine}>طريقة الدفع: <Text style={styles.modalValue}>{selectedMethodData?.displayName ?? selectedMethod}</Text></Text>
            {note ? <Text style={styles.modalLine}>ملاحظة: <Text style={styles.modalValue}>{note}</Text></Text> : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirm(false)}
                disabled={requestTopupMutation.isPending}
              >
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSubmit}
                disabled={requestTopupMutation.isPending}
              >
                {requestTopupMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>تأكيد الإرسال</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 22, color: "#0a7ea4" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#11181C" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#11181C", marginBottom: 12, textAlign: "right" },
  amountInputRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  amountInput: { flex: 1, fontSize: 22, fontWeight: "800", color: "#0a7ea4", paddingVertical: 12 },
  currencyLabel: { fontSize: 16, color: "#687076", marginLeft: 8 },
  quickAmounts: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginTop: 12 },
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quickBtnActive: { backgroundColor: "#0a7ea4", borderColor: "#0a7ea4" },
  quickBtnText: { fontSize: 13, color: "#687076", fontWeight: "600" },
  quickBtnTextActive: { color: "#FFFFFF" },
  methodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  methodCardActive: { borderColor: "#0a7ea4" },
  methodRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#9BA1A6",
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleActive: { borderColor: "#0a7ea4" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0a7ea4" },
  methodInfo: { flex: 1, alignItems: "flex-end" },
  methodName: { fontSize: 15, fontWeight: "700", color: "#11181C" },
  methodAccount: { fontSize: 12, color: "#687076", marginTop: 3 },
  methodAccountName: { fontSize: 12, color: "#687076" },
  methodIcon: { fontSize: 28 },
  instructionsBox: {
    marginTop: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  instructionsText: { fontSize: 13, color: "#1D4ED8", textAlign: "right", lineHeight: 20 },
  noMethodsText: { color: "#687076", textAlign: "center", marginTop: 12 },
  noteInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    color: "#11181C",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: "#0a7ea4",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  disclaimer: { fontSize: 12, color: "#9BA1A6", textAlign: "center", lineHeight: 18 },
  successContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  successIcon: { fontSize: 64, marginBottom: 20 },
  successTitle: { fontSize: 22, fontWeight: "800", color: "#11181C", marginBottom: 12 },
  successSubtitle: { fontSize: 14, color: "#687076", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  successBtn: { backgroundColor: "#0a7ea4", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  successBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalBox: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "85%", borderWidth: 1, borderColor: "#E5E7EB" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#11181C", textAlign: "center", marginBottom: 16 },
  modalLine: { fontSize: 14, color: "#687076", textAlign: "right", marginBottom: 8 },
  modalValue: { color: "#0a7ea4", fontWeight: "700" },
  modalBtns: { flexDirection: "row-reverse", gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, backgroundColor: "#F5F7FA", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { color: "#687076", fontWeight: "600" },
  modalConfirmBtn: { flex: 1, backgroundColor: "#0a7ea4", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  modalConfirmText: { color: "#FFFFFF", fontWeight: "700" },
});

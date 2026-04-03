import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";

type Step = "enter_new_phone" | "verify_old_otp" | "verify_new_otp";

export default function ChangePhoneScreen() {
  const router = useRouter();
  const { passenger, setPassenger } = usePassenger();

  const [step, setStep] = useState<Step>("enter_new_phone");
  const [newPhone, setNewPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [oldOtp, setOldOtp] = useState(["", "", "", "", "", ""]);
  const [newOtp, setNewOtp] = useState(["", "", "", "", "", ""]);
  const [devMsg, setDevMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const oldOtpRefs = useRef<(TextInput | null)[]>([]);
  const newOtpRefs = useRef<(TextInput | null)[]>([]);

  const requestPhoneChangeMutation = trpc.passenger.requestPhoneChange.useMutation();
  const verifyOldPhoneOtpMutation = trpc.passenger.verifyOldPhoneOtp.useMutation();
  const verifyNewPhoneOtpMutation = trpc.passenger.verifyNewPhoneOtp.useMutation();

  // ─── Step 1: Submit new phone ──────────────────────────────────────────────
  const handleSubmitNewPhone = async () => {
    const cleaned = newPhone.replace(/\s/g, "");
    if (cleaned.length < 10 || cleaned.length > 11) {
      setPhoneError("رقم الهاتف يجب أن يكون 10 أو 11 رقماً");
      return;
    }
    if (!/^\d+$/.test(cleaned)) {
      setPhoneError("أدخل أرقاماً فقط بدون مسافات أو رموز");
      return;
    }
    setPhoneError("");
    setIsLoading(true);
    try {
      const res = await requestPhoneChangeMutation.mutateAsync({
        passengerId: passenger!.id,
        newPhone: cleaned,
      });
      setDevMsg(res.message || "");
      setStep("verify_old_otp");
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في إرسال الطلب");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2: Verify OTP on OLD phone ──────────────────────────────────────
  const handleVerifyOldOtp = async () => {
    const code = oldOtp.join("");
    if (code.length !== 6) {
      Alert.alert("خطأ", "أدخل الرمز المكون من 6 أرقام");
      return;
    }
    setIsLoading(true);
    try {
      const res = await verifyOldPhoneOtpMutation.mutateAsync({
        passengerId: passenger!.id,
        code,
      });
      setDevMsg(res.message || "");
      setStep("verify_new_otp");
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "رمز التحقق غير صحيح");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 3: Verify OTP on NEW phone ──────────────────────────────────────
  const handleVerifyNewOtp = async () => {
    const code = newOtp.join("");
    if (code.length !== 6) {
      Alert.alert("خطأ", "أدخل الرمز المكون من 6 أرقام");
      return;
    }
    setIsLoading(true);
    try {
      const res = await verifyNewPhoneOtpMutation.mutateAsync({
        passengerId: passenger!.id,
        code,
      });
      // Update context with new phone
      if (passenger && res.newPhone) {
        await setPassenger({ ...passenger, phone: res.newPhone });
      }
      Alert.alert("✅ تم بنجاح", "تم تغيير رقم هاتفك بنجاح", [
        { text: "حسناً", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "رمز التحقق غير صحيح");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── OTP input handler ─────────────────────────────────────────────────────
  const handleOtpChange = (
    val: string,
    idx: number,
    otp: string[],
    setOtp: (v: string[]) => void,
    refs: React.MutableRefObject<(TextInput | null)[]>
  ) => {
    const newArr = [...otp];
    newArr[idx] = val.replace(/[^0-9]/g, "").slice(-1);
    setOtp(newArr);
    if (val && idx < 5) refs.current[idx + 1]?.focus();
    if (!val && idx > 0) refs.current[idx - 1]?.focus();
  };

  // ─── Render OTP boxes ──────────────────────────────────────────────────────
  const renderOtpBoxes = (
    otp: string[],
    setOtp: (v: string[]) => void,
    refs: React.MutableRefObject<(TextInput | null)[]>
  ) => (
    <View style={styles.otpRow}>
      {otp.map((digit, idx) => (
        <TextInput
          key={idx}
          ref={(r) => { refs.current[idx] = r; }}
          style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
          value={digit}
          onChangeText={(v) => handleOtpChange(v, idx, otp, setOtp, refs)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectTextOnFocus
        />
      ))}
    </View>
  );

  // ─── Step indicator ────────────────────────────────────────────────────────
  const stepLabels = ["رقم جديد", "تحقق القديم", "تحقق الجديد"];
  const currentStepIdx = step === "enter_new_phone" ? 0 : step === "verify_old_otp" ? 1 : 2;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تغيير رقم الهاتف</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            {stepLabels.map((label, idx) => (
              <View key={idx} style={styles.stepItem}>
                <View style={[styles.stepDot, idx <= currentStepIdx && styles.stepDotActive]}>
                  <Text style={[styles.stepNum, idx <= currentStepIdx && styles.stepNumActive]}>
                    {idx + 1}
                  </Text>
                </View>
                <Text style={[styles.stepLabel, idx <= currentStepIdx && styles.stepLabelActive]}>
                  {label}
                </Text>
                {idx < 2 && <View style={[styles.stepLine, idx < currentStepIdx && styles.stepLineActive]} />}
              </View>
            ))}
          </View>

          {/* Dev hint */}
          {devMsg ? (
            <View style={styles.devHint}>
              <Text style={styles.devHintText}>🔧 وضع التطوير: {devMsg}</Text>
            </View>
          ) : null}

          {/* ── Step 1: Enter new phone ── */}
          {step === "enter_new_phone" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>أدخل رقمك الجديد</Text>
              <Text style={styles.cardSubtitle}>
                سنرسل رمز تحقق إلى رقمك الحالي {passenger?.phone} أولاً للتأكد من هويتك
              </Text>
              <View style={[styles.inputWrapper, phoneError ? styles.inputWrapperError : null]}>
                <Text style={styles.prefix}>+964</Text>
                <TextInput
                  style={styles.phoneInput}
                  value={newPhone}
                  onChangeText={(t) => {
                    setNewPhone(t.replace(/[^0-9]/g, ""));
                    setPhoneError("");
                  }}
                  placeholder="07xxxxxxxxx"
                  placeholderTextColor="#9BA1A6"
                  keyboardType="number-pad"
                  maxLength={11}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmitNewPhone}
                />
              </View>
              {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
              <TouchableOpacity
                style={[styles.btn, isLoading && styles.btnDisabled]}
                onPress={handleSubmitNewPhone}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="#1a0533" size="small" /> : <Text style={styles.btnText}>إرسال رمز التحقق</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2: Verify OLD phone OTP ── */}
          {step === "verify_old_otp" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>تحقق من رقمك الحالي</Text>
              <Text style={styles.cardSubtitle}>
                أدخل الرمز المرسل إلى رقمك الحالي{"\n"}{passenger?.phone}
              </Text>
              {renderOtpBoxes(oldOtp, setOldOtp, oldOtpRefs)}
              <TouchableOpacity
                style={[styles.btn, isLoading && styles.btnDisabled]}
                onPress={handleVerifyOldOtp}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="#1a0533" size="small" /> : <Text style={styles.btnText}>تأكيد</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 3: Verify NEW phone OTP ── */}
          {step === "verify_new_otp" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>تحقق من رقمك الجديد</Text>
              <Text style={styles.cardSubtitle}>
                أدخل الرمز المرسل إلى رقمك الجديد{"\n"}{newPhone.startsWith("0") ? "+964" + newPhone.slice(1) : "+964" + newPhone}
              </Text>
              {renderOtpBoxes(newOtp, setNewOtp, newOtpRefs)}
              <TouchableOpacity
                style={[styles.btn, isLoading && styles.btnDisabled]}
                onPress={handleVerifyNewOtp}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="#1a0533" size="small" /> : <Text style={styles.btnText}>تأكيد وتغيير الرقم</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a0533",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backIcon: { color: "#fff", fontSize: 20, transform: [{ scaleX: -1 }] },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  content: { padding: 20, gap: 20 },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingVertical: 8,
  },
  stepItem: { alignItems: "center", position: "relative" },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
  },
  stepDotActive: { backgroundColor: "#1a0533" },
  stepNum: { color: "#9BA1A6", fontSize: 14, fontWeight: "700" },
  stepNumActive: { color: "#f0c040" },
  stepLabel: { color: "#9BA1A6", fontSize: 11, marginTop: 4, textAlign: "center" },
  stepLabelActive: { color: "#1a0533", fontWeight: "600" },
  stepLine: {
    position: "absolute",
    top: 16,
    right: -24,
    width: 48,
    height: 2,
    backgroundColor: "#E5E7EB",
  },
  stepLineActive: { backgroundColor: "#1a0533" },
  devHint: {
    backgroundColor: "#FFF3CD",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  devHintText: { color: "#92400E", fontSize: 13, textAlign: "right" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#1a0533", textAlign: "right" },
  cardSubtitle: { fontSize: 14, color: "#687076", textAlign: "right", lineHeight: 22 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
  },
  inputWrapperError: { borderColor: "#EF4444" },
  prefix: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#f5f5f5",
    color: "#1a0533",
    fontWeight: "600",
    fontSize: 15,
    borderRightWidth: 1,
    borderRightColor: "#E5E7EB",
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: "#11181C",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: { color: "#EF4444", fontSize: 12, textAlign: "right" },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    fontSize: 22,
    fontWeight: "700",
    color: "#1a0533",
    backgroundColor: "#f9f9f9",
    textAlign: "center",
  },
  otpBoxFilled: { borderColor: "#1a0533", backgroundColor: "#f0eaf8" },
  btn: {
    backgroundColor: "#f0c040",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#1a0533", fontSize: 16, fontWeight: "700" },
});

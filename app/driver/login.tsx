import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

export default function DriverLoginScreen() {
  const insets = useSafeAreaInsets();
  const { prefillPhone } = useLocalSearchParams<{ prefillPhone?: string }>();
  const { logout: logoutDriver } = useDriver();

  // Normalize prefill phone: strip +964 prefix for display
  const normalizedPrefill = prefillPhone
    ? prefillPhone.replace(/\s/g, "").replace(/^\+964/, "").replace(/^964/, "")
    : "";

  const [phone, setPhone] = useState(normalizedPrefill);
  const [error, setError] = useState("");

  // If a prefill phone is provided, clear any stale driver session first
  useEffect(() => {
    if (prefillPhone) {
      logoutDriver().catch(() => {});
    }
  }, []);

  const sendOtp = trpc.driver.sendLoginOtp.useMutation({
    onSuccess: (data) => {
      router.push({
        pathname: "/driver/otp" as any,
        params: { phone: data.phone, devCode: data.devCode ?? "" },
      });
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSend = () => {
    setError("");
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 10) {
      setError("يرجى إدخال رقم هاتف صحيح");
      return;
    }
    sendOtp.mutate({ phone: cleaned });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>🚗</Text>
        </View>
        <Text style={styles.headerTitle}>تسجيل دخول الكابتن</Text>
        <Text style={styles.headerSub}>أدخل رقم هاتفك المسجل للدخول</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>رقم الهاتف</Text>
            <View style={styles.phoneRow}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>🇮🇶 +964</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="07XX XXX XXXX"
                placeholderTextColor="#6B7280"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={11}
                returnKeyType="done"
                onSubmitEditing={handleSend}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              يجب أن يكون رقمك مسجّلاً مسبقاً كسائق. للتسجيل كسائق جديد، اذهب إلى حسابي ← وضع الكابتن.
            </Text>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendBtn, sendOtp.isPending && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={sendOtp.isPending}
          >
            {sendOtp.isPending ? (
              <ActivityIndicator color="#1A0533" />
            ) : (
              <Text style={styles.sendBtnText}>إرسال رمز التحقق</Text>
            )}
          </TouchableOpacity>


        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0A1E" },

  header: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16 },
  backBtn: {
    position: "absolute", left: 20, top: 16,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#1E1035", alignItems: "center", justifyContent: "center",
  },
  backIcon: { fontSize: 20, color: "#FFFFFF" },
  logoBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  logoText: { fontSize: 40 },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#FFFFFF", marginBottom: 6 },
  headerSub: { fontSize: 14, color: "#9B8EC4", textAlign: "center" },

  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, color: "#9B8EC4", marginBottom: 8, fontWeight: "600" },
  phoneRow: { flexDirection: "row", gap: 8 },
  prefix: {
    backgroundColor: "#1E1035", borderRadius: 14, paddingHorizontal: 14,
    justifyContent: "center", borderWidth: 1, borderColor: "#2D1B4E",
  },
  prefixText: { fontSize: 14, color: "#FFFFFF", fontWeight: "700" },
  phoneInput: {
    flex: 1, backgroundColor: "#1E1035", borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 16, color: "#FFFFFF",
    borderWidth: 1, borderColor: "#2D1B4E", textAlign: "right",
  },
  errorText: { color: "#F87171", fontSize: 13, marginTop: 6, textAlign: "right" },

  infoBox: {
    flexDirection: "row", gap: 10, backgroundColor: "#1E1035",
    borderRadius: 14, padding: 14, marginBottom: 24,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  infoIcon: { fontSize: 18 },
  infoText: { flex: 1, fontSize: 13, color: "#9B8EC4", lineHeight: 20, textAlign: "right" },

  sendBtn: {
    backgroundColor: "#FFD700", borderRadius: 16, paddingVertical: 16,
    alignItems: "center", marginBottom: 20,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontSize: 17, fontWeight: "900", color: "#1A0533" },

  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  registerText: { fontSize: 14, color: "#9B8EC4" },
  registerLink: { fontSize: 14, color: "#FFD700", fontWeight: "700" },
});

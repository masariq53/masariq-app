import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { useDriver } from "@/lib/driver-context";

export default function DriverOtpScreen() {
  const insets = useSafeAreaInsets();
  const { phone, devCode } = useLocalSearchParams<{ phone: string; devCode?: string }>();
  const { setDriver } = useDriver();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const inputs = useRef<(TextInput | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Auto-fill dev code
  useEffect(() => {
    if (devCode && devCode.length === 6) {
      const chars = devCode.split("");
      setCode(chars);
    }
  }, [devCode]);

  const verifyOtp = trpc.driver.verifyLoginOtp.useMutation({
    onSuccess: async (data) => {
      // Check if account is blocked
      if ((data.driver as any).isBlocked) {
        const reason = (data.driver as any).blockReason || "تم تعطيل حسابك من قِبل الإدارة";
        setError(`تم تعطيل حسابك: ${reason}`);
        return;
      }
      await setDriver({
        ...data.driver,
        rating: data.driver.rating ?? "5.00",
        totalRides: data.driver.totalRides ?? 0,
        walletBalance: data.driver.walletBalance ?? "0.00",
      });
      // Navigate based on registration status
      if (data.driver.registrationStatus === "approved") {
        router.replace("/captain/home" as any);
      } else {
        router.replace("/driver/status" as any);
      }
    },
    onError: (err) => {
      setError(err.message);
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    },
  });

  const resendOtp = trpc.driver.sendLoginOtp.useMutation({
    onSuccess: () => {
      setResendTimer(60);
      setError("");
    },
  });

  const handleInput = (val: string, idx: number) => {
    if (val.length > 1) {
      // Handle paste
      const chars = val.replace(/\D/g, "").slice(0, 6).split("");
      const newCode = [...code];
      chars.forEach((c, i) => { if (idx + i < 6) newCode[idx + i] = c; });
      setCode(newCode);
      const nextIdx = Math.min(idx + chars.length, 5);
      inputs.current[nextIdx]?.focus();
      if (chars.length === 6 || (idx + chars.length >= 6)) {
        verifyOtp.mutate({ phone: phone!, code: newCode.join("") });
      }
      return;
    }
    const newCode = [...code];
    newCode[idx] = val;
    setCode(newCode);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
    if (newCode.every((c) => c !== "")) {
      verifyOtp.mutate({ phone: phone!, code: newCode.join("") });
    }
  };

  const handleBackspace = (idx: number) => {
    if (!code[idx] && idx > 0) {
      const newCode = [...code];
      newCode[idx - 1] = "";
      setCode(newCode);
      inputs.current[idx - 1]?.focus();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>🔐</Text>
        </View>
        <Text style={styles.title}>رمز التحقق</Text>
        <Text style={styles.subtitle}>
          أدخل الرمز المرسل إلى{"\n"}
          <Text style={styles.phoneText}>{phone}</Text>
        </Text>
        {devCode ? (
          <View style={styles.devBadge}>
            <Text style={styles.devText}>وضع التطوير: {devCode}</Text>
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.body}>
          {/* OTP Inputs */}
          <View style={styles.otpRow}>
            {code.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={(r) => { inputs.current[idx] = r; }}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                value={digit}
                onChangeText={(v) => handleInput(v, idx)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === "Backspace") handleBackspace(idx);
                }}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                textAlign="center"
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {verifyOtp.isPending && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFD700" />
              <Text style={styles.loadingText}>جاري التحقق...</Text>
            </View>
          )}

          {/* Resend */}
          <View style={styles.resendRow}>
            {resendTimer > 0 ? (
              <Text style={styles.timerText}>إعادة الإرسال بعد {resendTimer} ثانية</Text>
            ) : (
              <TouchableOpacity
                onPress={() => resendOtp.mutate({ phone: phone! })}
                disabled={resendOtp.isPending}
              >
                <Text style={styles.resendLink}>إعادة إرسال الرمز</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
  iconBox: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#1E1035", alignItems: "center", justifyContent: "center",
    marginBottom: 16, borderWidth: 2, borderColor: "#FFD700",
  },
  iconText: { fontSize: 40 },
  title: { fontSize: 24, fontWeight: "900", color: "#FFFFFF", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#9B8EC4", textAlign: "center", lineHeight: 22 },
  phoneText: { color: "#FFD700", fontWeight: "700" },
  devBadge: {
    backgroundColor: "#1E1035", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6,
    marginTop: 10, borderWidth: 1, borderColor: "#FFD700",
  },
  devText: { color: "#FFD700", fontSize: 13, fontWeight: "700" },

  body: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },

  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 },
  otpBox: {
    width: 48, height: 56, borderRadius: 14,
    backgroundColor: "#1E1035", borderWidth: 1.5, borderColor: "#2D1B4E",
    fontSize: 22, fontWeight: "800", color: "#FFFFFF",
  },
  otpBoxFilled: { borderColor: "#FFD700", backgroundColor: "#2D1B4E" },

  errorText: { color: "#F87171", fontSize: 14, textAlign: "center", marginBottom: 12 },
  loadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  loadingText: { color: "#9B8EC4", fontSize: 14 },

  resendRow: { alignItems: "center", marginTop: 16 },
  timerText: { color: "#6B7280", fontSize: 14 },
  resendLink: { color: "#FFD700", fontSize: 14, fontWeight: "700" },
});

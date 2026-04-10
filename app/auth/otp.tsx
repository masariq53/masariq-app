import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";

const OTP_LENGTH = 6;

export default function OTPScreen() {
  const { phone, devCode, mode, name } = useLocalSearchParams<{
    phone: string;
    devCode?: string;
    mode?: "login" | "register";
    name?: string;
  }>();

  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState("");
  const inputs = useRef<(TextInput | null)[]>([]);
  const { setPassenger } = usePassenger();

  const isRegister = mode === "register";

  // Show dev code hint
  useEffect(() => {
    if (devCode && devCode.length === 6) {
      Alert.alert(
        "وضع التطوير",
        `رمز التحقق التجريبي: ${devCode}`,
        [{ text: "حسناً" }]
      );
    }
  }, [devCode]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Verify Login ────────────────────────────────────────────────────────────
  const verifyLogin = trpc.otp.verifyLogin.useMutation({
    onSuccess: async (data) => {
      await setPassenger({
        id: data.passenger.id,
        phone: data.passenger.phone,
        name: data.passenger.name,
        photoUrl: data.passenger.photoUrl ?? null,
        walletBalance: data.passenger.walletBalance?.toString() || "0.00",
        totalRides: data.passenger.totalRides,
        rating: data.passenger.rating?.toString() || "5.00",
      });
      router.replace("/(tabs)");
    },
    onError: (err) => {
      setError(err.message || "رمز التحقق غير صحيح");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
    },
  });

  // ─── Verify Register ─────────────────────────────────────────────────────────
  const verifyRegister = trpc.otp.verifyRegister.useMutation({
    onSuccess: async (data) => {
      await setPassenger({
        id: data.passenger.id,
        phone: data.passenger.phone,
        name: data.passenger.name,
        photoUrl: data.passenger.photoUrl ?? null,
        walletBalance: data.passenger.walletBalance?.toString() || "0.00",
        totalRides: data.passenger.totalRides,
        rating: data.passenger.rating?.toString() || "5.00",
      });
      router.replace("/(tabs)");
    },
    onError: (err) => {
      setError(err.message || "رمز التحقق غير صحيح");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
    },
  });

  // ─── Resend ──────────────────────────────────────────────────────────────────
  const sendLogin = trpc.otp.sendLogin.useMutation({
    onSuccess: (data) => {
      setTimer(60);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
      if (data.devCode) Alert.alert("وضع التطوير", `رمز التحقق الجديد: ${data.devCode}`);
    },
  });

  const sendRegister = trpc.otp.sendRegister.useMutation({
    onSuccess: (data) => {
      setTimer(60);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
      if (data.devCode) Alert.alert("وضع التطوير", `رمز التحقق الجديد: ${data.devCode}`);
    },
  });

  const isPending = verifyLogin.isPending || verifyRegister.isPending;
  const isResendPending = sendLogin.isPending || sendRegister.isPending;

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text.replace(/[^0-9]/g, "").slice(-1);
    setOtp(newOtp);
    setError("");
    if (text && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
    if (index === OTP_LENGTH - 1 && text) {
      const code = [...newOtp.slice(0, OTP_LENGTH - 1), text.slice(-1)].join("");
      if (code.length === OTP_LENGTH) handleVerify(code);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = (codeOverride?: string) => {
    const code = codeOverride || otp.join("");
    if (code.length < OTP_LENGTH) {
      setError("يرجى إدخال الرمز كاملاً");
      return;
    }
    setError("");
    if (isRegister) {
      verifyRegister.mutate({ phone: phone || "", code, name: name || "" });
    } else {
      verifyLogin.mutate({ phone: phone || "", code });
    }
  };

  const handleResend = () => {
    if (!phone) return;
    if (isRegister) {
      sendRegister.mutate({ phone, name: name || "" });
    } else {
      sendLogin.mutate({ phone });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />

      {/* Back */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>→ رجوع</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.icon}>📱</Text>
        <Text style={styles.title}>رمز التحقق</Text>
        <Text style={styles.subtitle}>
          {isRegister ? "أرسلنا رمز تفعيل الحساب إلى" : "أرسلنا رمز التحقق إلى"}{"\n"}
          <Text style={styles.phone}>{phone}</Text>
        </Text>

        {/* OTP Inputs */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputs.current[index] = ref; }}
              style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectionColor="#FFD700"
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.btn, isRegister && styles.btnRegister, isPending && styles.btnDisabled]}
          onPress={() => handleVerify()}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator color={isRegister ? "#FFFFFF" : "#1A0533"} />
          ) : (
            <Text style={[styles.btnText, isRegister && styles.btnTextRegister]}>
              {isRegister ? "تفعيل الحساب" : "تحقق والمتابعة"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        {timer > 0 ? (
          <Text style={styles.timerText}>
            إعادة الإرسال خلال <Text style={styles.timerNum}>{timer}s</Text>
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResend} disabled={isResendPending}>
            <Text style={styles.resendText}>
              {isResendPending ? "جاري الإرسال..." : "إعادة إرسال الرمز"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0533",
  },
  backBtn: {
    position: "absolute",
    top: 60,
    left: 24,
    zIndex: 10,
  },
  backText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 12,
  },
  subtitle: {
    color: "rgba(196,181,212,1)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 36,
  },
  phone: {
    color: "#FFD700",
    fontWeight: "700",
    fontSize: 16,
  },
  otpContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  otpInput: {
    width: 50,
    height: 58,
    borderRadius: 14,
    backgroundColor: "rgba(45,27,105,0.8)",
    borderWidth: 2,
    borderColor: "#3D2580",
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  otpInputFilled: {
    borderColor: "#FFD700",
    backgroundColor: "rgba(255,215,0,0.15)",
  },
  errorText: {
    color: "#F87171",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  btn: {
    backgroundColor: "#FFD700",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 60,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  btnRegister: {
    backgroundColor: "#7B3FE4",
    shadowColor: "#7B3FE4",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: "#1A0533",
    fontSize: 17,
    fontWeight: "800",
  },
  btnTextRegister: {
    color: "#FFFFFF",
  },
  timerText: {
    color: "#9B8AB0",
    fontSize: 14,
  },
  timerNum: {
    color: "#FFD700",
    fontWeight: "700",
  },
  resendText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});

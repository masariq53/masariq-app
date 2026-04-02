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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function OTPScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState("");
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < 4) {
      setError("يرجى إدخال الرمز كاملاً");
      return;
    }
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    await AsyncStorage.setItem("user_logged_in", "true");
    await AsyncStorage.setItem("user_phone", phone || "");
    setLoading(false);
    router.replace("/(tabs)");
  };

  const handleResend = () => {
    setTimer(60);
    setOtp(["", "", "", ""]);
    inputs.current[0]?.focus();
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
          أرسلنا رمز التحقق إلى{"\n"}
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
              onChangeText={(text) => handleChange(text.slice(-1), index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectionColor="#F5A623"
            />
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1A2E4A" />
          ) : (
            <Text style={styles.btnText}>تحقق والمتابعة</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        {timer > 0 ? (
          <Text style={styles.timerText}>
            إعادة الإرسال خلال <Text style={styles.timerNum}>{timer}s</Text>
          </Text>
        ) : (
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A2E4A",
  },
  backBtn: {
    position: "absolute",
    top: 60,
    left: 24,
    zIndex: 10,
  },
  backText: {
    color: "#F5A623",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
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
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 36,
  },
  phone: {
    color: "#F5A623",
    fontWeight: "700",
    fontSize: 16,
  },
  otpContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  otpInput: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
  },
  otpInputFilled: {
    borderColor: "#F5A623",
    backgroundColor: "rgba(245,166,35,0.15)",
  },
  errorText: {
    color: "#F87171",
    fontSize: 13,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#F5A623",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 60,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: "#1A2E4A",
    fontSize: 17,
    fontWeight: "800",
  },
  timerText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  timerNum: {
    color: "#F5A623",
    fontWeight: "700",
  },
  resendText: {
    color: "#F5A623",
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});

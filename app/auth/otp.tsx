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
    await AsyncStorage.setItem("@masar_logged_in", "true");
    await AsyncStorage.setItem("@masar_user_phone", phone || "");
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
              selectionColor="#FFD700"
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
            <ActivityIndicator color="#1A0533" />
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
    gap: 16,
    marginBottom: 12,
  },
  otpInput: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(45,27,105,0.8)",
    borderWidth: 2,
    borderColor: "#3D2580",
    color: "#FFFFFF",
    fontSize: 28,
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
  btnDisabled: { opacity: 0.7 },
  btnText: {
    color: "#1A0533",
    fontSize: 17,
    fontWeight: "800",
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

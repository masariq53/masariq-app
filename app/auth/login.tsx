import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async () => {
    if (phone.length < 10) {
      setError("يرجى إدخال رقم هاتف صحيح");
      return;
    }
    setError("");
    setLoading(true);
    // Simulate OTP send
    await new Promise((r) => setTimeout(r, 1200));
    setLoading(false);
    router.push({ pathname: "/auth/otp", params: { phone } });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>موصل رايد</Text>
          <Text style={styles.tagline}>تنقل بأمان وراحة</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>تسجيل الدخول</Text>
          <Text style={styles.cardSubtitle}>أدخل رقم هاتفك للمتابعة</Text>

          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.flag}>🇮🇶</Text>
            <Text style={styles.countryCode}>+964</Text>
            <TextInput
              style={styles.input}
              placeholder="07XX XXX XXXX"
              placeholderTextColor="#9BA1A6"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={11}
              textAlign="left"
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1A2E4A" />
            ) : (
              <Text style={styles.btnText}>إرسال رمز التحقق</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>أو</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Driver Register */}
          <TouchableOpacity
            style={styles.driverBtn}
            onPress={() => router.push("/driver/register" as any)}
          >
            <Text style={styles.driverBtnText}>🚗  سجّل كسائق</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          بالمتابعة، أنت توافق على{" "}
          <Text style={styles.termsLink}>شروط الاستخدام</Text>
          {" "}و{" "}
          <Text style={styles.termsLink}>سياسة الخصوصية</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A2E4A",
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 40,
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 22,
    marginBottom: 12,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
  },
  tagline: {
    color: "#F5A623",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    width: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    color: "#1A2E4A",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 6,
  },
  cardSubtitle: {
    color: "#6B7A8D",
    fontSize: 14,
    textAlign: "right",
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  flag: {
    fontSize: 22,
  },
  countryCode: {
    color: "#1A2E4A",
    fontSize: 16,
    fontWeight: "700",
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
    paddingRight: 10,
  },
  input: {
    flex: 1,
    color: "#1A2E4A",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "right",
    marginBottom: 8,
  },
  btn: {
    backgroundColor: "#F5A623",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: "#1A2E4A",
    fontSize: 17,
    fontWeight: "800",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  dividerText: {
    color: "#6B7A8D",
    fontSize: 13,
  },
  driverBtn: {
    borderWidth: 2,
    borderColor: "#1A2E4A",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  driverBtnText: {
    color: "#1A2E4A",
    fontSize: 16,
    fontWeight: "700",
  },
  terms: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 30,
    lineHeight: 20,
  },
  termsLink: {
    color: "#F5A623",
    fontWeight: "600",
  },
});

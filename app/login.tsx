import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (phone.length < 10) return;
    setLoading(true);
    // Simulate OTP send
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: "/auth/otp", params: { phone } });
    }, 800);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Background decorations */}
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoAr}>مسار</Text>
          </View>
          <Text style={styles.logoEn}>MASAR</Text>
          <Text style={styles.tagline}>كل رحلة، بأمان وأناقة</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>تسجيل الدخول</Text>
          <Text style={styles.cardSubtitle}>
            أدخل رقم هاتفك للمتابعة
          </Text>

          {/* Phone Input */}
          <View style={styles.inputContainer}>
            <View style={styles.countryCode}>
              <Text style={styles.flag}>🇮🇶</Text>
              <Text style={styles.code}>+964</Text>
            </View>
            <View style={styles.divider} />
            <TextInput
              style={styles.input}
              placeholder="07XX XXX XXXX"
              placeholderTextColor="#6B5B8A"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={11}
              textAlign="left"
              returnKeyType="done"
              onSubmitEditing={handleSendOTP}
            />
          </View>

          {/* Info text */}
          <Text style={styles.infoText}>
            سيتم إرسال رمز التحقق إلى رقمك
          </Text>

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              phone.length < 10 && styles.sendBtnDisabled,
            ]}
            onPress={handleSendOTP}
            disabled={phone.length < 10 || loading}
          >
            <Text style={styles.sendBtnText}>
              {loading ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
            </Text>
          </TouchableOpacity>

          {/* Note: Captain registration is available from Profile > Captain Mode */}
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          بتسجيل دخولك، أنت توافق على{" "}
          <Text style={styles.termsLink}>شروط الاستخدام</Text>
          {" "}و{" "}
          <Text style={styles.termsLink} onPress={() => router.push("/privacy" as any)}>سياسة الخصوصية</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0533",
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: 40,
  },
  bgCircle1: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#2D1B69",
    opacity: 0.7,
  },
  bgCircle2: {
    position: "absolute",
    top: 100,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#3D2580",
    opacity: 0.4,
  },
  logoSection: {
    alignItems: "center",
    marginTop: 80,
    marginBottom: 32,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#2D1B69",
    borderWidth: 2,
    borderColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoAr: {
    color: "#FFD700",
    fontSize: 22,
    fontWeight: "bold",
  },
  logoEn: {
    color: "#C4B5D4",
    fontSize: 11,
    letterSpacing: 6,
    marginTop: 6,
  },
  tagline: {
    color: "#9B8AB0",
    fontSize: 13,
    marginTop: 8,
  },
  card: {
    width: "88%",
    backgroundColor: "#2D1B69",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "#3D2580",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  cardSubtitle: {
    color: "#9B8AB0",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 28,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A0533",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#3D2580",
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 10,
  },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flag: {
    fontSize: 20,
  },
  code: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: "#3D2580",
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    letterSpacing: 1,
  },
  infoText: {
    color: "#6B5B8A",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 20,
  },
  sendBtn: {
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  sendBtnDisabled: {
    backgroundColor: "#4A3570",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "bold",
  },
  orContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#3D2580",
  },
  orText: {
    color: "#6B5B8A",
    fontSize: 13,
  },
  captainRow: {
    flexDirection: "row",
    gap: 10,
  },
  captainBtnHalf: {
    flex: 1,
  },
  captainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFD700",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  captainIcon: {
    fontSize: 20,
  },
  captainText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "600",
  },
  terms: {
    color: "#6B5B8A",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  termsLink: {
    color: "#FFD700",
    textDecorationLine: "underline",
  },
});

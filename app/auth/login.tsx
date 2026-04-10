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
import { trpc } from "@/lib/trpc";
import { useT } from "@/lib/i18n";

export default function LoginScreen() {
  const t = useT();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const sendLogin = trpc.otp.sendLogin.useMutation({
    onSuccess: (data) => {
      router.push({
        pathname: "/auth/otp",
        params: { phone: data.phone, devCode: data.devCode || "", mode: "login" },
      });
    },
    onError: (err) => {
      setError(err.message || t.errors.serverError);
    },
  });

  const handleSendOTP = () => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 10 || cleaned.length > 11) {
      setError(t.errors.invalidPhone);
      return;
    }
    setError("");
    sendLogin.mutate({ phone: cleaned });
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
          <Text style={styles.appName}>{t.common.appName}</Text>
          <Text style={styles.tagline}>تنقل بأمان وراحة</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.auth.login}</Text>
          <Text style={styles.cardSubtitle}>{t.auth.enterPhone}</Text>

          {/* Phone Input */}
          <View style={[styles.inputContainer, error ? styles.inputError : null]}>
            <Text style={styles.flag}>🇮🇶</Text>
            <Text style={styles.countryCode}>+964</Text>
            <TextInput
              style={styles.input}
              placeholder="07XX XXX XXXX"
              placeholderTextColor="#9BA1A6"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => {
                const nums = t.replace(/[^0-9]/g, "").slice(0, 11);
                setPhone(nums);
                setError("");
              }}
              maxLength={11}
              textAlign="left"
              returnKeyType="done"
              onSubmitEditing={handleSendOTP}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Send OTP Button */}
          <TouchableOpacity
            style={[styles.btn, sendLogin.isPending && styles.btnDisabled]}
            onPress={handleSendOTP}
            disabled={sendLogin.isPending}
          >
            {sendLogin.isPending ? (
              <ActivityIndicator color="#1A0533" />
            ) : (
              <Text style={styles.btnText}>{t.auth.sendOtp}</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t.common.or}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Create Account */}
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => router.push("/auth/register" as any)}
          >
            <Text style={styles.registerBtnText}>{t.auth.noAccount} </Text>
            <Text style={styles.registerBtnLink}>{t.auth.createAccount}</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          {t.auth.agreeTerms}{" "}
          <Text style={styles.termsLink}>{t.auth.terms}</Text>
          {" "}{t.common.and}{" "}
          <Text style={styles.termsLink}>{t.auth.privacyPolicy}</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  scroll: { flexGrow: 1, alignItems: "center", paddingBottom: 40 },
  header: { alignItems: "center", paddingTop: 80, paddingBottom: 40 },
  logo: { width: 90, height: 90, borderRadius: 22, marginBottom: 12 },
  appName: { color: "#FFFFFF", fontSize: 28, fontWeight: "800", letterSpacing: 1 },
  tagline: { color: "#FFD700", fontSize: 14, marginTop: 4, fontWeight: "500" },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 28, padding: 28, width: "90%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  cardTitle: { color: "#1A0533", fontSize: 22, fontWeight: "800", textAlign: "right", marginBottom: 6 },
  cardSubtitle: { color: "#6B7A8D", fontSize: 14, textAlign: "right", marginBottom: 24 },
  inputContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#F5F7FA",
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: "#E2E8F0", gap: 8,
  },
  inputError: { borderColor: "#EF4444" },
  flag: { fontSize: 22 },
  countryCode: {
    color: "#1A0533", fontSize: 16, fontWeight: "700",
    borderRightWidth: 1, borderRightColor: "#E2E8F0", paddingRight: 10,
  },
  input: { flex: 1, color: "#1A0533", fontSize: 16, fontWeight: "600", letterSpacing: 1 },
  errorText: { color: "#EF4444", fontSize: 13, textAlign: "right", marginBottom: 8 },
  btn: {
    backgroundColor: "#FFD700", borderRadius: 14, paddingVertical: 16, alignItems: "center",
    marginTop: 8, shadowColor: "#FFD700", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#1A0533", fontSize: 17, fontWeight: "800" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerText: { color: "#6B7A8D", fontSize: 13 },
  registerBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    paddingVertical: 14, marginBottom: 12, backgroundColor: "#F0EBFF",
    borderRadius: 14, borderWidth: 1.5, borderColor: "#7B3FE4",
  },
  registerBtnText: { color: "#6B7A8D", fontSize: 15, fontWeight: "500" },
  registerBtnLink: { color: "#7B3FE4", fontSize: 15, fontWeight: "800" },
  terms: {
    color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center",
    marginTop: 24, paddingHorizontal: 30, lineHeight: 20,
  },
  termsLink: { color: "#FFD700", fontWeight: "600" },
});

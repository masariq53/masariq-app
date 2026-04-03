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

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const sendRegister = trpc.otp.sendRegister.useMutation({
    onSuccess: (data) => {
      router.push({
        pathname: "/auth/otp",
        params: {
          phone: data.phone,
          name: data.name,
          devCode: data.devCode || "",
          mode: "register",
        },
      });
    },
    onError: (err) => {
      setPhoneError(err.message || "حدث خطأ، يرجى المحاولة مرة أخرى");
    },
  });

  const validate = () => {
    let valid = true;

    // التحقق من الاسم
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setNameError("الاسم يجب أن يكون حرفين على الأقل");
      valid = false;
    } else if (trimmedName.length > 30) {
      setNameError("الاسم يجب أن لا يتجاوز 30 حرفاً");
      valid = false;
    } else {
      setNameError("");
    }

    // التحقق من الرقم
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 10 || cleaned.length > 11) {
      setPhoneError("رقم الهاتف يجب أن يكون 10 أو 11 رقماً");
      valid = false;
    } else {
      setPhoneError("");
    }

    return valid;
  };

  const handleRegister = () => {
    if (!validate()) return;
    sendRegister.mutate({ phone: phone.replace(/\s/g, ""), name: name.trim() });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→ رجوع</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>مسار</Text>
          <Text style={styles.tagline}>إنشاء حساب جديد</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>أهلاً بك!</Text>
          <Text style={styles.cardSubtitle}>أدخل اسمك ورقم هاتفك لإنشاء حساب</Text>

          {/* Name Input */}
          <Text style={styles.label}>الاسم</Text>
          <View style={[styles.inputContainer, nameError ? styles.inputError : null]}>
            <Text style={styles.inputIcon}>👤</Text>
            <TextInput
              style={styles.input}
              placeholder="اسمك الكامل"
              placeholderTextColor="#9BA1A6"
              value={name}
              onChangeText={(t) => {
                // حد أقصى 30 حرف
                if (t.length <= 30) {
                  setName(t);
                  setNameError("");
                }
              }}
              maxLength={30}
              textAlign="right"
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{name.length}/30</Text>
          </View>
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

          {/* Phone Input */}
          <Text style={styles.label}>رقم الهاتف</Text>
          <View style={[styles.inputContainer, phoneError ? styles.inputError : null]}>
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
                setPhoneError("");
              }}
              maxLength={11}
              textAlign="left"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
          </View>
          {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.btn, sendRegister.isPending && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={sendRegister.isPending}
          >
            {sendRegister.isPending ? (
              <ActivityIndicator color="#1A0533" />
            ) : (
              <Text style={styles.btnText}>إنشاء الحساب</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
          >
            <Text style={styles.loginLinkText}>لديك حساب بالفعل؟ </Text>
            <Text style={styles.loginLinkBold}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          بإنشاء حساب، أنت توافق على{" "}
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
  backBtn: {
    alignSelf: "flex-start",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  backText: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 32,
  },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 18,
    marginBottom: 10,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1,
  },
  tagline: {
    color: "#FFD700",
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
    color: "#1A0533",
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
  label: {
    color: "#1A0533",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  inputIcon: {
    fontSize: 18,
  },
  flag: {
    fontSize: 22,
  },
  countryCode: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "700",
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
    paddingRight: 10,
  },
  input: {
    flex: 1,
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  charCount: {
    color: "#9BA1A6",
    fontSize: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    textAlign: "right",
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#7B3FE4",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#7B3FE4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  loginLinkText: {
    color: "#6B7A8D",
    fontSize: 14,
  },
  loginLinkBold: {
    color: "#7B3FE4",
    fontSize: 14,
    fontWeight: "800",
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
    color: "#FFD700",
    fontWeight: "600",
  },
});

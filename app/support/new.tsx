import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePassenger } from "@/lib/passenger-context";
import { useDriver } from "@/lib/driver-context";
import { useThemeContext } from "@/lib/theme-provider";
import { useT } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

type Category = "payment" | "ride" | "account" | "app" | "other";

export default function NewSupportTicketScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { passenger } = usePassenger();
  const { driver } = useDriver();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  const isDriverMode = !!driver && !passenger;
  const userId = isDriverMode ? driver?.id : passenger?.id;
  const userType = isDriverMode ? "driver" : "passenger";
  const userName = isDriverMode ? driver?.name : passenger?.name;
  const userPhone = isDriverMode ? driver?.phone : passenger?.phone;

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("other");

  const colors = {
    bg: isDark ? "#0D0019" : "#F0EBF8",
    card: isDark ? "#1E0F4A" : "#FFFFFF",
    header: "#1A0533",
    text: isDark ? "#FFFFFF" : "#1A0533",
    muted: isDark ? "#9B8AB0" : "#6B7A8D",
    border: isDark ? "#2D1B69" : "#E5E7EB",
    input: isDark ? "#2D1B69" : "#F5F5F5",
    accent: "#7C3AED",
    selected: "#7C3AED",
  };

  const categories: { id: Category; label: string; emoji: string }[] = [
    { id: "payment", label: t.help.categoryPayment, emoji: "💳" },
    { id: "ride", label: t.help.categoryRide, emoji: "🚗" },
    { id: "account", label: t.help.categoryAccount, emoji: "👤" },
    { id: "app", label: t.help.categoryApp, emoji: "📱" },
    { id: "other", label: t.help.categoryOther, emoji: "❓" },
  ];

  const createTicketMutation = trpc.support.createTicket.useMutation();

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Alert.alert("", t.help.ticketSubject + " مطلوب");
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      Alert.alert("", "يرجى كتابة وصف أوضح للمشكلة (10 أحرف على الأقل)");
      return;
    }
    if (!userId) {
      Alert.alert("", "يرجى تسجيل الدخول أولاً");
      return;
    }

    try {
      const result = await createTicketMutation.mutateAsync({
        userId,
        userType,
        userName: userName ?? undefined,
        userPhone: userPhone ?? undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (result.ticketId) {
        Alert.alert("✅", t.help.ticketCreated, [
          {
            text: "حسناً",
            onPress: () => {
              router.replace({
                pathname: "/support/chat",
                params: { ticketId: result.ticketId, subject: subject.trim() },
              } as any);
            },
          },
        ]);
      }
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ أثناء إنشاء التذكرة. يرجى المحاولة مجدداً.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.header }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🎫 {t.help.newTicket}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={[styles.scroll, { backgroundColor: colors.bg }]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category */}
          <Text style={[styles.label, { color: colors.text }]}>{t.help.ticketCategory}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: category === cat.id ? colors.selected : colors.card,
                    borderColor: category === cat.id ? colors.selected : colors.border,
                  },
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, { color: category === cat.id ? "#FFFFFF" : colors.text }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Subject */}
          <Text style={[styles.label, { color: colors.text }]}>{t.help.ticketSubject}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            value={subject}
            onChangeText={setSubject}
            placeholder={t.help.ticketSubject}
            placeholderTextColor={colors.muted}
            maxLength={200}
            returnKeyType="next"
          />

          {/* Message */}
          <Text style={[styles.label, { color: colors.text }]}>{t.help.ticketMessage}</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            value={message}
            onChangeText={setMessage}
            placeholder={t.help.typeMessage}
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={[styles.charCount, { color: colors.muted }]}>{message.length}/2000</Text>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: createTicketMutation.isPending ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={createTicketMutation.isPending}
          >
            {createTicketMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>📤 {t.help.send}</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, color: "#FFFFFF" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  categoryScroll: { marginBottom: 8 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
    gap: 6,
  },
  categoryEmoji: { fontSize: 16 },
  categoryLabel: { fontSize: 13, fontWeight: "600" },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 4,
  },
  textArea: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 140,
    marginBottom: 4,
  },
  charCount: { fontSize: 12, textAlign: "left", marginBottom: 16 },
  submitBtn: {
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

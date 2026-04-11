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
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePassenger } from "@/lib/passenger-context";
import { useDriver } from "@/lib/driver-context";
import { useThemeContext } from "@/lib/theme-provider";
import { useT } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

type Category = "payment" | "ride" | "account" | "app" | "other";

const MAX_IMAGES = 6;

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

  const params = useLocalSearchParams<{ prefillSubject?: string; prefillMessage?: string }>();
  const [subject, setSubject] = useState(params.prefillSubject ?? "");
  const [message, setMessage] = useState(params.prefillMessage ?? "");
  const [category, setCategory] = useState<Category>(params.prefillSubject ? "account" : "other");

  // حالة الصور المرفقة
  const [attachedImages, setAttachedImages] = useState<{ uri: string; base64: string }[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

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
    imageBg: isDark ? "#2D1B69" : "#F3EEFF",
    addBtn: isDark ? "#3D2B79" : "#EDE9FE",
  };

  const categories: { id: Category; label: string; emoji: string }[] = [
    { id: "payment", label: t.help.categoryPayment, emoji: "💳" },
    { id: "ride", label: t.help.categoryRide, emoji: "🚗" },
    { id: "account", label: t.help.categoryAccount, emoji: "👤" },
    { id: "app", label: t.help.categoryApp, emoji: "📱" },
    { id: "other", label: t.help.categoryOther, emoji: "❓" },
  ];

  const createTicketMutation = trpc.support.createTicket.useMutation();
  const uploadImageMutation = trpc.support.uploadImage.useMutation();

  // اختيار صورة من الكاميرا أو المعرض
  const handleAddImage = async (source: "camera" | "library") => {
    if (attachedImages.length >= MAX_IMAGES) {
      Alert.alert("", `الحد الأقصى ${MAX_IMAGES} صور`);
      return;
    }

    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("", "يرجى السماح بالوصول إلى الكاميرا");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("", "يرجى السماح بالوصول إلى معرض الصور");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let base64 = asset.base64;

      // إذا لم يكن base64 متاحاً، نقرأ الملف
      if (!base64 && asset.uri) {
        try {
          base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {
          Alert.alert("خطأ", "فشل قراءة الصورة");
          return;
        }
      }

      if (base64) {
        setAttachedImages((prev) => [...prev, { uri: asset.uri, base64 }]);
      }
    }
  };

  // إظهار خيارات المصدر
  const showImageSourcePicker = () => {
    if (attachedImages.length >= MAX_IMAGES) {
      Alert.alert("", `الحد الأقصى ${MAX_IMAGES} صور`);
      return;
    }
    if (Platform.OS === "web") {
      handleAddImage("library");
    } else {
      Alert.alert("إرفاق صورة", "اختر مصدر الصورة", [
        { text: "📷 الكاميرا", onPress: () => handleAddImage("camera") },
        { text: "🖼 المعرض", onPress: () => handleAddImage("library") },
        { text: "إلغاء", style: "cancel" },
      ]);
    }
  };

  // حذف صورة
  const handleRemoveImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

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
      // رفع الصور أولاً إن وجدت
      let imageUrls: string[] = [];
      if (attachedImages.length > 0) {
        setIsUploadingImages(true);
        for (const img of attachedImages) {
          const result = await uploadImageMutation.mutateAsync({
            base64: img.base64,
            mimeType: "image/jpeg",
          });
          imageUrls.push(result.url);
        }
        setIsUploadingImages(false);
      }

      const result = await createTicketMutation.mutateAsync({
        userId,
        userType,
        userName: userName ?? undefined,
        userPhone: userPhone ?? undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
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
      setIsUploadingImages(false);
      Alert.alert("خطأ", "حدث خطأ أثناء إنشاء التذكرة. يرجى المحاولة مجدداً.");
    }
  };

  const isLoading = createTicketMutation.isPending || isUploadingImages;

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

          {/* ─── قسم إرفاق الصور ─── */}
          <View style={[styles.attachSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.attachHeader}>
              <Text style={[styles.attachTitle, { color: colors.text }]}>📎 صور مرفقة</Text>
              <Text style={[styles.attachCount, { color: colors.muted }]}>
                {attachedImages.length}/{MAX_IMAGES} (اختياري)
              </Text>
            </View>

            {/* شبكة الصور */}
            {attachedImages.length > 0 && (
              <View style={styles.imagesGrid}>
                {attachedImages.map((img, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.thumbImage} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemoveImage(index)}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* زر إضافة صورة */}
            {attachedImages.length < MAX_IMAGES && (
              <TouchableOpacity
                style={[styles.addImageBtn, { backgroundColor: colors.addBtn, borderColor: colors.accent }]}
                onPress={showImageSourcePicker}
              >
                <Text style={[styles.addImageIcon, { color: colors.accent }]}>📷</Text>
                <Text style={[styles.addImageText, { color: colors.accent }]}>
                  {attachedImages.length === 0 ? "إرفاق صورة" : "إضافة صورة أخرى"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.accent, opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.submitText}>
                  {isUploadingImages ? "جاري رفع الصور..." : "جاري الإرسال..."}
                </Text>
              </View>
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

  // قسم الصور
  attachSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  attachHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attachTitle: { fontSize: 15, fontWeight: "700" },
  attachCount: { fontSize: 13 },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageWrapper: {
    position: "relative",
    width: 80,
    height: 80,
  },
  thumbImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  addImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    gap: 8,
  },
  addImageIcon: { fontSize: 20 },
  addImageText: { fontSize: 14, fontWeight: "600" },

  submitBtn: {
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  submitText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

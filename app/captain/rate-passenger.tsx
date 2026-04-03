import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const QUICK_TAGS = [
  { id: "polite", label: "راكب مؤدب 😊" },
  { id: "ontime", label: "كان جاهزاً في الوقت ⏱️" },
  { id: "clean", label: "محافظ على نظافة السيارة 🧹" },
  { id: "clear_address", label: "عنوان واضح 📍" },
  { id: "calm", label: "هادئ أثناء الرحلة 🤫" },
  { id: "rude", label: "غير محترم 😤" },
  { id: "late", label: "تأخر في الانتظار ⏳" },
  { id: "messy", label: "ترك فوضى في السيارة 🗑️" },
];

export default function RatePassengerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ passengerName?: string; rideId?: string }>();
  const passengerName = params.passengerName ?? "الراكب";

  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleStarPress = (star: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(star);
  };

  const toggleTag = (id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert("تنبيه", "يرجى اختيار تقييم بالنجوم أولاً");
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
    setTimeout(() => {
      router.replace("/captain/home" as any);
    }, 2000);
  };

  const ratingLabels = ["", "سيء 😞", "مقبول 😐", "جيد 🙂", "ممتاز 😄", "رائع جداً 🌟"];
  const displayRating = hoveredStar || rating;

  if (submitted) {
    return (
      <View style={[styles.container, styles.successContainer, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <Text style={styles.successIcon}>⭐</Text>
        <Text style={styles.successTitle}>شكراً على تقييمك!</Text>
        <Text style={styles.successSub}>تقييمك يساعدنا على تحسين تجربة الرحلات</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => router.replace("/captain/home" as any)}
        >
          <Text style={styles.skipText}>تخطي</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تقييم الراكب</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Passenger Info */}
        <View style={styles.passengerCard}>
          <View style={styles.passengerAvatar}>
            <Text style={styles.passengerInitial}>{passengerName.charAt(0)}</Text>
          </View>
          <Text style={styles.passengerName}>{passengerName}</Text>
          <Text style={styles.passengerSub}>كيف كانت تجربتك مع هذا الراكب؟</Text>
        </View>

        {/* Stars */}
        <View style={styles.starsSection}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
                style={styles.starBtn}
              >
                <Text style={[styles.starIcon, displayRating >= star && styles.starActive]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {displayRating > 0 && (
            <Text style={styles.ratingLabel}>{ratingLabels[displayRating]}</Text>
          )}
        </View>

        {/* Quick Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ما الذي لاحظته؟</Text>
          <View style={styles.tagsGrid}>
            {QUICK_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag.id}
                style={[styles.tag, selectedTags.includes(tag.id) && styles.tagSelected]}
                onPress={() => toggleTag(tag.id)}
              >
                <Text style={[styles.tagText, selectedTags.includes(tag.id) && styles.tagTextSelected]}>
                  {tag.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Comment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>تعليق إضافي (اختياري)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="اكتب ملاحظاتك هنا..."
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={3}
            textAlign="right"
            textAlignVertical="top"
            maxLength={200}
          />
          <Text style={styles.charCount}>{comment.length}/200</Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>إرسال التقييم</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0A1E" },
  successContainer: { alignItems: "center", justifyContent: "center" },
  successIcon: { fontSize: 80, marginBottom: 20 },
  successTitle: { color: "#FFD700", fontSize: 28, fontWeight: "900", marginBottom: 10 },
  successSub: { color: "#9B8EC4", fontSize: 15, textAlign: "center", paddingHorizontal: 40 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#1E1035",
  },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { color: "#9B8EC4", fontSize: 15 },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },

  passengerCard: { alignItems: "center", paddingVertical: 32 },
  passengerAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#2D1B4E", borderWidth: 2, borderColor: "#FFD700",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  passengerInitial: { fontSize: 36, fontWeight: "900", color: "#FFD700" },
  passengerName: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  passengerSub: { color: "#9B8EC4", fontSize: 14 },

  starsSection: { alignItems: "center", paddingVertical: 16 },
  starsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  starBtn: { padding: 4 },
  starIcon: { fontSize: 48, color: "#2D1B4E" },
  starActive: { color: "#FFD700" },
  ratingLabel: { color: "#FFD700", fontSize: 18, fontWeight: "700" },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { color: "#9B8EC4", fontSize: 13, fontWeight: "700", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },

  tagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "#2D1B4E",
    backgroundColor: "#1E1035",
  },
  tagSelected: { borderColor: "#FFD700", backgroundColor: "#2D1B4E" },
  tagText: { color: "#9B8EC4", fontSize: 13 },
  tagTextSelected: { color: "#FFD700", fontWeight: "700" },

  commentInput: {
    backgroundColor: "#1E1035", borderRadius: 14, borderWidth: 1, borderColor: "#2D1B4E",
    padding: 14, color: "#FFFFFF", fontSize: 14, minHeight: 90,
  },
  charCount: { color: "#6B7280", fontSize: 12, textAlign: "left", marginTop: 4 },

  submitBtn: {
    marginHorizontal: 20, marginTop: 8, backgroundColor: "#FFD700",
    borderRadius: 18, paddingVertical: 18, alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: "#1A0533", fontWeight: "900", fontSize: 17 },
});

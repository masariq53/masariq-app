import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const QUICK_TAGS = [
  "سائق محترف",
  "سيارة نظيفة",
  "وصل بسرعة",
  "قيادة آمنة",
  "ودود ومهذب",
  "يعرف الطريق",
];

export default function RideRatingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    driverName?: string;
    driverAvatar?: string;
    driverRating?: string;
    fare?: string;
    rideId?: string;
  }>();

  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const driverName = params.driverName ?? "السائق";
  const driverAvatar = params.driverAvatar ?? "👨";
  const fare = params.fare ? parseInt(params.fare) : 3500;

  const handleStar = (star: number) => {
    setRating(star);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    setSubmitted(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => {
      router.replace("/(tabs)");
    }, 2000);
  };

  const getStarLabel = () => {
    const labels = ["", "سيء", "مقبول", "جيد", "ممتاز", "رائع!"];
    return labels[rating] ?? "";
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.successTitle}>شكراً لتقييمك!</Text>
          <Text style={styles.successSub}>تقييمك يساعدنا على تحسين الخدمة</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>قيّم رحلتك</Text>
          <Text style={styles.headerSub}>رأيك يهمنا ويساعد السائقين على التحسين</Text>
        </View>

        {/* Driver Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>{driverAvatar}</Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.driverMeta}>⭐ {params.driverRating ?? "4.9"} · كابتن مسار</Text>
          </View>
          <View style={styles.fareBox}>
            <Text style={styles.fareLabel}>المبلغ</Text>
            <Text style={styles.fareValue}>{fare.toLocaleString("ar-IQ")}</Text>
            <Text style={styles.fareCurrency}>دينار</Text>
          </View>
        </View>

        {/* Stars */}
        <View style={styles.starsSection}>
          <Text style={styles.starsLabel}>
            {rating > 0 ? getStarLabel() : "كيف كانت تجربتك؟"}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStar(star)}
                style={styles.starBtn}
              >
                <Text style={[
                  styles.starIcon,
                  star <= (hoveredStar || rating) ? styles.starActive : styles.starInactive,
                ]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Tags (show only if rated) */}
        {rating > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsLabel}>ما الذي أعجبك؟</Text>
            <View style={styles.tagsWrap}>
              {QUICK_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.tagBtn, selectedTags.includes(tag) && styles.tagBtnActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextActive]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Comment */}
        {rating > 0 && (
          <View style={styles.commentSection}>
            <Text style={styles.commentLabel}>تعليق إضافي (اختياري)</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="اكتب تعليقك هنا..."
              placeholderTextColor="#6B7280"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              textAlign="right"
            />
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0}
        >
          <Text style={styles.submitBtnText}>
            {rating === 0 ? "اختر تقييماً أولاً" : "إرسال التقييم"}
          </Text>
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.skipText}>تخطي</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0A1E" },

  body: { padding: 24, paddingBottom: 40 },

  header: { alignItems: "center", marginBottom: 24 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#FFFFFF", marginBottom: 6 },
  headerSub: { fontSize: 14, color: "#9B8EC4", textAlign: "center" },

  driverCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1E1035", borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: "#2D1B4E", marginBottom: 28,
  },
  driverAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center",
  },
  driverAvatarText: { fontSize: 30 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  driverMeta: { fontSize: 13, color: "#9B8EC4" },
  fareBox: { alignItems: "center" },
  fareLabel: { fontSize: 11, color: "#6B7280" },
  fareValue: { fontSize: 18, fontWeight: "900", color: "#FFD700" },
  fareCurrency: { fontSize: 11, color: "#9B8EC4" },

  starsSection: { alignItems: "center", marginBottom: 28 },
  starsLabel: { fontSize: 16, color: "#FFFFFF", fontWeight: "700", marginBottom: 16 },
  starsRow: { flexDirection: "row", gap: 8 },
  starBtn: { padding: 4 },
  starIcon: { fontSize: 48 },
  starActive: { color: "#FFD700" },
  starInactive: { color: "#2D1B4E" },

  tagsSection: { marginBottom: 24 },
  tagsLabel: { fontSize: 14, color: "#9B8EC4", fontWeight: "700", marginBottom: 12, textAlign: "right" },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  tagBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#1E1035", borderWidth: 1, borderColor: "#2D1B4E",
  },
  tagBtnActive: { backgroundColor: "#2D1B4E", borderColor: "#FFD700" },
  tagText: { fontSize: 13, color: "#9B8EC4" },
  tagTextActive: { color: "#FFD700", fontWeight: "700" },

  commentSection: { marginBottom: 24 },
  commentLabel: { fontSize: 14, color: "#9B8EC4", fontWeight: "700", marginBottom: 10, textAlign: "right" },
  commentInput: {
    backgroundColor: "#1E1035", borderRadius: 14, padding: 14,
    fontSize: 14, color: "#FFFFFF", borderWidth: 1, borderColor: "#2D1B4E",
    minHeight: 80,
  },

  submitBtn: {
    backgroundColor: "#FFD700", borderRadius: 16, paddingVertical: 16,
    alignItems: "center", marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 17, fontWeight: "900", color: "#1A0533" },

  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 14, color: "#6B7280" },

  successBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  successIcon: { fontSize: 80 },
  successTitle: { fontSize: 28, fontWeight: "900", color: "#FFD700" },
  successSub: { fontSize: 16, color: "#9B8EC4", textAlign: "center" },
});

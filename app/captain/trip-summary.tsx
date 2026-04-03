import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TripSummaryScreen() {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← رجوع</Text>
      </TouchableOpacity>

      {/* Success Icon */}
      <View style={styles.successSection}>
        <View style={styles.successCircle}>
          <Text style={styles.successIcon}>✅</Text>
        </View>
        <Text style={styles.successTitle}>انتهت الرحلة بنجاح!</Text>
        <Text style={styles.successSubtitle}>شكراً لك كابتن أحمد</Text>
      </View>

      {/* Earnings Card */}
      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>أرباح هذه الرحلة</Text>
        <Text style={styles.earningsAmount}>8,000</Text>
        <Text style={styles.earningsCurrency}>دينار عراقي</Text>
        <View style={styles.earningsDetails}>
          <View style={styles.earningsDetail}>
            <Text style={styles.earningsDetailLabel}>المسافة</Text>
            <Text style={styles.earningsDetailValue}>3.2 كم</Text>
          </View>
          <View style={styles.earningsDetailDivider} />
          <View style={styles.earningsDetail}>
            <Text style={styles.earningsDetailLabel}>المدة</Text>
            <Text style={styles.earningsDetailValue}>12 دقيقة</Text>
          </View>
          <View style={styles.earningsDetailDivider} />
          <View style={styles.earningsDetail}>
            <Text style={styles.earningsDetailLabel}>نوع الدفع</Text>
            <Text style={styles.earningsDetailValue}>نقداً</Text>
          </View>
        </View>
      </View>

      {/* Rate Rider */}
      <View style={styles.rateSection}>
        <Text style={styles.rateTitle}>كيف كان الراكب؟</Text>
        <Text style={styles.rateSubtitle}>محمد علي</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Text style={[styles.star, star <= rating && styles.starActive]}>
                ★
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Today Stats */}
      <View style={styles.todayStats}>
        <Text style={styles.todayTitle}>إحصائيات اليوم</Text>
        <View style={styles.todayRow}>
          <View style={styles.todayStat}>
            <Text style={styles.todayStatValue}>9</Text>
            <Text style={styles.todayStatLabel}>رحلات</Text>
          </View>
          <View style={styles.todayStatDivider} />
          <View style={styles.todayStat}>
            <Text style={[styles.todayStatValue, { color: "#FFD700" }]}>55,500</Text>
            <Text style={styles.todayStatLabel}>د.ع اليوم</Text>
          </View>
          <View style={styles.todayStatDivider} />
          <View style={styles.todayStat}>
            <Text style={styles.todayStatValue}>4.9 ⭐</Text>
            <Text style={styles.todayStatLabel}>تقييمي</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.newTripBtn}
          onPress={() => router.replace("/captain/home" as any)}
        >
          <Text style={styles.newTripText}>رحلة جديدة</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.earningsBtn}
          onPress={() => router.push("/captain/earnings" as any)}
        >
          <Text style={styles.earningsBtnText}>عرض الأرباح</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0533",
    paddingHorizontal: 24,
  },
  backBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 8, marginBottom: 4 },
  backBtnText: { color: "#9B8EC4", fontSize: 15, fontWeight: "600" },
  successSection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  successCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#2D1B69",
    borderWidth: 3,
    borderColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successIcon: { fontSize: 40 },
  successTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 6,
  },
  successSubtitle: {
    color: "#9B8AB0",
    fontSize: 14,
  },
  earningsCard: {
    backgroundColor: "#2D1B69",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFD700",
    marginBottom: 20,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  earningsLabel: {
    color: "#9B8AB0",
    fontSize: 13,
    marginBottom: 8,
  },
  earningsAmount: {
    color: "#FFD700",
    fontSize: 48,
    fontWeight: "bold",
  },
  earningsCurrency: {
    color: "#9B8AB0",
    fontSize: 14,
    marginBottom: 16,
  },
  earningsDetails: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
  },
  earningsDetail: { alignItems: "center" },
  earningsDetailLabel: {
    color: "#9B8AB0",
    fontSize: 11,
    marginBottom: 4,
  },
  earningsDetailValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  earningsDetailDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#3D2580",
  },
  rateSection: {
    backgroundColor: "#2D1B69",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  rateTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  rateSubtitle: {
    color: "#9B8AB0",
    fontSize: 13,
    marginBottom: 14,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
  },
  star: {
    fontSize: 36,
    color: "#3D2580",
  },
  starActive: {
    color: "#FFD700",
  },
  todayStats: {
    backgroundColor: "#2D1B69",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  todayTitle: {
    color: "#9B8AB0",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },
  todayRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  todayStat: { alignItems: "center" },
  todayStatValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  todayStatLabel: {
    color: "#9B8AB0",
    fontSize: 10,
    marginTop: 2,
  },
  todayStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#3D2580",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  newTripBtn: {
    flex: 2,
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
  newTripText: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "bold",
  },
  earningsBtn: {
    flex: 1,
    backgroundColor: "#2D1B69",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3D2580",
  },
  earningsBtnText: {
    color: "#C4B5D4",
    fontSize: 14,
    fontWeight: "600",
  },
});

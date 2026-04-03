import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

export default function TripSummaryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    rideId?: string;
    fare?: string;
    distance?: string;
    duration?: string;
    passengerName?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
  }>();

  const fare = params.fare ? parseInt(params.fare) : 0;
  const distance = params.distance ? parseFloat(params.distance) : 0;
  const duration = params.duration ? parseInt(params.duration) : 0;
  const passengerName = params.passengerName ?? "الراكب";
  const pickupAddress = params.pickupAddress ?? "موقع الانطلاق";
  const dropoffAddress = params.dropoffAddress ?? "الوجهة";

  const handleGoHome = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.replace("/captain/home" as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* أيقونة النجاح */}
        <View style={styles.successSection}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>🎉</Text>
          </View>
          <Text style={styles.successTitle}>اكتملت الرحلة!</Text>
          <Text style={styles.successSubtitle}>أحسنت! لقد أوصلت راكبك بأمان</Text>
        </View>

        {/* بطاقة الراكب */}
        <View style={styles.passengerCard}>
          <View style={styles.passengerAvatar}>
            <Text style={styles.passengerAvatarText}>👤</Text>
          </View>
          <View>
            <Text style={styles.passengerLabel}>الراكب</Text>
            <Text style={styles.passengerName}>{passengerName}</Text>
          </View>
        </View>

        {/* تفاصيل المسار */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.routeText} numberOfLines={2}>{pickupAddress}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.dotRed} />
            <Text style={styles.routeText} numberOfLines={2}>{dropoffAddress}</Text>
          </View>
        </View>

        {/* إحصائيات الرحلة */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>{fare.toLocaleString("ar-IQ")}</Text>
            <Text style={styles.statLabel}>دينار</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📍</Text>
            <Text style={styles.statValue}>{distance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>كيلومتر</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>⏱️</Text>
            <Text style={styles.statValue}>{duration}</Text>
            <Text style={styles.statLabel}>دقيقة</Text>
          </View>
        </View>

        {/* تذكير بالأرباح */}
        <View style={styles.earningsNote}>
          <Text style={styles.earningsNoteText}>
            💡 تم إضافة هذه الرحلة لسجل أرباحك
          </Text>
        </View>

        {/* أزرار */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.earningsBtn}
            onPress={() => router.push("/captain/earnings" as any)}
          >
            <Text style={styles.earningsBtnText}>📊 عرض الأرباح</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome}>
            <Text style={styles.homeBtnText}>الرئيسية 🏠</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
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
  body: { padding: 24, paddingBottom: 40 },
  passengerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#1E1035",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#2D1B4E",
  },
  passengerAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFD700",
  },
  passengerAvatarText: { fontSize: 26 },
  passengerLabel: { color: "#9B8EC4", fontSize: 12 },
  passengerName: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  routeCard: {
    backgroundColor: "#1E1035", borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: "#2D1B4E",
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeLine: { width: 2, height: 16, backgroundColor: "#3D2070", marginLeft: 5, marginVertical: 4 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#22C55E" },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#EF4444" },
  routeText: { color: "#ECEDEE", fontSize: 14, flex: 1 },
  statsCard: {
    flexDirection: "row", backgroundColor: "#1E1035", borderRadius: 16,
    padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#2D1B4E",
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statIcon: { fontSize: 22 },
  statValue: { color: "#FFD700", fontSize: 20, fontWeight: "900" },
  statLabel: { color: "#9B8EC4", fontSize: 12 },
  statDivider: { width: 1, backgroundColor: "#2D1B4E" },
  earningsNote: {
    backgroundColor: "rgba(255,215,0,0.08)", borderRadius: 12, padding: 12,
    marginBottom: 24, borderWidth: 1, borderColor: "rgba(255,215,0,0.2)",
  },
  earningsNoteText: { color: "#FFD700", fontSize: 13, textAlign: "center" },
  homeBtn: {
    flex: 2, backgroundColor: "#FFD700", paddingVertical: 16,
    borderRadius: 14, alignItems: "center",
  },
  homeBtnText: { color: "#1A0533", fontSize: 16, fontWeight: "900" },
});

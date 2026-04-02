import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

// Simulated map background with Mosul streets
const MapBackground = () => (
  <View style={styles.mapContainer}>
    <View style={styles.mapBg}>
      {/* Simulated street grid */}
      {[...Array(8)].map((_, i) => (
        <View key={`h${i}`} style={[styles.streetH, { top: 40 + i * 60 }]} />
      ))}
      {[...Array(6)].map((_, i) => (
        <View key={`v${i}`} style={[styles.streetV, { left: 20 + i * 65 }]} />
      ))}
      {/* Tigris river */}
      <View style={styles.river} />
      {/* Location markers */}
      <View style={[styles.marker, { top: 120, left: 80 }]}>
        <Text style={styles.markerText}>📍</Text>
      </View>
      <View style={[styles.marker, { top: 200, left: 180 }]}>
        <Text style={styles.markerText}>🚗</Text>
      </View>
      <View style={[styles.marker, { top: 80, left: 250 }]}>
        <Text style={styles.markerText}>🚗</Text>
      </View>
      {/* Captain marker */}
      <View style={[styles.captainMarker, { top: 160, left: 150 }]}>
        <Text style={styles.captainMarkerText}>⭐</Text>
      </View>
    </View>
    {/* Map overlay gradient */}
    <View style={styles.mapOverlay} />
  </View>
);

export default function CaptainHomeScreen() {
  const insets = useSafeAreaInsets();
  const [isOnline, setIsOnline] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [requestTimer, setRequestTimer] = useState(25);
  const [todayEarnings] = useState(47500);
  const [todayTrips] = useState(8);
  const [rating] = useState(4.9);

  // Demo: show request after going online
  useEffect(() => {
    if (isOnline) {
      const timeout = setTimeout(() => setShowRequest(true), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline]);

  // Request timer countdown
  useEffect(() => {
    if (!showRequest) {
      setRequestTimer(25);
      return;
    }
    const interval = setInterval(() => {
      setRequestTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowRequest(false);
          return 25;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showRequest]);

  const handleAccept = () => {
    setShowRequest(false);
    router.push("/captain/active-trip" as any);
  };

  const handleReject = () => {
    setShowRequest(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>أ</Text>
          </View>
          <View>
            <Text style={styles.captainLabel}>الكابتن</Text>
            <Text style={styles.captainName}>أحمد محمد</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingIcon}>⭐</Text>
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => router.push("/captain/profile" as any)}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Map */}
      <MapBackground />

      {/* Online/Offline Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleBtn, isOnline ? styles.toggleOnline : styles.toggleOffline]}
          onPress={() => setIsOnline(!isOnline)}
        >
          <View style={[styles.toggleDot, isOnline ? styles.toggleDotOn : styles.toggleDotOff]} />
          <Text style={[styles.toggleText, isOnline ? styles.toggleTextOn : styles.toggleTextOff]}>
            {isOnline ? "متاح الآن" : "غير متاح"}
          </Text>
        </TouchableOpacity>
        {isOnline && (
          <Text style={styles.waitingText}>في انتظار الطلبات...</Text>
        )}
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayEarnings.toLocaleString()}</Text>
          <Text style={styles.statCurrency}>د.ع</Text>
          <Text style={styles.statLabel}>أرباح اليوم</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMiddle]}>
          <Text style={styles.statValue}>{todayTrips}</Text>
          <Text style={styles.statLabel}>رحلات اليوم</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{rating}</Text>
          <Text style={styles.statLabel}>تقييمي</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <ScrollView style={styles.actionsScroll} contentContainerStyle={styles.actionsContent}>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/captain/earnings" as any)}
          >
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionLabel}>أرباحي</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/captain/trips" as any)}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>رحلاتي</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/captain/documents" as any)}
          >
            <Text style={styles.actionIcon}>📄</Text>
            <Text style={styles.actionLabel}>وثائقي</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/captain/support" as any)}
          >
            <Text style={styles.actionIcon}>🎧</Text>
            <Text style={styles.actionLabel}>الدعم</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Incoming Request Modal */}
      <Modal
        visible={showRequest}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequest(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.requestCard}>
            {/* Timer */}
            <View style={styles.timerCircle}>
              <Text style={styles.timerNumber}>{requestTimer}</Text>
              <Text style={styles.timerLabel}>ثانية</Text>
            </View>

            <Text style={styles.requestTitle}>طلب رحلة جديد!</Text>

            {/* Rider Info */}
            <View style={styles.riderInfo}>
              <View style={styles.riderAvatar}>
                <Text style={styles.riderAvatarText}>م</Text>
              </View>
              <View>
                <Text style={styles.riderName}>محمد علي</Text>
                <View style={styles.riderRating}>
                  <Text style={styles.riderRatingText}>⭐ 4.8</Text>
                </View>
              </View>
            </View>

            {/* Trip Details */}
            <View style={styles.tripDetails}>
              <View style={styles.tripPoint}>
                <View style={[styles.tripDot, { backgroundColor: "#22C55E" }]} />
                <View style={styles.tripPointInfo}>
                  <Text style={styles.tripPointLabel}>من</Text>
                  <Text style={styles.tripPointName}>شارع النجار، الموصل الجديدة</Text>
                </View>
              </View>
              <View style={styles.tripLine} />
              <View style={styles.tripPoint}>
                <View style={[styles.tripDot, { backgroundColor: "#FFD700" }]} />
                <View style={styles.tripPointInfo}>
                  <Text style={styles.tripPointLabel}>إلى</Text>
                  <Text style={styles.tripPointName}>جامعة الموصل، الدندان</Text>
                </View>
              </View>
            </View>

            {/* Trip Stats */}
            <View style={styles.tripStats}>
              <View style={styles.tripStat}>
                <Text style={styles.tripStatValue}>3.2 كم</Text>
                <Text style={styles.tripStatLabel}>المسافة</Text>
              </View>
              <View style={styles.tripStatDivider} />
              <View style={styles.tripStat}>
                <Text style={styles.tripStatValue}>8 د</Text>
                <Text style={styles.tripStatLabel}>الوقت</Text>
              </View>
              <View style={styles.tripStatDivider} />
              <View style={styles.tripStat}>
                <Text style={[styles.tripStatValue, { color: "#FFD700" }]}>8,000 د.ع</Text>
                <Text style={styles.tripStatLabel}>الأجرة</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.requestActions}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <Text style={styles.rejectText}>رفض</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                <Text style={styles.acceptText}>قبول الرحلة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0533",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#1A0533",
    fontSize: 18,
    fontWeight: "bold",
  },
  captainLabel: {
    color: "#9B8AB0",
    fontSize: 11,
  },
  captainName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2D1B69",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  ratingIcon: { fontSize: 12 },
  ratingText: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "bold",
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2D1B69",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    color: "#FFD700",
    fontSize: 18,
  },
  // Map
  mapContainer: {
    height: 220,
    overflow: "hidden",
  },
  mapBg: {
    flex: 1,
    backgroundColor: "#1E0F4A",
    position: "relative",
  },
  streetH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#2D1B69",
  },
  streetV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#2D1B69",
  },
  river: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: "#1A3A6B",
    opacity: 0.7,
    transform: [{ rotate: "-3deg" }],
  },
  marker: {
    position: "absolute",
  },
  markerText: { fontSize: 20 },
  captainMarker: {
    position: "absolute",
    backgroundColor: "#FFD700",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  captainMarkerText: { fontSize: 16 },
  mapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#1A0533",
    opacity: 0.3,
  },
  // Toggle
  toggleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 10,
  },
  toggleOnline: {
    backgroundColor: "#22C55E",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  toggleOffline: {
    backgroundColor: "#2D1B69",
    borderWidth: 1,
    borderColor: "#3D2580",
  },
  toggleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  toggleDotOn: { backgroundColor: "#FFFFFF" },
  toggleDotOff: { backgroundColor: "#9B8AB0" },
  toggleText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  toggleTextOn: { color: "#FFFFFF" },
  toggleTextOff: { color: "#9B8AB0" },
  waitingText: {
    color: "#9B8AB0",
    fontSize: 12,
    marginTop: 6,
  },
  // Stats
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3D2580",
  },
  statCardMiddle: {
    borderColor: "#FFD700",
    borderWidth: 1.5,
  },
  statValue: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "bold",
  },
  statCurrency: {
    color: "#9B8AB0",
    fontSize: 10,
  },
  statLabel: {
    color: "#9B8AB0",
    fontSize: 11,
    marginTop: 2,
  },
  // Actions
  actionsScroll: { flex: 1 },
  actionsContent: { paddingHorizontal: 16 },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    width: (width - 52) / 4,
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#3D2580",
  },
  actionIcon: { fontSize: 24 },
  actionLabel: {
    color: "#C4B5D4",
    fontSize: 11,
    textAlign: "center",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  requestCard: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 2,
    borderColor: "#FFD700",
  },
  timerCircle: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2D1B69",
    borderWidth: 3,
    borderColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  timerNumber: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "bold",
  },
  timerLabel: {
    color: "#9B8AB0",
    fontSize: 9,
  },
  requestTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  riderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3D2580",
    alignItems: "center",
    justifyContent: "center",
  },
  riderAvatarText: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "bold",
  },
  riderName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  riderRating: { marginTop: 2 },
  riderRatingText: {
    color: "#9B8AB0",
    fontSize: 12,
  },
  tripDetails: {
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  tripPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tripDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tripPointInfo: { flex: 1 },
  tripPointLabel: {
    color: "#9B8AB0",
    fontSize: 11,
  },
  tripPointName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  tripLine: {
    width: 2,
    height: 16,
    backgroundColor: "#3D2580",
    marginLeft: 5,
    marginVertical: 4,
  },
  tripStats: {
    flexDirection: "row",
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    justifyContent: "space-around",
    alignItems: "center",
  },
  tripStat: { alignItems: "center" },
  tripStatValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  tripStatLabel: {
    color: "#9B8AB0",
    fontSize: 11,
    marginTop: 2,
  },
  tripStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#3D2580",
  },
  requestActions: {
    flexDirection: "row",
    gap: 12,
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#2D1B69",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  rejectText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "bold",
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  acceptText: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "bold",
  },
});

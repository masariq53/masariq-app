import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TripPhase = "pickup" | "in_trip" | "arrived";

export default function CaptainActiveTripScreen() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<TripPhase>("pickup");

  const handlePhaseAction = () => {
    if (phase === "pickup") setPhase("in_trip");
    else if (phase === "in_trip") setPhase("arrived");
    else {
      router.push("/captain/trip-summary" as any);
    }
  };

  const phaseConfig = {
    pickup: {
      title: "في الطريق لاستلام الراكب",
      subtitle: "شارع النجار، الموصل الجديدة",
      btnText: "وصلت لموقع الراكب",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      markerColor: "#22C55E",
    },
    in_trip: {
      title: "الرحلة جارية",
      subtitle: "جامعة الموصل، الدندان",
      btnText: "إنهاء الرحلة",
      btnColor: "#22C55E",
      btnTextColor: "#FFFFFF",
      markerColor: "#FFD700",
    },
    arrived: {
      title: "وصلنا للوجهة!",
      subtitle: "جامعة الموصل، الدندان",
      btnText: "تأكيد إنهاء الرحلة",
      btnColor: "#FFD700",
      btnTextColor: "#1A0533",
      markerColor: "#FFD700",
    },
  };

  const config = phaseConfig[phase];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Map Area */}
      <View style={styles.mapArea}>
        <View style={styles.mapBg}>
          {[...Array(6)].map((_, i) => (
            <View key={`h${i}`} style={[styles.streetH, { top: 30 + i * 55 }]} />
          ))}
          {[...Array(5)].map((_, i) => (
            <View key={`v${i}`} style={[styles.streetV, { left: 30 + i * 70 }]} />
          ))}
          {/* Route line */}
          <View style={styles.routeLine} />
          {/* Pickup marker */}
          <View style={[styles.mapMarker, { top: 80, left: 60, backgroundColor: "#22C55E" }]}>
            <Text style={styles.mapMarkerText}>📍</Text>
          </View>
          {/* Destination marker */}
          <View style={[styles.mapMarker, { top: 180, left: 220, backgroundColor: "#FFD700" }]}>
            <Text style={styles.mapMarkerText}>🏁</Text>
          </View>
          {/* Captain car */}
          <View style={[styles.captainCar, { top: 120, left: 130 }]}>
            <Text style={styles.captainCarText}>🚗</Text>
          </View>
        </View>

        {/* Phase indicator */}
        <View style={styles.phaseIndicator}>
          <View style={[styles.phaseDot, phase !== "pickup" ? styles.phaseDotDone : styles.phaseDotActive]} />
          <View style={[styles.phaseLine, phase === "arrived" ? styles.phaseLineDone : {}]} />
          <View style={[styles.phaseDot, phase === "in_trip" ? styles.phaseDotActive : phase === "arrived" ? styles.phaseDotDone : styles.phaseDotInactive]} />
          <View style={styles.phaseLine} />
          <View style={[styles.phaseDot, phase === "arrived" ? styles.phaseDotActive : styles.phaseDotInactive]} />
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: config.markerColor }]} />
          <Text style={styles.statusTitle}>{config.title}</Text>
        </View>
        <Text style={styles.statusSubtitle}>{config.subtitle}</Text>

        {/* Rider Card */}
        <View style={styles.riderCard}>
          <View style={styles.riderLeft}>
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
          <View style={styles.riderActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL("tel:07701234567")}
            >
              <Text style={styles.actionBtnIcon}>📞</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionBtnIcon}>💬</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trip Info */}
        <View style={styles.tripInfo}>
          <View style={styles.tripInfoItem}>
            <Text style={styles.tripInfoLabel}>المسافة</Text>
            <Text style={styles.tripInfoValue}>3.2 كم</Text>
          </View>
          <View style={styles.tripInfoDivider} />
          <View style={styles.tripInfoItem}>
            <Text style={styles.tripInfoLabel}>الوقت المتبقي</Text>
            <Text style={styles.tripInfoValue}>8 دقائق</Text>
          </View>
          <View style={styles.tripInfoDivider} />
          <View style={styles.tripInfoItem}>
            <Text style={styles.tripInfoLabel}>الأجرة</Text>
            <Text style={[styles.tripInfoValue, { color: "#FFD700" }]}>8,000 د.ع</Text>
          </View>
        </View>

        {/* Main Action Button */}
        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: config.btnColor }]}
          onPress={handlePhaseAction}
        >
          <Text style={[styles.mainBtnText, { color: config.btnTextColor }]}>
            {config.btnText}
          </Text>
        </TouchableOpacity>

        {/* Emergency */}
        <TouchableOpacity style={styles.emergencyBtn}>
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyText}>طوارئ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0533",
  },
  mapArea: {
    flex: 1,
    position: "relative",
  },
  mapBg: {
    flex: 1,
    backgroundColor: "#1E0F4A",
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
  routeLine: {
    position: "absolute",
    top: 95,
    left: 70,
    width: 160,
    height: 3,
    backgroundColor: "#FFD700",
    opacity: 0.8,
    transform: [{ rotate: "25deg" }],
  },
  mapMarker: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  mapMarkerText: { fontSize: 18 },
  captainCar: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFD700",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  captainCarText: { fontSize: 20 },
  phaseIndicator: {
    position: "absolute",
    top: 20,
    right: 20,
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  phaseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  phaseDotActive: { backgroundColor: "#FFD700" },
  phaseDotDone: { backgroundColor: "#22C55E" },
  phaseDotInactive: { backgroundColor: "#3D2580" },
  phaseLine: {
    width: 2,
    height: 20,
    backgroundColor: "#3D2580",
  },
  phaseLineDone: { backgroundColor: "#22C55E" },
  bottomSheet: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 2,
    borderColor: "#2D1B69",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "bold",
  },
  statusSubtitle: {
    color: "#9B8AB0",
    fontSize: 13,
    marginBottom: 16,
    marginRight: 20,
  },
  riderCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  riderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  riderActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A0533",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnIcon: { fontSize: 20 },
  tripInfo: {
    flexDirection: "row",
    backgroundColor: "#2D1B69",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    justifyContent: "space-around",
    alignItems: "center",
  },
  tripInfoItem: { alignItems: "center" },
  tripInfoLabel: {
    color: "#9B8AB0",
    fontSize: 11,
    marginBottom: 4,
  },
  tripInfoValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  tripInfoDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#3D2580",
  },
  mainBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  mainBtnText: {
    fontSize: 17,
    fontWeight: "bold",
  },
  emergencyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  emergencyIcon: { fontSize: 16 },
  emergencyText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },
});

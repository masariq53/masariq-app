import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

const steps = [
  { id: 0, label: "جاري البحث عن سائق...", icon: "🔍" },
  { id: 1, label: "تم العثور على سائق!", icon: "✅" },
  { id: 2, label: "السائق في طريقه إليك", icon: "🚗" },
  { id: 3, label: "السائق وصل! ابحث عنه", icon: "📍" },
  { id: 4, label: "في الطريق إلى وجهتك", icon: "🛣️" },
  { id: 5, label: "وصلت! شكراً لاستخدامك موصل رايد", icon: "🎉" },
];

const driverInfo = {
  name: "أحمد محمد",
  rating: "4.9",
  car: "تويوتا كورولا - أبيض",
  plate: "م ٢٣٤٥ ن",
  phone: "07901234567",
};

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    // Auto-advance steps for demo
    const timers = [
      setTimeout(() => setCurrentStep(1), 2000),
      setTimeout(() => setCurrentStep(2), 4000),
      setTimeout(() => setCurrentStep(3), 8000),
      setTimeout(() => setCurrentStep(4), 12000),
    ];

    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      timers.forEach(clearTimeout);
      pulse.stop();
    };
  }, []);

  const handleCancel = () => {
    router.back();
  };

  const handleComplete = () => {
    router.replace("/(tabs)" as any);
  };

  const isCompleted = currentStep === 5;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Map Area */}
      <View style={styles.mapArea}>
        <View style={styles.mapBg}>
          <Text style={styles.mapBgText}>🗺️</Text>
        </View>

        {/* Animated Car */}
        <Animated.View
          style={[
            styles.carMarker,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.carEmoji}>🚗</Text>
        </Animated.View>

        {/* Destination Marker */}
        <View style={styles.destMarker}>
          <Text style={styles.destEmoji}>📍</Text>
        </View>

        {/* ETA Badge */}
        {currentStep >= 2 && currentStep < 5 && (
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>⏱ {8 - currentStep * 2} دقائق</Text>
          </View>
        )}
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHandle} />

        {/* Status */}
        <View style={styles.statusRow}>
          <Text style={styles.statusIcon}>{steps[currentStep].icon}</Text>
          <Text style={styles.statusText}>{steps[currentStep].label}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentStep / (steps.length - 1)) * 100}%` },
            ]}
          />
        </View>

        {/* Driver Info */}
        {currentStep >= 1 && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>أ</Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{driverInfo.name}</Text>
              <Text style={styles.driverCar}>{driverInfo.car}</Text>
              <Text style={styles.driverPlate}>{driverInfo.plate}</Text>
            </View>
            <View style={styles.driverActions}>
              <TouchableOpacity style={styles.driverActionBtn}>
                <Text style={styles.driverActionIcon}>📞</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.driverActionBtn}>
                <Text style={styles.driverActionIcon}>💬</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rating (after completion) */}
        {currentStep >= 1 && (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>تقييم السائق:</Text>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s}>
                <Text style={styles.ratingStar}>⭐</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Safety Button */}
        <TouchableOpacity style={styles.safetyBtn}>
          <Text style={styles.safetyBtnText}>🛡️  زر الطوارئ</Text>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {!isCompleted ? (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>إلغاء الرحلة</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.doneBtn} onPress={handleComplete}>
              <Text style={styles.doneBtnText}>🎉  تم! العودة للرئيسية</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  mapArea: {
    flex: 1,
    position: "relative",
  },
  mapBg: {
    flex: 1,
    backgroundColor: "#C8DDE8",
    alignItems: "center",
    justifyContent: "center",
  },
  mapBgText: {
    fontSize: 80,
    opacity: 0.3,
  },
  carMarker: {
    position: "absolute",
    top: "40%",
    left: "45%",
  },
  carEmoji: {
    fontSize: 36,
  },
  destMarker: {
    position: "absolute",
    top: "25%",
    right: "30%",
  },
  destEmoji: {
    fontSize: 32,
  },
  etaBadge: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#1A0533",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  etaText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "700",
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  statusIcon: {
    fontSize: 24,
  },
  statusText: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#F5F7FA",
    borderRadius: 3,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 3,
  },
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A0533",
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarText: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "800",
  },
  driverInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  driverName: {
    color: "#1A0533",
    fontSize: 15,
    fontWeight: "700",
  },
  driverCar: {
    color: "#6B7A8D",
    fontSize: 12,
    marginTop: 2,
  },
  driverPlate: {
    color: "#FFD700",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  driverActions: {
    flexDirection: "row",
    gap: 8,
  },
  driverActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  driverActionIcon: {
    fontSize: 18,
  },
  ratingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  ratingLabel: {
    color: "#6B7A8D",
    fontSize: 13,
  },
  ratingStar: {
    fontSize: 20,
  },
  safetyBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  safetyBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "700",
  },
  actionRow: {
    gap: 10,
  },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#6B7A8D",
    fontSize: 15,
    fontWeight: "600",
  },
  doneBtn: {
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const deliverySteps = [
  { id: 0, label: "جاري البحث عن مندوب توصيل", icon: "🔍", done: false },
  { id: 1, label: "تم تعيين المندوب", icon: "✅", done: false },
  { id: 2, label: "المندوب في طريقه لاستلام الطرد", icon: "🚗", done: false },
  { id: 3, label: "تم استلام الطرد", icon: "📦", done: false },
  { id: 4, label: "الطرد في الطريق إلى المستلم", icon: "🛣️", done: false },
  { id: 5, label: "تم التسليم بنجاح! 🎉", icon: "✅", done: false },
];

export default function DeliveryTrackingScreen() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setCurrentStep(1), 2000),
      setTimeout(() => setCurrentStep(2), 5000),
      setTimeout(() => setCurrentStep(3), 9000),
      setTimeout(() => setCurrentStep(4), 13000),
    ];

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      timers.forEach(clearTimeout);
      pulse.stop();
    };
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تتبع الطرد</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Map Area */}
      <View style={styles.mapArea}>
        <Text style={styles.mapEmoji}>🗺️</Text>
        <Animated.View style={[styles.deliveryMarker, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.deliveryEmoji}>🚗</Text>
        </Animated.View>
      </View>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        <View style={styles.stepsHandle} />
        <Text style={styles.stepsTitle}>مراحل التوصيل</Text>

        {deliverySteps.map((step, index) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.stepRight}>
              <View
                style={[
                  styles.stepCircle,
                  index < currentStep && styles.stepCircleDone,
                  index === currentStep && styles.stepCircleActive,
                ]}
              >
                <Text style={styles.stepCircleText}>
                  {index < currentStep ? "✓" : step.icon}
                </Text>
              </View>
              {index < deliverySteps.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    index < currentStep && styles.stepLineDone,
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                index === currentStep && styles.stepLabelActive,
                index < currentStep && styles.stepLabelDone,
              ]}
            >
              {step.label}
            </Text>
          </View>
        ))}

        {/* Tracking ID */}
        <View style={styles.trackingId}>
          <Text style={styles.trackingIdLabel}>رقم التتبع</Text>
          <Text style={styles.trackingIdValue}>#MR-2026-0042</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A2E4A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  mapArea: {
    height: 200,
    backgroundColor: "#C8DDE8",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  mapEmoji: {
    fontSize: 60,
    opacity: 0.3,
  },
  deliveryMarker: {
    position: "absolute",
    top: "40%",
    left: "45%",
  },
  deliveryEmoji: {
    fontSize: 32,
  },
  stepsContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  stepsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 16,
  },
  stepsTitle: {
    color: "#1A2E4A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 4,
  },
  stepRight: {
    alignItems: "center",
    width: 36,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  stepCircleDone: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  stepCircleActive: {
    backgroundColor: "#F5A623",
    borderColor: "#F5A623",
  },
  stepCircleText: {
    fontSize: 14,
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: "#E2E8F0",
    marginTop: 2,
  },
  stepLineDone: {
    backgroundColor: "#22C55E",
  },
  stepLabel: {
    color: "#9BA1A6",
    fontSize: 14,
    flex: 1,
    textAlign: "right",
    paddingTop: 8,
  },
  stepLabelActive: {
    color: "#1A2E4A",
    fontWeight: "700",
  },
  stepLabelDone: {
    color: "#22C55E",
    fontWeight: "600",
  },
  trackingId: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  trackingIdLabel: {
    color: "#6B7A8D",
    fontSize: 13,
  },
  trackingIdValue: {
    color: "#1A2E4A",
    fontSize: 14,
    fontWeight: "800",
  },
});

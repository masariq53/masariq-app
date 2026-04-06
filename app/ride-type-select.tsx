import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function RideTypeSelectScreen() {
  const insets = useSafeAreaInsets();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const card1Scale = useRef(new Animated.Value(0.92)).current;
  const card2Scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.spring(card1Scale, {
        toValue: 1,
        tension: 70,
        friction: 9,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.spring(card2Scale, {
        toValue: 1,
        tension: 70,
        friction: 9,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleCityRide = () => {
    router.push("/ride/book" as any);
  };

  const handleIntercityRide = () => {
    Alert.alert(
      "قريباً 🚀",
      "خدمة الأجرة بين المدن ستكون متاحة قريباً.\nسنُعلمك فور إطلاقها!",
      [{ text: "حسناً", style: "default" }]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>اختر نوع التوصيلة</Text>
          <Text style={styles.headerSubtitle}>إلى أين تريد الذهاب؟</Text>
        </View>
        <View style={{ width: 44 }} />
      </Animated.View>

      {/* Cards */}
      <View style={styles.cardsContainer}>

        {/* Card 1 — داخل المدينة */}
        <Animated.View style={{ transform: [{ scale: card1Scale }] }}>
          <TouchableOpacity
            style={styles.card}
            onPress={handleCityRide}
            activeOpacity={0.88}
          >
            {/* Gradient-like overlay */}
            <View style={styles.cardGradient} />

            {/* Badge */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>متاح الآن</Text>
            </View>

            {/* Icon */}
            <View style={styles.iconWrapper}>
              <Text style={styles.cardIcon}>🏙️</Text>
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>داخل المدينة</Text>
              <Text style={styles.cardDesc}>
                توصيلة سريعة داخل الموصل{"\n"}إلى أي حي أو منطقة
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <View style={styles.featureRow}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>⚡</Text>
                  <Text style={styles.featureText}>سريع</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>📍</Text>
                  <Text style={styles.featureText}>تتبع مباشر</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>💰</Text>
                  <Text style={styles.featureText}>أجرة ثابتة</Text>
                </View>
              </View>
              <View style={styles.arrowBtn}>
                <Text style={styles.arrowText}>احجز الآن ←</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Card 2 — إلى مدينة أخرى */}
        <Animated.View style={{ transform: [{ scale: card2Scale }] }}>
          <TouchableOpacity
            style={[styles.card, styles.cardIntercity]}
            onPress={handleIntercityRide}
            activeOpacity={0.88}
          >
            {/* Gradient-like overlay */}
            <View style={[styles.cardGradient, styles.cardGradientIntercity]} />

            {/* Badge */}
            <View style={[styles.badge, styles.badgeSoon]}>
              <Text style={[styles.badgeText, styles.badgeTextSoon]}>قريباً</Text>
            </View>

            {/* Icon */}
            <View style={[styles.iconWrapper, styles.iconWrapperIntercity]}>
              <Text style={styles.cardIcon}>🛣️</Text>
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, styles.cardTitleIntercity]}>
                إلى مدينة أخرى
              </Text>
              <Text style={[styles.cardDesc, styles.cardDescIntercity]}>
                سفر بين المدن العراقية{"\n"}بأمان وراحة تامة
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <View style={styles.featureRow}>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🛡️</Text>
                  <Text style={[styles.featureText, styles.featureTextIntercity]}>آمن</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🗺️</Text>
                  <Text style={[styles.featureText, styles.featureTextIntercity]}>بين المدن</Text>
                </View>
                <View style={styles.featureItem}>
                  <Text style={styles.featureIcon}>🕐</Text>
                  <Text style={[styles.featureText, styles.featureTextIntercity]}>مجدول</Text>
                </View>
              </View>
              <View style={[styles.arrowBtn, styles.arrowBtnIntercity]}>
                <Text style={[styles.arrowText, styles.arrowTextIntercity]}>إشعرني عند الإطلاق ←</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0A1E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  backIcon: {
    color: "#FFD700",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: "#9B8EC4",
    fontSize: 12,
    marginTop: 2,
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#1A0533",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "#FFD700",
    overflow: "hidden",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  cardIntercity: {
    backgroundColor: "#0D1A33",
    borderColor: "#4A9EFF",
    shadowColor: "#4A9EFF",
  },
  cardGradient: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,215,0,0.05)",
    transform: [{ translateX: 40 }, { translateY: -40 }],
  },
  cardGradientIntercity: {
    backgroundColor: "rgba(74,158,255,0.05)",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,215,0,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.4)",
    marginBottom: 16,
  },
  badgeSoon: {
    backgroundColor: "rgba(74,158,255,0.12)",
    borderColor: "rgba(74,158,255,0.35)",
  },
  badgeText: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeTextSoon: {
    color: "#4A9EFF",
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,215,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
  },
  iconWrapperIntercity: {
    backgroundColor: "rgba(74,158,255,0.1)",
    borderColor: "rgba(74,158,255,0.2)",
  },
  cardIcon: {
    fontSize: 36,
  },
  cardContent: {
    marginBottom: 20,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  cardTitleIntercity: {
    color: "#E8F4FF",
  },
  cardDesc: {
    color: "#C4B5D4",
    fontSize: 14,
    lineHeight: 22,
  },
  cardDescIntercity: {
    color: "#A0C4E8",
  },
  cardFooter: {
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  featureIcon: {
    fontSize: 13,
  },
  featureText: {
    color: "#9B8EC4",
    fontSize: 12,
    fontWeight: "600",
  },
  featureTextIntercity: {
    color: "#7AAFE0",
  },
  arrowBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  arrowBtnIntercity: {
    backgroundColor: "rgba(74,158,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(74,158,255,0.4)",
  },
  arrowText: {
    color: "#1A0533",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  arrowTextIntercity: {
    color: "#4A9EFF",
  },
});

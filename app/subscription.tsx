import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const plans = [
  {
    id: "basic",
    name: "الأساسي",
    price: "25,000",
    period: "شهرياً",
    rides: "10",
    color: "#6B7A8D",
    features: ["10 رحلات شهرياً", "خصم 10%", "أولوية الحجز"],
    popular: false,
  },
  {
    id: "standard",
    name: "المميز",
    price: "45,000",
    period: "شهرياً",
    rides: "20",
    color: "#1A2E4A",
    features: ["20 رحلة شهرياً", "خصم 20%", "أولوية قصوى", "دعم على مدار الساعة"],
    popular: true,
  },
  {
    id: "premium",
    name: "البريميوم",
    price: "80,000",
    period: "شهرياً",
    rides: "غير محدود",
    color: "#F5A623",
    features: ["رحلات غير محدودة", "خصم 30%", "سيارات فاخرة", "سائق خاص", "أولوية قصوى"],
    popular: false,
  },
];

const corporatePlans = [
  {
    id: "school",
    icon: "🎓",
    name: "المدارس",
    desc: "خطة خاصة لنقل الطلاب",
    price: "تواصل معنا",
  },
  {
    id: "company",
    icon: "🏢",
    name: "الشركات",
    desc: "نقل موظفي شركتك",
    price: "تواصل معنا",
  },
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState("standard");

  const handleSubscribe = () => {
    Alert.alert(
      "تأكيد الاشتراك",
      `هل تريد الاشتراك في الخطة ${plans.find((p) => p.id === selectedPlan)?.name}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "اشترك الآن",
          onPress: () => {
            Alert.alert("تم!", "تم تفعيل اشتراكك بنجاح 🎉");
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الاشتراكات</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>⭐</Text>
          <Text style={styles.heroTitle}>وفّر أكثر مع الاشتراك</Text>
          <Text style={styles.heroSubtitle}>خطط مرنة تناسب احتياجاتك</Text>
        </View>

        {/* Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>خطط الأفراد</Text>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardActive,
                plan.popular && styles.planCardPopular,
              ]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>الأكثر شيوعاً</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planPrice, { color: plan.color }]}>
                    {plan.price} <Text style={styles.planPeriod}>د.ع/{plan.period}</Text>
                  </Text>
                  <Text style={styles.planRides}>{plan.rides} رحلة</Text>
                </View>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View
                    style={[
                      styles.selectCircle,
                      selectedPlan === plan.id && styles.selectCircleActive,
                    ]}
                  >
                    {selectedPlan === plan.id && <View style={styles.selectDot} />}
                  </View>
                </View>
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={styles.featureText}>{f}</Text>
                    <Text style={styles.featureCheck}>✓</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Corporate Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>خطط الشركات والمدارس</Text>
          {corporatePlans.map((plan) => (
            <TouchableOpacity key={plan.id} style={styles.corpCard}>
              <View style={styles.corpLeft}>
                <Text style={styles.corpPrice}>{plan.price}</Text>
              </View>
              <View style={styles.corpInfo}>
                <Text style={styles.corpName}>{plan.name}</Text>
                <Text style={styles.corpDesc}>{plan.desc}</Text>
              </View>
              <Text style={styles.corpIcon}>{plan.icon}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Subscribe Button */}
        <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe}>
          <Text style={styles.subscribeBtnText}>
            اشترك الآن — {plans.find((p) => p.id === selectedPlan)?.price} د.ع
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  heroEmoji: {
    fontSize: 48,
  },
  heroTitle: {
    color: "#1A2E4A",
    fontSize: 22,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#6B7A8D",
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#1A2E4A",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  planCardActive: {
    borderColor: "#F5A623",
  },
  planCardPopular: {
    borderColor: "#1A2E4A",
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#1A2E4A",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomRightRadius: 12,
  },
  popularText: {
    color: "#F5A623",
    fontSize: 11,
    fontWeight: "700",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    marginTop: 8,
  },
  planName: {
    color: "#1A2E4A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 6,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "800",
  },
  planPeriod: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7A8D",
  },
  planRides: {
    color: "#6B7A8D",
    fontSize: 13,
    marginTop: 2,
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  selectCircleActive: {
    borderColor: "#F5A623",
  },
  selectDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F5A623",
  },
  featuresList: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#F5F7FA",
    paddingTop: 12,
  },
  featureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  featureText: {
    color: "#1A2E4A",
    fontSize: 13,
    textAlign: "right",
  },
  featureCheck: {
    color: "#22C55E",
    fontSize: 14,
    fontWeight: "700",
  },
  corpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  corpIcon: {
    fontSize: 32,
  },
  corpInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  corpName: {
    color: "#1A2E4A",
    fontSize: 15,
    fontWeight: "700",
  },
  corpDesc: {
    color: "#6B7A8D",
    fontSize: 12,
    marginTop: 2,
  },
  corpLeft: {
    alignItems: "flex-start",
  },
  corpPrice: {
    color: "#F5A623",
    fontSize: 13,
    fontWeight: "700",
  },
  subscribeBtn: {
    backgroundColor: "#F5A623",
    borderRadius: 18,
    paddingVertical: 18,
    marginHorizontal: 16,
    alignItems: "center",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 16,
  },
  subscribeBtnText: {
    color: "#1A2E4A",
    fontSize: 17,
    fontWeight: "800",
  },
});

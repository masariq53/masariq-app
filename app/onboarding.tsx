import React, { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    title: "توصيل سريع وآمن",
    subtitle: "احجز رحلتك في ثوانٍ مع سائقين موثوقين ومعتمدين في الموصل",
    emoji: "🚗",
    bg: "#1A2E4A",
    accent: "#F5A623",
  },
  {
    id: "2",
    title: "توصيل الطرود",
    subtitle: "أرسل وتسلّم طرودك داخل المدينة بسرعة وأمان تام",
    emoji: "📦",
    bg: "#1A2E4A",
    accent: "#F5A623",
  },
  {
    id: "3",
    title: "اشتراكات مرنة",
    subtitle: "خطط اشتراك خاصة للموظفين والطلاب بأسعار مناسبة",
    emoji: "⭐",
    bg: "#1A2E4A",
    accent: "#F5A623",
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      await AsyncStorage.setItem("onboarding_done", "true");
      router.replace("/auth/login");
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem("onboarding_done", "true");
    router.replace("/auth/login");
  };

  const renderSlide = ({ item }: { item: (typeof slides)[0] }) => (
    <View style={[styles.slide, { width }]}>
      <View style={styles.emojiContainer}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Skip Button */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>تخطي</Text>
      </TouchableOpacity>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>موصل رايد</Text>
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      />

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {slides.map((_, index) => {
          const dotWidth = scrollX.interpolate({
            inputRange: [(index - 1) * width, index * width, (index + 1) * width],
            outputRange: [8, 24, 8],
            extrapolate: "clamp",
          });
          const dotOpacity = scrollX.interpolate({
            inputRange: [(index - 1) * width, index * width, (index + 1) * width],
            outputRange: [0.4, 1, 0.4],
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              key={index}
              style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
            />
          );
        })}
      </View>

      {/* Next / Start Button */}
      <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
        <Text style={styles.nextText}>
          {currentIndex === slides.length - 1 ? "ابدأ الآن" : "التالي"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A2E4A",
    alignItems: "center",
  },
  skipBtn: {
    position: "absolute",
    top: 60,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.5)",
  },
  skipText: {
    color: "#F5A623",
    fontSize: 14,
    fontWeight: "600",
  },
  logoContainer: {
    marginTop: 100,
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
    letterSpacing: 1,
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  emojiContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(245,166,35,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    borderWidth: 2,
    borderColor: "rgba(245,166,35,0.3)",
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
    writingDirection: "rtl",
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 26,
    writingDirection: "rtl",
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F5A623",
  },
  nextBtn: {
    backgroundColor: "#F5A623",
    paddingHorizontal: 60,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 50,
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextText: {
    color: "#1A2E4A",
    fontSize: 18,
    fontWeight: "800",
  },
});

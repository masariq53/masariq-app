import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Alert, Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { LanguageProvider } from "@/lib/i18n";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { PassengerProvider, usePassenger } from "@/lib/passenger-context";
import { DriverProvider, useDriver } from "@/lib/driver-context";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { registerPassengerNotifications } from "@/lib/passenger-notifications";
import { addNotification } from "@/lib/notification-store";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * تسجيل pushToken للراكب تلقائياً عند فتح التطبيق.
 * Must be inside PassengerProvider and trpc.Provider.
 */
function PassengerPushTokenRegistrar() {
  const { passenger } = usePassenger();
  const savePushToken = trpc.rides.savePassengerPushToken.useMutation();

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!passenger?.id) return;

    const register = async () => {
      try {
        const token = await registerPassengerNotifications();
        if (token) {
          savePushToken.mutate({ passengerId: passenger.id, token });
        }
      } catch (e) {
        console.warn("[Push] Failed to register passenger push token on app start:", e);
      }
    };
    register();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passenger?.id]);

  return null;
}

/**
 * Handles incoming Push notifications for account block/unblock events.
 * Must be inside DriverProvider to access driver context.
 */
function NotificationHandler() {
  const { logout } = useDriver();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const bookingSound = useAudioPlayer(require("../assets/sounds/new-booking.mp3"));
  const rideSound = useAudioPlayer(require("../assets/sounds/new-ride.mp3"));

  useEffect(() => {
    if (Platform.OS === "web") return;
    // Enable audio in silent mode
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    // ─── معالجة الإشعارات الواردة أثناء التطبيق مفتوح (foreground) ───
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      const title = notification.request.content.title || "";
      const body = notification.request.content.body || "";
      const notifType = data?.type || "unknown";

      console.log(`[NotifHandler] Received foreground notification: type=${notifType}, title=${title}`);

      // حفظ الإشعار في المخزن المحلي
      addNotification({ title, body, type: notifType, data: data || {} }).catch(() => {});

      // تشغيل صوت حسب نوع الإشعار
      if (notifType === "intercity_booking") {
        try { bookingSound.seekTo(0); bookingSound.play(); } catch (e) { console.warn("[Sound] booking:", e); }
      } else if (notifType === "driver_heading" || notifType === "driver_arrived_at_pickup") {
        try { rideSound.seekTo(0); rideSound.play(); } catch (e) { console.warn("[Sound] ride:", e); }
      } else if (notifType === "chat_message") {
        try { rideSound.seekTo(0); rideSound.play(); } catch (e) { console.warn("[Sound] chat:", e); }
      } else if (notifType === "booking_cancelled_by_driver" || notifType === "booking_cancelled") {
        try { rideSound.seekTo(0); rideSound.play(); } catch (e) { console.warn("[Sound] cancel:", e); }
      } else if (notifType === "trip_completed") {
        try { rideSound.seekTo(0); rideSound.play(); } catch (e) { console.warn("[Sound] complete:", e); }
      }

      // معالجة خاصة: حظر/إلغاء حظر الحساب
      if (notifType === "account_blocked") {
        const reason = data.blockReason || "تم تعطيل حسابك من قِبل الإدارة";
        Alert.alert(
          "🚫 تم تعطيل حسابك",
          `سيتم تسجيل خروجك من وضع الكابتن.\n\nالسبب: ${reason}\n\nللاستفسار تواصل مع الدعم.`,
          [{ text: "حسناً", onPress: async () => { await logout(); router.dismissAll(); router.replace("/(tabs)/profile" as any); } }],
          { cancelable: false }
        );
      } else if (notifType === "account_unblocked") {
        Alert.alert(
          "✅ تم تفعيل حسابك",
          "تم إعادة تفعيل حسابك كسائق. يمكنك الآن الدخول لوضع الكابتن!",
          [{ text: "دخول وضع الكابتن 🚗", onPress: () => router.push("/(tabs)/profile" as any) }]
        );
      }

      // عرض Alert فوري للإشعارات المهمة (foreground)
      if (notifType === "driver_heading") {
        Alert.alert("🚗 السائق في طريقه إليك", body, [{ text: "حسناً" }]);
      } else if (notifType === "driver_arrived_at_pickup") {
        Alert.alert("📍 السائق وصل إلى موقعك!", body, [{ text: "حسناً" }]);
      } else if (notifType === "booking_cancelled_by_driver") {
        Alert.alert("❌ تم إلغاء حجزك", body, [
          { text: "عرض الحجوزات", onPress: () => router.push("/intercity/my-bookings" as any) },
          { text: "حسناً" },
        ]);
      } else if (notifType === "trip_completed") {
        Alert.alert("✅ وصلت إلى وجهتك!", body, [{ text: "حسناً" }]);
      } else if (notifType === "chat_message") {
        Alert.alert(title, body, [
          { text: "عرض الحجوزات", onPress: () => router.push("/intercity/my-bookings" as any) },
          { text: "حسناً" },
        ]);
      } else if (notifType === "intercity_booking") {
        Alert.alert("🎫 حجز جديد!", body, [
          { text: "عرض الرحلات", onPress: () => router.push("/captain/intercity-trips" as any) },
          { text: "حسناً" },
        ]);
      }
    });

    // ─── معالجة الضغط على الإشعار (notification tap) ───
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      const notifType = data?.type || "unknown";
      console.log(`[NotifHandler] Notification tapped: type=${notifType}`);

      if (notifType === "intercity_booking") {
        router.push("/captain/intercity-trips" as any);
      } else if (notifType === "driver_heading" || notifType === "driver_arrived_at_pickup") {
        router.push("/intercity/my-bookings" as any);
      } else if (notifType === "chat_message") {
        router.push("/intercity/my-bookings" as any);
      } else if (notifType === "booking_cancelled_by_driver" || notifType === "booking_cancelled") {
        router.push("/intercity/my-bookings" as any);
      } else if (notifType === "trip_completed") {
        router.push("/intercity/my-bookings" as any);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [logout]);

  return null;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DriverProvider>
      <NotificationHandler />
      <PassengerProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <PassengerPushTokenRegistrar />
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="login" />
            <Stack.Screen name="auth/otp" />
            <Stack.Screen name="ride/book" />
            <Stack.Screen name="ride/tracking" />
            <Stack.Screen name="delivery/tracking" />
            <Stack.Screen name="delivery/new" />
            <Stack.Screen name="subscription" />
            <Stack.Screen name="wallet" />
            <Stack.Screen name="driver/register" />
            {/* شاشات الكابتن: fullScreenModal يعزلها بـ stack منفصل تماماً عن التطبيق الرئيسي،
                 وعند dismissAll() يُمسح كل شيء دفعة واحدة بدون أي تاريخ متبقٍ */}
            <Stack.Screen name="captain/home" options={{ headerShown: false, gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/earnings" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/active-trip" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/trip-summary" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/profile" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/rate-passenger" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/trips" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/documents" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/support" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/wallet" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/intercity-trips" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="captain/intercity-schedule" options={{ gestureEnabled: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="oauth/callback" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="about" />
            <Stack.Screen name="help" />
            <Stack.Screen name="addresses" />
            <Stack.Screen name="promo" />
            <Stack.Screen name="driver/login" />
            <Stack.Screen name="driver/otp" />
            <Stack.Screen name="driver/status" />
            <Stack.Screen name="ride/rating" />
            <Stack.Screen name="notifications" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
      </PassengerProvider>
      </DriverProvider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <LanguageProvider>
        <ThemeProvider>
          <SafeAreaProvider initialMetrics={providerInitialMetrics}>
            <SafeAreaFrameContext.Provider value={frame}>
              <SafeAreaInsetsContext.Provider value={insets}>
                {content}
              </SafeAreaInsetsContext.Provider>
            </SafeAreaFrameContext.Provider>
          </SafeAreaProvider>
        </ThemeProvider>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Alert, AppState, Platform } from "react-native";
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
import { usePathname } from "expo-router";
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
 * Polls passenger account status every 4 seconds using trpc utils directly.
 * On block: shows full-screen overlay (via PassengerContext) - NO navigation used.
 * On unblock: hides overlay and shows alert.
 */
function PassengerBlockChecker() {
  const { passenger, setPassenger, setIsBlockedOverlay, navigatingToSupportRef, registerBlockNavigation } = usePassenger();
  const wasBlockedRef = useRef(false);
  const utils = trpc.useUtils();
  const pathname = usePathname();

  // نحتفظ pathname في ref حتى لا يحدث stale closure داخل setInterval
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Register navigation callbacks for the overlay buttons
  useEffect(() => {
    registerBlockNavigation({
      toSupport: async () => {
        // نتحقق من وجود تذكرة مفتوحة للمستخدم أولاً
        if (passenger?.id) {
          try {
            const tickets = await utils.support.getTickets.fetch({ userId: passenger.id, userType: "passenger" });
            const openTicket = (tickets as any[]).find((t: any) => t.status === "open" || t.status === "in_progress");
            if (openTicket) {
              // فتح المحادثة الموجودة مباشرة
              router.replace({
                pathname: "/support/chat",
                params: { ticketId: openTicket.id, subject: openTicket.subject, fromBlocked: "1" },
              } as any);
              return;
            }
          } catch (e) {
            // silent fail - go to new ticket
          }
        }
        // لا توجد تذكرة مفتوحة - افتح صفحة تذكرة جديدة
        router.replace({ pathname: "/support/new", params: { fromBlocked: "1" } } as any);
      },
      toLogin: () => {
        router.replace("/auth/login" as any);
      },
    });
  }, [registerBlockNavigation, passenger?.id]);

  useEffect(() => {
    if (!passenger?.id) return;
    const pid = passenger.id;

    const checkBlock = async () => {
      try {
        const data = await utils.passenger.checkStatus.fetch(
          { passengerId: pid },
          { signal: undefined }
        );
        if (!data) return;
        const { isBlocked } = data as { isBlocked: boolean; blockReason: string | null };

        // نقرأ pathname من ref حتى نحصل على القيمة الحالية وليس القديمة (stale closure)
        const currentPath = pathnameRef.current ?? "";
        const onSupportPage = currentPath.startsWith("/support") || currentPath.startsWith("/captain/support");

        // إذا كان المستخدم في صفحة الدعم أو جارٍ الانتقال إليها، لا نُظهر overlay الحظر
        if (isBlocked && (onSupportPage || navigatingToSupportRef.current)) {
          // تحديث الحالة فقط بدون إظهار overlay (showOverlay=false)
          if (passenger && passenger.isBlocked !== isBlocked) {
            setPassenger({ ...passenger, isBlocked }, false).catch(() => {});
          }
          wasBlockedRef.current = true;
          return;
        }

        // Update passenger context with latest isBlocked status
        // setPassenger already handles setIsBlockedOverlay internally
        if (passenger && passenger.isBlocked !== isBlocked) {
          await setPassenger({ ...passenger, isBlocked });
        } else if (isBlocked && !wasBlockedRef.current) {
          // Already blocked in context but overlay may not be showing
          setIsBlockedOverlay(true);
        }
        if (isBlocked && !wasBlockedRef.current) {
          wasBlockedRef.current = true;
          // Overlay is shown automatically via setPassenger -> setIsBlockedOverlay
        } else if (!isBlocked && wasBlockedRef.current) {
          wasBlockedRef.current = false;
          Alert.alert("✅ تم تفعيل حسابك", "تم إعادة تفعيل حسابك. يمكنك الآن استخدام التطبيق!", [{ text: "حسناً" }]);
        }
      } catch (e) {
        // silent fail - will retry next interval
      }
    };

    // Initialize wasBlockedRef from current state
    wasBlockedRef.current = passenger?.isBlocked ?? false;

    // Check immediately on mount/login
    checkBlock();

    // Then check every 4 seconds
    const interval = setInterval(checkBlock, 4000);

    // Also check immediately when app comes back to foreground
    const appStateSub = Platform.OS !== "web"
      ? AppState.addEventListener("change", (state) => {
          if (state === "active") checkBlock();
        })
      : null;

    return () => {
      clearInterval(interval);
      appStateSub?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passenger?.id]);

  return null;
}

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
          <PassengerBlockChecker />
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="account-blocked" options={{ headerShown: false, gestureEnabled: false }} />
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
            {/* شاشات الكابتن: gestureEnabled: false يمنع السحب للرجوع على iOS
                 الدخول عبر router.replace يجعل شاشة الكابتن تحل محل التطبيق بدون شيء خلفها */}
            <Stack.Screen name="captain/home" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="captain/earnings" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/active-trip" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/trip-summary" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/profile" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/rate-passenger" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/trips" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/documents" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/support" options={{ gestureEnabled: false }} />
            <Stack.Screen name="support" />
            <Stack.Screen name="support/new" />
            <Stack.Screen name="support/chat" />
            <Stack.Screen name="captain/wallet" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/intercity-trips" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/intercity-schedule" options={{ gestureEnabled: false }} />
            <Stack.Screen name="captain/active-parcel" options={{ gestureEnabled: false, headerShown: false }} />
            <Stack.Screen name="captain/parcel-summary" options={{ gestureEnabled: false, headerShown: false }} />
            <Stack.Screen name="captain/my-parcels" options={{ gestureEnabled: false, headerShown: false }} />
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

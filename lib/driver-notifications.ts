import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Configure notification handler - show alerts even in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and return the Expo push token.
 * Returns null if permissions are denied or on web.
 */
export async function registerDriverPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  // Set up Android notification channel for driver ride alerts
  if (Platform.OS === "android") {
    // قناة الطلبات الجديدة - أعلى أولوية + اهتزاز قوي
    await Notifications.setNotificationChannelAsync("driver-alerts", {
      name: "تنبيهات السائق",
      description: "إشعارات طلبات الرحلة الجديدة",
      importance: Notifications.AndroidImportance.MAX,
      // نمط اهتزاز طويل ومتكرر للفت الانتباه
      vibrationPattern: [0, 400, 200, 400, 200, 400, 200, 600],
      lightColor: "#FFD700",
      enableLights: true,
      enableVibrate: true,
      // صوت النظام الافتراضي (يتبع إعدادات الجهاز)
      sound: "default",
      bypassDnd: true, // تجاوز وضع عدم الإزعاج
    });
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // الإشعارات تعمل فقط على الأجهزة الحقيقية
  if (!Device.isDevice) {
    console.warn("[Push] Push notifications only work on physical devices");
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    console.log("[Push] Driver push token registered:", tokenData.data.substring(0, 30) + "...");
    return tokenData.data;
  } catch (e) {
    console.warn("[Push] Failed to get driver push token:", e);
    return null;
  }
}

/**
 * Send a local notification to the driver immediately.
 */
export async function sendDriverLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  if (Platform.OS === "web") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: "default",
      // Android: استخدام قناة driver-alerts ذات الأولوية القصوى
      ...(Platform.OS === "android" ? { channelId: "driver-alerts" } : {}),
    },
    trigger: null, // immediate
  });
}

/**
 * Notify driver that their registration was approved.
 */
export async function notifyDriverApproved(driverName: string) {
  await sendDriverLocalNotification(
    "🎉 تم قبول طلبك!",
    `مبروك ${driverName}! تم قبول حسابك كسائق في مسار. يمكنك الآن البدء باستقبال الرحلات.`,
    { type: "registration_approved" }
  );
}

/**
 * Notify driver that their registration was rejected.
 */
export async function notifyDriverRejected(driverName: string) {
  await sendDriverLocalNotification(
    "❌ تم رفض طلبك",
    `عزيزنا ${driverName}، للأسف تم رفض طلب تسجيلك. يمكنك التواصل مع الدعم لمزيد من المعلومات.`,
    { type: "registration_rejected" }
  );
}

/**
 * Notify driver of a new ride request nearby.
 */
export async function notifyNewRideRequest(from: string, to: string, price: string) {
  await sendDriverLocalNotification(
    "🚗 طلب رحلة جديد!",
    `من: ${from} → إلى: ${to} | السعر: ${price} د.ع`,
    { type: "new_ride_request" }
  );
}

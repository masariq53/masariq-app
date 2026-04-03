import * as Notifications from "expo-notifications";
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

  // Set up Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("driver-alerts", {
      name: "تنبيهات السائق",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FFD700",
      sound: "default",
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

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
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

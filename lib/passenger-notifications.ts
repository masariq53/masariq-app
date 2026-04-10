import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Handler مشترك مع driver-notifications (يُضبط مرة واحدة)
// لا نعيد ضبطه هنا لتجنب التعارض

/**
 * طلب صلاحيات الإشعارات للراكب وإعداد قناة Android.
 * يُستدعى عند تسجيل الدخول أو أول استخدام.
 * يعيد Expo Push Token أو null إذا فشل.
 */
export async function registerPassengerNotifications(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  // الإشعارات تعمل فقط على الأجهزة الحقيقية
  if (!Device.isDevice) {
    console.warn("[Push] Push notifications only work on physical devices");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("passenger-alerts", {
      name: "تنبيهات الراكب",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#FFD700",
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[Push] Passenger notification permission denied");
    return null;
  }

  try {
    // الحصول على projectId من Expo config
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    console.log("[Push] Passenger push token registered:", tokenData.data.substring(0, 30) + "...");
    return tokenData.data;
  } catch (e) {
    console.warn("[Push] Failed to get passenger push token:", e);
    return null;
  }
}

/**
 * إرسال إشعار محلي فوري للراكب.
 */
async function sendPassengerLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  if (Platform.OS === "web") return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {}, sound: "default" },
    trigger: null,
  });
}

/** إشعار: تم قبول الرحلة من السائق */
export async function notifyRideAccepted(driverName: string) {
  await sendPassengerLocalNotification(
    "✅ تم قبول رحلتك!",
    `السائق ${driverName} في طريقه إليك الآن.`,
    { type: "ride_accepted" }
  );
}

/** إشعار: السائق وصل لموقعك */
export async function notifyDriverArrived(driverName: string) {
  await sendPassengerLocalNotification(
    "📍 السائق وصل!",
    `${driverName} ينتظرك الآن. ابحث عن سيارته.`,
    { type: "driver_arrived" }
  );
}

/** إشعار: الرحلة اكتملت */
export async function notifyRideCompleted(fare: number) {
  await sendPassengerLocalNotification(
    "🎉 وصلت إلى وجهتك!",
    `تم إتمام رحلتك بنجاح. الأجرة: ${fare.toLocaleString("ar-IQ")} دينار`,
    { type: "ride_completed" }
  );
}

/** إشعار: تم إلغاء الرحلة */
export async function notifyRideCancelled(reason?: string) {
  await sendPassengerLocalNotification(
    "❌ تم إلغاء الرحلة",
    reason || "تم إلغاء رحلتك. يمكنك طلب رحلة جديدة.",
    { type: "ride_cancelled" }
  );
}

/** إشعار: لا يوجد سائقون متاحون */
export async function notifyNoDriversAvailable() {
  await sendPassengerLocalNotification(
    "😔 لا يوجد سائقون متاحون",
    "لم نتمكن من إيجاد سائق الآن. حاول مرة أخرى بعد قليل.",
    { type: "no_drivers" }
  );
}

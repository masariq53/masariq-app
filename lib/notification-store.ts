/**
 * مخزن الإشعارات المحلي - يحفظ الإشعارات في AsyncStorage
 * ويوفر واجهة لقراءتها وتحديثها
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATIONS_KEY = "@masar_notifications";
const MAX_NOTIFICATIONS = 50;

export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string; // ISO string
}

/**
 * جلب جميع الإشعارات المحفوظة
 */
export async function getStoredNotifications(): Promise<StoredNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredNotification[];
  } catch {
    return [];
  }
}

/**
 * إضافة إشعار جديد
 */
export async function addNotification(notif: Omit<StoredNotification, "id" | "read" | "createdAt">): Promise<void> {
  try {
    const existing = await getStoredNotifications();
    const newNotif: StoredNotification = {
      ...notif,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    // أضف في البداية (الأحدث أولاً) واحتفظ بحد أقصى
    const updated = [newNotif, ...existing].slice(0, MAX_NOTIFICATIONS);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("[NotifStore] Failed to add notification:", e);
  }
}

/**
 * تحديد إشعار كمقروء
 */
export async function markNotificationRead(id: string): Promise<void> {
  try {
    const existing = await getStoredNotifications();
    const updated = existing.map((n) => (n.id === id ? { ...n, read: true } : n));
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("[NotifStore] Failed to mark read:", e);
  }
}

/**
 * تحديد جميع الإشعارات كمقروءة
 */
export async function markAllNotificationsRead(): Promise<void> {
  try {
    const existing = await getStoredNotifications();
    const updated = existing.map((n) => ({ ...n, read: true }));
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("[NotifStore] Failed to mark all read:", e);
  }
}

/**
 * عدد الإشعارات غير المقروءة
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const existing = await getStoredNotifications();
    return existing.filter((n) => !n.read).length;
  } catch {
    return 0;
  }
}

/**
 * مسح جميع الإشعارات
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
  } catch (e) {
    console.warn("[NotifStore] Failed to clear:", e);
  }
}

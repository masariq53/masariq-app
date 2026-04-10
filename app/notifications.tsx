import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Platform, RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getStoredNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
  type StoredNotification,
} from "@/lib/notification-store";

const TYPE_ICONS: Record<string, string> = {
  intercity_booking: "🎫",
  driver_heading: "🚗",
  driver_arrived_at_pickup: "📍",
  chat_message: "💬",
  booking_cancelled_by_driver: "❌",
  booking_cancelled: "🚫",
  trip_completed: "✅",
  trip_in_progress: "🛣️",
  account_blocked: "🚫",
  account_unblocked: "✅",
  ride_accepted: "✅",
  driver_arrived: "📍",
  ride_completed: "🎉",
  ride_cancelled: "❌",
  no_drivers: "😔",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    const data = await getStoredNotifications();
    setNotifications(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handlePress = async (notif: StoredNotification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    }
    // التنقل حسب نوع الإشعار
    const { type, bookingId, tripId } = notif.data;
    if (type === "chat_message" && bookingId) {
      router.push(`/intercity/my-bookings` as any);
    } else if ((type === "driver_heading" || type === "driver_arrived_at_pickup") && bookingId) {
      router.push(`/intercity/my-bookings` as any);
    } else if (type === "intercity_booking") {
      router.push(`/captain/intercity-trips` as any);
    } else if (type === "booking_cancelled_by_driver" || type === "booking_cancelled") {
      router.push(`/intercity/my-bookings` as any);
    } else if (type === "trip_completed") {
      router.push(`/intercity/my-bookings` as any);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = ({ item }: { item: StoredNotification }) => {
    const icon = TYPE_ICONS[item.type] || "🔔";
    return (
      <TouchableOpacity
        style={[styles.notifItem, !item.read && styles.notifItemUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.notifIconWrap, !item.read && styles.notifIconWrapUnread]}>
          <Text style={styles.notifEmoji}>{icon}</Text>
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{"‹"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإشعارات</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerAction}>
              <Text style={styles.headerActionText}>قراءة الكل</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FFD700" size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
          <Text style={styles.emptySubtitle}>ستظهر هنا إشعارات الرحلات والرسائل</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadNotifications(); }}
              tintColor="#FFD700"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {notifications.length > 0 && (
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
          <Text style={styles.clearBtnText}>🗑️ مسح جميع الإشعارات</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0120" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1A0533",
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  backBtn: { padding: 8, width: 40, alignItems: "center" },
  backIcon: { color: "#FFD700", fontSize: 28, fontWeight: "300", lineHeight: 28 },
  headerTitle: { flex: 1, color: "#FFD700", fontSize: 18, fontWeight: "bold", textAlign: "center" },
  headerActions: { width: 80, alignItems: "flex-end" },
  headerAction: { paddingVertical: 4, paddingHorizontal: 8 },
  headerActionText: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyEmoji: { fontSize: 48, opacity: 0.5 },
  emptyTitle: { color: "#E0D0FF", fontSize: 18, fontWeight: "700" },
  emptySubtitle: { color: "#9B8EC4", fontSize: 14 },
  list: { paddingVertical: 8 },
  notifItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  notifItemUnread: { backgroundColor: "rgba(255,215,0,0.05)" },
  notifIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#1E0A3C",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  notifIconWrapUnread: {
    backgroundColor: "#2D1B69",
    borderColor: "#FFD700",
  },
  notifEmoji: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifTitle: { color: "#C4B5D4", fontSize: 14, fontWeight: "600", marginBottom: 2, textAlign: "right" },
  notifTitleUnread: { color: "#FFD700", fontWeight: "800" },
  notifBody: { color: "#9B8EC4", fontSize: 13, lineHeight: 19, textAlign: "right" },
  notifTime: { color: "#6B5A8A", fontSize: 11, marginTop: 4, textAlign: "right" },
  unreadDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#FFD700",
  },
  separator: { height: 1, backgroundColor: "#1E0A3C", marginHorizontal: 16 },
  clearBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#2D1B4E",
    marginBottom: Platform.OS === "ios" ? 30 : 10,
  },
  clearBtnText: { color: "#EF4444", fontSize: 14, fontWeight: "600" },
});

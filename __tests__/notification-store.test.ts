import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

import {
  getStoredNotifications,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  clearAllNotifications,
} from "../lib/notification-store";

describe("notification-store", () => {
  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  it("should return empty array when no notifications", async () => {
    const result = await getStoredNotifications();
    expect(result).toEqual([]);
  });

  it("should add a notification", async () => {
    await addNotification({
      title: "🚗 السائق في طريقه إليك",
      body: "السائق يتجه نحوك في رحلة الموصل → أربيل",
      type: "driver_heading",
      data: { type: "driver_heading", bookingId: 1, tripId: 5 },
    });

    const stored = await getStoredNotifications();
    expect(stored.length).toBe(1);
    expect(stored[0].title).toBe("🚗 السائق في طريقه إليك");
    expect(stored[0].type).toBe("driver_heading");
    expect(stored[0].read).toBe(false);
    expect(stored[0].id).toBeTruthy();
    expect(stored[0].createdAt).toBeTruthy();
  });

  it("should add newest notifications first", async () => {
    await addNotification({
      title: "First",
      body: "First notification",
      type: "test1",
      data: {},
    });
    await addNotification({
      title: "Second",
      body: "Second notification",
      type: "test2",
      data: {},
    });

    const stored = await getStoredNotifications();
    expect(stored.length).toBe(2);
    expect(stored[0].title).toBe("Second");
    expect(stored[1].title).toBe("First");
  });

  it("should mark notification as read", async () => {
    await addNotification({
      title: "Test",
      body: "Test body",
      type: "test",
      data: {},
    });

    const stored = await getStoredNotifications();
    expect(stored[0].read).toBe(false);

    await markNotificationRead(stored[0].id);
    const updated = await getStoredNotifications();
    expect(updated[0].read).toBe(true);
  });

  it("should mark all notifications as read", async () => {
    await addNotification({ title: "A", body: "A", type: "a", data: {} });
    await addNotification({ title: "B", body: "B", type: "b", data: {} });

    await markAllNotificationsRead();
    const stored = await getStoredNotifications();
    expect(stored.every((n) => n.read)).toBe(true);
  });

  it("should count unread notifications", async () => {
    await addNotification({ title: "A", body: "A", type: "a", data: {} });
    await addNotification({ title: "B", body: "B", type: "b", data: {} });

    let count = await getUnreadCount();
    expect(count).toBe(2);

    const stored = await getStoredNotifications();
    await markNotificationRead(stored[0].id);

    count = await getUnreadCount();
    expect(count).toBe(1);
  });

  it("should clear all notifications", async () => {
    await addNotification({ title: "A", body: "A", type: "a", data: {} });
    await addNotification({ title: "B", body: "B", type: "b", data: {} });

    await clearAllNotifications();
    const stored = await getStoredNotifications();
    expect(stored).toEqual([]);
  });

  it("should handle all intercity notification types", async () => {
    const types = [
      "intercity_booking",
      "driver_heading",
      "driver_arrived_at_pickup",
      "chat_message",
      "booking_cancelled_by_driver",
      "booking_cancelled",
      "trip_completed",
      "trip_in_progress",
    ];

    for (const type of types) {
      await addNotification({ title: `Test ${type}`, body: "body", type, data: { type } });
    }

    const stored = await getStoredNotifications();
    expect(stored.length).toBe(types.length);
    // Verify all types are stored
    const storedTypes = stored.map((n) => n.type);
    for (const type of types) {
      expect(storedTypes).toContain(type);
    }
  });
});

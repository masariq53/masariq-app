import { describe, it, expect, vi } from "vitest";

/**
 * اختبار التحقق من أن NotificationHandler في _layout.tsx يعالج
 * جميع أنواع إشعارات الرحلات بين المدن
 */

// قراءة ملف _layout.tsx والتحقق من وجود المعالجات
import { readFileSync } from "fs";
import { join } from "path";

const layoutContent = readFileSync(
  join(__dirname, "../app/_layout.tsx"),
  "utf-8"
);

describe("NotificationHandler coverage for intercity notifications", () => {
  const requiredNotifTypes = [
    "intercity_booking",
    "driver_heading",
    "driver_arrived_at_pickup",
    "chat_message",
    "booking_cancelled_by_driver",
    "trip_completed",
  ];

  it("should have addNotificationReceivedListener for foreground notifications", () => {
    expect(layoutContent).toContain("addNotificationReceivedListener");
  });

  it("should have addNotificationResponseReceivedListener for tap handling", () => {
    expect(layoutContent).toContain("addNotificationResponseReceivedListener");
  });

  it("should save notifications to local store", () => {
    expect(layoutContent).toContain("addNotification(");
  });

  for (const type of requiredNotifTypes) {
    it(`should handle notification type: ${type}`, () => {
      expect(layoutContent).toContain(`"${type}"`);
    });
  }

  it("should play sound for intercity_booking", () => {
    expect(layoutContent).toContain("bookingSound");
  });

  it("should play sound for driver_heading and driver_arrived_at_pickup", () => {
    expect(layoutContent).toContain("rideSound");
  });

  it("should show Alert for driver_heading in foreground", () => {
    // Verify there's an Alert.alert for driver_heading
    expect(layoutContent).toContain("السائق في طريقه إليك");
  });

  it("should show Alert for driver_arrived_at_pickup in foreground", () => {
    expect(layoutContent).toContain("السائق وصل إلى موقعك");
  });

  it("should navigate to my-bookings on notification tap for passenger types", () => {
    // responseListener should navigate to /intercity/my-bookings
    expect(layoutContent).toContain("/intercity/my-bookings");
  });

  it("should navigate to captain/intercity-trips on booking notification tap", () => {
    expect(layoutContent).toContain("/captain/intercity-trips");
  });
});

describe("Server-side push notification coverage", () => {
  const routersContent = readFileSync(
    join(__dirname, "../server/routers.ts"),
    "utf-8"
  );

  it("should send push for bookTrip", () => {
    expect(routersContent).toContain("[Push] bookTrip:");
  });

  it("should send push for bookWithGPS", () => {
    expect(routersContent).toContain("intercity booking notification");
  });

  it("should send push for bookTripWithPickup", () => {
    expect(routersContent).toContain("intercity bookTripWithPickup notification");
  });

  it("should send push for updateApproachStatus (heading/arrived)", () => {
    expect(routersContent).toContain("driver_heading");
    expect(routersContent).toContain("driver_arrived_at_pickup");
  });

  it("should send push for sendMessage (both directions)", () => {
    expect(routersContent).toContain("رسالة جديدة من السائق");
    expect(routersContent).toContain("رسالة جديدة من مسافر");
  });

  it("should send push for cancelPassenger", () => {
    expect(routersContent).toContain("booking_cancelled_by_driver");
  });

  it("should send push for cancelBooking (passenger cancels)", () => {
    expect(routersContent).toContain("booking_cancelled");
  });

  it("should send push for updateTripStatus (in_progress/completed)", () => {
    // type is dynamically built as `trip_${input.status}` where status is "in_progress" or "completed"
    expect(routersContent).toContain("`trip_${input.status}`");
    expect(routersContent).toContain("trip_completed");
  });

  it("should send push for updatePickupStatus (arrived)", () => {
    expect(routersContent).toContain("وصلت إلى وجهتك");
  });
});

describe("Notifications page exists", () => {
  it("should have notifications.tsx screen", () => {
    const notifContent = readFileSync(
      join(__dirname, "../app/notifications.tsx"),
      "utf-8"
    );
    expect(notifContent).toContain("getStoredNotifications");
    expect(notifContent).toContain("markNotificationRead");
    expect(notifContent).toContain("الإشعارات");
  });

  it("should have notifications screen registered in Stack", () => {
    expect(layoutContent).toContain('name="notifications"');
  });
});

describe("Bell icon navigation", () => {
  const indexContent = readFileSync(
    join(__dirname, "../app/(tabs)/index.tsx"),
    "utf-8"
  );

  it("should navigate to notifications on bell press", () => {
    expect(indexContent).toContain("/notifications");
  });

  it("should show unread count badge", () => {
    expect(indexContent).toContain("getUnreadCount");
    expect(indexContent).toContain("unreadCount");
  });
});

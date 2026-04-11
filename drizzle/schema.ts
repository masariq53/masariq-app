import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  float,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

// ─── Masar App Tables ────────────────────────────────────────────────────────

/**
 * Passengers / riders table
 */
export const passengers = mysqlTable("passengers", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }),
  photoUrl: text("photoUrl"),
  pendingPhone: varchar("pendingPhone", { length: 20 }),
  isVerified: boolean("isVerified").default(false).notNull(),
  walletBalance: decimal("walletBalance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalRides: int("totalRides").default(0).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastActiveAt: timestamp("lastActiveAt").defaultNow(),
  pushToken: text("pushToken"),
});

export type Passenger = typeof passengers.$inferSelect;
export type InsertPassenger = typeof passengers.$inferInsert;

/**
 * Drivers / captains table
 */
export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  // Registration status
  registrationStatus: mysqlEnum("registrationStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  rejectionReason: text("rejectionReason"),
  isVerified: boolean("isVerified").default(false).notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  isAvailable: boolean("isAvailable").default(false).notNull(),
  // Personal info
  nationalId: varchar("nationalId", { length: 30 }),
  photoUrl: text("photoUrl"),
  nationalIdPhotoUrl: text("nationalIdPhotoUrl"),
  nationalIdPhotoBackUrl: text("nationalIdPhotoBackUrl"),
  licensePhotoUrl: text("licensePhotoUrl"),
  // Vehicle info
  vehicleType: mysqlEnum("vehicleType", ["sedan", "suv", "minivan"]).default("sedan").notNull(),
  vehiclePlate: varchar("vehiclePlate", { length: 20 }),
  vehicleModel: varchar("vehicleModel", { length: 100 }),
  vehicleColor: varchar("vehicleColor", { length: 50 }),
  vehicleYear: varchar("vehicleYear", { length: 4 }),
  vehiclePhotoUrl: text("vehiclePhotoUrl"),
  // Location & stats
  currentLat: decimal("currentLat", { precision: 10, scale: 7 }),
  currentLng: decimal("currentLng", { precision: 10, scale: 7 }),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("5.00"),
  totalRides: int("totalRides").default(0).notNull(),
  walletBalance: decimal("walletBalance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastActiveAt: timestamp("lastActiveAt").defaultNow(),
  pushToken: text("pushToken"),
  isBlocked: boolean("isBlocked").default(false).notNull(),
  blockReason: text("blockReason"),
  // Registration location
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

/**
 * OTP verification codes
 */
export const otpCodes = mysqlTable("otpCodes", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  isUsed: boolean("isUsed").default(false).notNull(),
  attempts: int("attempts").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertOtpCode = typeof otpCodes.$inferInsert;

/**
 * Rides table
 */
export const rides = mysqlTable("rides", {
  id: int("id").autoincrement().primaryKey(),
  passengerId: int("passengerId").notNull(),
  driverId: int("driverId"),
  status: mysqlEnum("status", [
    "searching",
    "accepted",
    "driver_arrived",
    "in_progress",
    "completed",
    "cancelled",
  ])
    .default("searching")
    .notNull(),
  pickupLat: decimal("pickupLat", { precision: 10, scale: 7 }).notNull(),
  pickupLng: decimal("pickupLng", { precision: 10, scale: 7 }).notNull(),
  pickupAddress: text("pickupAddress"),
  dropoffLat: decimal("dropoffLat", { precision: 10, scale: 7 }).notNull(),
  dropoffLng: decimal("dropoffLng", { precision: 10, scale: 7 }).notNull(),
  dropoffAddress: text("dropoffAddress"),
  estimatedDistance: decimal("estimatedDistance", { precision: 8, scale: 2 }),
  estimatedDuration: int("estimatedDuration"),
  fare: decimal("fare", { precision: 10, scale: 2 }),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "wallet"]).default("cash"),
  passengerRating: int("passengerRating"),
  driverRating: int("driverRating"),
  cancelReason: text("cancelReason"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Ride = typeof rides.$inferSelect;
export type InsertRide = typeof rides.$inferInsert;

/**
 * Wallet transactions
 */
export const walletTransactions = mysqlTable("walletTransactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userType: mysqlEnum("userType", ["passenger", "driver"]).notNull(),
  type: mysqlEnum("type", ["credit", "debit"]).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  rideId: int("rideId"),
  balanceBefore: decimal("balanceBefore", { precision: 10, scale: 2 }),
  balanceAfter: decimal("balanceAfter", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;

/**
 * Pricing zones table - defines pricing rules per city and vehicle type
 */
export const pricingZones = mysqlTable("pricingZones", {
  id: int("id").autoincrement().primaryKey(),
  // Zone identity
  cityName: varchar("cityName", { length: 100 }).notNull(),
  cityNameAr: varchar("cityNameAr", { length: 100 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(), // fallback zone
  // Pricing method
  pricingMethod: mysqlEnum("pricingMethod", ["per_km", "per_minute", "hybrid"]).default("per_km").notNull(),
  // Vehicle type
  vehicleType: mysqlEnum("vehicleType", ["sedan", "suv", "minivan", "all"]).default("all").notNull(),
  // Base fare (minimum charge)
  baseFare: decimal("baseFare", { precision: 10, scale: 2 }).notNull().default("2000"),
  // Per-km pricing
  pricePerKm: decimal("pricePerKm", { precision: 10, scale: 2 }).notNull().default("1000"),
  // Per-minute pricing
  pricePerMinute: decimal("pricePerMinute", { precision: 10, scale: 2 }).notNull().default("100"),
  // Minimum fare (floor price)
  minimumFare: decimal("minimumFare", { precision: 10, scale: 2 }).notNull().default("3000"),
  // Maximum fare cap (0 = no cap)
  maximumFare: decimal("maximumFare", { precision: 10, scale: 2 }).notNull().default("0"),
  // Surge pricing multiplier (1.0 = normal, 1.5 = 50% surge)
  surgeMultiplier: decimal("surgeMultiplier", { precision: 4, scale: 2 }).notNull().default("1.00"),
  // Peak hours surge (JSON: [{start:"08:00",end:"10:00",multiplier:1.5}])
  peakHoursConfig: text("peakHoursConfig"),
  // Night hours extra charge (IQD added after certain hour)
  nightSurchargeStart: varchar("nightSurchargeStart", { length: 5 }), // e.g. "22:00"
  nightSurchargeEnd: varchar("nightSurchargeEnd", { length: 5 }),   // e.g. "06:00"
  nightSurchargeAmount: decimal("nightSurchargeAmount", { precision: 10, scale: 2 }).default("0"),
  // Booking fee (flat fee added to every ride)
  bookingFee: decimal("bookingFee", { precision: 10, scale: 2 }).notNull().default("0"),
  // Wait time charge (IQD per minute after free wait period)
  freeWaitMinutes: int("freeWaitMinutes").notNull().default(3),
  waitPricePerMinute: decimal("waitPricePerMinute", { precision: 10, scale: 2 }).notNull().default("0"),
  // Cancellation fee
  cancellationFee: decimal("cancellationFee", { precision: 10, scale: 2 }).notNull().default("0"),
  // Notes / description
  notes: text("notes"),
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: varchar("updatedBy", { length: 100 }),
});

export type PricingZone = typeof pricingZones.$inferSelect;
export type InsertPricingZone = typeof pricingZones.$inferInsert;

/**
 * Pricing history - audit log of all pricing changes
 */
export const pricingHistory = mysqlTable("pricingHistory", {
  id: int("id").autoincrement().primaryKey(),
  zoneId: int("zoneId").notNull(),
  changedBy: varchar("changedBy", { length: 100 }),
  changeNote: text("changeNote"),
  previousValues: text("previousValues"), // JSON snapshot of old values
  newValues: text("newValues"),           // JSON snapshot of new values
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PricingHistory = typeof pricingHistory.$inferSelect;
export type InsertPricingHistory = typeof pricingHistory.$inferInsert;

/**
 * Intercity trips - trips scheduled by drivers between cities
 */
export const intercityTrips = mysqlTable("intercityTrips", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  fromCity: varchar("fromCity", { length: 100 }).notNull(),
  toCity: varchar("toCity", { length: 100 }).notNull(),
  departureTime: timestamp("departureTime").notNull(),
  totalSeats: int("totalSeats").notNull().default(4),
  availableSeats: int("availableSeats").notNull().default(4),
  pricePerSeat: decimal("pricePerSeat", { precision: 10, scale: 2 }).notNull(),
  meetingPoint: text("meetingPoint"),
  notes: text("notes"),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled").notNull(),
  cancelReason: text("cancelReason"),
  cancelledBy: mysqlEnum("cancelledBy", ["driver", "admin"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntercityTrip = typeof intercityTrips.$inferSelect;
export type InsertIntercityTrip = typeof intercityTrips.$inferInsert;

/**
 * Intercity bookings - passenger seat reservations on intercity trips
 */
export const intercityBookings = mysqlTable("intercityBookings", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  passengerId: int("passengerId").notNull(),
  seatsBooked: int("seatsBooked").notNull().default(1),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "cancelled", "completed"]).default("confirmed").notNull(),
  passengerPhone: varchar("passengerPhone", { length: 20 }),
  passengerName: varchar("passengerName", { length: 100 }),
  pickupAddress: text("pickupAddress"),
  pickupLat: decimal("pickupLat", { precision: 10, scale: 7 }),
  pickupLng: decimal("pickupLng", { precision: 10, scale: 7 }),
  passengerNote: text("passengerNote"),
  pickupStatus: mysqlEnum("pickupStatus", ["waiting", "picked_up", "arrived"]).default("waiting"),
  // حالة توجه الكابتن نحو الراكب المعين
  driverApproachStatus: mysqlEnum("driverApproachStatus", ["idle", "heading", "arrived_at_pickup"]).default("idle"),
  // وقت الوصول التقديري بالدقائق عند ضغطة "التوجه إليه"
  etaMinutes: int("etaMinutes"),
  cancelledBy: varchar("cancelledBy", { length: 100 }),
  cancelReason: text("cancelReason"),
  passengerRating: int("passengerRating"),
  driverRating: int("driverRating"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type IntercityBooking = typeof intercityBookings.$inferSelect;
export type InsertIntercityBooking = typeof intercityBookings.$inferInsert;

// جدول تخزين موقع السائق لحظياً لكل رحلة
export const intercityDriverLocations = mysqlTable("intercityDriverLocations", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull(),
  driverId: int("driverId").notNull(),
  lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
  lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type IntercityDriverLocation = typeof intercityDriverLocations.$inferSelect;

// ─── Intercity Chat Messages ──────────────────────────────────────────────────
/**
 * Chat messages between captain and passenger for intercity bookings
 */
export const intercityMessages = mysqlTable("intercityMessages", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),   // الحجز المرتبط بالمحادثة
  tripId: int("tripId").notNull(),          // الرحلة المرتبطة
  senderType: mysqlEnum("senderType", ["passenger", "driver"]).notNull(),
  senderId: int("senderId").notNull(),      // passenger.id أو driver.id
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IntercityMessage = typeof intercityMessages.$inferSelect;
export type InsertIntercityMessage = typeof intercityMessages.$inferInsert;

// ─── Support Tickets ──────────────────────────────────────────────────────────
/**
 * Support tickets - created by passengers or drivers when they need help
 */
export const supportTickets = mysqlTable("supportTickets", {
  id: int("id").autoincrement().primaryKey(),
  // من أنشأ التذكرة
  userType: mysqlEnum("userType", ["passenger", "driver"]).notNull(),
  userId: int("userId").notNull(), // passenger.id أو driver.id
  userName: varchar("userName", { length: 100 }),
  userPhone: varchar("userPhone", { length: 20 }),
  // تفاصيل التذكرة
  category: mysqlEnum("category", [
    "payment",       // مشكلة في الدفع
    "ride",          // مشكلة في الرحلة
    "account",       // مشكلة في الحساب
    "driver",        // شكوى على السائق
    "passenger",     // شكوى على الراكب
    "app",           // مشكلة في التطبيق
    "other",         // أخرى
  ]).notNull().default("other"),
  subject: varchar("subject", { length: 200 }).notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
  // مرجع اختياري للرحلة
  rideId: int("rideId"),
  tripId: int("tripId"),
  // آخر رد
  lastRepliedAt: timestamp("lastRepliedAt"),
  lastRepliedBy: mysqlEnum("lastRepliedBy", ["user", "admin"]),
  // عدد الرسائل غير المقروءة من جانب الإدارة
  unreadByAdmin: int("unreadByAdmin").default(0).notNull(),
  // عدد الرسائل غير المقروءة من جانب المستخدم
  unreadByUser: int("unreadByUser").default(0).notNull(),
  closedAt: timestamp("closedAt"),
  closedBy: varchar("closedBy", { length: 100 }),
  // تقييم جودة الدعم (1-5 نجوم)
  rating: int("rating"),
  ratingComment: varchar("ratingComment", { length: 500 }),
  ratedAt: timestamp("ratedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

/**
 * Support messages - chat messages within a support ticket
 */
export const supportMessages = mysqlTable("supportMessages", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull(),
  senderType: mysqlEnum("senderType", ["user", "admin"]).notNull(),
  senderName: varchar("senderName", { length: 100 }),
  message: text("message").notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SupportMessage = typeof supportMessages.$inferSelect;
export type InsertSupportMessage = typeof supportMessages.$inferInsert;

/**
 * Agents (وكلاء معتمدون) - authorized agents who can recharge captain/passenger wallets
 */
export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  // مرتبط بمستخدم موجود (passenger)
  passengerId: int("passengerId").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  // وثائق التحقق
  facePhotoUrl: text("facePhotoUrl"),
  idFrontUrl: text("idFrontUrl"),
  idBackUrl: text("idBackUrl"),
  officePhotoUrl: text("officePhotoUrl"),
  // عنوان المكتب
  officeAddress: varchar("officeAddress", { length: 500 }),
  officeLatitude: float("officeLatitude"),
  officeLongitude: float("officeLongitude"),
  // الحالة
  status: mysqlEnum("status", ["pending", "approved", "rejected", "suspended"]).default("pending").notNull(),
  rejectionReason: varchar("rejectionReason", { length: 500 }),
  // رصيد الوكيل (يُشحن من الإدارة)
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0").notNull(),
  // إجمالي عمليات الشحن
  totalRecharges: int("totalRecharges").default(0).notNull(),
  totalRechargeAmount: decimal("totalRechargeAmount", { precision: 15, scale: 2 }).default("0").notNull(),
  // ملاحظات الإدارة
  adminNotes: text("adminNotes"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;

/**
 * Agent transactions - log of all recharge operations done by agents
 */
export const agentTransactions = mysqlTable("agentTransactions", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  // نوع المستفيد
  recipientType: mysqlEnum("recipientType", ["driver", "passenger"]).notNull(),
  recipientId: int("recipientId").notNull(),
  recipientName: varchar("recipientName", { length: 100 }),
  recipientPhone: varchar("recipientPhone", { length: 20 }),
  // المبلغ
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  // رصيد الوكيل قبل وبعد العملية
  agentBalanceBefore: decimal("agentBalanceBefore", { precision: 15, scale: 2 }).notNull(),
  agentBalanceAfter: decimal("agentBalanceAfter", { precision: 15, scale: 2 }).notNull(),
  notes: varchar("notes", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgentTransaction = typeof agentTransactions.$inferSelect;
export type InsertAgentTransaction = typeof agentTransactions.$inferInsert;

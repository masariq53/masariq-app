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

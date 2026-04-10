import { and, eq, gt, desc, inArray, sql, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  passengers,
  drivers,
  otpCodes,
  rides,
  walletTransactions,
  InsertPassenger,
  InsertDriver,
  InsertOtpCode,
  InsertRide,
  intercityTrips,
  intercityBookings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User (OAuth) ─────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

/**
 * Generate a random 6-digit OTP code
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create OTP record in DB (expires in 5 minutes)
 */
export async function createOtp(phone: string): Promise<string> {
  const db = await getDb();
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  if (!db) {
    // In dev mode without DB, return a fixed code for testing
    console.warn("[OTP] Database not available, using dev mode code: 123456");
    return "123456";
  }

  // Invalidate any existing OTPs for this phone
  await db
    .update(otpCodes)
    .set({ isUsed: true })
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.isUsed, false)));

  await db.insert(otpCodes).values({ phone, code, expiresAt });
  return code;
}

/**
 * Verify OTP code
 */
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const db = await getDb();

  if (!db) {
    // Dev mode: accept "123456" as valid
    return code === "123456";
  }

  const now = new Date();
  const result = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.code, code),
        eq(otpCodes.isUsed, false),
        gt(otpCodes.expiresAt, now)
      )
    )
    .limit(1);

  if (result.length === 0) return false;

  // Mark as used
  await db.update(otpCodes).set({ isUsed: true }).where(eq(otpCodes.id, result[0]!.id));
  return true;
}

// ─── Passengers ───────────────────────────────────────────────────────────────────────────────

/**
 * Check if phone number is already registered
 */
export async function checkPhoneExists(phone: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: passengers.id }).from(passengers).where(eq(passengers.phone, phone)).limit(1);
  return result.length > 0;
}

/**
 * Create a brand new passenger (registration flow)
 * Throws if phone already registered
 */
export async function registerNewPassenger(phone: string, name: string) {
  const db = await getDb();
  if (!db) {
    return { id: 1, phone, name, photoUrl: null, isVerified: true, walletBalance: "10000.00", totalRides: 0, rating: "5.00", createdAt: new Date(), updatedAt: new Date(), lastActiveAt: new Date() };
  }

  const existing = await db.select({ id: passengers.id }).from(passengers).where(eq(passengers.phone, phone)).limit(1);
  if (existing.length > 0) {
    throw new Error("رقم الهاتف مسجل بالفعل، يرجى تسجيل الدخول");
  }

  await db.insert(passengers).values({ phone, name, isVerified: true });
  const created = await db.select().from(passengers).where(eq(passengers.phone, phone)).limit(1);
  return created[0]!;
}

/**
 * Login existing passenger - throws if phone NOT registered
 */
export async function loginExistingPassenger(phone: string) {
  const db = await getDb();
  if (!db) {
    return { id: 1, phone, name: "مستخدم تجريبي", photoUrl: null, isVerified: true, walletBalance: "10000.00", totalRides: 0, rating: "5.00", createdAt: new Date(), updatedAt: new Date(), lastActiveAt: new Date() };
  }

  const existing = await db.select().from(passengers).where(eq(passengers.phone, phone)).limit(1);
  if (existing.length === 0) {
    throw new Error("رقم الهاتف غير مسجل، يرجى إنشاء حساب جديد");
  }

  await db.update(passengers).set({ lastActiveAt: new Date() }).where(eq(passengers.id, existing[0]!.id));
  return existing[0]!;
}

export async function getOrCreatePassenger(phone: string, name?: string) {
  const db = await getDb();
  if (!db) {
    // Return mock passenger for dev mode
    return { id: 1, phone, name: name || "مستخدم تجريبي", photoUrl: null, isVerified: true, walletBalance: "10000.00", totalRides: 0, rating: "5.00", createdAt: new Date(), updatedAt: new Date(), lastActiveAt: new Date() };
  }

  const existing = await db
    .select()
    .from(passengers)
    .where(eq(passengers.phone, phone))
    .limit(1);

  if (existing.length > 0) {
    // Update lastActiveAt
    await db.update(passengers).set({ lastActiveAt: new Date() }).where(eq(passengers.id, existing[0]!.id));
    return existing[0]!;
  }

  // Create new passenger
  await db.insert(passengers).values({
    phone,
    name: name || null,
    isVerified: true,
  });

  const created = await db.select().from(passengers).where(eq(passengers.phone, phone)).limit(1);
  return created[0]!;
}

export async function getPassengerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(passengers).where(eq(passengers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Update passenger name and/or photo URL
 */
export async function updatePassengerProfile(
  passengerId: number,
  data: { name?: string; photoUrl?: string }
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl;
  await db.update(passengers).set(updateData as any).where(eq(passengers.id, passengerId));
  const updated = await db.select().from(passengers).where(eq(passengers.id, passengerId)).limit(1);
  return updated[0]!;
}

/**
 * Set pending phone (step 1 of phone change: OTP sent to OLD phone)
 */
export async function setPendingPhone(passengerId: number, newPhone: string) {
  const db = await getDb();
  if (!db) return;
  // Check new phone is not taken
  const existing = await db.select({ id: passengers.id }).from(passengers).where(eq(passengers.phone, newPhone)).limit(1);
  if (existing.length > 0) throw new Error("رقم الهاتف الجديد مسجل بالفعل لدى مستخدم آخر");
  await db.update(passengers).set({ pendingPhone: newPhone }).where(eq(passengers.id, passengerId));
}

/**
 * Confirm phone change after OTP verified on new phone
 */
export async function confirmPhoneChange(passengerId: number) {
  const db = await getDb();
  if (!db) return;
  const passenger = await db.select().from(passengers).where(eq(passengers.id, passengerId)).limit(1);
  if (!passenger[0]?.pendingPhone) throw new Error("لا يوجد رقم هاتف معلّق للتغيير");
  const newPhone = passenger[0].pendingPhone;
  await db.update(passengers).set({ phone: newPhone, pendingPhone: null }).where(eq(passengers.id, passengerId));
  return newPhone;
}

// ─── Drivers ──────────────────────────────────────────────────────────────────

export async function getOrCreateDriver(phone: string, name: string) {
  const db = await getDb();
  if (!db) {
    return { id: 1, phone, name, registrationStatus: "pending" as const, rejectionReason: null, isVerified: false, isOnline: false, isAvailable: false, nationalId: null, photoUrl: null, nationalIdPhotoUrl: null, licensePhotoUrl: null, vehicleType: "sedan" as const, vehiclePlate: null, vehicleModel: null, vehicleColor: null, vehicleYear: null, vehiclePhotoUrl: null, currentLat: null, currentLng: null, rating: "5.00", totalRides: 0, walletBalance: "0.00", createdAt: new Date(), updatedAt: new Date(), lastActiveAt: new Date() };
  }

  const existing = await db.select().from(drivers).where(eq(drivers.phone, phone)).limit(1);
  if (existing.length > 0) return existing[0]!;

  await db.insert(drivers).values({ phone, name });
  const created = await db.select().from(drivers).where(eq(drivers.phone, phone)).limit(1);
  return created[0]!;
}

/**
 * Register a new driver with full details
 */
export async function registerDriver(data: {
  phone: string;
  name: string;
  nationalId?: string;
  photoUrl?: string;
  nationalIdPhotoUrl?: string;
  nationalIdPhotoBackUrl?: string;
  licensePhotoUrl?: string;
  vehicleType: "sedan" | "suv" | "minivan";
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehicleYear?: string;
  vehiclePhotoUrl?: string;
  country?: string;
  city?: string;
}) {
  const db = await getDb();
  if (!db) {
    return { id: Math.floor(Math.random() * 1000), ...data, registrationStatus: "pending" as const, isVerified: false, isOnline: false, isAvailable: false, rating: "5.00", totalRides: 0, walletBalance: "0.00", createdAt: new Date(), updatedAt: new Date(), lastActiveAt: new Date() };
  }

  // Check if phone already registered
  const existing = await db.select({ id: drivers.id, registrationStatus: drivers.registrationStatus }).from(drivers).where(eq(drivers.phone, data.phone)).limit(1);
  if (existing.length > 0) {
    // Update existing registration with new data
    await db.update(drivers).set({
      name: data.name,
      nationalId: data.nationalId || null,
      photoUrl: data.photoUrl || null,
      nationalIdPhotoUrl: data.nationalIdPhotoUrl || null,
      nationalIdPhotoBackUrl: data.nationalIdPhotoBackUrl || null,
      licensePhotoUrl: data.licensePhotoUrl || null,
      vehicleType: data.vehicleType,
      vehiclePlate: data.vehiclePlate || null,
      vehicleModel: data.vehicleModel || null,
      vehicleColor: data.vehicleColor || null,
      vehicleYear: data.vehicleYear || null,
      vehiclePhotoUrl: data.vehiclePhotoUrl || null,
      registrationStatus: "pending",
      country: data.country || null,
      city: data.city || null,
      updatedAt: new Date(),
    }).where(eq(drivers.id, existing[0]!.id));
    const updated = await db.select().from(drivers).where(eq(drivers.id, existing[0]!.id)).limit(1);
    return updated[0]!;
  }

  await db.insert(drivers).values({
    phone: data.phone,
    name: data.name,
    nationalId: data.nationalId || null,
    photoUrl: data.photoUrl || null,
    nationalIdPhotoUrl: data.nationalIdPhotoUrl || null,
    nationalIdPhotoBackUrl: data.nationalIdPhotoBackUrl || null,
    licensePhotoUrl: data.licensePhotoUrl || null,
    vehicleType: data.vehicleType,
    vehiclePlate: data.vehiclePlate || null,
    vehicleModel: data.vehicleModel || null,
    vehicleColor: data.vehicleColor || null,
    vehicleYear: data.vehicleYear || null,
    vehiclePhotoUrl: data.vehiclePhotoUrl || null,
    registrationStatus: "pending",
    country: data.country || null,
    city: data.city || null,
  });

  const created = await db.select().from(drivers).where(eq(drivers.phone, data.phone)).limit(1);
  return created[0]!;
}

/**
 * Get driver registration status by phone
 */
export async function getDriverByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(drivers).where(eq(drivers.phone, phone)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Get all pending driver registrations (and recently reviewed ones for admin visibility)
 */
export async function getPendingDrivers() {
  const db = await getDb();
  if (!db) return [];
  // Return all drivers ordered by latest first so admin sees new registrations
  return db.select().from(drivers).orderBy(desc(drivers.createdAt)).limit(100);
}

/**
 * Approve or reject a driver registration
 */
export async function updateDriverRegistrationStatus(
  driverId: number,
  status: "approved" | "rejected",
  rejectionReason?: string
) {
  const db = await getDb();
  if (!db) return;
  await db.update(drivers).set({
    registrationStatus: status,
    isVerified: status === "approved",
    rejectionReason: rejectionReason || null,
    updatedAt: new Date(),
  }).where(eq(drivers.id, driverId));
}

/**
 * Delete a driver account permanently
 */
export async function deleteDriver(driverId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(drivers).where(eq(drivers.id, driverId));
}

export async function updateDriverLocation(driverId: number, lat: number, lng: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(drivers)
    .set({ currentLat: lat.toString(), currentLng: lng.toString(), lastActiveAt: new Date() })
    .where(eq(drivers.id, driverId));
}

export async function setDriverOnlineStatus(driverId: number, isOnline: boolean, isAvailable: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(drivers).set({ isOnline, isAvailable }).where(eq(drivers.id, driverId));
}

export async function getNearbyDrivers(lat: number, lng: number, radiusKm: number = 5) {
  const db = await getDb();
  if (!db) {
    // Return mock drivers for dev mode
    return [
      {
        id: 1,
        name: "أحمد محمد",
        phone: "+9647701234567",
        vehicleType: "sedan" as const,
        vehicleModel: "تويوتا كامري",
        vehicleColor: "أبيض",
        vehiclePlate: "م ب 1234",
        rating: "4.8",
        currentLat: (lat + 0.003).toString(),
        currentLng: (lng + 0.002).toString(),
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        totalRides: 245,
        walletBalance: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date(),
      },
      {
        id: 2,
        name: "محمد علي",
        phone: "+9647709876543",
        vehicleType: "suv" as const,
        vehicleModel: "كيا سبورتاج",
        vehicleColor: "رمادي",
        vehiclePlate: "م ج 5678",
        rating: "4.9",
        currentLat: (lat - 0.004).toString(),
        currentLng: (lng + 0.003).toString(),
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        totalRides: 389,
        walletBalance: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date(),
      },
    ];
  }

  // Simple bounding box query (approximate)
  const latDelta = radiusKm / 111.0;
  const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

  const result = await db
    .select()
    .from(drivers)
    .where(eq(drivers.isAvailable, true));

  // Filter by distance (client-side for simplicity)
  return result.filter((d) => {
    if (!d.currentLat || !d.currentLng) return false;
    const dLat = Math.abs(parseFloat(d.currentLat.toString()) - lat);
    const dLng = Math.abs(parseFloat(d.currentLng.toString()) - lng);
    return dLat <= latDelta && dLng <= lngDelta;
  });
}

// ─── Rides ────────────────────────────────────────────────────────────────────

export async function createRide(data: InsertRide) {
  const db = await getDb();
  if (!db) {
    return { id: Math.floor(Math.random() * 10000), ...data };
  }
  await db.insert(rides).values(data);
  const created = await db
    .select()
    .from(rides)
    .where(eq(rides.passengerId, data.passengerId))
    .orderBy(desc(rides.createdAt))
    .limit(1);
  return created[0]!;
}

export async function updateRideStatus(
  rideId: number,
  status: "searching" | "accepted" | "driver_arrived" | "in_progress" | "completed" | "cancelled",
  extra?: { driverId?: number; startedAt?: Date; completedAt?: Date; cancelReason?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(rides)
    .set({ status, ...extra })
    .where(eq(rides.id, rideId));
}

export async function getRideById(rideId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPassengerRideHistory(passengerId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(rides)
    .where(eq(rides.passengerId, passengerId))
    .orderBy(desc(rides.createdAt))
    .limit(limit);
}

export async function getDriverRideHistory(driverId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(rides)
    .where(eq(rides.driverId, driverId))
    .orderBy(desc(rides.createdAt))
    .limit(limit);
}

/**
 * Get pending rides (searching status) for nearby available drivers
 */
export async function getPendingRides() {
  const db = await getDb();
  if (!db) return [];
  // فلتر زمني: فقط الطلبات التي أنشئت خلال آخر 3 دقائق - منع ظهور الطلبات القديمة
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
  return db
    .select()
    .from(rides)
    .where(
      and(
        eq(rides.status, "searching"),
        gt(rides.createdAt, threeMinutesAgo)
      )
    )
    .orderBy(desc(rides.createdAt))
    .limit(10);
}

/**
 * Get active ride for a specific driver (accepted/driver_arrived/in_progress)
 */
export async function getDriverActiveRide(driverId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(rides)
    .where(
      and(
        eq(rides.driverId, driverId),
        inArray(rides.status, ["accepted", "driver_arrived", "in_progress"])
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Save push notification token for a driver
 */
export async function saveDriverPushToken(driverId: number, token: string) {
  const db = await getDb();
  if (!db) return;
  // Save push token to database for persistence across server restarts
  await db.update(drivers).set({ pushToken: token, lastActiveAt: new Date() }).where(eq(drivers.id, driverId));
  // Also cache in memory for fast access
  driverPushTokens.set(driverId, token);
}

export async function getDriverPushToken(driverId: number): Promise<string | null> {
  // Check memory cache first
  if (driverPushTokens.has(driverId)) {
    return driverPushTokens.get(driverId) ?? null;
  }
  // Fallback to database
  const db = await getDb();
  if (!db) return null;
  const [driver] = await db.select({ pushToken: drivers.pushToken }).from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (driver?.pushToken) {
    driverPushTokens.set(driverId, driver.pushToken);
    return driver.pushToken;
  }
  return null;
}

// In-memory push token store (cache layer)
export const driverPushTokens = new Map<number, string>();

// In-memory push token store for passengers
export const passengerPushTokens = new Map<number, string>();

/**
 * Save push notification token for a passenger
 */
export async function savePassengerPushToken(passengerId: number, token: string) {
  const db = await getDb();
  passengerPushTokens.set(passengerId, token);
  if (!db) return;
  // Store in passengers table (add pushToken column if needed - using lastActiveAt as proxy for now)
  // We store in memory map for now; in production add pushToken column to passengers table
  await db.update(passengers).set({ lastActiveAt: new Date() }).where(eq(passengers.id, passengerId));
}

/**
 * Get push notification token for a passenger
 */
export async function getPassengerPushToken(passengerId: number): Promise<string | null> {
  // Check memory cache first
  if (passengerPushTokens.has(passengerId)) {
    return passengerPushTokens.get(passengerId) ?? null;
  }
  return null;
}

// ─── Admin / Dashboard ───────────────────────────────────────────────────────

/**
 * Get dashboard stats: total rides, passengers, drivers, revenue today
 */
export async function getAdminStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalRides: 0, todayRides: 0, activeRides: 0,
      totalPassengers: 0, totalDrivers: 0, onlineDrivers: 0,
      todayRevenue: 0, totalRevenue: 0,
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [allRides, allPassengers, allDrivers] = await Promise.all([
    db.select().from(rides),
    db.select().from(passengers),
    db.select().from(drivers),
  ]);

  const todayRides = allRides.filter(r => r.createdAt && r.createdAt >= todayStart);
  const activeRides = allRides.filter(r => ['searching', 'accepted', 'driver_arrived', 'in_progress'].includes(r.status));
  const onlineDrivers = allDrivers.filter(d => d.isOnline);

  const todayRevenue = todayRides
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + parseFloat(r.fare?.toString() || '0'), 0);

  const totalRevenue = allRides
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + parseFloat(r.fare?.toString() || '0'), 0);

  return {
    totalRides: allRides.length,
    todayRides: todayRides.length,
    activeRides: activeRides.length,
    totalPassengers: allPassengers.length,
    totalDrivers: allDrivers.length,
    onlineDrivers: onlineDrivers.length,
    todayRevenue: Math.round(todayRevenue),
    totalRevenue: Math.round(totalRevenue),
  };
}

/**
 * Get all rides with pagination
 */
export async function getAllRides(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rides).orderBy(desc(rides.createdAt)).limit(limit).offset(offset);
}

/**
 * Get all passengers
 */
export async function getAllPassengers(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(passengers).orderBy(desc(passengers.createdAt)).limit(limit).offset(offset);
}

/**
 * Get all drivers
 */
export async function getAllDrivers(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers).orderBy(desc(drivers.createdAt)).limit(limit).offset(offset);
}

/**
 * Verify or suspend a driver
 */
export async function updateDriverVerification(driverId: number, isVerified: boolean) {
  const db = await getDb();
  if (!db) return;
  // When verifying, also update registrationStatus to keep both fields in sync
  if (isVerified) {
    await db.update(drivers).set({ isVerified: true, registrationStatus: "approved" }).where(eq(drivers.id, driverId));
  } else {
    // When suspending, revert registrationStatus to pending so app shows correct state
    await db.update(drivers).set({ isVerified: false, registrationStatus: "pending" }).where(eq(drivers.id, driverId));
  }
}

/**
 * Get recent rides (last N)
 */
export async function getRecentRides(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rides).orderBy(desc(rides.createdAt)).limit(limit);
}

// ─── Fare Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate fare based on distance (in km)
 * Base fare: 2000 IQD
 * Per km: 1000 IQD
 * Minimum: 3000 IQD
 */
export function calculateFare(distanceKm: number): number {
  const baseFare = 2000;
  const perKm = 1000;
  const fare = baseFare + distanceKm * perKm;
  return Math.max(fare, 3000);
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Dynamic Pricing (Zones) ──────────────────────────────────────────────────

import { pricingZones, pricingHistory } from "../drizzle/schema";

/**
 * Get all pricing zones
 */
export async function getAllPricingZones() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pricingZones).orderBy(pricingZones.cityName);
}

/**
 * Get active pricing zone for a city and vehicle type
 * Falls back to "all" vehicle type, then to default zone
 */
export async function getPricingZone(
  cityName: string,
  vehicleType: "sedan" | "suv" | "minivan" = "sedan"
) {
  const db = await getDb();
  if (!db) return null;

  // Try exact match: city + vehicle type
  const exactMatch = await db
    .select()
    .from(pricingZones)
    .where(
      and(
        eq(pricingZones.isActive, true),
        sql`LOWER(${pricingZones.cityName}) = LOWER(${cityName})`,
        eq(pricingZones.vehicleType, vehicleType)
      )
    )
    .limit(1);
  if (exactMatch.length > 0) return exactMatch[0];

  // Try city + "all" vehicle type
  const cityAll = await db
    .select()
    .from(pricingZones)
    .where(
      and(
        eq(pricingZones.isActive, true),
        sql`LOWER(${pricingZones.cityName}) = LOWER(${cityName})`,
        eq(pricingZones.vehicleType, "all")
      )
    )
    .limit(1);
  if (cityAll.length > 0) return cityAll[0];

  // Fallback to default zone
  const defaultZone = await db
    .select()
    .from(pricingZones)
    .where(and(eq(pricingZones.isActive, true), eq(pricingZones.isDefault, true)))
    .limit(1);
  if (defaultZone.length > 0) return defaultZone[0];

  return null;
}

/**
 * Calculate fare using dynamic pricing zone
 * Rounds to nearest 250 IQD (smallest IQD denomination)
 */
export async function calculateFareDynamic(
  distanceKm: number,
  durationMinutes: number,
  cityName: string = "الموصل",
  vehicleType: "sedan" | "suv" | "minivan" = "sedan"
): Promise<{
  fare: number;
  breakdown: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    bookingFee: number;
    surgeMultiplier: number;
    nightSurcharge: number;
    total: number;
    pricingMethod: string;
    zoneName: string;
  };
}> {
  const zone = await getPricingZone(cityName, vehicleType);

  // If no zone found, use legacy hardcoded pricing
  if (!zone) {
    const fare = Math.max(2000 + distanceKm * 1000, 3000);
    const rounded = Math.ceil(fare / 250) * 250;
    return {
      fare: rounded,
      breakdown: {
        baseFare: 2000,
        distanceFare: Math.max(0, rounded - 2000),
        timeFare: 0,
        bookingFee: 0,
        surgeMultiplier: 1,
        nightSurcharge: 0,
        total: rounded,
        pricingMethod: "per_km",
        zoneName: "افتراضي",
      },
    };
  }

  const baseFare = parseFloat(zone.baseFare.toString());
  const pricePerKm = parseFloat(zone.pricePerKm.toString());
  const pricePerMinute = parseFloat(zone.pricePerMinute.toString());
  const bookingFee = parseFloat(zone.bookingFee.toString());
  const minimumFare = parseFloat(zone.minimumFare.toString());
  const maximumFare = parseFloat(zone.maximumFare.toString());
  const surgeMultiplier = parseFloat(zone.surgeMultiplier.toString());
  const nightSurchargeAmount = parseFloat((zone.nightSurchargeAmount ?? "0").toString());

  // Check peak hours
  let effectiveSurge = surgeMultiplier;
  if (zone.peakHoursConfig) {
    try {
      const peakConfig: Array<{ start: string; end: string; multiplier: number }> = JSON.parse(zone.peakHoursConfig);
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      for (const peak of peakConfig) {
        if (currentTime >= peak.start && currentTime <= peak.end) {
          effectiveSurge = Math.max(effectiveSurge, peak.multiplier);
          break;
        }
      }
    } catch (_) { /* ignore parse errors */ }
  }

  // Check night surcharge
  let nightSurcharge = 0;
  if (zone.nightSurchargeStart && zone.nightSurchargeEnd && nightSurchargeAmount > 0) {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const start = zone.nightSurchargeStart;
    const end = zone.nightSurchargeEnd;
    // Handle overnight range (e.g. 22:00 - 06:00)
    const isNight = start > end
      ? currentTime >= start || currentTime <= end
      : currentTime >= start && currentTime <= end;
    if (isNight) nightSurcharge = nightSurchargeAmount;
  }

  // Calculate based on pricing method
  let distanceFare = 0;
  let timeFare = 0;

  if (zone.pricingMethod === "per_km") {
    distanceFare = distanceKm * pricePerKm;
  } else if (zone.pricingMethod === "per_minute") {
    timeFare = durationMinutes * pricePerMinute;
  } else {
    // hybrid: both distance and time
    distanceFare = distanceKm * pricePerKm;
    timeFare = durationMinutes * pricePerMinute;
  }

  let fare = (baseFare + distanceFare + timeFare) * effectiveSurge + bookingFee + nightSurcharge;
  fare = Math.max(fare, minimumFare);
  if (maximumFare > 0) fare = Math.min(fare, maximumFare);

  // Round to nearest 250 IQD
  const rounded = Math.ceil(fare / 250) * 250;

  return {
    fare: rounded,
    breakdown: {
      baseFare,
      distanceFare: Math.round(distanceFare),
      timeFare: Math.round(timeFare),
      bookingFee,
      surgeMultiplier: effectiveSurge,
      nightSurcharge,
      total: rounded,
      pricingMethod: zone.pricingMethod,
      zoneName: zone.cityNameAr,
    },
  };
}

/**
 * Create a new pricing zone
 */
export async function createPricingZone(data: Omit<typeof pricingZones.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(pricingZones).values(data);
  return result;
}

/**
 * Update a pricing zone and log history
 */
export async function updatePricingZone(
  zoneId: number,
  data: Partial<Omit<typeof pricingZones.$inferInsert, "id" | "createdAt">>,
  changedBy?: string,
  changeNote?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Get current values for history
  const [current] = await db.select().from(pricingZones).where(eq(pricingZones.id, zoneId)).limit(1);
  if (!current) throw new Error("Zone not found");

  // Update zone
  await db.update(pricingZones).set(data).where(eq(pricingZones.id, zoneId));

  // Log history
  await db.insert(pricingHistory).values({
    zoneId,
    changedBy: changedBy ?? "admin",
    changeNote: changeNote ?? null,
    previousValues: JSON.stringify(current),
    newValues: JSON.stringify(data),
  });

  return { success: true };
}

/**
 * Delete a pricing zone
 */
export async function deletePricingZone(zoneId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(pricingZones).where(eq(pricingZones.id, zoneId));
  return { success: true };
}

/**
 * Get pricing history for a zone
 */
export async function getPricingHistory(zoneId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pricingHistory)
    .where(eq(pricingHistory.zoneId, zoneId))
    .orderBy(desc(pricingHistory.createdAt))
    .limit(limit);
}

/**
 * Seed default pricing zone for Mosul if none exists
 */
export async function seedDefaultPricingZone() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(pricingZones).limit(1);
  if (existing.length > 0) return; // already seeded

  await db.insert(pricingZones).values({
    cityName: "Mosul",
    cityNameAr: "الموصل",
    isActive: true,
    isDefault: true,
    pricingMethod: "per_km",
    vehicleType: "all",
    baseFare: "2000",
    pricePerKm: "1000",
    pricePerMinute: "100",
    minimumFare: "3000",
    maximumFare: "0",
    surgeMultiplier: "1.00",
    bookingFee: "0",
    freeWaitMinutes: 3,
    waitPricePerMinute: "0",
    cancellationFee: "0",
    notes: "المنطقة الافتراضية - الموصل",
    updatedBy: "system",
  });
}

// ─── Intercity Trips ──────────────────────────────────────────────────────────

/**
 * Create a new intercity trip (scheduled by driver)
 */
export async function createIntercityTrip(data: {
  driverId: number;
  fromCity: string;
  toCity: string;
  departureTime: Date;
  totalSeats: number;
  pricePerSeat: number;
  meetingPoint?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(intercityTrips).values({
    driverId: data.driverId,
    fromCity: data.fromCity,
    toCity: data.toCity,
    departureTime: data.departureTime,
    totalSeats: data.totalSeats,
    availableSeats: data.totalSeats,
    pricePerSeat: data.pricePerSeat.toString(),
    meetingPoint: data.meetingPoint ?? null,
    notes: data.notes ?? null,
    status: "scheduled",
  });
  const created = await db
    .select()
    .from(intercityTrips)
    .where(eq(intercityTrips.driverId, data.driverId))
    .orderBy(desc(intercityTrips.createdAt))
    .limit(1);
  return created[0] ?? null;
}

/**
 * Get all upcoming intercity trips (for passengers to browse)
 */
export async function getUpcomingIntercityTrips(fromCity?: string, toCity?: string) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const conditions = [
    eq(intercityTrips.status, "scheduled"),
    gt(intercityTrips.departureTime, now),
    gt(intercityTrips.availableSeats, 0),
  ] as any[];
  if (fromCity) conditions.push(eq(intercityTrips.fromCity, fromCity));
  if (toCity) conditions.push(eq(intercityTrips.toCity, toCity));
  return db
    .select()
    .from(intercityTrips)
    .where(and(...conditions))
    .orderBy(intercityTrips.departureTime);
}

/**
 * Get trips scheduled by a specific driver
 */
export async function getDriverIntercityTrips(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(intercityTrips)
    .where(eq(intercityTrips.driverId, driverId))
    .orderBy(desc(intercityTrips.createdAt));
}

/**
 * Get driver's today intercity earnings (completed trips today)
 */
export async function getDriverIntercityTodayEarnings(driverId: number) {
  const db = await getDb();
  if (!db) return { todayEarnings: 0, todayTrips: 0 };
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  // جلب الرحلات المكتملة اليوم
  const trips = await db
    .select()
    .from(intercityTrips)
    .where(and(
      eq(intercityTrips.driverId, driverId),
      eq(intercityTrips.status, "completed")
    ));
  const todayTrips = trips.filter((t) => {
    const d = new Date(t.createdAt as any);
    return d >= startOfDay && d <= endOfDay;
  });
  // حساب الدخل: عدد المقاعد المحجوزة × سعر المقعد لكل رحلة
  let todayEarnings = 0;
  for (const trip of todayTrips) {
    const bookings = await db
      .select({ seatsBooked: intercityBookings.seatsBooked })
      .from(intercityBookings)
      .where(and(eq(intercityBookings.tripId, trip.id), ne(intercityBookings.status, "cancelled")));
    const seats = bookings.reduce((sum, b) => sum + b.seatsBooked, 0);
    todayEarnings += seats * parseFloat(trip.pricePerSeat as any);
  }
  return { todayEarnings, todayTrips: todayTrips.length };
}

/**
 * Cancel an intercity trip (by driver)
 */
export async function cancelIntercityTrip(tripId: number, driverId: number, cancelReason?: string) {
  const db = await getDb();
  if (!db) return null;
  // فحص الرحلة والتحقق من الصلاحية
  const [trip] = await db
    .select()
    .from(intercityTrips)
    .where(and(eq(intercityTrips.id, tripId), eq(intercityTrips.driverId, driverId)))
    .limit(1);
  if (!trip) throw new Error("الرحلة غير موجودة أو غير مصرح");
  if (trip.status === "in_progress") throw new Error("لا يمكن إلغاء رحلة جارية");
  if (trip.status === "completed") throw new Error("لا يمكن إلغاء رحلة مكتملة");
  // تحديث حالة الرحلة مع سبب الإلغاء
  await db
    .update(intercityTrips)
    .set({ status: "cancelled", cancelReason: cancelReason || null, cancelledBy: "driver" } as any)
    .where(eq(intercityTrips.id, tripId));
  // إلغاء جميع الحجوزات وإعادة المقاعد
  const bookings = await db
    .select()
    .from(intercityBookings)
    .where(and(eq(intercityBookings.tripId, tripId), eq(intercityBookings.status, "confirmed")));
  if (bookings.length > 0) {
    await db
      .update(intercityBookings)
      .set({ status: "cancelled" })
      .where(and(eq(intercityBookings.tripId, tripId), eq(intercityBookings.status, "confirmed")));
  }
  return { trip, bookings, cancelReason };
}

/**
 * Book a seat on an intercity trip
 */
export async function bookIntercityTrip(data: {
  tripId: number;
  passengerId: number;
  seatsBooked: number;
  passengerPhone: string;
  passengerName: string;
}) {
  const db = await getDb();
  if (!db) return null;

  // Get trip and check availability
  const tripResult = await db
    .select()
    .from(intercityTrips)
    .where(eq(intercityTrips.id, data.tripId))
    .limit(1);
  const trip = tripResult[0];
  if (!trip) throw new Error("الرحلة غير موجودة");
  if (trip.status !== "scheduled") throw new Error("الرحلة غير متاحة للحجز");
  if (trip.availableSeats < data.seatsBooked) throw new Error("لا توجد مقاعد كافية");

  // Check if passenger already booked this trip
  const existingBooking = await db
    .select()
    .from(intercityBookings)
    .where(
      and(
        eq(intercityBookings.tripId, data.tripId),
        eq(intercityBookings.passengerId, data.passengerId),
        eq(intercityBookings.status, "confirmed")
      )
    )
    .limit(1);
  if (existingBooking.length > 0) throw new Error("لقد حجزت هذه الرحلة مسبقاً");

  const totalPrice = parseFloat(trip.pricePerSeat) * data.seatsBooked;

  // Insert booking
  await db.insert(intercityBookings).values({
    tripId: data.tripId,
    passengerId: data.passengerId,
    seatsBooked: data.seatsBooked,
    totalPrice: totalPrice.toString(),
    status: "confirmed",
    passengerPhone: data.passengerPhone,
    passengerName: data.passengerName,
  });

  // Decrement available seats
  await db
    .update(intercityTrips)
    .set({ availableSeats: trip.availableSeats - data.seatsBooked })
    .where(eq(intercityTrips.id, data.tripId));

  const booking = await db
    .select()
    .from(intercityBookings)
    .where(
      and(
        eq(intercityBookings.tripId, data.tripId),
        eq(intercityBookings.passengerId, data.passengerId)
      )
    )
    .orderBy(desc(intercityBookings.createdAt))
    .limit(1);
  return booking[0] ?? null;
}

/**
 * Get bookings for a specific passenger
 */
export async function getPassengerIntercityBookings(passengerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(intercityBookings)
    .where(eq(intercityBookings.passengerId, passengerId))
    .orderBy(desc(intercityBookings.createdAt));
}

/**
 * Cancel a booking (by passenger)
 */
export async function cancelIntercityBooking(bookingId: number, passengerId: number) {
  const db = await getDb();
  if (!db) return;

  const bookingResult = await db
    .select()
    .from(intercityBookings)
    .where(and(eq(intercityBookings.id, bookingId), eq(intercityBookings.passengerId, passengerId)))
    .limit(1);
  const booking = bookingResult[0];
  if (!booking) throw new Error("الحجز غير موجود");
  if (booking.status === "cancelled") throw new Error("الحجز ملغى مسبقاً");
  // منع الإلغاء بعد الالتقاط
  if (booking.pickupStatus === "picked_up" || booking.pickupStatus === "arrived") {
    throw new Error("لا يمكن إلغاء الحجز بعد التقاط المسافر");
  }

  await db
    .update(intercityBookings)
    .set({ status: "cancelled" })
    .where(eq(intercityBookings.id, bookingId));

  // Restore seats
  await db
    .update(intercityTrips)
    .set({ availableSeats: sql`availableSeats + ${booking.seatsBooked}` })
    .where(eq(intercityTrips.id, booking.tripId));

  // إرجاع بيانات الحجز لإرسال الإشعار
  return { booking };
}

/**
 * Get bookings for a specific trip (for driver to see who booked)
 */
export async function getTripBookings(tripId: number, driverId: number) {
  const db = await getDb();
  if (!db) return [];
  // Verify driver owns the trip
  const tripResult = await db
    .select()
    .from(intercityTrips)
    .where(and(eq(intercityTrips.id, tripId), eq(intercityTrips.driverId, driverId)))
    .limit(1);
  if (!tripResult[0]) return [];
  return db
    .select()
    .from(intercityBookings)
    .where(and(eq(intercityBookings.tripId, tripId), eq(intercityBookings.status, "confirmed")))
    .orderBy(intercityBookings.createdAt);
}

/**
 * Update intercity trip status (driver: start / complete)
 */
export async function updateIntercityTripStatus(
  tripId: number,
  driverId: number,
  status: "in_progress" | "completed"
) {
  const db = await getDb();
  if (!db) return;
  const tripResult = await db
    .select()
    .from(intercityTrips)
    .where(and(eq(intercityTrips.id, tripId), eq(intercityTrips.driverId, driverId)))
    .limit(1);
  if (!tripResult[0]) throw new Error("الرحلة غير موجودة أو لا تملك صلاحية");
  await db
    .update(intercityTrips)
    .set({ status })
    .where(eq(intercityTrips.id, tripId));
  return { success: true };
}

/**
 * Rate an intercity trip (passenger rates driver, driver rates passenger)
 */
export async function rateIntercityTrip(data: {
  bookingId: number;
  raterId: number;
  raterType: "passenger" | "driver";
  rating: number;
}) {
  const db = await getDb();
  if (!db) return;
  const bookingResult = await db
    .select()
    .from(intercityBookings)
    .where(eq(intercityBookings.id, data.bookingId))
    .limit(1);
  if (!bookingResult[0]) throw new Error("الحجز غير موجود");
  if (data.raterType === "passenger") {
    await db
      .update(intercityBookings)
      .set({ driverRating: data.rating })
      .where(eq(intercityBookings.id, data.bookingId));
  } else {
    await db
      .update(intercityBookings)
      .set({ passengerRating: data.rating })
      .where(eq(intercityBookings.id, data.bookingId));
  }
  return { success: true };
}

/**
 * Book a seat with pickup address
 */
export async function bookIntercityTripWithPickup(data: {
  tripId: number;
  passengerId: number;
  seatsBooked: number;
  passengerPhone: string;
  passengerName: string;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  const tripResult = await db
    .select()
    .from(intercityTrips)
    .where(eq(intercityTrips.id, data.tripId))
    .limit(1);
  const trip = tripResult[0];
  if (!trip) throw new Error("الرحلة غير موجودة");
  if (trip.status !== "scheduled") throw new Error("الرحلة غير متاحة للحجز");
  if (trip.availableSeats < data.seatsBooked) throw new Error("لا توجد مقاعد كافية");
  const existingBooking = await db
    .select()
    .from(intercityBookings)
    .where(
      and(
        eq(intercityBookings.tripId, data.tripId),
        eq(intercityBookings.passengerId, data.passengerId),
        eq(intercityBookings.status, "confirmed")
      )
    )
    .limit(1);
  if (existingBooking.length > 0) throw new Error("لقد حجزت هذه الرحلة مسبقاً");
  const totalPrice = parseFloat(trip.pricePerSeat) * data.seatsBooked;
  await db.insert(intercityBookings).values({
    tripId: data.tripId,
    passengerId: data.passengerId,
    seatsBooked: data.seatsBooked,
    totalPrice: totalPrice.toString(),
    status: "confirmed",
    passengerPhone: data.passengerPhone,
    passengerName: data.passengerName,
    pickupAddress: data.pickupAddress ?? null,
    pickupLat: data.pickupLat ? data.pickupLat.toString() : null,
    pickupLng: data.pickupLng ? data.pickupLng.toString() : null,
  });
  await db
    .update(intercityTrips)
    .set({ availableSeats: trip.availableSeats - data.seatsBooked })
    .where(eq(intercityTrips.id, data.tripId));
  const booking = await db
    .select()
    .from(intercityBookings)
    .where(
      and(
        eq(intercityBookings.tripId, data.tripId),
        eq(intercityBookings.passengerId, data.passengerId)
      )
    )
    .orderBy(desc(intercityBookings.createdAt))
    .limit(1);
  return booking[0] ?? null;
}

/**
 * Get passenger bookings enriched with trip + driver info
 */
export async function getPassengerIntercityBookingsWithTrip(passengerId: number) {
  const db = await getDb();
  if (!db) return [];
  const bookings = await db
    .select()
    .from(intercityBookings)
    .where(eq(intercityBookings.passengerId, passengerId))
    .orderBy(desc(intercityBookings.createdAt));
  const enriched = await Promise.all(
    bookings.map(async (b) => {
      const tripResult = await db
        .select()
        .from(intercityTrips)
        .where(eq(intercityTrips.id, b.tripId))
        .limit(1);
      const trip = tripResult[0];
      if (!trip) return { ...b, trip: null, driver: null };
      const driverResult = await db
        .select({
          id: drivers.id,
          name: drivers.name,
          phone: drivers.phone,
          vehiclePlate: drivers.vehiclePlate,
          vehicleModel: drivers.vehicleModel,
          vehicleColor: drivers.vehicleColor,
          rating: drivers.rating,
          photoUrl: drivers.photoUrl,
        })
        .from(drivers)
        .where(eq(drivers.id, trip.driverId))
        .limit(1);
      return { ...b, trip, driver: driverResult[0] ?? null };
    })
  );
  return enriched;
}

/**
 * Book intercity trip with mandatory GPS + note
 */
export async function bookIntercityWithGPS(data: {
  tripId: number;
  passengerId: number;
  seatsBooked: number;
  passengerPhone: string;
  passengerName: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  passengerNote?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const tripResult = await db
    .select()
    .from(intercityTrips)
    .where(eq(intercityTrips.id, data.tripId))
    .limit(1);
  const trip = tripResult[0];
  if (!trip) throw new Error("الرحلة غير موجودة");
  if (trip.status !== "scheduled") throw new Error("الرحلة غير متاحة للحجز");
  if (trip.availableSeats < data.seatsBooked) throw new Error("لا توجد مقاعد كافية");
  const existingBooking = await db
    .select()
    .from(intercityBookings)
    .where(
      and(
        eq(intercityBookings.tripId, data.tripId),
        eq(intercityBookings.passengerId, data.passengerId),
        eq(intercityBookings.status, "confirmed")
      )
    )
    .limit(1);
  if (existingBooking.length > 0) throw new Error("لقد حجزت هذه الرحلة مسبقاً");
  const totalPrice = parseFloat(trip.pricePerSeat) * data.seatsBooked;
  await db.insert(intercityBookings).values({
    tripId: data.tripId,
    passengerId: data.passengerId,
    seatsBooked: data.seatsBooked,
    totalPrice: totalPrice.toString(),
    status: "confirmed",
    passengerPhone: data.passengerPhone,
    passengerName: data.passengerName,
    pickupAddress: data.pickupAddress,
    pickupLat: data.pickupLat.toString(),
    pickupLng: data.pickupLng.toString(),
    passengerNote: data.passengerNote ?? null,
    pickupStatus: "waiting",
  });
  await db
    .update(intercityTrips)
    .set({ availableSeats: trip.availableSeats - data.seatsBooked })
    .where(eq(intercityTrips.id, data.tripId));
  const booking = await db
    .select()
    .from(intercityBookings)
    .where(
      and(
        eq(intercityBookings.tripId, data.tripId),
        eq(intercityBookings.passengerId, data.passengerId)
      )
    )
    .orderBy(desc(intercityBookings.createdAt))
    .limit(1);
  return booking[0] ?? null;
}

/**
 * Update pickup status of a passenger booking (by driver)
 */
export async function updatePassengerPickupStatus(
  bookingId: number,
  driverId: number,
  pickupStatus: "waiting" | "picked_up" | "arrived"
) {
  const db = await getDb();
  if (!db) return null;
  const booking = await db
    .select({ id: intercityBookings.id, tripId: intercityBookings.tripId })
    .from(intercityBookings)
    .where(eq(intercityBookings.id, bookingId))
    .limit(1);
  if (!booking[0]) throw new Error("الحجز غير موجود");
  const trip = await db
    .select({ driverId: intercityTrips.driverId })
    .from(intercityTrips)
    .where(eq(intercityTrips.id, booking[0].tripId))
    .limit(1);
  if (!trip[0] || trip[0].driverId !== driverId) throw new Error("غير مصرح");
  await db
    .update(intercityBookings)
    .set({ pickupStatus })
    .where(eq(intercityBookings.id, bookingId));
  return { success: true };
}

/**
 * Get all passengers for a driver's trip with full details
 */
export async function getDriverTripPassengers(tripId: number, driverId: number) {
  const db = await getDb();
  if (!db) return [];
  const trip = await db
    .select()
    .from(intercityTrips)
    .where(and(eq(intercityTrips.id, tripId), eq(intercityTrips.driverId, driverId)))
    .limit(1);
  if (!trip[0]) throw new Error("الرحلة غير موجودة أو غير مصرح");
  const bookings = await db
    .select()
    .from(intercityBookings)
    .where(
      and(
        eq(intercityBookings.tripId, tripId),
        eq(intercityBookings.status, "confirmed")
      )
    )
    .orderBy(intercityBookings.createdAt);
  return bookings;
}

/**
 * Cancel a specific passenger booking by driver
 */
export async function cancelPassengerByDriver(bookingId: number, driverId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  const booking = await db
    .select()
    .from(intercityBookings)
    .where(eq(intercityBookings.id, bookingId))
    .limit(1);
  if (!booking[0]) throw new Error("الحجز غير موجود");
  // منع الإلغاء بعد الالتقاط
  if (booking[0].pickupStatus === "picked_up" || booking[0].pickupStatus === "arrived") {
    throw new Error("لا يمكن إلغاء حجز مسافر تم التقاطه بالفعل");
  }
  const trip = await db
    .select()
    .from(intercityTrips)
    .where(eq(intercityTrips.id, booking[0].tripId))
    .limit(1);
  if (!trip[0] || trip[0].driverId !== driverId) throw new Error("غير مصرح");
  // حفظ سبب الإلغاء في حقل cancelledBy
  const updateData: Record<string, unknown> = { status: "cancelled" };
  if (reason) updateData.cancelledBy = `driver:${reason}`;
  await db
    .update(intercityBookings)
    .set(updateData as any)
    .where(eq(intercityBookings.id, bookingId));
  await db
    .update(intercityTrips)
    .set({ availableSeats: trip[0].availableSeats + booking[0].seatsBooked })
    .where(eq(intercityTrips.id, booking[0].tripId));
  return { booking: booking[0], reason, trip: trip[0] };
}

/**
 * Admin: Get all intercity trips with driver info and booking counts
 */
export async function getAllIntercityTripsAdmin(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  const trips = await db
    .select()
    .from(intercityTrips)
    .orderBy(desc(intercityTrips.createdAt))
    .limit(limit)
    .offset(offset);

  const enriched = await Promise.all(
    trips.map(async (trip) => {
      const [driver] = await db
        .select({ name: drivers.name, phone: drivers.phone, vehicleModel: drivers.vehicleModel, vehiclePlate: drivers.vehiclePlate })
        .from(drivers)
        .where(eq(drivers.id, trip.driverId))
        .limit(1);
      const bookings = await db
        .select({ seatsBooked: intercityBookings.seatsBooked })
        .from(intercityBookings)
        .where(and(eq(intercityBookings.tripId, trip.id), ne(intercityBookings.status, "cancelled")));
      return {
        ...trip,
        driver: driver ?? null,
        bookingsCount: bookings.length,
        totalPassengers: bookings.reduce((sum, b) => sum + b.seatsBooked, 0),
      };
    })
  );
  return enriched;
}

/**
 * Admin: Get passengers for a specific intercity trip
 */
export async function getAdminTripPassengers(tripId: number) {
  const db = await getDb();
  if (!db) return [];
  const bookings = await db
    .select()
    .from(intercityBookings)
    .where(
      and(
        eq(intercityBookings.tripId, tripId),
        ne(intercityBookings.status, "cancelled")
      )
    )
    .orderBy(intercityBookings.createdAt);
  return bookings;
}

/**
 * Admin: Cancel an intercity trip
 */
export async function adminCancelIntercityTrip(tripId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(intercityTrips)
    .set({ status: "cancelled" })
    .where(eq(intercityTrips.id, tripId));
}

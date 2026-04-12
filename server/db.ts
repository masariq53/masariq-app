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
  intercityDriverLocations,
  intercityMessages,
  IntercityMessage,
  supportTickets,
  supportMessages,
  SupportTicket,
  SupportMessage,
  InsertSupportTicket,
  InsertSupportMessage,
  agents,
  agentTransactions,
  Agent,
  InsertAgent,
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
  // Save push token to database for persistence across server restarts
  await db.update(passengers).set({ pushToken: token, lastActiveAt: new Date() }).where(eq(passengers.id, passengerId));
}

/**
 * Get push notification token for a passenger
 */
export async function getPassengerPushToken(passengerId: number): Promise<string | null> {
  // Check memory cache first
  if (passengerPushTokens.has(passengerId)) {
    return passengerPushTokens.get(passengerId) ?? null;
  }
  // Fallback to database
  const db = await getDb();
  if (!db) return null;
  const [passenger] = await db.select({ pushToken: passengers.pushToken }).from(passengers).where(eq(passengers.id, passengerId)).limit(1);
  if (passenger?.pushToken) {
    passengerPushTokens.set(passengerId, passenger.pushToken);
    return passenger.pushToken;
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

  // منع تكرار الرحلة بنفس الوجهة والوقت (فارق أقل من 30 دقيقة)
  const windowMs = 30 * 60 * 1000; // 30 دقيقة
  const windowStart = new Date(data.departureTime.getTime() - windowMs);
  const windowEnd = new Date(data.departureTime.getTime() + windowMs);
  const { gte, lte } = await import("drizzle-orm");
  const existing = await db
    .select({ id: intercityTrips.id })
    .from(intercityTrips)
    .where(
      and(
        eq(intercityTrips.driverId, data.driverId),
        eq(intercityTrips.fromCity, data.fromCity),
        eq(intercityTrips.toCity, data.toCity),
        gte(intercityTrips.departureTime, windowStart),
        lte(intercityTrips.departureTime, windowEnd),
        ne(intercityTrips.status, "cancelled"),
      )
    )
    .limit(1);
  if (existing.length > 0) {
    throw new Error("لديك رحلة بنفس الوجهة والوقت تقريباً. لا يمكن جدولة رحلتين بنفس المسار خلال 30 دقيقة.");
  }

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
  // منع الإلغاء بعد الالتقاط أو عندما يتوجه السائق أو وصل
  if (booking.pickupStatus === "picked_up" || booking.pickupStatus === "arrived") {
    throw new Error("لا يمكن إلغاء الحجز بعد التقاط المسافر");
  }
  // منع الإلغاء عندما يتوجه السائق أو وصل إلى موقع الراكب
  const approachStatus = (booking as any).driverApproachStatus as string | null;
  if (approachStatus === "heading" || approachStatus === "arrived_at_pickup") {
    throw new Error("لا يمكن إلغاء الحجز بعد توجه السائق إليك");
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
  // جلب جميع الحجوزات (confirmed + cancelled) مع driverApproachStatus
  const bookings = await db
    .select()
    .from(intercityBookings)
    .where(eq(intercityBookings.tripId, tripId))
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

/**
 * Update driver approach status toward a specific passenger
 * heading = الكابتن في طريقه للراكب
 * arrived_at_pickup = الكابتن وصل لموقع الراكب
 */
export async function updateDriverApproachStatus(bookingId: number, driverId: number, status: "idle" | "heading" | "arrived_at_pickup", etaMinutes?: number) {
  const db = await getDb();
  if (!db) return null;
  // التحقق من أن الكابتن يملك هذا الحجز
  const [booking] = await db
    .select()
    .from(intercityBookings)
    .where(eq(intercityBookings.id, bookingId))
    .limit(1);
  if (!booking) throw new Error("الحجز غير موجود");
  // التحقق من أن السائق يملك الرحلة
  const [trip] = await db
    .select()
    .from(intercityTrips)
    .where(and(eq(intercityTrips.id, booking.tripId), eq(intercityTrips.driverId, driverId)))
    .limit(1);
  if (!trip) throw new Error("غير مصرح");
  await db
    .update(intercityBookings)
    .set({ driverApproachStatus: status, ...(etaMinutes !== undefined ? { etaMinutes } : {}) } as any)
    .where(eq(intercityBookings.id, bookingId));
  return { booking, trip };
}

/**
 * Update driver live location for a trip (upsert)
 */
export async function updateDriverLiveLocation(
  tripId: number,
  driverId: number,
  lat: number,
  lng: number
) {
  const db = await getDb();
  if (!db) return;
  // upsert: إذا موجود يحدّث، وإلا يُنشئ
  const existing = await db
    .select()
    .from(intercityDriverLocations)
    .where(and(eq(intercityDriverLocations.tripId, tripId), eq(intercityDriverLocations.driverId, driverId)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(intercityDriverLocations)
      .set({ lat: lat.toString(), lng: lng.toString() } as any)
      .where(and(eq(intercityDriverLocations.tripId, tripId), eq(intercityDriverLocations.driverId, driverId)));
  } else {
    await db
      .insert(intercityDriverLocations)
      .values({ tripId, driverId, lat: lat.toString() as any, lng: lng.toString() as any });
  }
}

/**
 * Get driver live location for a trip (for passenger tracking)
 */
export async function getDriverLiveLocation(tripId: number) {
  const db = await getDb();
  if (!db) return null;
  const [loc] = await db
    .select()
    .from(intercityDriverLocations)
    .where(eq(intercityDriverLocations.tripId, tripId))
    .limit(1);
  return loc ?? null;
}

/**
 * Get booking approach status for a passenger (to show tracking state)
 */
export async function getPassengerBookingStatus(bookingId: number, passengerId: number) {
  const db = await getDb();
  if (!db) return null;
  const [booking] = await db
    .select()
    .from(intercityBookings)
    .where(and(eq(intercityBookings.id, bookingId), eq(intercityBookings.passengerId, passengerId)))
    .limit(1);
  return booking ?? null;
}

// ─── Intercity Chat Functions ─────────────────────────────────────────────────

/**
 * Send a chat message for an intercity booking
 */
export async function sendIntercityMessage(data: {
  bookingId: number;
  tripId: number;
  senderType: "passenger" | "driver";
  senderId: number;
  message: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(intercityMessages).values({
    bookingId: data.bookingId,
    tripId: data.tripId,
    senderType: data.senderType,
    senderId: data.senderId,
    message: data.message,
    isRead: false,
  });
  const insertId = (result as any).insertId as number;
  const [msg] = await db
    .select()
    .from(intercityMessages)
    .where(eq(intercityMessages.id, insertId))
    .limit(1);
  return msg;
}

/**
 * Get all messages for a booking, ordered by time
 */
export async function getIntercityMessages(bookingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(intercityMessages)
    .where(eq(intercityMessages.bookingId, bookingId))
    .orderBy(intercityMessages.createdAt);
}

/**
 * Mark all messages in a booking as read for a specific receiver type
 */
export async function markIntercityMessagesRead(bookingId: number, readerType: "passenger" | "driver") {
  const db = await getDb();
  if (!db) return;
  // Mark messages sent by the OTHER party as read
  const senderType = readerType === "passenger" ? "driver" : "passenger";
  await db
    .update(intercityMessages)
    .set({ isRead: true })
    .where(
      and(
        eq(intercityMessages.bookingId, bookingId),
        eq(intercityMessages.senderType, senderType),
        eq(intercityMessages.isRead, false)
      )
    );
}

/**
 * Count unread messages for a booking (messages sent by the other party)
 */
export async function countUnreadIntercityMessages(bookingId: number, readerType: "passenger" | "driver") {
  const db = await getDb();
  if (!db) return 0;
  const senderType = readerType === "passenger" ? "driver" : "passenger";
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(intercityMessages)
    .where(
      and(
        eq(intercityMessages.bookingId, bookingId),
        eq(intercityMessages.senderType, senderType),
        eq(intercityMessages.isRead, false)
      )
    );
  return row?.count ?? 0;
}

/**
 * Get all messages for a trip (admin view) - grouped by booking
 */
export async function getIntercityTripMessages(tripId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(intercityMessages)
    .where(eq(intercityMessages.tripId, tripId))
    .orderBy(intercityMessages.bookingId, intercityMessages.createdAt);
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

/**
 * Create a new support ticket
 */
export async function createSupportTicket(data: InsertSupportTicket): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(supportTickets).values(data);
  return (result[0] as any).insertId ?? null;
}

/**
 * Get all support tickets (admin view) with optional filters
 */
export async function getSupportTickets(opts?: {
  status?: "open" | "in_progress" | "resolved" | "closed" | "all";
  userType?: "passenger" | "driver" | "all";
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { tickets: [], total: 0 };
  const conditions = [];
  if (opts?.status && opts.status !== "all") {
    conditions.push(eq(supportTickets.status, opts.status));
  }
  if (opts?.userType && opts.userType !== "all") {
    conditions.push(eq(supportTickets.userType, opts.userType));
  }
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  const query = db.select().from(supportTickets);
  const filtered = conditions.length > 0 ? query.where(and(...conditions)) : query;
  const tickets = await filtered.orderBy(desc(supportTickets.createdAt)).limit(limit).offset(offset);
  const countQuery = db.select({ count: sql<number>`count(*)` }).from(supportTickets);
  const countFiltered = conditions.length > 0 ? countQuery.where(and(...conditions)) : countQuery;
  const countResult = await countFiltered;
  return { tickets, total: Number(countResult[0]?.count ?? 0) };
}

/**
 * Get tickets for a specific user (passenger or driver)
 */
export async function getUserSupportTickets(userId: number, userType: "passenger" | "driver") {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.userId, userId), eq(supportTickets.userType, userType)))
    .orderBy(desc(supportTickets.createdAt));
}

/**
 * Get a single support ticket by ID
 */
export async function getSupportTicketById(ticketId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  return result[0] ?? null;
}

/**
 * Update support ticket status
 */
export async function updateSupportTicketStatus(
  ticketId: number,
  status: "open" | "in_progress" | "resolved" | "closed",
  closedBy?: string
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Partial<InsertSupportTicket> = { status };
  if (status === "closed" || status === "resolved") {
    updateData.closedAt = new Date();
    updateData.closedBy = closedBy ?? "admin";
  }
  await db.update(supportTickets).set(updateData).where(eq(supportTickets.id, ticketId));
}

/**
 * Add a message to a support ticket
 */
export async function addSupportMessage(data: InsertSupportMessage): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(supportMessages).values(data);
  const insertId = (result[0] as any).insertId ?? null;
  // Update ticket: lastRepliedAt, lastRepliedBy, unread count
  const updateData: Partial<InsertSupportTicket> = {
    lastRepliedAt: new Date(),
    lastRepliedBy: data.senderType,
  };
  if (data.senderType === "user") {
    // رسالة من المستخدم → زيادة عداد الإدارة
    await db.update(supportTickets)
      .set({ ...updateData, unreadByAdmin: sql`unreadByAdmin + 1` })
      .where(eq(supportTickets.id, data.ticketId));
  } else {
    // رسالة من الإدارة → زيادة عداد المستخدم
    await db.update(supportTickets)
      .set({ ...updateData, unreadByUser: sql`unreadByUser + 1` })
      .where(eq(supportTickets.id, data.ticketId));
  }
  return insertId;
}

/**
 * Get all messages for a ticket
 */
export async function getSupportMessages(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(supportMessages.createdAt);
}

/**
 * Mark all messages in a ticket as read (by admin or user)
 */
export async function markSupportMessagesRead(ticketId: number, readerType: "admin" | "user") {
  const db = await getDb();
  if (!db) return;
  const senderType = readerType === "admin" ? "user" : "admin";
  await db.update(supportMessages)
    .set({ isRead: true })
    .where(and(eq(supportMessages.ticketId, ticketId), eq(supportMessages.senderType, senderType as any)));
  // إعادة تعيين عداد الرسائل غير المقروءة
  if (readerType === "admin") {
    await db.update(supportTickets).set({ unreadByAdmin: 0 }).where(eq(supportTickets.id, ticketId));
  } else {
    await db.update(supportTickets).set({ unreadByUser: 0 }).where(eq(supportTickets.id, ticketId));
  }
}

/**
 * Get unread count for admin (total unread messages from users)
 */
export async function getAdminUnreadSupportCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ total: sql<number>`SUM(unreadByAdmin)` })
    .from(supportTickets)
    .where(ne(supportTickets.status, "closed"));
  return Number(result[0]?.total ?? 0);
}

/**
 * Rate a support ticket (user rates the support quality after resolution)
 */
export async function rateSupportTicket(
  ticketId: number,
  rating: number,
  ratingComment?: string
) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportTickets).set({
    rating,
    ratingComment: ratingComment ?? null,
    ratedAt: new Date(),
  }).where(eq(supportTickets.id, ticketId));
}

/**
 * Get support rating statistics for admin dashboard
 */
export async function getSupportRatingStats() {
  const db = await getDb();
  if (!db) return { avgRating: 0, totalRated: 0, distribution: [0, 0, 0, 0, 0] };
  const result = await db
    .select({
      avgRating: sql<number>`AVG(rating)`,
      totalRated: sql<number>`COUNT(rating)`,
    })
    .from(supportTickets)
    .where(sql`rating IS NOT NULL`);
  const dist = await db
    .select({
      rating: supportTickets.rating,
      count: sql<number>`COUNT(*)`,
    })
    .from(supportTickets)
    .where(sql`rating IS NOT NULL`)
    .groupBy(supportTickets.rating);
  const distribution = [0, 0, 0, 0, 0];
  for (const row of dist) {
    if (row.rating && row.rating >= 1 && row.rating <= 5) {
      distribution[row.rating - 1] = Number(row.count);
    }
  }
  return {
    avgRating: Number(result[0]?.avgRating ?? 0),
    totalRated: Number(result[0]?.totalRated ?? 0),
    distribution,
  };
}

// ─── Agents (وكلاء معتمدون) ───────────────────────────────────────────────────

/**
 * Apply to become an agent
 */
export async function applyForAgent(data: {
  passengerId: number;
  phone: string;
  name: string;
  facePhotoUrl?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  officePhotoUrl?: string;
  officeAddress: string;
  officeLatitude: number;
  officeLongitude: number;
}) {
  const db = await getDb();
  if (!db) return null;
  // Check if already applied
  const existing = await db.select().from(agents).where(eq(agents.passengerId, data.passengerId)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  await db.insert(agents).values({
    passengerId: data.passengerId,
    phone: data.phone,
    name: data.name,
    facePhotoUrl: data.facePhotoUrl ?? null,
    idFrontUrl: data.idFrontUrl ?? null,
    idBackUrl: data.idBackUrl ?? null,
    officePhotoUrl: data.officePhotoUrl ?? null,
    officeAddress: data.officeAddress,
    officeLatitude: data.officeLatitude,
    officeLongitude: data.officeLongitude,
    status: "pending",
  });
  const created = await db.select().from(agents).where(eq(agents.passengerId, data.passengerId)).limit(1);
  return created[0] ?? null;
}

/**
 * Get agent by passengerId
 */
export async function getAgentByPassengerId(passengerId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(agents).where(eq(agents.passengerId, passengerId)).limit(1);
  return result[0] ?? null;
}

/**
 * Get all agents (admin)
 */
export async function getAllAgents(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status && status !== "all") {
    return db.select().from(agents).where(eq(agents.status, status as any)).orderBy(desc(agents.createdAt));
  }
  return db.select().from(agents).orderBy(desc(agents.createdAt));
}

/**
 * Update agent status (admin approve/reject/suspend)
 */
export async function updateAgentStatus(
  agentId: number,
  status: "approved" | "rejected" | "suspended",
  adminNotes?: string,
  rejectionReason?: string
) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set({
    status,
    adminNotes: adminNotes ?? null,
    rejectionReason: rejectionReason ?? null,
    approvedAt: status === "approved" ? new Date() : undefined,
  }).where(eq(agents.id, agentId));
}

/**
 * Recharge agent balance (admin)
 */
export async function rechargeAgentBalance(agentId: number, amount: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(agents).set({
    balance: sql`balance + ${amount}`,
  }).where(eq(agents.id, agentId));
}

/**
 * Agent recharges a driver or passenger wallet
 */
export async function agentRechargeWallet(
  agentId: number,
  recipientType: "driver" | "passenger",
  recipientId: number,
  amount: number,
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get agent
  const agentResult = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
  const agent = agentResult[0];
  if (!agent) throw new Error("الوكيل غير موجود");
  if (agent.status !== "approved") throw new Error("حساب الوكيل غير مفعّل");

  const agentBalance = Number(agent.balance);
  if (agentBalance < amount) throw new Error("رصيد الوكيل غير كافٍ");

  // Get recipient info
  let recipientName = "";
  let recipientPhone = "";
  if (recipientType === "driver") {
    const r = await db.select({ name: drivers.name, phone: drivers.phone }).from(drivers).where(eq(drivers.id, recipientId)).limit(1);
    if (!r[0]) throw new Error("الكابتن غير موجود");
    recipientName = r[0].name;
    recipientPhone = r[0].phone;
  } else {
    const r = await db.select({ name: passengers.name, phone: passengers.phone }).from(passengers).where(eq(passengers.id, recipientId)).limit(1);
    if (!r[0]) throw new Error("المستخدم غير موجود");
    recipientName = r[0].name ?? "";
    recipientPhone = r[0].phone;
  }

  // Deduct from agent balance
  await db.update(agents).set({
    balance: sql`balance - ${amount}`,
    totalRecharges: sql`totalRecharges + 1`,
    totalRechargeAmount: sql`totalRechargeAmount + ${amount}`,
  }).where(eq(agents.id, agentId));

  // Add to recipient wallet
  if (recipientType === "driver") {
    await db.update(drivers).set({
      walletBalance: sql`walletBalance + ${amount}`,
    }).where(eq(drivers.id, recipientId));
    // Log wallet transaction
    await db.insert(walletTransactions).values({
      userId: recipientId,
      userType: "driver",
      type: "credit",
      amount: amount.toString(),
      description: `شحن رصيد من وكيل معتمد`,
      balanceBefore: "0",
      balanceAfter: amount.toString(),
    });
  } else {
    await db.update(passengers).set({
      walletBalance: sql`walletBalance + ${amount}`,
    }).where(eq(passengers.id, recipientId));
  }

  // Log agent transaction
  await db.insert(agentTransactions).values({
    agentId,
    recipientType,
    recipientId,
    recipientName,
    recipientPhone,
    amount: amount.toString(),
    agentBalanceBefore: agentBalance.toString(),
    agentBalanceAfter: (agentBalance - amount).toString(),
    notes: notes ?? null,
  });

  return { success: true };
}

/**
 * Get agent transactions
 */
export async function getAgentTransactions(agentId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentTransactions)
    .where(eq(agentTransactions.agentId, agentId))
    .orderBy(desc(agentTransactions.createdAt))
    .limit(limit);
}

/**
 * Get all agent transactions (admin)
 */
export async function getAllAgentTransactions(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentTransactions)
    .orderBy(desc(agentTransactions.createdAt))
    .limit(limit);
}

/**
 * Search driver or passenger by phone for agent recharge
 */
export async function searchRecipientByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  // Search driver
  const driverResult = await db.select({
    id: drivers.id, name: drivers.name, phone: drivers.phone, walletBalance: drivers.walletBalance, type: sql<string>`'driver'`
  }).from(drivers).where(eq(drivers.phone, phone)).limit(1);
  if (driverResult[0]) return { ...driverResult[0], type: "driver" as const };
  // Search passenger
  const passengerResult = await db.select({
    id: passengers.id, name: passengers.name, phone: passengers.phone, walletBalance: passengers.walletBalance, type: sql<string>`'passenger'`
  }).from(passengers).where(eq(passengers.phone, phone)).limit(1);
  if (passengerResult[0]) return { ...passengerResult[0], type: "passenger" as const };
  return null;
}

/**
 * Monthly financial report for agent
 * Returns stats for each of the last N months
 */
export async function getAgentMonthlyStats(agentId: number, months = 6) {
  const db = await getDb();
  if (!db) return [];

  const results: Array<{
    year: number;
    month: number;
    totalAmount: number;
    operationsCount: number;
    driversCount: number;
    passengersCount: number;
  }> = [];

  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);

    const rows = await db
      .select({
        totalAmount: sql<number>`COALESCE(SUM(${agentTransactions.amount}), 0)`,
        operationsCount: sql<number>`COUNT(*)`,
        driversCount: sql<number>`SUM(CASE WHEN ${agentTransactions.recipientType} = 'driver' THEN 1 ELSE 0 END)`,
        passengersCount: sql<number>`SUM(CASE WHEN ${agentTransactions.recipientType} = 'passenger' THEN 1 ELSE 0 END)`,
      })
      .from(agentTransactions)
      .where(
        and(
          eq(agentTransactions.agentId, agentId),
          sql`${agentTransactions.createdAt} >= ${startOfMonth.toISOString().slice(0, 19).replace('T', ' ')}`,
          sql`${agentTransactions.createdAt} < ${endOfMonth.toISOString().slice(0, 19).replace('T', ' ')}`
        )
      );

    results.push({
      year,
      month,
      totalAmount: Number(rows[0]?.totalAmount ?? 0),
      operationsCount: Number(rows[0]?.operationsCount ?? 0),
      driversCount: Number(rows[0]?.driversCount ?? 0),
      passengersCount: Number(rows[0]?.passengersCount ?? 0),
    });
  }

  return results;
}

/**
 * Delete an agent and all their transactions permanently
 */
export async function deleteAgent(agentId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة");
  // Delete transactions first (foreign key safety)
  await db.delete(agentTransactions).where(eq(agentTransactions.agentId, agentId));
  // Delete agent record
  await db.delete(agents).where(eq(agents.id, agentId));
  return { success: true };
}

/**
 * Get driver wallet balance
 */
export async function getDriverWalletInfo(driverId: number) {
  const db = await getDb();
  if (!db) return { balance: "0" };
  const [driver] = await db
    .select({ walletBalance: drivers.walletBalance })
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);
  if (!driver) throw new Error("السائق غير موجود");
  return { balance: driver.walletBalance?.toString() ?? "0" };
}

/**
 * Get driver wallet transactions (credits from agents + debits from commission)
 */
export async function getDriverWalletTransactions(driverId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.userId, driverId),
        eq(walletTransactions.userType, "driver")
      )
    )
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
  return rows;
}

/**
 * Deduct 10% commission from driver wallet upon ride completion
 */
export async function deductDriverCommission(driverId: number, rideId: number, rideFare: number) {
  const db = await getDb();
  if (!db) return;
  const commission = Math.round(rideFare * 0.1 * 100) / 100; // 10%
  const [driver] = await db
    .select({ walletBalance: drivers.walletBalance })
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);
  if (!driver) return;
  const balanceBefore = parseFloat(driver.walletBalance?.toString() ?? "0");
  const balanceAfter = Math.max(0, balanceBefore - commission);
  await db.update(drivers)
    .set({ walletBalance: sql`GREATEST(0, walletBalance - ${commission})` })
    .where(eq(drivers.id, driverId));
  await db.insert(walletTransactions).values({
    userId: driverId,
    userType: "driver",
    type: "debit",
    amount: commission.toString(),
    description: `عمولة الشركة 10% - رحلة #${rideId}`,
    rideId,
    balanceBefore: balanceBefore.toString(),
    balanceAfter: balanceAfter.toString(),
  });
  return { commission, balanceBefore, balanceAfter };
}

// ─── Parcel Delivery Functions ────────────────────────────────────────────────
import { parcels, parcelAgents, parcelStatusLogs } from "../drizzle/schema";

function generateTrackingNumber(): string {
  const prefix = "MSR";
  const timestamp = Date.now().toString().slice(-7);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `${prefix}${timestamp}${random}`;
}

function generateDeliveryOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createParcel(data: {
  deliveryType: "instant" | "scheduled" | "intercity";
  senderId: number;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress: string;
  dropoffLat?: number;
  dropoffLng?: number;
  fromCity?: string;
  toCity?: string;
  parcelSize: "small" | "medium" | "large";
  parcelDescription?: string;
  parcelPhotoUrl?: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const trackingNumber = generateTrackingNumber();
  const deliveryOtp = generateDeliveryOtp();
  const [result] = await db.insert(parcels).values({
    ...data,
    trackingNumber,
    deliveryOtp,
    status: "pending",
    paymentMethod: "cash",
    pickupLat: data.pickupLat?.toString() as any,
    pickupLng: data.pickupLng?.toString() as any,
    dropoffLat: data.dropoffLat?.toString() as any,
    dropoffLng: data.dropoffLng?.toString() as any,
  });
  const newId = (result as any).insertId;
  await db.insert(parcelStatusLogs).values({ parcelId: newId, status: "pending", note: "تم إنشاء الطرد", updatedBy: "system" });
  return { id: newId, trackingNumber, deliveryOtp };
}

export async function getParcelById(parcelId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({
      id: parcels.id,
      trackingNumber: parcels.trackingNumber,
      deliveryType: parcels.deliveryType,
      senderId: parcels.senderId,
      senderName: parcels.senderName,
      senderPhone: parcels.senderPhone,
      recipientName: parcels.recipientName,
      recipientPhone: parcels.recipientPhone,
      pickupAddress: parcels.pickupAddress,
      pickupLat: parcels.pickupLat,
      pickupLng: parcels.pickupLng,
      dropoffAddress: parcels.dropoffAddress,
      dropoffLat: parcels.dropoffLat,
      dropoffLng: parcels.dropoffLng,
      fromCity: parcels.fromCity,
      toCity: parcels.toCity,
      parcelSize: parcels.parcelSize,
      parcelDescription: parcels.parcelDescription,
      parcelPhotoUrl: parcels.parcelPhotoUrl,
      estimatedWeight: parcels.estimatedWeight,
      price: parcels.price,
      paymentMethod: parcels.paymentMethod,
      scheduledDate: parcels.scheduledDate,
      scheduledTimeSlot: parcels.scheduledTimeSlot,
      driverId: parcels.driverId,
      agentId: parcels.agentId,
      status: parcels.status,
      cancelReason: parcels.cancelReason,
      deliveryOtp: parcels.deliveryOtp,
      deliveryOtpVerified: parcels.deliveryOtpVerified,
      acceptedAt: parcels.acceptedAt,
      pickedUpAt: parcels.pickedUpAt,
      deliveredAt: parcels.deliveredAt,
      createdAt: parcels.createdAt,
      updatedAt: parcels.updatedAt,
      driverName: drivers.name,
      driverPhone: drivers.phone,
    })
    .from(parcels)
    .leftJoin(drivers, eq(parcels.driverId, drivers.id))
    .where(eq(parcels.id, parcelId))
    .limit(1);
  return row ?? null;
}

export async function getParcelByTracking(trackingNumber: string) {
  const db = await getDb();
  if (!db) return null;
  const [parcel] = await db.select().from(parcels).where(eq(parcels.trackingNumber, trackingNumber)).limit(1);
  return parcel ?? null;
}

export async function getSenderParcels(senderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(parcels).where(eq(parcels.senderId, senderId)).orderBy(sql`${parcels.createdAt} DESC`);
}

export async function getPendingInstantParcels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(parcels).where(and(eq(parcels.deliveryType, "instant"), eq(parcels.status, "pending"))).orderBy(sql`${parcels.createdAt} ASC`);
}

export async function getDriverActiveParcels(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(parcels).where(and(eq(parcels.driverId, driverId), sql`${parcels.status} IN ('accepted', 'picked_up', 'in_transit')`)).orderBy(sql`${parcels.createdAt} DESC`);
}
export async function getDriverAllParcels(driverId: number, page = 0, limit = 20) {
  const db = await getDb();
  if (!db) return { parcels: [], total: 0, stats: { total: 0, delivered: 0, active: 0, cancelled: 0, totalEarnings: 0 } };
  const offset = page * limit;
  const allParcels = await db.select().from(parcels).where(eq(parcels.driverId, driverId)).orderBy(sql`${parcels.createdAt} DESC`);
  const total = allParcels.length;
  const delivered = allParcels.filter(p => p.status === 'delivered').length;
  const active = allParcels.filter(p => ['accepted', 'picked_up', 'in_transit'].includes(p.status)).length;
  const cancelled = allParcels.filter(p => p.status === 'cancelled').length;
  const totalEarnings = allParcels.filter(p => p.status === 'delivered').reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  const paged = allParcels.slice(offset, offset + limit);
  return { parcels: paged, total, stats: { total, delivered, active, cancelled, totalEarnings } };
}
export async function acceptParcel(parcelId: number, driverId: number, price: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(parcels).set({ driverId, price: price.toString(), status: "accepted", acceptedAt: new Date() }).where(and(eq(parcels.id, parcelId), eq(parcels.status, "pending")));
  await db.insert(parcelStatusLogs).values({ parcelId, status: "accepted", note: "تم قبول الطرد من الكابتن", updatedBy: "driver" });
}

export async function updateParcelStatus(
  parcelId: number,
  status: "picked_up" | "in_transit" | "delivered" | "cancelled" | "returned",
  updatedBy: "driver" | "agent" | "admin",
  note?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = { status };
  if (status === "picked_up") updateData.pickedUpAt = new Date();
  if (status === "delivered") updateData.deliveredAt = new Date();
  await db.update(parcels).set(updateData).where(eq(parcels.id, parcelId));
  await db.insert(parcelStatusLogs).values({ parcelId, status, note: note ?? "", updatedBy });
}

export async function verifyParcelDeliveryOtp(parcelId: number, otp: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [parcel] = await db.select().from(parcels).where(and(eq(parcels.id, parcelId), eq(parcels.deliveryOtp, otp))).limit(1);
  if (!parcel) return { success: false, message: "رمز التسليم غير صحيح" };
  if (parcel.deliveryOtpVerified) return { success: false, message: "تم استخدام هذا الرمز مسبقاً" };
  await db.update(parcels).set({ deliveryOtpVerified: true, status: "delivered", deliveredAt: new Date() }).where(eq(parcels.id, parcelId));
  await db.insert(parcelStatusLogs).values({ parcelId, status: "delivered", note: "تم التسليم بتأكيد OTP", updatedBy: "driver" });
  return { success: true };
}

export async function getParcelStatusLogs(parcelId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(parcelStatusLogs).where(eq(parcelStatusLogs.parcelId, parcelId)).orderBy(sql`${parcelStatusLogs.createdAt} ASC`);
}

export async function getAdminParcels(filters: {
  deliveryType?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return { parcels: [], total: 0, page: 1, limit: 50 };
  const { deliveryType, status, fromDate, toDate, search, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;
  const conditions: any[] = [];
  if (deliveryType) conditions.push(eq(parcels.deliveryType, deliveryType as any));
  if (status) conditions.push(eq(parcels.status, status as any));
  if (fromDate) conditions.push(sql`DATE(${parcels.createdAt}) >= ${fromDate}`);
  if (toDate) conditions.push(sql`DATE(${parcels.createdAt}) <= ${toDate}`);
  if (search) conditions.push(sql`(${parcels.trackingNumber} LIKE ${`%${search}%`} OR ${parcels.senderName} LIKE ${`%${search}%`} OR ${parcels.recipientName} LIKE ${`%${search}%`} OR ${parcels.senderPhone} LIKE ${`%${search}%`} OR ${parcels.recipientPhone} LIKE ${`%${search}%`})`);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [rows, countResult] = await Promise.all([
    db.select().from(parcels).where(whereClause).orderBy(sql`${parcels.createdAt} DESC`).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(parcels).where(whereClause),
  ]);
  return { parcels: rows, total: countResult[0]?.count ?? 0, page, limit };
}

export async function getParcelStats() {
  const db = await getDb();
  if (!db) return null;
  const [stats] = await db.select({
    total: sql<number>`COUNT(*)`,
    pending: sql<number>`SUM(CASE WHEN ${parcels.status} = 'pending' THEN 1 ELSE 0 END)`,
    accepted: sql<number>`SUM(CASE WHEN ${parcels.status} = 'accepted' THEN 1 ELSE 0 END)`,
    inTransit: sql<number>`SUM(CASE WHEN ${parcels.status} IN ('picked_up','in_transit') THEN 1 ELSE 0 END)`,
    delivered: sql<number>`SUM(CASE WHEN ${parcels.status} = 'delivered' THEN 1 ELSE 0 END)`,
    cancelled: sql<number>`SUM(CASE WHEN ${parcels.status} = 'cancelled' THEN 1 ELSE 0 END)`,
    instant: sql<number>`SUM(CASE WHEN ${parcels.deliveryType} = 'instant' THEN 1 ELSE 0 END)`,
    scheduled: sql<number>`SUM(CASE WHEN ${parcels.deliveryType} = 'scheduled' THEN 1 ELSE 0 END)`,
    intercity: sql<number>`SUM(CASE WHEN ${parcels.deliveryType} = 'intercity' THEN 1 ELSE 0 END)`,
    todayTotal: sql<number>`SUM(CASE WHEN DATE(${parcels.createdAt}) = CURDATE() THEN 1 ELSE 0 END)`,
  }).from(parcels);
  return stats;
}

export async function getAllParcelAgents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(parcelAgents).orderBy(sql`${parcelAgents.city} ASC`);
}

export async function getActiveParcelAgents(fromCity: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(parcelAgents).where(and(eq(parcelAgents.city, fromCity), eq(parcelAgents.isActive, true)));
}

export async function createParcelAgent(data: {
  name: string;
  phone: string;
  companyName?: string;
  city: string;
  username: string;
  passwordHash: string;
  coveredCities?: string;
  pickupTime?: string;
  pickupDays?: string;
  pricingJson?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(parcelAgents).values(data);
  return (result as any).insertId;
}

export async function updateParcelAgentStatus(agentId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(parcelAgents).set({ isActive }).where(eq(parcelAgents.id, agentId));
}

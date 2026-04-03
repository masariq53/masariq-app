import { and, eq, gt, desc } from "drizzle-orm";
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
    return { id: 1, phone, name, isVerified: false, isOnline: false, isAvailable: false, vehicleType: "sedan" as const, vehiclePlate: null, vehicleModel: null, vehicleColor: null, currentLat: null, currentLng: null, rating: "5.00", totalRides: 0, walletBalance: "0.00", createdAt: new Date(), updatedAt: new Date(), lastActiveAt: new Date() };
  }

  const existing = await db.select().from(drivers).where(eq(drivers.phone, phone)).limit(1);
  if (existing.length > 0) return existing[0]!;

  await db.insert(drivers).values({ phone, name });
  const created = await db.select().from(drivers).where(eq(drivers.phone, phone)).limit(1);
  return created[0]!;
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
  await db.update(drivers).set({ isVerified }).where(eq(drivers.id, driverId));
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

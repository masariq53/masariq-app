import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  createOtp,
  verifyOtp,
  getOrCreatePassenger,
  getOrCreateDriver,
  getNearbyDrivers,
  createRide,
  updateRideStatus,
  getRideById,
  getPassengerRideHistory,
  getDriverRideHistory,
  updateDriverLocation,
  setDriverOnlineStatus,
  calculateFare,
  calculateDistance,
  getAdminStats,
  getAllRides,
  getAllPassengers,
  getAllDrivers,
  updateDriverVerification,
  getRecentRides,
  checkPhoneExists,
  registerNewPassenger,
  loginExistingPassenger,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── OTP Authentication ───────────────────────────────────────────────────
  otp: router({
    /**
     * Send OTP to phone number
     * In production: integrate with SMS provider (e.g., Twilio, local Iraqi SMS)
     * In dev mode: returns the code directly for testing
     */
    send: publicProcedure
      .input(
        z.object({
          phone: z.string().min(10).max(15),
        })
      )
      .mutation(async ({ input }) => {
        // Normalize phone: ensure +964 prefix
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) {
          phone = "+964" + phone.slice(1);
        } else if (!phone.startsWith("+")) {
          phone = "+964" + phone;
        }

        const code = await createOtp(phone);

        // TODO: In production, send SMS via provider
        // For now, return code in dev mode for testing
        const isDev = process.env.NODE_ENV !== "production";

        return {
          success: true,
          phone,
          // Only expose code in dev mode
          devCode: isDev ? code : undefined,
          message: isDev
            ? `رمز التحقق (وضع التطوير): ${code}`
            : "تم إرسال رمز التحقق إلى هاتفك",
        };
      }),

    /**
     * Verify OTP code and create/get passenger session
     */
    verify: publicProcedure
      .input(
        z.object({
          phone: z.string().min(10).max(15),
          code: z.string().length(6),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) {
          phone = "+964" + phone.slice(1);
        } else if (!phone.startsWith("+")) {
          phone = "+964" + phone;
        }

        const isValid = await verifyOtp(phone, input.code);
        if (!isValid) {
          throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");
        }

        const passenger = await getOrCreatePassenger(phone, input.name);

        return {
          success: true,
          passenger: {
            id: passenger.id,
            phone: passenger.phone,
            name: passenger.name,
            walletBalance: passenger.walletBalance,
            totalRides: passenger.totalRides,
            rating: passenger.rating,
          },
        };
      }),

    /**
     * Check if phone is already registered (before sending OTP)
     */
    checkPhone: publicProcedure
      .input(z.object({ phone: z.string().min(10).max(11) }))
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) phone = "+964" + phone.slice(1);
        else if (!phone.startsWith("+")) phone = "+964" + phone;
        const exists = await checkPhoneExists(phone);
        return { exists, phone };
      }),

    /**
     * Send OTP for LOGIN (phone must be registered)
     */
    sendLogin: publicProcedure
      .input(z.object({ phone: z.string().min(10).max(11) }))
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) phone = "+964" + phone.slice(1);
        else if (!phone.startsWith("+")) phone = "+964" + phone;

        const exists = await checkPhoneExists(phone);
        if (!exists) throw new Error("رقم الهاتف غير مسجل، يرجى إنشاء حساب جديد");

        const code = await createOtp(phone);
        const isDev = process.env.NODE_ENV !== "production";
        return { success: true, phone, devCode: isDev ? code : undefined, message: isDev ? `رمز التحقق: ${code}` : "تم إرسال رمز التحقق" };
      }),

    /**
     * Verify OTP for LOGIN
     */
    verifyLogin: publicProcedure
      .input(z.object({ phone: z.string().min(10).max(15), code: z.string().length(6) }))
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) phone = "+964" + phone.slice(1);
        else if (!phone.startsWith("+")) phone = "+964" + phone;

        const isValid = await verifyOtp(phone, input.code);
        if (!isValid) throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");

        const passenger = await loginExistingPassenger(phone);
        return { success: true, passenger: { id: passenger.id, phone: passenger.phone, name: passenger.name, walletBalance: passenger.walletBalance, totalRides: passenger.totalRides, rating: passenger.rating } };
      }),

    /**
     * Send OTP for REGISTRATION (phone must NOT be registered)
     */
    sendRegister: publicProcedure
      .input(z.object({ phone: z.string().min(10).max(11), name: z.string().min(2).max(30) }))
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) phone = "+964" + phone.slice(1);
        else if (!phone.startsWith("+")) phone = "+964" + phone;

        const exists = await checkPhoneExists(phone);
        if (exists) throw new Error("رقم الهاتف مسجل بالفعل، يرجى تسجيل الدخول");

        const code = await createOtp(phone);
        const isDev = process.env.NODE_ENV !== "production";
        return { success: true, phone, name: input.name, devCode: isDev ? code : undefined, message: isDev ? `رمز التحقق: ${code}` : "تم إرسال رمز التحقق" };
      }),

    /**
     * Verify OTP for REGISTRATION - creates new account
     */
    verifyRegister: publicProcedure
      .input(z.object({ phone: z.string().min(10).max(15), code: z.string().length(6), name: z.string().min(2).max(30) }))
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) phone = "+964" + phone.slice(1);
        else if (!phone.startsWith("+")) phone = "+964" + phone;

        const isValid = await verifyOtp(phone, input.code);
        if (!isValid) throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");

        const passenger = await registerNewPassenger(phone, input.name);
        return { success: true, passenger: { id: passenger.id, phone: passenger.phone, name: passenger.name, walletBalance: passenger.walletBalance, totalRides: passenger.totalRides, rating: passenger.rating } };
      }),

    /**
     * Verify OTP for driver registration
     */
    verifyDriver: publicProcedure
      .input(
        z.object({
          phone: z.string().min(10).max(15),
          code: z.string().length(6),
          name: z.string().min(2),
        })
      )
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) {
          phone = "+964" + phone.slice(1);
        } else if (!phone.startsWith("+")) {
          phone = "+964" + phone;
        }

        const isValid = await verifyOtp(phone, input.code);
        if (!isValid) {
          throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");
        }

        const driver = await getOrCreateDriver(phone, input.name);

        return {
          success: true,
          driver: {
            id: driver.id,
            phone: driver.phone,
            name: driver.name,
            isVerified: driver.isVerified,
            rating: driver.rating,
            totalRides: driver.totalRides,
          },
        };
      }),
  }),

  // ─── Rides ────────────────────────────────────────────────────────────────
  rides: router({
    /**
     * Request a new ride
     */
    request: publicProcedure
      .input(
        z.object({
          passengerId: z.number(),
          pickupLat: z.number(),
          pickupLng: z.number(),
          pickupAddress: z.string().optional(),
          dropoffLat: z.number(),
          dropoffLng: z.number(),
          dropoffAddress: z.string().optional(),
          paymentMethod: z.enum(["cash", "wallet"]).default("cash"),
        })
      )
      .mutation(async ({ input }) => {
        const distance = calculateDistance(
          input.pickupLat,
          input.pickupLng,
          input.dropoffLat,
          input.dropoffLng
        );
        const fare = calculateFare(distance);
        const duration = Math.ceil((distance / 30) * 60); // Assume 30 km/h avg speed

        const ride = await createRide({
          passengerId: input.passengerId,
          pickupLat: input.pickupLat.toString(),
          pickupLng: input.pickupLng.toString(),
          pickupAddress: input.pickupAddress,
          dropoffLat: input.dropoffLat.toString(),
          dropoffLng: input.dropoffLng.toString(),
          dropoffAddress: input.dropoffAddress,
          estimatedDistance: distance.toFixed(2),
          estimatedDuration: duration,
          fare: fare.toFixed(2),
          paymentMethod: input.paymentMethod,
          status: "searching",
        });

        return {
          success: true,
          ride: {
            id: ride.id,
            status: ride.status,
            estimatedDistance: distance.toFixed(1),
            estimatedDuration: duration,
            fare: Math.round(fare),
          },
        };
      }),

    /**
     * Get nearby available drivers
     */
    nearbyDrivers: publicProcedure
      .input(
        z.object({
          lat: z.number(),
          lng: z.number(),
          radiusKm: z.number().default(5),
        })
      )
      .query(async ({ input }) => {
        const drivers = await getNearbyDrivers(input.lat, input.lng, input.radiusKm);
        return {
          drivers: drivers.map((d) => ({
            id: d.id,
            name: d.name,
            rating: d.rating,
            vehicleType: d.vehicleType,
            vehicleModel: d.vehicleModel,
            vehicleColor: d.vehicleColor,
            vehiclePlate: d.vehiclePlate,
            lat: d.currentLat ? parseFloat(d.currentLat.toString()) : null,
            lng: d.currentLng ? parseFloat(d.currentLng.toString()) : null,
            totalRides: d.totalRides,
          })),
        };
      }),

    /**
     * Accept a ride (driver action)
     */
    accept: publicProcedure
      .input(
        z.object({
          rideId: z.number(),
          driverId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await updateRideStatus(input.rideId, "accepted", { driverId: input.driverId });
        return { success: true };
      }),

    /**
     * Update ride status
     */
    updateStatus: publicProcedure
      .input(
        z.object({
          rideId: z.number(),
          status: z.enum(["searching", "accepted", "driver_arrived", "in_progress", "completed", "cancelled"]),
          cancelReason: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const extra: Record<string, unknown> = {};
        if (input.status === "in_progress") extra.startedAt = new Date();
        if (input.status === "completed") extra.completedAt = new Date();
        if (input.cancelReason) extra.cancelReason = input.cancelReason;

        await updateRideStatus(input.rideId, input.status, extra as any);
        return { success: true };
      }),

    /**
     * Get ride details
     */
    get: publicProcedure
      .input(z.object({ rideId: z.number() }))
      .query(async ({ input }) => {
        return getRideById(input.rideId);
      }),

    /**
     * Get passenger ride history
     */
    passengerHistory: publicProcedure
      .input(z.object({ passengerId: z.number(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return getPassengerRideHistory(input.passengerId, input.limit);
      }),

    /**
     * Get driver ride history
     */
    driverHistory: publicProcedure
      .input(z.object({ driverId: z.number(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return getDriverRideHistory(input.driverId, input.limit);
      }),

    /**
     * Calculate fare estimate
     */
    estimateFare: publicProcedure
      .input(
        z.object({
          pickupLat: z.number(),
          pickupLng: z.number(),
          dropoffLat: z.number(),
          dropoffLng: z.number(),
        })
      )
      .query(async ({ input }) => {
        const distance = calculateDistance(
          input.pickupLat,
          input.pickupLng,
          input.dropoffLat,
          input.dropoffLng
        );
        const fare = calculateFare(distance);
        const duration = Math.ceil((distance / 30) * 60);

        return {
          distance: parseFloat(distance.toFixed(1)),
          fare: Math.round(fare),
          duration,
          fareBreakdown: {
            baseFare: 2000,
            distanceFare: Math.round((fare - 2000) > 0 ? fare - 2000 : 0),
            total: Math.round(fare),
          },
        };
      }),
  }),

  // ─── Driver ───────────────────────────────────────────────────────────────
  driver: router({
    /**
     * Update driver location
     */
    updateLocation: publicProcedure
      .input(
        z.object({
          driverId: z.number(),
          lat: z.number(),
          lng: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await updateDriverLocation(input.driverId, input.lat, input.lng);
        return { success: true };
      }),

    /**
     * Toggle driver online/offline status
     */
    setStatus: publicProcedure
      .input(
        z.object({
          driverId: z.number(),
          isOnline: z.boolean(),
          isAvailable: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        await setDriverOnlineStatus(input.driverId, input.isOnline, input.isAvailable);
        return { success: true };
      }),
  }),

  // ─── Admin Dashboard ─────────────────────────────────────────────────────────────────
  admin: router({
    /**
     * Get dashboard stats (public for now - can add admin auth later)
     */
    stats: publicProcedure.query(async () => {
      return getAdminStats();
    }),

    /**
     * Get all rides with pagination
     */
    rides: publicProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return getAllRides(input.limit, input.offset);
      }),

    /**
     * Get all passengers
     */
    passengers: publicProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return getAllPassengers(input.limit, input.offset);
      }),

    /**
     * Get all drivers
     */
    drivers: publicProcedure
      .input(z.object({ limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return getAllDrivers(input.limit, input.offset);
      }),

    /**
     * Verify or suspend a driver
     */
    verifyDriver: publicProcedure
      .input(z.object({ driverId: z.number(), isVerified: z.boolean() }))
      .mutation(async ({ input }) => {
        await updateDriverVerification(input.driverId, input.isVerified);
        return { success: true };
      }),

    /**
     * Get recent rides
     */
    recentRides: publicProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ input }) => {
        return getRecentRides(input.limit);
      }),

    /**
     * Cancel a ride (admin action)
     */
    cancelRide: publicProcedure
      .input(z.object({ rideId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        await updateRideStatus(input.rideId, "cancelled", { cancelReason: input.reason || "Admin cancelled" });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;


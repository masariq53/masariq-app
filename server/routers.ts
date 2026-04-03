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
  updatePassengerProfile,
  setPendingPhone,
  confirmPhoneChange,
  getPassengerById,
  registerDriver,
  getDriverByPhone,
  getPendingDrivers,
  updateDriverRegistrationStatus,
} from "./db";
import { storagePut } from "./storage";

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
            photoUrl: passenger.photoUrl ?? null,
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
        return { success: true, passenger: { id: passenger.id, phone: passenger.phone, name: passenger.name, photoUrl: passenger.photoUrl ?? null, walletBalance: passenger.walletBalance, totalRides: passenger.totalRides, rating: passenger.rating } };
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
        return { success: true, passenger: { id: passenger.id, phone: passenger.phone, name: passenger.name, photoUrl: passenger.photoUrl ?? null, walletBalance: passenger.walletBalance, totalRides: passenger.totalRides, rating: passenger.rating } };
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

    /**
     * Register a new driver with full details
     */
    register: publicProcedure
      .input(z.object({
        phone: z.string().min(10).max(15),
        name: z.string().min(2).max(100),
        nationalId: z.string().optional(),
        photoUrl: z.string().optional(),
        nationalIdPhotoUrl: z.string().optional(),
        licensePhotoUrl: z.string().optional(),
        vehicleType: z.enum(["sedan", "suv", "minivan"]),
        vehiclePlate: z.string().optional(),
        vehicleModel: z.string().optional(),
        vehicleColor: z.string().optional(),
        vehicleYear: z.string().optional(),
        vehiclePhotoUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const driver = await registerDriver(input);
        return {
          success: true,
          driverId: driver.id,
          registrationStatus: driver.registrationStatus,
          message: "تم استلام طلب التسجيل بنجاح، سيتم مراجعته خلال 24-48 ساعة",
        };
      }),

    /**
     * Upload driver document photo (base64)
     */
    uploadDocument: publicProcedure
      .input(z.object({
        phone: z.string(),
        documentType: z.enum(["photo", "nationalId", "license", "vehicle"]),
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const key = `drivers/${input.phone.replace(/\+/g, "")}/${input.documentType}_${Date.now()}.jpg`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { success: true, url };
      }),

    /**
     * Check driver registration status by phone
     */
    checkStatus: publicProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        const driver = await getDriverByPhone(input.phone);
        if (!driver) return { found: false, registrationStatus: null };
        return {
          found: true,
          driverId: driver.id,
          registrationStatus: driver.registrationStatus,
          rejectionReason: driver.rejectionReason,
          name: driver.name,
        };
      }),
  }),

  // ─── Passenger Profile ──────────────────────────────────────────────────────
  passenger: router({
    /**
     * Get passenger profile by ID
     */
    get: publicProcedure
      .input(z.object({ passengerId: z.number() }))
      .query(async ({ input }) => {
        const p = await getPassengerById(input.passengerId);
        if (!p) throw new Error("المستخدم غير موجود");
        return { id: p.id, phone: p.phone, name: p.name, photoUrl: p.photoUrl, walletBalance: p.walletBalance, totalRides: p.totalRides, rating: p.rating };
      }),

    /**
     * Update passenger name
     */
    updateName: publicProcedure
      .input(z.object({ passengerId: z.number(), name: z.string().min(2).max(30).trim() }))
      .mutation(async ({ input }) => {
        const updated = await updatePassengerProfile(input.passengerId, { name: input.name });
        return { success: true, name: updated?.name };
      }),

    /**
     * Upload profile photo - accepts base64 image
     */
    uploadPhoto: publicProcedure
      .input(z.object({
        passengerId: z.number(),
        base64: z.string(), // base64 encoded image
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        // Convert base64 to Buffer and upload to storage
        const buffer = Buffer.from(input.base64, "base64");
        const key = `profiles/passenger_${input.passengerId}_${Date.now()}.jpg`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        // Save URL to DB
        await updatePassengerProfile(input.passengerId, { photoUrl: url });
        return { success: true, photoUrl: url };
      }),

    /**
     * Step 1: Request phone change - send OTP to OLD phone to verify identity
     */
    requestPhoneChange: publicProcedure
      .input(z.object({ passengerId: z.number(), newPhone: z.string().min(10).max(11) }))
      .mutation(async ({ input }) => {
        let newPhone = input.newPhone.replace(/\s/g, "");
        if (newPhone.startsWith("0")) newPhone = "+964" + newPhone.slice(1);
        else if (!newPhone.startsWith("+")) newPhone = "+964" + newPhone;

        // Get current passenger to get old phone
        const passenger = await getPassengerById(input.passengerId);
        if (!passenger) throw new Error("المستخدم غير موجود");

        // Save pending phone & check it's not taken
        await setPendingPhone(input.passengerId, newPhone);

        // Send OTP to OLD phone for identity verification
        const code = await (await import("./db")).createOtp(passenger.phone);
        const isDev = process.env.NODE_ENV !== "production";
        return {
          success: true,
          oldPhone: passenger.phone,
          newPhone,
          devCode: isDev ? code : undefined,
          message: isDev ? `رمز التحقق على رقمك القديم: ${code}` : "تم إرسال رمز التحقق إلى رقمك القديم",
        };
      }),

    /**
     * Step 2: Verify OTP on OLD phone, then send OTP to NEW phone
     */
    verifyOldPhoneOtp: publicProcedure
      .input(z.object({ passengerId: z.number(), code: z.string().length(6) }))
      .mutation(async ({ input }) => {
        const passenger = await getPassengerById(input.passengerId);
        if (!passenger) throw new Error("المستخدم غير موجود");
        if (!passenger.pendingPhone) throw new Error("لا يوجد طلب تغيير رقم نشط");

        // Verify OTP on OLD phone
        const isValid = await verifyOtp(passenger.phone, input.code);
        if (!isValid) throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");

        // Now send OTP to NEW phone
        const code = await (await import("./db")).createOtp(passenger.pendingPhone);
        const isDev = process.env.NODE_ENV !== "production";
        return {
          success: true,
          newPhone: passenger.pendingPhone,
          devCode: isDev ? code : undefined,
          message: isDev ? `رمز التحقق على رقمك الجديد: ${code}` : "تم إرسال رمز التحقق إلى رقمك الجديد",
        };
      }),

    /**
     * Step 3: Verify OTP on NEW phone and confirm the change
     */
    verifyNewPhoneOtp: publicProcedure
      .input(z.object({ passengerId: z.number(), code: z.string().length(6) }))
      .mutation(async ({ input }) => {
        const passenger = await getPassengerById(input.passengerId);
        if (!passenger) throw new Error("المستخدم غير موجود");
        if (!passenger.pendingPhone) throw new Error("لا يوجد طلب تغيير رقم نشط");

        // Verify OTP on NEW phone
        const isValid = await verifyOtp(passenger.pendingPhone, input.code);
        if (!isValid) throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");

        // Confirm the phone change
        const newPhone = await confirmPhoneChange(input.passengerId);
        return { success: true, newPhone };
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

    /**
     * Get pending driver registrations
     */
    pendingDrivers: publicProcedure.query(async () => {
      return getPendingDrivers();
    }),

    /**
     * Approve or reject a driver registration
     */
    reviewDriver: publicProcedure
      .input(z.object({
        driverId: z.number(),
        status: z.enum(["approved", "rejected"]),
        rejectionReason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateDriverRegistrationStatus(input.driverId, input.status, input.rejectionReason);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;


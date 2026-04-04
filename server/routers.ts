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
  deleteDriver,
  getPendingRides,
  getDriverActiveRide,
  saveDriverPushToken,
  driverPushTokens,
  getDriverPushToken,
  getPassengerPushToken,
  savePassengerPushToken,
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

        // Send push notifications to all online drivers with push tokens
        const onlineDriverTokens = Array.from(driverPushTokens.entries());
        if (onlineDriverTokens.length > 0) {
          const messages = onlineDriverTokens
            .filter(([, token]) => token.startsWith("ExponentPushToken["))
            .map(([, token]) => ({
              to: token,
              sound: "default" as const,
              title: "🚗 طلب رحلة جديد!",
              body: `من: ${input.pickupAddress || "موقع الراكب"} — ${Math.round(fare).toLocaleString("ar-IQ")} دينار`,
              data: { rideId: ride.id, type: "new_ride" },
              priority: "high" as const,
            }));
          if (messages.length > 0) {
            fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify(messages),
            }).catch((err) => console.warn("[Push] Failed to send notifications:", err));
          }
        }

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
     * Accept a ride (driver action) - sends push notification to passenger
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
        // Get ride and driver info to notify passenger
        const ride = await getRideById(input.rideId);
        if (ride) {
          const { drivers: driversTable } = await import("../drizzle/schema");
          const { eq: eqOp } = await import("drizzle-orm");
          const { getDb } = await import("./db");
          const db = await getDb();
          let driverName = "السائق";
          let driverVehicle = "";
          let driverPlate = "";
          if (db) {
            const [d] = await db.select().from(driversTable).where(eqOp(driversTable.id, input.driverId)).limit(1);
            if (d) {
              driverName = d.name;
              driverVehicle = `${d.vehicleModel ?? ""} ${d.vehicleColor ?? ""}`.trim();
              driverPlate = d.vehiclePlate ?? "";
            }
          }
          // Send push notification to passenger
          const passengerToken = await getPassengerPushToken(ride.passengerId);
          if (passengerToken && passengerToken.startsWith("ExponentPushToken[")) {
            fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({
                to: passengerToken,
                sound: "default",
                title: "🚗 تم قبول طلبك!",
                body: `${driverName} في طريقه إليك${driverVehicle ? ` — ${driverVehicle}` : ""}${driverPlate ? ` (${driverPlate})` : ""}`,
                data: { rideId: input.rideId, type: "ride_accepted" },
                priority: "high",
              }),
            }).catch((err) => console.warn("[Push] Failed to notify passenger:", err));
          }
        }
        return { success: true };
      }),

    /**
     * Update ride status - also updates driver/passenger stats on completion
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

        // On completion: increment totalRides for driver and passenger
        if (input.status === "completed") {
          const ride = await getRideById(input.rideId);
          if (ride) {
            const { drivers: driversTable, passengers: passengersTable } = await import("../drizzle/schema");
            const { eq: eqOp, sql: sqlOp } = await import("drizzle-orm");
            const { getDb } = await import("./db");
            const db = await getDb();
            if (db) {
              if (ride.driverId) {
                await db.update(driversTable)
                  .set({ totalRides: sqlOp`totalRides + 1` })
                  .where(eqOp(driversTable.id, ride.driverId));
              }
              await db.update(passengersTable)
                .set({ totalRides: sqlOp`totalRides + 1` })
                .where(eqOp(passengersTable.id, ride.passengerId));
            }
          }
        }
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
     * Get passenger ride history with real data
     */
    passengerHistory: publicProcedure
      .input(z.object({ passengerId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const db = await (await import("./db")).getDb();
        if (!db) return [];
        const { rides: ridesTable, drivers: driversTable } = await import("../drizzle/schema");
        const { eq, desc } = await import("drizzle-orm");
        const passengerRides = await db
          .select()
          .from(ridesTable)
          .where(eq(ridesTable.passengerId, input.passengerId))
          .orderBy(desc(ridesTable.createdAt))
          .limit(input.limit);
        // Fetch driver info for each completed ride
        const ridesWithDriver = await Promise.all(
          passengerRides.map(async (r) => {
            let driverInfo = null;
            if (r.driverId) {
              const [d] = await db.select().from(driversTable).where(eq(driversTable.id, r.driverId)).limit(1);
              if (d) {
                driverInfo = {
                  name: d.name,
                  vehicleModel: d.vehicleModel ?? "",
                  vehicleColor: d.vehicleColor ?? "",
                  vehiclePlate: d.vehiclePlate ?? "",
                  rating: d.rating ?? "5.0",
                };
              }
            }
            return {
              id: r.id,
              status: r.status,
              fare: r.fare ? Math.round(parseFloat(r.fare.toString())) : 0,
              pickupAddress: r.pickupAddress ?? "",
              dropoffAddress: r.dropoffAddress ?? "",
              estimatedDistance: r.estimatedDistance ? parseFloat(r.estimatedDistance.toString()) : 0,
              estimatedDuration: r.estimatedDuration ?? 0,
              paymentMethod: r.paymentMethod ?? "cash",
              createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
              completedAt: r.completedAt?.toISOString() ?? null,
              passengerRating: r.passengerRating ?? null,
              driver: driverInfo,
            };
          })
        );
        return ridesWithDriver;
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
     * Get pending rides for available drivers (polling) - includes passenger info
     */
    pendingRides: publicProcedure
      .query(async () => {
        const pending = await getPendingRides();
        // Fetch passenger info for each ride
        const ridesWithPassenger = await Promise.all(
          pending.map(async (r) => {
            const passenger = await getPassengerById(r.passengerId);
            return {
              id: r.id,
              passengerId: r.passengerId,
              passengerName: passenger?.name ?? "راكب",
              passengerRating: passenger?.rating ? parseFloat(passenger.rating.toString()) : 5.0,
              passengerTotalRides: passenger?.totalRides ?? 0,
              pickupLat: r.pickupLat ? parseFloat(r.pickupLat.toString()) : 0,
              pickupLng: r.pickupLng ? parseFloat(r.pickupLng.toString()) : 0,
              pickupAddress: r.pickupAddress ?? "",
              dropoffLat: r.dropoffLat ? parseFloat(r.dropoffLat.toString()) : 0,
              dropoffLng: r.dropoffLng ? parseFloat(r.dropoffLng.toString()) : 0,
              dropoffAddress: r.dropoffAddress ?? "",
              fare: r.fare ? Math.round(parseFloat(r.fare.toString())) : 0,
              estimatedDistance: r.estimatedDistance ? parseFloat(r.estimatedDistance.toString()) : 0,
              estimatedDuration: r.estimatedDuration ?? 0,
              createdAt: r.createdAt.toISOString(),
            };
          })
        );
        return ridesWithPassenger;
      }),

    /**
     * Get active ride for driver - includes passenger info
     */
    driverActiveRide: publicProcedure
      .input(z.object({ driverId: z.number(), rideId: z.number().optional() }))
      .query(async ({ input }) => {
        let ride;
        if (input.rideId) {
          // جلب هذه الرحلة تحديداً بالـ rideId
          const { getDb } = await import("./db");
          const { rides: ridesTable } = await import("../drizzle/schema");
          const { and: andOp, eq: eqOp, inArray: inArrayOp } = await import("drizzle-orm");
          const db = await getDb();
          if (!db) return null;
          const result = await db
            .select()
            .from(ridesTable)
            .where(
              andOp(
                eqOp(ridesTable.id, input.rideId),
                eqOp(ridesTable.driverId, input.driverId),
                inArrayOp(ridesTable.status, ["accepted", "driver_arrived", "in_progress", "completed"])
              )
            )
            .limit(1);
          ride = result.length > 0 ? result[0] : null;
        } else {
          // بدون rideId: أحدث رحلة نشطة للسائق
          ride = await getDriverActiveRide(input.driverId);
        }
        if (!ride) return null;
        // Fetch passenger info
        const passenger = await getPassengerById(ride.passengerId);
        return {
          id: ride.id,
          status: ride.status,
          passengerId: ride.passengerId,
          passengerName: passenger?.name ?? "راكب",
          passengerPhone: passenger?.phone ?? null,
          passengerRating: passenger?.rating ? parseFloat(passenger.rating.toString()) : 5.0,
          pickupLat: ride.pickupLat ? parseFloat(ride.pickupLat.toString()) : 0,
          pickupLng: ride.pickupLng ? parseFloat(ride.pickupLng.toString()) : 0,
          pickupAddress: ride.pickupAddress ?? "",
          dropoffLat: ride.dropoffLat ? parseFloat(ride.dropoffLat.toString()) : 0,
          dropoffLng: ride.dropoffLng ? parseFloat(ride.dropoffLng.toString()) : 0,
          dropoffAddress: ride.dropoffAddress ?? "",
          fare: ride.fare ? Math.round(parseFloat(ride.fare.toString())) : 0,
          estimatedDistance: ride.estimatedDistance ? parseFloat(ride.estimatedDistance.toString()) : 0,
          estimatedDuration: ride.estimatedDuration ?? 0,
        };
      }),

    /**
     * Get active ride for passenger (polling)
     */
    passengerActiveRide: publicProcedure
      .input(z.object({ passengerId: z.number(), rideId: z.number().optional() }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { rides: ridesTable, drivers: driversTable } = await import("../drizzle/schema");
        const { and: andOp, eq: eqOp, inArray: inArrayOp, desc } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return null;
        // إذا تم تمرير rideId، نجلب هذه الرحلة تحديداً
        // وإلا نجلب أحدث رحلة نشطة فقط (بدون completed)
        let result;
        if (input.rideId) {
          result = await db
            .select()
            .from(ridesTable)
            .where(
              andOp(
                eqOp(ridesTable.passengerId, input.passengerId),
                eqOp(ridesTable.id, input.rideId),
                inArrayOp(ridesTable.status, ["searching", "accepted", "driver_arrived", "in_progress", "completed"])
              )
            )
            .limit(1);
        } else {
          // بدون rideId: أحدث رحلة نشطة فقط (لا تشمل completed)
          result = await db
            .select()
            .from(ridesTable)
            .where(
              andOp(
                eqOp(ridesTable.passengerId, input.passengerId),
                inArrayOp(ridesTable.status, ["searching", "accepted", "driver_arrived", "in_progress"])
              )
            )
            .orderBy(desc(ridesTable.id))
            .limit(1);
        }
        if (result.length === 0) return null;
        const ride = result[0]!;
        // Get driver info if assigned
        let driverInfo = null;
        if (ride.driverId) {
          const driverResult = await db.select().from(driversTable).where(eqOp(driversTable.id, ride.driverId)).limit(1);
          if (driverResult.length > 0) {
            const d = driverResult[0]!;
            driverInfo = {
              name: d.name,
              phone: d.phone,
              rating: d.rating ?? "5.0",
              vehicleModel: d.vehicleModel ?? "",
              vehicleColor: d.vehicleColor ?? "",
              vehiclePlate: d.vehiclePlate ?? "",
              currentLat: d.currentLat ? parseFloat(d.currentLat.toString()) : null,
              currentLng: d.currentLng ? parseFloat(d.currentLng.toString()) : null,
            };
          }
        }
        return {
          id: ride.id,
          status: ride.status,
          fare: ride.fare ? Math.round(parseFloat(ride.fare.toString())) : 0,
          estimatedDistance: ride.estimatedDistance ? parseFloat(ride.estimatedDistance.toString()) : 0,
          estimatedDuration: ride.estimatedDuration ?? 0,
          pickupAddress: ride.pickupAddress ?? "",
          dropoffAddress: ride.dropoffAddress ?? "",
          driver: driverInfo,
        };
      }),

    /**
     * Reject a ride (driver action - pass to next driver)
     */
    reject: publicProcedure
      .input(z.object({ rideId: z.number(), driverId: z.number() }))
      .mutation(async () => {
        // Ride stays in searching state for other drivers to pick up
        return { success: true };
      }),

    /**
     * Cancel a ride (passenger action) - updates DB and notifies driver if assigned
     */
    cancel: publicProcedure
      .input(z.object({ rideId: z.number(), passengerId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        const ride = await getRideById(input.rideId);
        if (!ride) throw new Error("الرحلة غير موجودة");
        if (ride.passengerId !== input.passengerId) throw new Error("غير مصرح");
        await updateRideStatus(input.rideId, "cancelled", { cancelReason: input.reason ?? "ألغى الراكب الرحلة" } as any);
        // Notify driver if assigned
        if (ride.driverId) {
          const driverToken = await getDriverPushToken(ride.driverId);
          if (driverToken && driverToken.startsWith("ExponentPushToken[")) {
            fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({
                to: driverToken,
                sound: "default",
                title: "❌ تم إلغاء الرحلة",
                body: "قام الراكب بإلغاء الرحلة",
                data: { rideId: input.rideId, type: "ride_cancelled" },
                priority: "high",
              }),
            }).catch((err) => console.warn("[Push] Failed to notify driver of cancellation:", err));
          }
        }
        return { success: true };
      }),

    /**
     * Save driver push notification token
     */
    savePushToken: publicProcedure
      .input(z.object({ driverId: z.number(), token: z.string() }))
      .mutation(async ({ input }) => {
        await saveDriverPushToken(input.driverId, input.token);
        return { success: true };
      }),

    /**
     * Save passenger push notification token
     */
    savePassengerPushToken: publicProcedure
      .input(z.object({ passengerId: z.number(), token: z.string() }))
      .mutation(async ({ input }) => {
        await savePassengerPushToken(input.passengerId, input.token);
        return { success: true };
      }),

    /**
     * Rate a completed ride - saves passenger rating to DB and updates driver average
     */
    rateRide: publicProcedure
      .input(z.object({
        rideId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await (await import("./db")).getDb();
        if (!db) return { success: false };
        const { rides: ridesTable, drivers: driversTable } = await import("../drizzle/schema");
        const { eq, avg, sql: sqlOp } = await import("drizzle-orm");
        // Update ride with passenger rating
        await db.update(ridesTable)
          .set({ passengerRating: input.rating } as any)
          .where(eq(ridesTable.id, input.rideId));
        // Recalculate driver average rating
        const [rideRow] = await db.select({ driverId: ridesTable.driverId }).from(ridesTable).where(eq(ridesTable.id, input.rideId)).limit(1);
        if (rideRow?.driverId) {
          const ratingResult = await db
            .select({ avgRating: avg(ridesTable.passengerRating) })
            .from(ridesTable)
            .where(eq(ridesTable.driverId, rideRow.driverId));
          const newAvg = ratingResult[0]?.avgRating;
          if (newAvg) {
            await db.update(driversTable)
              .set({ rating: parseFloat(newAvg).toFixed(1) })
              .where(eq(driversTable.id, rideRow.driverId));
          }
        }
        return { success: true };
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
        // Normalize phone number to +964 format to match stored format
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) phone = "+964" + phone.slice(1);
        else if (!phone.startsWith("+")) phone = "+964" + phone;

        const driver = await getDriverByPhone(phone);
        if (!driver) return { found: false, registrationStatus: null };
        return {
          found: true,
          driverId: driver.id,
          registrationStatus: driver.registrationStatus,
          rejectionReason: driver.rejectionReason,
          name: driver.name,
        };
      }),

    /**
     * Send OTP to driver phone for login
     */
    sendLoginOtp: publicProcedure
      .input(z.object({ phone: z.string().min(10).max(15) }))
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) phone = "+964" + phone.slice(1);
        else if (!phone.startsWith("+")) phone = "+964" + phone;

        const driver = await getDriverByPhone(phone);
        if (!driver) throw new Error("رقم الهاتف غير مسجل، يرجى التسجيل أولاً");

        const code = await createOtp(phone);
        const isDev = process.env.NODE_ENV !== "production";
        return {
          success: true,
          phone,
          devCode: isDev ? code : undefined,
          message: isDev ? `رمز التحقق: ${code}` : "تم إرسال رمز التحقق",
        };
      }),

    /**
     * Verify OTP and login driver
     */
    verifyLoginOtp: publicProcedure
      .input(z.object({ phone: z.string().min(10).max(15), code: z.string().length(6) }))
      .mutation(async ({ input }) => {
        let phone = input.phone.replace(/\s/g, "");
        if (phone.startsWith("0")) phone = "+964" + phone.slice(1);
        else if (!phone.startsWith("+")) phone = "+964" + phone;

        const isValid = await verifyOtp(phone, input.code);
        if (!isValid) throw new Error("رمز التحقق غير صحيح أو منتهي الصلاحية");

        const driver = await getDriverByPhone(phone);
        if (!driver) throw new Error("السائق غير موجود");

        return {
          success: true,
          driver: {
            id: driver.id,
            phone: driver.phone,
            name: driver.name,
            photoUrl: driver.photoUrl ?? null,
            registrationStatus: driver.registrationStatus,
            rejectionReason: driver.rejectionReason ?? null,
            isVerified: driver.isVerified,
            vehicleModel: driver.vehicleModel ?? null,
            vehicleColor: driver.vehicleColor ?? null,
            vehiclePlate: driver.vehiclePlate ?? null,
            vehicleType: driver.vehicleType,
            rating: driver.rating,
            totalRides: driver.totalRides,
            walletBalance: driver.walletBalance,
          },
        };
      }),

    /**
     * Get driver trips history with real data
     */
    getTrips: publicProcedure
      .input(z.object({ driverId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const db = await (await import("./db")).getDb();
        if (!db) return { trips: [], totalEarnings: 0, totalTrips: 0, walletBalance: "0" };
        const { rides: ridesTable, drivers: driversTable, passengers: passengersTable } = await import("../drizzle/schema");
        const { eq, desc } = await import("drizzle-orm");
        const driverRides = await db
          .select()
          .from(ridesTable)
          .where(eq(ridesTable.driverId, input.driverId))
          .orderBy(desc(ridesTable.createdAt))
          .limit(input.limit);
        const completedRides = driverRides.filter(r => r.status === "completed");
        const totalEarnings = completedRides.reduce((sum, r) => sum + parseFloat(r.fare?.toString() ?? "0"), 0);
        // Get driver wallet balance
        const [driver] = await db.select({ walletBalance: driversTable.walletBalance }).from(driversTable).where(eq(driversTable.id, input.driverId)).limit(1);
        // Fetch passenger names for each ride
        const tripsWithPassenger = await Promise.all(driverRides.map(async (r) => {
          let passengerName = null;
          if (r.passengerId) {
            const [p] = await db.select({ name: passengersTable.name }).from(passengersTable).where(eq(passengersTable.id, r.passengerId)).limit(1);
            passengerName = p?.name ?? null;
          }
          return {
            id: r.id,
            status: r.status,
            fare: r.fare?.toString() ?? "0",
            pickupAddress: r.pickupAddress ?? "الموصل",
            dropoffAddress: r.dropoffAddress ?? "الوجهة",
            estimatedDistance: r.estimatedDistance ? parseFloat(r.estimatedDistance.toString()) : 0,
            estimatedDuration: r.estimatedDuration ?? 0,
            createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
            completedAt: r.completedAt?.toISOString() ?? null,
            paymentMethod: r.paymentMethod ?? "cash",
            passengerName,
          };
        }));
        return {
          trips: tripsWithPassenger,
          totalEarnings: Math.round(totalEarnings),
          totalTrips: completedRides.length,
          walletBalance: driver?.walletBalance?.toString() ?? "0",
        };
      }),

    /**
     * Get driver full profile by ID
     */
    getProfile: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => {
        const db = await (await import("./db")).getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة");
        const { drivers: driversTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const result = await db.select().from(driversTable).where(eq(driversTable.id, input.driverId)).limit(1);
        if (!result.length) throw new Error("السائق غير موجود");
        const d = result[0]!;
        return {
          id: d.id, phone: d.phone, name: d.name, photoUrl: d.photoUrl ?? null,
          registrationStatus: d.registrationStatus, rejectionReason: d.rejectionReason ?? null,
          isVerified: d.isVerified, vehicleModel: d.vehicleModel ?? null,
          vehicleColor: d.vehicleColor ?? null, vehiclePlate: d.vehiclePlate ?? null,
          vehicleType: d.vehicleType, rating: d.rating, totalRides: d.totalRides,
          walletBalance: d.walletBalance,
        };
      }),
    /**
     * Rate a passenger from the driver side - saves driverRating to rides table and updates passenger average
     */
    ratePassenger: publicProcedure
      .input(z.object({
        rideId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await (await import("./db")).getDb();
        if (!db) return { success: false };
        const { rides: ridesTable, passengers: passengersTable } = await import("../drizzle/schema");
        const { eq, avg } = await import("drizzle-orm");
        // Update ride with driver rating for passenger
        await db.update(ridesTable)
          .set({ driverRating: input.rating } as any)
          .where(eq(ridesTable.id, input.rideId));
        // Recalculate passenger average rating
        const [rideRow] = await db.select({ passengerId: ridesTable.passengerId })
          .from(ridesTable).where(eq(ridesTable.id, input.rideId)).limit(1);
        if (rideRow?.passengerId) {
          const ratingResult = await db
            .select({ avgRating: avg(ridesTable.driverRating) })
            .from(ridesTable)
            .where(eq(ridesTable.passengerId, rideRow.passengerId));
          const newAvg = ratingResult[0]?.avgRating;
          if (newAvg) {
            await db.update(passengersTable)
              .set({ rating: parseFloat(newAvg).toFixed(1) } as any)
              .where(eq(passengersTable.id, rideRow.passengerId));
          }
        }
        return { success: true };
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
     * Delete a driver account permanently
     */
    deleteDriver: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDriver(input.driverId);
        return { success: true, message: "تم حذف حساب السائق بنجاح" };
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

        // Get driver info and log notification (in production: send SMS/push)
        try {
          const db = await (await import("./db")).getDb();
          if (db) {
            const { drivers: driversTable } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const result = await db.select().from(driversTable).where(eq(driversTable.id, input.driverId)).limit(1);
            if (result.length > 0) {
              const d = result[0]!;
              const statusMsg = input.status === "approved"
                ? `مبروك! تم قبول طلبك كسائق في مسار. يمكنك الآن البدء باستقبال الرحلات.`
                : `نأسف لعدم قبول طلبك. ${input.rejectionReason ?? "يرجى مراجعة البيانات وإعادة التقديم."}` ;
              // Log notification (in production, send via push notification service)
              console.log(`[Driver Notification] ${d.name} (${d.phone}): ${statusMsg}`);
            }
          }
        } catch (e) {
          // Non-critical, don't fail the mutation
          console.warn("[reviewDriver] Failed to send notification:", e);
        }

        return {
          success: true,
          message: input.status === "approved"
            ? "تم قبول السائق بنجاح"
            : "تم رفض طلب السائق",
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;


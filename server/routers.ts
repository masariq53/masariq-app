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
  passengerPushTokens,
  getAllPricingZones,
  getPricingZone,
  calculateFareDynamic,
  createPricingZone,
  updatePricingZone,
  deletePricingZone,
  getPricingHistory,
  seedDefaultPricingZone,
  createIntercityTrip,
  getUpcomingIntercityTrips,
  getDriverIntercityTrips,
  getDriverIntercityTodayEarnings,
  cancelIntercityTrip,
  bookIntercityTrip,
  getPassengerIntercityBookings,
  cancelIntercityBooking,
  getTripBookings,
  updateIntercityTripStatus,
  rateIntercityTrip,
  bookIntercityTripWithPickup,
  getPassengerIntercityBookingsWithTrip,
  bookIntercityWithGPS,
  updatePassengerPickupStatus,
  getDriverTripPassengers,
  cancelPassengerByDriver,
  getDb,
  getAllIntercityTripsAdmin,
  adminCancelIntercityTrip,
  getAdminTripPassengers,
  updateDriverApproachStatus,
  updateDriverLiveLocation,
  getDriverLiveLocation,
  getPassengerBookingStatus,
  sendIntercityMessage,
  getIntercityMessages,
  markIntercityMessagesRead,
  countUnreadIntercityMessages,
  getIntercityTripMessages,
  createSupportTicket,
  getSupportTickets,
  getUserSupportTickets,
  getSupportTicketById,
  updateSupportTicketStatus,
  addSupportMessage,
  getSupportMessages,
  markSupportMessagesRead,
  getAdminUnreadSupportCount,
  rateSupportTicket,
  getSupportRatingStats,
  applyForAgent,
  getAgentByPassengerId,
  getAllAgents,
  updateAgentStatus,
  rechargeAgentBalance,
  agentRechargeWallet,
  getAgentTransactions,
  getAllAgentTransactions,
  getAgentFullLedger,
  searchRecipientByPhone,
  getAgentMonthlyStats,
  deleteAgent,
  createParcel,
  getParcelById,
  getParcelByTracking,
  getSenderParcels,
  getPendingInstantParcels,
  getDriverActiveParcels,
  getDriverAllParcels,
  acceptParcel,
  updateParcelStatus,
  verifyParcelDeliveryOtp,
  getParcelStatusLogs,
  getAdminParcels,
  getParcelStats,
  getAllParcelAgents,
  getActiveParcelAgents,
  createParcelAgent,
  updateParcelAgentStatus,
  getPassengerBlockStatus,
  getAllRidesWithDetails,
  deductIntercityCommission,
  deductParcelCommission,
  getCommissionSettings,
  updateCommissionSetting,
  getDriverCommissionOverrides,
  setDriverCommissionOverride,
  deleteDriverCommissionOverride,
  getAllDriverCommissionOverrides,
  getAllUserDiscounts,
  createUserDiscount,
  createBulkUserDiscounts,
  deactivateUserDiscount,
  createWalletTopupRequest,
  getWalletTopupRequests,
  getUserWalletTopupRequests,
  approveWalletTopupRequest,
  rejectWalletTopupRequest,
  getPaymentMethodSettings,
  updatePaymentMethodSetting,
  getCommissionReport,
  checkDriverBalanceSufficient,
  getPassengerWalletTransactions,
  detectCityFromCoords,
  getAllAppSettings,
  getAppSetting,
  setAppSetting,
  applyPassengerWelcomeBonus,
  applyDriverWelcomeBonus,
  sendRideMessage,
  getRideMessages,
  markRideMessagesRead,
  countUnreadRideMessages,
} from "./db";
import { storagePut } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";
import { TRPCError } from "@trpc/server";

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
        const isDev = process.env.NODE_ENV !== "production" || process.env.SHOW_DEV_OTP === "true";

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

        // التحقق من حالة الحظر قبل إرسال OTP - منع استنزاف رصيد OTP
        const blockStatus = await getPassengerBlockStatus(phone);
        if (blockStatus?.isBlocked) {
          const reason = blockStatus.blockReason || "تم تعطيل حسابك من قِبل الإدارة";
          throw new Error(`🚫 تم تعطيل حسابك\n\n${reason}\n\nللاستفسار أو الاعتراض، تواصل مع فريق الدعم الفني.`);
        }

        const code = await createOtp(phone);
        const isDev = process.env.NODE_ENV !== "production" || process.env.SHOW_DEV_OTP === "true";
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
        // Block check: prevent blocked users from logging in
        if ((passenger as any).isBlocked) {
          const reason = (passenger as any).blockReason || "تم تعطيل حسابك من قِبل الإدارة";
          throw new Error(`🚫 تم تعطيل حسابك. السبب: ${reason}\n\nللاستفسار تواصل مع الدعم الفني.`);
        }
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
        const isDev = process.env.NODE_ENV !== "production" || process.env.SHOW_DEV_OTP === "true";
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
        // تطبيق الرصيد الترحيبي للمستخدم الجديد
        const welcomeBonus = await applyPassengerWelcomeBonus(passenger.id);
        // جلب بيانات المستخدم محدثة بعد الرصيد الترحيبي
        const updatedPassenger = await getPassengerById(passenger.id);
        return { success: true, welcomeBonus, passenger: { id: passenger.id, phone: passenger.phone, name: passenger.name, photoUrl: passenger.photoUrl ?? null, walletBalance: updatedPassenger?.walletBalance ?? passenger.walletBalance, totalRides: passenger.totalRides, rating: passenger.rating } };
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
          quotedFare: z.number().optional(), // السعر المعروض للمستخدم قبل التأكيد
          quotedDuration: z.number().optional(), // الوقت المقدر من estimateFare
        })
      )
      .mutation(async ({ input }) => {
        // Block check: prevent blocked passengers from requesting rides
        const passengerCheck = await getPassengerById(input.passengerId);
        if (passengerCheck && (passengerCheck as any).isBlocked) {
          throw new Error("🚫 تم تعطيل حسابك. لا يمكنك طلب رحلة.");
        }
        // استخدام السعر المقتبس من estimateFare إذا تم تمريره، وإلا احسب من جديد
        let fare: number;
        let duration: number;
        let distance: number;
        if (input.quotedFare && input.quotedFare > 0) {
          fare = input.quotedFare;
          duration = input.quotedDuration ?? 0;
          distance = calculateDistance(input.pickupLat, input.pickupLng, input.dropoffLat, input.dropoffLng);
        } else {
          distance = calculateDistance(
            input.pickupLat,
            input.pickupLng,
            input.dropoffLat,
            input.dropoffLng
          );
          duration = Math.ceil((distance / 30) * 60);
          // استخدام التسعير الديناميكي من قاعدة البيانات
          await seedDefaultPricingZone();
          const rideCity = detectCityFromCoords(input.pickupLat, input.pickupLng);
          const fareResult = await calculateFareDynamic(distance, duration, rideCity, "sedan", input.pickupLat, input.pickupLng);
          fare = fareResult.fare;
        }

        // ─── فحص كفاية الرصيد مسبقاً إذا اختار الدفع بالمحفظة ───
        // الخصم الفعلي يتم فقط عند ضغطة بدأ الرحلة (in_progress)
        if (input.paymentMethod === "wallet") {
          const { getDb: getDbInner } = await import("./db");
          const { passengers: passengersSchema } = await import("../drizzle/schema");
          const { eq: eqInner } = await import("drizzle-orm");
          const dbInner = await getDbInner();
          if (!dbInner) throw new Error("قاعدة البيانات غير متاحة");
          const [passengerRow] = await dbInner
            .select({ walletBalance: passengersSchema.walletBalance })
            .from(passengersSchema)
            .where(eqInner(passengersSchema.id, input.passengerId))
            .limit(1);
          const balance = parseFloat(passengerRow?.walletBalance?.toString() ?? "0");
          if (balance < fare) {
            throw new Error("رصيدك غير كافٍ للدفع من المحفظة");
          }
        }

        // إنشاء الرحلة في قاعدة البيانات
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
        // ملاحظة: الخصم الفعلي يتم عند بدء الرحلة (in_progress) في updateStatus

        // ─── إرسال إشعارات push للسائقين النشطين ───
        // فلتر السائقين النشطين خلال آخر 10 دقائق من قاعدة البيانات - منع إرسال طلبات لسائقين أغلقوا التطبيق منذ فترة طويلة
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const dbForPush = await (await import("./db")).getDb();
        let activeDriverTokens: Array<[number, string]> = [];
        if (dbForPush) {
          const { drivers: driversSchema } = await import("../drizzle/schema");
          const { and: andOp, eq: eqOp2, gt: gtOp, isNotNull: isNotNullOp } = await import("drizzle-orm");
          const activeDrivers: { id: number; pushToken: string | null }[] = await dbForPush
            .select({ id: driversSchema.id, pushToken: driversSchema.pushToken })
            .from(driversSchema)
            .where(
              andOp(
                eqOp2(driversSchema.isOnline, true),
                eqOp2(driversSchema.isAvailable, true),
                gtOp(driversSchema.lastActiveAt, tenMinutesAgo),
                isNotNullOp(driversSchema.pushToken)
              )
            );
          activeDriverTokens = activeDrivers
            .filter((d: { id: number; pushToken: string | null }) => d.pushToken?.startsWith("ExponentPushToken["))
            .map((d: { id: number; pushToken: string | null }) => [d.id, d.pushToken!] as [number, string]);
          // تحديث كاش الذاكرة بالسائقين النشطين
          for (const [id, token] of activeDriverTokens) {
            driverPushTokens.set(id, token);
          }
        } else {
          // فولباك: استخدام كاش الذاكرة
          activeDriverTokens = Array.from(driverPushTokens.entries());
        }
        if (activeDriverTokens.length > 0) {
          const messages = activeDriverTokens
            .filter(([, token]) => token.startsWith("ExponentPushToken["))
            .map(([, token]) => ({
              to: token,
              sound: "default" as const,
              title: "🚗 طلب رحلة جديد!",
              body: `من: ${input.pickupAddress || "موقع الراكب"} — ${Math.round(fare).toLocaleString("ar-IQ")} دينار`,
              data: { rideId: ride.id, type: "new_ride" },
              priority: "high" as const,
              channelId: "driver-alerts",
              _displayInForeground: true,
            }));
          if (messages.length > 0) {
            fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify(messages),
            }).catch((err) => console.warn("[Push] Failed to send notifications:", err));
          }
        }

        // إلغاء تلقائي بعد 3 دقائق إذا لم يقبل أي سائق الطلب
        setTimeout(async () => {
          try {
            const currentRide = await getRideById(ride.id);
            if (currentRide && currentRide.status === "searching") {
              await updateRideStatus(ride.id, "cancelled");
              // إشعار المستخدم بعدم إيجاد سائق
              const passengerToken = passengerPushTokens.get(input.passengerId);
              if (passengerToken?.startsWith("ExponentPushToken[")) {
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify([{
                    to: passengerToken,
                    sound: "default",
                    title: "⚠️ لم يتوفر سائق",
                    body: "لم نتمكن من إيجاد سائق قريب منك. حاول مرة أخرى.",
                    data: { rideId: ride.id, type: "no_driver_found" },
                  }]),
                }).catch(() => {});
              }
              // ملاحظة: لا حاجة لاسترداد هنا لأن الخصم يتم فقط عند بدء الرحلة (in_progress)
              // والإلغاء التلقائي يحدث في مرحلة "searching" قبل قبول أي سائق
            }
          } catch (e) {
            console.warn("[AutoCancel] Error:", e);
          }
        }, 3 * 60 * 1000); // 3 دقائق

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
        // استخدام captainRadiusKm من قاعدة البيانات إذا لم يُرسل من الواجهة
        let effectiveRadius = input.radiusKm;
        if (input.radiusKm === 5) { // القيمة الافتراضية تعني لم تُحدد من الواجهة
          try {
            const cityName = detectCityFromCoords(input.lat, input.lng);
            const zone = await getPricingZone(cityName, "sedan");
            if (zone?.captainRadiusKm) {
              effectiveRadius = parseFloat(zone.captainRadiusKm.toString());
            }
          } catch { /* استخدم القيمة الافتراضية */ }
        }
        const drivers = await getNearbyDrivers(input.lat, input.lng, effectiveRadius);
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
        // فحص حالة الرحلة قبل القبول - منع قبول الرحلات الملغاة أو المقبولة مسبقاً
        const existingRide = await getRideById(input.rideId);
        if (!existingRide || existingRide.status !== "searching") {
          // الرحلة ملغاة أو مقبولة من سائق آخر - رفض القبول
          return { success: false, reason: "ride_not_available" };
        }
        // ─── التحقق من رصيد المحفظة قبل قبول الرحلة ───
        const balanceCheck = await checkDriverBalanceSufficient(input.driverId);
        if (!balanceCheck.sufficient) {
          return { success: false, reason: "insufficient_balance", balance: balanceCheck.balance, minimum: balanceCheck.minRequired };
        }
        await updateRideStatus(input.rideId, "accepted", { driverId: input.driverId });
        // جعل السائق غير متاح فوراً لمنع استقبال طلبات جديدة أثناء الرحلة
        await setDriverOnlineStatus(input.driverId, true, false);
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

        // ─── خصم رصيد المستخدم عند بدء الرحلة ───
        // يتم الخصم فقط عند ضغط الكابتن على "بدأ الرحلة" وليس عند الطلب
        if (input.status === "in_progress") {
          const rideForWallet = await getRideById(input.rideId);
          if (rideForWallet && (rideForWallet as any).paymentMethod === "wallet" && rideForWallet.fare && Number(rideForWallet.fare) > 0) {
            try {
              const { getDb: getDbW } = await import("./db");
              const { passengers: passengersW, walletTransactions: walletTxW } = await import("../drizzle/schema");
              const { eq: eqW, sql: sqlW } = await import("drizzle-orm");
              const dbW = await getDbW();
              if (dbW) {
                const fare = Number(rideForWallet.fare);
                const [passengerRow] = await dbW
                  .select({ walletBalance: passengersW.walletBalance })
                  .from(passengersW)
                  .where(eqW(passengersW.id, rideForWallet.passengerId))
                  .limit(1);
                const balanceBefore = parseFloat(passengerRow?.walletBalance?.toString() ?? "0");
                if (balanceBefore < fare) {
                  // لو كان الرصيد غير كافٍ عند بدء الرحلة (نادر جداً) - نسجل تحذير ونكمل العملية
                  console.warn(`[Wallet] Passenger ${rideForWallet.passengerId} has insufficient balance at ride start. Balance: ${balanceBefore}, Fare: ${fare}`);
                }
                const balanceAfter = Math.max(0, balanceBefore - fare);
                // خصم المبلغ من محفظة المستخدم
                await dbW
                  .update(passengersW)
                  .set({ walletBalance: sqlW`GREATEST(0, walletBalance - ${fare})` })
                  .where(eqW(passengersW.id, rideForWallet.passengerId));
                // تسجيل معاملة الخصم في سجل المحفظة
                await dbW.insert(walletTxW).values({
                  userId: rideForWallet.passengerId,
                  userType: "passenger",
                  type: "debit",
                  amount: fare.toFixed(2),
                  balanceBefore: balanceBefore.toString(),
                  balanceAfter: balanceAfter.toString(),
                  description: `دفع رحلة داخل المدينة #${input.rideId}`,
                  referenceId: input.rideId,
                  referenceType: "city_ride",
                  status: "completed",
                });
              }
            } catch (e) {
              console.warn("[Wallet] Failed to deduct fare on ride start:", e);
            }
          }
        }

        // On completion: increment totalRides, keep driver online but set available=true (ready for new rides)
        if (input.status === "completed") {
          const ride = await getRideById(input.rideId);
          if (ride) {
            const { drivers: driversTable, passengers: passengersTable } = await import("../drizzle/schema");
            const { eq: eqOp, sql: sqlOp } = await import("drizzle-orm");
            const { getDb } = await import("./db");
            const db = await getDb();
            if (db) {
              if (ride.driverId) {
                // عند الاكتمال: أعد السائق لحالة متاح لاستقبال طلبات جديدة
                await db.update(driversTable)
                  .set({ totalRides: sqlOp`totalRides + 1`, isAvailable: true })
                  .where(eqOp(driversTable.id, ride.driverId));
                // استقطاع 10% عمولة الشركة من محفظة السائق
                if (ride.fare && Number(ride.fare) > 0) {
                  try {
                    const { deductDriverCommission } = await import("./db");
                    await deductDriverCommission(ride.driverId, ride.id, Number(ride.fare));
                  } catch (e) {
                    console.warn("[Commission] Failed to deduct commission:", e);
                  }
                  // إذا كانت طريقة الدفع بالمحفظة: تحويل الأجرة لمحفظة الكابتن
                  if ((ride as any).paymentMethod === "wallet") {
                    try {
                      const { transferFareToDriver } = await import("./db");
                      await transferFareToDriver(ride.driverId, ride.passengerId, Number(ride.fare), ride.id, "city");
                    } catch (e) {
                      console.warn("[Wallet] Failed to transfer fare to driver:", e);
                    }
                  }
                }
              }
              await db.update(passengersTable)
                .set({ totalRides: sqlOp`totalRides + 1` })
                .where(eqOp(passengersTable.id, ride.passengerId));
            }
          }
        }

        // On cancellation: restore driver availability so they can receive new rides
        if (input.status === "cancelled") {
          const ride = await getRideById(input.rideId);
          if (ride?.driverId) {
            // عند الإلغاء: أعد السائق لحالة متاح حتى يستقبل طلبات جديدة
            await setDriverOnlineStatus(ride.driverId, true, true);
          }
          // إذا كانت طريقة الدفع بالمحفظة وكانت الرحلة قد بدأت فعلاً (in_progress): استرداد الأجرة للمستخدم
          // الخصم يتم فقط عند in_progress لذلك لا نسترد إلا إذا كان الخصم قد تم فعلاً
          const rideStatusBeforeCancel = ride?.status;
          const deductionAlreadyDone = rideStatusBeforeCancel === "in_progress";
          if (ride && (ride as any).paymentMethod === "wallet" && ride.fare && Number(ride.fare) > 0 && deductionAlreadyDone) {
            try {
              const { refundFareToPassenger } = await import("./db");
              const cancelReason = input.cancelReason ?? "إلغاء الرحلة";
              await refundFareToPassenger(ride.passengerId, Number(ride.fare), ride.id, cancelReason);
            } catch (e) {
              console.warn("[Wallet] Failed to refund fare to passenger:", e);
            }
          }
          // إرسال Push Notification للمستخدم عند إلغاء السائق
          const isDriverCancel = input.cancelReason?.includes("سائق") || input.cancelReason?.includes("driver");
          if (isDriverCancel && ride?.passengerId) {
            const passengerToken = await getPassengerPushToken(ride.passengerId);
            if (passengerToken && passengerToken.startsWith("ExponentPushToken[")) {
              const rideStatus = ride.status; // الحالة قبل الإلغاء
              const isArrivedPhase = rideStatus === "driver_arrived";
              fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                  to: passengerToken,
                  title: isArrivedPhase ? "⚠️ ألغى السائق الرحلة" : "❌ ألغى السائق الرحلة",
                  body: isArrivedPhase
                    ? "ألغى السائق بعد وصوله لموقعك. هل تريد البحث عن سائق جديد؟"
                    : "ألغى السائق الرحلة أثناء توجهه إليك. نبحث لك عن سائق آخر تلقائياً...",
                  sound: "default",
                  priority: "high",
                  channelId: "ride-updates",
                }),
              }).catch((err) => console.warn("[Push] Failed to notify passenger of driver cancellation:", err));
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
    /**
     * Get passenger wallet transactions
     */
    getPassengerTransactions: publicProcedure
      .input(z.object({ passengerId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getPassengerWalletTransactions(input.passengerId, input.limit ?? 50);
      }),

    passengerHistory: publicProcedure
      .input(z.object({
        passengerId: z.number(),
        limit: z.number().default(15),
        cursor: z.number().optional(), // last ride id for pagination
        status: z.enum(["all", "completed", "cancelled"]).default("all"),
      }))
      .query(async ({ input }) => {
        const db = await (await import("./db")).getDb();
        if (!db) return { rides: [], nextCursor: null, totalCompleted: 0, totalSpent: 0 };
        const { rides: ridesTable, drivers: driversTable } = await import("../drizzle/schema");
        const { eq, desc, lt, and, inArray } = await import("drizzle-orm");

        // Build where conditions
        const conditions: any[] = [eq(ridesTable.passengerId, input.passengerId)];
        if (input.cursor) conditions.push(lt(ridesTable.id, input.cursor));
        if (input.status === "completed") conditions.push(eq(ridesTable.status, "completed"));
        if (input.status === "cancelled") conditions.push(eq(ridesTable.status, "cancelled"));

        const pageSize = input.limit + 1; // fetch one extra to detect next page
        const passengerRides = await db
          .select()
          .from(ridesTable)
          .where(and(...conditions))
          .orderBy(desc(ridesTable.id))
          .limit(pageSize);

        const hasMore = passengerRides.length > input.limit;
        const paginated = hasMore ? passengerRides.slice(0, input.limit) : passengerRides;
        const nextCursor = hasMore ? paginated[paginated.length - 1]!.id : null;

        // Fetch driver info for each ride
        const ridesWithDriver = await Promise.all(
          paginated.map(async (r) => {
            let driverInfo = null;
            if (r.driverId) {
              const [d] = await db.select().from(driversTable).where(eq(driversTable.id, r.driverId)).limit(1);
              if (d) {
                driverInfo = {
                  name: d.name,
                  phone: d.phone,
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

        // Compute totals (all completed rides, not paginated)
        const allCompleted = await db
          .select()
          .from(ridesTable)
          .where(and(eq(ridesTable.passengerId, input.passengerId), eq(ridesTable.status, "completed")));
        const totalCompleted = allCompleted.length;
        const totalSpent = allCompleted.reduce((sum, r) => sum + (r.fare ? Math.round(parseFloat(r.fare.toString())) : 0), 0);

        return { rides: ridesWithDriver, nextCursor, totalCompleted, totalSpent };
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
                inArrayOp(ridesTable.status, ["accepted", "driver_arrived", "in_progress", "completed", "cancelled"])
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
                inArrayOp(ridesTable.status, ["searching", "accepted", "driver_arrived", "in_progress", "completed", "cancelled"])
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
              photoUrl: d.photoUrl ?? null,
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
          cancelReason: ride.cancelReason ?? null,
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
        // Notify driver if assigned + reset driver to available
        if (ride.driverId) {
          // تغيير حالة السائق إلى متاح فوراً
          await setDriverOnlineStatus(ride.driverId, true, true);
          // إرسال Push Notification للسائق بشكل احترافي
          const driverToken = await getDriverPushToken(ride.driverId);
          if (driverToken && driverToken.startsWith("ExponentPushToken[")) {
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify({
                to: driverToken,
                sound: "default",
                title: "❌ ألغى الراكب الرحلة",
                body: "قام الراكب بإلغاء الرحلة بينما كنت في الطريق إليه. أنت الآن متاح لطلبات جديدة.",
                data: { rideId: input.rideId, type: "ride_cancelled" },
                priority: "high",
                badge: 1,
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
        console.log(`[Push] Saving driver push token for driver ${input.driverId}: ${input.token.substring(0, 30)}...`);
        await saveDriverPushToken(input.driverId, input.token);
        console.log(`[Push] Driver push token saved successfully for driver ${input.driverId}`);
        return { success: true };
      }),

    /**
     * Save passenger push notification token
     */
    savePassengerPushToken: publicProcedure
      .input(z.object({ passengerId: z.number(), token: z.string() }))
      .mutation(async ({ input }) => {
        console.log(`[Push] Saving passenger push token for passenger ${input.passengerId}: ${input.token.substring(0, 30)}...`);
        await savePassengerPushToken(input.passengerId, input.token);
        console.log(`[Push] Passenger push token saved successfully for passenger ${input.passengerId}`);
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
          // إذا أرسلت الواجهة بيانات OSRM جاهزة، نستخدمها مباشرة بدون طلب ثانٍ
          osrmDistanceKm: z.number().optional(),
          osrmDurationMin: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        let distance: number;
        let duration: number;

        // إذا أرسلت الواجهة بيانات OSRM جاهزة، استخدمها مباشرة (أسرع وأدق)
        if (input.osrmDistanceKm && input.osrmDistanceKm > 0 && input.osrmDurationMin && input.osrmDurationMin > 0) {
          distance = input.osrmDistanceKm;
          duration = input.osrmDurationMin;
        } else {
          // استخدام Mapbox driving-traffic للحصول على وقت دقيق يأخذ حركة المرور بعين الاعتبار
          try {
            const MAPBOX_TOKEN = "pk.eyJ1IjoibXVzdGFmYWlxMSIsImEiOiJjbW56NmpwcXcwOXprMnFzZDl1eTFjZWd0In0.nC_HXss0ue9QkBeyo5ZmQA";
            const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${input.pickupLng},${input.pickupLat};${input.dropoffLng},${input.dropoffLat}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;
            const res = await fetch(mapboxUrl, {
              signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
              const data = await res.json() as { routes?: Array<{ distance: number; duration: number }> };
              if (data.routes?.[0]) {
                distance = data.routes[0].distance / 1000;
                duration = Math.ceil(data.routes[0].duration / 60);
              } else {
                throw new Error("Mapbox no route");
              }
            } else {
              throw new Error("Mapbox error");
            }
          } catch {
            // fallback: خط مستقيم × 1.3
            const straightLine = calculateDistance(
              input.pickupLat,
              input.pickupLng,
              input.dropoffLat,
              input.dropoffLng
            );
            distance = straightLine * 1.3;
            duration = Math.ceil((distance / 40) * 60);
          }
        }

        // Seed default zone if none exists
        await seedDefaultPricingZone();

        // تحديد المدينة من إحداثيات موقع الالتقاط لتطبيق التسعير الصحيح
        const cityName = detectCityFromCoords(input.pickupLat, input.pickupLng);
        const result = await calculateFareDynamic(distance, duration, cityName, "sedan", input.pickupLat, input.pickupLng);

        return {
          distance: parseFloat(distance.toFixed(1)),
          fare: result.fare,
          duration,
          fareBreakdown: {
            baseFare: result.breakdown.baseFare,
            distanceFare: result.breakdown.distanceFare,
            timeFare: result.breakdown.timeFare,
            bookingFee: result.breakdown.bookingFee,
            surgeMultiplier: result.breakdown.surgeMultiplier,
            nightSurcharge: result.breakdown.nightSurcharge,
            total: result.fare,
            pricingMethod: result.breakdown.pricingMethod,
            zoneName: result.breakdown.zoneName,
          },
        };
      }),

    // ─── Ride Chat (داخل المدينة) ─────────────────────────────────────────────
    // إرسال رسالة شات في رحلة داخل المدينة
    sendMessage: publicProcedure
      .input(z.object({
        rideId: z.number(),
        senderType: z.enum(["passenger", "driver"]),
        senderId: z.number(),
        message: z.string().min(1).max(1000),
      }))
      .mutation(async ({ input }) => {
        const msg = await sendRideMessage(input);
        // إرسال Push للطرف الآخر
        try {
          const { rides: ridesTable } = await import("../drizzle/schema");
          const { eq: eqOp } = await import("drizzle-orm");
          const db = await getDb();
          if (db) {
            const [ride] = await db.select().from(ridesTable).where(eqOp(ridesTable.id, input.rideId)).limit(1);
            if (ride) {
              if (input.senderType === "driver" && ride.passengerId) {
                // الكابتن أرسل → أشعر الراكب
                const token = await getPassengerPushToken(ride.passengerId);
                if (token?.startsWith("ExponentPushToken[")) {
                  fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      to: token, sound: "default",
                      title: "💬 رسالة جديدة من السائق",
                      body: input.message.length > 60 ? input.message.slice(0, 60) + "..." : input.message,
                      data: { type: "ride_chat", rideId: input.rideId },
                      priority: "high",
                    }),
                  }).catch(() => {});
                }
              } else if (input.senderType === "passenger" && ride.driverId) {
                // الراكب أرسل → أشعر الكابتن
                const token = await getDriverPushToken(ride.driverId);
                if (token?.startsWith("ExponentPushToken[")) {
                  fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      to: token, sound: "default",
                      title: "💬 رسالة جديدة من الراكب",
                      body: input.message.length > 60 ? input.message.slice(0, 60) + "..." : input.message,
                      data: { type: "ride_chat", rideId: input.rideId },
                      priority: "high",
                    }),
                  }).catch(() => {});
                }
              }
            }
          }
        } catch (e) { console.warn("[RideChat Push] Error:", e); }
        return msg;
      }),
    // جلب رسائل رحلة معينة
    getMessages: publicProcedure
      .input(z.object({ rideId: z.number() }))
      .query(async ({ input }) => getRideMessages(input.rideId)),
    // تحديد الرسائل كمقروءة
    markRead: publicProcedure
      .input(z.object({ rideId: z.number(), readerType: z.enum(["passenger", "driver"]) }))
      .mutation(async ({ input }) => {
        await markRideMessagesRead(input.rideId, input.readerType);
        return { success: true };
      }),
    // عدد الرسائل غير المقروءة
    unreadCount: publicProcedure
      .input(z.object({ rideId: z.number(), readerType: z.enum(["passenger", "driver"]) }))
      .query(async ({ input }) => {
        const count = await countUnreadRideMessages(input.rideId, input.readerType);
        return { count };
      }),
  }),

  // ─── Pricing ──────────────────────────────────────────────────────────────
  pricing: router({
    /**
     * Get all pricing zones
     */
    getZones: publicProcedure.query(async () => {
      await seedDefaultPricingZone();
      return getAllPricingZones();
    }),

    /**
     * Get a specific pricing zone by ID
     */
    getZone: publicProcedure
      .input(z.object({ zoneId: z.number() }))
      .query(async ({ input }) => {
        const zones = await getAllPricingZones();
        return zones.find((z) => z.id === input.zoneId) ?? null;
      }),

    /**
     * Create a new pricing zone
     */
    createZone: publicProcedure
      .input(
        z.object({
          cityName: z.string().min(1),
          cityNameAr: z.string().min(1),
          isActive: z.boolean().default(true),
          isDefault: z.boolean().default(false),
          pricingMethod: z.enum(["per_km", "per_minute", "hybrid", "zones"]).default("per_km"),
          vehicleType: z.enum(["sedan", "suv", "minivan", "all"]).default("all"),
          baseFare: z.number().min(0),
          pricePerKm: z.number().min(0),
          pricePerMinute: z.number().min(0),
          minimumFare: z.number().min(0),
          maximumFare: z.number().min(0).default(0),
          surgeMultiplier: z.number().min(1).max(5).default(1),
          peakHoursConfig: z.string().optional(),
          nightSurchargeStart: z.string().optional(),
          nightSurchargeEnd: z.string().optional(),
          nightSurchargeAmount: z.number().min(0).default(0),
          bookingFee: z.number().min(0).default(0),
          freeWaitMinutes: z.number().min(0).default(3),
          waitPricePerMinute: z.number().min(0).default(0),
          cancellationFee: z.number().min(0).default(0),
          zonesConfig: z.string().optional(), // JSON string
          captainRadiusKm: z.number().min(0.5).max(50).default(2),
          notes: z.string().optional(),
          updatedBy: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await createPricingZone({
          ...input,
          baseFare: input.baseFare.toString(),
          pricePerKm: input.pricePerKm.toString(),
          pricePerMinute: input.pricePerMinute.toString(),
          minimumFare: input.minimumFare.toString(),
          maximumFare: input.maximumFare.toString(),
          surgeMultiplier: input.surgeMultiplier.toString(),
          nightSurchargeAmount: input.nightSurchargeAmount.toString(),
          bookingFee: input.bookingFee.toString(),
          waitPricePerMinute: input.waitPricePerMinute.toString(),
          cancellationFee: input.cancellationFee.toString(),
          captainRadiusKm: input.captainRadiusKm.toString(),
        });
        return { success: true, message: "تم إنشاء منطقة التسعير بنجاح" };
      }),

    /**
     * Update an existing pricing zone
     */
    updateZone: publicProcedure
      .input(
        z.object({
          zoneId: z.number(),
          cityName: z.string().min(1).optional(),
          cityNameAr: z.string().min(1).optional(),
          isActive: z.boolean().optional(),
          isDefault: z.boolean().optional(),
          pricingMethod: z.enum(["per_km", "per_minute", "hybrid", "zones"]).optional(),
          vehicleType: z.enum(["sedan", "suv", "minivan", "all"]).optional(),
          baseFare: z.number().min(0).optional(),
          pricePerKm: z.number().min(0).optional(),
          pricePerMinute: z.number().min(0).optional(),
          minimumFare: z.number().min(0).optional(),
          maximumFare: z.number().min(0).optional(),
          surgeMultiplier: z.number().min(1).max(5).optional(),
          peakHoursConfig: z.string().optional(),
          nightSurchargeStart: z.string().optional(),
          nightSurchargeEnd: z.string().optional(),
          nightSurchargeAmount: z.number().min(0).optional(),
          bookingFee: z.number().min(0).optional(),
          freeWaitMinutes: z.number().min(0).optional(),
          waitPricePerMinute: z.number().min(0).optional(),
          cancellationFee: z.number().min(0).optional(),
          zonesConfig: z.string().optional(),
          captainRadiusKm: z.number().min(0.5).max(50).optional(),
          notes: z.string().optional(),
          updatedBy: z.string().optional(),
          changeNote: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { zoneId, changeNote, updatedBy, ...rest } = input;
        const updateData: Record<string, unknown> = {};
        if (rest.cityName !== undefined) updateData.cityName = rest.cityName;
        if (rest.cityNameAr !== undefined) updateData.cityNameAr = rest.cityNameAr;
        if (rest.isActive !== undefined) updateData.isActive = rest.isActive;
        if (rest.isDefault !== undefined) updateData.isDefault = rest.isDefault;
        if (rest.pricingMethod !== undefined) updateData.pricingMethod = rest.pricingMethod;
        if (rest.vehicleType !== undefined) updateData.vehicleType = rest.vehicleType;
        if (rest.baseFare !== undefined) updateData.baseFare = rest.baseFare.toString();
        if (rest.pricePerKm !== undefined) updateData.pricePerKm = rest.pricePerKm.toString();
        if (rest.pricePerMinute !== undefined) updateData.pricePerMinute = rest.pricePerMinute.toString();
        if (rest.minimumFare !== undefined) updateData.minimumFare = rest.minimumFare.toString();
        if (rest.maximumFare !== undefined) updateData.maximumFare = rest.maximumFare.toString();
        if (rest.surgeMultiplier !== undefined) updateData.surgeMultiplier = rest.surgeMultiplier.toString();
        if (rest.peakHoursConfig !== undefined) updateData.peakHoursConfig = rest.peakHoursConfig;
        if (rest.nightSurchargeStart !== undefined) updateData.nightSurchargeStart = rest.nightSurchargeStart;
        if (rest.nightSurchargeEnd !== undefined) updateData.nightSurchargeEnd = rest.nightSurchargeEnd;
        if (rest.nightSurchargeAmount !== undefined) updateData.nightSurchargeAmount = rest.nightSurchargeAmount.toString();
        if (rest.bookingFee !== undefined) updateData.bookingFee = rest.bookingFee.toString();
        if (rest.freeWaitMinutes !== undefined) updateData.freeWaitMinutes = rest.freeWaitMinutes;
        if (rest.waitPricePerMinute !== undefined) updateData.waitPricePerMinute = rest.waitPricePerMinute.toString();
        if (rest.cancellationFee !== undefined) updateData.cancellationFee = rest.cancellationFee.toString();
        if (rest.zonesConfig !== undefined) updateData.zonesConfig = rest.zonesConfig;
        if (rest.captainRadiusKm !== undefined) updateData.captainRadiusKm = rest.captainRadiusKm.toString();
        if (rest.notes !== undefined) updateData.notes = rest.notes;
        if (updatedBy !== undefined) updateData.updatedBy = updatedBy;

        await updatePricingZone(zoneId, updateData, updatedBy ?? "admin", changeNote);
        return { success: true, message: "تم تحديث منطقة التسعير بنجاح" };
      }),

    /**
     * Delete a pricing zone
     */
    deleteZone: publicProcedure
      .input(z.object({ zoneId: z.number() }))
      .mutation(async ({ input }) => {
        await deletePricingZone(input.zoneId);
        return { success: true, message: "تم حذف منطقة التسعير" };
      }),

    /**
     * Get pricing change history for a zone
     */
    getHistory: publicProcedure
      .input(z.object({ zoneId: z.number(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return getPricingHistory(input.zoneId, input.limit);
      }),

    /**
     * Preview fare calculation for given parameters
     */
    previewFare: publicProcedure
      .input(
        z.object({
          distanceKm: z.number().min(0),
          durationMinutes: z.number().min(0),
          cityName: z.string().default("الموصل"),
          vehicleType: z.enum(["sedan", "suv", "minivan"]).default("sedan"),
        })
      )
      .query(async ({ input }) => {
        return calculateFareDynamic(
          input.distanceKm,
          input.durationMinutes,
          input.cityName,
          input.vehicleType
        );
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
        nationalIdPhotoBackUrl: z.string().optional(),
        licensePhotoUrl: z.string().optional(),
        vehicleType: z.enum(["sedan", "suv", "minivan"]),
        vehiclePlate: z.string().optional(),
        vehicleModel: z.string().optional(),
        vehicleColor: z.string().optional(),
        vehicleYear: z.string().optional(),
        vehiclePhotoUrl: z.string().optional(),
        country: z.string().optional(),
        city: z.string().optional(),
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
        documentType: z.enum(["photo", "nationalId", "nationalIdBack", "license", "vehicle"]),
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
          isBlocked: (driver as any).isBlocked ?? false,
          blockReason: (driver as any).blockReason ?? null,
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
        const isDev = process.env.NODE_ENV !== "production" || process.env.SHOW_DEV_OTP === "true";
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

        // Check if driver is blocked
        if (driver.isBlocked) {
          throw new Error(driver.blockReason ?? "تم تعطيل حسابك من قِبَل الإدارة. للاستفسار تواصل مع الدعم.");
        }

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
            isBlocked: driver.isBlocked ?? false,
            blockReason: driver.blockReason ?? null,
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
          nationalIdPhotoUrl: d.nationalIdPhotoUrl ?? null,
          nationalIdPhotoBackUrl: d.nationalIdPhotoBackUrl ?? null,
          licensePhotoUrl: d.licensePhotoUrl ?? null,
          vehiclePhotoUrl: d.vehiclePhotoUrl ?? null,
          nationalId: d.nationalId ?? null,
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
        const isDev = process.env.NODE_ENV !== "production" || process.env.SHOW_DEV_OTP === "true";
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
        const isDev = process.env.NODE_ENV !== "production" || process.env.SHOW_DEV_OTP === "true";
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
    /**
     * Check passenger account status (blocked/active) - used for polling
     */
    checkStatus: publicProcedure
      .input(z.object({ passengerId: z.number() }))
      .query(async ({ input }) => {
        const p = await getPassengerById(input.passengerId);
        if (!p) return { isBlocked: false, blockReason: null };
        return { isBlocked: p.isBlocked ?? false, blockReason: (p as any).blockReason ?? null };
      }),
  }),

  // ─── Driver Wallet ───────────────────────────────────────────────────────────────────
  driverWallet: router({
    /**
     * Get driver wallet balance
     */
    getBalance: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => {
        const { getDriverWalletInfo } = await import("./db");
        return getDriverWalletInfo(input.driverId);
      }),
    /**
     * Get driver wallet transactions
     */
    getTransactions: publicProcedure
      .input(z.object({ driverId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const { getDriverWalletTransactions } = await import("./db");
        return getDriverWalletTransactions(input.driverId, input.limit ?? 50);
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
     * Get city rides with full details (passenger + driver info) and pagination
     */
    ridesDetailed: publicProcedure
      .input(z.object({
        page: z.number().default(0),
        pageSize: z.number().default(10),
        statusFilter: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getAllRidesWithDetails(input.page, input.pageSize, input.statusFilter);
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
              // Send real Push Notification to driver
              const driverPushToken = await getDriverPushToken(input.driverId);
              if (driverPushToken && driverPushToken.startsWith("ExponentPushToken[")) {
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({
                    to: driverPushToken,
                    sound: "default",
                    title: input.status === "approved" ? "✅ تم قبول طلبك كسائق!" : "❌ لم يتم قبول طلبك",
                    body: statusMsg,
                    data: { type: "driver_review", status: input.status, driverId: input.driverId },
                    priority: "high",
                  }),
                }).catch((err) => console.warn("[Push] Failed to notify driver of review:", err));
              } else {
                console.log(`[Driver Notification - No Token] ${d.name} (${d.phone}): ${statusMsg}`);
              }
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
    /**
     * Block or unblock a driver account
     */
    blockDriver: publicProcedure
      .input(z.object({
        driverId: z.number(),
        isBlocked: z.boolean(),
        blockReason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await (await import("./db")).getDb();
        if (!db) throw new Error("DB not available");
        const { drivers: driversTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(driversTable)
          .set({
            isBlocked: input.isBlocked,
            blockReason: input.isBlocked ? (input.blockReason ?? "تم تعطيل حسابك من قِبل الإدارة") : null,
            ...(input.isBlocked ? { isOnline: false, isAvailable: false } : {}),
          })
          .where(eq(driversTable.id, input.driverId));

        // Send Push notification to driver
        try {
          const pushToken = await getDriverPushToken(input.driverId);
          if (pushToken && pushToken.startsWith("ExponentPushToken[")) {
            const reason = input.blockReason ?? "تم تعطيل حسابك من قِبل الإدارة";
            const notification = input.isBlocked
              ? {
                  to: pushToken,
                  sound: "default" as const,
                  title: "🚫 تم تعطيل حسابك",
                  body: `السبب: ${reason}. للاستفسار تواصل مع الدعم.`,
                  data: { type: "account_blocked", blockReason: reason },
                  priority: "high" as const,
                }
              : {
                  to: pushToken,
                  sound: "default" as const,
                  title: "✅ تم تفعيل حسابك",
                  body: "تم إعادة تفعيل حسابك كسائق. يمكنك الآن استقبال الرحلات!",
                  data: { type: "account_unblocked" },
                  priority: "high" as const,
                };
            fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Accept": "application/json" },
              body: JSON.stringify(notification),
            }).catch((err) => console.warn("[Push] Failed to send block/unblock notification:", err));
          }
        } catch (e) {
          console.warn("[Push] Error sending block/unblock notification:", e);
        }

        return { success: true, message: input.isBlocked ? "تم تعطيل الحساب" : "تم تفعيل الحساب" };
      }),
    // Admin: All intercity trips
    intercityTrips: publicProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(async ({ input }) => {
        return getAllIntercityTripsAdmin(input.limit, input.offset);
      }),
    // Admin: Cancel intercity trip
    cancelIntercityTrip: publicProcedure
      .input(z.object({ tripId: z.number() }))
      .mutation(async ({ input }) => {
        await adminCancelIntercityTrip(input.tripId);
        return { success: true };
      }),
    // Admin: Get passengers for a specific intercity trip
    intercityTripPassengers: publicProcedure
      .input(z.object({ tripId: z.number() }))
      .query(async ({ input }) => {
        return getAdminTripPassengers(input.tripId);
      }),
    // Admin: Block/unblock passenger
    blockPassenger: publicProcedure
      .input(z.object({
        passengerId: z.number(),
        isBlocked: z.boolean(),
        blockReason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        const { passengers: passengersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(passengersTable)
          .set({
            isBlocked: input.isBlocked,
            blockReason: input.isBlocked ? (input.blockReason ?? "تم تعطيل حسابك من قِبل الإدارة") : null,
          })
          .where(eq(passengersTable.id, input.passengerId));
        // Send Push notification to passenger
        try {
          const pushToken = await getPassengerPushToken(input.passengerId);
          if (pushToken && pushToken.startsWith("ExponentPushToken[")) {
            const reason = input.blockReason ?? "تم تعطيل حسابك من قِبل الإدارة";
            const notification = input.isBlocked
              ? { to: pushToken, sound: "default" as const, title: "🚫 تم تعطيل حسابك", body: `السبب: ${reason}. للاستفسار تواصل مع الدعم.`, data: { type: "account_blocked", blockReason: reason }, priority: "high" as const }
              : { to: pushToken, sound: "default" as const, title: "✅ تم تفعيل حسابك", body: "تم إعادة تفعيل حسابك. يمكنك الآن استخدام التطبيق!", data: { type: "account_unblocked" }, priority: "high" as const };
            fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notification) }).catch(() => {});
          }
        } catch (e) { console.warn("[Push] passenger block notification error:", e); }
        return { success: true, message: input.isBlocked ? "تم تعطيل حساب المستخدم" : "تم تفعيل حساب المستخدم" };
      }),

    /**
     * Get driver's city rides history (admin view)
     */
    driverCityRides: publicProcedure
      .input(z.object({ driverId: z.number(), limit: z.number().default(100), fromDate: z.string().optional(), toDate: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { rides: [], totals: { count: 0, completed: 0, cancelled: 0, totalFare: 0, totalCommission: 0 } };
        const { rides: ridesTable, passengers, walletTransactions: walletTx } = await import("../drizzle/schema");
        const { eq, desc, and, gte, lte } = await import("drizzle-orm");
        const conditions: any[] = [eq(ridesTable.driverId, input.driverId)];
        if (input.fromDate) conditions.push(gte(ridesTable.createdAt, new Date(input.fromDate)));
        if (input.toDate) { const to = new Date(input.toDate); to.setHours(23,59,59,999); conditions.push(lte(ridesTable.createdAt, to)); }
        const ridesList = await db
          .select()
          .from(ridesTable)
          .where(and(...conditions))
          .orderBy(desc(ridesTable.createdAt))
          .limit(input.limit);
        // Enrich with passenger name and wallet transaction
        const enriched = await Promise.all(ridesList.map(async (r) => {
          let passengerName: string | null = null;
          let passengerPhone: string | null = null;
          try {
            const [p] = await db.select({ name: passengers.name, phone: passengers.phone }).from(passengers).where(eq(passengers.id, r.passengerId)).limit(1);
            passengerName = p?.name ?? null;
            passengerPhone = p?.phone ?? null;
          } catch {}
          let walletTxData: { amount: string; balanceBefore: string | null; balanceAfter: string | null; description: string | null } | null = null;
          try {
            const [tx] = await db.select({ amount: walletTx.amount, balanceBefore: walletTx.balanceBefore, balanceAfter: walletTx.balanceAfter, description: walletTx.description })
              .from(walletTx)
              .where(and(eq(walletTx.rideId, r.id), eq(walletTx.userType, "driver")))
              .limit(1);
            if (tx) walletTxData = { amount: tx.amount?.toString() ?? "0", balanceBefore: tx.balanceBefore?.toString() ?? null, balanceAfter: tx.balanceAfter?.toString() ?? null, description: tx.description ?? null };
          } catch {}
          return { ...r, passengerName, passengerPhone, walletTx: walletTxData };
        }));
        const completed = enriched.filter(r => r.status === 'completed');
        const totalFare = completed.reduce((s, r) => s + parseFloat(r.fare?.toString() ?? '0'), 0);
        const totalCommission = enriched.reduce((s, r) => s + parseFloat(r.walletTx?.amount ?? '0'), 0);
        return {
          rides: enriched,
          totals: { count: enriched.length, completed: completed.length, cancelled: enriched.filter(r => r.status === 'cancelled').length, totalFare: Math.round(totalFare), totalCommission: Math.round(totalCommission) }
        };
      }),

    /**
     * Get driver's intercity trips history (admin view)
     */
    driverIntercityTrips: publicProcedure
      .input(z.object({ driverId: z.number(), limit: z.number().default(100), fromDate: z.string().optional(), toDate: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { trips: [], totals: { count: 0, completed: 0, totalEarnings: 0, totalCommission: 0 } };
        const { intercityTrips: tripsTable, intercityBookings } = await import("../drizzle/schema");
        const { eq, desc, and, gte, lte } = await import("drizzle-orm");
        const conditions: any[] = [eq(tripsTable.driverId, input.driverId)];
        if (input.fromDate) conditions.push(gte(tripsTable.createdAt, new Date(input.fromDate)));
        if (input.toDate) { const to = new Date(input.toDate); to.setHours(23,59,59,999); conditions.push(lte(tripsTable.createdAt, to)); }
        const trips = await db
          .select()
          .from(tripsTable)
          .where(and(...conditions))
          .orderBy(desc(tripsTable.createdAt))
          .limit(input.limit);
        // Enrich with bookings count and total earnings
        const enriched = await Promise.all(trips.map(async (t) => {
          const bookings = await db.select().from(intercityBookings).where(eq(intercityBookings.tripId, t.id));
          const confirmedBookings = bookings.filter(b => b.status === "confirmed" || b.status === "completed");
          const totalEarnings = confirmedBookings.reduce((sum, b) => sum + parseFloat(b.totalPrice?.toString() ?? "0"), 0);
          const commission = Math.round(totalEarnings * 0.1 * 100) / 100;
          return { ...t, bookingsCount: bookings.length, confirmedBookings: confirmedBookings.length, totalEarnings: Math.round(totalEarnings), commission: Math.round(commission), passengers: confirmedBookings.map(b => ({ name: b.passengerName, phone: b.passengerPhone, seats: b.seatsBooked, price: b.totalPrice?.toString() })) };
        }));
        const totalEarningsAll = enriched.reduce((s, t) => s + (t.totalEarnings ?? 0), 0);
        const totalCommissionAll = enriched.reduce((s, t) => s + (t.commission ?? 0), 0);
        return {
          trips: enriched,
          totals: { count: enriched.length, completed: enriched.filter(t => t.status === 'completed').length, totalEarnings: Math.round(totalEarningsAll), totalCommission: Math.round(totalCommissionAll) }
        };
      }),

    /**
     * Get driver's parcel deliveries history (admin view)
     */
    driverParcelHistory: publicProcedure
      .input(z.object({ driverId: z.number(), limit: z.number().default(100), fromDate: z.string().optional(), toDate: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { parcels: [], totals: { count: 0, delivered: 0, cancelled: 0, totalRevenue: 0 } };
        const { parcels: parcelsTable } = await import("../drizzle/schema");
        const { eq, desc, and, gte, lte } = await import("drizzle-orm");
        const conditions: any[] = [eq(parcelsTable.driverId, input.driverId)];
        if (input.fromDate) conditions.push(gte(parcelsTable.createdAt, new Date(input.fromDate)));
        if (input.toDate) { const to = new Date(input.toDate); to.setHours(23,59,59,999); conditions.push(lte(parcelsTable.createdAt, to)); }
        const parcelsList = await db
          .select()
          .from(parcelsTable)
          .where(and(...conditions))
          .orderBy(desc(parcelsTable.createdAt))
          .limit(input.limit);
        const delivered = parcelsList.filter(p => p.status === 'delivered');
        const totalRevenue = delivered.reduce((s, p) => s + parseFloat(p.price?.toString() ?? '0'), 0);
        return {
          parcels: parcelsList,
          totals: { count: parcelsList.length, delivered: delivered.length, cancelled: parcelsList.filter(p => p.status === 'cancelled').length, totalRevenue: Math.round(totalRevenue) }
        };
      }),

    /**
     * Get passenger's city rides history (admin view)
     */
    passengerCityRides: publicProcedure
      .input(z.object({ passengerId: z.number(), limit: z.number().default(100), fromDate: z.string().optional(), toDate: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { rides: [], totals: { count: 0, completed: 0, cancelled: 0, totalFare: 0 } };
        const { rides: ridesTable, drivers } = await import("../drizzle/schema");
        const { eq, desc, and, gte, lte } = await import("drizzle-orm");
        const conditions: any[] = [eq(ridesTable.passengerId, input.passengerId)];
        if (input.fromDate) conditions.push(gte(ridesTable.createdAt, new Date(input.fromDate)));
        if (input.toDate) { const to = new Date(input.toDate); to.setHours(23,59,59,999); conditions.push(lte(ridesTable.createdAt, to)); }
        const ridesList = await db
          .select()
          .from(ridesTable)
          .where(and(...conditions))
          .orderBy(desc(ridesTable.createdAt))
          .limit(input.limit);
        const enriched = await Promise.all(ridesList.map(async (r) => {
          let driverName: string | null = null;
          let driverPhone: string | null = null;
          try {
            if (r.driverId) {
              const [d] = await db.select({ name: drivers.name, phone: drivers.phone }).from(drivers).where(eq(drivers.id, r.driverId)).limit(1);
              driverName = d?.name ?? null;
              driverPhone = d?.phone ?? null;
            }
          } catch {}
          return { ...r, driverName, driverPhone };
        }));
        const completed = enriched.filter(r => r.status === 'completed');
        const totalFare = completed.reduce((s, r) => s + parseFloat(r.fare?.toString() ?? '0'), 0);
        return {
          rides: enriched,
          totals: { count: enriched.length, completed: completed.length, cancelled: enriched.filter(r => r.status === 'cancelled').length, totalFare: Math.round(totalFare) }
        };
      }),

    /**
     * Get passenger's intercity bookings history (admin view)
     */
    passengerIntercityBookings: publicProcedure
      .input(z.object({ passengerId: z.number(), limit: z.number().default(100), fromDate: z.string().optional(), toDate: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { bookings: [], totals: { count: 0, completed: 0, cancelled: 0, totalSpent: 0 } };
        const { intercityBookings, intercityTrips: tripsTable, drivers } = await import("../drizzle/schema");
        const { eq, desc, and, gte, lte } = await import("drizzle-orm");
        const conditions: any[] = [eq(intercityBookings.passengerId, input.passengerId)];
        if (input.fromDate) conditions.push(gte(intercityBookings.createdAt, new Date(input.fromDate)));
        if (input.toDate) { const to = new Date(input.toDate); to.setHours(23,59,59,999); conditions.push(lte(intercityBookings.createdAt, to)); }
        const bookingsList = await db
          .select()
          .from(intercityBookings)
          .where(and(...conditions))
          .orderBy(desc(intercityBookings.createdAt))
          .limit(input.limit);
        const enriched = await Promise.all(bookingsList.map(async (b) => {
          let trip: any = null;
          let driverName: string | null = null;
          try {
            const [t] = await db.select().from(tripsTable).where(eq(tripsTable.id, b.tripId)).limit(1);
            trip = t ?? null;
            if (t?.driverId) {
              const [d] = await db.select({ name: drivers.name, phone: drivers.phone }).from(drivers).where(eq(drivers.id, t.driverId)).limit(1);
              driverName = d?.name ?? null;
            }
          } catch {}
          return { ...b, trip, driverName };
        }));
        const completed = enriched.filter(b => b.status === 'completed');
        const totalSpent = completed.reduce((s, b) => s + parseFloat(b.totalPrice?.toString() ?? '0'), 0);
        return {
          bookings: enriched,
          totals: { count: enriched.length, completed: completed.length, cancelled: enriched.filter(b => b.status === 'cancelled').length, totalSpent: Math.round(totalSpent) }
        };
      }),

    /**
     * Get passenger's parcel orders history (admin view)
     */
    passengerParcelHistory: publicProcedure
      .input(z.object({ passengerId: z.number(), limit: z.number().default(100), fromDate: z.string().optional(), toDate: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { parcels: [], totals: { count: 0, delivered: 0, cancelled: 0, totalSpent: 0 } };
        const { parcels: parcelsTable, drivers } = await import("../drizzle/schema");
        const { eq, desc, and, gte, lte } = await import("drizzle-orm");
        const conditions: any[] = [eq(parcelsTable.senderId, input.passengerId)];
        if (input.fromDate) conditions.push(gte(parcelsTable.createdAt, new Date(input.fromDate)));
        if (input.toDate) { const to = new Date(input.toDate); to.setHours(23,59,59,999); conditions.push(lte(parcelsTable.createdAt, to)); }
        const parcelsList = await db
          .select()
          .from(parcelsTable)
          .where(and(...conditions))
          .orderBy(desc(parcelsTable.createdAt))
          .limit(input.limit);
        const enriched = await Promise.all(parcelsList.map(async (p) => {
          let driverName: string | null = null;
          try {
            if (p.driverId) {
              const [d] = await db.select({ name: drivers.name, phone: drivers.phone }).from(drivers).where(eq(drivers.id, p.driverId)).limit(1);
              driverName = d?.name ?? null;
            }
          } catch {}
          return { ...p, driverName };
        }));
        const delivered = enriched.filter(p => p.status === 'delivered');
        const totalSpent = delivered.reduce((s, p) => s + parseFloat(p.price?.toString() ?? '0'), 0);
        return {
          parcels: enriched,
          totals: { count: enriched.length, delivered: delivered.length, cancelled: enriched.filter(p => p.status === 'cancelled').length, totalSpent: Math.round(totalSpent) }
        };
      }),
  }),
  // ─── Intercity Trips ───────────────────────────────────────────────────────────
  intercity: router({
    // السائق: جدولة رحلة جديدة
    scheduleTrip: publicProcedure
      .input(z.object({
        driverId: z.number(),
        fromCity: z.string().min(1),
        toCity: z.string().min(1),
        departureTime: z.string(), // ISO string
        totalSeats: z.number().min(1).max(20),
        pricePerSeat: z.number().min(0),
        meetingPoint: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const trip = await createIntercityTrip({
          driverId: input.driverId,
          fromCity: input.fromCity,
          toCity: input.toCity,
          departureTime: new Date(input.departureTime),
          totalSeats: input.totalSeats,
          pricePerSeat: input.pricePerSeat,
          meetingPoint: input.meetingPoint,
          notes: input.notes,
        });
        return { success: true, trip };
      }),

    // السائق: رحلاتي
    todayEarnings: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => {
        return getDriverIntercityTodayEarnings(input.driverId);
      }),
    myTrips: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => {
        return getDriverIntercityTrips(input.driverId);
      }),

    // السائق: إلغاء رحلة
    cancelTrip: publicProcedure
      .input(z.object({
        tripId: z.number(),
        driverId: z.number(),
        cancelReason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await cancelIntercityTrip(input.tripId, input.driverId, input.cancelReason);
        // إرسال Push Notification لجميع المسافرين المحجوزين
        if (result?.bookings && result.bookings.length > 0) {
          const trip = result.trip;
          const reasonText = input.cancelReason ? `\nسبب الإلغاء: ${input.cancelReason}` : "";
          for (const booking of result.bookings) {
            try {
              const passengerToken = await getPassengerPushToken(booking.passengerId);
              if (passengerToken && passengerToken.startsWith("ExponentPushToken[")) {
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({
                    to: passengerToken,
                    sound: "default",
                    title: "❌ تم إلغاء رحلتك",
                    body: `ألغى السائق رحلة ${trip.fromCity} → ${trip.toCity}${reasonText}`,
                    data: {
                      type: "trip_cancelled_by_driver",
                      tripId: trip.id,
                      fromCity: trip.fromCity,
                      toCity: trip.toCity,
                      cancelReason: input.cancelReason || null,
                    },
                    priority: "high",
                    badge: 1,
                  }),
                }).catch((err) => console.warn("[Push] Failed to notify passenger of trip cancellation:", err));
              }
            } catch (e) { console.warn("[Push] Error notifying passenger:", e); }
          }
        }
        return { success: true };
      }),

    // السائق: عرض الحجوزات على رحلته
    tripBookings: publicProcedure
      .input(z.object({ tripId: z.number(), driverId: z.number() }))
      .query(async ({ input }) => {
        return getTripBookings(input.tripId, input.driverId);
      }),

    // المستخدم: عرض الرحلات المتاحة
    listTrips: publicProcedure
      .input(z.object({
        fromCity: z.string().optional(),
        toCity: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getUpcomingIntercityTrips(input.fromCity, input.toCity);
      }),

    // المستخدم: حجز مقعد
    bookTrip: publicProcedure
      .input(z.object({
        tripId: z.number(),
        passengerId: z.number(),
        seatsBooked: z.number().min(1).max(10),
        passengerPhone: z.string(),
        passengerName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const passengerCheckIC = await getPassengerById(input.passengerId);
        if (passengerCheckIC && (passengerCheckIC as any).isBlocked) {
          throw new Error("🚫 تم تعطيل حسابك. لا يمكنك حجز رحلة.");
        }
        const booking = await bookIntercityTrip(input);
        // إرسال Push notification للكابتن
        console.log(`[Push] bookTrip: Attempting to send push notification for trip ${input.tripId}`);
        try {
          const db = await getDb();
          if (db) {
            const { intercityTrips: tripsTable } = await import("../drizzle/schema");
            const { eq: eqFn } = await import("drizzle-orm");
            const [trip] = await db
              .select({ driverId: tripsTable.driverId, fromCity: tripsTable.fromCity, toCity: tripsTable.toCity })
              .from(tripsTable)
              .where(eqFn(tripsTable.id, input.tripId))
              .limit(1);
            console.log(`[Push] bookTrip: Found trip driver ${trip?.driverId}`);
            if (trip?.driverId) {
              const pushToken = await getDriverPushToken(trip.driverId);
              console.log(`[Push] bookTrip: Driver ${trip.driverId} pushToken = ${pushToken ? pushToken.substring(0, 30) + '...' : 'NULL'}`);
              if (pushToken && pushToken.startsWith("ExponentPushToken[")) {
                console.log(`[Push] bookTrip: Sending push to Expo for driver ${trip.driverId}`);
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({
                    to: pushToken,
                    sound: "default",
                    title: "\uD83C\uDF89 حجز مقعد جديد!",
                    body: `${input.passengerName} حجز ${input.seatsBooked} مقعد في رحلتك ${trip.fromCity} ← ${trip.toCity}`,
                    data: { type: "intercity_booking", tripId: input.tripId },
                    priority: "high",
                  }),
                }).catch((err) => console.warn("[Push] intercity booking notification failed:", err));
              }
            }
          }
        } catch (e) {
          console.warn("[Push] Error sending intercity booking notification:", e);
        }
        return { success: true, booking };
      }),

    // المستخدم: حجوزاتي
    myBookings: publicProcedure
      .input(z.object({ passengerId: z.number() }))
      .query(async ({ input }) => {
        return getPassengerIntercityBookings(input.passengerId);
      }),

    // المستخدم: إلغاء حجز
    cancelBooking: publicProcedure
      .input(z.object({ bookingId: z.number(), passengerId: z.number() }))
      .mutation(async ({ input }) => {
        const result = await cancelIntercityBooking(input.bookingId, input.passengerId);
        // إذا كانت طريقة الدفع بالمحفظة: استرداد الأجرة للمستخدم
        if (result?.booking && (result.booking as any).paymentMethod === "wallet" && result.booking.totalPrice && Number(result.booking.totalPrice) > 0) {
          try {
            const { refundFareToPassenger } = await import("./db");
            await refundFareToPassenger(input.passengerId, Number(result.booking.totalPrice), input.bookingId, "إلغاء حجز رحلة بين المدن");
          } catch (e) { console.warn("[Wallet] Failed to refund intercity booking:", e); }
        }
        // إرسال إشعار للكابتن
        try {
          if (result?.booking?.tripId) {
            const db = await getDb();
            if (db) {
              const { intercityTrips: tripsTable } = await import("../drizzle/schema");
              const { eq: eqFn } = await import("drizzle-orm");
              const [trip] = await db.select({ driverId: tripsTable.driverId, fromCity: tripsTable.fromCity, toCity: tripsTable.toCity }).from(tripsTable).where(eqFn(tripsTable.id, result.booking.tripId)).limit(1);
              if (trip?.driverId) {
                const driverToken = await getDriverPushToken(trip.driverId);
                if (driverToken && driverToken.startsWith("ExponentPushToken[")) {
                  fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify({
                      to: driverToken,
                      sound: "default",
                      title: "❌ إلغاء حجز",
                      body: `ألغى المسافر ${result.booking.passengerName || ''} حجزه في رحلة ${trip.fromCity} → ${trip.toCity}`,
                      data: { type: "booking_cancelled", tripId: result.booking.tripId },
                      priority: "high",
                    }),
                  }).catch((err) => console.warn("[Push] Failed to notify driver of booking cancellation:", err));
                }
              }
            }
          }
        } catch (e) { console.warn("[Push] Error sending cancellation notification:", e); }
        return { success: true };
      }),
    // السائق: تحديث حالة الرحلة (انطلاق / اكتمال)
    updateTripStatus: publicProcedure
      .input(z.object({
        tripId: z.number(),
        driverId: z.number(),
        status: z.enum(["in_progress", "completed"]),
      }))
      .mutation(async ({ input }) => {
        await updateIntercityTripStatus(input.tripId, input.driverId, input.status);
        // خصم عمولة الشركة عند اكتمال الرحلة بين المدن
        if (input.status === "completed") {
          try {
            await deductIntercityCommission(input.driverId, input.tripId);
          } catch (e) { console.warn("[Commission] intercity deduction failed:", e); }
        }
        // إرسال إشعارات لجميع مسافري الرحلة
        try {
          const db = await getDb();
          if (db) {
            const { intercityTrips: tripsTable, intercityBookings: bookingsTable } = await import("../drizzle/schema");
            const { eq: eqFn, and: andFn, ne: neFn } = await import("drizzle-orm");
            const [trip] = await db.select({ fromCity: tripsTable.fromCity, toCity: tripsTable.toCity })
              .from(tripsTable).where(eqFn(tripsTable.id, input.tripId)).limit(1);
            const bookings = await db.select({ passengerId: bookingsTable.passengerId })
              .from(bookingsTable)
              .where(andFn(eqFn(bookingsTable.tripId, input.tripId), neFn(bookingsTable.status, "cancelled")));
            const route = `${trip?.fromCity || ''} → ${trip?.toCity || ''}`;
            const notifTitle = input.status === "in_progress" ? "🚗 انطلقت الرحلة" : "✅ وصلت الرحلة";
            const notifBody = input.status === "in_progress"
              ? `رحلة ${route} بدأت الآن`
              : `رحلة ${route} وصلت بنجاح`;
            for (const booking of bookings) {
              const token = await getPassengerPushToken(booking.passengerId);
              if (token && token.startsWith("ExponentPushToken[")) {
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({
                    to: token, sound: "default",
                    title: notifTitle, body: notifBody,
                    data: { type: `trip_${input.status}`, tripId: input.tripId },
                    priority: "high",
                  }),
                }).catch(() => {});
              }
            }
          }
        } catch (e) { console.warn("[Push] Error sending trip status notification:", e); }
        return { success: true };
      }),
    // تقييم الرحلة
    rateTrip: publicProcedure
      .input(z.object({
        bookingId: z.number(),
        raterId: z.number(),
        raterType: z.enum(["passenger", "driver"]),
        rating: z.number().min(1).max(5),
      }))
      .mutation(async ({ input }) => {
        await rateIntercityTrip(input);
        return { success: true };
      }),
    // المستخدم: حجز مع عنوان الاستلام
    bookTripWithPickup: publicProcedure
      .input(z.object({
        tripId: z.number(),
        passengerId: z.number(),
        seatsBooked: z.number().min(1).max(10),
        passengerPhone: z.string(),
        passengerName: z.string(),
        pickupAddress: z.string().optional(),
        pickupLat: z.number().optional(),
        pickupLng: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const booking = await bookIntercityTripWithPickup(input);
        // إرسال Push notification للكابتن
        try {
          const db = await getDb();
          if (db) {
            const { intercityTrips: tripsTable } = await import("../drizzle/schema");
            const { eq: eqFn } = await import("drizzle-orm");
            const [trip] = await db
              .select({ driverId: tripsTable.driverId, fromCity: tripsTable.fromCity, toCity: tripsTable.toCity })
              .from(tripsTable)
              .where(eqFn(tripsTable.id, input.tripId))
              .limit(1);
            if (trip?.driverId) {
              const pushToken = await getDriverPushToken(trip.driverId);
              if (pushToken && pushToken.startsWith("ExponentPushToken[")) {
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({
                    to: pushToken,
                    sound: "default",
                    title: "\uD83C\uDF89 حجز مقعد جديد!",
                    body: `${input.passengerName} حجز ${input.seatsBooked} مقعد في رحلتك ${trip.fromCity} → ${trip.toCity}`,
                    data: { type: "intercity_booking", tripId: input.tripId },
                    priority: "high",
                  }),
                }).catch((err) => console.warn("[Push] intercity bookTripWithPickup notification failed:", err));
              }
            }
          }
        } catch (e) {
          console.warn("[Push] Error sending intercity bookTripWithPickup notification:", e);
        }
        return { success: true, booking };
      }),
    // المستخدم: حجوزاتي مع تفاصيل الرحلة والسائق
    myBookingsEnriched: publicProcedure
      .input(z.object({ passengerId: z.number() }))
      .query(async ({ input }) => {
        return getPassengerIntercityBookingsWithTrip(input.passengerId);
      }),
    // المستخدم: حجز مع GPS إلزامي وملاحظة
    bookWithGPS: publicProcedure
      .input(z.object({
        tripId: z.number(),
        passengerId: z.number(),
        seatsBooked: z.number().min(1).max(10),
        passengerPhone: z.string(),
        passengerName: z.string(),
        pickupAddress: z.string().min(1),
        pickupLat: z.number(),
        pickupLng: z.number(),
        passengerNote: z.string().optional(),
        paymentMethod: z.enum(["cash", "wallet"]).default("cash").optional(),
      }))
      .mutation(async ({ input }) => {
        const booking = await bookIntercityWithGPS(input);
        // إرسال Push notification للكابتن
        try {
          const db = await getDb();
          if (db) {
            const { intercityTrips: tripsTable } = await import("../drizzle/schema");
            const { eq: eqFn } = await import("drizzle-orm");
            const [trip] = await db
              .select({ driverId: tripsTable.driverId, fromCity: tripsTable.fromCity, toCity: tripsTable.toCity })
              .from(tripsTable)
              .where(eqFn(tripsTable.id, input.tripId))
              .limit(1);
            if (trip?.driverId) {
              const pushToken = await getDriverPushToken(trip.driverId);
              if (pushToken && pushToken.startsWith("ExponentPushToken[")) {
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({
                    to: pushToken,
                    sound: "default",
                    title: "🎉 حجز مقعد جديد!",
                    body: `${input.passengerName} حجز ${input.seatsBooked} مقعد في رحلتك ${trip.fromCity} → ${trip.toCity}`,
                    data: { type: "intercity_booking", tripId: input.tripId },
                    priority: "high",
                  }),
                }).catch((err) => console.warn("[Push] intercity booking notification failed:", err));
              }
            }
          }
        } catch (e) {
          console.warn("[Push] Error sending intercity booking notification:", e);
        }
        return { success: true, booking };
      }),
    // الكابتن: قائمة مسافرين رحلة معينة
    tripPassengers: publicProcedure
      .input(z.object({ tripId: z.number(), driverId: z.number() }))
      .query(async ({ input }) => {
        return getDriverTripPassengers(input.tripId, input.driverId);
      }),
    // الكابتن: تحديث حالة راكب (في الانتظار / تم الالتقاط / وصل)
    updatePickupStatus: publicProcedure
      .input(z.object({
        bookingId: z.number(),
        driverId: z.number(),
        pickupStatus: z.enum(["waiting", "picked_up", "arrived"]),
      }))
      .mutation(async ({ input }) => {
        await updatePassengerPickupStatus(input.bookingId, input.driverId, input.pickupStatus);
        // عند وصول المسافر: تحديث حالة الحجز إلى completed وإرسال إشعار
        if (input.pickupStatus === "arrived") {
          try {
            const db = await getDb();
            if (db) {
              const { intercityBookings: bookingsTable, intercityTrips: tripsTable } = await import("../drizzle/schema");
              const { eq: eqFn } = await import("drizzle-orm");
              // تحديث حالة الحجز إلى completed
              const [booking] = await db.select().from(bookingsTable).where(eqFn(bookingsTable.id, input.bookingId)).limit(1);
              if (booking) {
                await db.update(bookingsTable).set({ status: "completed" } as any).where(eqFn(bookingsTable.id, input.bookingId));
                // إذا كانت طريقة الدفع بالمحفظة: تحويل الأجرة لمحفظة الكابتن
                const [trip] = await db.select({ fromCity: tripsTable.fromCity, toCity: tripsTable.toCity, driverId: tripsTable.driverId }).from(tripsTable).where(eqFn(tripsTable.id, booking.tripId)).limit(1);
                if ((booking as any).paymentMethod === "wallet" && booking.totalPrice && Number(booking.totalPrice) > 0 && trip?.driverId) {
                  try {
                    const { transferFareToDriver } = await import("./db");
                    await transferFareToDriver(trip.driverId, booking.passengerId, Number(booking.totalPrice), input.bookingId, "intercity");
                  } catch (e) {
                    console.warn("[Wallet] Failed to transfer intercity fare to driver:", e);
                  }
                }
                const passengerToken = await getPassengerPushToken(booking.passengerId);
                if (passengerToken && passengerToken.startsWith("ExponentPushToken[")) {
                  fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Accept": "application/json" },
                    body: JSON.stringify({
                      to: passengerToken,
                      sound: "default",
                      title: "✅ وصلت إلى وجهتك!",
                      body: `تمت رحلتك بنجاح من ${trip?.fromCity || ''} إلى ${trip?.toCity || ''}. شكراً لاختيارك مسار!`,
                      data: { type: "trip_completed", bookingId: input.bookingId },
                      priority: "high",
                    }),
                  }).catch((err) => console.warn("[Push] Failed to notify passenger of arrival:", err));
                }
              }
            }
          } catch (e) { console.warn("[Push] Error on arrived status update:", e); }
        }
        return { success: true };
      }),
    // الكابتن: تحديث حالة التوجه نحو راكب معين
    updateApproachStatus: publicProcedure
      .input(z.object({
        bookingId: z.number(),
        driverId: z.number(),
        status: z.enum(["idle", "heading", "arrived_at_pickup"]),
        // ETA اختياري يُرسله الكابتن عند الضغط على "التوجه إليه"
        etaMinutes: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await updateDriverApproachStatus(input.bookingId, input.driverId, input.status, input.etaMinutes);
        if (!result) return { success: false };
        // إرسال إشعار للمسافر
        console.log(`[Push] updateApproachStatus: status=${input.status}, passengerId=${result.booking.passengerId}`);
        try {
          const passengerToken = await getPassengerPushToken(result.booking.passengerId);
          console.log(`[Push] updateApproachStatus: Passenger ${result.booking.passengerId} pushToken = ${passengerToken ? passengerToken.substring(0, 30) + '...' : 'NULL'}`);
          if (passengerToken && passengerToken.startsWith("ExponentPushToken[")) {
            const isHeading = input.status === "heading";
            const isArrived = input.status === "arrived_at_pickup";
            if (isHeading || isArrived) {
              // بناء نص الإشعار مع ETA إذا كان متاحاً
              let headingBody: string;
              if (isHeading && input.etaMinutes && input.etaMinutes > 0) {
                headingBody = `السائق في طريقه إليك في رحلة ${result.trip.fromCity} → ${result.trip.toCity}. يصل خلال ${input.etaMinutes} دقيقة تقريباً، كن مستعداً!`;
              } else if (isHeading) {
                headingBody = `السائق يتجه نحوك في رحلة ${result.trip.fromCity} → ${result.trip.toCity}. كن مستعداً!`;
              } else {
                headingBody = `السائق وصل إلى موقعك في رحلة ${result.trip.fromCity} → ${result.trip.toCity}. توجه إليه الآن.`;
              }
              fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                  to: passengerToken,
                  sound: "default",
                  title: isHeading ? "🚗 السائق في طريقه إليك" : "📍 السائق وصل إلى موقعك!",
                  body: headingBody,
                  data: {
                    type: isHeading ? "driver_heading" : "driver_arrived_at_pickup",
                    bookingId: input.bookingId,
                    tripId: result.booking.tripId,
                    etaMinutes: input.etaMinutes,
                  },
                  priority: "high",
                }),
              }).catch((err) => console.warn("[Push] Failed to notify passenger of approach:", err));
            }
          }
        } catch (e) { console.warn("[Push] Error sending approach notification:", e); }
        return { success: true };
      }),
    // الكابتن: تحديث موقعه الجغرافي لحظياً
    updateDriverLocation: publicProcedure
      .input(z.object({
        tripId: z.number(),
        driverId: z.number(),
        lat: z.number(),
        lng: z.number(),
      }))
      .mutation(async ({ input }) => {
        await updateDriverLiveLocation(input.tripId, input.driverId, input.lat, input.lng);
        return { success: true };
      }),
    // المسافر: جلب موقع السائق لحظياً
    getDriverLocation: publicProcedure
      .input(z.object({ tripId: z.number() }))
      .query(async ({ input }) => {
        return getDriverLiveLocation(input.tripId);
      }),
    // المسافر: جلب حالة حجزه (driverApproachStatus)
    getBookingStatus: publicProcedure
      .input(z.object({ bookingId: z.number(), passengerId: z.number() }))
      .query(async ({ input }) => {
        return getPassengerBookingStatus(input.bookingId, input.passengerId);
      }),
    // ─── Chat Endpoints ───────────────────────────────────────────────────────
    // إرسال رسالة شات
    sendMessage: publicProcedure
      .input(z.object({
        bookingId: z.number(),
        tripId: z.number(),
        senderType: z.enum(["passenger", "driver"]),
        senderId: z.number(),
        message: z.string().min(1).max(1000),
      }))
      .mutation(async ({ input }) => {
        const msg = await sendIntercityMessage(input);
        // إرسال Push للطرف الآخر
        try {
          if (input.senderType === "driver") {
            // الكابتن أرسل → أشعر المسافر
            const [booking] = await (await getDb())!
              .select().from((await import("../drizzle/schema")).intercityBookings)
              .where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).intercityBookings.id, input.bookingId))
              .limit(1);
            if (booking?.passengerId) {
              const token = await getPassengerPushToken(booking.passengerId);
              if (token?.startsWith("ExponentPushToken[")) {
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: token, sound: "default",
                    title: "💬 رسالة جديدة من السائق",
                    body: input.message.length > 60 ? input.message.slice(0, 60) + "..." : input.message,
                    data: { type: "chat_message", bookingId: input.bookingId },
                    priority: "high",
                  }),
                }).catch(() => {});
              }
            }
          } else {
            // المسافر أرسل → أشعر الكابتن
            const [booking] = await (await getDb())!
              .select().from((await import("../drizzle/schema")).intercityBookings)
              .where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).intercityBookings.id, input.bookingId))
              .limit(1);
            if (booking?.tripId) {
              const [trip] = await (await getDb())!
                .select().from((await import("../drizzle/schema")).intercityTrips)
                .where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).intercityTrips.id, booking.tripId))
                .limit(1);
              if (trip?.driverId) {
                const token = await getDriverPushToken(trip.driverId);
                if (token?.startsWith("ExponentPushToken[")) {
                  fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      to: token, sound: "default",
                      title: "💬 رسالة جديدة من مسافر",
                      body: input.message.length > 60 ? input.message.slice(0, 60) + "..." : input.message,
                      data: { type: "chat_message", bookingId: input.bookingId },
                      priority: "high",
                    }),
                  }).catch(() => {});
                }
              }
            }
          }
        } catch (e) { console.warn("[Chat Push] Error:", e); }
        return msg;
      }),

    // جلب رسائل حجز معين
    getMessages: publicProcedure
      .input(z.object({ bookingId: z.number() }))
      .query(async ({ input }) => {
        return getIntercityMessages(input.bookingId);
      }),

    // تحديد الرسائل كمقروءة
    markRead: publicProcedure
      .input(z.object({ bookingId: z.number(), readerType: z.enum(["passenger", "driver"]) }))
      .mutation(async ({ input }) => {
        await markIntercityMessagesRead(input.bookingId, input.readerType);
        return { success: true };
      }),

    // عدد الرسائل غير المقروءة
    unreadCount: publicProcedure
      .input(z.object({ bookingId: z.number(), readerType: z.enum(["passenger", "driver"]) }))
      .query(async ({ input }) => {
        const count = await countUnreadIntercityMessages(input.bookingId, input.readerType);
        return { count };
      }),

    // جلب كل رسائل رحلة معينة (للأدمن)
    getTripMessages: publicProcedure
      .input(z.object({ tripId: z.number() }))
      .query(async ({ input }) => {
        return getIntercityTripMessages(input.tripId);
      }),

    // الكابتن: إلغاء حجز راكب معين
    cancelPassenger: publicProcedure
      .input(z.object({ bookingId: z.number(), driverId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }) => {
        const result = await cancelPassengerByDriver(input.bookingId, input.driverId, input.reason);
        // إرسال إشعار للمسافر
        try {
          if (result?.booking?.passengerId) {
            const tripInfo = result.trip;
            const passengerToken = await getPassengerPushToken(result.booking.passengerId);
            if (passengerToken && passengerToken.startsWith("ExponentPushToken[")) {
              const reasonText = input.reason ? ` — سبب: ${input.reason}` : '';
              fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({
                  to: passengerToken,
                  sound: "default",
                  title: "❌ تم إلغاء حجزك",
                  body: `ألغى السائق حجزك في رحلة ${tripInfo?.fromCity || ''} → ${tripInfo?.toCity || ''}${reasonText}`,
                  data: { type: "booking_cancelled_by_driver", tripId: result.booking.tripId, reason: input.reason },
                  priority: "high",
                }),
              }).catch((err) => console.warn("[Push] Failed to notify passenger of cancellation:", err));
            }
          }
        } catch (e) { console.warn("[Push] Error sending passenger cancellation notification:", e); }
        return { success: true };
      }),
  }),

  // ─── Support ──────────────────────────────────────────────────────────────────
  support: router({
    // إنشاء تذكرة دعم جديدة
    createTicket: publicProcedure
      .input(z.object({
        userId: z.number(),
        userType: z.enum(["passenger", "driver"]),
        userName: z.string().optional(),
        userPhone: z.string().optional(),
        category: z.enum(["payment", "ride", "account", "driver", "passenger", "app", "other"]).default("other"),
        subject: z.string().min(3).max(200),
        message: z.string().min(5), // الرسالة الأولى
        rideId: z.number().optional(),
        tripId: z.number().optional(),
        imageUrls: z.array(z.string()).max(6).optional(), // صور مرفقة اختيارية (حد أقصى 6)
      }))
      .mutation(async ({ input }) => {
        const ticketId = await createSupportTicket({
          userId: input.userId,
          userType: input.userType,
          userName: input.userName,
          userPhone: input.userPhone,
          category: input.category,
          subject: input.subject,
          rideId: input.rideId,
          tripId: input.tripId,
          status: "open",
          priority: "medium",
          unreadByAdmin: 1,
          unreadByUser: 0,
        });
        if (ticketId) {
          // إرسال الرسالة النصية أولاً (منفصلة تماماً عن الصور)
          await addSupportMessage({
            ticketId,
            senderType: "user",
            senderName: input.userName,
            message: input.message,
            imageUrl: undefined,
          });
          // إرسال كل صورة كرسالة منفصلة (بدون نص معها)
          const imageUrls = input.imageUrls ?? [];
          for (const imgUrl of imageUrls) {
            await addSupportMessage({
              ticketId,
              senderType: "user",
              senderName: input.userName,
              message: "",
              imageUrl: imgUrl,
            });
          }
        }
        return { success: true, ticketId };
      }),

    // جلب تذاكر مستخدم معين
    getUserTickets: publicProcedure
      .input(z.object({
        userId: z.number(),
        userType: z.enum(["passenger", "driver"]),
      }))
      .query(async ({ input }) => {
        return getUserSupportTickets(input.userId, input.userType);
      }),

    // جلب رسائل تذكرة
    getMessages: publicProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ input }) => {
        return getSupportMessages(input.ticketId);
      }),

    // رفع صورة في محادثة الدعم الفني
    uploadImage: publicProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const key = `support/images/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { success: true, url };
      }),

    // إرسال رسالة من المستخدم
    sendMessage: publicProcedure
      .input(z.object({
        ticketId: z.number(),
        senderType: z.enum(["user", "admin"]),
        senderName: z.string().optional(),
        message: z.string(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const msgId = await addSupportMessage({
          ticketId: input.ticketId,
          senderType: input.senderType,
          senderName: input.senderName,
          message: input.message || "",
          imageUrl: input.imageUrl,
        });
        // إرسال إشعار Push للمستخدم عند رد الإدارة
        if (input.senderType === "admin") {
          try {
            const ticket = await getSupportTicketById(input.ticketId);
            if (ticket) {
              let pushToken: string | null = null;
              if (ticket.userType === "passenger") {
                pushToken = await getPassengerPushToken(ticket.userId);
              } else {
                pushToken = await getDriverPushToken(ticket.userId);
              }
              if (pushToken && pushToken.startsWith("ExponentPushToken[")) {
                fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Accept": "application/json" },
                  body: JSON.stringify({
                    to: pushToken,
                    sound: "default",
                    title: "💬 رد من الدعم الفني",
                    body: input.message.length > 80 ? input.message.substring(0, 80) + "..." : input.message,
                    data: { type: "support_reply", ticketId: input.ticketId },
                    priority: "high",
                  }),
                }).catch((err) => console.warn("[Push] Failed to notify user of support reply:", err));
              }
            }
          } catch (e) { console.warn("[Push] Error sending support reply notification:", e); }
        }
        return { success: true, messageId: msgId };
      }),

    // تحديد الرسائل كمقروءة
    markRead: publicProcedure
      .input(z.object({
        ticketId: z.number(),
        readerType: z.enum(["admin", "user"]),
      }))
      .mutation(async ({ input }) => {
        await markSupportMessagesRead(input.ticketId, input.readerType);
        return { success: true };
      }),

    // ─── Admin only ───────────────────────────────────────────────────────────
    // جلب جميع التذاكر (لوحة التحكم)
    adminGetTickets: publicProcedure
      .input(z.object({
        status: z.enum(["open", "in_progress", "resolved", "closed", "all"]).default("all"),
        userType: z.enum(["passenger", "driver", "all"]).default("all"),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return getSupportTickets(input);
      }),

    // تحديث حالة التذكرة
    updateStatus: publicProcedure
      .input(z.object({
        ticketId: z.number(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]),
        closedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateSupportTicketStatus(input.ticketId, input.status, input.closedBy);
        return { success: true };
      }),

    // عدد الرسائل غير المقروءة للإدارة
    adminUnreadCount: publicProcedure
      .query(async () => {
        return { count: await getAdminUnreadSupportCount() };
      }),

    // جلب تذكرة واحدة
    getTicket: publicProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ input }) => {
        return getSupportTicketById(input.ticketId);
      }),

    // تقييم جودة الدعم بعد إغلاق التذكرة
    rateTicket: publicProcedure
      .input(z.object({
        ticketId: z.number(),
        rating: z.number().min(1).max(5),
        ratingComment: z.string().max(500).optional(),
      }))
      .mutation(async ({ input }) => {
        await rateSupportTicket(input.ticketId, input.rating, input.ratingComment);
        return { success: true };
      }),

    // إحصاءات التقييم للإدارة
    adminRatingStats: publicProcedure
      .query(async () => {
        return getSupportRatingStats();
      }),
  }),

  // ─── Agents (وكلاء معتمدون) ───────────────────────────────────────────────────
  agents: router({
    // رفع وثيقة وكيل
    uploadDocument: publicProcedure
      .input(z.object({
        passengerId: z.number(),
        documentType: z.enum(["face", "idFront", "idBack", "office"]),
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const key = `agents/${input.passengerId}/${input.documentType}_${Date.now()}.jpg`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { success: true, url };
      }),

    // تقديم طلب وكيل
    register: publicProcedure
      .input(z.object({
        passengerId: z.number(),
        phone: z.string(),
        name: z.string(),
        facePhotoUrl: z.string().optional(),
        idFrontUrl: z.string().optional(),
        idBackUrl: z.string().optional(),
        officePhotoUrl: z.string().optional(),
        officeAddress: z.string(),
        officeLatitude: z.number(),
        officeLongitude: z.number(),
      }))
      .mutation(async ({ input }) => {
        const agent = await applyForAgent(input);
        return { success: true, agent };
      }),

    // جلب حالة طلب الوكيل للمستخدم
    getMyStatus: publicProcedure
      .input(z.object({ passengerId: z.number() }))
      .query(async ({ input }) => {
        return getAgentByPassengerId(input.passengerId);
      }),

    // جلب قائمة الوكلاء (للإدارة)
    getAll: publicProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => {
        return getAllAgents(input.status);
      }),

    // الموافقة على وكيل
    approve: publicProcedure
      .input(z.object({
        agentId: z.number(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateAgentStatus(input.agentId, "approved", input.adminNotes);
        return { success: true };
      }),

    // رفض وكيل
    reject: publicProcedure
      .input(z.object({
        agentId: z.number(),
        rejectionReason: z.string(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateAgentStatus(input.agentId, "rejected", input.adminNotes, input.rejectionReason);
        return { success: true };
      }),

    // تعليق حساب وكيل
    suspend: publicProcedure
      .input(z.object({
        agentId: z.number(),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateAgentStatus(input.agentId, "suspended", input.adminNotes);
        return { success: true };
      }),

    // شحن رصيد وكيل (الإدارة)
    topup: publicProcedure
      .input(z.object({
        agentId: z.number(),
        amount: z.number().positive(),
      }))
      .mutation(async ({ input }) => {
        await rechargeAgentBalance(input.agentId, input.amount);
        return { success: true };
      }),

    // الوكيل يشحن رصيد كابتن أو مستخدم
    recharge: publicProcedure
      .input(z.object({
        agentId: z.number(),
        recipientType: z.enum(["driver", "passenger"]),
        recipientId: z.number(),
        amount: z.number().positive(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return agentRechargeWallet(
          input.agentId,
          input.recipientType,
          input.recipientId,
          input.amount,
          input.notes
        );
      }),

    // سجل معاملات الوكيل
    getTransactions: publicProcedure
      .input(z.object({ agentId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getAgentTransactions(input.agentId, input.limit);
      }),

    // جميع المعاملات (للإدارة)
    getAllTransactions: publicProcedure
      .query(async () => {
        return getAllAgentTransactions();
      }),

    // البحث عن مستخدم أو كابتن برقم الهاتف
    searchRecipient: publicProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        return searchRecipientByPhone(input.phone);
      }),
    // التقرير المالي الشهري للوكيل
    getMonthlyStats: publicProcedure
      .input(z.object({
        agentId: z.number(),
        months: z.number().min(1).max(24).optional(),
      }))
      .query(async ({ input }) => {
        return getAgentMonthlyStats(input.agentId, input.months ?? 6);
      }),
    // السجل المالي الكامل للوكيل (للإدارة)
    getFullLedger: publicProcedure
      .input(z.object({ agentId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getAgentFullLedger(input.agentId, input.limit ?? 200);
      }),

    // حذف حساب الوكيل نهائياً
    delete: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .mutation(async ({ input }) => {
        return deleteAgent(input.agentId);
      }),
  }),

  // ─── Parcel Delivery ───────────────────────────────────────────────────────────────
  parcel: router({
    create: publicProcedure
      .input(z.object({
        deliveryType: z.enum(["instant", "scheduled", "intercity"]),
        senderId: z.number(),
        senderName: z.string(),
        senderPhone: z.string(),
        recipientName: z.string(),
        recipientPhone: z.string(),
        pickupAddress: z.string(),
        pickupLat: z.number().optional(),
        pickupLng: z.number().optional(),
        dropoffAddress: z.string(),
        dropoffLat: z.number().optional(),
        dropoffLng: z.number().optional(),
        fromCity: z.string().optional(),
        toCity: z.string().optional(),
        parcelSize: z.enum(["small", "medium", "large"]),
        parcelDescription: z.string().optional(),
        parcelPhotoUrl: z.string().optional(),
        scheduledDate: z.string().optional(),
        scheduledTimeSlot: z.string().optional(),
        paymentMethod: z.enum(["cash", "wallet"]).default("cash").optional(),
        quotedFare: z.number().optional(), // السعر المحسوب مسبقاً وعرضه للمستخدم
      }))
      .mutation(async ({ input }) => {
        const passengerCheckP = await getPassengerById(input.senderId);
        if (passengerCheckP && (passengerCheckP as any).isBlocked) {
          throw new Error("🚫 تم تعطيل حسابك. لا يمكنك إرسال طرد.");
        }
        const { quotedFare, ...parcelData } = input;
        return createParcel({ ...parcelData, price: quotedFare });
      }),

    getById: publicProcedure
      .input(z.object({ parcelId: z.number() }))
      .query(async ({ input }) => getParcelById(input.parcelId)),

    getByTracking: publicProcedure
      .input(z.object({ trackingNumber: z.string() }))
      .query(async ({ input }) => getParcelByTracking(input.trackingNumber)),

    getSenderParcels: publicProcedure
      .input(z.object({ senderId: z.number() }))
      .query(async ({ input }) => getSenderParcels(input.senderId)),

    getPendingInstant: publicProcedure
      .query(async () => getPendingInstantParcels()),

    getDriverActive: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => getDriverActiveParcels(input.driverId)),
    getDriverAll: publicProcedure
      .input(z.object({ driverId: z.number(), page: z.number().optional(), limit: z.number().optional() }))
      .query(async ({ input }) => getDriverAllParcels(input.driverId, input.page ?? 0, input.limit ?? 20)),
    accept: publicProcedure
      .input(z.object({ parcelId: z.number(), driverId: z.number(), price: z.number() }))
      .mutation(async ({ input }) => {
        // ─── التحقق من رصيد المحفظة قبل قبول الطرد ───
        const balanceCheck = await checkDriverBalanceSufficient(input.driverId);
        if (!balanceCheck.sufficient) {
          return { success: false, reason: "insufficient_balance", balance: balanceCheck.balance, minimum: balanceCheck.minRequired };
        }
        await acceptParcel(input.parcelId, input.driverId, input.price);
        return { success: true };
      }),

    updateStatus: publicProcedure
      .input(z.object({
        parcelId: z.number(),
        status: z.enum(["picked_up", "in_transit", "delivered", "cancelled", "returned"]),
        updatedBy: z.enum(["driver", "agent", "admin"]),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateParcelStatus(input.parcelId, input.status, input.updatedBy, input.note);
        // خصم عمولة الشركة عند تسليم الطرد
        if (input.status === "delivered") {
          try {
            const db = await getDb();
            if (db) {
              const { parcels: parcelsTable } = await import("../drizzle/schema");
              const { eq: eqFn } = await import("drizzle-orm");
              const [parcel] = await db.select({ driverId: parcelsTable.driverId, price: parcelsTable.price })
                .from(parcelsTable).where(eqFn(parcelsTable.id, input.parcelId)).limit(1);
              if (parcel?.driverId && parcel?.price) {
                await deductParcelCommission(parcel.driverId, input.parcelId, parseFloat(parcel.price.toString()));
              }
            }
          } catch (e) { console.warn("[Commission] parcel deduction failed:", e); }
        }
        return { success: true };
      }),

    verifyOtp: publicProcedure
      .input(z.object({ parcelId: z.number(), otp: z.string() }))
      .mutation(async ({ input }) => {
        const result = await verifyParcelDeliveryOtp(input.parcelId, input.otp);
        // خصم عمولة الشركة عند تأكيد التسليم بـ OTP
        if (result?.success) {
          try {
            const db = await getDb();
            if (db) {
              const { parcels: parcelsTable } = await import("../drizzle/schema");
              const { eq: eqFn } = await import("drizzle-orm");
              const [parcel] = await db.select({ driverId: parcelsTable.driverId, price: parcelsTable.price })
                .from(parcelsTable).where(eqFn(parcelsTable.id, input.parcelId)).limit(1);
              if (parcel?.driverId && parcel?.price) {
                await deductParcelCommission(parcel.driverId, input.parcelId, parseFloat(parcel.price.toString()));
              }
            }
          } catch (e) { console.warn("[Commission] parcel OTP deduction failed:", e); }
        }
        return result;
      }),

    getStatusLogs: publicProcedure
      .input(z.object({ parcelId: z.number() }))
      .query(async ({ input }) => getParcelStatusLogs(input.parcelId)),

    getActiveAgents: publicProcedure
      .input(z.object({ fromCity: z.string() }))
      .query(async ({ input }) => getActiveParcelAgents(input.fromCity)),

    admin: router({
      getAll: publicProcedure
        .input(z.object({
          deliveryType: z.string().optional(),
          status: z.string().optional(),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
          search: z.string().optional(),
          page: z.number().optional(),
          limit: z.number().optional(),
        }).optional())
        .query(async ({ input }) => getAdminParcels(input ?? {})),

      getStats: publicProcedure
        .query(async () => getParcelStats()),

      getAgents: publicProcedure
        .query(async () => getAllParcelAgents()),

      createAgent: publicProcedure
        .input(z.object({
          name: z.string(),
          phone: z.string(),
          companyName: z.string().optional(),
          city: z.string(),
          username: z.string(),
          passwordHash: z.string(),
          coveredCities: z.string().optional(),
          pickupTime: z.string().optional(),
          pickupDays: z.string().optional(),
          pricingJson: z.string().optional(),
        }))
        .mutation(async ({ input }) => { const id = await createParcelAgent(input); return { success: true, id }; }),

      updateAgentStatus: publicProcedure
        .input(z.object({ agentId: z.number(), isActive: z.boolean() }))
        .mutation(async ({ input }) => { await updateParcelAgentStatus(input.agentId, input.isActive); return { success: true }; }),
    }),
  }),

  // ─── Commission Management ────────────────────────────────────────────────
  commission: router({
    getSettings: publicProcedure
      .query(async () => getCommissionSettings()),
    updateSetting: publicProcedure
      .input(z.object({
        serviceType: z.enum(["city_ride", "intercity", "parcel"]),
        commissionRate: z.number().min(0).max(100),
        updatedBy: z.number().optional(),
      }))
      .mutation(async ({ input }) => updateCommissionSetting(input.serviceType, input.commissionRate, input.updatedBy)),
    getAllOverrides: publicProcedure
      .query(async () => getAllDriverCommissionOverrides()),
    getDriverOverrides: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => getDriverCommissionOverrides(input.driverId)),
    setDriverOverride: publicProcedure
      .input(z.object({
        driverId: z.number(),
        serviceType: z.enum(["city_ride", "intercity", "parcel"]),
        commissionRate: z.number().min(0).max(100),
        reason: z.string().optional(),
        updatedBy: z.number().optional(),
      }))
      .mutation(async ({ input }) =>
        setDriverCommissionOverride(input.driverId, input.serviceType, input.commissionRate, input.reason, input.updatedBy)
      ),
    deleteDriverOverride: publicProcedure
      .input(z.object({
        driverId: z.number(),
        serviceType: z.enum(["city_ride", "intercity", "parcel"]),
      }))
      .mutation(async ({ input }) => deleteDriverCommissionOverride(input.driverId, input.serviceType)),
  }),

  // ─── User Discounts Management ────────────────────────────────────────────
  discounts: router({
    getAll: publicProcedure
      .input(z.object({
        passengerId: z.number().optional(),
        discountType: z.string().optional(),
        isActive: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => getAllUserDiscounts(input ?? {})),
    create: publicProcedure
      .input(z.object({
        passengerId: z.number(),
        discountType: z.enum(["free_rides", "percentage", "fixed_amount"]),
        totalFreeRides: z.number().optional(),
        discountValue: z.number().optional(),
        applicableServices: z.string().optional(),
        validUntil: z.string().optional(),
        reason: z.string().optional(),
        createdBy: z.number().optional(),
      }))
      .mutation(async ({ input }) => createUserDiscount({
        ...input,
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      })),
    createBulk: publicProcedure
      .input(z.object({
        passengerIds: z.array(z.number()),
        discountType: z.enum(["free_rides", "percentage", "fixed_amount"]),
        totalFreeRides: z.number().optional(),
        discountValue: z.number().optional(),
        applicableServices: z.string().optional(),
        validUntil: z.string().optional(),
        reason: z.string().optional(),
        createdBy: z.number().optional(),
      }))
      .mutation(async ({ input }) => createBulkUserDiscounts({
        ...input,
        validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      })),
    deactivate: publicProcedure
      .input(z.object({ discountId: z.number() }))
      .mutation(async ({ input }) => deactivateUserDiscount(input.discountId)),
  }),

  // ─── Wallet Topup Requests ───────────────────────────────────────────────────────────────
  wallet: router({
    // إنشاء طلب شحن رصيد (من كابتن أو مستخدم)
    requestTopup: publicProcedure
      .input(z.object({
        userId: z.number(),
        userType: z.enum(["driver", "passenger"]),
        paymentMethod: z.enum(["mastercard", "zaincash", "fib"]),
        amount: z.number().min(1000).max(10000000),
        receiptUrl: z.string().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => createWalletTopupRequest(input)),

    // جلب طلبات شحن الرصيد (للإدارة)
    getRequests: publicProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        userType: z.enum(["driver", "passenger"]).optional(),
        page: z.number().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => getWalletTopupRequests(input ?? {})),

    // جلب طلبات شحن مستخدم معين
    getUserRequests: publicProcedure
      .input(z.object({ userId: z.number(), userType: z.enum(["driver", "passenger"]) }))
      .query(async ({ input }) => getUserWalletTopupRequests(input.userId, input.userType)),

    // الموافقة على طلب شحن الرصيد
    approve: publicProcedure
      .input(z.object({ requestId: z.number(), reviewedBy: z.number().optional() }))
      .mutation(async ({ input }) => approveWalletTopupRequest(input.requestId, input.reviewedBy)),

    // رفض طلب شحن الرصيد
    reject: publicProcedure
      .input(z.object({ requestId: z.number(), adminNote: z.string().optional(), reviewedBy: z.number().optional() }))
      .mutation(async ({ input }) => rejectWalletTopupRequest(input.requestId, input.adminNote, input.reviewedBy)),

    // جلب إعدادات طرق الدفع
    getPaymentMethods: publicProcedure
      .query(async () => getPaymentMethodSettings()),

    // تحديث إعدادات طريقة دفع
    updatePaymentMethod: publicProcedure
      .input(z.object({
        method: z.enum(["mastercard", "zaincash", "fib"]),
        displayName: z.string().optional(),
        accountNumber: z.string().optional(),
        accountName: z.string().optional(),
        instructions: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => updatePaymentMethodSetting(input.method, input)),

    // تقرير العمولات
    getCommissionReport: publicProcedure
      .input(z.object({ fromDate: z.string().optional(), toDate: z.string().optional() }).optional())
      .query(async ({ input }) => getCommissionReport({
        fromDate: input?.fromDate ? new Date(input.fromDate) : undefined,
        toDate: input?.toDate ? new Date(input.toDate) : undefined,
      })),
    // التحقق من رصيد الكابتن
    checkDriverBalance: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => checkDriverBalanceSufficient(input.driverId)),
  }),

  // ─── Maps / OSRM Routing (server-side proxy) ─────────────────────────────
  maps: router({
    /** جلب مسار حقيقي واحد عبر Mapbox Directions API */
    getRoute: publicProcedure
      .input(z.object({
        fromLat: z.number(),
        fromLng: z.number(),
        toLat: z.number(),
        toLng: z.number(),
      }))
      .query(async ({ input }) => {
        const { fromLat, fromLng, toLat, toLng } = input;
        const token = process.env.MAPBOX_ACCESS_TOKEN;
        if (!token) return { coords: [], distanceKm: 0, durationMin: 0 };
        const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${token}&geometries=geojson&overview=full`;
        try {
          const res = await fetch(mapboxUrl, { signal: AbortSignal.timeout(10000) });
          if (!res.ok) return { coords: [], distanceKm: 0, durationMin: 0 };
          const data = await res.json() as {
            routes: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }>;
          };
          if (!data.routes?.[0]) return { coords: [], distanceKm: 0, durationMin: 0 };
          const route = data.routes[0];
          return {
            coords: route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })),
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
            durationMin: Math.round(route.duration / 60),
          };
        } catch {
          return { coords: [], distanceKm: 0, durationMin: 0 };
        }
      }),

    /** جلب مسارين حقيقيين عبر Mapbox: السائق→الراكب + الراكب→الوجهة */
    getDualRoute: publicProcedure
      .input(z.object({
        driverLat: z.number(),
        driverLng: z.number(),
        pickupLat: z.number(),
        pickupLng: z.number(),
        dropoffLat: z.number(),
        dropoffLng: z.number(),
      }))
      .query(async ({ input }) => {
        const { driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng } = input;
        const token = process.env.MAPBOX_ACCESS_TOKEN;
        if (!token) return {
          toPickup: { coords: [], distanceKm: 0, durationMin: 0 },
          toDropoff: { coords: [], distanceKm: 0, durationMin: 0 },
        };
        const fetchMapboxRoute = async (fLat: number, fLng: number, tLat: number, tLng: number) => {
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fLng},${fLat};${tLng},${tLat}?access_token=${token}&geometries=geojson&overview=full`;
          try {
            const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (!r.ok) return null;
            const d = await r.json() as { routes: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }> };
            if (!d.routes?.[0]) return null;
            const rt = d.routes[0];
            return {
              coords: rt.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })),
              distanceKm: Math.round((rt.distance / 1000) * 10) / 10,
              durationMin: Math.round(rt.duration / 60),
            };
          } catch { return null; }
        };
        const [toPickup, toDropoff] = await Promise.all([
          fetchMapboxRoute(driverLat, driverLng, pickupLat, pickupLng),
          fetchMapboxRoute(pickupLat, pickupLng, dropoffLat, dropoffLng),
        ]);
        return {
          toPickup: toPickup ?? { coords: [], distanceKm: 0, durationMin: 0 },
          toDropoff: toDropoff ?? { coords: [], distanceKm: 0, durationMin: 0 },
        };
      }),
  }),
  // ─── App Settings (Global Promotions & Config) ─────────────────────────────
  settings: router({
    getAll: publicProcedure
      .query(async () => getAllAppSettings()),
    get: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        const value = await getAppSetting(input.key);
        return { key: input.key, value };
      }),
    set: publicProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(async ({ input }) => {
        await setAppSetting(input.key, input.value);
        return { success: true };
      }),
    setBulk: publicProcedure
      .input(z.array(z.object({ key: z.string(), value: z.string() })))
      .mutation(async ({ input }) => {
        for (const { key, value } of input) {
          await setAppSetting(key, value);
        }
        return { success: true, updated: input.length };
      }),
  }),
  voice: router({
    transcribe: publicProcedure
      .input(z.object({
        audioUrl: z.string().url(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: input.language ?? "ar",
          prompt: "اسم منطقة أو شارع أو مكان في مدينة عراقية",
        });
        if ("error" in result) {
          throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
        }
        return { text: result.text.trim(), language: result.language };
      }),
  }),
});
export type AppRouter = typeof appRouter;

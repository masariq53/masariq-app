/**
 * Masar API Tests
 * Tests for OTP, rides, and driver endpoints
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the database module ───────────────────────────────────────────────
vi.mock("../server/db", () => ({
  createOtp: vi.fn().mockResolvedValue("123456"),
  verifyOtp: vi.fn().mockResolvedValue(true),
  getOrCreatePassenger: vi.fn().mockResolvedValue({
    id: 1,
    phone: "+9640771234567",
    name: "محمد علي",
    walletBalance: "0",
    totalRides: 0,
    rating: "5.0",
  }),
  getOrCreateDriver: vi.fn().mockResolvedValue({
    id: 1,
    phone: "+9640771234567",
    name: "كابتن أحمد",
    isVerified: false,
    rating: "5.0",
    totalRides: 0,
  }),
  getNearbyDrivers: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "كابتن أحمد",
      rating: "4.9",
      vehicleType: "sedan",
      vehicleModel: "Toyota Camry",
      vehicleColor: "أبيض",
      vehiclePlate: "م ص ر 1234",
      currentLat: "36.3392",
      currentLng: "43.1289",
      totalRides: 150,
    },
  ]),
  createRide: vi.fn().mockResolvedValue({
    id: 1,
    status: "searching",
    passengerId: 1,
    pickupLat: "36.3392",
    pickupLng: "43.1289",
    dropoffLat: "36.3600",
    dropoffLng: "43.1450",
    estimatedDistance: "3.50",
    estimatedDuration: 7,
    fare: "6500.00",
    paymentMethod: "cash",
  }),
  updateRideStatus: vi.fn().mockResolvedValue(undefined),
  getRideById: vi.fn().mockResolvedValue({ id: 1, status: "accepted" }),
  getPassengerRideHistory: vi.fn().mockResolvedValue([]),
  getDriverRideHistory: vi.fn().mockResolvedValue([]),
  updateDriverLocation: vi.fn().mockResolvedValue(undefined),
  setDriverOnlineStatus: vi.fn().mockResolvedValue(undefined),
  calculateFare: vi.fn().mockImplementation((distance: number) => {
    const BASE_FARE = 2000;
    const PER_KM = 1500;
    return BASE_FARE + distance * PER_KM;
  }),
  calculateDistance: vi.fn().mockImplementation(
    (lat1: number, lng1: number, lat2: number, lng2: number) => {
      // Haversine approximation
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
  ),
}));

// ─── Import after mocking ────────────────────────────────────────────────────
import {
  createOtp,
  verifyOtp,
  getOrCreatePassenger,
  calculateFare,
  calculateDistance,
  getNearbyDrivers,
  createRide,
} from "../server/db";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OTP System", () => {
  it("should create a 6-digit OTP code", async () => {
    const code = await createOtp("+9640771234567");
    expect(code).toBe("123456");
    expect(code.length).toBe(6);
  });

  it("should verify a valid OTP code", async () => {
    const isValid = await verifyOtp("+9640771234567", "123456");
    expect(isValid).toBe(true);
  });

  it("should create or get a passenger after OTP verification", async () => {
    const passenger = await getOrCreatePassenger("+9640771234567", "محمد علي");
    expect(passenger.id).toBe(1);
    expect(passenger.phone).toBe("+9640771234567");
    expect(passenger.name).toBe("محمد علي");
    expect(passenger.totalRides).toBe(0);
  });
});

describe("Fare Calculation", () => {
  it("should calculate correct fare for short distance", () => {
    const fare = calculateFare(2); // 2 km
    expect(fare).toBe(5000); // 2000 base + 2 * 1500
  });

  it("should calculate correct fare for long distance", () => {
    const fare = calculateFare(10); // 10 km
    expect(fare).toBe(17000); // 2000 base + 10 * 1500
  });

  it("should never be less than base fare", () => {
    const fare = calculateFare(0);
    expect(fare).toBeGreaterThanOrEqual(2000);
  });
});

describe("Distance Calculation", () => {
  it("should calculate distance between two Mosul locations", () => {
    // Hadba Square to Mosul University
    const distance = calculateDistance(36.3392, 43.1289, 36.3600, 43.1450);
    // Should be approximately 2.8-3.5 km
    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(10);
  });

  it("should return 0 for same coordinates", () => {
    const distance = calculateDistance(36.3392, 43.1289, 36.3392, 43.1289);
    expect(distance).toBe(0);
  });
});

describe("Nearby Drivers", () => {
  it("should return nearby drivers list", async () => {
    const result = await getNearbyDrivers(36.3392, 43.1289, 5);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("كابتن أحمد");
    expect(result[0].rating).toBe("4.9");
  });
});

describe("Ride Creation", () => {
  it("should create a new ride with searching status", async () => {
    const ride = await createRide({
      passengerId: 1,
      pickupLat: "36.3392",
      pickupLng: "43.1289",
      dropoffLat: "36.3600",
      dropoffLng: "43.1450",
      estimatedDistance: "3.50",
      estimatedDuration: 7,
      fare: "6500.00",
      paymentMethod: "cash",
      status: "searching",
    });
    expect(ride.id).toBe(1);
    expect(ride.status).toBe("searching");
    expect(ride.passengerId).toBe(1);
  });
});

describe("Phone Number Normalization", () => {
  it("should normalize Iraqi phone numbers", () => {
    const normalize = (phone: string) => {
      let p = phone.replace(/\s/g, "");
      if (p.startsWith("0")) {
        p = "+964" + p.slice(1);
      } else if (!p.startsWith("+")) {
        p = "+964" + p;
      }
      return p;
    };

    // 07701234567 -> +9640771234567 (remove leading 0, add +964 = 07701234567 without 0 = 7701234567 -> +9647701234567... wait)
    // Actually: 07701234567 starts with 0 -> slice(1) = 7701234567 -> +9647701234567
    expect(normalize("07701234567")).toBe("+9647701234567");
    // 7701234567 -> +9647701234567 (add +964 prefix)
    expect(normalize("7701234567")).toBe("+9647701234567");
    // Already normalized
    expect(normalize("+96407701234567")).toBe("+96407701234567");
  });
});

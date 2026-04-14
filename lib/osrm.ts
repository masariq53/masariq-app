/**
 * OSRM Routing Utility
 * Routes all requests through the app server (server-side OSRM fetch)
 * to avoid mobile network issues, timeouts, and ISP blocking.
 *
 * The server fetches from router.project-osrm.org (fast server-to-server)
 * and returns the real road-based polyline to the app.
 *
 * Cache strategy:
 * - Routes are cached by a key derived from rounded coordinates (±~11m precision)
 * - Cache TTL: 5 minutes (routes don't change that fast)
 * - Max cache size: 20 entries (auto-evicts oldest)
 */
import { getApiBaseUrl } from "@/constants/oauth";

export type LatLng = { latitude: number; longitude: number };

export type OsrmRouteResult = {
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
};

// ─── In-memory route cache ────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 دقائق
const CACHE_MAX_SIZE = 20;

type CacheEntry = {
  result: OsrmRouteResult;
  fetchedAt: number;
};

const routeCache = new Map<string, CacheEntry>();

/**
 * تقريب الإحداثيات لـ ~11 متر (4 خانات عشرية)
 * يمنع إعادة الطلب عند تحرك السائق مسافة صغيرة جداً
 */
function roundCoord(val: number): number {
  return Math.round(val * 10000) / 10000;
}

function makeCacheKey(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  return `${roundCoord(fromLat)},${roundCoord(fromLng)}->${roundCoord(toLat)},${roundCoord(toLng)}`;
}

function getCached(key: string): OsrmRouteResult | null {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: OsrmRouteResult): void {
  // إزالة أقدم entry إذا امتلأ الـ cache
  if (routeCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey) routeCache.delete(oldestKey);
  }
  routeCache.set(key, { result, fetchedAt: Date.now() });
}

/** مسح الـ cache يدوياً (مثلاً عند بدء رحلة جديدة) */
export function clearRouteCache(): void {
  routeCache.clear();
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/**
 * Fetch a single route via the app server (server-side OSRM).
 * Uses tRPC batch format with superjson wrapper.
 * Results are cached for 5 minutes to avoid redundant requests.
 */
export async function fetchOsrmRoute(
  from: LatLng,
  to: LatLng
): Promise<OsrmRouteResult | null> {
  const cacheKey = makeCacheKey(from.latitude, from.longitude, to.latitude, to.longitude);

  // إرجاع النتيجة المخزنة إذا كانت حديثة
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const baseUrl = getApiBaseUrl();
    // tRPC batch format with superjson: {"0": {"json": {...}}}
    const input = JSON.stringify({
      "0": {
        json: {
          fromLat: from.latitude,
          fromLng: from.longitude,
          toLat: to.latitude,
          toLng: to.longitude,
        },
      },
    });
    const url = `${baseUrl}/api/trpc/maps.getRoute?batch=1&input=${encodeURIComponent(input)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const json = await res.json() as Array<{ result: { data: { json: OsrmRouteResult } } }>;
    const data = json?.[0]?.result?.data?.json;
    if (!data || data.coords.length < 2) return null;

    // تخزين النتيجة في الـ cache
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch two routes in parallel via the app server:
 *  1. Driver → Pickup (to reach passenger)
 *  2. Pickup → Dropoff (passenger's trip)
 *
 * Uses cache for both routes individually.
 */
export async function fetchDualOsrmRoute(
  driverLocation: LatLng,
  pickup: LatLng,
  dropoff: LatLng
): Promise<{
  toPassenger: OsrmRouteResult | null;
  passengerTrip: OsrmRouteResult | null;
  totalDistanceKm: number;
  totalDurationMin: number;
}> {
  const key1 = makeCacheKey(driverLocation.latitude, driverLocation.longitude, pickup.latitude, pickup.longitude);
  const key2 = makeCacheKey(pickup.latitude, pickup.longitude, dropoff.latitude, dropoff.longitude);

  const cached1 = getCached(key1);
  const cached2 = getCached(key2);

  // إذا كلا المسارين محفوظين، أرجعهما فوراً
  if (cached1 && cached2) {
    return {
      toPassenger: cached1,
      passengerTrip: cached2,
      totalDistanceKm: cached1.distanceKm + cached2.distanceKm,
      totalDurationMin: cached1.durationMin + cached2.durationMin,
    };
  }

  try {
    const baseUrl = getApiBaseUrl();
    // tRPC batch format with superjson: {"0": {"json": {...}}}
    const input = JSON.stringify({
      "0": {
        json: {
          driverLat: driverLocation.latitude,
          driverLng: driverLocation.longitude,
          pickupLat: pickup.latitude,
          pickupLng: pickup.longitude,
          dropoffLat: dropoff.latitude,
          dropoffLng: dropoff.longitude,
        },
      },
    });
    const url = `${baseUrl}/api/trpc/maps.getDualRoute?batch=1&input=${encodeURIComponent(input)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      // fallback: try individual routes (with cache)
      const [toPassenger, passengerTrip] = await Promise.all([
        fetchOsrmRoute(driverLocation, pickup),
        fetchOsrmRoute(pickup, dropoff),
      ]);
      return {
        toPassenger,
        passengerTrip,
        totalDistanceKm: (toPassenger?.distanceKm ?? 0) + (passengerTrip?.distanceKm ?? 0),
        totalDurationMin: (toPassenger?.durationMin ?? 0) + (passengerTrip?.durationMin ?? 0),
      };
    }
    const json = await res.json() as Array<{ result: { data: { json: { toPickup: OsrmRouteResult; toDropoff: OsrmRouteResult } } } }>;
    const data = json?.[0]?.result?.data?.json;
    if (!data) return { toPassenger: null, passengerTrip: null, totalDistanceKm: 0, totalDurationMin: 0 };

    const toPassenger = data.toPickup.coords.length >= 2 ? data.toPickup : null;
    const passengerTrip = data.toDropoff.coords.length >= 2 ? data.toDropoff : null;

    // تخزين كلا المسارين في الـ cache
    if (toPassenger) setCache(key1, toPassenger);
    if (passengerTrip) setCache(key2, passengerTrip);

    return {
      toPassenger,
      passengerTrip,
      totalDistanceKm: (toPassenger?.distanceKm ?? 0) + (passengerTrip?.distanceKm ?? 0),
      totalDurationMin: (toPassenger?.durationMin ?? 0) + (passengerTrip?.durationMin ?? 0),
    };
  } catch {
    return { toPassenger: null, passengerTrip: null, totalDistanceKm: 0, totalDurationMin: 0 };
  }
}

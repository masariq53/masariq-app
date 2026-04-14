/**
 * lib/osrm.ts
 *
 * Fetches real road routes DIRECTLY from Mapbox Directions API.
 * No server dependency — works on Expo Go iOS/Android.
 */

// Mapbox token — hardcoded to guarantee availability on Expo Go iOS/Android
const MAPBOX_TOKEN = "pk.eyJ1IjoibXVzdGFmYWlxMSIsImEiOiJjbW56NmpwcXcwOXprMnFzZDl1eTFjZWd0In0.nC_HXss0ue9QkBeyo5ZmQA";

export type LatLng = { latitude: number; longitude: number };

export type OsrmRouteResult = {
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 20;

type CacheEntry = { result: OsrmRouteResult; fetchedAt: number };
const routeCache = new Map<string, CacheEntry>();

function roundCoord(val: number): number {
  return Math.round(val * 10000) / 10000; // ~11m precision
}

function makeCacheKey(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  return `${roundCoord(fromLat)},${roundCoord(fromLng)}->${roundCoord(toLat)},${roundCoord(toLng)}`;
}

function getCached(key: string): OsrmRouteResult | null {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) { routeCache.delete(key); return null; }
  return entry.result;
}

function setCache(key: string, result: OsrmRouteResult): void {
  if (routeCache.size >= CACHE_MAX_SIZE) {
    const oldest = routeCache.keys().next().value;
    if (oldest) routeCache.delete(oldest);
  }
  routeCache.set(key, { result, fetchedAt: Date.now() });
}

export function clearRouteCache(): void { routeCache.clear(); }

// ─── Mapbox Direct Fetch ──────────────────────────────────────────────────────

async function fetchMapboxDirect(from: LatLng, to: LatLng): Promise<OsrmRouteResult | null> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) { console.warn("[osrm] Mapbox HTTP", res.status); return null; }

    const data = await res.json() as {
      routes?: Array<{
        geometry: { coordinates: [number, number][] };
        distance: number;
        duration: number;
      }>;
    };

    const route = data.routes?.[0];
    if (!route || route.geometry.coordinates.length < 2) return null;

    // Mapbox returns [lng, lat] — convert to {latitude, longitude}
    const coords: LatLng[] = route.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    return {
      coords,
      distanceKm: parseFloat((route.distance / 1000).toFixed(2)),
      durationMin: Math.round(route.duration / 60),
    };
  } catch (err) {
    console.warn("[osrm] Mapbox fetch error:", err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single real-road route directly from Mapbox.
 * Works on Expo Go iOS/Android — no server needed.
 * Results cached 5 min.
 */
export async function fetchOsrmRoute(from: LatLng, to: LatLng): Promise<OsrmRouteResult | null> {
  const key = makeCacheKey(from.latitude, from.longitude, to.latitude, to.longitude);
  const cached = getCached(key);
  if (cached) return cached;

  const result = await fetchMapboxDirect(from, to);
  if (result) setCache(key, result);
  return result;
}

/**
 * Fetch two routes in parallel directly from Mapbox:
 *  1. Driver → Pickup
 *  2. Pickup → Dropoff
 *
 * Works on Expo Go iOS/Android — no server needed.
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

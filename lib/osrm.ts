/**
 * lib/osrm.ts
 *
 * Fetches real road routes from Google Directions API (primary) with Mapbox as fallback.
 * Supports traffic-aware ETA via Google Directions.
 * Works on Expo Go iOS/Android — no server dependency.
 */

import Constants from "expo-constants";

// Google Maps API Key من app.config.ts
const GOOGLE_MAPS_API_KEY: string =
  (Constants.expoConfig?.ios?.config as any)?.googleMapsApiKey ||
  (Constants.expoConfig?.android?.config as any)?.googleMaps?.apiKey ||
  "";

// Mapbox token — fallback إذا فشل Google
const MAPBOX_TOKEN = "pk.eyJ1IjoibXVzdGFmYWlxMSIsImEiOiJjbW56NmpwcXcwOXprMnFzZDl1eTFjZWd0In0.nC_HXss0ue9QkBeyo5ZmQA";

export type LatLng = { latitude: number; longitude: number };

export type OsrmRouteResult = {
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
  /** تعليمات الملاحة المفصّلة (من Google Directions) */
  steps?: NavigationStep[];
};

export type NavigationStep = {
  instruction: string;       // التعليمة بالعربي (HTML stripped)
  distanceM: number;         // المسافة للخطوة التالية بالمتر
  durationSec: number;       // الوقت للخطوة التالية بالثواني
  maneuver: string;          // نوع المناورة: turn-left, turn-right, straight...
  startLocation: LatLng;
  endLocation: LatLng;
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 دقائق (أقل لأن Google يحسب الازدحام)
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

// ─── Helper: تحويل HTML إلى نص عادي ─────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Helper: فك ترميز Google Encoded Polyline ────────────────────────────────

function decodePolyline(encoded: string): LatLng[] {
  const coords: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

// ─── Google Directions API ────────────────────────────────────────────────────

async function fetchGoogleDirections(from: LatLng, to: LatLng): Promise<OsrmRouteResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("[directions] Google Maps API Key غير موجود");
    return null;
  }

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${from.latitude},${from.longitude}` +
    `&destination=${to.latitude},${to.longitude}` +
    `&mode=driving` +
    `&departure_time=now` +
    `&traffic_model=best_guess` +
    `&language=ar` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) { console.warn("[directions] Google HTTP", res.status); return null; }

    const data = await res.json() as {
      status: string;
      routes?: Array<{
        overview_polyline: { points: string };
        legs: Array<{
          distance: { value: number };
          duration: { value: number };
          duration_in_traffic?: { value: number };
          steps: Array<{
            html_instructions: string;
            distance: { value: number };
            duration: { value: number };
            maneuver?: string;
            start_location: { lat: number; lng: number };
            end_location: { lat: number; lng: number };
            polyline: { points: string };
          }>;
        }>;
      }>;
    };

    if (data.status !== "OK" || !data.routes?.length) {
      console.warn("[directions] Google status:", data.status);
      return null;
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // فك ترميز المسار الكامل
    const coords = decodePolyline(route.overview_polyline.points);
    if (coords.length < 2) return null;

    // استخدام وقت الازدحام إذا متاح
    const durationSec = leg.duration_in_traffic?.value ?? leg.duration.value;

    // تحويل خطوات الملاحة
    const steps: NavigationStep[] = leg.steps.map((step) => ({
      instruction: stripHtml(step.html_instructions),
      distanceM: step.distance.value,
      durationSec: step.duration.value,
      maneuver: step.maneuver ?? "straight",
      startLocation: { latitude: step.start_location.lat, longitude: step.start_location.lng },
      endLocation: { latitude: step.end_location.lat, longitude: step.end_location.lng },
    }));

    return {
      coords,
      distanceKm: parseFloat((leg.distance.value / 1000).toFixed(2)),
      durationMin: Math.round(durationSec / 60),
      steps,
    };
  } catch (err) {
    console.warn("[directions] Google fetch error:", err);
    return null;
  }
}

// ─── Mapbox Fallback ──────────────────────────────────────────────────────────

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
 * Fetch a single real-road route.
 * Primary: Google Directions API (traffic-aware, with navigation steps).
 * Fallback: Mapbox Directions API.
 * Results cached 3 min.
 */
export async function fetchOsrmRoute(from: LatLng, to: LatLng): Promise<OsrmRouteResult | null> {
  const key = makeCacheKey(from.latitude, from.longitude, to.latitude, to.longitude);
  const cached = getCached(key);
  if (cached) return cached;

  // محاولة Google أولاً
  let result = await fetchGoogleDirections(from, to);

  // Fallback لـ Mapbox إذا فشل Google
  if (!result) {
    console.log("[directions] Falling back to Mapbox");
    result = await fetchMapboxDirect(from, to);
  }

  if (result) setCache(key, result);
  return result;
}

/**
 * Fetch two routes in parallel:
 *  1. Driver → Pickup (blue route)
 *  2. Pickup → Dropoff (gold route)
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

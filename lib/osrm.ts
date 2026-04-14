/**
 * OSRM Routing Utility
 * Routes all requests through the app server (server-side OSRM fetch)
 * to avoid mobile network issues, timeouts, and ISP blocking.
 *
 * The server fetches from router.project-osrm.org (fast server-to-server)
 * and returns the real road-based polyline to the app.
 */
import { getApiBaseUrl } from "@/constants/oauth";

export type LatLng = { latitude: number; longitude: number };
export type OsrmRouteResult = {
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
};

/**
 * Fetch a single route via the app server (server-side OSRM).
 */
export async function fetchOsrmRoute(
  from: LatLng,
  to: LatLng
): Promise<OsrmRouteResult | null> {
  try {
    const baseUrl = getApiBaseUrl();
    // tRPC batch format with superjson: {"0": {"json": {...}}}
    const input = JSON.stringify({
      "0": { json: { fromLat: from.latitude, fromLng: from.longitude, toLat: to.latitude, toLng: to.longitude } },
    });
    const url = `${baseUrl}/api/trpc/maps.getRoute?batch=1&input=${encodeURIComponent(input)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const json = await res.json() as Array<{ result: { data: { json: OsrmRouteResult } } }>;
    const data = json?.[0]?.result?.data?.json;
    if (!data || data.coords.length < 2) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch two routes in parallel via the app server:
 *  1. Driver → Pickup (to reach passenger)
 *  2. Pickup → Dropoff (passenger's trip)
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
      // fallback: try individual routes
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

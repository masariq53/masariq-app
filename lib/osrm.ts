/**
 * OSRM Routing Utility
 * Uses the public OSRM demo server for real road-based routing.
 * Returns route polyline coordinates, distance (km), and duration (minutes).
 */

export type LatLng = { latitude: number; longitude: number };

export type OsrmRouteResult = {
  coords: LatLng[];
  distanceKm: number;
  durationMin: number;
};

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const TIMEOUT_MS = 6000;

/**
 * Fetch a single route between two points using OSRM.
 */
export async function fetchOsrmRoute(
  from: LatLng,
  to: LatLng
): Promise<OsrmRouteResult | null> {
  try {
    const url = `${OSRM_BASE}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "MasarApp/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      code: string;
      routes: Array<{
        distance: number; // meters
        duration: number; // seconds
        geometry: { coordinates: Array<[number, number]> };
      }>;
    };
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const coords = route.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
    // OSRM يعطي وقت مثالي بدون ازدحام — نضيف معامل تصحيح واقعي
    // بناءً على مقارنة Waze للطرق العراقية:
    // - مدينة (<15كم): معامل 1.35 (ازدحام شديد)
    // - طريق مختلط (15-50كم): معامل 1.2
    // - طريق سريع بين مدن (>50كم): معامل 1.1 (قريب من Waze)
    const distKm = Math.round((route.distance / 1000) * 10) / 10;
    const rawMin = route.duration / 60;
    const trafficFactor = distKm < 15 ? 1.35 : distKm < 50 ? 1.2 : 1.1;
    const adjustedMin = Math.round(rawMin * trafficFactor);
    return {
      coords,
      distanceKm: distKm,
      durationMin: adjustedMin,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch two routes in parallel:
 *  1. Driver → Pickup (to reach passenger)
 *  2. Pickup → Dropoff (passenger's trip)
 *
 * Returns both results plus combined totals.
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

  const totalDistanceKm =
    (toPassenger?.distanceKm ?? 0) + (passengerTrip?.distanceKm ?? 0);
  const totalDurationMin =
    (toPassenger?.durationMin ?? 0) + (passengerTrip?.durationMin ?? 0);

  return { toPassenger, passengerTrip, totalDistanceKm, totalDurationMin };
}

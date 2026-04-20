/**
 * lib/google-maps.ts
 *
 * مكتبة موحّدة لجميع Google Maps APIs المستخدمة في التطبيق:
 * - Geocoding API: تحويل إحداثيات → عنوان نصي
 * - Distance Matrix API: حساب المسافة والوقت بين نقطتين مع بيانات الازدحام
 * - Roads API (Snap to Road): تصحيح مسار الكابتن ليتبع الطرق الحقيقية
 *
 * جميع الطلبات تستخدم AbortController (يعمل على iOS/Android/Web)
 */

import { GOOGLE_MAPS_API_KEY } from "./config";

export type LatLng = { latitude: number; longitude: number };

// ─── مساعد: طلب HTTP مع timeout ──────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ─── Geocoding API ────────────────────────────────────────────────────────────

/**
 * تحويل إحداثيات → عنوان نصي بالعربي (Reverse Geocoding)
 * يُستخدم عند الضغط على الخريطة لعرض اسم الموقع
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ar&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      status: string;
      results: Array<{ formatted_address: string; types: string[] }>;
    };
    if (data.status !== "OK" || !data.results.length) return null;
    // نفضّل نتيجة من نوع street_address أو route
    const preferred = data.results.find(r =>
      r.types.some(t => ["street_address", "route", "premise"].includes(t))
    );
    return (preferred ?? data.results[0]).formatted_address;
  } catch {
    return null;
  }
}

/**
 * تحويل عنوان نصي → إحداثيات (Forward Geocoding)
 */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&language=ar&region=IQ&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json() as {
      status: string;
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };
    if (data.status !== "OK" || !data.results.length) return null;
    const loc = data.results[0].geometry.location;
    return { latitude: loc.lat, longitude: loc.lng };
  } catch {
    return null;
  }
}

// ─── Distance Matrix API ──────────────────────────────────────────────────────

export type DistanceMatrixResult = {
  distanceKm: number;
  durationMin: number;
  durationInTrafficMin: number; // مع الازدحام
  distanceText: string;         // "5.0 كم"
  durationText: string;         // "11 دقيقة"
  durationInTrafficText: string; // "10 دقيقة"
};

/**
 * حساب المسافة والوقت الحقيقي بين نقطتين مع بيانات الازدحام
 * يُستخدم لحساب الأسعار وعرض وقت الوصول المقدّر
 */
export async function getDistanceMatrix(
  origin: LatLng,
  destination: LatLng
): Promise<DistanceMatrixResult | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${origin.latitude},${origin.longitude}` +
      `&destinations=${destination.latitude},${destination.longitude}` +
      `&mode=driving` +
      `&departure_time=now` +
      `&traffic_model=best_guess` +
      `&language=ar` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;

    const data = await res.json() as {
      status: string;
      rows: Array<{
        elements: Array<{
          status: string;
          distance: { value: number; text: string };
          duration: { value: number; text: string };
          duration_in_traffic?: { value: number; text: string };
        }>;
      }>;
    };

    if (data.status !== "OK" || !data.rows.length) return null;
    const el = data.rows[0].elements[0];
    if (el.status !== "OK") return null;

    const durationInTraffic = el.duration_in_traffic ?? el.duration;

    return {
      distanceKm: parseFloat((el.distance.value / 1000).toFixed(2)),
      durationMin: Math.round(el.duration.value / 60),
      durationInTrafficMin: Math.round(durationInTraffic.value / 60),
      distanceText: el.distance.text,
      durationText: el.duration.text,
      durationInTrafficText: durationInTraffic.text,
    };
  } catch {
    return null;
  }
}

// ─── Roads API (Snap to Road) ─────────────────────────────────────────────────

/**
 * تصحيح مسار نقاط GPS لتتبع الطرق الحقيقية
 * يُستخدم لتحسين دقة عرض موقع الكابتن على الخريطة
 * ملاحظة: Roads API يقبل حتى 100 نقطة لكل طلب
 */
export async function snapToRoads(points: LatLng[]): Promise<LatLng[]> {
  if (!GOOGLE_MAPS_API_KEY || points.length === 0) return points;
  // Roads API يقبل حتى 100 نقطة
  const sample = points.length > 100 ? samplePoints(points, 100) : points;
  try {
    const path = sample.map(p => `${p.latitude},${p.longitude}`).join("|");
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(path)}&interpolate=true&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return points;
    const data = await res.json() as {
      snappedPoints?: Array<{ location: { latitude: number; longitude: number } }>;
    };
    if (!data.snappedPoints?.length) return points;
    return data.snappedPoints.map(p => ({
      latitude: p.location.latitude,
      longitude: p.location.longitude,
    }));
  } catch {
    return points; // fallback للنقاط الأصلية
  }
}

/**
 * أخذ عيّنة متساوية من مصفوفة نقاط
 */
function samplePoints(points: LatLng[], maxCount: number): LatLng[] {
  if (points.length <= maxCount) return points;
  const step = Math.ceil(points.length / maxCount);
  const result: LatLng[] = [];
  for (let i = 0; i < points.length; i += step) {
    result.push(points[i]);
  }
  // تأكد من إضافة النقطة الأخيرة
  if (result[result.length - 1] !== points[points.length - 1]) {
    result.push(points[points.length - 1]);
  }
  return result;
}

// ─── حساب الأجرة بناءً على Distance Matrix ───────────────────────────────────

const BASE_FARE_IQD = 2000;    // أجرة أساسية
const RATE_PER_KM_IQD = 1000;  // سعر الكيلومتر
const RATE_PER_MIN_IQD = 100;  // سعر الدقيقة (مع الازدحام)
const MIN_FARE_IQD = 3000;     // أقل أجرة

/**
 * حساب الأجرة المقدّرة بناءً على المسافة والوقت الحقيقي
 */
export function calculateFare(distanceKm: number, durationInTrafficMin: number): number {
  const fare = BASE_FARE_IQD + (distanceKm * RATE_PER_KM_IQD) + (durationInTrafficMin * RATE_PER_MIN_IQD);
  return Math.max(Math.round(fare / 500) * 500, MIN_FARE_IQD); // تقريب لأقرب 500 دينار
}

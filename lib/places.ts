/**
 * lib/places.ts
 *
 * Google Places API - Autocomplete + Details
 * يستخدم Legacy Autocomplete API (GET) لأنه يعمل بشكل موثوق على iOS/Android
 * مع Nominatim كـ fallback
 */

import { GOOGLE_MAPS_API_KEY } from "./config";

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

// ─── Google Places Autocomplete + Details ────────────────────────────────────

export async function searchGooglePlaces(
  query: string,
  userLat?: number,
  userLng?: number
): Promise<PlaceResult[]> {
  if (!query || query.trim().length < 2) return [];

  // إذا ما في API Key استخدم Nominatim مباشرة
  if (!GOOGLE_MAPS_API_KEY) {
    return searchNominatim(query, userLat, userLng);
  }

  try {
    // بناء URL للـ Autocomplete
    let url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&language=ar` +
      `&components=country:iq` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    // إضافة location bias إذا عندنا موقع المستخدم
    if (userLat && userLng) {
      url += `&location=${userLat},${userLng}&radius=50000`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn("[places] Autocomplete HTTP", res.status);
      return searchNominatim(query, userLat, userLng);
    }

    const data = await res.json() as {
      status: string;
      predictions?: Array<{
        place_id: string;
        description: string;
        structured_formatting?: {
          main_text: string;
          secondary_text?: string;
        };
      }>;
      error_message?: string;
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn("[places] Autocomplete status:", data.status, data.error_message);
      return searchNominatim(query, userLat, userLng);
    }

    if (!data.predictions?.length) return [];

    // جلب إحداثيات أول 5 نتائج بشكل متتالي (مو متوازي) لتجنب rate limit
    const results: PlaceResult[] = [];
    for (const pred of data.predictions.slice(0, 5)) {
      const coords = await getPlaceCoords(pred.place_id);
      if (!coords) continue;

      const name = pred.structured_formatting?.main_text || pred.description.split("،")[0];
      const address = pred.structured_formatting?.secondary_text || pred.description;

      results.push({
        id: pred.place_id,
        name,
        address,
        latitude: coords.lat,
        longitude: coords.lng,
      });
    }

    if (results.length === 0) {
      return searchNominatim(query, userLat, userLng);
    }

    return results;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[places] Autocomplete timeout");
    } else {
      console.warn("[places] Autocomplete error:", err);
    }
    return searchNominatim(query, userLat, userLng);
  }
}

// ─── جلب إحداثيات مكان بـ place_id ──────────────────────────────────────────

async function getPlaceCoords(placeId: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&fields=geometry` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = await res.json() as {
      status: string;
      result?: {
        geometry?: {
          location?: { lat: number; lng: number };
        };
      };
    };

    const loc = data.result?.geometry?.location;
    if (!loc) return null;

    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
}

// ─── Google Reverse Geocoding ─────────────────────────────────────────────────

export async function reverseGeocodeGoogle(lat: number, lng: number): Promise<string> {
  if (!GOOGLE_MAPS_API_KEY) return reverseGeocodeNominatim(lat, lng);

  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${lat},${lng}` +
      `&language=ar` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return reverseGeocodeNominatim(lat, lng);

    const data = await res.json() as {
      status: string;
      results?: Array<{
        formatted_address: string;
        address_components: Array<{
          long_name: string;
          types: string[];
        }>;
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) {
      return reverseGeocodeNominatim(lat, lng);
    }

    const result = data.results[0];
    const components = result.address_components;
    const route = components.find((c) => c.types.includes("route"))?.long_name;
    const neighborhood = components.find((c) =>
      c.types.includes("neighborhood") || c.types.includes("sublocality")
    )?.long_name;
    const city = components.find((c) =>
      c.types.includes("locality") || c.types.includes("administrative_area_level_2")
    )?.long_name;

    const parts = [route, neighborhood, city].filter(Boolean);
    return parts.length > 0 ? parts.join("، ") : result.formatted_address;
  } catch {
    return reverseGeocodeNominatim(lat, lng);
  }
}

// ─── Nominatim Fallback ───────────────────────────────────────────────────────

async function searchNominatim(
  query: string,
  userLat?: number,
  userLng?: number
): Promise<PlaceResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const encoded = encodeURIComponent(query);
    let viewboxParam = "";
    if (userLat && userLng) {
      const delta = 0.5;
      viewboxParam = `&viewbox=${userLng - delta},${userLat - delta},${userLng + delta},${userLat + delta}&bounded=0`;
    } else {
      viewboxParam = "&viewbox=38.7945,29.0617,48.5756,37.3743&bounded=1";
    }
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=6&addressdetails=1&accept-language=ar&countrycodes=iq${viewboxParam}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: { "User-Agent": "MasarApp/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = await res.json() as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>;
    return data.map((item) => {
      const addr = item.address ?? {};
      const name = addr.road || addr.neighbourhood || addr.suburb || item.display_name.split(",")[0];
      const city = addr.city || addr.town || addr.village || "";
      return {
        id: String(item.place_id),
        name,
        address: [city, addr.state].filter(Boolean).join("، ") || item.display_name.split(",").slice(1, 3).join("،"),
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      };
    });
  } catch {
    return [];
  }
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ar`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: { "User-Agent": "MasarApp/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return "";
    const data = await res.json();
    const addr = data.address;
    if (!addr) return data.display_name ?? "";
    const parts = [addr.road, addr.neighbourhood || addr.suburb, addr.city || addr.town || addr.village].filter(Boolean);
    return parts.length > 0 ? parts.join("، ") : (data.display_name ?? "");
  } catch {
    return "";
  }
}

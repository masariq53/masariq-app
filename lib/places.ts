/**
 * lib/places.ts
 *
 * Google Places Autocomplete + Geocoding API
 * Primary: Google Places API (دقيق، يدعم العربي والكردي)
 * Fallback: Nominatim (OpenStreetMap)
 */

import Constants from "expo-constants";

const GOOGLE_MAPS_API_KEY: string =
  (Constants.expoConfig?.ios?.config as any)?.googleMapsApiKey ||
  (Constants.expoConfig?.android?.config as any)?.googleMaps?.apiKey ||
  "";

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

// ─── Google Places Autocomplete ───────────────────────────────────────────────

export async function searchGooglePlaces(
  query: string,
  userLat?: number,
  userLng?: number
): Promise<PlaceResult[]> {
  if (!query || query.trim().length < 2) return [];
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("[places] Google Maps API Key غير موجود");
    return searchNominatim(query, userLat, userLng);
  }

  try {
    // استخدام location bias حول موقع المستخدم (نطاق 50كم)
    const locationBias = userLat && userLng
      ? `&location=${userLat},${userLng}&radius=50000`
      : "&components=country:iq";

    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&language=ar` +
      `&components=country:iq` +
      locationBias +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn("[places] Google Autocomplete HTTP", res.status);
      return searchNominatim(query, userLat, userLng);
    }

    const data = await res.json() as {
      status: string;
      predictions?: Array<{
        place_id: string;
        description: string;
        structured_formatting: {
          main_text: string;
          secondary_text: string;
        };
      }>;
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn("[places] Google Autocomplete status:", data.status);
      return searchNominatim(query, userLat, userLng);
    }

    if (!data.predictions?.length) return [];

    // جلب تفاصيل أول 6 نتائج (الإحداثيات)
    const results = await Promise.all(
      data.predictions.slice(0, 6).map(async (pred) => {
        const detail = await getPlaceDetails(pred.place_id);
        if (!detail) return null;
        return {
          id: pred.place_id,
          name: pred.structured_formatting.main_text,
          address: pred.structured_formatting.secondary_text || pred.description,
          latitude: detail.lat,
          longitude: detail.lng,
        } as PlaceResult;
      })
    );

    return results.filter((r): r is PlaceResult => r !== null);
  } catch (err) {
    console.warn("[places] Google Autocomplete error:", err);
    return searchNominatim(query, userLat, userLng);
  }
}

// ─── Google Place Details (للحصول على الإحداثيات) ────────────────────────────

async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&fields=geometry` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    const data = await res.json() as {
      status: string;
      result?: {
        geometry: {
          location: { lat: number; lng: number };
        };
      };
    };

    if (data.status !== "OK" || !data.result) return null;
    return data.result.geometry.location;
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

    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
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

    // استخراج اسم الشارع والحي
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
    const res = await fetch(url, {
      headers: { "User-Agent": "MasarApp/1.0" },
      signal: AbortSignal.timeout(8000),
    });
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
    const res = await fetch(url, {
      headers: { "User-Agent": "MasarApp/1.0" },
      signal: AbortSignal.timeout(6000),
    });
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

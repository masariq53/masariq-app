import { describe, it, expect } from "vitest";

describe("EXPO_PUBLIC_MAPBOX_TOKEN", () => {
  it("should be set and valid", async () => {
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    expect(token, "EXPO_PUBLIC_MAPBOX_TOKEN is not set").toBeTruthy();
    expect(token!.startsWith("pk."), "Token should start with pk.").toBe(true);

    // اختبار حقيقي: استدعاء Mapbox Directions API مباشرة
    const fromLng = 43.1289, fromLat = 36.3392;
    const toLng = 43.1450, toLat = 36.3600;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${token}&geometries=geojson&overview=full`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    expect(res.ok, `Mapbox API returned ${res.status}`).toBe(true);

    const data = await res.json() as { routes?: Array<{ geometry: { coordinates: number[][] }; distance: number; duration: number }> };
    expect(data.routes, "No routes returned").toBeTruthy();
    expect(data.routes!.length, "Empty routes array").toBeGreaterThan(0);

    const route = data.routes![0];
    const coords = route.geometry.coordinates;
    expect(coords.length, "Too few coordinates").toBeGreaterThan(10);

    console.log(`✅ Mapbox Direct: ${coords.length} نقطة، ${(route.distance / 1000).toFixed(1)} كم، ${Math.round(route.duration / 60)} دقيقة`);
  });
});

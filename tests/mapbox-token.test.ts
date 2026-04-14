import { describe, it, expect } from "vitest";

describe("Mapbox API Token", () => {
  it("should successfully call Mapbox Directions API with the token", async () => {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    expect(token).toBeDefined();
    expect(token).toMatch(/^pk\./);

    // اختبار مسار حقيقي في الموصل: مركز الموصل → الجسر القديم
    const fromLng = 43.1289;
    const fromLat = 36.3392;
    const toLng = 43.1450;
    const toLat = 36.3500;

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${token}&geometries=geojson&overview=full`;

    const res = await fetch(url);
    expect(res.ok).toBe(true);

    const json = await res.json() as any;
    expect(json.routes).toBeDefined();
    expect(json.routes.length).toBeGreaterThan(0);

    const route = json.routes[0];
    expect(route.geometry.coordinates.length).toBeGreaterThan(2);
    expect(route.distance).toBeGreaterThan(0);
    expect(route.duration).toBeGreaterThan(0);

    console.log(`✅ Mapbox route: ${(route.distance / 1000).toFixed(2)} km, ${Math.round(route.duration / 60)} min, ${route.geometry.coordinates.length} points`);
  }, 15000);
});

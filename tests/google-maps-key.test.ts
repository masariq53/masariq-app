import { describe, it, expect } from "vitest";

describe("Google Maps API Key", () => {
  it("should be set in environment", () => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    expect(key).toBeTruthy();
    expect(key?.length).toBeGreaterThan(20);
  });

  it("should work with Directions API", async () => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=36.8669,42.9503&destination=36.8750,42.9600&mode=driving&key=${key}`;
    const res = await fetch(url);
    const data = await res.json() as { status: string };
    expect(data.status).toBe("OK");
  });

  it("should work with Places API (New)", async () => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key!,
      },
      body: JSON.stringify({ input: "duhok", languageCode: "ar" }),
    });
    const data = await res.json() as { suggestions?: any[]; error?: any };
    expect(data.error).toBeUndefined();
    expect(data.suggestions).toBeDefined();
  });
});

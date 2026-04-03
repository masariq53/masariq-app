/**
 * useLocation hook
 * Requests GPS permission and returns current user location.
 * Falls back to Mosul center if permission denied or unavailable.
 */
import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";

const MOSUL_CENTER = {
  latitude: 36.3392,
  longitude: 43.1289,
};

export type LocationCoords = {
  latitude: number;
  longitude: number;
};

export type LocationState = {
  coords: LocationCoords;
  isLoading: boolean;
  error: string | null;
  isRealLocation: boolean;
  refresh: () => Promise<void>;
};

export function useLocation(): LocationState {
  const [coords, setCoords] = useState<LocationCoords>(MOSUL_CENTER);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealLocation, setIsRealLocation] = useState(false);

  const fetchLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (Platform.OS === "web") {
        // Web: use browser geolocation
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          await new Promise<void>((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setCoords({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
                setIsRealLocation(true);
                resolve();
              },
              () => {
                // Fall back to Mosul center
                setCoords(MOSUL_CENTER);
                setIsRealLocation(false);
                resolve();
              },
              { timeout: 5000 }
            );
          });
        } else {
          setCoords(MOSUL_CENTER);
          setIsRealLocation(false);
        }
      } else {
        // Native: use expo-location
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setError("لم يتم منح إذن الموقع. سيتم استخدام موقع الموصل الافتراضي.");
          setCoords(MOSUL_CENTER);
          setIsRealLocation(false);
        } else {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCoords({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setIsRealLocation(true);
        }
      }
    } catch (err) {
      console.warn("[useLocation] Error:", err);
      setError("فشل في تحديد الموقع");
      setCoords(MOSUL_CENTER);
      setIsRealLocation(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return { coords, isLoading, error, isRealLocation, refresh: fetchLocation };
}

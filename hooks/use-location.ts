/**
 * useLocation hook
 * Requests GPS permission and continuously watches user location in real-time.
 * Falls back to Mosul center if permission denied or unavailable.
 * Uses watchPositionAsync for continuous tracking (no need to reload).
 */
import { useState, useEffect, useCallback, useRef } from "react";
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
  heading: number | null; // اتجاه السير بالدرجات (0-360) - null إذا غير متاح
  isLoading: boolean;
  error: string | null;
  isRealLocation: boolean;
  refresh: () => Promise<void>;
  stopWatching: () => void;
};

export function useLocation(): LocationState {
  const [coords, setCoords] = useState<LocationCoords>(MOSUL_CENTER);
  const [heading, setHeading] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealLocation, setIsRealLocation] = useState(false);

  // مرجع للـ subscription لإلغائها عند unmount
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  // مرجع لـ watchId على الويب
  const webWatchIdRef = useRef<number | null>(null);

  const startWatching = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (Platform.OS === "web") {
        // Web: استخدام watchPosition للتتبع المستمر
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          // أولاً: جلب الموقع الحالي بسرعة
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setCoords({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
              setIsRealLocation(true);
              setIsLoading(false);
            },
            () => {
              setCoords(MOSUL_CENTER);
              setIsRealLocation(false);
              setIsLoading(false);
            },
            { timeout: 5000, enableHighAccuracy: false }
          );

          // ثانياً: مراقبة مستمرة للتحديثات
          if (webWatchIdRef.current !== null) {
            navigator.geolocation.clearWatch(webWatchIdRef.current);
          }
          webWatchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              setCoords({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
              if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
                setHeading(pos.coords.heading);
              }
              setIsRealLocation(true);
              setIsLoading(false);
            },
            () => {
              // لا نغير الموقع عند خطأ في التحديث المستمر
            },
            { enableHighAccuracy: true, maximumAge: 5000 }
          );
        } else {
          setCoords(MOSUL_CENTER);
          setIsRealLocation(false);
          setIsLoading(false);
        }
      } else {
        // Native: استخدام expo-location watchPositionAsync
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("لم يتم منح إذن الموقع. سيتم استخدام موقع الموصل الافتراضي.");
          setCoords(MOSUL_CENTER);
          setIsRealLocation(false);
          setIsLoading(false);
          return;
        }

        // جلب الموقع الأولي بسرعة
        try {
          const initialLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCoords({
            latitude: initialLocation.coords.latitude,
            longitude: initialLocation.coords.longitude,
          });
          setIsRealLocation(true);
          setIsLoading(false);
        } catch {
          setIsLoading(false);
        }

        // إلغاء المراقبة السابقة إن وجدت
        if (watchSubscriptionRef.current) {
          watchSubscriptionRef.current.remove();
          watchSubscriptionRef.current = null;
        }

        // بدء المراقبة المستمرة للموقع
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,    // تحديث كل 2 ثانية
            distanceInterval: 5,   // أو عند تحرك 5 أمتار
          },
          (location) => {
            setCoords({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
            if (location.coords.heading !== null && location.coords.heading !== undefined) {
              setHeading(location.coords.heading);
            }
            setIsRealLocation(true);
            setIsLoading(false);
          }
        );

        watchSubscriptionRef.current = subscription;
      }
    } catch (err) {
      console.warn("[useLocation] Error:", err);
      setError("فشل في تحديد الموقع");
      setCoords(MOSUL_CENTER);
      setIsRealLocation(false);
      setIsLoading(false);
    }
  }, []);

  // دالة إيقاف GPS
  const stopWatching = useCallback(() => {
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
    if (Platform.OS === 'web' && webWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }
    setIsRealLocation(false);
  }, []);

  // بدء المراقبة عند تحميل الـ hook
  useEffect(() => {
    startWatching();

    // تنظيف عند unmount
    return () => {
      stopWatching();
    };
  }, [startWatching, stopWatching]);

  return {
    coords,
    heading,
    isLoading,
    error,
    isRealLocation,
    refresh: startWatching,
    stopWatching,
  };
}

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

// تنعيم الزاوية (heading smoothing) - يمنع الاهتزاز عند تتبع الكاميرا
function smoothHeading(prev: number | null, next: number): number {
  if (prev === null) return next;
  // التعامل مع الانتقال عبر 0/360 درجة
  let diff = next - prev;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  // تنعيم بنسبة 30% (قيمة منخفضة = أكثر سلاسة)
  return (prev + diff * 0.3 + 360) % 360;
}

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
  // مرجع لآخر heading للتنعيم
  const lastHeadingRef = useRef<number | null>(null);
  // مرجع لآخر إحداثيات لحساب bearing عند غياب heading
  const lastCoordsRef = useRef<LocationCoords | null>(null);

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
              const newCoords = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              };
              setCoords(newCoords);
              if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
                const smoothed = smoothHeading(lastHeadingRef.current, pos.coords.heading);
                lastHeadingRef.current = smoothed;
                setHeading(smoothed);
              }
              lastCoordsRef.current = newCoords;
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
            timeInterval: 1000,    // تحديث كل 1 ثانية للتتبع السلس
            distanceInterval: 3,   // أو عند تحرك 3 أمتار
          },
          (location) => {
            const newCoords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            setCoords(newCoords);

            // حساب heading: من GPS أو من الحركة (bearing)
            let rawHeading: number | null = null;
            if (
              location.coords.heading !== null &&
              location.coords.heading !== undefined &&
              location.coords.heading >= 0
            ) {
              rawHeading = location.coords.heading;
            } else if (lastCoordsRef.current) {
              // حساب bearing من آخر نقطتين
              const prev = lastCoordsRef.current;
              const dLng = (newCoords.longitude - prev.longitude) * (Math.PI / 180);
              const lat1 = prev.latitude * (Math.PI / 180);
              const lat2 = newCoords.latitude * (Math.PI / 180);
              const y = Math.sin(dLng) * Math.cos(lat2);
              const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
              const bearing = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
              // استخدام bearing فقط عند تحرك كافي
              const dist = Math.sqrt(
                Math.pow(newCoords.latitude - prev.latitude, 2) +
                Math.pow(newCoords.longitude - prev.longitude, 2)
              );
              if (dist > 0.00005) rawHeading = bearing; // ~5 متر
            }

            if (rawHeading !== null) {
              const smoothed = smoothHeading(lastHeadingRef.current, rawHeading);
              lastHeadingRef.current = smoothed;
              setHeading(smoothed);
            }

            lastCoordsRef.current = newCoords;
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

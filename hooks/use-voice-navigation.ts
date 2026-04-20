/**
 * hooks/use-voice-navigation.ts
 *
 * Hook للملاحة الصوتية بالعربي.
 * يتتبع موقع السائق ويعطي تعليمات صوتية عند الاقتراب من كل خطوة.
 */

import { useRef, useCallback, useEffect } from "react";
import * as Speech from "expo-speech";
import { Platform } from "react-native";
import type { NavigationStep, LatLng } from "@/lib/osrm";

// المسافة بالمتر للإعلان عن الخطوة القادمة
const ANNOUNCE_DISTANCE_M = 200; // 200 متر قبل المنعطف
const CLOSE_DISTANCE_M = 50;     // 50 متر - تعليمة "الآن"

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000; // نصف قطر الأرض بالمتر
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} كيلومتر`;
  }
  if (meters >= 100) {
    return `${Math.round(meters / 50) * 50} متر`;
  }
  return `${Math.round(meters / 10) * 10} متر`;
}

async function speakArabic(text: string) {
  if (Platform.OS === "web") return;
  try {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }
    Speech.speak(text, {
      language: "ar-SA",
      rate: 0.9,
      pitch: 1.0,
    });
  } catch (e) {
    console.warn("[voice-nav] Speech error:", e);
  }
}

export function useVoiceNavigation() {
  const stepsRef = useRef<NavigationStep[]>([]);
  const currentStepIndexRef = useRef(0);
  const announcedNearRef = useRef(false);
  const announcedCloseRef = useRef(false);
  const isActiveRef = useRef(false);

  const setSteps = useCallback((steps: NavigationStep[]) => {
    stepsRef.current = steps;
    currentStepIndexRef.current = 0;
    announcedNearRef.current = false;
    announcedCloseRef.current = false;
  }, []);

  const start = useCallback((destination: string) => {
    isActiveRef.current = true;
    speakArabic(`بدأت الملاحة. الوجهة: ${destination}`);
  }, []);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    Speech.stop().catch(() => {});
  }, []);

  const announceArrival = useCallback((place: string) => {
    speakArabic(`وصلت إلى ${place}`);
  }, []);

  /**
   * يُستدعى عند كل تحديث لموقع السائق.
   * يحسب المسافة للخطوة الحالية ويعطي التعليمة الصوتية المناسبة.
   */
  const onLocationUpdate = useCallback((driverLocation: LatLng) => {
    if (!isActiveRef.current) return;
    const steps = stepsRef.current;
    if (!steps.length) return;

    const idx = currentStepIndexRef.current;
    if (idx >= steps.length) return;

    const step = steps[idx];
    const distToEnd = haversineDistance(driverLocation, step.endLocation);

    // تعليمة "بعد X متر"
    if (!announcedNearRef.current && distToEnd <= ANNOUNCE_DISTANCE_M && distToEnd > CLOSE_DISTANCE_M) {
      announcedNearRef.current = true;
      announcedCloseRef.current = false;
      const distText = formatDistance(distToEnd);
      speakArabic(`بعد ${distText}، ${step.instruction}`);
    }

    // تعليمة "الآن"
    if (!announcedCloseRef.current && distToEnd <= CLOSE_DISTANCE_M) {
      announcedCloseRef.current = true;
      speakArabic(step.instruction);
    }

    // الانتقال للخطوة التالية
    if (distToEnd <= CLOSE_DISTANCE_M) {
      const nextIdx = idx + 1;
      if (nextIdx < steps.length) {
        currentStepIndexRef.current = nextIdx;
        announcedNearRef.current = false;
        announcedCloseRef.current = false;
      }
    }
  }, []);

  // تنظيف عند إلغاء التحميل
  useEffect(() => {
    return () => {
      Speech.stop().catch(() => {});
    };
  }, []);

  return {
    setSteps,
    start,
    stop,
    onLocationUpdate,
    announceArrival,
  };
}

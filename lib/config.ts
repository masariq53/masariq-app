/**
 * lib/config.ts
 * 
 * مركز إعدادات التطبيق - API Keys والثوابت
 * ملاحظة: الـ Key مكتوب مباشرة لأن Constants.expoConfig لا يعمل في Expo Go
 */

import Constants from "expo-constants";

// محاولة قراءة الـ Key من البيئة أولاً، ثم استخدام القيمة الثابتة
const keyFromConfig =
  (Constants.expoConfig?.ios?.config as any)?.googleMapsApiKey ||
  (Constants.expoConfig?.android?.config as any)?.googleMaps?.apiKey ||
  (Constants.expoConfig?.extra as any)?.googleMapsApiKey ||
  "";

// القيمة الثابتة كـ fallback مضمون (تعمل في Expo Go وفي builds)
const HARDCODED_KEY = "AIzaSyDk9e9try2bbIQRnsOrIJoojYAxXpx5uek";

export const GOOGLE_MAPS_API_KEY: string = keyFromConfig || HARDCODED_KEY;

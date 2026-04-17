import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";
import { useLocation } from "@/hooks/use-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchOsrmRoute } from "@/lib/osrm";
import { formatIQD } from "@/lib/utils";
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

const { width } = Dimensions.get("window");

const MOSUL_CENTER = {
  latitude: 36.3392,
  longitude: 43.1289,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const rideTypes = [
  { id: "economy", icon: "🚗", label: "اقتصادي", desc: "أسرع وصول", capacity: "4" },
  { id: "comfort", icon: "🚙", label: "مريح", desc: "سيارات فاخرة", multiplier: 1.5, capacity: "4" },
  { id: "xl", icon: "🚐", label: "XL", desc: "للمجموعات", multiplier: 2, capacity: "6" },
  { id: "women", icon: "👩", label: "سائقة", desc: "للسيدات فقط", multiplier: 1.2, capacity: "4" },
];

type SearchResult = {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

type SavedAddress = {
  id: string;
  type: "home" | "work" | "other" | "custom";
  label: string;
  address: string;
  icon: string;
  lat?: number;
  lng?: number;
};

async function searchNominatim(
  query: string,
  userLat?: number,
  userLng?: number
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const encoded = encodeURIComponent(query);
    // إذا توفر موقع المستخدم، أضف viewbox حول موقعه (نطاق ~50كم) لإعطاء أولوية للنتائج القريبة
    let proximityParams = "";
    // حدود العراق الجغرافية
    const iraqBounds = "38.7945,29.0617,48.5756,37.3743"; // minLng,minLat,maxLng,maxLat
    if (userLat && userLng) {
      // نطاق أضيق حول المستخدم لإعطاء الأولوية للمدينة الحالية
      const delta = 0.3; // ~33كم
      const minLng = (userLng - delta).toFixed(4);
      const minLat = (userLat - delta).toFixed(4);
      const maxLng = (userLng + delta).toFixed(4);
      const maxLat = (userLat + delta).toFixed(4);
      proximityParams = `&viewbox=${minLng},${minLat},${maxLng},${maxLat}&bounded=0`;
    }
    // countrycodes=iq يضمن أن النتائج داخل العراق فقط
    // إذا توفر موقع المستخدم نستخدم viewbox أضيق حوله لإعطاء أولوية للمدينة الحالية
    const viewboxParam = proximityParams || `&viewbox=${iraqBounds}&bounded=1`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=8&addressdetails=1&accept-language=ar&countrycodes=iq${viewboxParam}`;
    const res = await fetch(url, { headers: { "User-Agent": "MasarApp/1.0" } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function reverseGeocodeNominatim(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ar`;
    const res = await fetch(url, { headers: { "User-Agent": "MasarApp/1.0" } });
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

function shortenAddress(displayName: string): string {
  return displayName.split(",").slice(0, 3).join("،").trim();
}

// حساب المسافة بالكيلومترات بين نقطتين (Haversine)
function calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function BookRideScreen() {
  const insets = useSafeAreaInsets();
  const { passenger } = usePassenger();
  const { coords, isRealLocation } = useLocation();
  const [from, setFrom] = useState("موقعي الحالي");
  const [to, setTo] = useState("");
  const [toInput, setToInput] = useState("");
  const [selectedRide, setSelectedRide] = useState("economy");
  const [pickupPin, setPickupPin] = useState({ latitude: 36.3392, longitude: 43.1289 });
  const [dropPin, setDropPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [osrmDistance, setOsrmDistance] = useState<number | null>(null);
  const [osrmDuration, setOsrmDuration] = useState<number | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  // البحث الصوتي
  const [isTranscribing, setIsTranscribing] = useState(false);
  // العناوين المفضلة - تحرير
  const [editFavModal, setEditFavModal] = useState<{ type: "home" | "work" } | null>(null);
  const [favInput, setFavInput] = useState("");
  // تعديل موقع الانطلاق
  const [showPickupSearch, setShowPickupSearch] = useState(false);
  const [pickupInput, setPickupInput] = useState("");
  const [pickupSearchResults, setPickupSearchResults] = useState<SearchResult[]>([]);
  const [isPickupSearching, setIsPickupSearching] = useState(false);
  const [isPickupManual, setIsPickupManual] = useState(false);
  const pickupSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupInputRef = useRef<TextInput>(null);
  // اختيار طريقة الدفع
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [allSavedAddresses, setAllSavedAddresses] = useState<SavedAddress[]>([
    { id: "home", type: "home", label: "البيت", address: "", icon: "🏠" },
    { id: "work", type: "work", label: "العمل", address: "", icon: "🏢" },
  ]);
  const mapRef = useRef<MapView>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const uploadAudio = trpc.driver.uploadDocument.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();

  // تحميل جميع العناوين المحفوظة (مع البيت والعمل حتى لو فارغة)
  useEffect(() => {
    AsyncStorage.getItem("@masar_saved_addresses").then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as SavedAddress[];
          const home = parsed.find((a) => a.id === "home") ?? { id: "home", type: "home" as const, label: "البيت", address: "", icon: "🏠" };
          const work = parsed.find((a) => a.id === "work") ?? { id: "work", type: "work" as const, label: "العمل", address: "", icon: "🏢" };
          const customs = parsed.filter((a) => a.type === "other" || a.type === "custom");
          setAllSavedAddresses([home, work, ...customs]);
          setSavedAddresses(parsed.filter((a) => a.lat && a.lng));
        } catch {}
      }
    });
  }, []);

  // حفظ عنوان مفضل (بيت/عمل) مع Geocoding
  const saveFavoriteAddress = async (type: "home" | "work", address: string) => {
    if (!address.trim()) return;
    try {
      const results = await searchNominatim(address, coords.latitude, coords.longitude);
      if (!results.length) { Alert.alert("تنبيه", "لم يتم العثور على العنوان، جرب كتابة اسم أوضح"); return; }
      const first = results[0];
      const raw = await AsyncStorage.getItem("@masar_saved_addresses");
      let all: SavedAddress[] = raw ? JSON.parse(raw) : [];
      const icon = type === "home" ? "🏠" : "🏢";
      const label = type === "home" ? "البيت" : "العمل";
      const updated: SavedAddress = { id: type, type, label, address: shortenAddress(first.display_name), icon, lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
      all = all.filter((a) => a.id !== type);
      all.unshift(updated);
      await AsyncStorage.setItem("@masar_saved_addresses", JSON.stringify(all));
      setAllSavedAddresses((prev) => prev.map((a) => a.id === type ? updated : a));
      setSavedAddresses((prev) => { const filtered = prev.filter((a) => a.id !== type); return [updated, ...filtered]; });
      setEditFavModal(null);
      setFavInput("");
    } catch { Alert.alert("خطأ", "فشل حفظ العنوان"); }
  };

  // البحث الصوتي
  const handleVoiceSearch = async () => {
    if (recorderState.isRecording) {
      // إيقاف التسجيل وإرسال
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;
      setIsTranscribing(true);
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        // رفع الصوت للحصول على URL
        const uploadResult = await uploadAudio.mutateAsync({
          phone: passenger?.phone ?? "voice",
          documentType: "photo",
          base64,
          mimeType: "audio/m4a",
        });
        // تحويل الصوت لنص عبر Whisper
        const transcribeResult = await transcribeMutation.mutateAsync({
          audioUrl: uploadResult.url,
          language: "ar",
        });
        const transcribedText = transcribeResult.text;
        if (transcribedText) {
          setToInput(transcribedText);
          setShowSearch(true);
          handleToInputChange(transcribedText);
        } else {
          Alert.alert("تنبيه", "لم يتم التعرف على الصوت، جرب مرة أخرى");
        }
      } catch {
        Alert.alert("خطأ", "فشل البحث الصوتي");
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // طلب إذن وبدء التسجيل
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) { Alert.alert("تنبيه", "يرجى السماح للتطبيق بالوصول إلى الميكروفون"); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    }
  };

  // تحديث موقع الانطلاق بـ GPS + Reverse Geocoding (فقط إذا لم يعدل المستخدم يدوياً)
  useEffect(() => {
    if (!isRealLocation || isPickupManual) return;
    setPickupPin({ latitude: coords.latitude, longitude: coords.longitude });
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        800
      );
    }
    reverseGeocodeNominatim(coords.latitude, coords.longitude).then((address) => {
      if (address) {
        setFrom(address);
      } else {
        Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude })
          .then((results) => {
            if (results?.[0]) {
              const r = results[0];
              const parts = [r.street, r.district, r.city].filter(Boolean);
              setFrom(parts.length > 0 ? parts.join("، ") : (r.formattedAddress ?? "موقعي الحالي"));
            }
          })
          .catch(() => {});
      }
    });
  }, [isRealLocation]);

  // جلب مسار حقيقي عبر Mapbox عند تحديد الوجهة + تكبير الخريطة تلقائياً
  useEffect(() => {
    if (!dropPin) {
      setRouteCoords([]);
      setOsrmDistance(null);
      setOsrmDuration(null);
      return;
    }
    const fetchRoute = async () => {
      setIsLoadingRoute(true);
      setRouteCoords([]); // امسح المسار القديم أثناء التحميل
      try {
        const result = await fetchOsrmRoute(pickupPin, dropPin);
        if (result && result.coords.length >= 2) {
          setRouteCoords(result.coords);
          setOsrmDistance(result.distanceKm);
          setOsrmDuration(result.durationMin);
          // تكبير الخريطة لتشمل المسار كاملاً
          if (Platform.OS !== "web" && mapRef.current) {
            setTimeout(() => {
              mapRef.current?.fitToCoordinates(result.coords, {
                edgePadding: { top: 80, right: 50, bottom: 280, left: 50 },
                animated: true,
              });
            }, 300);
          }
        } else {
          // فشل جلب المسار - لا نعرض خطاً مستقيماً
          setRouteCoords([]);
          setOsrmDistance(null);
          setOsrmDuration(null);
          // تكبير الخريطة لتشمل نقطتي البداية والوجهة فقط
          if (Platform.OS !== "web" && mapRef.current) {
            setTimeout(() => {
              mapRef.current?.fitToCoordinates([pickupPin, dropPin], {
                edgePadding: { top: 80, right: 50, bottom: 280, left: 50 },
                animated: true,
              });
            }, 300);
          }
        }
      } finally {
        setIsLoadingRoute(false);
      }
    };
    fetchRoute();
  }, [dropPin, pickupPin]);

  const fareQuery = trpc.rides.estimateFare.useQuery(
    {
      pickupLat: pickupPin.latitude,
      pickupLng: pickupPin.longitude,
      dropoffLat: dropPin?.latitude ?? pickupPin.latitude,
      dropoffLng: dropPin?.longitude ?? pickupPin.longitude,
      // تمرير بيانات OSRM الجاهزة للسيرفر لتجنب طلب ثانٍ وتسريع الحساب
      osrmDistanceKm: osrmDistance ?? undefined,
      osrmDurationMin: osrmDuration ?? undefined,
    },
    { enabled: !!dropPin }
  );

  const requestRide = trpc.rides.request.useMutation({
    onSuccess: (data) => {
      router.push({
        pathname: "/ride/tracking",
        params: {
          rideId: data.ride.id,
          passengerId: passenger?.id ?? 0,
          fare: data.ride.fare,
          distance: data.ride.estimatedDistance,
          duration: data.ride.estimatedDuration,
          pickupLat: pickupPin.latitude,
          pickupLng: pickupPin.longitude,
          dropoffLat: dropPin!.latitude,
          dropoffLng: dropPin!.longitude,
          pickupAddress: from,
          dropoffAddress: to,
        },
      });
    },
    onError: (err) => {
      Alert.alert("خطأ", err.message || "فشل في طلب الرحلة، يرجى المحاولة مرة أخرى");
    },
  });

  // البحث النصي مع debounce
  const handleToInputChange = useCallback((text: string) => {
    setToInput(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchNominatim(text, coords.latitude, coords.longitude);
      setSearchResults(results);
      setIsSearching(false);
    }, 600);
   }, [coords.latitude, coords.longitude]);
  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const shortName = shortenAddress(result.display_name);
    setDropPin({ latitude: lat, longitude: lon });
    setTo(shortName);
    setToInput(shortName);
    setSearchResults([]);
    setShowSearch(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
  };

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    if (!addr.lat || !addr.lng) return;
    setDropPin({ latitude: addr.lat, longitude: addr.lng });
    setTo(addr.address);
    setToInput(addr.address);
    setSearchResults([]);
    setShowSearch(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({ latitude: addr.lat, longitude: addr.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
  };

  const handleMapPress = async (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setDropPin(coord);
    setTo("جارٍ تحديد العنوان...");
    setToInput("");
    setShowSearch(false);
    const address = await reverseGeocodeNominatim(coord.latitude, coord.longitude);
    if (address) {
      setTo(address);
      setToInput(address);
    } else {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: coord.latitude, longitude: coord.longitude });
        if (results?.[0]) {
          const r = results[0];
          const parts = [r.street, r.district, r.city].filter(Boolean);
          const addr = parts.length > 0 ? parts.join("، ") : (r.formattedAddress ?? "الوجهة المحددة");
          setTo(addr);
          setToInput(addr);
        } else {
          setTo("الوجهة المحددة");
          setToInput("الوجهة المحددة");
        }
      } catch {
        setTo("الوجهة المحددة");
        setToInput("الوجهة المحددة");
      }
    }
  };

  // بحث موقع الانطلاق
  const handlePickupInputChange = useCallback((text: string) => {
    setPickupInput(text);
    if (pickupSearchTimerRef.current) clearTimeout(pickupSearchTimerRef.current);
    if (text.trim().length < 2) {
      setPickupSearchResults([]);
      setIsPickupSearching(false);
      return;
    }
    setIsPickupSearching(true);
    pickupSearchTimerRef.current = setTimeout(async () => {
      const results = await searchNominatim(text, coords.latitude, coords.longitude);
      setPickupSearchResults(results);
      setIsPickupSearching(false);
    }, 600);
  }, [coords.latitude, coords.longitude]);

  const handleSelectPickupResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const shortName = shortenAddress(result.display_name);
    setPickupPin({ latitude: lat, longitude: lon });
    setFrom(shortName);
    setPickupInput(shortName);
    setPickupSearchResults([]);
    setIsPickupManual(true);
    setShowPickupSearch(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
  };

  const handleSelectPickupSavedAddress = (addr: SavedAddress) => {
    if (!addr.lat || !addr.lng) return;
    setPickupPin({ latitude: addr.lat, longitude: addr.lng });
    setFrom(addr.address);
    setPickupInput(addr.address);
    setPickupSearchResults([]);
    setIsPickupManual(true);
    setShowPickupSearch(false);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({ latitude: addr.lat, longitude: addr.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
  };

  const handleResetPickupToGPS = () => {
    setIsPickupManual(false);
    setPickupInput("");
    setPickupSearchResults([]);
    setShowPickupSearch(false);
    // سيتم تحديث الموقع تلقائياً من useEffect بعد إعادة تعيين isPickupManual = false
    if (isRealLocation) {
      setPickupPin({ latitude: coords.latitude, longitude: coords.longitude });
      reverseGeocodeNominatim(coords.latitude, coords.longitude).then((address) => {
        if (address) setFrom(address);
        else setFrom("موقعي الحالي");
      });
    }
  };

  const handleConfirm = () => {
    if (!dropPin) {
      Alert.alert("تنبيه", "يرجى تحديد وجهتك");
      return;
    }
    const multiplier = rideTypes.find((r) => r.id === selectedRide)?.multiplier ?? 1;
    const quotedFare = fareQuery.data ? Math.round(fareQuery.data.fare * multiplier) : undefined;
    const walletBalance = parseFloat(passenger?.walletBalance ?? "0");
    // إذا كان الرصيد يكفي → اعرض modal اختيار طريقة الدفع
    if (quotedFare && walletBalance >= quotedFare) {
      setShowPaymentModal(true);
      return;
    }
    // وإلا → دفع كاش مباشرة
    submitRide("cash");
  };

  const submitRide = (paymentMethod: "cash" | "wallet") => {
    if (!dropPin) return;
    const multiplier = rideTypes.find((r) => r.id === selectedRide)?.multiplier ?? 1;
    const quotedFare = fareQuery.data ? Math.round(fareQuery.data.fare * multiplier) : undefined;
    const quotedDuration = fareQuery.data?.duration;
    requestRide.mutate({
      passengerId: passenger?.id ?? 1,
      pickupLat: pickupPin.latitude,
      pickupLng: pickupPin.longitude,
      pickupAddress: from,
      dropoffLat: dropPin.latitude,
      dropoffLng: dropPin.longitude,
      dropoffAddress: to,
      paymentMethod,
      quotedFare,
      quotedDuration,
    });
  };

  const getFareDisplay = () => {
    if (!dropPin) return "حدد وجهتك أولاً";
    if (fareQuery.isLoading) return "جاري الحساب...";
    if (!fareQuery.data) return "---";
    const multiplier = rideTypes.find((r) => r.id === selectedRide)?.multiplier ?? 1;
    return `${Math.round(fareQuery.data.fare * multiplier).toLocaleString("ar-IQ")} دينار`;
  };

  const getDistanceDisplay = () => {
    if (osrmDistance !== null && osrmDuration !== null) {
      return `${osrmDistance} كم • ${osrmDuration} دقيقة`;
    }
    if (!fareQuery.data) return "";
    return `${fareQuery.data.distance} كم • ${fareQuery.data.duration} دقيقة`;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {Platform.OS !== "web" ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={MOSUL_CENTER}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
          mapType="standard"
        >
          <Marker coordinate={pickupPin} title="نقطة الانطلاق">
            <View style={styles.pickupMarker}><Text style={{ fontSize: 20 }}>📍</Text></View>
          </Marker>
          {dropPin && (
            <Marker coordinate={dropPin} title="الوجهة">
              <View style={styles.dropMarker}><Text style={{ fontSize: 20 }}>🏁</Text></View>
            </Marker>
          )}
          {/* مسار حقيقي من Mapbox - يظهر فقط عند توفر النقاط الحقيقية */}
          {routeCoords.length >= 2 && (
            <Polyline coordinates={routeCoords} strokeColor="#FFD700" strokeWidth={4} />
          )}
        </MapView>
      ) : (
        <View style={[styles.map, styles.webMap]}>
          <Text style={styles.webMapText}>🗺️</Text>
          <Text style={styles.webMapLabel}>خريطة الموصل</Text>
          <TouchableOpacity style={styles.webSetDestBtn} onPress={() => { setDropPin({ latitude: 36.36, longitude: 43.145 }); setTo("جامعة الموصل"); setToInput("جامعة الموصل"); }}>
            <Text style={styles.webSetDestText}>تحديد وجهة تجريبية</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      {/* مؤشر تحميل المسار الحقيقي */}
      {isLoadingRoute && (
        <View style={[styles.routeLoadingBadge, { top: insets.top + 60 }]}>
          <ActivityIndicator size="small" color="#FFD700" style={{ marginRight: 6 }} />
          <Text style={styles.routeLoadingText}>جاري تحميل المسار...</Text>
        </View>
      )}

      {!dropPin && !showSearch && (
        <View style={[styles.mapHint, { top: insets.top + 60 }]}>
          <Text style={styles.mapHintText}>اضغط على الخريطة أو ابحث عن وجهتك</Text>
        </View>
      )}

      {dropPin && fareQuery.data && !showSearch && (
        <View style={[styles.distanceBadge, { top: insets.top + 60 }]}>
          <Text style={styles.distanceText}>{getDistanceDisplay()}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />

        {/* حقول الموقع */}
        <View style={styles.locationRow}>
          <View style={styles.locationDots}>
            <View style={styles.dotGreen} />
            <View style={styles.dotLine} />
            <View style={styles.dotRed} />
          </View>
          <View style={styles.locationInputs}>
            <View style={[styles.locationInput, { flexDirection: "row", alignItems: "center" }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationLabel}>من</Text>
                <Text style={styles.locationValue} numberOfLines={1}>{from}</Text>
              </View>
              <TouchableOpacity
                style={styles.editPickupBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  setPickupInput(from);
                  setTimeout(() => setShowPickupSearch(true), 100);
                }}
              >
                <Text style={styles.editPickupIcon}>✏️</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputDivider} />
            <View style={[styles.locationInput, { flexDirection: "row", alignItems: "center" }]}>
              <Text style={styles.locationLabel}>إلى</Text>
              <TextInput
                style={[styles.toInput, { flex: 1 }]}
                value={toInput}
                onChangeText={handleToInputChange}
                onFocus={() => setShowSearch(true)}
                placeholder="ابحث عن وجهتك في مدينتك..."
                placeholderTextColor="#6B5A8E"
                returnKeyType="search"
                textAlign="right"
              />
              <TouchableOpacity
                style={[styles.micBtn, recorderState.isRecording && styles.micBtnActive]}
                onPress={handleVoiceSearch}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <Text style={styles.micIcon}>{recorderState.isRecording ? "⏹" : "🎤"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {(to || toInput) ? (
            <TouchableOpacity style={styles.clearBtn} onPress={() => { setDropPin(null); setTo(""); setToInput(""); setSearchResults([]); setShowSearch(false); }}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* قائمة البحث */}
        {showSearch && (
          <View style={styles.searchDropdown}>
            {toInput.trim().length < 2 && (
              <>
                <Text style={styles.searchSectionTitle}>عناوين مفضلة</Text>
                {allSavedAddresses.map((addr) => (
                  <View key={addr.id} style={styles.searchResultItem}>
                    <Text style={styles.searchResultIcon}>{addr.icon}</Text>
                    <TouchableOpacity
                      style={styles.searchResultInfo}
                      onPress={() => addr.lat && addr.lng ? handleSelectSavedAddress(addr) : setEditFavModal({ type: addr.type as "home" | "work" })}
                    >
                      <Text style={styles.searchResultName}>{addr.label}</Text>
                      <Text style={styles.searchResultAddr} numberOfLines={1}>
                        {addr.address || "اضغط لتعيين العنوان"}
                      </Text>
                    </TouchableOpacity>
                    {(addr.type === "home" || addr.type === "work") && (
                      <TouchableOpacity style={styles.editFavBtn} onPress={() => { setFavInput(addr.address || ""); setEditFavModal({ type: addr.type as "home" | "work" }); }}>
                        <Text style={styles.editFavIcon}>✏️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <View style={styles.searchDivider} />
              </>
            )}

            {toInput.trim().length < 2 && (
              <Text style={styles.searchSectionTitle}>نتائج البحث</Text>
            )}

            {isSearching && (
              <View style={styles.searchLoadingRow}>
                <ActivityIndicator color="#FFD700" size="small" />
                <Text style={styles.searchLoadingText}>جاري البحث...</Text>
              </View>
            )}

            {!isSearching && searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.place_id}
                scrollEnabled={false}
                renderItem={({ item }) => {
                  const itemLat = parseFloat(item.lat);
                  const itemLng = parseFloat(item.lon);
                  const distKm = isRealLocation
                    ? calcDistanceKm(coords.latitude, coords.longitude, itemLat, itemLng)
                    : null;
                  return (
                    <TouchableOpacity style={styles.searchResultItem} onPress={() => handleSelectSearchResult(item)}>
                      <Text style={styles.searchResultIcon}>📍</Text>
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName} numberOfLines={1}>{shortenAddress(item.display_name)}</Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={styles.searchResultAddr} numberOfLines={1}>{item.address?.city || item.address?.town || item.address?.state || item.address?.country || ""}</Text>
                          {distKm !== null && (
                            <Text style={styles.searchResultDist}>{distKm} كم</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {!isSearching && toInput.trim().length >= 2 && searchResults.length === 0 && (
              <View style={styles.noResultsBox}>
                <Text style={styles.noResultsText}>لا توجد نتائج. جرب كلمة أخرى أو اضغط على الخريطة</Text>
              </View>
            )}

            <TouchableOpacity style={styles.closeSearchBtn} onPress={() => { setShowSearch(false); Keyboard.dismiss(); }}>
              <Text style={styles.closeSearchText}>إغلاق البحث</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* أنواع الرحلات */}
        {!showSearch && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ridesScroll}>
              {rideTypes.map((ride) => {
                const multiplier = ride.multiplier ?? 1;
                const fare = fareQuery.data ? Math.round(fareQuery.data.fare * multiplier) : null;
                return (
                  <TouchableOpacity
                    key={ride.id}
                    style={[styles.rideCard, selectedRide === ride.id && styles.rideCardActive]}
                    onPress={() => setSelectedRide(ride.id)}
                  >
                    <Text style={styles.rideIcon}>{ride.icon}</Text>
                    <Text style={[styles.rideLabel, selectedRide === ride.id && styles.rideLabelActive]}>{ride.label}</Text>
                    <Text style={[styles.ridePrice, selectedRide === ride.id && styles.ridePriceActive]}>
                      {!dropPin ? "—" : fareQuery.isLoading ? "⏳" : fare ? `${fare.toLocaleString("ar-IQ")} د` : "—"}
                    </Text>
                    <Text style={styles.rideTime}>{ride.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmBtn, (!dropPin || requestRide.isPending || (!!dropPin && (fareQuery.isLoading || !fareQuery.data))) && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!dropPin || requestRide.isPending || (!!dropPin && (fareQuery.isLoading || !fareQuery.data))}
            >
              {requestRide.isPending ? (
                <ActivityIndicator color="#1A0533" />
              ) : (!!dropPin && fareQuery.isLoading) ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#1A0533" size="small" />
                  <Text style={styles.confirmText}>جاري حساب السعر...</Text>
                </View>
              ) : (
                <Text style={styles.confirmText}>
                  {dropPin && fareQuery.data ? `تأكيد الرحلة — ${getFareDisplay()}` : !dropPin ? "حدد وجهتك أو ابحث عنها" : "جاري تحميل السعر..."}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: insets.bottom + 8 }} />
      </View>
      </KeyboardAvoidingView>

      {/* Modal اختيار طريقة الدفع */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: 24 }]}>
            <Text style={[styles.modalTitle, { marginBottom: 6 }]}>اختر طريقة الدفع</Text>
            {(() => {
              const multiplier = rideTypes.find((r) => r.id === selectedRide)?.multiplier ?? 1;
              const fare = fareQuery.data ? Math.round(fareQuery.data.fare * multiplier) : 0;
              const walletBal = parseFloat(passenger?.walletBalance ?? "0");
              return (
                <Text style={{ color: "#9B8EC4", fontSize: 13, textAlign: "center", marginBottom: 20 }}>
                  قيمة الرحلة: {formatIQD(fare)} د.ع{"\n"}رصيدك: {formatIQD(walletBal)} د.ع
                </Text>
              );
            })()}
            {/* خيار كاش */}
            <TouchableOpacity
              style={[styles.payMethodBtn, pendingPaymentMethod === "cash" && styles.payMethodBtnActive]}
              onPress={() => setPendingPaymentMethod("cash")}
            >
              <Text style={styles.payMethodIcon}>💵</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.payMethodLabel, pendingPaymentMethod === "cash" && styles.payMethodLabelActive]}>كاش</Text>
                <Text style={styles.payMethodDesc}>ادفع نقداً للسائق</Text>
              </View>
              <View style={[styles.payRadio, pendingPaymentMethod === "cash" && styles.payRadioActive]} />
            </TouchableOpacity>
            {/* خيار المحفظة */}
            <TouchableOpacity
              style={[styles.payMethodBtn, pendingPaymentMethod === "wallet" && styles.payMethodBtnActive]}
              onPress={() => setPendingPaymentMethod("wallet")}
            >
              <Text style={styles.payMethodIcon}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.payMethodLabel, pendingPaymentMethod === "wallet" && styles.payMethodLabelActive]}>محفظة التطبيق</Text>
                <Text style={styles.payMethodDesc}>رصيدك: {formatIQD(passenger?.walletBalance)} د.ع</Text>
              </View>
              <View style={[styles.payRadio, pendingPaymentMethod === "wallet" && styles.payRadioActive]} />
            </TouchableOpacity>
            <View style={[styles.modalBtns, { marginTop: 20 }]}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPaymentModal(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => { setShowPaymentModal(false); submitRide(pendingPaymentMethod); }}
              >
                <Text style={styles.modalSaveText}>تأكيد الطلب</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal بحث موقع الانطلاق */}
      <Modal
        visible={showPickupSearch}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPickupSearch(false)}
        onShow={() => setTimeout(() => pickupInputRef.current?.focus(), 300)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: 32 }]}>
            <Text style={styles.modalTitle}>تعديل موقع الانطلاق</Text>

            {/* زر إعادة الموقع الحالي */}
            <TouchableOpacity
              style={styles.resetGpsBtn}
              onPress={handleResetPickupToGPS}
            >
              <Text style={styles.resetGpsIcon}>📍</Text>
              <Text style={styles.resetGpsText}>استخدام موقعي الحالي (GPS)</Text>
            </TouchableOpacity>

            {/* حقل بحث */}
            <View style={styles.pickupSearchInputRow}>
              <TextInput
                style={styles.pickupSearchInput}
                value={pickupInput}
                onChangeText={handlePickupInputChange}
                placeholder="ابحث عن موقع الانطلاق..."
                placeholderTextColor="#6B5A8E"
                returnKeyType="search"
                textAlign="right"
                ref={pickupInputRef}
              />
              {pickupInput.length > 0 && (
                <TouchableOpacity
                  style={styles.clearPickupBtn}
                  onPress={() => { setPickupInput(""); setPickupSearchResults([]); }}
                >
                  <Text style={styles.clearPickupText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* نتائج البحث */}
            {isPickupSearching && (
              <View style={styles.searchLoadingRow}>
                <ActivityIndicator color="#FFD700" size="small" />
                <Text style={styles.searchLoadingText}>جاري البحث...</Text>
              </View>
            )}

            {!isPickupSearching && pickupSearchResults.length > 0 && (
              <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                {pickupSearchResults.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.searchResultItem}
                    onPress={() => handleSelectPickupResult(item)}
                  >
                    <Text style={styles.searchResultIcon}>📍</Text>
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName} numberOfLines={1}>{shortenAddress(item.display_name)}</Text>
                      <Text style={styles.searchResultAddr} numberOfLines={1}>
                        {item.address?.city || item.address?.town || item.address?.state || ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* العناوين المحفوظة */}
            {pickupInput.trim().length < 2 && (
              <>
                <Text style={[styles.searchSectionTitle, { marginTop: 12 }]}>عناوين محفوظة</Text>
                <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                  {allSavedAddresses.filter((a) => a.lat && a.lng).map((addr) => (
                    <TouchableOpacity
                      key={addr.id}
                      style={styles.searchResultItem}
                      onPress={() => handleSelectPickupSavedAddress(addr)}
                    >
                      <Text style={styles.searchResultIcon}>{addr.icon}</Text>
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName}>{addr.label}</Text>
                        <Text style={styles.searchResultAddr} numberOfLines={1}>{addr.address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              style={[styles.modalCancelBtn, { marginTop: 16 }]}
              onPress={() => setShowPickupSearch(false)}
            >
              <Text style={styles.modalCancelText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal تعديل عنوان مفضل */}
      <Modal
        visible={!!editFavModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setEditFavModal(null); setFavInput(""); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editFavModal?.type === "home" ? "🏠 تعيين عنوان البيت" : "🏢 تعيين عنوان العمل"}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={favInput}
              onChangeText={setFavInput}
              placeholder="اكتب اسم المنطقة أو الشارع..."
              placeholderTextColor="#6B5A8E"
              textAlign="right"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setEditFavModal(null); setFavInput(""); }}
              >
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => editFavModal && saveFavoriteAddress(editFavModal.type, favInput)}
              >
                <Text style={styles.modalSaveText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  map: { flex: 1 },
  webMap: { backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center", gap: 12 },
  webMapText: { fontSize: 64 },
  webMapLabel: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  webSetDestBtn: { backgroundColor: "#FFD700", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  webSetDestText: { color: "#1A0533", fontWeight: "700", fontSize: 14 },
  backBtn: {
    position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(26,5,51,0.85)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#FFD700",
  },
  backIcon: { color: "#FFD700", fontSize: 18, fontWeight: "bold" },
  mapHint: {
    position: "absolute", alignSelf: "center", backgroundColor: "rgba(26,5,51,0.88)",
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#FFD700",
  },
  mapHintText: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  distanceBadge: {
    position: "absolute", alignSelf: "center", backgroundColor: "rgba(26,5,51,0.9)",
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: "#4CAF50",
  },
  distanceText: { color: "#4CAF50", fontSize: 12, fontWeight: "600" },
  pickupMarker: { alignItems: "center" },
  dropMarker: { alignItems: "center" },
  bottomSheet: {
    backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: "#3D2070",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  handle: { width: 40, height: 4, backgroundColor: "#3D2070", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  locationRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#2D1B4E",
    borderRadius: 16, padding: 12, marginBottom: 12, gap: 12,
  },
  locationDots: { alignItems: "center", gap: 4 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#4CAF50" },
  dotLine: { width: 2, height: 20, backgroundColor: "#3D2070" },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  locationInputs: { flex: 1 },
  locationInput: { paddingVertical: 6 },
  locationLabel: { color: "#9B8EC4", fontSize: 11, marginBottom: 2 },
  locationValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  toInput: {
    color: "#FFFFFF", fontSize: 14, fontWeight: "600",
    padding: 0, margin: 0, height: 22,
  },
  inputDivider: { height: 1, backgroundColor: "#3D2070", marginVertical: 4 },
  clearBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#3D2070", alignItems: "center", justifyContent: "center" },
  clearBtnText: { color: "#9B8EC4", fontSize: 12 },
  searchDropdown: {
    backgroundColor: "#2D1B4E", borderRadius: 16, marginBottom: 12,
    overflow: "hidden", maxHeight: 320,
  },
  searchSectionTitle: {
    color: "#9B8EC4", fontSize: 11, fontWeight: "600",
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, textAlign: "right",
  },
  searchLoadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  searchLoadingText: { color: "#9B8EC4", fontSize: 13 },
  searchResultItem: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
    gap: 10, borderBottomWidth: 1, borderBottomColor: "#3D2070",
  },
  searchResultIcon: { fontSize: 18 },
  searchResultInfo: { flex: 1 },
  searchResultName: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", textAlign: "right" },
  searchResultAddr: { color: "#9B8EC4", fontSize: 11, marginTop: 2, textAlign: "right" },
  searchResultDist: { color: "#FFD700", fontSize: 11, fontWeight: "700", marginLeft: 8 },
  editFavBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  editFavIcon: { fontSize: 14 },
  micBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#3D2070", alignItems: "center", justifyContent: "center", marginLeft: 6 },
  micBtnActive: { backgroundColor: "rgba(239,68,68,0.3)", borderWidth: 1, borderColor: "#EF4444" },
  micIcon: { fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#1A0533", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: "#3D2070" },
  modalTitle: { color: "#FFD700", fontSize: 16, fontWeight: "700", textAlign: "right", marginBottom: 16 },
  modalInput: { backgroundColor: "#2D1B4E", borderRadius: 12, padding: 14, color: "#FFFFFF", fontSize: 14, marginBottom: 16, borderWidth: 1, borderColor: "#3D2070" },
  modalBtns: { flexDirection: "row", gap: 12 },
  modalCancelBtn: { flex: 1, backgroundColor: "#2D1B4E", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  modalCancelText: { color: "#9B8EC4", fontSize: 14, fontWeight: "600" },
  modalSaveBtn: { flex: 1, backgroundColor: "#FFD700", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  modalSaveText: { color: "#1A0533", fontSize: 14, fontWeight: "800" },
  searchDivider: { height: 1, backgroundColor: "#3D2070", marginVertical: 4 },
  noResultsBox: { paddingHorizontal: 14, paddingVertical: 16, alignItems: "center" },
  noResultsText: { color: "#9B8EC4", fontSize: 12, textAlign: "center" },
  closeSearchBtn: { paddingVertical: 10, alignItems: "center", borderTopWidth: 1, borderTopColor: "#3D2070" },
  closeSearchText: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  ridesScroll: { paddingBottom: 4, gap: 12 },
  rideCard: {
    width: 90, backgroundColor: "#2D1B4E", borderRadius: 16, padding: 12,
    alignItems: "center", borderWidth: 2, borderColor: "transparent",
  },
  rideCardActive: { borderColor: "#FFD700", backgroundColor: "rgba(255,215,0,0.1)" },
  rideIcon: { fontSize: 28, marginBottom: 4 },
  rideLabel: { color: "#C4B5D4", fontSize: 13, fontWeight: "600" },
  rideLabelActive: { color: "#FFD700" },
  ridePrice: { color: "#9B8EC4", fontSize: 12, marginTop: 2 },
  ridePriceActive: { color: "#FFD700", fontWeight: "700" },
  rideTime: { color: "#6B5A8E", fontSize: 10, marginTop: 2, textAlign: "center" },
  confirmBtn: {
    backgroundColor: "#FFD700", borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 16,
    shadowColor: "#FFD700", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: "#1A0533", fontSize: 16, fontWeight: "800" },
  routeLoadingBadge: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "rgba(26,5,51,0.88)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  routeLoadingText: { color: "#FFD700", fontSize: 13, fontWeight: "600" },
  payMethodBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#2D1B4E", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 2, borderColor: "transparent",
  },
  payMethodBtnActive: { borderColor: "#FFD700", backgroundColor: "rgba(255,215,0,0.08)" },
  payMethodIcon: { fontSize: 24 },
  payMethodLabel: { color: "#C4B5D4", fontSize: 14, fontWeight: "700", textAlign: "right" },
  payMethodLabelActive: { color: "#FFD700" },
  payMethodDesc: { color: "#6B5A8E", fontSize: 12, marginTop: 2, textAlign: "right" },
  payRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#3D2070", backgroundColor: "transparent" },
  payRadioActive: { borderColor: "#FFD700", backgroundColor: "#FFD700" },
  // بحث موقع الانطلاق
  editPickupBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#3D2070", alignItems: "center", justifyContent: "center", marginLeft: 6 },
  editPickupIcon: { fontSize: 14 },
  resetGpsBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(76,175,80,0.12)", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(76,175,80,0.3)" },
  resetGpsIcon: { fontSize: 18 },
  resetGpsText: { color: "#4CAF50", fontSize: 13, fontWeight: "600", textAlign: "right", flex: 1 },
  pickupSearchInputRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#2D1B4E", borderRadius: 12, borderWidth: 1, borderColor: "#3D2070", marginBottom: 8, paddingHorizontal: 12 },
  pickupSearchInput: { flex: 1, color: "#FFFFFF", fontSize: 14, paddingVertical: 12, textAlign: "right" },
  clearPickupBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#3D2070", alignItems: "center", justifyContent: "center", marginLeft: 6 },
  clearPickupText: { color: "#9B8EC4", fontSize: 11 },
});

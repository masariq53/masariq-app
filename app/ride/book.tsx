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
  type: "home" | "work" | "custom";
  label: string;
  address: string;
  icon: string;
  lat?: number;
  lng?: number;
};

async function searchNominatim(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const encoded = encodeURIComponent(query);
    // بحث حر عالمي بدون قيود جغرافية - مثل Waze / Google Maps
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=8&addressdetails=1&accept-language=ar`;
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
  const mapRef = useRef<MapView>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تحميل العناوين المحفوظة
  useEffect(() => {
    AsyncStorage.getItem("@masar_saved_addresses").then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as SavedAddress[];
          setSavedAddresses(parsed.filter((a) => a.lat && a.lng));
        } catch {}
      }
    });
  }, []);

  // تحديث موقع الانطلاق بـ GPS + Reverse Geocoding
  useEffect(() => {
    if (!isRealLocation) return;
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

  // جلب مسار الطريق الحقيقي من OSRM عند تحديد الوجهة
  useEffect(() => {
    if (!dropPin) {
      setRouteCoords([]);
      return;
    }
    const fetchRoute = async () => {
      const result = await fetchOsrmRoute(pickupPin, dropPin);
      if (result) {
        setRouteCoords(result.coords);
        setOsrmDistance(result.distanceKm);
        setOsrmDuration(result.durationMin);
      } else {
        // fallback: خط مستقيم
        setRouteCoords([pickupPin, dropPin]);
        setOsrmDistance(null);
        setOsrmDuration(null);
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
      const results = await searchNominatim(text);
      setSearchResults(results);
      setIsSearching(false);
    }, 600);
  }, []);

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

  const handleConfirm = () => {
    if (!dropPin) {
      Alert.alert("تنبيه", "يرجى تحديد وجهتك");
      return;
    }
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
      paymentMethod: "cash",
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
          {routeCoords.length >= 2 && (
            <Polyline coordinates={routeCoords} strokeColor="#FFD700" strokeWidth={4} />
          )}
          {routeCoords.length < 2 && dropPin && (
            <Polyline coordinates={[pickupPin, dropPin]} strokeColor="#FFD700" strokeWidth={3} lineDashPattern={[8, 4]} />
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
        keyboardVerticalOffset={0}
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
            <TouchableOpacity style={styles.locationInput}>
              <Text style={styles.locationLabel}>من</Text>
              <Text style={styles.locationValue} numberOfLines={1}>{from}</Text>
            </TouchableOpacity>
            <View style={styles.inputDivider} />
            <View style={styles.locationInput}>
              <Text style={styles.locationLabel}>إلى</Text>
              <TextInput
                style={styles.toInput}
                value={toInput}
                onChangeText={handleToInputChange}
                onFocus={() => setShowSearch(true)}
                placeholder="ابحث عن وجهتك..."
                placeholderTextColor="#6B5A8E"
                returnKeyType="search"
                textAlign="right"
              />
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
            {toInput.trim().length < 2 && savedAddresses.length > 0 && (
              <>
                <Text style={styles.searchSectionTitle}>عناوين محفوظة</Text>
                {savedAddresses.map((addr) => (
                  <TouchableOpacity key={addr.id} style={styles.searchResultItem} onPress={() => handleSelectSavedAddress(addr)}>
                    <Text style={styles.searchResultIcon}>{addr.icon}</Text>
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{addr.label}</Text>
                      <Text style={styles.searchResultAddr} numberOfLines={1}>{addr.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <View style={styles.searchDivider} />
              </>
            )}

            {toInput.trim().length < 2 && (
              <Text style={styles.searchSectionTitle}>ابحث عن أي موقع في العالم</Text>
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
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.searchResultItem} onPress={() => handleSelectSearchResult(item)}>
                    <Text style={styles.searchResultIcon}>📍</Text>
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName} numberOfLines={1}>{shortenAddress(item.display_name)}</Text>
                      <Text style={styles.searchResultAddr} numberOfLines={1}>{item.address?.city || item.address?.town || item.address?.state || item.address?.country || ""}</Text>
                    </View>
                  </TouchableOpacity>
                )}
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
});

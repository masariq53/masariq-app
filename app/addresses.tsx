import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useThemeContext } from "@/lib/theme-provider";

const ADDRESSES_KEY = "@masar_saved_addresses";

type AddressType = "home" | "work" | "other";

interface SavedAddress {
  id: string;
  type: AddressType;
  label: string;
  address: string;
  icon: string;
  lat?: number;
  lng?: number;
}

interface NominatimResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

const defaultAddresses: SavedAddress[] = [
  { id: "home", type: "home", label: "البيت", address: "", icon: "🏠" },
  { id: "work", type: "work", label: "العمل", address: "", icon: "🏢" },
];

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  const [addresses, setAddresses] = useState<SavedAddress[]>(defaultAddresses);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);

  // Form state inside modal
  const [labelValue, setLabelValue] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<NominatimResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<"search" | "gps">("search");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const colors = {
    bg: isDark ? "#0D0019" : "#F5F7FA",
    card: isDark ? "#1E0F4A" : "#FFFFFF",
    cardBorder: isDark ? "#2D1B69" : "#F0F0F0",
    title: isDark ? "#FFFFFF" : "#1A0533",
    subtitle: isDark ? "#9B8AB0" : "#6B7A8D",
    emptyText: isDark ? "#4D3A6A" : "#C0C8D4",
    inputBg: isDark ? "#2D1B69" : "#F5F7FA",
    inputText: isDark ? "#FFFFFF" : "#1A0533",
    inputBorder: isDark ? "#3D2580" : "#E2E8F0",
    placeholder: isDark ? "#6B5A8A" : "#9BA1A6",
    modalBg: isDark ? "#1A0533" : "#FFFFFF",
    resultBg: isDark ? "#2D1B69" : "#F8F5FF",
    resultBorder: isDark ? "#3D2580" : "#E8E0F8",
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const saved = await AsyncStorage.getItem(ADDRESSES_KEY);
      if (saved) {
        const parsed: SavedAddress[] = JSON.parse(saved);
        const merged = defaultAddresses.map((def) => {
          const found = parsed.find((p) => p.id === def.id);
          return found || def;
        });
        const extras = parsed.filter((p) => p.type === "other");
        setAddresses([...merged, ...extras]);
      }
    } catch (e) {
      console.error("Error loading addresses", e);
    }
  };

  const saveAddresses = async (updated: SavedAddress[]) => {
    try {
      await AsyncStorage.setItem(ADDRESSES_KEY, JSON.stringify(updated));
      setAddresses(updated);
    } catch (e) {
      console.error("Error saving addresses", e);
    }
  };

  const openEdit = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setLabelValue(addr.type !== "other" ? addr.label : addr.label === addr.label ? addr.label : "");
    setSearchText(addr.address || "");
    setSelectedResult(
      addr.address && addr.lat && addr.lng
        ? { place_id: addr.id, display_name: addr.address, lat: String(addr.lat), lon: String(addr.lng) }
        : null
    );
    setSearchResults([]);
    setInputMode("search");
    setModalVisible(true);
  };

  const openAddNew = () => {
    const newAddr: SavedAddress = {
      id: Date.now().toString(),
      type: "other",
      label: "",
      address: "",
      icon: "📍",
    };
    setEditingAddress(newAddr);
    setLabelValue("");
    setSearchText("");
    setSelectedResult(null);
    setSearchResults([]);
    setInputMode("search");
    setModalVisible(true);
  };

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    setSelectedResult(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const encoded = encodeURIComponent(text.trim());
        const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&accept-language=ar&countrycodes=iq`;
        const res = await fetch(url, { headers: { "User-Agent": "MasarApp/1.0" } });
        if (res.ok) {
          const data: NominatimResult[] = await res.json();
          setSearchResults(data);
        }
      } catch {}
      setIsSearching(false);
    }, 500);
  }, []);

  const handleSelectResult = (result: NominatimResult) => {
    setSelectedResult(result);
    setSearchText(result.display_name);
    setSearchResults([]);
    Keyboard.dismiss();
  };

  const handleUseGPS = async () => {
    setIsGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تنبيه", "يرجى السماح للتطبيق بالوصول للموقع");
        setIsGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      // Reverse geocode
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ar`;
      const res = await fetch(url, { headers: { "User-Agent": "MasarApp/1.0" } });
      let displayName = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      if (res.ok) {
        const data = await res.json();
        if (data?.display_name) displayName = data.display_name;
      }

      const gpsResult: NominatimResult = {
        place_id: "gps",
        display_name: displayName,
        lat: String(latitude),
        lon: String(longitude),
      };
      setSelectedResult(gpsResult);
      setSearchText(displayName);
      setSearchResults([]);
      setInputMode("gps");
    } catch (e) {
      Alert.alert("خطأ", "تعذر تحديد موقعك، حاول مرة أخرى");
    }
    setIsGpsLoading(false);
  };

  const handleSave = async () => {
    const finalLabel = labelValue.trim();
    const finalAddress = searchText.trim();

    if (!finalAddress) {
      Alert.alert("تنبيه", "يرجى إدخال العنوان أو اختياره من المقترحات");
      return;
    }
    if (editingAddress?.type === "other" && !finalLabel) {
      Alert.alert("تنبيه", "يرجى إدخال اسم للعنوان");
      return;
    }

    const lat = selectedResult ? parseFloat(selectedResult.lat) : undefined;
    const lng = selectedResult ? parseFloat(selectedResult.lon) : undefined;

    const newAddr: SavedAddress = {
      ...editingAddress!,
      address: finalAddress,
      label: editingAddress!.type !== "other" ? editingAddress!.label : finalLabel,
      ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
    };

    const exists = addresses.find((a) => a.id === newAddr.id);
    let newList: SavedAddress[];
    if (exists) {
      newList = addresses.map((a) => (a.id === newAddr.id ? newAddr : a));
    } else {
      newList = [...addresses, newAddr];
    }

    await saveAddresses(newList);
    setModalVisible(false);
    setEditingAddress(null);
  };

  const handleDelete = (id: string) => {
    const addr = addresses.find((a) => a.id === id);
    if (addr?.type !== "other") {
      const newList = addresses.map((a) => (a.id === id ? { ...a, address: "", lat: undefined, lng: undefined } : a));
      saveAddresses(newList);
      return;
    }
    Alert.alert("حذف العنوان", "هل تريد حذف هذا العنوان؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: () => {
          const newList = addresses.filter((a) => a.id !== id);
          saveAddresses(newList);
        },
      },
    ]);
  };

  const isNewAddress = editingAddress
    ? !addresses.find((a) => a.id === editingAddress.id) || editingAddress.type === "other"
    : false;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#1A0533" : "#F5F7FA" }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: isDark ? "#1A0533" : "#1A0533" }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>عناويني المحفوظة</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { backgroundColor: colors.bg }]}
        style={{ backgroundColor: colors.bg }}
        ListHeaderComponent={
          <View style={[styles.infoBanner, { backgroundColor: isDark ? "#1E0F4A" : "#E8E0F8" }]}>
            <Text style={styles.infoEmoji}>💡</Text>
            <Text style={[styles.infoText, { color: isDark ? "#C4B5D4" : "#2D1B69" }]}>
              احفظ عناوينك المفضلة لتسريع طلب الرحلات
            </Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.addNewBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={openAddNew}
          >
            <Text style={styles.addNewIcon}>+</Text>
            <Text style={[styles.addNewText, { color: colors.title }]}>إضافة عنوان جديد</Text>
          </TouchableOpacity>
        }
        renderItem={({ item: addr }) => (
          <View style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={[styles.addrIconBox, { backgroundColor: isDark ? "#2D1B69" : "#F0EBF8" }]}>
              <Text style={styles.addrIcon}>{addr.icon}</Text>
            </View>
            <View style={styles.addrInfo}>
              <Text style={[styles.addrLabel, { color: colors.title }]}>{addr.label}</Text>
              {addr.address ? (
                <Text style={[styles.addrText, { color: colors.subtitle }]} numberOfLines={2}>
                  {addr.address}
                </Text>
              ) : (
                <Text style={[styles.addrEmpty, { color: colors.emptyText }]}>لم يُضف بعد — اضغط إضافة</Text>
              )}
              {addr.lat && addr.lng && (
                <Text style={[styles.addrGps, { color: isDark ? "#FFD700" : "#7C3AED" }]}>
                  📍 تم تحديد الموقع بدقة
                </Text>
              )}
            </View>
            <View style={styles.addrActions}>
              <TouchableOpacity style={styles.editAddrBtn} onPress={() => openEdit(addr)}>
                <Text style={styles.editAddrBtnText}>{addr.address ? "تعديل" : "إضافة"}</Text>
              </TouchableOpacity>
              {addr.address && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(addr.id)}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setModalVisible(false); Keyboard.dismiss(); }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => { Keyboard.dismiss(); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.modalBg }]}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />

            <Text style={[styles.modalTitle, { color: colors.title }]}>
              {editingAddress?.type !== "other"
                ? `تعديل عنوان ${editingAddress?.label}`
                : isNewAddress
                ? "إضافة عنوان جديد"
                : "تعديل العنوان"}
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 420 }}
            >
              {/* Label for "other" type */}
              {editingAddress?.type === "other" && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.inputLabel, { color: colors.subtitle }]}>اسم العنوان</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                    placeholder="مثال: بيت الأهل، الجامعة، المستشفى..."
                    placeholderTextColor={colors.placeholder}
                    value={labelValue}
                    onChangeText={setLabelValue}
                    textAlign="right"
                    returnKeyType="next"
                  />
                </View>
              )}

              {/* GPS Button */}
              <TouchableOpacity
                style={[styles.gpsBtn, { backgroundColor: isDark ? "#2D1B69" : "#EDE9FE" }]}
                onPress={handleUseGPS}
                disabled={isGpsLoading}
              >
                {isGpsLoading ? (
                  <ActivityIndicator size="small" color="#FFD700" />
                ) : (
                  <Text style={styles.gpsBtnIcon}>📍</Text>
                )}
                <Text style={[styles.gpsBtnText, { color: isDark ? "#C4B5D4" : "#5B21B6" }]}>
                  {isGpsLoading ? "جاري تحديد موقعك..." : "استخدم موقعي الحالي (GPS)"}
                </Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.inputBorder }]} />
                <Text style={[styles.dividerText, { color: colors.subtitle }]}>أو ابحث يدوياً</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.inputBorder }]} />
              </View>

              {/* Search Input */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.inputLabel, { color: colors.subtitle }]}>ابحث عن العنوان</Text>
                <View style={[styles.searchInputRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <TextInput
                    style={[styles.searchInput, { color: colors.inputText }]}
                    placeholder="اكتب اسم المكان أو الحي..."
                    placeholderTextColor={colors.placeholder}
                    value={searchText}
                    onChangeText={handleSearchChange}
                    textAlign="right"
                    returnKeyType="search"
                    autoCorrect={false}
                  />
                  {isSearching && <ActivityIndicator size="small" color="#FFD700" style={{ marginLeft: 8 }} />}
                  {searchText.length > 0 && !isSearching && (
                    <TouchableOpacity onPress={() => { setSearchText(""); setSearchResults([]); setSelectedResult(null); }}>
                      <Text style={{ color: colors.subtitle, fontSize: 16, paddingHorizontal: 8 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <View style={[styles.resultsContainer, { backgroundColor: colors.resultBg, borderColor: colors.resultBorder }]}>
                    {searchResults.map((result) => (
                      <TouchableOpacity
                        key={result.place_id}
                        style={[styles.resultItem, { borderBottomColor: colors.resultBorder }]}
                        onPress={() => handleSelectResult(result)}
                      >
                        <Text style={styles.resultIcon}>📌</Text>
                        <Text style={[styles.resultText, { color: colors.title }]} numberOfLines={2}>
                          {result.display_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Selected indicator */}
                {selectedResult && (
                  <View style={[styles.selectedBadge, { backgroundColor: isDark ? "#1A3A1A" : "#F0FDF4" }]}>
                    <Text style={styles.selectedIcon}>✅</Text>
                    <Text style={[styles.selectedText, { color: isDark ? "#4ADE80" : "#166534" }]} numberOfLines={1}>
                      تم اختيار الموقع
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.inputBorder }]}
                onPress={() => { setModalVisible(false); Keyboard.dismiss(); }}
              >
                <Text style={[styles.modalCancelText, { color: colors.subtitle }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
                <Text style={styles.modalSaveText}>حفظ العنوان</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  backText: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  listContent: { paddingBottom: 40 },
  infoBanner: {
    flexDirection: "row", alignItems: "center",
    margin: 16, borderRadius: 14, padding: 14, gap: 10,
  },
  infoEmoji: { fontSize: 20 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20, textAlign: "right" },
  addrCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, padding: 14, borderWidth: 1, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  addrIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  addrIcon: { fontSize: 24 },
  addrInfo: { flex: 1, alignItems: "flex-end" },
  addrLabel: { fontSize: 15, fontWeight: "700" },
  addrText: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  addrEmpty: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  addrGps: { fontSize: 11, marginTop: 3, fontWeight: "600" },
  addrActions: { alignItems: "center", gap: 6 },
  editAddrBtn: {
    backgroundColor: "#FFD700", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  editAddrBtnText: { color: "#1A0533", fontSize: 12, fontWeight: "700" },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
  },
  deleteBtnText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
  addNewBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    margin: 16, borderRadius: 16, padding: 16, borderWidth: 1.5,
    borderStyle: "dashed", gap: 8,
  },
  addNewIcon: { color: "#FFD700", fontSize: 22, fontWeight: "700" },
  addNewText: { fontSize: 15, fontWeight: "700" },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalDismissArea: { flex: 1 },
  modalContent: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 32, gap: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  fieldGroup: { gap: 6, marginBottom: 4 },
  inputLabel: { fontSize: 13, fontWeight: "600", textAlign: "right" },
  textInput: {
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, borderWidth: 1.5,
  },
  gpsBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 14, paddingVertical: 14, gap: 8, marginBottom: 4,
  },
  gpsBtnIcon: { fontSize: 18 },
  gpsBtnText: { fontSize: 14, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "600" },
  searchInputRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14 },
  resultsContainer: {
    borderRadius: 12, borderWidth: 1, marginTop: 4,
    overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row", alignItems: "flex-start",
    padding: 12, gap: 8, borderBottomWidth: 0.5,
  },
  resultIcon: { fontSize: 14, marginTop: 2 },
  resultText: { flex: 1, fontSize: 13, lineHeight: 18, textAlign: "right" },
  selectedBadge: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 10, padding: 8, gap: 6, marginTop: 4,
  },
  selectedIcon: { fontSize: 14 },
  selectedText: { flex: 1, fontSize: 12, fontWeight: "600", textAlign: "right" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, borderRadius: 14, paddingVertical: 14,
    alignItems: "center", borderWidth: 1.5,
  },
  modalCancelText: { fontSize: 15, fontWeight: "600" },
  modalSaveBtn: {
    flex: 2, backgroundColor: "#FFD700", borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
  },
  modalSaveText: { color: "#1A0533", fontSize: 15, fontWeight: "800" },
});

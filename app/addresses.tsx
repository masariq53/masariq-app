import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemeContext } from "@/lib/theme-provider";

const ADDRESSES_KEY = "@masar_saved_addresses";

type AddressType = "home" | "work" | "other";

interface SavedAddress {
  id: string;
  type: AddressType;
  label: string;
  address: string;
  icon: string;
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
  const [inputValue, setInputValue] = useState("");
  const [labelValue, setLabelValue] = useState("");

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
    modalTitle: isDark ? "#FFFFFF" : "#1A0533",
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      const saved = await AsyncStorage.getItem(ADDRESSES_KEY);
      if (saved) {
        const parsed: SavedAddress[] = JSON.parse(saved);
        // Merge with defaults to ensure home/work always exist
        const merged = defaultAddresses.map((def) => {
          const found = parsed.find((p) => p.id === def.id);
          return found || def;
        });
        // Add any extra "other" addresses
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
    setInputValue(addr.address);
    setLabelValue(addr.label);
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
    setInputValue("");
    setLabelValue("");
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!inputValue.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال العنوان");
      return;
    }
    if (!labelValue.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال اسم العنوان");
      return;
    }

    const updated = editingAddress!;
    const newAddr: SavedAddress = {
      ...updated,
      address: inputValue.trim(),
      label: updated.type !== "other" ? updated.label : labelValue.trim(),
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
      // For home/work, just clear the address
      const newList = addresses.map((a) =>
        a.id === id ? { ...a, address: "" } : a
      );
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>عناويني المحفوظة</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.bg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: isDark ? "#1E0F4A" : "#E8E0F8" }]}>
          <Text style={styles.infoEmoji}>💡</Text>
          <Text style={[styles.infoText, { color: isDark ? "#C4B5D4" : "#2D1B69" }]}>
            احفظ عناوينك المفضلة لتسريع طلب الرحلات
          </Text>
        </View>

        {/* Addresses List */}
        <View style={styles.section}>
          {addresses.map((addr) => (
            <View key={addr.id} style={[styles.addrCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.addrLeft}>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(addr.id)}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.addrInfo}>
                <Text style={[styles.addrLabel, { color: colors.title }]}>{addr.label}</Text>
                {addr.address ? (
                  <Text style={[styles.addrText, { color: colors.subtitle }]} numberOfLines={1}>
                    {addr.address}
                  </Text>
                ) : (
                  <Text style={[styles.addrEmpty, { color: colors.emptyText }]}>
                    لم يُضف بعد
                  </Text>
                )}
              </View>
              <View style={[styles.addrIconBox, { backgroundColor: isDark ? "#2D1B69" : "#F0EBF8" }]}>
                <Text style={styles.addrIcon}>{addr.icon}</Text>
              </View>
              <TouchableOpacity
                style={styles.editAddrBtn}
                onPress={() => openEdit(addr)}
              >
                <Text style={styles.editAddrBtnText}>
                  {addr.address ? "تعديل" : "إضافة"}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Add New */}
        <TouchableOpacity
          style={[styles.addNewBtn, { backgroundColor: isDark ? "#1E0F4A" : "#FFFFFF", borderColor: isDark ? "#2D1B69" : "#E2E8F0" }]}
          onPress={openAddNew}
        >
          <Text style={styles.addNewIcon}>+</Text>
          <Text style={[styles.addNewText, { color: colors.title }]}>إضافة عنوان جديد</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.modalBg }]}>
            <Text style={[styles.modalTitle, { color: colors.modalTitle }]}>
              {editingAddress?.type === "other" && !addresses.find(a => a.id === editingAddress.id)
                ? "إضافة عنوان جديد"
                : `تعديل عنوان ${editingAddress?.label}`}
            </Text>

            {editingAddress?.type === "other" && (
              <>
                <Text style={[styles.inputLabel, { color: colors.subtitle }]}>اسم العنوان</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
                  placeholder="مثال: بيت الأهل، الجامعة..."
                  placeholderTextColor={colors.placeholder}
                  value={labelValue}
                  onChangeText={setLabelValue}
                  textAlign="right"
                />
              </>
            )}

            <Text style={[styles.inputLabel, { color: colors.subtitle }]}>العنوان التفصيلي</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMulti, { backgroundColor: colors.inputBg, color: colors.inputText, borderColor: colors.inputBorder }]}
              placeholder="مثال: حي الجامعة، شارع الأطباء، بجانب مسجد..."
              placeholderTextColor={colors.placeholder}
              value={inputValue}
              onChangeText={setInputValue}
              textAlign="right"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: isDark ? "#2D1B69" : "#E2E8F0" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.subtitle }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "#1A0533",
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center",
  },
  backText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  scroll: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  infoBanner: {
    flexDirection: "row", alignItems: "center", margin: 16,
    borderRadius: 14, padding: 14, gap: 10,
  },
  infoEmoji: { fontSize: 20 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 20, textAlign: "right" },
  section: { paddingHorizontal: 16, gap: 10 },
  addrCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 16,
    padding: 14, borderWidth: 1, gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  addrLeft: { alignItems: "center" },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
  },
  deleteBtnText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
  addrInfo: { flex: 1, alignItems: "flex-end" },
  addrLabel: { fontSize: 15, fontWeight: "700" },
  addrText: { fontSize: 12, marginTop: 2 },
  addrEmpty: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  addrIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  addrIcon: { fontSize: 22 },
  editAddrBtn: {
    backgroundColor: "#FFD700", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  editAddrBtnText: { color: "#1A0533", fontSize: 12, fontWeight: "700" },
  addNewBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    margin: 16, borderRadius: 16, padding: 16, borderWidth: 1.5,
    borderStyle: "dashed", gap: 8,
  },
  addNewIcon: { color: "#FFD700", fontSize: 22, fontWeight: "700" },
  addNewText: { fontSize: 15, fontWeight: "700" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  inputLabel: { fontSize: 13, fontWeight: "600", textAlign: "right" },
  textInput: {
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, borderWidth: 1.5, textAlign: "right",
  },
  textInputMulti: { minHeight: 80, textAlignVertical: "top" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
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

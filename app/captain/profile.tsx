import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useDriver } from "@/lib/driver-context";
import { trpc } from "@/lib/trpc";

export default function CaptainProfileScreen() {
  const insets = useSafeAreaInsets();
  const { driver, updateDriver, logout } = useDriver();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(driver?.name ?? "");
  const [uploading, setUploading] = useState(false);

  const uploadPhotoMutation = trpc.driver.uploadDocument.useMutation();
  const updateProfileMutation = trpc.passenger.updateName.useMutation();

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("تنبيه", "يرجى السماح بالوصول إلى مكتبة الصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;

    setUploading(true);
    try {
      const res = await uploadPhotoMutation.mutateAsync({
        phone: driver?.phone ?? "",
        documentType: "photo",
        base64: asset.base64,
        mimeType: "image/jpeg",
      });
      await updateDriver({ photoUrl: res.url });
      Alert.alert("تم", "تم تحديث الصورة بنجاح ✅");
    } catch (e) {
      Alert.alert("خطأ", "فشل رفع الصورة، حاول مرة أخرى");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert("تنبيه", "الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    try {
      await updateDriver({ name: name.trim() });
      setIsEditing(false);
      Alert.alert("تم", "تم تحديث الاسم بنجاح ✅");
    } catch (e) {
      Alert.alert("خطأ", "فشل تحديث الاسم");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "تسجيل الخروج",
      "هل أنت متأكد من تسجيل الخروج من حساب الكابتن؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "خروج",
          style: "destructive",
          onPress: async () => {
            // Only logout from driver session - passenger session stays
            await logout();
            router.replace("/(tabs)/profile" as any);
          },
        },
      ]
    );
  };

  const vehicleTypeLabel = {
    sedan: "سيدان",
    suv: "SUV",
    minivan: "ميني فان",
  }[driver?.vehicleType ?? "sedan"] ?? "سيارة";

  const statusColor = {
    approved: "#22C55E",
    pending: "#F59E0B",
    rejected: "#EF4444",
  }[driver?.registrationStatus ?? "pending"] ?? "#F59E0B";

  const statusLabel = {
    approved: "✅ حساب معتمد",
    pending: "⏳ قيد المراجعة",
    rejected: "❌ مرفوض",
  }[driver?.registrationStatus ?? "pending"] ?? "⏳ قيد المراجعة";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>بروفايل الكابتن</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => {
            if (isEditing) {
              handleSaveName();
            } else {
              setIsEditing(true);
              setName(driver?.name ?? "");
            }
          }}
        >
          <Text style={styles.editBtnText}>{isEditing ? "حفظ" : "تعديل"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickPhoto} disabled={uploading}>
            {driver?.photoUrl ? (
              <Image source={{ uri: driver.photoUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {driver?.name?.charAt(0) ?? "ك"}
                </Text>
              </View>
            )}
            {uploading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#FFD700" />
              </View>
            ) : (
              <View style={styles.avatarEditBadge}>
                <Text style={{ fontSize: 14 }}>📷</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المعلومات الشخصية</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>الاسم</Text>
              {isEditing ? (
                <TextInput
                  style={styles.fieldInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="أدخل اسمك"
                  placeholderTextColor="#6B7280"
                  textAlign="right"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                />
              ) : (
                <Text style={styles.fieldValue}>{driver?.name ?? "—"}</Text>
              )}
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>رقم الهاتف</Text>
              <Text style={styles.fieldValue}>{driver?.phone ?? "—"}</Text>
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>التقييم</Text>
              <Text style={styles.fieldValue}>⭐ {driver?.rating ?? "4.9"}</Text>
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>إجمالي الرحلات</Text>
              <Text style={styles.fieldValue}>{driver?.totalRides ?? 0} رحلة</Text>
            </View>
          </View>
        </View>

        {/* Vehicle Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات السيارة</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>نوع السيارة</Text>
              <Text style={styles.fieldValue}>{vehicleTypeLabel}</Text>
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>الموديل</Text>
              <Text style={styles.fieldValue}>{driver?.vehicleModel ?? "—"}</Text>
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>اللون</Text>
              <Text style={styles.fieldValue}>{driver?.vehicleColor ?? "—"}</Text>
            </View>
            <View style={styles.fieldDivider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>رقم اللوحة</Text>
              <Text style={styles.fieldValue}>{driver?.vehiclePlate ?? "—"}</Text>
            </View>
          </View>
        </View>

        {/* Wallet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المحفظة</Text>
          <View style={[styles.card, styles.walletCard]}>
            <View>
              <Text style={styles.walletLabel}>الرصيد الحالي</Text>
              <Text style={styles.walletAmount}>
                {parseFloat(driver?.walletBalance ?? "0").toLocaleString("ar-IQ")}
              </Text>
              <Text style={styles.walletCurrency}>دينار عراقي</Text>
            </View>
            <TouchableOpacity style={styles.earningsBtn} onPress={() => router.push("/captain/earnings" as any)}>
              <Text style={styles.earningsBtnText}>📊 الأرباح</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>تسجيل الخروج من حساب الكابتن</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0A1E" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#1E1035",
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#1E1035", alignItems: "center", justifyContent: "center",
  },
  backIcon: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  editBtn: {
    backgroundColor: "#FFD700", paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
  },
  editBtnText: { color: "#1A0533", fontWeight: "800", fontSize: 14 },

  avatarSection: { alignItems: "center", paddingVertical: 28 },
  avatarWrapper: { position: "relative", marginBottom: 12 },
  avatarImg: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: "#FFD700",
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#2D1B4E", borderWidth: 3, borderColor: "#FFD700",
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { fontSize: 40, fontWeight: "900", color: "#FFD700" },
  avatarOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 50, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  avatarEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#0F0A1E",
  },
  statusBadge: {
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  statusText: { fontSize: 14, fontWeight: "700" },

  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { color: "#9B8EC4", fontSize: 13, fontWeight: "700", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },

  card: {
    backgroundColor: "#1E1035", borderRadius: 18,
    borderWidth: 1, borderColor: "#2D1B4E", overflow: "hidden",
  },
  fieldRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 14,
  },
  fieldLabel: { color: "#9B8EC4", fontSize: 14 },
  fieldValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  fieldInput: {
    color: "#FFFFFF", fontSize: 14, fontWeight: "600",
    borderBottomWidth: 1, borderBottomColor: "#FFD700",
    minWidth: 140, textAlign: "right", paddingBottom: 2,
  },
  fieldDivider: { height: 1, backgroundColor: "#2D1B4E", marginHorizontal: 18 },

  walletCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20,
  },
  walletLabel: { color: "#9B8EC4", fontSize: 13, marginBottom: 4 },
  walletAmount: { color: "#22C55E", fontSize: 32, fontWeight: "900" },
  walletCurrency: { color: "#6B7280", fontSize: 12 },
  earningsBtn: {
    backgroundColor: "#2D1B4E", paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "#FFD700",
  },
  earningsBtnText: { color: "#FFD700", fontWeight: "700", fontSize: 14 },

  logoutBtn: {
    backgroundColor: "#2D1B4E", borderRadius: 16, paddingVertical: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#EF4444",
  },
  logoutText: { color: "#EF4444", fontWeight: "700", fontSize: 15 },
});

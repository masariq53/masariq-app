import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { ScreenContainer } from "@/components/screen-container";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";

export default function EditProfileScreen() {
  const router = useRouter();
  const { passenger, setPassenger } = usePassenger();

  const [photoUri, setPhotoUri] = useState<string | null>(passenger?.photoUrl || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const uploadPhotoMutation = trpc.passenger.uploadPhoto.useMutation();

  // ─── Pick photo from gallery ───────────────────────────────────────────────
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("إذن مطلوب", "يرجى السماح بالوصول إلى مكتبة الصور");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    // Resize to max 400x400 to reduce upload size
    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 400, height: 400 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!manipulated.base64) {
      Alert.alert("خطأ", "فشل في معالجة الصورة");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const res = await uploadPhotoMutation.mutateAsync({
        passengerId: passenger!.id,
        base64: manipulated.base64,
        mimeType: "image/jpeg",
      });

      setPhotoUri(res.photoUrl);
      if (passenger) {
        await setPassenger({ ...passenger, photoUrl: res.photoUrl });
      }
      Alert.alert("✅ تم", "تم تحديث صورة الملف الشخصي بنجاح");
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في رفع الصورة");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const getInitial = () => {
    const n = passenger?.name;
    return n ? n.charAt(0).toUpperCase() : "م";
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعديل الملف الشخصي</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickPhoto} style={styles.avatarContainer} disabled={isUploadingPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{getInitial()}</Text>
              </View>
            )}
            {isUploadingPhoto ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <View style={styles.cameraIcon}>
                <Text style={styles.cameraEmoji}>📷</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>اضغط لتغيير الصورة</Text>
        </View>

        {/* Info Section - Read Only */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>الاسم</Text>
            <Text style={styles.infoValue}>{passenger?.name || "—"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>رقم الهاتف</Text>
            <Text style={styles.infoValue}>{passenger?.phone ? `+964 ${passenger.phone}` : "—"}</Text>
          </View>
        </View>

        {/* Change Phone Button */}
        <TouchableOpacity
          style={styles.changePhoneBtn}
          onPress={() => router.push("/profile/change-phone" as any)}
        >
          <Text style={styles.changePhoneBtnText}>🔄  تغيير رقم الهاتف</Text>
        </TouchableOpacity>

        <Text style={styles.phoneHint}>
          تغيير الرقم يتطلب التحقق عبر OTP من رقمك الحالي ثم الجديد
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a0533",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    color: "#fff",
    fontSize: 20,
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  content: {
    padding: 20,
    gap: 20,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    position: "relative",
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1a0533",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#f0c040",
    fontSize: 44,
    fontWeight: "700",
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 55,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f0c040",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  cameraEmoji: {
    fontSize: 16,
  },
  avatarHint: {
    marginTop: 10,
    color: "#687076",
    fontSize: 13,
  },
  infoSection: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: "#687076",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 15,
    color: "#1a0533",
    fontWeight: "600",
    textAlign: "right",
  },
  divider: {
    height: 1,
    backgroundColor: "#F5F7FA",
  },
  changePhoneBtn: {
    backgroundColor: "#1a0533",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  changePhoneBtnText: {
    color: "#f0c040",
    fontSize: 15,
    fontWeight: "700",
  },
  phoneHint: {
    color: "#9BA1A6",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});

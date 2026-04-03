import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
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

  const [name, setName] = useState(passenger?.name || "");
  const [photoUri, setPhotoUri] = useState<string | null>(passenger?.photoUrl || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState("");

  const updateNameMutation = trpc.passenger.updateName.useMutation();
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
      // Update local context
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

  // ─── Save name ─────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (trimmed.length > 30) {
      setNameError("الاسم يجب ألا يتجاوز 30 حرفاً");
      return;
    }
    setNameError("");
    setIsSavingName(true);
    try {
      await updateNameMutation.mutateAsync({
        passengerId: passenger!.id,
        name: trimmed,
      });
      // Update local context
      if (passenger) {
        await setPassenger({ ...passenger, name: trimmed });
      }
      Alert.alert("✅ تم", "تم تحديث الاسم بنجاح");
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل في تحديث الاسم");
    } finally {
      setIsSavingName(false);
    }
  };

  // ─── Get initials ──────────────────────────────────────────────────────────
  const getInitial = () => {
    const n = passenger?.name || name;
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

        {/* Name Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>الاسم الكامل</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={(t) => {
                setName(t);
                setNameError("");
              }}
              placeholder="أدخل اسمك الكامل"
              placeholderTextColor="#9BA1A6"
              maxLength={30}
              textAlign="right"
              returnKeyType="done"
            />
          </View>
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
          <Text style={styles.charCount}>{name.length}/30</Text>
          <TouchableOpacity
            style={[styles.saveBtn, isSavingName && styles.saveBtnDisabled]}
            onPress={handleSaveName}
            disabled={isSavingName}
          >
            {isSavingName ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>حفظ الاسم</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Phone Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>رقم الهاتف</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.phoneValue}>{passenger?.phone}</Text>
            <TouchableOpacity
              style={styles.changePhoneBtn}
              onPress={() => router.push("/profile/change-phone" as any)}
            >
              <Text style={styles.changePhoneBtnText}>تغيير الرقم</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.phoneHint}>
            تغيير الرقم يتطلب التحقق عبر OTP من رقمك الحالي ثم الجديد
          </Text>
        </View>
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
    gap: 24,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: "relative",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#1a0533",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#f0c040",
    fontSize: 40,
    fontWeight: "700",
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
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
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a0533",
    textAlign: "right",
  },
  inputRow: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
  },
  input: {
    fontSize: 16,
    color: "#11181C",
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: "right",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    textAlign: "right",
  },
  charCount: {
    color: "#9BA1A6",
    fontSize: 12,
    textAlign: "left",
  },
  saveBtn: {
    backgroundColor: "#1a0533",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#f0c040",
    fontSize: 15,
    fontWeight: "700",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  phoneValue: {
    fontSize: 15,
    color: "#11181C",
    fontWeight: "500",
    direction: "ltr",
  },
  changePhoneBtn: {
    backgroundColor: "#1a0533",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  changePhoneBtnText: {
    color: "#f0c040",
    fontSize: 13,
    fontWeight: "600",
  },
  phoneHint: {
    color: "#687076",
    fontSize: 12,
    textAlign: "right",
    lineHeight: 18,
  },
});

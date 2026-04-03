import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { trpc } from "@/lib/trpc";

const steps = ["المعلومات الشخصية", "معلومات السيارة", "الوثائق"];

const carTypes = [
  { id: "sedan", label: "سيدان", icon: "🚗" },
  { id: "suv", label: "SUV", icon: "🚙" },
  { id: "minivan", label: "فان", icon: "🚐" },
];

// Convert image URI to base64
async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function DriverRegisterScreen() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCar, setSelectedCar] = useState<"sedan" | "suv" | "minivan">("sedan");
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Personal info
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");

  // Step 2: Vehicle info
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [carColor, setCarColor] = useState("");

  // Step 3: Documents (local URIs)
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nationalIdPhotoUri, setNationalIdPhotoUri] = useState<string | null>(null);
  const [licensePhotoUri, setLicensePhotoUri] = useState<string | null>(null);
  const [vehiclePhotoUri, setVehiclePhotoUri] = useState<string | null>(null);

  // Uploaded URLs
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [nationalIdPhotoUrl, setNationalIdPhotoUrl] = useState<string | null>(null);
  const [licensePhotoUrl, setLicensePhotoUrl] = useState<string | null>(null);
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState<string | null>(null);

  const uploadDocumentMutation = trpc.driver.uploadDocument.useMutation();
  const registerMutation = trpc.driver.register.useMutation();

  const normalizePhone = (p: string) => {
    let normalized = p.replace(/\s/g, "");
    if (normalized.startsWith("0")) normalized = "+964" + normalized.slice(1);
    else if (!normalized.startsWith("+")) normalized = "+964" + normalized;
    return normalized;
  };

  const pickImage = async (
    setter: (uri: string) => void,
    urlSetter: (url: string) => void,
    docType: "photo" | "nationalId" | "license" | "vehicle"
  ) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("الإذن مطلوب", "يرجى السماح للتطبيق بالوصول إلى مكتبة الصور");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setter(uri);

      // Upload to server
      try {
        setIsLoading(true);
        let base64 = "";
        if (Platform.OS === "web") {
          base64 = await uriToBase64(uri);
        } else {
          const response = await fetch(uri);
          const blob = await response.blob();
          base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
            reader.readAsDataURL(blob);
          });
        }

        const normalizedPhone = normalizePhone(phone || "driver");
        const uploadResult = await uploadDocumentMutation.mutateAsync({
          phone: normalizedPhone,
          documentType: docType,
          base64,
          mimeType: "image/jpeg",
        });
        urlSetter(uploadResult.url);
      } catch (err) {
        console.warn("Upload failed, will use local URI:", err);
        // Continue without upload - will submit without this photo URL
      } finally {
        setIsLoading(false);
      }
    }
  };

  const validateStep = () => {
    if (currentStep === 0) {
      if (!name.trim()) { Alert.alert("خطأ", "يرجى إدخال الاسم الكامل"); return false; }
      if (!phone.trim()) { Alert.alert("خطأ", "يرجى إدخال رقم الهاتف"); return false; }
      if (phone.replace(/\D/g, "").length < 10) { Alert.alert("خطأ", "رقم الهاتف غير صحيح"); return false; }
    }
    if (currentStep === 1) {
      if (!carModel.trim()) { Alert.alert("خطأ", "يرجى إدخال موديل السيارة"); return false; }
      if (!plateNumber.trim()) { Alert.alert("خطأ", "يرجى إدخال رقم اللوحة"); return false; }
    }
    return true;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone);
      const result = await registerMutation.mutateAsync({
        phone: normalizedPhone,
        name: name.trim(),
        nationalId: nationalId.trim() || undefined,
        photoUrl: photoUrl || undefined,
        nationalIdPhotoUrl: nationalIdPhotoUrl || undefined,
        licensePhotoUrl: licensePhotoUrl || undefined,
        vehicleType: selectedCar,
        vehiclePlate: plateNumber.trim() || undefined,
        vehicleModel: carModel.trim() || undefined,
        vehicleColor: carColor.trim() || undefined,
        vehicleYear: carYear.trim() || undefined,
        vehiclePhotoUrl: vehiclePhotoUrl || undefined,
      });

      Alert.alert(
        "✅ تم استلام طلبك!",
        `شكراً ${name}! تم تسجيل طلبك بنجاح.\n\nسيتم مراجعة بياناتك خلال 24-48 ساعة وسنتواصل معك على رقم ${normalizedPhone}.`,
        [{ text: "حسناً", onPress: () => router.replace("/auth/login" as any) }]
      );
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مجدداً");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const DocUploadCard = ({
    label,
    icon,
    uri,
    onPress,
  }: {
    label: string;
    icon: string;
    uri: string | null;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.docCard} onPress={onPress}>
      <View style={styles.docLeft}>
        {uri ? (
          <Image source={{ uri }} style={styles.docThumb} />
        ) : (
          <View style={styles.docIconBox}>
            <Text style={styles.docIconText}>{icon}</Text>
          </View>
        )}
      </View>
      <View style={styles.docInfo}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={[styles.docStatus, uri ? styles.docStatusDone : styles.docStatusPending]}>
          {uri ? "✅ تم الرفع" : "اضغط لرفع الصورة"}
        </Text>
      </View>
      <Text style={styles.docArrow}>←</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تسجيل كسائق</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Steps Indicator */}
      <View style={styles.stepsIndicator}>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepCircle, i <= currentStep && styles.stepCircleActive]}>
              <Text style={[styles.stepNum, i <= currentStep && styles.stepNumActive]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, i === currentStep && styles.stepLabelActive]}>
              {step}
            </Text>
            {i < steps.length - 1 && (
              <View style={[styles.stepConnector, i < currentStep && styles.stepConnectorActive]} />
            )}
          </View>
        ))}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Step 1: Personal Info ── */}
        {currentStep === 0 && (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>المعلومات الشخصية</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>الاسم الكامل *</Text>
              <TextInput
                style={styles.input}
                placeholder="محمد أحمد علي"
                placeholderTextColor="#9BA1A6"
                value={name}
                onChangeText={setName}
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>رقم الهاتف *</Text>
              <TextInput
                style={styles.input}
                placeholder="07XX XXX XXXX"
                placeholderTextColor="#9BA1A6"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>رقم الهوية الوطنية</Text>
              <TextInput
                style={styles.input}
                placeholder="XXXXXXXXXX"
                placeholderTextColor="#9BA1A6"
                value={nationalId}
                onChangeText={setNationalId}
                keyboardType="number-pad"
                textAlign="right"
              />
            </View>

            <View style={styles.safetyNote}>
              <Text style={styles.safetyNoteIcon}>🛡️</Text>
              <Text style={styles.safetyNoteText}>
                جميع بياناتك محمية ومشفرة. نحن نتحقق من هوية كل سائق لضمان سلامة الركاب.
              </Text>
            </View>
          </View>
        )}

        {/* ── Step 2: Vehicle Info ── */}
        {currentStep === 1 && (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>معلومات السيارة</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>نوع السيارة</Text>
              <View style={styles.carTypesRow}>
                {carTypes.map((ct) => (
                  <TouchableOpacity
                    key={ct.id}
                    style={[styles.carTypeBtn, selectedCar === ct.id && styles.carTypeBtnActive]}
                    onPress={() => setSelectedCar(ct.id as "sedan" | "suv" | "minivan")}
                  >
                    <Text style={styles.carTypeIcon}>{ct.icon}</Text>
                    <Text style={[styles.carTypeLabel, selectedCar === ct.id && styles.carTypeLabelActive]}>
                      {ct.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>موديل السيارة *</Text>
              <TextInput
                style={styles.input}
                placeholder="تويوتا كورولا"
                placeholderTextColor="#9BA1A6"
                value={carModel}
                onChangeText={setCarModel}
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>لون السيارة</Text>
              <TextInput
                style={styles.input}
                placeholder="أبيض"
                placeholderTextColor="#9BA1A6"
                value={carColor}
                onChangeText={setCarColor}
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>سنة الصنع</Text>
              <TextInput
                style={styles.input}
                placeholder="2020"
                placeholderTextColor="#9BA1A6"
                value={carYear}
                onChangeText={setCarYear}
                keyboardType="number-pad"
                textAlign="right"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>رقم اللوحة *</Text>
              <TextInput
                style={styles.input}
                placeholder="م ١٢٣٤ ن"
                placeholderTextColor="#9BA1A6"
                value={plateNumber}
                onChangeText={setPlateNumber}
                textAlign="right"
              />
            </View>
          </View>
        )}

        {/* ── Step 3: Documents ── */}
        {currentStep === 2 && (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>الوثائق المطلوبة</Text>
            <Text style={styles.formSubtitle}>
              ارفع صور الوثائق المطلوبة لتسريع مراجعة طلبك
            </Text>

            <DocUploadCard
              label="صورة شخصية"
              icon="🤳"
              uri={photoUri}
              onPress={() => pickImage(setPhotoUri, setPhotoUrl, "photo")}
            />
            <DocUploadCard
              label="صورة الهوية الوطنية"
              icon="🪪"
              uri={nationalIdPhotoUri}
              onPress={() => pickImage(setNationalIdPhotoUri, setNationalIdPhotoUrl, "nationalId")}
            />
            <DocUploadCard
              label="صورة رخصة القيادة"
              icon="🚗"
              uri={licensePhotoUri}
              onPress={() => pickImage(setLicensePhotoUri, setLicensePhotoUrl, "license")}
            />
            <DocUploadCard
              label="صورة السيارة"
              icon="🚙"
              uri={vehiclePhotoUri}
              onPress={() => pickImage(setVehiclePhotoUri, setVehiclePhotoUrl, "vehicle")}
            />

            <View style={styles.infoNote}>
              <Text style={styles.infoNoteText}>
                ℹ️ الصور اختيارية لكنها تساعد في تسريع الموافقة. بعد إرسال الطلب سيتم مراجعته خلال 24-48 ساعة.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={styles.prevBtn}
            onPress={() => setCurrentStep(currentStep - 1)}
          >
            <Text style={styles.prevBtnText}>السابق</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, isLoading && styles.nextBtnDisabled, currentStep > 0 && styles.nextBtnFlex]}
          onPress={handleNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#1A0533" />
          ) : (
            <Text style={styles.nextBtnText}>
              {currentStep === steps.length - 1 ? "إرسال الطلب" : "التالي"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  backText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  stepsIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepItem: { alignItems: "center", flexDirection: "row" },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
  },
  stepCircleActive: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  stepNum: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "700" },
  stepNumActive: { color: "#1A0533" },
  stepLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, marginHorizontal: 4 },
  stepLabelActive: { color: "#FFD700", fontWeight: "700" },
  stepConnector: { width: 24, height: 2, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 2 },
  stepConnectorActive: { backgroundColor: "#FFD700" },
  scroll: { flex: 1 },
  formSection: { paddingHorizontal: 20, paddingTop: 8 },
  formTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 6, textAlign: "right" },
  formSubtitle: { color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 20, textAlign: "right" },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600", marginBottom: 8, textAlign: "right" },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: "#FFFFFF", fontSize: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  carTypesRow: { flexDirection: "row", gap: 10 },
  carTypeBtn: {
    flex: 1, alignItems: "center", paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.12)",
  },
  carTypeBtnActive: { borderColor: "#FFD700", backgroundColor: "rgba(255,215,0,0.1)" },
  carTypeIcon: { fontSize: 28, marginBottom: 4 },
  carTypeLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" },
  carTypeLabelActive: { color: "#FFD700" },
  safetyNote: {
    flexDirection: "row",
    backgroundColor: "rgba(255,215,0,0.08)",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,215,0,0.2)",
    marginTop: 8, gap: 10, alignItems: "flex-start",
  },
  safetyNoteIcon: { fontSize: 20 },
  safetyNoteText: { color: "rgba(255,255,255,0.7)", fontSize: 13, flex: 1, textAlign: "right", lineHeight: 20 },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  docLeft: { width: 52, height: 52, borderRadius: 10, overflow: "hidden" },
  docThumb: { width: 52, height: 52, borderRadius: 10 },
  docIconBox: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  docIconText: { fontSize: 26 },
  docInfo: { flex: 1 },
  docLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", textAlign: "right", marginBottom: 4 },
  docStatus: { fontSize: 12, textAlign: "right" },
  docStatusDone: { color: "#4ADE80" },
  docStatusPending: { color: "rgba(255,255,255,0.4)" },
  docArrow: { color: "rgba(255,255,255,0.4)", fontSize: 18 },
  infoNote: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  infoNoteText: { color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "right", lineHeight: 20 },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20, paddingTop: 16,
    gap: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
  },
  prevBtn: {
    paddingVertical: 16, paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  prevBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  nextBtn: {
    flex: 1, paddingVertical: 16,
    backgroundColor: "#FFD700",
    borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  nextBtnFlex: { flex: 1 },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnText: { color: "#1A0533", fontSize: 17, fontWeight: "800" },
});

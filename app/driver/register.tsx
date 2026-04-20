import React, { useState, useEffect, useRef } from "react";
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
  Modal,
  FlatList,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { trpc } from "@/lib/trpc";
import { usePassenger } from "@/lib/passenger-context";

const steps = ["المعلومات الشخصية", "معلومات السيارة", "الوثائق"];

const carTypes = [
  { id: "sedan", label: "سيدان", icon: "🚗" },
  { id: "suv", label: "SUV", icon: "🚙" },
  { id: "minivan", label: "فان", icon: "🚐" },
];

const CAR_COLORS = [
  { id: "أبيض", label: "أبيض", hex: "#FFFFFF" },
  { id: "أسود", label: "أسود", hex: "#1A1A1A" },
  { id: "فضي", label: "فضي", hex: "#C0C0C0" },
  { id: "رمادي", label: "رمادي", hex: "#808080" },
  { id: "أحمر", label: "أحمر", hex: "#E53935" },
  { id: "أزرق", label: "أزرق", hex: "#1565C0" },
  { id: "أزرق فاتح", label: "أزرق فاتح", hex: "#42A5F5" },
  { id: "أخضر", label: "أخضر", hex: "#2E7D32" },
  { id: "بني", label: "بني", hex: "#6D4C41" },
  { id: "بيج", label: "بيج", hex: "#D7CCC8" },
  { id: "ذهبي", label: "ذهبي", hex: "#FFD700" },
  { id: "برتقالي", label: "برتقالي", hex: "#EF6C00" },
];

const currentYear = new Date().getFullYear();
const CAR_YEARS = Array.from({ length: currentYear - 1989 }, (_, i) =>
  String(currentYear - i)
);

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
  const { passenger } = usePassenger();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCar, setSelectedCar] = useState<"sedan" | "suv" | "minivan">("sedan");
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Personal info (auto-filled from passenger account)
  const [nationalId, setNationalId] = useState("");

  // Step 2: Vehicle info
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [carColor, setCarColor] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Step 3: Documents
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nationalIdPhotoUri, setNationalIdPhotoUri] = useState<string | null>(null);
  const [nationalIdPhotoBackUri, setNationalIdPhotoBackUri] = useState<string | null>(null);
  const [licensePhotoUri, setLicensePhotoUri] = useState<string | null>(null);
  const [vehiclePhotoUri, setVehiclePhotoUri] = useState<string | null>(null);

  // Uploaded URLs
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [nationalIdPhotoUrl, setNationalIdPhotoUrl] = useState<string | null>(null);
  const [nationalIdPhotoBackUrl, setNationalIdPhotoBackUrl] = useState<string | null>(null);
  const [licensePhotoUrl, setLicensePhotoUrl] = useState<string | null>(null);
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState<string | null>(null);

  // Camera for selfie
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const uploadDocumentMutation = trpc.driver.uploadDocument.useMutation();
  const registerMutation = trpc.driver.register.useMutation();

  const passengerPhone = passenger?.phone || "";
  const passengerName = passenger?.name || "";

  const normalizePhone = (p: string) => {
    let normalized = p.replace(/\s/g, "");
    if (normalized.startsWith("0")) normalized = "+964" + normalized.slice(1);
    else if (!normalized.startsWith("+")) normalized = "+964" + normalized;
    return normalized;
  };

  const uploadImage = async (
    uri: string,
    urlSetter: (url: string) => void,
    docType: "photo" | "nationalId" | "nationalIdBack" | "license" | "vehicle"
  ) => {
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

      const normalizedPhone = normalizePhone(passengerPhone || "driver");
      const uploadResult = await uploadDocumentMutation.mutateAsync({
        phone: normalizedPhone,
        documentType: docType,
        base64,
        mimeType: "image/jpeg",
      });
      urlSetter(uploadResult.url);
    } catch (err) {
      console.warn("Upload failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async (
    uriSetter: (uri: string) => void,
    urlSetter: (url: string) => void,
    docType: "nationalId" | "nationalIdBack" | "license" | "vehicle"
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
      uriSetter(uri);
      await uploadImage(uri, urlSetter, docType);
    }
  };

  const takeSelfie = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("الإذن مطلوب", "يرجى السماح للتطبيق بالوصول إلى الكاميرا");
        return;
      }
    }
    setShowCamera(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setShowCamera(false);
        setPhotoUri(photo.uri);
        await uploadImage(photo.uri, setPhotoUrl, "photo");
      }
    } catch (err) {
      Alert.alert("خطأ", "فشل التقاط الصورة، حاول مجدداً");
    }
  };

  const validateStep = () => {
    if (currentStep === 1) {
      if (!carModel.trim()) { Alert.alert("خطأ", "يرجى إدخال موديل السيارة"); return false; }
      if (!plateNumber.trim()) { Alert.alert("خطأ", "يرجى إدخال رقم اللوحة"); return false; }
    }
    if (currentStep === 2) {
      if (!photoUri) { Alert.alert("خطأ", "يرجى التقاط صورة شخصية حية من الكاميرا"); return false; }
      if (!nationalIdPhotoUri) { Alert.alert("خطأ", "يرجى رفع صورة الواجهة الأمامية للهوية الوطنية"); return false; }
      if (!nationalIdPhotoBackUri) { Alert.alert("خطأ", "يرجى رفع صورة الواجهة الخلفية للهوية الوطنية"); return false; }
      if (!licensePhotoUri) { Alert.alert("خطأ", "يرجى رفع صورة إجازة السوق"); return false; }
      if (!vehiclePhotoUri) { Alert.alert("خطأ", "يرجى رفع صورة السيارة"); return false; }
    }
    return true;
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const normalizedPhone = normalizePhone(passengerPhone);
      // جلب الدولة والمدينة من الموقع الجغرافي الحقيقي للجهاز
      let country: string | undefined;
      let city: string | undefined;
      try {
        // محاولة الحصول على الموقع الحقيقي من GPS
        const { getCurrentPositionAsync, requestForegroundPermissionsAsync } = await import('expo-location');
        const { status } = await requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await getCurrentPositionAsync({ accuracy: 3 });
          const { latitude, longitude } = pos.coords;
          // استخدام Nominatim للحصول على اسم المنطقة الحقيقية
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ar`,
            { headers: { 'User-Agent': 'MasarIQ-App/1.0' } }
          );
          if (nomRes.ok) {
            const nomData = await nomRes.json();
            const addr = nomData.address || {};
            // الأولوية: county (القضاء) > city > town > village > state
            city = addr.county || addr.city || addr.town || addr.village || addr.suburb || addr.state_district || addr.state || undefined;
            country = addr.country || undefined;
          }
        }
      } catch (_) {
        // فولباك: ipapi
        try {
          const geoRes = await fetch('https://ipapi.co/json/');
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            country = geoData.country_name || undefined;
            city = geoData.city || undefined;
          }
        } catch (__) {}
      }

      await registerMutation.mutateAsync({
        phone: normalizedPhone,
        name: passengerName,
        nationalId: nationalId.trim() || undefined,
        photoUrl: photoUrl || undefined,
        nationalIdPhotoUrl: nationalIdPhotoUrl || undefined,
        nationalIdPhotoBackUrl: nationalIdPhotoBackUrl || undefined,
        licensePhotoUrl: licensePhotoUrl || undefined,
        vehicleType: selectedCar,
        vehiclePlate: plateNumber.trim() || undefined,
        vehicleModel: carModel.trim() || undefined,
        vehicleColor: carColor || undefined,
        vehicleYear: carYear || undefined,
        vehiclePhotoUrl: vehiclePhotoUrl || undefined,
        country,
        city,
      });

      Alert.alert(
        "✅ تم استلام طلبك!",
        `شكراً ${passengerName}! تم تسجيل طلبك بنجاح.\n\nسيتم مراجعة بياناتك خلال 24-48 ساعة وإشعارك عند القبول.`,
        [{ text: "حسناً", onPress: () => router.replace("/(tabs)/profile" as any) }]
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
    required = true,
  }: {
    label: string;
    icon: string;
    uri: string | null;
    onPress: () => void;
    required?: boolean;
  }) => (
    <TouchableOpacity style={[styles.docCard, !uri && required && styles.docCardRequired]} onPress={onPress}>
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
        <Text style={styles.docLabel}>{label}{required ? " *" : ""}</Text>
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

      {/* Camera Modal for Selfie */}
      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front">
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraFaceGuide} />
              <Text style={styles.cameraHint}>ضع وجهك داخل الإطار</Text>
              <View style={styles.cameraButtons}>
                <TouchableOpacity style={styles.cameraCancelBtn} onPress={() => setShowCamera(false)}>
                  <Text style={styles.cameraCancelText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cameraCapture} onPress={capturePhoto}>
                  <View style={styles.cameraCaptureInner} />
                </TouchableOpacity>
                <View style={{ width: 80 }} />
              </View>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowColorPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>اختر لون السيارة</Text>
            <View style={styles.colorGrid}>
              {CAR_COLORS.map((color) => (
                <TouchableOpacity
                  key={color.id}
                  style={[styles.colorItem, carColor === color.id && styles.colorItemSelected]}
                  onPress={() => { setCarColor(color.id); setShowColorPicker(false); }}
                >
                  <View style={[styles.colorSwatch, { backgroundColor: color.hex, borderWidth: color.hex === "#FFFFFF" ? 1 : 0, borderColor: "#ccc" }]} />
                  <Text style={styles.colorLabel}>{color.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Picker Modal */}
      <Modal visible={showYearPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowYearPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerTitle}>اختر سنة الصنع</Text>
            <FlatList
              data={CAR_YEARS}
              keyExtractor={(item) => item}
              style={styles.yearList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.yearItem, carYear === item && styles.yearItemSelected]}
                  onPress={() => { setCarYear(item); setShowYearPicker(false); }}
                >
                  <Text style={[styles.yearItemText, carYear === item && styles.yearItemTextSelected]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

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

            {/* Auto-filled name display */}
            <View style={styles.autoFillCard}>
              <View style={styles.autoFillRow}>
                <Text style={styles.autoFillLabel}>الاسم الكامل</Text>
                <Text style={styles.autoFillValue}>{passengerName || "—"}</Text>
              </View>
              <View style={styles.autoFillDivider} />
              <View style={styles.autoFillRow}>
                <Text style={styles.autoFillLabel}>رقم الهاتف</Text>
                <Text style={styles.autoFillValue}>{passengerPhone || "—"}</Text>
              </View>
              <Text style={styles.autoFillNote}>✓ مُعبَّأ تلقائياً من حسابك</Text>
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

            {/* Color Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>لون السيارة</Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowColorPicker(true)}>
                {carColor ? (
                  <View style={styles.selectedColorRow}>
                    <View style={[styles.selectedColorDot, { backgroundColor: CAR_COLORS.find(c => c.id === carColor)?.hex || "#ccc", borderWidth: carColor === "أبيض" ? 1 : 0, borderColor: "#ccc" }]} />
                    <Text style={styles.selectBtnText}>{carColor}</Text>
                  </View>
                ) : (
                  <Text style={styles.selectBtnPlaceholder}>اختر لون السيارة</Text>
                )}
                <Text style={styles.selectBtnArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Year Picker */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>سنة الصنع</Text>
              <TouchableOpacity style={styles.selectBtn} onPress={() => setShowYearPicker(true)}>
                <Text style={carYear ? styles.selectBtnText : styles.selectBtnPlaceholder}>
                  {carYear || "اختر سنة الصنع"}
                </Text>
                <Text style={styles.selectBtnArrow}>▼</Text>
              </TouchableOpacity>
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
              جميع الوثائق إجبارية لإتمام التسجيل
            </Text>

            {/* Selfie - camera only */}
            <TouchableOpacity style={[styles.docCard, !photoUri && styles.docCardRequired]} onPress={takeSelfie}>
              <View style={styles.docLeft}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.docThumb} />
                ) : (
                  <View style={styles.docIconBox}>
                    <Text style={styles.docIconText}>📸</Text>
                  </View>
                )}
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docLabel}>صورة شخصية حية *</Text>
                <Text style={[styles.docStatus, photoUri ? styles.docStatusDone : styles.docStatusPending]}>
                  {photoUri ? "✅ تم الالتقاط" : "اضغط لفتح الكاميرا مباشرة"}
                </Text>
              </View>
              <Text style={styles.docArrow}>📷</Text>
            </TouchableOpacity>

            {/* National ID - Front */}
            <DocUploadCard
              label="الهوية الوطنية - الواجهة الأمامية"
              icon="🪪"
              uri={nationalIdPhotoUri}
              onPress={() => pickImage(setNationalIdPhotoUri, setNationalIdPhotoUrl, "nationalId")}
            />

            {/* National ID - Back */}
            <DocUploadCard
              label="الهوية الوطنية - الواجهة الخلفية"
              icon="🪪"
              uri={nationalIdPhotoBackUri}
              onPress={() => pickImage(setNationalIdPhotoBackUri, setNationalIdPhotoBackUrl, "nationalIdBack")}
            />

            <DocUploadCard
              label="إجازة السوق"
              icon="📝"
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
                ℹ️ بعد إرسال الطلب سيتم مراجعته خلال 24-48 ساعة وستصلك إشعار بالنتيجة.
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
  // Camera
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: "space-between", alignItems: "center", paddingVertical: 60 },
  cameraFaceGuide: {
    width: 220, height: 280, borderRadius: 110,
    borderWidth: 3, borderColor: "#FFD700",
    borderStyle: "dashed",
  },
  cameraHint: { color: "#FFD700", fontSize: 16, fontWeight: "700" },
  cameraButtons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 30 },
  cameraCancelBtn: { width: 80, alignItems: "center" },
  cameraCancelText: { color: "#fff", fontSize: 16 },
  cameraCapture: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  cameraCaptureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  pickerModal: {
    backgroundColor: "#2A1547",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: "70%",
  },
  pickerTitle: { color: "#FFD700", fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 20 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  colorItem: {
    alignItems: "center", width: 70, padding: 8,
    borderRadius: 12, borderWidth: 2, borderColor: "transparent",
  },
  colorItemSelected: { borderColor: "#FFD700", backgroundColor: "rgba(255,215,0,0.1)" },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, marginBottom: 6 },
  colorLabel: { color: "#fff", fontSize: 11, textAlign: "center" },
  yearList: { maxHeight: 300 },
  yearItem: {
    paddingVertical: 14, paddingHorizontal: 20,
    borderRadius: 10, marginBottom: 4,
  },
  yearItemSelected: { backgroundColor: "rgba(255,215,0,0.15)" },
  yearItemText: { color: "rgba(255,255,255,0.7)", fontSize: 16, textAlign: "center" },
  yearItemTextSelected: { color: "#FFD700", fontWeight: "800" },
  // Select buttons
  selectBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  selectBtnText: { color: "#FFFFFF", fontSize: 16 },
  selectBtnPlaceholder: { color: "#9BA1A6", fontSize: 16 },
  selectBtnArrow: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  selectedColorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectedColorDot: { width: 22, height: 22, borderRadius: 11 },
  // Auto-fill card
  autoFillCard: {
    backgroundColor: "rgba(255,215,0,0.06)",
    borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(255,215,0,0.2)",
  },
  autoFillRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  autoFillLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  autoFillValue: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  autoFillDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 4 },
  autoFillNote: { color: "#4ADE80", fontSize: 12, textAlign: "right", marginTop: 8 },
  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  backText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  stepsIndicator: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 20,
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
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
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
    flexDirection: "row", backgroundColor: "rgba(255,215,0,0.08)",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,215,0,0.2)",
    marginTop: 8, gap: 10, alignItems: "flex-start",
  },
  safetyNoteIcon: { fontSize: 20 },
  safetyNoteText: { color: "rgba(255,255,255,0.7)", fontSize: 13, flex: 1, textAlign: "right", lineHeight: 20 },
  docCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  docCardRequired: { borderColor: "rgba(255,100,100,0.3)", backgroundColor: "rgba(255,50,50,0.04)" },
  docLeft: { width: 52, height: 52, borderRadius: 10, overflow: "hidden" },
  docThumb: { width: 52, height: 52, borderRadius: 10 },
  docIconBox: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  docIconText: { fontSize: 26 },
  docInfo: { flex: 1 },
  docLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textAlign: "right", marginBottom: 4 },
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
    flexDirection: "row", paddingHorizontal: 20, paddingTop: 16,
    gap: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
  },
  prevBtn: {
    paddingVertical: 16, paddingHorizontal: 20,
    borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  prevBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  nextBtn: {
    flex: 1, paddingVertical: 16,
    backgroundColor: "#FFD700", borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  nextBtnFlex: { flex: 1 },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnText: { color: "#1A0533", fontSize: 17, fontWeight: "800" },
});

import React, { useState, useRef } from "react";
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
  Modal,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import { CameraView, useCameraPermissions } from "expo-camera";

type DocType = "face" | "idFront" | "idBack" | "office";

interface DocState {
  uri: string | null;
  url: string | null;
  loading: boolean;
}

// face and office must be taken live from camera; idFront/idBack can be picked from gallery
const CAMERA_ONLY_DOCS: DocType[] = ["face", "office"];

export default function AgentRegisterScreen() {
  const { passenger } = usePassenger();

  const [officeAddress, setOfficeAddress] = useState("");
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [docs, setDocs] = useState<Record<DocType, DocState>>({
    face: { uri: null, url: null, loading: false },
    idFront: { uri: null, url: null, loading: false },
    idBack: { uri: null, url: null, loading: false },
    office: { uri: null, url: null, loading: false },
  });

  // Camera modal state
  const [cameraVisible, setCameraVisible] = useState(false);
  const [activeCameraDoc, setActiveCameraDoc] = useState<DocType | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("front");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const uploadDocMutation = trpc.agents.uploadDocument.useMutation();
  const registerMutation = trpc.agents.register.useMutation();

  // Shared upload helper
  const uploadImage = async (docType: DocType, uri: string) => {
    setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], uri, loading: true } }));
    try {
      let base64: string;
      if (Platform.OS === "web") {
        // On web, uri from camera is a base64 data URL
        base64 = uri.includes(",") ? uri.split(",")[1] : uri;
      } else {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      const res = await uploadDocMutation.mutateAsync({
        passengerId: passenger?.id ?? 0,
        documentType: docType,
        base64,
        mimeType: "image/jpeg",
      });
      setDocs((prev) => ({
        ...prev,
        [docType]: { uri, url: res.url, loading: false },
      }));
    } catch (err: any) {
      setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], loading: false } }));
      Alert.alert("خطأ في الرفع", err.message || "حدث خطأ أثناء رفع الصورة");
    }
  };

  // Open live camera for face/office
  const openCamera = async (docType: DocType) => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("خطأ", "يجب السماح بالوصول للكاميرا لالتقاط الصورة");
        return;
      }
    }
    setActiveCameraDoc(docType);
    // face = front camera (selfie), office = back camera
    setCameraFacing(docType === "face" ? "front" : "back");
    setCameraVisible(true);
  };

  // Take picture from live camera
  const takePicture = async () => {
    if (!cameraRef.current || !activeCameraDoc) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        skipProcessing: false,
      });
      if (!photo) return;
      setCameraVisible(false);
      const docType = activeCameraDoc;
      setActiveCameraDoc(null);
      await uploadImage(docType, photo.uri);
    } catch (err: any) {
      Alert.alert("خطأ", "تعذّر التقاط الصورة، حاول مرة أخرى");
    }
  };

  // Pick from gallery (for idFront / idBack only)
  const pickFromGallery = async (docType: DocType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("خطأ", "يجب السماح بالوصول للصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadImage(docType, result.assets[0].uri);
  };

  // Handle doc card press
  const handleDocPress = (docType: DocType) => {
    if (docs[docType].loading) return;
    if (CAMERA_ONLY_DOCS.includes(docType)) {
      openCamera(docType);
    } else {
      pickFromGallery(docType);
    }
  };

  const getGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("خطأ", "يجب السماح بالوصول للموقع");
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (err: any) {
      Alert.alert("خطأ", "تعذّر الحصول على الموقع");
    }
    setGpsLoading(false);
  };

  const handleSubmit = async () => {
    if (!passenger) {
      Alert.alert("خطأ", "يجب تسجيل الدخول أولاً");
      return;
    }
    if (!docs.face.url) {
      Alert.alert("خطأ", "يجب التقاط صورة بصمة الوجه من الكاميرا");
      return;
    }
    if (!docs.idFront.url) {
      Alert.alert("خطأ", "يجب رفع صورة البطاقة الوطنية (أمامية)");
      return;
    }
    if (!docs.idBack.url) {
      Alert.alert("خطأ", "يجب رفع صورة البطاقة الوطنية (خلفية)");
      return;
    }
    if (!docs.office.url) {
      Alert.alert("خطأ", "يجب التقاط صورة المكتب من الكاميرا");
      return;
    }
    if (!officeAddress.trim()) {
      Alert.alert("خطأ", "يجب إدخال عنوان المكتب");
      return;
    }
    if (!gpsLocation) {
      Alert.alert("خطأ", "يجب تحديد موقع المكتب عبر GPS");
      return;
    }

    setSubmitting(true);
    try {
      await registerMutation.mutateAsync({
        passengerId: passenger.id,
        phone: passenger.phone,
        name: passenger.name ?? "",
        facePhotoUrl: docs.face.url ?? undefined,
        idFrontUrl: docs.idFront.url ?? undefined,
        idBackUrl: docs.idBack.url ?? undefined,
        officePhotoUrl: docs.office.url ?? undefined,
        officeAddress: officeAddress.trim(),
        officeLatitude: gpsLocation.lat,
        officeLongitude: gpsLocation.lng,
      });
      Alert.alert(
        "تم الإرسال",
        "تم إرسال طلبك بنجاح! سيتم مراجعته خلال 24-48 ساعة.",
        [{ text: "حسناً", onPress: () => router.replace("/agent" as any) }]
      );
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "حدث خطأ أثناء إرسال الطلب");
    }
    setSubmitting(false);
  };

  const docLabels: Record<DocType, string> = {
    face: "بصمة الوجه (سيلفي)",
    idFront: "البطاقة الوطنية (أمامية)",
    idBack: "البطاقة الوطنية (خلفية)",
    office: "صورة المكتب",
  };
  const docIcons: Record<DocType, string> = {
    face: "🤳",
    idFront: "🪪",
    idBack: "🪪",
    office: "🏢",
  };
  const docSubLabels: Record<DocType, string> = {
    face: "يُلتقط من الكاميرا الأمامية",
    idFront: "اختيار من المعرض",
    idBack: "اختيار من المعرض",
    office: "يُلتقط من الكاميرا الخلفية",
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تسجيل كوكيل معتمد</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* معلومات تلقائية */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>معلوماتك المسجلة</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>الاسم:</Text>
            <Text style={styles.infoValue}>{passenger?.name ?? "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>رقم الهاتف:</Text>
            <Text style={styles.infoValue}>{passenger?.phone ?? "—"}</Text>
          </View>
        </View>

        {/* رفع الوثائق */}
        <Text style={styles.sectionTitle}>الوثائق المطلوبة</Text>
        {(["face", "idFront", "idBack", "office"] as DocType[]).map((docType) => {
          const isCameraDoc = CAMERA_ONLY_DOCS.includes(docType);
          return (
            <TouchableOpacity
              key={docType}
              style={[styles.docCard, isCameraDoc && styles.docCardCamera]}
              onPress={() => handleDocPress(docType)}
              disabled={docs[docType].loading}
            >
              <View style={styles.docLeft}>
                {docs[docType].uri ? (
                  <Image source={{ uri: docs[docType].uri! }} style={styles.docImage} />
                ) : (
                  <View style={[styles.docPlaceholder, isCameraDoc && styles.docPlaceholderCamera]}>
                    <Text style={styles.docPlaceholderIcon}>{isCameraDoc ? "📷" : docIcons[docType]}</Text>
                  </View>
                )}
              </View>
              <View style={styles.docRight}>
                <Text style={styles.docLabel}>{docLabels[docType]}</Text>
                <Text style={[styles.docSubLabel, isCameraDoc && styles.docSubLabelCamera]}>
                  {isCameraDoc ? "📸 " : "🖼️ "}{docSubLabels[docType]}
                </Text>
                {docs[docType].loading ? (
                  <ActivityIndicator size="small" color="#2ECC71" />
                ) : docs[docType].url ? (
                  <Text style={styles.docUploaded}>✅ تم الرفع</Text>
                ) : (
                  <Text style={styles.docAction}>
                    {isCameraDoc ? "اضغط لفتح الكاميرا" : "اضغط لاختيار صورة"}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* عنوان المكتب */}
        <Text style={styles.sectionTitle}>عنوان المكتب</Text>
        <TextInput
          style={styles.textInput}
          placeholder="مثال: الموصل، حي النور، شارع الجامعة"
          placeholderTextColor="#9CA3AF"
          value={officeAddress}
          onChangeText={setOfficeAddress}
          textAlign="right"
          multiline
        />

        {/* GPS */}
        <TouchableOpacity
          style={[styles.gpsBtn, gpsLocation && styles.gpsBtnDone]}
          onPress={getGPS}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.gpsBtnIcon}>{gpsLocation ? "✅" : "📍"}</Text>
              <Text style={styles.gpsBtnText}>
                {gpsLocation
                  ? `تم تحديد الموقع (${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)})`
                  : "تحديد موقع المكتب عبر GPS"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* زر الإرسال */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>إرسال الطلب</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Camera Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={cameraVisible}
        animationType="slide"
        onRequestClose={() => setCameraVisible(false)}
      >
        <View style={styles.cameraContainer}>
          {/* Header */}
          <View style={styles.cameraHeader}>
            <TouchableOpacity
              onPress={() => setCameraVisible(false)}
              style={styles.cameraCloseBtn}
            >
              <Text style={styles.cameraCloseText}>✕ إغلاق</Text>
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>
              {activeCameraDoc === "face" ? "📸 التقط صورة وجهك" : "📸 التقط صورة المكتب"}
            </Text>
            {/* Flip camera button */}
            <TouchableOpacity
              onPress={() => setCameraFacing((f) => (f === "front" ? "back" : "front"))}
              style={styles.cameraFlipBtn}
            >
              <Text style={styles.cameraFlipText}>🔄</Text>
            </TouchableOpacity>
          </View>

          {/* Instruction */}
          <View style={styles.cameraInstruction}>
            <Text style={styles.cameraInstructionText}>
              {activeCameraDoc === "face"
                ? "ضع وجهك في المنتصف وتأكد من الإضاءة الجيدة"
                : "وجّه الكاميرا نحو المكتب بوضوح"}
            </Text>
          </View>

          {/* Camera Preview */}
          {cameraPermission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={styles.cameraPreview}
              facing={cameraFacing}
            >
              {/* Face guide overlay */}
              {activeCameraDoc === "face" && (
                <View style={styles.faceGuide} pointerEvents="none">
                  <View style={styles.faceOval} />
                </View>
              )}
            </CameraView>
          ) : (
            <View style={styles.cameraPermissionView}>
              <Text style={styles.cameraPermissionText}>
                يجب السماح بالوصول للكاميرا
              </Text>
              <TouchableOpacity
                style={styles.cameraPermissionBtn}
                onPress={requestCameraPermission}
              >
                <Text style={styles.cameraPermissionBtnText}>السماح بالكاميرا</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Capture Button */}
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#2D1B4E",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 22, color: "#2ECC71" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#ECEDEE" },
  content: { padding: 16, paddingBottom: 60 },
  infoCard: {
    backgroundColor: "#0D2A1A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2ECC71",
  },
  infoTitle: { fontSize: 15, fontWeight: "700", color: "#2ECC71", marginBottom: 10, textAlign: "right" },
  infoRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 },
  infoLabel: { fontSize: 14, color: "#A8D8C0" },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#ECEDEE" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#ECEDEE", marginBottom: 12, textAlign: "right" },
  docCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#3D2B5E",
  },
  docCardCamera: {
    backgroundColor: "#1E3A5F",
    borderColor: "#3B82F6",
  },
  docLeft: { marginLeft: 12 },
  docImage: { width: 64, height: 64, borderRadius: 10 },
  docPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#2D1B4E",
    justifyContent: "center",
    alignItems: "center",
  },
  docPlaceholderCamera: {
    backgroundColor: "#1E3A5F",
  },
  docPlaceholderIcon: { fontSize: 28 },
  docRight: { flex: 1, alignItems: "flex-end" },
  docLabel: { fontSize: 15, fontWeight: "600", color: "#ECEDEE", marginBottom: 2 },
  docSubLabel: { fontSize: 11, color: "#A8D8C0", marginBottom: 4 },
  docSubLabelCamera: { color: "#60A5FA" },
  docUploaded: { fontSize: 13, color: "#2ECC71" },
  docAction: { fontSize: 13, color: "#A8D8C0" },
  textInput: {
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3D2B5E",
    padding: 14,
    fontSize: 15,
    color: "#ECEDEE",
    marginBottom: 12,
    minHeight: 60,
  },
  gpsBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
    gap: 8,
  },
  gpsBtnDone: { backgroundColor: "#059669" },
  gpsBtnIcon: { fontSize: 18 },
  gpsBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  submitBtn: {
    backgroundColor: "#2ECC71",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  submitBtnText: { fontSize: 17, fontWeight: "700", color: "#fff" },

  // ─── Camera Modal Styles ───────────────────────────────────────────────
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 10,
  },
  cameraCloseBtn: { padding: 8 },
  cameraCloseText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cameraTitle: { color: "#fff", fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  cameraFlipBtn: { padding: 8 },
  cameraFlipText: { fontSize: 22 },
  cameraInstruction: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  cameraInstructionText: { color: "#FFD700", fontSize: 13, fontWeight: "600", textAlign: "center" },
  cameraPreview: { flex: 1 },
  cameraPermissionView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111",
  },
  cameraPermissionText: { color: "#fff", fontSize: 16, marginBottom: 16, textAlign: "center" },
  cameraPermissionBtn: {
    backgroundColor: "#2ECC71",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cameraPermissionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cameraControls: {
    paddingBottom: 50,
    paddingTop: 20,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  faceGuide: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  faceOval: {
    width: 200,
    height: 260,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.7)",
    borderStyle: "dashed",
  },
});

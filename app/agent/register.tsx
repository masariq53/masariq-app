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
import { ScreenContainer } from "@/components/screen-container";
import { usePassenger } from "@/lib/passenger-context";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";

type DocType = "face" | "idFront" | "idBack" | "office";

interface DocState {
  uri: string | null;
  url: string | null;
  loading: boolean;
}

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

  const uploadDocMutation = trpc.agents.uploadDocument.useMutation();
  const registerMutation = trpc.agents.register.useMutation();

  const pickImage = async (docType: DocType) => {
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

    const uri = result.assets[0].uri;
    setDocs((prev) => ({ ...prev, [docType]: { ...prev[docType], uri, loading: true } }));

    try {
      // Read as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

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
      Alert.alert("خطأ", "يجب رفع صورة بصمة الوجه");
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
      Alert.alert("خطأ", "يجب رفع صورة المكتب");
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
    face: "بصمة الوجه",
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
        {(["face", "idFront", "idBack", "office"] as DocType[]).map((docType) => (
          <TouchableOpacity
            key={docType}
            style={styles.docCard}
            onPress={() => pickImage(docType)}
            disabled={docs[docType].loading}
          >
            <View style={styles.docLeft}>
              {docs[docType].uri ? (
                <Image source={{ uri: docs[docType].uri! }} style={styles.docImage} />
              ) : (
                <View style={styles.docPlaceholder}>
                  <Text style={styles.docPlaceholderIcon}>{docIcons[docType]}</Text>
                </View>
              )}
            </View>
            <View style={styles.docRight}>
              <Text style={styles.docLabel}>{docLabels[docType]}</Text>
              {docs[docType].loading ? (
                <ActivityIndicator size="small" color="#2ECC71" />
              ) : docs[docType].url ? (
                <Text style={styles.docUploaded}>✅ تم الرفع</Text>
              ) : (
                <Text style={styles.docAction}>اضغط لاختيار صورة</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}

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
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 22, color: "#2ECC71" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#11181C" },
  content: { padding: 16, paddingBottom: 60 },
  infoCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  infoTitle: { fontSize: 15, fontWeight: "700", color: "#065F46", marginBottom: 10, textAlign: "right" },
  infoRow: { flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 },
  infoLabel: { fontSize: 14, color: "#6B7280" },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#111827" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#11181C", marginBottom: 12, textAlign: "right" },
  docCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  docLeft: { marginLeft: 12 },
  docImage: { width: 64, height: 64, borderRadius: 10 },
  docPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  docPlaceholderIcon: { fontSize: 28 },
  docRight: { flex: 1, alignItems: "flex-end" },
  docLabel: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 },
  docUploaded: { fontSize: 13, color: "#059669" },
  docAction: { fontSize: 13, color: "#6B7280" },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    fontSize: 15,
    color: "#111827",
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
});

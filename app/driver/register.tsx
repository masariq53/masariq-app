import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const steps = ["المعلومات الشخصية", "معلومات السيارة", "الوثائق"];

const carTypes = [
  { id: "sedan", label: "سيدان", icon: "🚗" },
  { id: "suv", label: "SUV", icon: "🚙" },
  { id: "van", label: "فان", icon: "🚐" },
];

export default function DriverRegisterScreen() {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCar, setSelectedCar] = useState("sedan");

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carYear, setCarYear] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      Alert.alert(
        "تم التسجيل!",
        "شكراً لتسجيلك كسائق في موصل رايد. سيتم مراجعة طلبك خلال 24 ساعة وسنتواصل معك.",
        [{ text: "حسناً", onPress: () => router.replace("/auth/login" as any) }]
      );
    }
  };

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
            <View
              style={[
                styles.stepCircle,
                i <= currentStep && styles.stepCircleActive,
              ]}
            >
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
        {currentStep === 0 && (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>المعلومات الشخصية</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>الاسم الكامل</Text>
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
              <Text style={styles.inputLabel}>رقم الهاتف</Text>
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

            {/* Safety Note */}
            <View style={styles.safetyNote}>
              <Text style={styles.safetyNoteIcon}>🛡️</Text>
              <Text style={styles.safetyNoteText}>
                جميع بياناتك محمية ومشفرة. نحن نتحقق من هوية كل سائق لضمان سلامة الركاب.
              </Text>
            </View>
          </View>
        )}

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
                    onPress={() => setSelectedCar(ct.id)}
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
              <Text style={styles.inputLabel}>موديل السيارة</Text>
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
              <Text style={styles.inputLabel}>رقم اللوحة</Text>
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

        {currentStep === 2 && (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>الوثائق المطلوبة</Text>
            <Text style={styles.formSubtitle}>
              يرجى تجهيز الوثائق التالية. سيتم التواصل معك لإرسالها.
            </Text>

            {[
              { icon: "🪪", label: "صورة الهوية الوطنية", desc: "وجهين" },
              { icon: "🚗", label: "رخصة القيادة", desc: "سارية المفعول" },
              { icon: "📋", label: "وثيقة تسجيل السيارة", desc: "استمارة السيارة" },
              { icon: "🛡️", label: "وثيقة التأمين", desc: "تأمين شامل مفضل" },
              { icon: "📸", label: "صورة شخصية", desc: "واضحة وحديثة" },
            ].map((doc, i) => (
              <View key={i} style={styles.docCard}>
                <View style={styles.docStatus}>
                  <View style={styles.docStatusDot} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docLabel}>{doc.label}</Text>
                  <Text style={styles.docDesc}>{doc.desc}</Text>
                </View>
                <Text style={styles.docIcon}>{doc.icon}</Text>
              </View>
            ))}

            <View style={styles.infoNote}>
              <Text style={styles.infoNoteText}>
                ℹ️ بعد إرسال طلبك، سيتم مراجعته خلال 24 ساعة. ستتلقى إشعاراً بالموافقة أو الرفض.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Next Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {currentStep === steps.length - 1 ? "إرسال الطلب" : "التالي"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A2E4A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  stepsIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 0,
  },
  stepItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 0,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  stepCircleActive: {
    backgroundColor: "#F5A623",
    borderColor: "#F5A623",
  },
  stepNum: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "700",
  },
  stepNumActive: {
    color: "#1A2E4A",
  },
  stepLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    marginLeft: 4,
    marginRight: 4,
  },
  stepLabelActive: {
    color: "#F5A623",
    fontWeight: "600",
  },
  stepConnector: {
    width: 20,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  stepConnectorActive: {
    backgroundColor: "#F5A623",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  formSection: {
    padding: 20,
    gap: 16,
  },
  formTitle: {
    color: "#1A2E4A",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
  },
  formSubtitle: {
    color: "#6B7A8D",
    fontSize: 13,
    textAlign: "right",
    lineHeight: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: "#1A2E4A",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#1A2E4A",
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  safetyNote: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    backgroundColor: "#E8F5E9",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  safetyNoteIcon: {
    fontSize: 20,
  },
  safetyNoteText: {
    flex: 1,
    color: "#2E7D32",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  carTypesRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  carTypeBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  carTypeBtnActive: {
    borderColor: "#F5A623",
    backgroundColor: "#FFF8EC",
  },
  carTypeIcon: {
    fontSize: 28,
  },
  carTypeLabel: {
    color: "#6B7A8D",
    fontSize: 13,
    fontWeight: "600",
  },
  carTypeLabelActive: {
    color: "#F5A623",
  },
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  docStatus: {
    alignItems: "center",
    justifyContent: "center",
  },
  docStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E2E8F0",
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  docInfo: {
    flex: 1,
    alignItems: "flex-end",
  },
  docLabel: {
    color: "#1A2E4A",
    fontSize: 14,
    fontWeight: "700",
  },
  docDesc: {
    color: "#6B7A8D",
    fontSize: 12,
    marginTop: 2,
  },
  docIcon: {
    fontSize: 24,
  },
  infoNote: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoNoteText: {
    color: "#1D4ED8",
    fontSize: 12,
    lineHeight: 20,
    textAlign: "right",
  },
  footer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  nextBtn: {
    backgroundColor: "#F5A623",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  nextBtnText: {
    color: "#1A2E4A",
    fontSize: 17,
    fontWeight: "800",
  },
});

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { StatusBar } from "expo-status-bar";

const packageTypes = [
  { id: "small", icon: "📦", label: "صغير", size: "حتى 2 كغ", price: "3,000" },
  { id: "medium", icon: "🗃️", label: "متوسط", size: "2-10 كغ", price: "5,000" },
  { id: "large", icon: "📫", label: "كبير", size: "10-30 كغ", price: "8,000" },
  { id: "fragile", icon: "🏺", label: "هش", size: "أي وزن", price: "6,000" },
];

export default function DeliveryScreen() {
  const [selectedType, setSelectedType] = useState("small");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const selectedPackage = packageTypes.find((p) => p.id === selectedType);

  const handleOrder = () => {
    router.push("/delivery/tracking" as any);
  };

  return (
    <ScreenContainer containerClassName="bg-[#1A0533]" safeAreaClassName="bg-[#F5F7FA]">
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>توصيل الطرود</Text>
        <Text style={styles.headerSubtitle}>أرسل طردك بأمان وسرعة</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Package Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>نوع الطرد</Text>
          <View style={styles.typesGrid}>
            {packageTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeCard, selectedType === type.id && styles.typeCardActive]}
                onPress={() => setSelectedType(type.id)}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text style={[styles.typeLabel, selectedType === type.id && styles.typeLabelActive]}>
                  {type.label}
                </Text>
                <Text style={[styles.typeSize, selectedType === type.id && styles.typeSizeActive]}>
                  {type.size}
                </Text>
                <Text style={[styles.typePrice, selectedType === type.id && styles.typePriceActive]}>
                  {type.price} د.ع
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>عنوان الإرسال والاستلام</Text>
          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: "#22C55E" }]} />
              <TextInput
                style={styles.addressInput}
                placeholder="عنوان الإرسال"
                placeholderTextColor="#9BA1A6"
                value={fromAddress}
                onChangeText={setFromAddress}
                textAlign="right"
              />
            </View>
            <View style={styles.addressDivider} />
            <View style={styles.addressRow}>
              <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
              <TextInput
                style={styles.addressInput}
                placeholder="عنوان الاستلام"
                placeholderTextColor="#9BA1A6"
                value={toAddress}
                onChangeText={setToAddress}
                textAlign="right"
              />
            </View>
          </View>
        </View>

        {/* Recipient Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات المستلم</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="اسم المستلم"
              placeholderTextColor="#9BA1A6"
              value={recipientName}
              onChangeText={setRecipientName}
              textAlign="right"
            />
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.input}
              placeholder="رقم هاتف المستلم"
              placeholderTextColor="#9BA1A6"
              value={recipientPhone}
              onChangeText={setRecipientPhone}
              keyboardType="phone-pad"
              textAlign="right"
            />
          </View>
        </View>

        {/* Price Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>{selectedPackage?.price} د.ع</Text>
            <Text style={styles.summaryLabel}>تكلفة التوصيل</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryValue}>20-40 دقيقة</Text>
            <Text style={styles.summaryLabel}>وقت التوصيل المتوقع</Text>
          </View>
        </View>

        {/* Order Button */}
        <TouchableOpacity style={styles.orderBtn} onPress={handleOrder}>
          <Text style={styles.orderBtnText}>🚚  اطلب التوصيل الآن</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#1A0533",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "right",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textAlign: "right",
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 12,
  },
  typesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  typeCardActive: {
    borderColor: "#FFD700",
    backgroundColor: "#FFF8EC",
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  typeLabel: {
    color: "#1A0533",
    fontSize: 14,
    fontWeight: "700",
  },
  typeLabelActive: {
    color: "#FFD700",
  },
  typeSize: {
    color: "#6B7A8D",
    fontSize: 11,
  },
  typeSizeActive: {
    color: "#FFD700",
    opacity: 0.8,
  },
  typePrice: {
    color: "#1A0533",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  typePriceActive: {
    color: "#FFD700",
  },
  addressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  addressRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  addressInput: {
    flex: 1,
    color: "#1A0533",
    fontSize: 14,
    fontWeight: "500",
  },
  addressDivider: {
    height: 1,
    backgroundColor: "#F5F7FA",
    marginVertical: 4,
  },
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    color: "#1A0533",
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputDivider: {
    height: 1,
    backgroundColor: "#F5F7FA",
  },
  summaryCard: {
    backgroundColor: "#1A0533",
    borderRadius: 18,
    padding: 20,
    margin: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  summaryValue: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "800",
  },
  orderBtn: {
    backgroundColor: "#FFD700",
    borderRadius: 18,
    paddingVertical: 18,
    marginHorizontal: 16,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  orderBtnText: {
    color: "#1A0533",
    fontSize: 17,
    fontWeight: "800",
  },
});

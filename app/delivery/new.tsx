import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const packageTypes = [
  { id: "small", icon: "📦", label: "صغير", desc: "أقل من 2 كغ", price: 3000 },
  { id: "medium", icon: "🗃️", label: "متوسط", desc: "2-10 كغ", price: 5000 },
  { id: "large", icon: "📫", label: "كبير", desc: "10-25 كغ", price: 8000 },
  { id: "fragile", icon: "🔮", label: "هش", desc: "زجاج / إلكترونيات", price: 6000 },
];

export default function NewDeliveryScreen() {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState("small");
  const [senderAddress, setSenderAddress] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [notes, setNotes] = useState("");

  const selectedPkg = packageTypes.find((p) => p.id === selectedType)!;

  const handleOrder = () => {
    router.push("/delivery/tracking" as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>→</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>طلب توصيل</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Package Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>نوع الطرد</Text>
          <View style={styles.typesGrid}>
            {packageTypes.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.typeCard,
                  selectedType === pkg.id && styles.typeCardActive,
                ]}
                onPress={() => setSelectedType(pkg.id)}
              >
                <Text style={styles.typeIcon}>{pkg.icon}</Text>
                <Text style={[styles.typeLabel, selectedType === pkg.id && styles.typeLabelActive]}>
                  {pkg.label}
                </Text>
                <Text style={styles.typeDesc}>{pkg.desc}</Text>
                <Text style={[styles.typePrice, selectedType === pkg.id && styles.typePriceActive]}>
                  {pkg.price.toLocaleString()} د.ع
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>العناوين</Text>
          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <View style={[styles.addressDot, { backgroundColor: "#22C55E" }]} />
              <TextInput
                style={styles.addressInput}
                placeholder="عنوان الإرسال"
                placeholderTextColor="#6B5B8A"
                value={senderAddress}
                onChangeText={setSenderAddress}
                textAlign="right"
              />
            </View>
            <View style={styles.addressDivider} />
            <View style={styles.addressRow}>
              <View style={[styles.addressDot, { backgroundColor: "#FFD700" }]} />
              <TextInput
                style={styles.addressInput}
                placeholder="عنوان الاستلام"
                placeholderTextColor="#6B5B8A"
                value={receiverAddress}
                onChangeText={setReceiverAddress}
                textAlign="right"
              />
            </View>
          </View>
        </View>

        {/* Receiver Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات المستلم</Text>
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="اسم المستلم"
              placeholderTextColor="#6B5B8A"
              value={receiverName}
              onChangeText={setReceiverName}
              textAlign="right"
            />
            <TextInput
              style={styles.input}
              placeholder="رقم هاتف المستلم"
              placeholderTextColor="#6B5B8A"
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              keyboardType="phone-pad"
              textAlign="right"
            />
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="ملاحظات إضافية (اختياري)"
              placeholderTextColor="#6B5B8A"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlign="right"
            />
          </View>
        </View>

        {/* Price Summary */}
        <View style={styles.priceSummary}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>نوع الطرد</Text>
            <Text style={styles.priceValue}>{selectedPkg.label}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>سعر التوصيل</Text>
            <Text style={styles.priceValue}>{selectedPkg.price.toLocaleString()} د.ع</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceTotalLabel}>الإجمالي</Text>
            <Text style={styles.priceTotalValue}>{selectedPkg.price.toLocaleString()} د.ع</Text>
          </View>
        </View>

        {/* Order Button */}
        <TouchableOpacity style={styles.orderBtn} onPress={handleOrder}>
          <Text style={styles.orderBtnText}>تأكيد الطلب</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A0533",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2D1B69",
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "right",
  },
  typesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    width: (width - 52) / 2,
    backgroundColor: "#2D1B69",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#3D2580",
  },
  typeCardActive: {
    borderColor: "#FFD700",
    backgroundColor: "#1A0533",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  typeIcon: { fontSize: 32, marginBottom: 8 },
  typeLabel: {
    color: "#C4B5D4",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  typeLabelActive: { color: "#FFD700" },
  typeDesc: {
    color: "#6B5B8A",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 6,
  },
  typePrice: {
    color: "#9B8AB0",
    fontSize: 12,
    fontWeight: "600",
  },
  typePriceActive: { color: "#FFD700" },
  addressCard: {
    backgroundColor: "#2D1B69",
    borderRadius: 16,
    padding: 16,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  addressInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    paddingVertical: 8,
  },
  addressDivider: {
    height: 1,
    backgroundColor: "#3D2580",
    marginVertical: 8,
    marginLeft: 24,
  },
  inputGroup: { gap: 10 },
  input: {
    backgroundColor: "#2D1B69",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#3D2580",
  },
  notesInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 14,
  },
  priceSummary: {
    marginHorizontal: 20,
    backgroundColor: "#2D1B69",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  priceLabel: {
    color: "#9B8AB0",
    fontSize: 13,
  },
  priceValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  priceDivider: {
    height: 1,
    backgroundColor: "#3D2580",
    marginVertical: 8,
  },
  priceTotalLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  priceTotalValue: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "bold",
  },
  orderBtn: {
    marginHorizontal: 20,
    backgroundColor: "#FFD700",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  orderBtnText: {
    color: "#1A0533",
    fontSize: 17,
    fontWeight: "bold",
  },
});

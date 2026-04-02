import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");

const rideTypes = [
  {
    id: "economy",
    icon: "🚗",
    label: "اقتصادي",
    desc: "أسرع وصول",
    price: "3,500",
    time: "3 دقائق",
    capacity: "4",
  },
  {
    id: "comfort",
    icon: "🚙",
    label: "مريح",
    desc: "سيارات فاخرة",
    price: "5,500",
    time: "5 دقائق",
    capacity: "4",
  },
  {
    id: "xl",
    icon: "🚐",
    label: "XL",
    desc: "للمجموعات",
    price: "7,000",
    time: "7 دقائق",
    capacity: "6",
  },
  {
    id: "women",
    icon: "👩",
    label: "سائقة",
    desc: "للسيدات فقط",
    price: "4,000",
    time: "8 دقائق",
    capacity: "4",
  },
];

const paymentMethods = [
  { id: "cash", icon: "💵", label: "نقداً" },
  { id: "wallet", icon: "💰", label: "المحفظة" },
];

export default function BookRideScreen() {
  const insets = useSafeAreaInsets();
  const [fromAddress, setFromAddress] = useState("موقعي الحالي 📍");
  const [toAddress, setToAddress] = useState("");
  const [selectedRide, setSelectedRide] = useState("economy");
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [step, setStep] = useState<"address" | "ride_type" | "confirm">("address");

  const selectedRideData = rideTypes.find((r) => r.id === selectedRide);

  const handleConfirm = () => {
    router.push("/ride/tracking" as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>🗺️</Text>
        <Text style={styles.mapLabel}>خريطة الموصل</Text>
        <View style={styles.mapPin}>
          <Text style={styles.mapPinText}>📍</Text>
        </View>
      </View>

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 16 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>→</Text>
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {step === "address" && (
          <>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>إلى أين؟</Text>

            <View style={styles.addressCard}>
              <View style={styles.addressRow}>
                <View style={[styles.dot, { backgroundColor: "#22C55E" }]} />
                <TextInput
                  style={styles.addressInput}
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
                  placeholder="وجهتك؟"
                  placeholderTextColor="#9BA1A6"
                  value={toAddress}
                  onChangeText={setToAddress}
                  autoFocus
                  textAlign="right"
                />
              </View>
            </View>

            {/* Quick Destinations */}
            <View style={styles.quickRow}>
              {["المستشفى 🏥", "الجامعة 🎓", "السوق 🛒"].map((dest) => (
                <TouchableOpacity
                  key={dest}
                  style={styles.quickChip}
                  onPress={() => {
                    setToAddress(dest);
                    setStep("ride_type");
                  }}
                >
                  <Text style={styles.quickChipText}>{dest}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btn, !toAddress && styles.btnDisabled]}
              onPress={() => toAddress && setStep("ride_type")}
              disabled={!toAddress}
            >
              <Text style={styles.btnText}>اختر نوع الرحلة</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "ride_type" && (
          <>
            <View style={styles.sheetHandle} />
            <View style={styles.routeHeader}>
              <TouchableOpacity onPress={() => setStep("address")}>
                <Text style={styles.editText}>تعديل</Text>
              </TouchableOpacity>
              <View style={styles.routeSummary}>
                <Text style={styles.routeTo}>{toAddress}</Text>
                <Text style={styles.routeArrow}>←</Text>
                <Text style={styles.routeFrom}>موقعي</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.rideScroll}
            >
              {rideTypes.map((ride) => (
                <TouchableOpacity
                  key={ride.id}
                  style={[
                    styles.rideCard,
                    selectedRide === ride.id && styles.rideCardActive,
                  ]}
                  onPress={() => setSelectedRide(ride.id)}
                >
                  <Text style={styles.rideIcon}>{ride.icon}</Text>
                  <Text style={[styles.rideLabel, selectedRide === ride.id && styles.rideLabelActive]}>
                    {ride.label}
                  </Text>
                  <Text style={styles.rideTime}>⏱ {ride.time}</Text>
                  <Text style={[styles.ridePrice, selectedRide === ride.id && styles.ridePriceActive]}>
                    {ride.price} د.ع
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Payment */}
            <View style={styles.paymentRow}>
              {paymentMethods.map((pm) => (
                <TouchableOpacity
                  key={pm.id}
                  style={[
                    styles.paymentChip,
                    selectedPayment === pm.id && styles.paymentChipActive,
                  ]}
                  onPress={() => setSelectedPayment(pm.id)}
                >
                  <Text style={styles.paymentIcon}>{pm.icon}</Text>
                  <Text
                    style={[
                      styles.paymentLabel,
                      selectedPayment === pm.id && styles.paymentLabelActive,
                    ]}
                  >
                    {pm.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleConfirm}>
              <Text style={styles.btnText}>
                احجز الآن — {selectedRideData?.price} د.ع
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: "#D4E8F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mapText: {
    fontSize: 64,
  },
  mapLabel: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "600",
    opacity: 0.6,
  },
  mapPin: {
    position: "absolute",
    top: "40%",
    left: "50%",
    marginLeft: -16,
  },
  mapPinText: {
    fontSize: 32,
  },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  backText: {
    fontSize: 20,
    color: "#1A0533",
    fontWeight: "700",
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    maxHeight: height * 0.55,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    color: "#1A0533",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
    marginBottom: 16,
  },
  addressCard: {
    backgroundColor: "#F5F7FA",
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
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
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    justifyContent: "flex-end",
  },
  quickChip: {
    backgroundColor: "#F5F7FA",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  quickChipText: {
    color: "#1A0533",
    fontSize: 12,
    fontWeight: "600",
  },
  btn: {
    backgroundColor: "#FFD700",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: "#1A0533",
    fontSize: 16,
    fontWeight: "800",
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  editText: {
    color: "#FFD700",
    fontSize: 14,
    fontWeight: "600",
  },
  routeSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeFrom: {
    color: "#6B7A8D",
    fontSize: 13,
  },
  routeArrow: {
    color: "#C0C8D4",
    fontSize: 14,
  },
  routeTo: {
    color: "#1A0533",
    fontSize: 13,
    fontWeight: "700",
  },
  rideScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  rideCard: {
    backgroundColor: "#F5F7FA",
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    alignItems: "center",
    width: 110,
    borderWidth: 2,
    borderColor: "transparent",
    gap: 4,
  },
  rideCardActive: {
    borderColor: "#FFD700",
    backgroundColor: "#FFF8EC",
  },
  rideIcon: {
    fontSize: 28,
  },
  rideLabel: {
    color: "#1A0533",
    fontSize: 13,
    fontWeight: "700",
  },
  rideLabelActive: {
    color: "#FFD700",
  },
  rideTime: {
    color: "#6B7A8D",
    fontSize: 11,
  },
  ridePrice: {
    color: "#1A0533",
    fontSize: 13,
    fontWeight: "800",
  },
  ridePriceActive: {
    color: "#FFD700",
  },
  paymentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    justifyContent: "flex-end",
  },
  paymentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  paymentChipActive: {
    borderColor: "#1A0533",
    backgroundColor: "#E8F0FE",
  },
  paymentIcon: {
    fontSize: 16,
  },
  paymentLabel: {
    color: "#6B7A8D",
    fontSize: 13,
    fontWeight: "600",
  },
  paymentLabelActive: {
    color: "#1A0533",
    fontWeight: "700",
  },
});

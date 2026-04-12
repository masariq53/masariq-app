import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";

const STATUS_STEPS = [
  { key: "pending", label: "بانتظار الكابتن", icon: "⏳" },
  { key: "accepted", label: "تم قبول الطلب", icon: "✅" },
  { key: "picked_up", label: "تم استلام الطرد", icon: "📦" },
  { key: "in_transit", label: "في الطريق", icon: "🚗" },
  { key: "delivered", label: "تم التسليم", icon: "🎉" },
];

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  instant: "⚡ توصيل فوري",
  scheduled: "📅 توصيل مجدول",
  intercity: "🚚 توصيل بين المدن",
};

const SIZE_LABELS: Record<string, string> = {
  small: "📦 صغير",
  medium: "🗃️ متوسط",
  large: "📫 كبير",
};

export default function ParcelTrackingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ parcelId: string }>();
  const parcelId = parseInt(params.parcelId ?? "0");

  const { data: parcel, isLoading, refetch } = trpc.parcel.getById.useQuery(
    { parcelId },
    { enabled: !!parcelId, refetchInterval: 10000 }
  );

  const currentStepIndex = parcel
    ? STATUS_STEPS.findIndex((s) => s.key === parcel.status)
    : 0;

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!parcel) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <Text style={styles.errorText}>لم يتم العثور على الطرد</Text>
        <TouchableOpacity style={styles.backBtnAlt} onPress={() => router.back()}>
          <Text style={styles.backBtnAltText}>رجوع</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCancelled = parcel.status === "cancelled";
  const isDelivered = parcel.status === "delivered";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>✕</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>تتبع الطرد</Text>
          <Text style={styles.trackingNum}>#{parcel.trackingNumber}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Status Banner */}
        <View style={[
          styles.statusBanner,
          isCancelled && styles.statusBannerCancelled,
          isDelivered && styles.statusBannerDelivered,
        ]}>
          <Text style={styles.statusBannerIcon}>
            {isCancelled ? "❌" : isDelivered ? "🎉" : STATUS_STEPS[currentStepIndex]?.icon ?? "📦"}
          </Text>
          <View>
            <Text style={styles.statusBannerLabel}>
              {isCancelled ? "تم إلغاء الطلب" : isDelivered ? "تم التسليم بنجاح!" : STATUS_STEPS[currentStepIndex]?.label ?? ""}
            </Text>
            <Text style={styles.statusBannerSub}>
              {DELIVERY_TYPE_LABELS[parcel.deliveryType] ?? parcel.deliveryType}
            </Text>
          </View>
        </View>

        {/* Progress Steps */}
        {!isCancelled && (
          <View style={styles.stepsCard}>
            <Text style={styles.cardTitle}>مراحل التوصيل</Text>
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepLineCol}>
                    <View style={[styles.stepDot, isCompleted && styles.stepDotCompleted, isCurrent && styles.stepDotCurrent]}>
                      {isCompleted && !isCurrent && <Text style={styles.stepCheck}>✓</Text>}
                      {isCurrent && <View style={styles.stepDotInner} />}
                    </View>
                    {idx < STATUS_STEPS.length - 1 && (
                      <View style={[styles.stepLine, isCompleted && idx < currentStepIndex && styles.stepLineCompleted]} />
                    )}
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepLabel, isCompleted && styles.stepLabelCompleted, isCurrent && styles.stepLabelCurrent]}>
                      {step.icon} {step.label}
                    </Text>
                    {isCurrent && !isDelivered && <Text style={styles.stepCurrentHint}>الحالة الحالية</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>تفاصيل الطرد</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>الحجم</Text>
            <Text style={styles.detailValue}>{SIZE_LABELS[parcel.parcelSize] ?? parcel.parcelSize}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>المستلم</Text>
            <Text style={styles.detailValue}>{parcel.recipientName}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>هاتف المستلم</Text>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${parcel.recipientPhone}`)}>
              <Text style={[styles.detailValue, styles.phoneLink]}>{parcel.recipientPhone}</Text>
            </TouchableOpacity>
          </View>
          {parcel.deliveryType === "intercity" && parcel.toCity && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>من → إلى</Text>
                <Text style={styles.detailValue}>{parcel.fromCity} ← {parcel.toCity}</Text>
              </View>
            </>
          )}
          {parcel.scheduledDate && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>الموعد</Text>
                <Text style={styles.detailValue}>{parcel.scheduledDate}{parcel.scheduledTimeSlot ? ` - ${parcel.scheduledTimeSlot}` : ""}</Text>
              </View>
            </>
          )}
          {parcel.parcelDescription && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>الوصف</Text>
                <Text style={[styles.detailValue, { flex: 1, textAlign: "right" }]}>{parcel.parcelDescription}</Text>
              </View>
            </>
          )}
        </View>

        {/* Addresses */}
        <View style={styles.addressesCard}>
          <Text style={styles.cardTitle}>العناوين</Text>
          <View style={styles.addressRow}>
            <View style={[styles.addrDot, { backgroundColor: "#22C55E" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>من</Text>
              <Text style={styles.addrText}>{parcel.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.addrConnector} />
          <View style={styles.addressRow}>
            <View style={[styles.addrDot, { backgroundColor: "#EF4444" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>إلى</Text>
              <Text style={styles.addrText}>{parcel.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {/* Driver */}
        {parcel.driverName && (
          <View style={styles.driverCard}>
            <Text style={styles.cardTitle}>الكابتن</Text>
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>{parcel.driverName.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{parcel.driverName}</Text>
                {parcel.driverPhone && (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${parcel.driverPhone}`)}>
                    <Text style={styles.driverPhone}>📞 {parcel.driverPhone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>{isDelivered ? "🎉 رائع!" : "رجوع للرئيسية"}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  centered: { flex: 1, backgroundColor: "#1A0533", alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { color: "#FFFFFF", fontSize: 16 },
  backBtnAlt: { backgroundColor: "#FFD700", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnAltText: { color: "#1A0533", fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2D1B69", alignItems: "center", justifyContent: "center" },
  backIcon: { color: "#FFD700", fontSize: 16, fontWeight: "bold" },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  trackingNum: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2D1B69", alignItems: "center", justifyContent: "center" },
  refreshIcon: { color: "#FFD700", fontSize: 20, fontWeight: "bold" },
  scrollContent: { paddingBottom: 20 },
  statusBanner: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: "#2D1B69",
    borderRadius: 18, padding: 20, flexDirection: "row", alignItems: "center", gap: 16,
    borderWidth: 1.5, borderColor: "#FFD700",
  },
  statusBannerCancelled: { borderColor: "#EF4444", backgroundColor: "#2D1B1B" },
  statusBannerDelivered: { borderColor: "#22C55E", backgroundColor: "#1B2D1B" },
  statusBannerIcon: { fontSize: 36 },
  statusBannerLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  statusBannerSub: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 },
  stepsCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: "#2D1B69", borderRadius: 18, padding: 20 },
  cardTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 16 },
  stepRow: { flexDirection: "row", gap: 14, minHeight: 50 },
  stepLineCol: { alignItems: "center", width: 24 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#3D2580", borderWidth: 2, borderColor: "#4A3B6A", alignItems: "center", justifyContent: "center" },
  stepDotCompleted: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  stepDotCurrent: { backgroundColor: "#FFD700", borderColor: "#FFD700" },
  stepDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1A0533" },
  stepCheck: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" },
  stepLine: { width: 2, flex: 1, backgroundColor: "#3D2580", marginVertical: 2 },
  stepLineCompleted: { backgroundColor: "#22C55E" },
  stepContent: { flex: 1, paddingTop: 2, paddingBottom: 8 },
  stepLabel: { color: "#6B5B8A", fontSize: 14 },
  stepLabelCompleted: { color: "#C4B5D4" },
  stepLabelCurrent: { color: "#FFD700", fontWeight: "700" },
  stepCurrentHint: { color: "#FFD700", fontSize: 11, marginTop: 2, opacity: 0.7 },
  detailsCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: "#2D1B69", borderRadius: 18, padding: 20 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { color: "#9B8AB0", fontSize: 13 },
  detailValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  detailDivider: { height: 1, backgroundColor: "#3D2580", marginVertical: 10 },
  phoneLink: { color: "#FFD700", textDecorationLine: "underline" },
  addressesCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: "#2D1B69", borderRadius: 18, padding: 20 },
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  addrDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  addrLabel: { color: "#9B8AB0", fontSize: 11, marginBottom: 2 },
  addrText: { color: "#FFFFFF", fontSize: 14 },
  addrConnector: { width: 2, height: 20, backgroundColor: "#3D2580", marginLeft: 5, marginVertical: 4 },
  driverCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: "#2D1B69", borderRadius: 18, padding: 20 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  driverAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#FFD700", alignItems: "center", justifyContent: "center" },
  driverAvatarText: { color: "#1A0533", fontSize: 20, fontWeight: "800" },
  driverName: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  driverPhone: { color: "#FFD700", fontSize: 13, marginTop: 4 },
  doneBtn: { marginHorizontal: 20, marginTop: 8, backgroundColor: "#FFD700", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  doneBtnText: { color: "#1A0533", fontSize: 16, fontWeight: "800" },
});

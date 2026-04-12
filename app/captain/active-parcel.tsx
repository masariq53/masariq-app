import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const STEPS = [
  { key: "accepted", label: "تم القبول", icon: "✅" },
  { key: "picked_up", label: "تم استلام الطرد", icon: "📦" },
  { key: "in_transit", label: "في الطريق للتسليم", icon: "🚗" },
  { key: "delivered", label: "تم التسليم", icon: "🎉" },
];

export default function ActiveParcelScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ parcelId: string }>();
  const parcelId = parseInt(params.parcelId ?? "0");

  const utils = trpc.useUtils();

  const { data: parcel, isLoading, refetch } = trpc.parcel.getById.useQuery(
    { parcelId },
    { enabled: !!parcelId, refetchInterval: 8000 }
  );

  const updateStatusMutation = trpc.parcel.updateStatus.useMutation({
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetch();
      utils.parcel.getById.invalidate({ parcelId });
    },
    onError: (err) => {
      Alert.alert("خطأ", err.message || "حدث خطأ أثناء تحديث الحالة");
    },
  });

  const handlePickup = () => {
    Alert.alert(
      "تأكيد الاستلام",
      "هل استلمت الطرد من المرسل؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "نعم، استلمت",
          onPress: () => updateStatusMutation.mutate({
            parcelId,
            status: "picked_up",
            updatedBy: "driver",
            note: "تم استلام الطرد من المرسل",
          }),
        },
      ]
    );
  };

  const handleInTransit = () => {
    updateStatusMutation.mutate({
      parcelId,
      status: "in_transit",
      updatedBy: "driver",
      note: "الكابتن في الطريق للتسليم",
    });
  };

  const handleDelivery = () => {
    Alert.alert(
      "تأكيد التسليم",
      "هل تأكدت من تسليم الطرد للمستلم؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "نعم، تم التسليم",
          onPress: () => {
            updateStatusMutation.mutate(
              {
                parcelId,
                status: "delivered",
                updatedBy: "driver",
                note: "تم تسليم الطرد للمستلم",
              },
              {
                onSuccess: () => {
                  setTimeout(() => {
                    router.replace({ pathname: "/captain/parcel-summary" as any, params: { parcelId: parcelId.toString() } });
                  }, 500);
                },
              }
            );
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      "إلغاء الطرد",
      "هل تريد إلغاء هذا الطلب؟",
      [
        { text: "لا", style: "cancel" },
        {
          text: "نعم، إلغاء",
          style: "destructive",
          onPress: () => {
            updateStatusMutation.mutate({
              parcelId,
              status: "cancelled",
              updatedBy: "driver",
              note: "تم الإلغاء من قبل الكابتن",
            });
            router.replace("/captain/home" as any);
          },
        },
      ]
    );
  };

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
        <TouchableOpacity style={styles.backBtnAlt} onPress={() => router.replace("/captain/home" as any)}>
          <Text style={styles.backBtnAltText}>الرئيسية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === parcel.status);
  const isPickedUp = parcel.status === "picked_up" || parcel.status === "in_transit" || parcel.status === "delivered";
  const isInTransit = parcel.status === "in_transit" || parcel.status === "delivered";
  const isDelivered = parcel.status === "delivered";
  const isCancelled = parcel.status === "cancelled";

  const SIZE_LABELS: Record<string, string> = {
    small: "📦 صغير (حتى 2 كغ)",
    medium: "🗃️ متوسط (2-10 كغ)",
    large: "📫 كبير (10-30 كغ)",
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📦 طرد نشط</Text>
          <Text style={styles.headerSub}>#{parcel.trackingNumber}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Progress Steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.cardTitle}>مراحل التوصيل</Text>
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepLineCol}>
                  <View style={[
                    styles.stepDot,
                    isCompleted && styles.stepDotCompleted,
                    isCurrent && styles.stepDotCurrent,
                  ]}>
                    {isCompleted && <Text style={styles.stepCheck}>✓</Text>}
                    {isCurrent && <View style={styles.stepDotInner} />}
                  </View>
                  {idx < STEPS.length - 1 && (
                    <View style={[styles.stepLine, isCompleted && styles.stepLineCompleted]} />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={[
                    styles.stepLabel,
                    isCompleted && styles.stepLabelCompleted,
                    isCurrent && styles.stepLabelCurrent,
                  ]}>
                    {step.icon} {step.label}
                  </Text>
                  {isCurrent && !isDelivered && (
                    <Text style={styles.stepCurrentHint}>الحالة الحالية</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Addresses */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>العناوين</Text>
          <View style={styles.addressRow}>
            <View style={[styles.addrDot, { backgroundColor: "#22C55E" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>📍 عنوان الاستلام</Text>
              <Text style={styles.addrText}>{parcel.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.addrConnector} />
          <View style={styles.addressRow}>
            <View style={[styles.addrDot, { backgroundColor: "#EF4444" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addrLabel}>🏁 عنوان التسليم</Text>
              <Text style={styles.addrText}>{parcel.dropoffAddress}</Text>
            </View>
          </View>
        </View>

        {/* Parcel Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>تفاصيل الطرد</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>الحجم</Text>
            <Text style={styles.detailValue}>{SIZE_LABELS[parcel.parcelSize] ?? parcel.parcelSize}</Text>
          </View>
          {parcel.parcelDescription && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>الوصف</Text>
                <Text style={[styles.detailValue, { flex: 1, textAlign: "right" }]}>{parcel.parcelDescription}</Text>
              </View>
            </>
          )}
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>الأجرة</Text>
            <Text style={[styles.detailValue, { color: "#FFD700", fontWeight: "800" }]}>
              {parcel.price ? `${Number(parcel.price).toLocaleString()} د.ع` : "تحدد بعد الاستلام"}
            </Text>
          </View>
        </View>

        {/* Recipient Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>معلومات المستلم</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>الاسم</Text>
            <Text style={styles.detailValue}>{parcel.recipientName}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>الهاتف</Text>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${parcel.recipientPhone}`)}>
              <Text style={[styles.detailValue, styles.phoneLink]}>📞 {parcel.recipientPhone}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sender Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>معلومات المرسل</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>الاسم</Text>
            <Text style={styles.detailValue}>{parcel.senderName || "غير محدد"}</Text>
          </View>
          {parcel.senderPhone && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>الهاتف</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${parcel.senderPhone}`)}>
                  <Text style={[styles.detailValue, styles.phoneLink]}>📞 {parcel.senderPhone}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons */}
        {!isDelivered && !isCancelled && (
          <View style={styles.actionsCard}>
            {/* Step 1: Pickup */}
            {!isPickedUp && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPickup]}
                onPress={handlePickup}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <ActivityIndicator color="#1A0533" />
                ) : (
                  <Text style={styles.actionBtnText}>📦 تأكيد استلام الطرد</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Step 2: In Transit */}
            {isPickedUp && !isInTransit && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnTransit]}
                onPress={handleInTransit}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>🚗 في الطريق للتسليم</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Step 3: Deliver - Direct without OTP */}
            {isInTransit && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDeliver]}
                onPress={handleDelivery}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <ActivityIndicator color="#1A0533" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: "#1A0533" }]}>🎉 تأكيد التسليم</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Cancel */}
            {!isPickedUp && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCancel]}
                onPress={handleCancel}
              >
                <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>❌ إلغاء الطلب</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Delivered State */}
        {isDelivered && (
          <View style={styles.deliveredBanner}>
            <Text style={styles.deliveredIcon}>🎉</Text>
            <Text style={styles.deliveredText}>تم التسليم بنجاح!</Text>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => router.replace("/captain/home" as any)}
            >
              <Text style={styles.homeBtnText}>العودة للرئيسية</Text>
            </TouchableOpacity>
          </View>
        )}

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
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2D1B69", alignItems: "center", justifyContent: "center" },
  refreshIcon: { color: "#FFD700", fontSize: 20 },
  scrollContent: { paddingBottom: 20 },
  stepsCard: { marginHorizontal: 20, marginBottom: 14, backgroundColor: "#2D1B69", borderRadius: 18, padding: 20 },
  card: { marginHorizontal: 20, marginBottom: 14, backgroundColor: "#2D1B69", borderRadius: 18, padding: 20 },
  cardTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 14 },
  stepRow: { flexDirection: "row", gap: 14, minHeight: 48 },
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
  addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  addrDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  addrLabel: { color: "#9B8AB0", fontSize: 11, marginBottom: 2 },
  addrText: { color: "#FFFFFF", fontSize: 14 },
  addrConnector: { width: 2, height: 20, backgroundColor: "#3D2580", marginLeft: 5, marginVertical: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { color: "#9B8AB0", fontSize: 13 },
  detailValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  detailDivider: { height: 1, backgroundColor: "#3D2580", marginVertical: 10 },
  phoneLink: { color: "#FFD700", textDecorationLine: "underline" },
  actionsCard: { marginHorizontal: 20, marginBottom: 14, gap: 10 },
  actionBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  actionBtnPickup: { backgroundColor: "#FFD700" },
  actionBtnTransit: { backgroundColor: "#6366F1" },
  actionBtnDeliver: { backgroundColor: "#22C55E" },
  actionBtnCancel: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: "#EF4444" },
  actionBtnText: { fontSize: 16, fontWeight: "800", color: "#1A0533" },
  deliveredBanner: { marginHorizontal: 20, marginBottom: 14, backgroundColor: "#1B2D1B", borderRadius: 18, padding: 24, alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "#22C55E" },
  deliveredIcon: { fontSize: 48 },
  deliveredText: { color: "#22C55E", fontSize: 20, fontWeight: "800" },
  homeBtn: { backgroundColor: "#22C55E", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  homeBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

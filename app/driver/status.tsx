import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDriver } from "@/lib/driver-context";
import { trpc } from "@/lib/trpc";

export default function DriverStatusScreen() {
  const insets = useSafeAreaInsets();
  const { driver, logout } = useDriver();

  // Refresh driver profile to get latest status
  const { data: freshDriver, isLoading } = trpc.driver.getProfile.useQuery(
    { driverId: driver?.id ?? 0 },
    { enabled: !!driver?.id, refetchInterval: 30000 } // Refresh every 30s
  );

  const status = freshDriver?.registrationStatus ?? driver?.registrationStatus;
  const rejectionReason = freshDriver?.rejectionReason ?? driver?.rejectionReason;

  const handleLogout = async () => {
    await logout();
    router.replace("/driver/login" as any);
  };

  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          icon: "⏳",
          title: "طلبك قيد المراجعة",
          subtitle: "يتم مراجعة طلبك من قِبل فريق مسار. سيتم إشعارك خلال 24-48 ساعة.",
          color: "#F59E0B",
          bgColor: "#451A03",
          steps: [
            { label: "تم استلام الطلب", done: true },
            { label: "مراجعة الوثائق", done: false },
            { label: "الموافقة النهائية", done: false },
          ],
        };
      case "approved":
        return {
          icon: "✅",
          title: "تم قبول طلبك!",
          subtitle: "مبروك! تم قبولك كسائق في مسار. يمكنك الآن البدء باستقبال الرحلات.",
          color: "#22C55E",
          bgColor: "#052E16",
          steps: [
            { label: "تم استلام الطلب", done: true },
            { label: "مراجعة الوثائق", done: true },
            { label: "الموافقة النهائية", done: true },
          ],
        };
      case "rejected":
        return {
          icon: "❌",
          title: "تم رفض طلبك",
          subtitle: rejectionReason ?? "للأسف لم يتم قبول طلبك. يمكنك إعادة التقديم بعد تصحيح المعلومات.",
          color: "#EF4444",
          bgColor: "#450A0A",
          steps: [
            { label: "تم استلام الطلب", done: true },
            { label: "مراجعة الوثائق", done: true },
            { label: "الموافقة النهائية", done: false },
          ],
        };
      default:
        return {
          icon: "📋",
          title: "حالة الطلب",
          subtitle: "جاري تحميل بيانات طلبك...",
          color: "#9B8EC4",
          bgColor: "#1E1035",
          steps: [],
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>مسار — حالة طلبك</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>خروج</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#FFD700" size="large" />
            <Text style={styles.loadingText}>جاري تحديث الحالة...</Text>
          </View>
        ) : (
          <>
            {/* Status Card */}
            <View style={[styles.statusCard, { backgroundColor: config.bgColor, borderColor: config.color }]}>
              <Text style={styles.statusIcon}>{config.icon}</Text>
              <Text style={[styles.statusTitle, { color: config.color }]}>{config.title}</Text>
              <Text style={styles.statusSubtitle}>{config.subtitle}</Text>
            </View>

            {/* Driver Info */}
            {driver && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>بياناتك المسجلة</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>الاسم</Text>
                  <Text style={styles.infoValue}>{driver.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>الهاتف</Text>
                  <Text style={styles.infoValue}>{driver.phone}</Text>
                </View>
                {driver.vehicleModel && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>السيارة</Text>
                    <Text style={styles.infoValue}>{driver.vehicleModel} {driver.vehicleColor ? `• ${driver.vehicleColor}` : ""}</Text>
                  </View>
                )}
                {driver.vehiclePlate && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>اللوحة</Text>
                    <Text style={styles.infoValue}>{driver.vehiclePlate}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Progress Steps */}
            {config.steps.length > 0 && (
              <View style={styles.stepsCard}>
                <Text style={styles.stepsTitle}>مراحل المراجعة</Text>
                {config.steps.map((step, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <View style={[styles.stepDot, step.done ? styles.stepDotDone : styles.stepDotPending]}>
                      <Text style={styles.stepDotText}>{step.done ? "✓" : (idx + 1).toString()}</Text>
                    </View>
                    {idx < config.steps.length - 1 && (
                      <View style={[styles.stepLine, step.done ? styles.stepLineDone : {}]} />
                    )}
                    <Text style={[styles.stepLabel, step.done ? styles.stepLabelDone : {}]}>{step.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            {status === "approved" && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => router.replace("/captain/home" as any)}
              >
                <Text style={styles.startBtnText}>🚗 ابدأ استقبال الرحلات</Text>
              </TouchableOpacity>
            )}

            {status === "rejected" && (
              <View style={styles.contactBox}>
                <Text style={[styles.contactText, { color: "#F87171", fontWeight: "700" }]}>
                  تم رفض طلبك
                </Text>
                <Text style={styles.contactText}>
                  لإعادة التقديم، سجّل خروجاً ثم اذهب إلى حسابي ← وضع الكابتن
                </Text>
              </View>
            )}

            {status === "pending" && (
              <View style={styles.contactBox}>
                <Text style={styles.contactText}>
                  للاستفسار عن حالة طلبك، تواصل معنا عبر واتساب على الرقم:
                </Text>
                <Text style={styles.contactPhone}>+964 770 000 0000</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0A1E" },

  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#1E1035",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  logoutBtn: {
    backgroundColor: "#1E1035", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  logoutText: { color: "#F87171", fontSize: 13, fontWeight: "700" },

  body: { padding: 20, gap: 16 },

  loadingBox: { alignItems: "center", paddingTop: 80, gap: 12 },
  loadingText: { color: "#9B8EC4", fontSize: 14 },

  statusCard: {
    borderRadius: 20, padding: 24, alignItems: "center",
    borderWidth: 1.5, gap: 10,
  },
  statusIcon: { fontSize: 56 },
  statusTitle: { fontSize: 22, fontWeight: "900", textAlign: "center" },
  statusSubtitle: { fontSize: 14, color: "#CBD5E1", textAlign: "center", lineHeight: 22 },

  infoCard: {
    backgroundColor: "#1E1035", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  infoTitle: { fontSize: 14, fontWeight: "800", color: "#9B8EC4", marginBottom: 12 },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#2D1B4E",
  },
  infoLabel: { fontSize: 13, color: "#6B7280" },
  infoValue: { fontSize: 13, color: "#FFFFFF", fontWeight: "600" },

  stepsCard: {
    backgroundColor: "#1E1035", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#2D1B4E",
  },
  stepsTitle: { fontSize: 14, fontWeight: "800", color: "#9B8EC4", marginBottom: 16 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#2D1B4E", alignItems: "center", justifyContent: "center",
  },
  stepDotDone: { backgroundColor: "#22C55E" },
  stepDotPending: { backgroundColor: "#2D1B4E", borderWidth: 1, borderColor: "#6B7280" },
  stepDotText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },
  stepLine: { position: "absolute", left: 15, top: 32, width: 2, height: 16, backgroundColor: "#2D1B4E" },
  stepLineDone: { backgroundColor: "#22C55E" },
  stepLabel: { fontSize: 14, color: "#6B7280", flex: 1 },
  stepLabelDone: { color: "#FFFFFF", fontWeight: "600" },

  startBtn: {
    backgroundColor: "#FFD700", borderRadius: 16, paddingVertical: 16,
    alignItems: "center",
  },
  startBtnText: { fontSize: 17, fontWeight: "900", color: "#1A0533" },

  reapplyBtn: {
    backgroundColor: "#1E1035", borderRadius: 16, paddingVertical: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#EF4444",
  },
  reapplyBtnText: { fontSize: 17, fontWeight: "700", color: "#F87171" },

  contactBox: {
    backgroundColor: "#1E1035", borderRadius: 14, padding: 16,
    alignItems: "center", gap: 6,
  },
  contactText: { fontSize: 13, color: "#9B8EC4", textAlign: "center" },
  contactPhone: { fontSize: 16, color: "#FFD700", fontWeight: "800" },
});

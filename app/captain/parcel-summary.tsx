import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";

export default function ParcelSummaryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ parcelId: string }>();
  const parcelId = parseInt(params.parcelId ?? "0");

  const { data: parcel, isLoading } = trpc.parcel.getById.useQuery(
    { parcelId },
    { enabled: !!parcelId }
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  const SIZE_LABELS: Record<string, string> = {
    small: "📦 صغير",
    medium: "🗃️ متوسط",
    large: "📫 كبير",
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Success Banner */}
        <View style={styles.successBanner}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.successTitle}>تم التسليم بنجاح!</Text>
          <Text style={styles.successSub}>شكراً على خدمتك المميزة</Text>
        </View>

        {/* Summary Card */}
        {parcel && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ملخص الطرد</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>رقم التتبع</Text>
              <Text style={styles.detailValue}>#{parcel.trackingNumber}</Text>
            </View>
            <View style={styles.detailDivider} />
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
              <Text style={styles.detailLabel}>الأجرة</Text>
              <Text style={[styles.detailValue, { color: "#FFD700", fontWeight: "800", fontSize: 18 }]}>
                {parcel.price ? `${Number(parcel.price).toLocaleString()} د.ع` : "-"}
              </Text>
            </View>
            {parcel.deliveredAt && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>وقت التسليم</Text>
                  <Text style={styles.detailValue}>
                    {new Date(parcel.deliveredAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Home Button */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace("/captain/home" as any)}
        >
          <Text style={styles.homeBtnText}>العودة للرئيسية</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  centered: { flex: 1, backgroundColor: "#1A0533", alignItems: "center", justifyContent: "center" },
  scrollContent: { padding: 20 },
  successBanner: {
    backgroundColor: "#1B2D1B", borderRadius: 20, padding: 28,
    alignItems: "center", gap: 8, marginBottom: 20,
    borderWidth: 1.5, borderColor: "#22C55E",
  },
  successIcon: { fontSize: 56 },
  successTitle: { color: "#22C55E", fontSize: 24, fontWeight: "800" },
  successSub: { color: "rgba(255,255,255,0.6)", fontSize: 14 },
  card: { backgroundColor: "#2D1B69", borderRadius: 18, padding: 20, marginBottom: 16 },
  cardTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", textAlign: "right", marginBottom: 14 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailLabel: { color: "#9B8AB0", fontSize: 13 },
  detailValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  detailDivider: { height: 1, backgroundColor: "#3D2580", marginVertical: 10 },
  homeBtn: {
    backgroundColor: "#FFD700", paddingVertical: 18, borderRadius: 16, alignItems: "center",
  },
  homeBtnText: { color: "#1A0533", fontSize: 17, fontWeight: "800" },
});

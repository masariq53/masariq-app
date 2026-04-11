import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePassenger } from "@/lib/passenger-context";
import { useDriver } from "@/lib/driver-context";
import { useThemeContext } from "@/lib/theme-provider";
import { useT } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

type Ticket = {
  id: number;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  category: string;
  unreadByUser: number;
  createdAt: string;
  updatedAt: string;
};

export default function SupportScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { passenger } = usePassenger();
  const { driver } = useDriver();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";

  // تحديد نوع المستخدم
  const isDriverMode = !!driver && !passenger;
  const userId = isDriverMode ? driver?.id : passenger?.id;
  const userType = isDriverMode ? "driver" : "passenger";
  const userName = isDriverMode ? driver?.name : passenger?.name;

  const colors = {
    bg: isDark ? "#0D0019" : "#F0EBF8",
    card: isDark ? "#1E0F4A" : "#FFFFFF",
    header: "#1A0533",
    title: "#FFFFFF",
    text: isDark ? "#FFFFFF" : "#1A0533",
    muted: isDark ? "#9B8AB0" : "#6B7A8D",
    border: isDark ? "#2D1B69" : "#E5E7EB",
    accent: "#7C3AED",
    open: "#F59E0B",
    in_progress: "#3B82F6",
    resolved: "#10B981",
    closed: "#6B7280",
  };

  const ticketsQuery = trpc.support.getUserTickets.useQuery(
    { userId: userId ?? 0, userType },
    { enabled: !!userId, refetchInterval: 15000 }
  );

  const tickets: Ticket[] = (ticketsQuery.data as Ticket[] | undefined) ?? [];

  const getStatusColor = (status: string) => {
    if (status === "open") return colors.open;
    if (status === "in_progress") return colors.in_progress;
    if (status === "resolved") return colors.resolved;
    return colors.closed;
  };

  const getStatusLabel = (status: string) => {
    if (status === "open") return t.help.open;
    if (status === "in_progress") return t.help.in_progress;
    if (status === "resolved") return t.help.resolved;
    return t.help.closed;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("ar-IQ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const renderTicket = ({ item }: { item: Ticket }) => (
    <TouchableOpacity
      style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: "/support/chat", params: { ticketId: item.id, subject: item.subject } } as any)}
    >
      <View style={styles.ticketHeader}>
        <Text style={[styles.ticketSubject, { color: colors.text }]} numberOfLines={1}>
          {item.subject}
        </Text>
        {item.unreadByUser > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.unreadText}>{item.unreadByUser}</Text>
          </View>
        )}
      </View>
      <View style={styles.ticketFooter}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "22" }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
        <Text style={[styles.ticketDate, { color: colors.muted }]}>{formatDate(item.updatedAt || item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.header }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💬 {t.help.supportChat}</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push("/support/new" as any)}
        >
          <Text style={styles.newBtnText}>+ {t.help.newTicket}</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={[styles.content, { backgroundColor: colors.bg }]}>
        {ticketsQuery.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>🎧</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.help.noTickets}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.muted }]}>{t.help.createFirst}</Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.accent }]}
              onPress={() => router.push("/support/new" as any)}
            >
              <Text style={styles.createBtnText}>+ {t.help.newTicket}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderTicket}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onRefresh={() => ticketsQuery.refetch()}
            refreshing={ticketsQuery.isFetching}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, color: "#FFFFFF" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  newBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  newBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  content: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 22 },
  createBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  list: { padding: 16, gap: 12 },
  ticketCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ticketSubject: { flex: 1, fontSize: 15, fontWeight: "600" },
  unreadBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  ticketFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  ticketDate: { fontSize: 12 },
});

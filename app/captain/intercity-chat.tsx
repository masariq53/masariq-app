import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

type Message = {
  id: number;
  bookingId: number;
  senderType: "passenger" | "driver";
  senderId: number;
  message: string;
  isRead: boolean;
  createdAt: string | Date;
};

export default function CaptainChatScreen() {
  const params = useLocalSearchParams<{
    bookingId: string;
    tripId: string;
    driverId: string;
    passengerName: string;
    tripStatus: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const flatListRef = useRef<FlatList>(null);

  const bookingId = parseInt(params.bookingId || "0");
  const tripId = parseInt(params.tripId || "0");
  const driverId = parseInt(params.driverId || "0");
  const passengerName = params.passengerName || "المسافر";
  const tripStatus = params.tripStatus || "scheduled";
  const isChatDisabled = tripStatus === "completed";

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data: messages, refetch } = trpc.intercity.getMessages.useQuery(
    { bookingId },
    { enabled: bookingId > 0, refetchInterval: 3000 }
  );

  const sendMessage = trpc.intercity.sendMessage.useMutation();
  const markRead = trpc.intercity.markRead.useMutation();

  useEffect(() => {
    if (bookingId > 0) {
      markRead.mutate({ bookingId, readerType: "driver" });
    }
  }, [bookingId]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      markRead.mutate({ bookingId, readerType: "driver" });
    }
  }, [messages?.length]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || isChatDisabled) return;
    setIsSending(true);
    setInputText("");
    try {
      await sendMessage.mutateAsync({
        bookingId,
        tripId,
        senderType: "driver",
        senderId: driverId,
        message: text,
      });
      refetch();
    } catch (e) {
      Alert.alert("خطأ", "فشل إرسال الرسالة");
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, isChatDisabled]);

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderType === "driver";
    const msgList = messages || [];
    const prevItem = index > 0 ? msgList[index - 1] : null;
    const showDateSep =
      !prevItem ||
      new Date(item.createdAt).toDateString() !== new Date(prevItem.createdAt).toDateString();

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSep}>
            <Text style={styles.dateSepText}>
              {new Date(item.createdAt).toLocaleDateString("ar-IQ", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
        )}
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {!isMe && (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
              {item.message}
            </Text>
            <View style={styles.msgMeta}>
              <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeOther]}>
                {formatTime(item.createdAt)}
              </Text>
              {isMe && (
                <Text style={styles.readTick}>{item.isRead ? "✓✓" : "✓"}</Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ رجوع</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>👤</Text>
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.foreground }]}>{passengerName}</Text>
            <Text style={[styles.headerStatus, { color: colors.muted }]}>
              {isChatDisabled ? "🔒 المحادثة مغلقة" : "● مسافر"}
            </Text>
          </View>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Messages */}
      {!messages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            ابدأ المحادثة مع المسافر
          </Text>
          <Text style={[styles.emptyHint, { color: colors.muted }]}>
            يمكنك التواصل مع المسافر لتنسيق موقع الالتقاء
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages as Message[]}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Disabled Banner */}
      {isChatDisabled && (
        <View style={styles.disabledBanner}>
          <Text style={styles.disabledBannerText}>
            🔒 تم إغلاق المحادثة بعد اكتمال الرحلة
          </Text>
        </View>
      )}

      {/* Input */}
      {!isChatDisabled && (
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="اكتب رسالة..."
            placeholderTextColor={colors.muted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            textAlign="right"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendBtnText}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  backBtn: { width: 60 },
  backText: { fontSize: 18, fontWeight: "600" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#F0F0F0",
    alignItems: "center", justifyContent: "center",
  },
  headerAvatarText: { fontSize: 20 },
  headerName: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  headerStatus: { fontSize: 12, textAlign: "center" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  emptyHint: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  dateSep: { alignItems: "center", marginVertical: 12 },
  dateSepText: { fontSize: 12, color: "#9BA1A6", backgroundColor: "rgba(0,0,0,0.05)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 3, gap: 8 },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F0F0F0",
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
  avatarText: { fontSize: 16 },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: "#0a7ea4",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#F0F0F0",
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: "#fff" },
  msgTextOther: { color: "#11181C" },
  msgMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, justifyContent: "flex-end" },
  msgTime: { fontSize: 11 },
  msgTimeMe: { color: "rgba(255,255,255,0.7)" },
  msgTimeOther: { color: "#9BA1A6" },
  readTick: { fontSize: 11, color: "rgba(255,255,255,0.8)" },
  disabledBanner: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  disabledBannerText: { fontSize: 13, color: "#9BA1A6" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 0.5,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    textAlignVertical: "center",
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
});

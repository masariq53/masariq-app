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
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

type Message = {
  id: number;
  rideId: number;
  senderType: "passenger" | "driver";
  senderId: number;
  message: string;
  isRead: boolean;
  createdAt: string | Date;
};

// رسائل سريعة للراكب
const QUICK_REPLIES = [
  "أنا في الطريق إليك 🚶",
  "انتظرني دقيقة ⏳",
  "أين أنت بالضبط؟ 📍",
  "وصلت، أين السيارة؟ 🚗",
  "شكراً لك 🙏",
  "حسناً، في انتظارك",
];

export default function PassengerRideChatScreen() {
  const params = useLocalSearchParams<{
    rideId: string;
    passengerId: string;
    driverName: string;
    rideStatus: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const flatListRef = useRef<FlatList>(null);

  const rideId = parseInt(params.rideId || "0");
  const passengerId = parseInt(params.passengerId || "0");
  const driverName = params.driverName || "السائق";
  const rideStatus = params.rideStatus || "accepted";
  const isChatDisabled = rideStatus === "completed" || rideStatus === "cancelled";

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // جلب الرسائل كل 3 ثوانٍ
  const { data: messages, refetch } = trpc.rides.getMessages.useQuery(
    { rideId },
    { enabled: rideId > 0, refetchInterval: 3000 }
  );

  const sendMessage = trpc.rides.sendMessage.useMutation();
  const markRead = trpc.rides.markRead.useMutation();

  // تحديد الرسائل كمقروءة عند فتح الشاشة
  useEffect(() => {
    if (rideId > 0) {
      markRead.mutate({ rideId, readerType: "passenger" });
    }
  }, [rideId]);

  // تمرير للأسفل عند وصول رسائل جديدة
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      markRead.mutate({ rideId, readerType: "passenger" });
    }
  }, [messages?.length]);

  const handleSend = useCallback(async (text?: string) => {
    const msgText = (text ?? inputText).trim();
    if (!msgText || isSending || isChatDisabled) return;
    setIsSending(true);
    if (!text) setInputText("");
    try {
      await sendMessage.mutateAsync({
        rideId,
        senderType: "passenger",
        senderId: passengerId,
        message: msgText,
      });
      refetch();
    } catch (e) {
      Alert.alert("خطأ", "فشل إرسال الرسالة");
      if (!text) setInputText(msgText);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, isChatDisabled]);

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderType === "passenger";
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
                timeZone: "Asia/Baghdad",
              })}
            </Text>
          </View>
        )}
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
          {!isMe && (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>🚗</Text>
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
            <Text style={styles.headerAvatarText}>🚗</Text>
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.foreground }]}>{driverName}</Text>
            <Text style={[styles.headerStatus, { color: colors.muted }]}>
              {isChatDisabled ? "🔒 المحادثة مغلقة" : "● متصل"}
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
          <Text style={[styles.emptyText, { color: colors.foreground }]}>
            ابدأ المحادثة مع السائق
          </Text>
          <Text style={[styles.emptyHint, { color: colors.muted }]}>
            يمكنك التواصل مع السائق لتنسيق موقع الالتقاء
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
        <View style={[styles.disabledBanner, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.disabledBannerText, { color: colors.muted }]}>
            🔒 تم إغلاق المحادثة بعد انتهاء الرحلة
          </Text>
        </View>
      )}

      {/* Input Area */}
      {!isChatDisabled && (
        <View style={[styles.inputArea, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          {/* Quick Replies */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRepliesContainer}
            keyboardShouldPersistTaps="always"
          >
            {QUICK_REPLIES.map((qr) => (
              <TouchableOpacity
                key={qr}
                style={[styles.quickReplyBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => handleSend(qr)}
                disabled={isSending}
              >
                <Text style={[styles.quickReplyText, { color: colors.foreground }]}>{qr}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Text Input Row */}
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
              placeholder="اكتب رسالة..."
              placeholderTextColor={colors.muted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
              textAlign="right"
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]}
              onPress={() => handleSend()}
              disabled={!inputText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>↑</Text>
              )}
            </TouchableOpacity>
          </View>
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
    backgroundColor: "#E6F4FE",
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
    backgroundColor: "#E6F4FE",
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
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
  },
  disabledBannerText: { fontSize: 13 },
  inputArea: {
    borderTopWidth: 0.5,
  },
  quickRepliesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: "row",
  },
  quickReplyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  quickReplyText: { fontSize: 13 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 8,
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

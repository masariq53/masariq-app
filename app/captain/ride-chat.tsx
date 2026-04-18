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
import { useDriver } from "@/lib/driver-context";

type Message = {
  id: number;
  rideId: number;
  senderType: "passenger" | "driver";
  senderId: number;
  message: string;
  isRead: boolean;
  createdAt: string | Date;
};

export default function CaptainRideChatScreen() {
  const params = useLocalSearchParams<{
    rideId: string;
    driverId: string;
    passengerName: string;
    rideStatus: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { driver } = useDriver();

  const rideId = parseInt(params.rideId || "0");
  const driverId = driver?.id ?? parseInt(params.driverId || "0");
  const passengerName = params.passengerName || "الراكب";
  const rideStatus = params.rideStatus || "accepted";
  const isChatDisabled = rideStatus === "completed" || rideStatus === "cancelled";

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

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
      markRead.mutate({ rideId, readerType: "driver" });
    }
  }, [rideId]);

  // تمرير للأسفل عند وصول رسائل جديدة
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      markRead.mutate({ rideId, readerType: "driver" });
    }
  }, [messages?.length]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || isChatDisabled) return;
    setIsSending(true);
    setInputText("");
    try {
      await sendMessage.mutateAsync({
        rideId,
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
    return d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baghdad" });
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
                timeZone: "Asia/Baghdad",
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
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ رجوع</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>👤</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{passengerName}</Text>
            <Text style={styles.headerStatus}>
              {isChatDisabled ? "🔒 المحادثة مغلقة" : "● متصل"}
            </Text>
          </View>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* Messages */}
      {!messages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FFD700" />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>ابدأ المحادثة مع الراكب</Text>
          <Text style={styles.emptyHint}>
            يمكنك التواصل مع الراكب لتنسيق موقع الالتقاء
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
            🔒 تم إغلاق المحادثة بعد انتهاء الرحلة
          </Text>
        </View>
      )}

      {/* Input */}
      {!isChatDisabled && (
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="اكتب رسالة..."
            placeholderTextColor="#9BA1A6"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            textAlign="right"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: inputText.trim() ? "#FFD700" : "#334155" }]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#1A0533" size="small" />
            ) : (
              <Text style={[styles.sendBtnText, { color: inputText.trim() ? "#1A0533" : "#9BA1A6" }]}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A0533" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
    backgroundColor: "#2D1B4E",
  },
  backBtn: { width: 60 },
  backText: { fontSize: 18, fontWeight: "600", color: "#FFD700" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#3D2B5E",
    alignItems: "center", justifyContent: "center",
  },
  headerAvatarText: { fontSize: 20 },
  headerName: { fontSize: 16, fontWeight: "700", textAlign: "center", color: "#ECEDEE" },
  headerStatus: { fontSize: 12, textAlign: "center", color: "#9BA1A6" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: "600", textAlign: "center", color: "#ECEDEE" },
  emptyHint: { fontSize: 13, textAlign: "center", lineHeight: 20, color: "#9BA1A6" },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  dateSep: { alignItems: "center", marginVertical: 12 },
  dateSepText: { fontSize: 12, color: "#9BA1A6", backgroundColor: "rgba(255,255,255,0.07)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginVertical: 3, gap: 8 },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#3D2B5E",
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
    backgroundColor: "#FFD700",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "#2D1B4E",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: "#1A0533" },
  msgTextOther: { color: "#ECEDEE" },
  msgMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, justifyContent: "flex-end" },
  msgTime: { fontSize: 11 },
  msgTimeMe: { color: "rgba(26,5,51,0.6)" },
  msgTimeOther: { color: "#9BA1A6" },
  readTick: { fontSize: 11, color: "rgba(26,5,51,0.6)" },
  disabledBanner: {
    backgroundColor: "#2D1B4E",
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  disabledBannerText: { fontSize: 13, color: "#9BA1A6" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#334155",
    backgroundColor: "#2D1B4E",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    textAlignVertical: "center",
    color: "#ECEDEE",
    backgroundColor: "#1A0533",
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnText: { fontSize: 20, fontWeight: "700" },
});

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePassenger } from "@/lib/passenger-context";
import { useDriver } from "@/lib/driver-context";
import { useThemeContext } from "@/lib/theme-provider";
import { useT } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

type Message = {
  id: number;
  ticketId: number;
  senderType: "user" | "admin";
  senderName: string | null;
  message: string;
  createdAt: string;
  isRead: number;
};

type TicketData = {
  status?: string;
  rating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
};

export default function SupportChatScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { passenger } = usePassenger();
  const { driver } = useDriver();
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";
  const params = useLocalSearchParams<{ ticketId: string; subject: string }>();
  const ticketId = parseInt(params.ticketId ?? "0");
  const subject = params.subject ?? "";

  const isDriverMode = !!driver && !passenger;
  const userId = isDriverMode ? driver?.id : passenger?.id;
  const userType = isDriverMode ? "driver" : "passenger";
  const userName = isDriverMode ? driver?.name : passenger?.name;

  const [newMessage, setNewMessage] = useState("");
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const colors = {
    bg: isDark ? "#0D0019" : "#F0EBF8",
    header: "#1A0533",
    text: isDark ? "#FFFFFF" : "#1A0533",
    muted: isDark ? "#9B8AB0" : "#6B7A8D",
    border: isDark ? "#2D1B69" : "#E5E7EB",
    input: isDark ? "#1E0F4A" : "#FFFFFF",
    inputBorder: isDark ? "#2D1B69" : "#E5E7EB",
    accent: "#7C3AED",
    userBubble: "#7C3AED",
    adminBubble: isDark ? "#1E0F4A" : "#FFFFFF",
    userText: "#FFFFFF",
    adminText: isDark ? "#FFFFFF" : "#1A0533",
    adminBorder: isDark ? "#2D1B69" : "#E5E7EB",
    sendBtn: "#7C3AED",
  };

  const messagesQuery = trpc.support.getMessages.useQuery(
    { ticketId },
    { enabled: !!ticketId, refetchInterval: 8000 }
  );

  const ticketQuery = trpc.support.getTicket.useQuery(
    { ticketId },
    { enabled: !!ticketId }
  );

  const sendMessageMutation = trpc.support.sendMessage.useMutation();
  const markReadMutation = trpc.support.markRead.useMutation();
  const rateTicketMutation = trpc.support.rateTicket.useMutation({
    onSuccess: () => {
      setShowRatingModal(false);
      ticketQuery.refetch();
      Alert.alert("شكراً!", "تم إرسال تقييمك بنجاح 🌟");
    },
    onError: () => {
      Alert.alert("خطأ", "فشل إرسال التقييم. يرجى المحاولة مجدداً.");
    },
  });

  const messages: Message[] = (messagesQuery.data as Message[] | undefined) ?? [];
  const ticket = ticketQuery.data as TicketData | null | undefined;
  const isClosed = ticket?.status === "closed" || ticket?.status === "resolved";
  const hasRated = !!(ticket?.rating);

  // تحديد الرسائل كمقروءة عند فتح الشاشة
  useFocusEffect(
    useCallback(() => {
      if (ticketId) {
        markReadMutation.mutateAsync({ ticketId, readerType: "user" }).catch(() => {});
      }
    }, [ticketId])
  );

  // التمرير للأسفل عند وصول رسائل جديدة
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text) return;
    if (!ticketId) return;

    setNewMessage("");
    try {
      await sendMessageMutation.mutateAsync({
        ticketId,
        senderType: "user",
        senderName: userName ?? undefined,
        message: text,
      });
      await messagesQuery.refetch();
    } catch (e) {
      Alert.alert("خطأ", "فشل إرسال الرسالة. يرجى المحاولة مجدداً.");
      setNewMessage(text);
    }
  };

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert("تنبيه", "يرجى اختيار عدد النجوم أولاً");
      return;
    }
    await rateTicketMutation.mutateAsync({
      ticketId,
      rating: selectedRating,
      ratingComment: ratingComment.trim() || undefined,
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return "اليوم";
    return d.toLocaleDateString("ar-IQ", { month: "short", day: "numeric" });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.senderType === "user";
    const prevItem = index > 0 ? messages[index - 1] : null;
    const showDate = !prevItem || formatDate(item.createdAt) !== formatDate(prevItem.createdAt);

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={[styles.dateText, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
          </View>
        )}
        <View style={[styles.messageRow, isUser ? styles.userRow : styles.adminRow]}>
          {!isUser && (
            <View style={styles.adminAvatar}>
              <Text style={styles.adminAvatarText}>🎧</Text>
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isUser
                ? [styles.userBubble, { backgroundColor: colors.userBubble }]
                : [styles.adminBubble, { backgroundColor: colors.adminBubble, borderColor: colors.adminBorder }],
            ]}
          >
            {!isUser && (
              <Text style={[styles.senderName, { color: colors.accent }]}>{t.help.adminReply}</Text>
            )}
            <Text style={[styles.messageText, { color: isUser ? colors.userText : colors.adminText }]}>
              {item.message}
            </Text>
            <Text style={[styles.messageTime, { color: isUser ? "rgba(255,255,255,0.6)" : colors.muted }]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.header }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>💬 {subject || t.help.supportChat}</Text>
            {ticket && (
              <Text style={[styles.headerStatus, { color: isClosed ? "#6B7280" : "#10B981" }]}>
                {isClosed ? "● " + t.help.closed : "● " + t.help.open}
              </Text>
            )}
          </View>
          {/* زر التقييم إذا كانت التذكرة مغلقة ولم يُقيَّم بعد */}
          {isClosed && !hasRated && (
            <TouchableOpacity
              style={styles.rateBtn}
              onPress={() => setShowRatingModal(true)}
            >
              <Text style={styles.rateBtnText}>⭐ قيّم</Text>
            </TouchableOpacity>
          )}
          {isClosed && hasRated && (
            <View style={styles.ratedBadge}>
              <Text style={styles.ratedBadgeText}>{"⭐".repeat(ticket?.rating ?? 0)}</Text>
            </View>
          )}
        </View>

        {/* Messages */}
        {messagesQuery.isLoading ? (
          <View style={[styles.center, { backgroundColor: colors.bg }]}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={[styles.messagesList, { backgroundColor: colors.bg }]}
            style={{ backgroundColor: colors.bg }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={
              isClosed && !hasRated ? (
                <TouchableOpacity
                  style={styles.ratePromptCard}
                  onPress={() => setShowRatingModal(true)}
                >
                  <Text style={styles.ratePromptIcon}>⭐</Text>
                  <Text style={styles.ratePromptTitle}>كيف كانت تجربتك مع الدعم الفني؟</Text>
                  <Text style={styles.ratePromptSub}>اضغط هنا لتقييم جودة الخدمة</Text>
                </TouchableOpacity>
              ) : isClosed && hasRated ? (
                <View style={styles.ratedCard}>
                  <Text style={styles.ratedCardStars}>{"⭐".repeat(ticket?.rating ?? 0)}</Text>
                  <Text style={styles.ratedCardText}>شكراً على تقييمك!</Text>
                  {ticket?.ratingComment ? (
                    <Text style={styles.ratedCardComment}>"{ticket.ratingComment}"</Text>
                  ) : null}
                </View>
              ) : null
            }
          />
        )}

        {/* Input */}
        {!isClosed ? (
          <View style={[styles.inputRow, { backgroundColor: colors.input, borderTopColor: colors.inputBorder }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={t.help.typeMessage}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: newMessage.trim() ? colors.sendBtn : colors.border }]}
              onPress={handleSend}
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.sendIcon}>↑</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.closedBar, { backgroundColor: colors.input, borderTopColor: colors.inputBorder }]}>
            <Text style={[styles.closedText, { color: colors.muted }]}>
              🔒 {t.help.closed} - {t.help.resolved}
            </Text>
          </View>
        )}

        <View style={{ height: insets.bottom }} />
      </View>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModal}>
            <Text style={styles.ratingModalTitle}>قيّم تجربتك مع الدعم الفني</Text>
            <Text style={styles.ratingModalSub}>رأيك يساعدنا على تحسين خدمتنا</Text>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  style={styles.starBtn}
                >
                  <Text style={[styles.starIcon, { opacity: star <= selectedRating ? 1 : 0.3 }]}>⭐</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Rating Label */}
            {selectedRating > 0 && (
              <Text style={styles.ratingLabel}>
                {selectedRating === 1 ? "سيء جداً 😞" :
                 selectedRating === 2 ? "سيء 😕" :
                 selectedRating === 3 ? "مقبول 😐" :
                 selectedRating === 4 ? "جيد 😊" : "ممتاز 🌟"}
              </Text>
            )}

            {/* Comment */}
            <TextInput
              style={styles.ratingCommentInput}
              value={ratingComment}
              onChangeText={setRatingComment}
              placeholder="أضف تعليقاً (اختياري)..."
              placeholderTextColor="#6B5A8A"
              multiline
              maxLength={500}
            />

            {/* Buttons */}
            <View style={styles.ratingBtns}>
              <TouchableOpacity
                style={styles.ratingCancelBtn}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={styles.ratingCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ratingSubmitBtn, { opacity: selectedRating === 0 ? 0.5 : 1 }]}
                onPress={handleSubmitRating}
                disabled={selectedRating === 0 || rateTicketMutation.isPending}
              >
                {rateTicketMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.ratingSubmitText}>إرسال التقييم</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  headerStatus: { fontSize: 12, marginTop: 2 },
  rateBtn: {
    backgroundColor: "#FFD70022",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#FFD70055",
  },
  rateBtnText: { color: "#FFD700", fontSize: 12, fontWeight: "700" },
  ratedBadge: {
    backgroundColor: "#FFD70011",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratedBadgeText: { fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  dateSeparator: { alignItems: "center", marginVertical: 12 },
  dateText: { fontSize: 12, backgroundColor: "transparent" },
  messageRow: { flexDirection: "row", marginBottom: 8, alignItems: "flex-end" },
  userRow: { justifyContent: "flex-end" },
  adminRow: { justifyContent: "flex-start", gap: 8 },
  adminAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#7C3AED22",
    alignItems: "center",
    justifyContent: "center",
  },
  adminAvatarText: { fontSize: 16 },
  bubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    gap: 4,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  adminBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  senderName: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTime: { fontSize: 10, alignSelf: "flex-end" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  closedBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    alignItems: "center",
  },
  closedText: { fontSize: 14 },
  // Rating prompt card (inside FlatList footer)
  ratePromptCard: {
    backgroundColor: "#1E0F4A",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD70033",
  },
  ratePromptIcon: { fontSize: 36, marginBottom: 8 },
  ratePromptTitle: { color: "#FFD700", fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  ratePromptSub: { color: "#9B8EC4", fontSize: 12, textAlign: "center" },
  ratedCard: {
    backgroundColor: "#1E0F4A",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFD70033",
  },
  ratedCardStars: { fontSize: 24, marginBottom: 6 },
  ratedCardText: { color: "#FFD700", fontSize: 14, fontWeight: "700" },
  ratedCardComment: { color: "#9B8EC4", fontSize: 12, marginTop: 4, textAlign: "center", fontStyle: "italic" },
  // Rating Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  ratingModal: {
    backgroundColor: "#1A0533",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  ratingModalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 6,
  },
  ratingModalSub: {
    color: "#9B8EC4",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 24,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  starBtn: { padding: 4 },
  starIcon: { fontSize: 36 },
  ratingLabel: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  ratingCommentInput: {
    backgroundColor: "#2D1B4E",
    borderRadius: 12,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#3D2070",
  },
  ratingBtns: {
    flexDirection: "row",
    gap: 12,
  },
  ratingCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2D1B4E",
    alignItems: "center",
  },
  ratingCancelText: { color: "#9B8EC4", fontSize: 15, fontWeight: "600" },
  ratingSubmitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
    alignItems: "center",
  },
  ratingSubmitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});

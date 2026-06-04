import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import {
  getMessagesByRoomApi,
  suggestMessageByAiApi,
  uploadChatFileApi,
} from "../../src/features/chat/api/chatApi";
import { getMeApi } from "../../src/features/contacts/api/contactsApi";
import {
  connectChatSocket,
  disconnectChatSocket,
  sendSocketMessage,
} from "../../src/shared/socket/chatSocket";
import {
  blockUserApi,
  checkBlockApi,
  unblockUserApi,
} from "../../src/features/chat/api/blockApi";
import {
  buildPayload,
  extractUploadedFileUrl,
  getCurrentUserId,
  getReceiverIdFromRoom,
  normalizeData,
} from "../../src/features/chat/utils/chatHelpers";
import MessageBubble from "../../src/features/chat/components/MessageBubble";
import ChatInputBar from "../../src/features/chat/components/ChatInputBar";

export default function ChatRoomScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const { roomId, username } = useLocalSearchParams<{
    roomId: string;
    username?: string;
  }>();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiError, setAiError] = useState("");
  const [replyMessage, setReplyMessage] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const currentUserId = useMemo(() => getCurrentUserId(currentUser), [currentUser]);

  const loadMe = async () => {
    try {
      const data = await getMeApi();
      setCurrentUser(data);
    } catch (error) {
      console.log("loadMe error:", error);
    }
  };

  const loadMessages = async () => {
    if (!roomId) return;

    try {
      setLoading(true);
      const data = await getMessagesByRoomApi(roomId);
      setMessages(normalizeData(data));
    } catch (error) {
      console.log("loadMessages error:", error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBlockStatus = async () => {
    if (!roomId || !currentUserId) return;

    const targetId = getReceiverIdFromRoom(String(roomId), currentUserId);
    if (!targetId) return;

    try {
      const res = await checkBlockApi(targetId);
      setIsBlocked(!!res);
    } catch (error: any) {
      console.log("loadBlockStatus error:", error);
      console.log("loadBlockStatus response:", error?.response?.data);
    }
  };

  useEffect(() => {
    loadMe();
    loadMessages();
  }, [roomId]);

  useEffect(() => {
    if (currentUserId && roomId) {
      loadBlockStatus();
    }
  }, [currentUserId, roomId]);

  useEffect(() => {
    if (!currentUserId || !roomId) return;

    connectChatSocket({
      userId: currentUserId,
      roomId: String(roomId),
      onMessage: (newMessage) => {
        setMessages((prev) => {
          const exists = prev.some(
            (msg) =>
              msg?.id === newMessage?.id ||
              (msg?.createdAt === newMessage?.createdAt &&
                msg?.content === newMessage?.content &&
                String(msg?.senderId) === String(newMessage?.senderId))
          );

          if (exists) return prev;
          return [...prev, newMessage];
        });
      },
    });

    return () => {
      disconnectChatSocket();
    };
  }, [currentUserId, roomId]);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleToggleBlock = async () => {
    const targetId = getReceiverIdFromRoom(String(roomId), currentUserId);
    if (!targetId) return;

    try {
      if (isBlocked) {
        await unblockUserApi(targetId);
        setIsBlocked(false);
        Alert.alert("Thành công", "Đã bỏ chặn người dùng");
      } else {
        await blockUserApi(targetId);
        setIsBlocked(true);
        Alert.alert("Thành công", "Đã chặn người dùng");
      }
    } catch (error: any) {
      console.log("toggleBlock error:", error);
      console.log("toggleBlock response:", error?.response?.data);
      Alert.alert("Lỗi", "Không thực hiện được thao tác chặn");
    }
  };

  const handleSuggestWithAi = async () => {
    const content = text.trim();
    if (!content) {
      setAiError("Nhập tin nhắn trước rồi bấm AI để gợi ý.");
      setAiSuggestions([]);
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");
      const data = await suggestMessageByAiApi(content);
      const suggestions = Array.isArray(data?.suggestions)
        ? data.suggestions
        : [];

      setAiSuggestions(suggestions);
      if (suggestions.length === 0) {
        setAiError("AI chưa tạo được gợi ý phù hợp.");
      }
    } catch (error: any) {
      console.log("suggest AI error:", error);
      console.log("suggest AI response:", error?.response?.data);
      setAiSuggestions([
        `Mình muốn nói là ${content}`,
        `Ý mình là ${content}`,
        `Nói cách khác, ${content}`,
        `Mình diễn đạt lại một chút: ${content}`,
      ]);
      setAiError(
        "Backend AI chưa sẵn sàng. Đang hiển thị gợi ý tạm, hãy restart backend để dùng Gemini thật."
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleSend = () => {
    let content = text.trim();
    if (!content || !currentUserId || !roomId) return;

    if (isBlocked) {
      Alert.alert("Thông báo", "Bạn đang chặn người này");
      return;
    }

    const payload = buildPayload({
      currentUserId,
      roomId: String(roomId),
      content,
      type: "TEXT",
      fileUrl: null,
      replyTo: replyMessage,
    });

    const sent = sendSocketMessage(payload);
    if (sent) {
      setText("");
      setAiSuggestions([]);
      setAiError("");
      setReplyMessage(null);
    }
  };

  const handlePickImage = async () => {
    try {
      if (isBlocked) {
        Alert.alert("Thông báo", "Bạn đang chặn người này");
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Thông báo", "Bạn chưa cấp quyền thư viện ảnh");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) return;

      setUploading(true);

      const uploadRes = await uploadChatFileApi({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });

      const fileUrl = extractUploadedFileUrl(uploadRes);

      if (!fileUrl) {
        Alert.alert("Lỗi", "Upload ảnh thất bại");
        return;
      }

      const payload = buildPayload({
        currentUserId,
        roomId: String(roomId),
        content: null,
        type: "FILE",
        fileUrl,
        replyTo: replyMessage,
      });

      const sent = sendSocketMessage(payload);
      if (!sent) {
        Alert.alert("Lỗi", "Socket chưa kết nối để gửi ảnh");
      }
    } catch (error: any) {
      console.log("handlePickImage error:", error);
      console.log("handlePickImage response:", error?.response?.data);
      Alert.alert("Lỗi", "Không thể gửi ảnh");
    } finally {
      setUploading(false);
    }
  };

  const handlePickFile = async () => {
    try {
      if (isBlocked) {
        Alert.alert("Thông báo", "Bạn đang chặn người này");
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file?.uri) return;

      setUploading(true);

      const uploadRes = await uploadChatFileApi({
        uri: file.uri,
        name: file.name || `file_${Date.now()}`,
        type: file.mimeType || "application/octet-stream",
      });

      const fileUrl = extractUploadedFileUrl(uploadRes);

      if (!fileUrl) {
        Alert.alert("Lỗi", "Upload file thất bại");
        return;
      }

      const payload = buildPayload({
        currentUserId,
        roomId: String(roomId),
        content: file.name || "Tệp đính kèm",
        type: "FILE",
        fileUrl,
        replyTo: replyMessage,
      });

      const sent = sendSocketMessage(payload);
      if (!sent) {
        Alert.alert("Lỗi", "Socket chưa kết nối để gửi file");
      }
    } catch (error: any) {
      console.log("handlePickFile error:", error);
      console.log("handlePickFile response:", error?.response?.data);
      Alert.alert("Lỗi", "Không thể gửi file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          <View style={{ marginLeft: 12 }}>
            <Text style={styles.headerTitle}>
              {decodeURIComponent(username || "Cuộc trò chuyện")}
            </Text>
          </View>

          <TouchableOpacity onPress={handleToggleBlock} style={styles.blockBtn}>
            <Text style={styles.blockBtnText}>
              {isBlocked ? "Bỏ chặn" : "Chặn"}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, index) => String(item?.id ?? index)}
            renderItem={({ item }) => (
              <MessageBubble
                item={item}
                isMine={String(item?.senderId) === String(currentUserId)}
                isBot={String(item?.senderId) === "0"}
                onRecalled={loadMessages}
                onReply={(message) =>
                  setReplyMessage({
                    ...message,
                    content:
                      message?.content ||
                      message?.text ||
                      message?.originalContent ||
                      (message?.fileUrl ? "Tệp đính kèm" : "Tin nhắn"),
                  })
                }
              />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Chưa có tin nhắn</Text>
            }
          />
        )}

        <ChatInputBar
          text={text}
          setText={setText}
          uploading={uploading}
          onPickImage={handlePickImage}
          onPickFile={handlePickFile}
          onSend={handleSend}
          disabled={isBlocked}
          aiLoading={aiLoading}
          aiSuggestions={aiSuggestions}
          aiError={aiError}
          onSuggestAi={handleSuggestWithAi}
          onSelectAiSuggestion={(value) => {
            setText(value);
            setAiSuggestions([]);
            setAiError("");
          }}
          onCloseAiSuggestions={() => {
            setAiSuggestions([]);
            setAiError("");
          }}
          replyToMessage={replyMessage}
          onCancelReply={() => setReplyMessage(null)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EDEFF3" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  backText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  blockBtn: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  blockBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
});

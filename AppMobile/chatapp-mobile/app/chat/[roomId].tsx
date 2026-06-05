import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import {
  getMessagesByRoomApi,
  getPinnedMessagesApi,
  uploadChatFileApi,
} from "../../src/features/chat/api/chatApi";

import {
  getMeApi,
  getFriendsApi,
} from "../../src/features/contacts/api/contactsApi";

import { getMyGroupsApi } from "../../src/features/chat/api/groupApi";

import {
  connectChatSocket,
  disconnectChatSocket,
  sendSocketMessage,
} from "../../src/shared/socket/chatSocket";

import {
  connectCallSocket,
  disconnectCallSocket,
  sendCallSignal,
} from "../../src/shared/socket/callSocket";

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
import GroupInfoModal from "../../src/features/chat/components/GroupInfoModal";
import ForwardMessageModal from "../../src/features/chat/components/ForwardMessageModal";

const API_BASE_URL = "http://10.0.2.2:8080";

const DEFAULT_GROUP_AVATAR =
  "https://ui-avatars.com/api/?name=Group&background=E5E7EB&color=111827";

const normalizeImageUrl = (
  url?: string | null,
  fallback: string = DEFAULT_GROUP_AVATAR
) => {
  if (!url) return fallback;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  return `${API_BASE_URL}/${url}`;
};

export default function ChatRoomScreen() {
  const flatListRef = useRef<FlatList>(null);

  const params = useLocalSearchParams<{
    roomId?: string;
    username?: string;
    otherUserId?: string;
    isGroup?: string;
    backgroundUrl?: string;
    avatarUrl?: string;
  }>();

  const roomId = params.roomId;
  const username = params.username;
  const otherUserIdParam = params.otherUserId;
  const isGroupChat = params.isGroup === "true";

  const initialBackgroundUrl = params.backgroundUrl
    ? normalizeImageUrl(decodeURIComponent(String(params.backgroundUrl)), "")
    : "";

  const initialGroupAvatarUrl = params.avatarUrl
    ? normalizeImageUrl(decodeURIComponent(String(params.avatarUrl)))
    : DEFAULT_GROUP_AVATAR;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);

  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [forwardMessage, setForwardMessage] = useState<any>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [aiMode, setAiMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [goChatList, setGoChatList] = useState(false);

  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showPinnedList, setShowPinnedList] = useState(false);

  const [localGroupName, setLocalGroupName] = useState(
    decodeURIComponent(username || "Nhóm chat")
  );

  const [localGroupAvatar, setLocalGroupAvatar] =
    useState(initialGroupAvatarUrl);

  const [chatBackgroundUrl, setChatBackgroundUrl] =
    useState(initialBackgroundUrl);

  useEffect(() => {
    if (username) {
      setLocalGroupName(decodeURIComponent(username));
    }
  }, [username]);

  useEffect(() => {
    if (params.backgroundUrl) {
      setChatBackgroundUrl(
        normalizeImageUrl(decodeURIComponent(String(params.backgroundUrl)), "")
      );
    }
  }, [params.backgroundUrl]);

  useEffect(() => {
    if (params.avatarUrl) {
      setLocalGroupAvatar(
        normalizeImageUrl(decodeURIComponent(String(params.avatarUrl)))
      );
    }
  }, [params.avatarUrl]);

  const currentUserId = useMemo(
    () => getCurrentUserId(currentUser),
    [currentUser]
  );

  const receiverId = useMemo(() => {
    if (isGroupChat) return null;

    if (otherUserIdParam) return String(otherUserIdParam);

    if (roomId && currentUserId) {
      const id = getReceiverIdFromRoom(String(roomId), currentUserId);
      return id ? String(id) : null;
    }

    return null;
  }, [roomId, currentUserId, otherUserIdParam, isGroupChat]);

  const buildPrivateRoomId = (
    userA: number | string,
    userB: number | string
  ) => {
    const a = Number(userA);
    const b = Number(userB);

    if (Number.isNaN(a) || Number.isNaN(b)) {
      return `${userA}_${userB}`;
    }

    return a < b ? `${a}_${b}` : `${b}_${a}`;
  };

  const goBackToChatList = () => {
    console.log("BACK BUTTON PRESSED");

    disconnectChatSocket();
    disconnectCallSocket();

    setGoChatList(true);
  };

  const loadMe = async () => {
    try {
      const data = await getMeApi();

      console.log("getMeApi response:", JSON.stringify(data, null, 2));

      setCurrentUser(data);
    } catch (error: any) {
      console.log("loadMe error:", error);
      console.log("loadMe status:", error?.response?.status);
      console.log("loadMe response:", error?.response?.data);
    }
  };

  const loadMessages = async () => {
    if (!roomId) return;

    try {
      setLoading(true);

      console.log("LOAD MESSAGES roomId:", roomId);

      const data = await getMessagesByRoomApi(String(roomId));

      console.log(
        "getMessagesByRoomApi response:",
        JSON.stringify(data, null, 2)
      );

      setMessages(normalizeData(data));
    } catch (error: any) {
      console.log("loadMessages error:", error);
      console.log("loadMessages status:", error?.response?.status);
      console.log("loadMessages response:", error?.response?.data);

      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPinnedMessages = async () => {
    if (!roomId) return;

    try {
      const data = await getPinnedMessagesApi(String(roomId));

      console.log(
        "getPinnedMessagesApi response:",
        JSON.stringify(data, null, 2)
      );

      setPinnedMessages(normalizeData(data));
    } catch (error: any) {
      console.log("loadPinnedMessages error:", error);
      console.log("loadPinnedMessages status:", error?.response?.status);
      console.log("loadPinnedMessages response:", error?.response?.data);

      setPinnedMessages([]);
    }
  };

  const loadForwardTargets = async () => {
    try {
      const [friendsRes, groupsRes] = await Promise.all([
        getFriendsApi(),
        getMyGroupsApi(),
      ]);

      setFriends(normalizeData(friendsRes));
      setGroups(normalizeData(groupsRes));
    } catch (error: any) {
      console.log("loadForwardTargets error:", error);
      console.log("loadForwardTargets status:", error?.response?.status);
      console.log("loadForwardTargets response:", error?.response?.data);

      setFriends([]);
      setGroups([]);
    }
  };

  const reloadChatData = async () => {
    await Promise.all([loadMessages(), loadPinnedMessages()]);
  };

  const loadBlockStatus = async () => {
    if (isGroupChat) return;
    if (!receiverId) return;

    try {
      const res = await checkBlockApi(receiverId);
      setIsBlocked(!!res);
    } catch (error: any) {
      console.log("loadBlockStatus error:", error);
      console.log("loadBlockStatus status:", error?.response?.status);
      console.log("loadBlockStatus response:", error?.response?.data);
    }
  };

  useEffect(() => {
    loadMe();
    loadForwardTargets();
  }, []);

  useEffect(() => {
    reloadChatData();
  }, [roomId]);

  useEffect(() => {
    loadBlockStatus();
  }, [receiverId, isGroupChat]);

  useEffect(() => {
    if (!currentUserId || !roomId) return;

    console.log("CONNECT CHAT SOCKET:", {
      userId: currentUserId,
      roomId: String(roomId),
      isGroupChat,
    });

    connectChatSocket({
      userId: currentUserId,
      roomId: String(roomId),

      onMessage: (newMessage) => {
        console.log("SOCKET NEW MESSAGE:", JSON.stringify(newMessage, null, 2));

        setMessages((prev) => {
          const exists = prev.some((msg) => {
            const sameId =
              msg?.id && newMessage?.id && msg.id === newMessage.id;

            const sameTemp =
              String(msg?.content || "") ===
                String(newMessage?.content || "") &&
              String(msg?.senderId || "") ===
                String(newMessage?.senderId || "") &&
              msg?.status === "SENDING";

            return sameId || sameTemp;
          });

          if (exists) {
            return prev.map((msg) => {
              const sameTemp =
                String(msg?.content || "") ===
                  String(newMessage?.content || "") &&
                String(msg?.senderId || "") ===
                  String(newMessage?.senderId || "") &&
                msg?.status === "SENDING";

              return sameTemp ? newMessage : msg;
            });
          }

          return [...prev, newMessage];
        });
      },

      onPinChanged: () => {
        console.log("PIN CHANGED -> RELOAD CHAT DATA");
        loadMessages();
        loadPinnedMessages();
      },

      onRecallChanged: (messageId) => {
        console.log("RECALL CHANGED:", messageId);

        setMessages((prev) =>
          prev.map((msg) =>
            String(msg?.id) === String(messageId)
              ? {
                  ...msg,
                  isRecalled: true,
                  content: null,
                  isPinned: false,
                  pinnedAt: null,
                  pinnedBy: null,
                }
              : msg
          )
        );

        loadPinnedMessages();
      },

      onDeleteChanged: (messageId) => {
        console.log("DELETE CHANGED:", messageId);

        setMessages((prev) =>
          prev.filter((msg) => String(msg?.id) !== String(messageId))
        );

        loadPinnedMessages();
      },
    });

    return () => {
      disconnectChatSocket();
    };
  }, [currentUserId, roomId, isGroupChat]);

  useEffect(() => {
    if (!currentUserId || !roomId) return;

    console.log("CONNECT CALL SOCKET:", {
      userId: currentUserId,
      roomId: String(roomId),
      isGroupChat,
    });

    connectCallSocket({
      userId: currentUserId,

      onCallSignal: (signal) => {
        console.log("RECEIVED CALL SIGNAL:", JSON.stringify(signal, null, 2));

        if (String(signal?.callerId) === String(currentUserId)) {
          return;
        }

        if (signal?.signalType === "INVITE") {
          Alert.alert(
            signal?.callType === "VIDEO" ? "Cuộc gọi video" : "Cuộc gọi thoại",
            `${signal?.callerName || "Ai đó"} đang gọi cho bạn`,
            [
              {
                text: "Từ chối",
                style: "destructive",
                onPress: () => {
                  sendCallSignal({
                    ...signal,
                    signalType: "REJECT",
                    callerId: Number(currentUserId),
                    receiverId: signal?.callerId,
                    createdAt: Date.now(),
                  });
                },
              },
              {
                text: "Nghe",
                onPress: () => {
                  sendCallSignal({
                    ...signal,
                    signalType: "ACCEPT",
                    callerId: Number(currentUserId),
                    receiverId: signal?.callerId,
                    createdAt: Date.now(),
                  });

                  Alert.alert(
                    "Đã nghe",
                    "Bước tiếp theo sẽ bật mic/camera bằng WebRTC"
                  );
                },
              },
            ]
          );
        }

        if (signal?.signalType === "ACCEPT") {
          Alert.alert("Cuộc gọi", "Người nhận đã chấp nhận cuộc gọi");
        }

        if (signal?.signalType === "REJECT") {
          Alert.alert("Cuộc gọi", "Cuộc gọi đã bị từ chối");
        }

        if (signal?.signalType === "END") {
          Alert.alert("Cuộc gọi", "Cuộc gọi đã kết thúc");
        }
      },
    });

    return () => {
      disconnectCallSocket();
    };
  }, [currentUserId, roomId, isGroupChat]);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const createFinalPayload = ({
    content,
    type,
    fileUrl,
  }: {
    content: string | null;
    type: "TEXT" | "FILE";
    fileUrl: string | null;
  }) => {
    if (!currentUserId || !roomId) {
      return null;
    }

    if (!isGroupChat && !receiverId) {
      return null;
    }

    const basePayload = buildPayload({
      currentUserId,
      roomId: String(roomId),
      content,
      type,
      fileUrl,
    });

    return {
      ...basePayload,
      senderId: Number(currentUserId),
      receiverId: isGroupChat ? null : Number(receiverId),
      groupId: isGroupChat ? String(roomId) : null,
      roomId: String(roomId),
      content,
      type,
      fileUrl,
      isGroup: isGroupChat,
      createdAt: new Date().toISOString(),
    };
  };

  const handleOpenForward = (message: any) => {
    if (!message || !message.id) return;

    setForwardMessage(message);
    setShowForwardModal(true);
  };

  const handleForwardToTarget = (target: any) => {
    if (!forwardMessage || !currentUserId) {
      Alert.alert("Lỗi", "Không có tin nhắn để chuyển tiếp");
      return;
    }

    const targetType = target?.targetType;
    const targetId = target?.targetId;

    if (!targetType || !targetId) {
      Alert.alert("Lỗi", "Không xác định được nơi nhận");
      return;
    }

    const isGroupTarget = targetType === "GROUP";

    const newRoomId = isGroupTarget
      ? String(targetId)
      : buildPrivateRoomId(currentUserId, targetId);

    const content =
      forwardMessage?.content ||
      forwardMessage?.originalContent ||
      (forwardMessage?.fileUrl ? "Tệp đính kèm" : "");

    const payload = {
      senderId: Number(currentUserId),
      receiverId: isGroupTarget ? null : Number(targetId),
      roomId: newRoomId,
      groupId: isGroupTarget ? String(targetId) : null,
      isGroup: isGroupTarget,
      content,
      type: forwardMessage?.type === "FILE" ? "FILE" : "FORWARD",
      fileUrl: forwardMessage?.fileUrl || null,
      originalSenderId: forwardMessage?.senderId ?? null,
      originalContent: forwardMessage?.content ?? null,
      originalMessageId: forwardMessage?.id ?? null,
      createdAt: new Date().toISOString(),
    };

    console.log("FORWARD MESSAGE PAYLOAD:", JSON.stringify(payload, null, 2));

    const sent = sendSocketMessage(payload);

    if (sent) {
      Alert.alert("Thành công", "Đã chuyển tiếp tin nhắn");

      setShowForwardModal(false);
      setForwardMessage(null);
    } else {
      Alert.alert("Lỗi", "Socket chưa kết nối, không thể chuyển tiếp");
    }
  };

  const handleToggleBlock = async () => {
    if (isGroupChat) return;

    if (!receiverId) {
      Alert.alert("Lỗi", "Không xác định được người dùng để chặn");
      return;
    }

    try {
      if (isBlocked) {
        await unblockUserApi(receiverId);
        setIsBlocked(false);
        Alert.alert("Thành công", "Đã bỏ chặn người dùng");
      } else {
        await blockUserApi(receiverId);
        setIsBlocked(true);
        Alert.alert("Thành công", "Đã chặn người dùng");
      }
    } catch (error: any) {
      console.log("toggleBlock error:", error);
      console.log("toggleBlock status:", error?.response?.status);
      console.log("toggleBlock response:", error?.response?.data);
      Alert.alert("Lỗi", "Không thực hiện được thao tác chặn");
    }
  };

  const buildCallPayload = (callType: "AUDIO" | "VIDEO") => {
    if (!currentUserId || !roomId) {
      return null;
    }

    if (!isGroupChat && !receiverId) {
      return null;
    }

    return {
      roomId: String(roomId),
      callerId: Number(currentUserId),
      receiverId: isGroupChat ? null : Number(receiverId),
      groupId: isGroupChat ? String(roomId) : null,
      isGroup: isGroupChat,
      callType,
      signalType: "INVITE",
      payload: null,
      callerName: currentUser?.username || "Người dùng",
      callerAvatar: currentUser?.avatar || null,
      createdAt: Date.now(),
    };
  };

  const handleStartAudioCall = () => {
    const payload = buildCallPayload("AUDIO");

    if (!payload) {
      Alert.alert("Lỗi", "Thiếu thông tin cuộc gọi");
      return;
    }

    console.log("SEND AUDIO CALL SIGNAL:", JSON.stringify(payload, null, 2));

    const sent = sendCallSignal(payload);

    if (!sent) {
      Alert.alert("Lỗi", "Socket cuộc gọi chưa kết nối");
      return;
    }

    Alert.alert("Đang gọi", isGroupChat ? "Đang gọi nhóm..." : "Đang gọi...");
  };

  const handleStartVideoCall = () => {
    const payload = buildCallPayload("VIDEO");

    if (!payload) {
      Alert.alert("Lỗi", "Thiếu thông tin cuộc gọi");
      return;
    }

    console.log("SEND VIDEO CALL SIGNAL:", JSON.stringify(payload, null, 2));

    const sent = sendCallSignal(payload);

    if (!sent) {
      Alert.alert("Lỗi", "Socket cuộc gọi chưa kết nối");
      return;
    }

    Alert.alert(
      "Đang gọi video",
      isGroupChat ? "Đang gọi video nhóm..." : "Đang gọi video..."
    );
  };

  const handleSend = () => {
    let content = text.trim();

    if (!content) return;

    if (!currentUserId || !roomId || (!isGroupChat && !receiverId)) {
      Alert.alert(
        "Lỗi",
        isGroupChat
          ? "Thiếu thông tin nhóm"
          : "Thiếu thông tin người gửi hoặc người nhận"
      );

      return;
    }

    if (!isGroupChat && isBlocked) {
      Alert.alert("Thông báo", "Bạn đang chặn người này");
      return;
    }

    if (aiMode && !content.startsWith("/ai")) {
      content = `/ai ${content}`;
    }

    const payload = createFinalPayload({
      content,
      type: "TEXT",
      fileUrl: null,
    });

    if (!payload) {
      Alert.alert("Lỗi", "Không tạo được dữ liệu tin nhắn");
      return;
    }

    console.log("SEND MESSAGE PAYLOAD:", JSON.stringify(payload, null, 2));

    const sent = sendSocketMessage(payload);

    if (sent) {
      const tempMessage = {
        ...payload,
        id: `temp-${Date.now()}`,
        status: "SENDING",
      };

      setMessages((prev) => [...prev, tempMessage]);
      setText("");
    } else {
      Alert.alert("Lỗi", "Socket chưa kết nối, không gửi được tin nhắn");
    }
  };

  const handlePickImage = async () => {
    try {
      if (!currentUserId || !roomId || (!isGroupChat && !receiverId)) {
        Alert.alert(
          "Lỗi",
          isGroupChat
            ? "Thiếu thông tin nhóm"
            : "Thiếu thông tin người gửi hoặc người nhận"
        );
        return;
      }

      if (!isGroupChat && isBlocked) {
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

      const payload = createFinalPayload({
        content: "Ảnh",
        type: "FILE",
        fileUrl,
      });

      if (!payload) {
        Alert.alert("Lỗi", "Không tạo được dữ liệu ảnh");
        return;
      }

      const sent = sendSocketMessage(payload);

      if (sent) {
        const tempMessage = {
          ...payload,
          id: `temp-${Date.now()}`,
          status: "SENDING",
        };

        setMessages((prev) => [...prev, tempMessage]);
      } else {
        Alert.alert("Lỗi", "Socket chưa kết nối để gửi ảnh");
      }
    } catch (error: any) {
      console.log("handlePickImage error:", error);
      console.log("handlePickImage status:", error?.response?.status);
      console.log("handlePickImage response:", error?.response?.data);
      Alert.alert("Lỗi", "Không thể gửi ảnh");
    } finally {
      setUploading(false);
    }
  };

  const handlePickFile = async () => {
    try {
      if (!currentUserId || !roomId || (!isGroupChat && !receiverId)) {
        Alert.alert(
          "Lỗi",
          isGroupChat
            ? "Thiếu thông tin nhóm"
            : "Thiếu thông tin người gửi hoặc người nhận"
        );
        return;
      }

      if (!isGroupChat && isBlocked) {
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

      const payload = createFinalPayload({
        content: file.name || "Tệp đính kèm",
        type: "FILE",
        fileUrl,
      });

      if (!payload) {
        Alert.alert("Lỗi", "Không tạo được dữ liệu file");
        return;
      }

      const sent = sendSocketMessage(payload);

      if (sent) {
        const tempMessage = {
          ...payload,
          id: `temp-${Date.now()}`,
          status: "SENDING",
        };

        setMessages((prev) => [...prev, tempMessage]);
      } else {
        Alert.alert("Lỗi", "Socket chưa kết nối để gửi file");
      }
    } catch (error: any) {
      console.log("handlePickFile error:", error);
      console.log("handlePickFile status:", error?.response?.status);
      console.log("handlePickFile response:", error?.response?.data);
      Alert.alert("Lỗi", "Không thể gửi file");
    } finally {
      setUploading(false);
    }
  };

  if (goChatList) {
    return <Redirect href="/(tabs)/chat" />;
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={goBackToChatList}
            activeOpacity={0.6}
            style={styles.backBtn}
            hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>

          {isGroupChat && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowGroupInfo(true)}
            >
              <Image
                source={{
                  uri: localGroupAvatar || DEFAULT_GROUP_AVATAR,
                }}
                style={styles.headerAvatar}
                onError={(e) => {
                  console.log("header group avatar error:", e.nativeEvent);
                  setLocalGroupAvatar(DEFAULT_GROUP_AVATAR);
                }}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.headerInfo}
            activeOpacity={0.7}
            onPress={() => {
              if (isGroupChat) {
                setShowGroupInfo(true);
              }
            }}
          >
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isGroupChat
                ? localGroupName
                : decodeURIComponent(username || "Cuộc trò chuyện")}
            </Text>

            {isGroupChat && <Text style={styles.headerSubTitle}>Nhóm chat</Text>}
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleStartAudioCall} style={styles.callBtn}>
              <Text style={styles.callBtnText}>📞</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleStartVideoCall} style={styles.callBtn}>
              <Text style={styles.callBtnText}>🎥</Text>
            </TouchableOpacity>

            {!isGroupChat && (
              <TouchableOpacity
                onPress={handleToggleBlock}
                style={styles.blockBtn}
              >
                <Text style={styles.blockBtnText}>
                  {isBlocked ? "Bỏ chặn" : "Chặn"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : (
          <ImageBackground
            source={chatBackgroundUrl ? { uri: chatBackgroundUrl } : undefined}
            style={styles.chatBackground}
            imageStyle={styles.chatBackgroundImage}
          >
            {pinnedMessages.length > 0 && (
              <TouchableOpacity
                style={styles.pinnedBar}
                onPress={() => setShowPinnedList((prev) => !prev)}
              >
                <Text style={styles.pinnedIcon}>📌</Text>

                <View style={{ flex: 1 }}>
                  <Text style={styles.pinnedTitle}>
                    Tin nhắn đã ghim · {pinnedMessages.length}
                  </Text>

                  <Text style={styles.pinnedContent} numberOfLines={1}>
                    {pinnedMessages[0]?.content || "Tệp đính kèm"}
                  </Text>
                </View>

                <Text style={styles.pinnedAction}>
                  {showPinnedList ? "Ẩn" : "Xem"}
                </Text>
              </TouchableOpacity>
            )}

            {showPinnedList && pinnedMessages.length > 0 && (
              <View style={styles.pinnedList}>
                {pinnedMessages.map((msg) => (
                  <Text
                    key={String(msg.id)}
                    style={styles.pinnedListItem}
                    numberOfLines={2}
                  >
                    📌 {msg.content || "Tệp đính kèm"}
                  </Text>
                ))}
              </View>
            )}

            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => String(item?.id ?? index)}
              renderItem={({ item }) => (
                <MessageBubble
                  item={item}
                  isMine={String(item?.senderId) === String(currentUserId)}
                  isBot={String(item?.senderId) === "0"}
                  onRecalled={reloadChatData}
                  onPinChanged={reloadChatData}
                  onForward={handleOpenForward}
                />
              )}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Chưa có tin nhắn</Text>
              }
            />
          </ImageBackground>
        )}

        <ChatInputBar
          text={text}
          setText={setText}
          uploading={uploading}
          onPickImage={handlePickImage}
          onPickFile={handlePickFile}
          onSend={handleSend}
          disabled={!isGroupChat && isBlocked}
          aiMode={aiMode}
          onToggleAiMode={() => setAiMode((v) => !v)}
        />

        {isGroupChat && roomId && (
          <GroupInfoModal
            visible={showGroupInfo}
            groupId={String(roomId)}
            groupName={localGroupName}
            groupAvatar={localGroupAvatar}
            onClose={() => setShowGroupInfo(false)}
            onRenamed={(newName) => {
              setLocalGroupName(newName);
            }}
            onAvatarChanged={(avatarUrl) => {
              setLocalGroupAvatar(normalizeImageUrl(avatarUrl));
            }}
            onBackgroundChanged={(backgroundUrl) => {
              setChatBackgroundUrl(normalizeImageUrl(backgroundUrl, ""));
            }}
            onLeftOrDeleted={() => {
              setGoChatList(true);
            }}
          />
        )}

        <ForwardMessageModal
          visible={showForwardModal}
          friends={friends}
          groups={groups}
          currentRoomId={String(roomId || "")}
          onClose={() => {
            setShowForwardModal(false);
            setForwardMessage(null);
          }}
          onSelectTarget={handleForwardToTarget}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EDEFF3",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },

  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    elevation: 999,
  },

  backText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },

  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E5E7EB",
    marginLeft: 4,
  },

  headerInfo: {
    marginLeft: 12,
    flex: 1,
    paddingVertical: 4,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  headerSubTitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  callBtnText: {
    fontSize: 18,
  },

  blockBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },

  blockBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },

  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  chatBackground: {
    flex: 1,
    backgroundColor: "#EDEFF3",
  },

  chatBackgroundImage: {
    opacity: 0.9,
  },

  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },

  pinnedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF7ED",
    borderBottomWidth: 1,
    borderBottomColor: "#FED7AA",
  },

  pinnedIcon: {
    fontSize: 18,
  },

  pinnedTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#9A3412",
  },

  pinnedContent: {
    marginTop: 2,
    fontSize: 13,
    color: "#7C2D12",
  },

  pinnedAction: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EA580C",
  },

  pinnedList: {
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
  },

  pinnedListItem: {
    fontSize: 13,
    color: "#78350F",
    paddingVertical: 4,
  },
});
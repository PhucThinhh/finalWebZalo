import React from "react";
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import {
  pinMessageApi,
  recallMessageApi,
  unpinMessageApi,
} from "../api/chatApi";
import {
  formatTime,
  isImageFile,
  normalizeMobileFileUrl,
} from "../utils/chatHelpers";

type Props = {
  item: any;
  isMine: boolean;
  isBot?: boolean;
  onRecalled?: () => void;
  onPinChanged?: () => void;
  onForward?: (message: any) => void;
};

export default function MessageBubble({
  item,
  isMine,
  isBot,
  onRecalled,
  onPinChanged,
  onForward,
}: Props) {
  const content = item?.content || "";
  const createdAt = item?.createdAt || "";
  const fileUrl = normalizeMobileFileUrl(item?.fileUrl || "");
  const type = item?.type || "TEXT";

  const isFile = type === "FILE" || !!fileUrl;
  const imageFile = isFile && fileUrl && isImageFile(fileUrl);

  const isRecalled = !!item?.isRecalled;
  const isPinned = !!item?.isPinned;

  const isSystem = type === "SYSTEM";
  const isForward = type === "FORWARD" || !!item?.originalMessageId;

  const handlePinToggle = async () => {
    if (!item?.id) return;

    if (isSystem) {
      Alert.alert("Thông báo", "Không thể ghim thông báo hệ thống");
      return;
    }

    try {
      if (isPinned) {
        await unpinMessageApi(item.id);
      } else {
        await pinMessageApi(item.id);
      }

      onPinChanged?.();
    } catch (error: any) {
      console.log("pin/unpin message error:", error);
      console.log("pin/unpin message response:", error?.response?.data);

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.response?.data ||
          "Không thể cập nhật ghim tin nhắn"
      );
    }
  };

  const handleRecall = async () => {
    if (!item?.id) return;

    try {
      await recallMessageApi(item.id);
      onRecalled?.();
    } catch (error: any) {
      console.log("recallMessage error:", error);
      console.log("recallMessage response:", error?.response?.data);
      Alert.alert("Lỗi", "Không thể thu hồi tin nhắn");
    }
  };

  const handleLongPress = () => {
    if (!item?.id || isRecalled) return;

    if (isSystem) {
      Alert.alert("Thông báo", "Không thể thao tác với thông báo hệ thống");
      return;
    }

    const buttons: any[] = [
      {
        text: "Chuyển tiếp",
        onPress: () => onForward?.(item),
      },
      {
        text: isPinned ? "Bỏ ghim" : "Ghim tin nhắn",
        onPress: handlePinToggle,
      },
    ];

    if (!isBot && isMine) {
      buttons.push({
        text: "Thu hồi",
        style: "destructive",
        onPress: handleRecall,
      });
    }

    buttons.push({
      text: "Hủy",
      style: "cancel",
    });

    Alert.alert("Tin nhắn", "Chọn thao tác", buttons);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={handleLongPress}
      disabled={isRecalled}
      style={[
        styles.messageBubble,
        isBot || isSystem
          ? styles.botBubble
          : isMine
          ? styles.myBubble
          : styles.otherBubble,
      ]}
    >
      {(isBot || isSystem) && !isRecalled && (
        <Text style={styles.botLabel}>
          {isSystem ? "Thông báo nhóm" : "Trợ lý AI"}
        </Text>
      )}

      {isPinned && !isRecalled && (
        <Text style={styles.pinLabel}>📌 Đã ghim</Text>
      )}

      {isForward && !isRecalled && (
        <Text style={styles.forwardLabel}>↪ Tin nhắn chuyển tiếp</Text>
      )}

      {isRecalled ? (
        <Text style={styles.recalledText}>Tin nhắn đã được thu hồi</Text>
      ) : imageFile ? (
        <TouchableOpacity onPress={() => Linking.openURL(fileUrl)}>
          <Image source={{ uri: fileUrl }} style={styles.imageMessage} />
        </TouchableOpacity>
      ) : isFile ? (
        <TouchableOpacity
          style={styles.fileBox}
          onPress={() => fileUrl && Linking.openURL(fileUrl)}
        >
          <Text style={styles.fileText}>{content || "Tệp đính kèm"}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.messageText}>{content}</Text>
      )}

      <Text style={styles.timeText}>{formatTime(createdAt)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginBottom: 8,
    maxWidth: "78%",
  },

  otherBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 6,
  },

  botBubble: {
    alignSelf: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    maxWidth: "92%",
  },

  botLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
    marginBottom: 4,
    letterSpacing: 0.5,
  },

  pinLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
    marginBottom: 4,
  },

  forwardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4F46E5",
    marginBottom: 4,
  },

  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#D9F0FF",
    borderTopRightRadius: 6,
  },

  messageText: {
    color: "#111827",
    fontSize: 15,
    lineHeight: 20,
  },

  recalledText: {
    color: "#6B7280",
    fontSize: 14,
    fontStyle: "italic",
  },

  timeText: {
    marginTop: 4,
    fontSize: 11,
    color: "#7C8798",
    alignSelf: "flex-end",
  },

  imageMessage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: "#DDD",
  },

  fileBox: {
    paddingVertical: 4,
  },

  fileText: {
    color: "#2563EB",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
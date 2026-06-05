import React, { useMemo, useRef } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { recallMessageApi } from "../api/chatApi";
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
  onReply?: (message: any) => void;
};

export default function MessageBubble({
  item,
  isMine,
  isBot,
  onRecalled,
  onReply,
}: Props) {
  const content = item?.content || "";
  const createdAt = item?.createdAt || "";
  const fileUrl = normalizeMobileFileUrl(item?.fileUrl || "");
  const type = item?.type || "TEXT";
  const isFile = type === "FILE" || !!fileUrl;
  const imageFile = isFile && fileUrl && isImageFile(fileUrl);
  const isRecalled = !!item?.isRecalled;
  const replyContent =
    item?.originalContent || (item?.originalMessageId ? "Tin nhắn" : "");

  const translateX = useRef(new Animated.Value(0)).current;
  const replyTriggeredRef = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        !isRecalled &&
        !isBot &&
        gesture.dx > 12 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderMove: (_, gesture) => {
        const dx = Math.max(0, Math.min(gesture.dx, 96));
        translateX.setValue(dx);
        replyTriggeredRef.current = dx >= 72;
      },
      onPanResponderRelease: () => {
        const shouldReply = replyTriggeredRef.current;
        replyTriggeredRef.current = false;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 9,
        }).start();

        if (shouldReply) {
          onReply?.(item);
        }
      },
      onPanResponderTerminate: () => {
        replyTriggeredRef.current = false;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 9,
        }).start();
      },
      }),
    [isRecalled, isBot, item, onReply, translateX]
  );

  const handleLongPress = () => {
    if (isBot || !isMine || !item?.id) return;

    Alert.alert("Tin nhắn", "Bạn muốn thu hồi tin nhắn này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Thu hồi",
        style: "destructive",
        onPress: async () => {
          try {
            await recallMessageApi(item.id);
            onRecalled?.();
          } catch (error: any) {
            console.log("recallMessage error:", error);
            console.log("recallMessage response:", error?.response?.data);
            Alert.alert("Lỗi", "Không thể thu hồi tin nhắn");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.swipeRow}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.replyIndicator,
          {
            opacity: translateX.interpolate({
              inputRange: [0, 40, 72],
              outputRange: [0, 0.6, 1],
              extrapolate: "clamp",
            }),
            transform: [
              {
                scale: translateX.interpolate({
                  inputRange: [0, 72],
                  outputRange: [0.8, 1],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.replyIndicatorText}>↩</Text>
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={handleLongPress}
          disabled={!isMine || !!isBot}
          style={[
            styles.messageBubble,
            isBot
              ? styles.botBubble
              : isMine
                ? styles.myBubble
                : styles.otherBubble,
          ]}
        >
          {isBot && !isRecalled && <Text style={styles.botLabel}>Trợ lý AI</Text>}

          {!isRecalled && !!replyContent && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyTitle} numberOfLines={1}>
                Trả lời
              </Text>
              <Text style={styles.replyText} numberOfLines={2}>
                {replyContent}
              </Text>
            </View>
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeRow: {
    position: "relative",
  },
  replyIndicator: {
    position: "absolute",
    left: 12,
    top: "50%",
    width: 34,
    height: 34,
    marginTop: -17,
    borderRadius: 17,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  replyIndicatorText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
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
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#D9F0FF",
    borderTopRightRadius: 6,
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderLeftColor: "#3B82F6",
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 7,
  },
  replyTitle: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },
  replyText: {
    color: "#4B5563",
    fontSize: 13,
    marginTop: 2,
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

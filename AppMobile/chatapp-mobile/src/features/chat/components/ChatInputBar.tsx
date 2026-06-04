import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  text: string;
  setText: (v: string) => void;
  uploading: boolean;
  onPickImage: () => void;
  onPickFile: () => void;
  onSend: () => void;
  disabled?: boolean;
  aiLoading?: boolean;
  aiSuggestions?: string[];
  aiError?: string;
  onSuggestAi?: () => void;
  onSelectAiSuggestion?: (value: string) => void;
  onCloseAiSuggestions?: () => void;
  replyToMessage?: any;
  onCancelReply?: () => void;
};

export default function ChatInputBar({
  text,
  setText,
  uploading,
  onPickImage,
  onPickFile,
  onSend,
  disabled,
  aiLoading,
  aiSuggestions = [],
  aiError,
  onSuggestAi,
  onSelectAiSuggestion,
  onCloseAiSuggestions,
  replyToMessage,
  onCancelReply,
}: Props) {
  const replyContent =
    replyToMessage?.content ||
    replyToMessage?.text ||
    replyToMessage?.originalContent ||
    (replyToMessage?.fileUrl ? "Tệp đính kèm" : "Tin nhắn");

  return (
    <View style={styles.wrap}>
      {replyToMessage && (
        <View style={styles.replyBar}>
          <View style={styles.replyAccent} />
          <View style={styles.replyBody}>
            <Text style={styles.replyTitle} numberOfLines={1}>
              Trả lời {replyToMessage.senderName || "tin nhắn"}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {replyContent}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {(aiLoading || aiSuggestions.length > 0 || !!aiError) && (
        <View style={styles.aiPanel}>
          <View style={styles.aiPanelHeader}>
            <Text style={styles.aiTitle}>Gợi ý AI</Text>
            <TouchableOpacity onPress={onCloseAiSuggestions} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>×</Text>
            </TouchableOpacity>
          </View>

          {aiLoading && (
            <Text style={styles.aiStatus}>AI đang viết lại tin nhắn...</Text>
          )}

          {!aiLoading &&
            aiSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={`${suggestion}_${index}`}
                onPress={() => onSelectAiSuggestion?.(suggestion)}
                style={styles.aiSuggestion}
              >
                <Text style={styles.aiSuggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}

          {!aiLoading && !!aiError && <Text style={styles.aiError}>{aiError}</Text>}
        </View>
      )}

      <View style={styles.inputWrap}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onPickImage}
          disabled={disabled || uploading}
        >
          <Text style={styles.iconText}>🖼️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onPickFile}
          disabled={disabled || uploading}
        >
          <Text style={styles.iconText}>📎</Text>
        </TouchableOpacity>

        {onSuggestAi != null && (
          <TouchableOpacity
            style={[
              styles.iconBtn,
              (aiLoading || aiSuggestions.length > 0) && styles.aiBtnActive,
            ]}
            onPress={onSuggestAi}
            disabled={disabled || uploading || aiLoading}
          >
            <Text style={styles.iconText}>✨</Text>
          </TouchableOpacity>
        )}

        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            onCloseAiSuggestions?.();
          }}
          placeholder={disabled ? "Bạn đang chặn người này" : "Nhắn tin..."}
          placeholderTextColor="#8E8E93"
          style={styles.input}
          editable={!disabled && !uploading}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            (uploading || disabled) && styles.sendBtnDisabled,
          ]}
          onPress={onSend}
          disabled={uploading || disabled}
        >
          <Text style={styles.sendText}>{uploading ? "..." : "Gửi"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  replyAccent: {
    width: 3,
    height: 36,
    borderRadius: 2,
    backgroundColor: "#3B82F6",
    marginRight: 10,
  },
  replyBody: {
    flex: 1,
    minWidth: 0,
  },
  replyTitle: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
  },
  replyText: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 2,
  },
  cancelBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#6B7280",
    fontSize: 22,
    lineHeight: 24,
  },
  aiPanel: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 16,
  },
  aiPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  aiTitle: {
    color: "#065F46",
    fontSize: 14,
    fontWeight: "700",
  },
  aiStatus: {
    color: "#374151",
    fontSize: 13,
    paddingVertical: 6,
  },
  aiSuggestion: {
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderColor: "#D1FAE5",
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 6,
  },
  aiSuggestionText: {
    color: "#111827",
    fontSize: 14,
    lineHeight: 20,
  },
  aiError: {
    color: "#B45309",
    fontSize: 13,
    paddingVertical: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  iconText: {
    fontSize: 18,
  },
  aiBtnActive: {
    backgroundColor: "#DCFCE7",
  },
  input: {
    flex: 1,
    backgroundColor: "#F2F3F5",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#111827",
    fontSize: 15,
  },
  sendBtn: {
    marginLeft: 8,
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendText: {
    color: "#fff",
    fontWeight: "600",
  },
});

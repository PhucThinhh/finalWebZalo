import React from "react";
import {
  Image,
  Modal,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  friends: any[];
  groups: any[];
  currentRoomId?: string;
  onClose: () => void;
  onSelectTarget: (target: any) => void;
};

const DEFAULT_AVATAR = "https://via.placeholder.com/100";

export default function ForwardMessageModal({
  visible,
  friends,
  groups,
  currentRoomId,
  onClose,
  onSelectTarget,
}: Props) {
  const groupTargets = groups
    .filter((group) => {
      const groupId = String(group?.id ?? group?.groupId ?? "");
      return groupId && groupId !== String(currentRoomId);
    })
    .map((group) => ({
      ...group,
      targetType: "GROUP",
      targetId: group?.id ?? group?.groupId,
      title: group?.name || "Nhóm chat",
      subtitle: "Nhóm chat",
      avatar: group?.avatar || group?.avatarUrl || null,
    }));

  const friendTargets = friends.map((friend) => ({
    ...friend,
    targetType: "PRIVATE",
    targetId:
      friend?.userId ??
      friend?.friendId ??
      friend?.id ??
      friend?.receiverId ??
      friend?.senderId,
    title: friend?.username || friend?.name || friend?.fullName || "Người dùng",
    subtitle: "Bạn bè",
    avatar:
      friend?.avatar ||
      friend?.avatarUrl ||
      friend?.profilePicture ||
      DEFAULT_AVATAR,
  }));

  const data = [...groupTargets, ...friendTargets].filter((item) => item.targetId);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>Chuyển tiếp tin nhắn</Text>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          {data.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Chưa có bạn bè hoặc nhóm để chuyển tiếp
              </Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item, index) =>
                `${item.targetType}_${item.targetId}_${index}`
              }
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.8}
                  onPress={() => onSelectTarget(item)}
                >
                  <Image
                    source={{ uri: item.avatar || DEFAULT_AVATAR }}
                    style={styles.avatar}
                  />

                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.title}
                    </Text>

                    <Text style={styles.sub} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>

                  <Text style={styles.forwardText}>Gửi</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 18,
  },

  box: {
    backgroundColor: "#fff",
    borderRadius: 22,
    maxHeight: "80%",
    overflow: "hidden",
  },

  header: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
    flexDirection: "row",
    alignItems: "center",
  },

  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },

  closeBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    fontSize: 30,
    color: "#374151",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E7EB",
  },

  info: {
    flex: 1,
    marginLeft: 12,
  },

  name: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  sub: {
    marginTop: 3,
    fontSize: 13,
    color: "#6B7280",
  },

  forwardText: {
    color: "#4F46E5",
    fontWeight: "800",
    fontSize: 14,
  },

  emptyBox: {
    padding: 24,
  },

  emptyText: {
    color: "#6B7280",
    textAlign: "center",
  },
});
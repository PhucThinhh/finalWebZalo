import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { createGroupApi } from "../api/groupApi";

type Props = {
  visible: boolean;
  onClose: () => void;
  friends: any[];
  onCreated?: (group: any) => void;
};

export default function CreateGroupModal({
  visible,
  onClose,
  friends,
  onCreated,
}: Props) {
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const getFriendUserId = (item: any) => {
    return Number(
      item?.userId ??
        item?.friendId ??
        item?.receiverId ??
        item?.senderId ??
        item?.id
    );
  };

  const getFriendName = (item: any) => {
    return (
      item?.username ||
      item?.name ||
      item?.fullName ||
      item?.email ||
      "Người dùng"
    );
  };

  const resetForm = () => {
    setGroupName("");
    setSelectedIds([]);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  const toggleSelect = (userId: number) => {
    if (!userId || Number.isNaN(userId)) return;

    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (selectedIds.length < 2) {
      Alert.alert("Lỗi", "Chọn ít nhất 2 thành viên");
      return;
    }

    try {
      setLoading(true);

      const res = await createGroupApi({
        // Cho phép để trống tên nhóm.
        // Backend sẽ tự lấy tên các thành viên để đặt tên.
        name: groupName.trim(),
        memberIds: selectedIds,
      });

      console.log("createGroup response:", res);

      Alert.alert("Thành công", "Đã tạo nhóm");

      resetForm();

      onCreated?.(res);

      onClose();
    } catch (error: any) {
      console.log("createGroup error:", error);
      console.log("createGroup response:", error?.response?.data);
      console.log("createGroup status:", error?.response?.status);

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.response?.data ||
          "Không tạo được nhóm"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Tạo nhóm</Text>

          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Tên nhóm (có thể để trống)"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />

          <Text style={styles.hintText}>
            Nếu để trống, tên nhóm sẽ tự lấy theo tên thành viên.
          </Text>

          <Text style={styles.label}>Chọn thành viên</Text>

          <FlatList
            data={friends}
            keyExtractor={(item, index) =>
              String(
                item?.userId ??
                  item?.friendId ??
                  item?.receiverId ??
                  item?.senderId ??
                  item?.id ??
                  index
              )
            }
            style={{ maxHeight: 300 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Chưa có bạn bè để tạo nhóm</Text>
            }
            renderItem={({ item }) => {
              const userId = getFriendUserId(item);
              const checked = selectedIds.includes(userId);

              return (
                <TouchableOpacity
                  style={[styles.row, checked && styles.rowSelected]}
                  onPress={() => toggleSelect(userId)}
                  activeOpacity={0.75}
                >
                  <View>
                    <Text style={styles.rowText}>{getFriendName(item)}</Text>

                    {!!item?.status && (
                      <Text style={styles.rowSubText}>{item.status}</Text>
                    )}
                  </View>

                  <Text style={styles.checkText}>{checked ? "✅" : "⬜"}</Text>
                </TouchableOpacity>
              );
            }}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.btnGhost}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.btnGhostText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={handleCreate}
              disabled={loading}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? "Đang tạo..." : "Tạo nhóm"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },

  box: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: "80%",
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111827",
  },

  input: {
    backgroundColor: "#F2F3F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    color: "#111827",
  },

  hintText: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 12,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    borderRadius: 8,
  },

  rowSelected: {
    backgroundColor: "#EEF2FF",
  },

  rowText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  rowSubText: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },

  checkText: {
    fontSize: 18,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 8,
  },

  btnGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  btnGhostText: {
    color: "#374151",
    fontWeight: "600",
  },

  btnPrimary: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  btnDisabled: {
    opacity: 0.6,
  },

  btnPrimaryText: {
    color: "#fff",
    fontWeight: "700",
  },
});
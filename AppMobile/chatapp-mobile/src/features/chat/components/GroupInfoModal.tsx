import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { getFriendsApi, getMeApi } from "../../contacts/api/contactsApi";
import { uploadChatFileApi } from "../api/chatApi";
import {
  addGroupMemberApi,
  deleteGroupApi,
  getGroupMembersApi,
  leaveGroupApi,
  removeGroupMemberApi,
  renameGroupApi,
  updateGroupAvatarApi,
  updateGroupBackgroundApi,
} from "../api/groupApi";
const API_BASE_URL = "http://10.0.2.2:8080";

const normalizeImageUrl = (url?: string | null) => {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  return `${API_BASE_URL}/${url}`;
};

type Props = {
  visible: boolean;
  groupId: string;
  groupName: string;
  groupAvatar?: string | null;
  onClose: () => void;
  onRenamed?: (newName: string) => void;
  onLeftOrDeleted?: () => void;
  onBackgroundChanged?: (backgroundUrl: string) => void;
  onAvatarChanged?: (avatarUrl: string) => void;
};

const BACKGROUNDS = [
  {
    label: "Cánh đồng tím",
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
  },
  {
    label: "Thiên nhiên xanh",
    url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  },
  {
    label: "Hồ nước",
    url: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e",
  },
  {
    label: "Rừng cây",
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
  },
];

export default function GroupInfoModal({
  visible,
  groupId,
  groupName,
  groupAvatar,
  onClose,
  onRenamed,
  onLeftOrDeleted,
  onBackgroundChanged,
  onAvatarChanged,
}: Props) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [addMemberMode, setAddMemberMode] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [chooseOwnerMode, setChooseOwnerMode] = useState(false);

  const [name, setName] = useState(groupName || "");
  const [submitting, setSubmitting] = useState(false);

  const normalizeData = (data: any) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.content)) return data.content;
    return [];
  };

  const getUserId = (item: any) => {
    return Number(
      item?.userId ??
        item?.id ??
        item?.friendId ??
        item?.senderId ??
        item?.receiverId
    );
  };

  const getUserName = (item: any) => {
    return (
      item?.username ||
      item?.name ||
      item?.fullName ||
      item?.email ||
      "Người dùng"
    );
  };

  const extractUploadedUrl = (uploadRes: any) => {
    if (!uploadRes) return null;

    if (typeof uploadRes === "string") return uploadRes;

    return (
      uploadRes?.url ||
      uploadRes?.fileUrl ||
      uploadRes?.data?.url ||
      uploadRes?.data?.fileUrl ||
      uploadRes?.data ||
      null
    );
  };

  const loadMe = async () => {
    try {
      const data = await getMeApi();

      console.log("getMeApi in GroupInfo:", JSON.stringify(data, null, 2));

      setCurrentUser(data);
    } catch (error: any) {
      console.log("getMeApi in GroupInfo error:", error);
      console.log("getMeApi in GroupInfo response:", error?.response?.data);

      setCurrentUser(null);
    }
  };

  const loadMembers = async () => {
    if (!groupId) return;

    try {
      setLoading(true);

      const data = await getGroupMembersApi(groupId);

      console.log("getGroupMembersApi response:", JSON.stringify(data, null, 2));

      setMembers(normalizeData(data));
    } catch (error: any) {
      console.log("getGroupMembersApi error:", error);
      console.log("getGroupMembersApi status:", error?.response?.status);
      console.log("getGroupMembersApi response:", error?.response?.data);

      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const data = await getFriendsApi();

      console.log("getFriendsApi in GroupInfo:", JSON.stringify(data, null, 2));

      setFriends(normalizeData(data));
    } catch (error: any) {
      console.log("getFriendsApi in GroupInfo error:", error);
      console.log("getFriendsApi in GroupInfo response:", error?.response?.data);

      setFriends([]);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadMe(), loadMembers(), loadFriends()]);
  };

  useEffect(() => {
    if (visible) {
      setName(groupName || "");
      setRenameMode(false);
      setAddMemberMode(false);
      setBackgroundMode(false);
      setChooseOwnerMode(false);
      loadAll();
    }
  }, [visible, groupId, groupName]);

  const currentUserId =
    currentUser?.id ?? currentUser?.userId ?? currentUser?.data?.id;

  const myMember = useMemo(() => {
    return members.find((m) => String(m?.userId) === String(currentUserId));
  }, [members, currentUserId]);

  const isOwner = String(myMember?.role || "").toUpperCase() === "OWNER";
  const isAdmin = String(myMember?.role || "").toUpperCase() === "ADMIN";

  const canManageGroup = isOwner || isAdmin;

  const ownerCandidates = useMemo(() => {
    return members.filter((m) => String(m?.userId) !== String(currentUserId));
  }, [members, currentUserId]);

  const memberIds = useMemo(() => {
    return members
      .map((m) => Number(m?.userId ?? m?.id))
      .filter((id) => !!id && !Number.isNaN(id));
  }, [members]);

  const friendsCanAdd = useMemo(() => {
    return friends.filter((friend) => {
      const id = getUserId(friend);

      if (!id || Number.isNaN(id)) return false;

      return !memberIds.includes(id);
    });
  }, [friends, memberIds]);

  const handleChangeAvatar = async () => {
    if (!canManageGroup) {
      Alert.alert("Thông báo", "Chỉ chủ nhóm hoặc quản trị viên mới được đổi ảnh nhóm");
      return;
    }

    try {
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

      setSubmitting(true);

      const uploadRes = await uploadChatFileApi({
        uri: asset.uri,
        name: asset.fileName || `group_avatar_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });

      console.log("upload group avatar response:", JSON.stringify(uploadRes, null, 2));

      const avatarUrl = extractUploadedUrl(uploadRes);

      if (!avatarUrl || typeof avatarUrl !== "string") {
        Alert.alert("Lỗi", "Upload ảnh thất bại");
        return;
      }

      const res = await updateGroupAvatarApi(groupId, avatarUrl);

      Alert.alert("Thành công", "Đã đổi ảnh đại diện nhóm");

      onAvatarChanged?.(normalizeImageUrl(res?.avatarUrl || avatarUrl) || avatarUrl);
    } catch (error: any) {
      console.log("change group avatar error:", error);
      console.log("change group avatar response:", error?.response?.data);

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.response?.data ||
          "Không đổi được ảnh đại diện nhóm"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRename = async () => {
    const newName = name.trim();

    if (!newName) {
      Alert.alert("Lỗi", "Tên nhóm không được để trống");
      return;
    }

    try {
      setSubmitting(true);

      const res = await renameGroupApi(groupId, newName);

      Alert.alert("Thành công", "Đã đổi tên nhóm");

      setRenameMode(false);
      onRenamed?.(res?.name || newName);

      await loadMembers();
    } catch (error: any) {
      console.log("renameGroup error:", error);
      console.log("renameGroup response:", error?.response?.data);

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.response?.data ||
          "Không đổi được tên nhóm"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeBackground = async (backgroundUrl: string) => {
    try {
      setSubmitting(true);

      const res = await updateGroupBackgroundApi(groupId, backgroundUrl);

      Alert.alert("Thành công", "Đã đổi nền đoạn chat");

      onBackgroundChanged?.(res?.backgroundUrl || backgroundUrl);

      setBackgroundMode(false);
    } catch (error: any) {
      console.log("updateGroupBackground error:", error);
      console.log("updateGroupBackground response:", error?.response?.data);

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.response?.data ||
          "Không đổi được nền đoạn chat"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMember = async (friend: any) => {
    const userId = getUserId(friend);

    if (!userId || Number.isNaN(userId)) {
      Alert.alert("Lỗi", "Không xác định được người dùng");
      return;
    }

    try {
      setSubmitting(true);

      await addGroupMemberApi(groupId, userId);

      Alert.alert("Thành công", "Đã thêm thành viên");

      await loadAll();
    } catch (error: any) {
      console.log("addGroupMember error:", error);
      console.log("addGroupMember response:", error?.response?.data);

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.response?.data ||
          "Không thêm được thành viên"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = (member: any) => {
    const userId = Number(member?.userId ?? member?.id);
    const username = member?.username || member?.name || "thành viên này";
    const role = String(member?.role || "").toUpperCase();

    if (!userId || Number.isNaN(userId)) {
      Alert.alert("Lỗi", "Không xác định được thành viên");
      return;
    }

    if (role === "OWNER") {
      Alert.alert("Thông báo", "Không thể xóa chủ nhóm");
      return;
    }

    Alert.alert("Xóa thành viên", `Bạn muốn xóa ${username} khỏi nhóm?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setSubmitting(true);

            await removeGroupMemberApi(groupId, userId);

            Alert.alert("Thành công", "Đã xóa thành viên");

            await loadAll();
          } catch (error: any) {
            console.log("removeGroupMember error:", error);
            console.log("removeGroupMember response:", error?.response?.data);

            Alert.alert(
              "Lỗi",
              error?.response?.data?.message ||
                error?.response?.data ||
                "Không xóa được thành viên"
            );
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    if (isOwner && ownerCandidates.length > 0) {
      setChooseOwnerMode(true);
      return;
    }

    Alert.alert("Rời nhóm", "Bạn có chắc muốn rời khỏi nhóm này không?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Rời nhóm",
        style: "destructive",
        onPress: async () => {
          try {
            setSubmitting(true);

            await leaveGroupApi(groupId, null);

            Alert.alert("Thành công", "Bạn đã rời nhóm");

            onClose();
            onLeftOrDeleted?.();
          } catch (error: any) {
            console.log("leaveGroup error:", error);
            console.log("leaveGroup status:", error?.response?.status);
            console.log("leaveGroup response:", error?.response?.data);

            Alert.alert(
              "Lỗi",
              error?.response?.data?.message ||
                error?.response?.data ||
                "Không thể rời nhóm"
            );
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const handleLeaveGroupWithNewOwner = (newOwner: any) => {
    const newOwnerId = Number(newOwner?.userId ?? newOwner?.id);
    const newOwnerName = newOwner?.username || newOwner?.name || "người này";

    if (!newOwnerId || Number.isNaN(newOwnerId)) {
      Alert.alert("Lỗi", "Không xác định được người nhận quyền");
      return;
    }

    Alert.alert(
      "Chuyển quyền chủ nhóm",
      `Bạn muốn chuyển quyền chủ nhóm cho ${newOwnerName} và rời nhóm?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Chuyển quyền và rời",
          style: "destructive",
          onPress: async () => {
            try {
              setSubmitting(true);

              await leaveGroupApi(groupId, newOwnerId);

              Alert.alert("Thành công", "Đã chuyển quyền và rời nhóm");

              setChooseOwnerMode(false);
              onClose();
              onLeftOrDeleted?.();
            } catch (error: any) {
              console.log("leaveGroup with owner error:", error);
              console.log(
                "leaveGroup with owner response:",
                error?.response?.data
              );

              Alert.alert(
                "Lỗi",
                error?.response?.data?.message ||
                  error?.response?.data ||
                  "Không thể chuyển quyền và rời nhóm"
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert("Giải tán nhóm", "Bạn có chắc muốn giải tán nhóm này không?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Giải tán",
        style: "destructive",
        onPress: async () => {
          try {
            setSubmitting(true);

            await deleteGroupApi(groupId);

            Alert.alert("Thành công", "Đã giải tán nhóm");

            onClose();
            onLeftOrDeleted?.();
          } catch (error: any) {
            console.log("deleteGroup error:", error);
            console.log("deleteGroup response:", error?.response?.data);

            Alert.alert(
              "Lỗi",
              error?.response?.data?.message ||
                error?.response?.data ||
                "Không thể giải tán nhóm"
            );
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>Thông tin nhóm</Text>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.groupTop}>
              <TouchableOpacity style={styles.avatar} onPress={handleChangeAvatar}>
               {groupAvatar ? (
  <Image
    source={{ uri: normalizeImageUrl(groupAvatar) || "" }}
    style={styles.avatarImage}
    onError={(e) => {
      console.log("group avatar image error:", e.nativeEvent);
    }}
  />
) : (
  <Text style={styles.avatarText}>👥</Text>
)}
              </TouchableOpacity>

              {renameMode ? (
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                    placeholder="Tên nhóm"
                    placeholderTextColor="#9CA3AF"
                  />

                  <View style={styles.renameActions}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => {
                        setName(groupName);
                        setRenameMode(false);
                      }}
                      disabled={submitting}
                    >
                      <Text style={styles.cancelText}>Hủy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveBtn}
                      onPress={handleRename}
                      disabled={submitting}
                    >
                      <Text style={styles.saveText}>
                        {submitting ? "..." : "Lưu"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName} numberOfLines={2}>
                    {groupName || "Nhóm chat"}
                  </Text>

                  <Text style={styles.groupSub}>
                    Nhấn ảnh để đổi avatar · {members.length} thành viên
                  </Text>
                </View>
              )}

              {!renameMode && (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setRenameMode(true)}
                >
                  <Text style={styles.editText}>✎</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.messageBtn} onPress={onClose}>
              <Text style={styles.messageBtnText}>Nhắn tin</Text>
            </TouchableOpacity>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Thành viên ({members.length})
              </Text>
              <Text style={styles.sectionSub}>
                Nhấn vào thành viên để xóa khỏi nhóm
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <FlatList
                data={members}
                keyExtractor={(item, index) => String(item?.userId ?? index)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.memberRow}
                    activeOpacity={0.75}
                    onPress={() => handleRemoveMember(item)}
                  >
                    <View style={styles.memberAvatar}>
                      <Text>👤</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {item?.username || item?.name || "Người dùng"}
                      </Text>

                      <Text style={styles.memberRole}>
                        {item?.role || "MEMBER"}
                      </Text>
                    </View>

                    {String(item?.role || "").toUpperCase() !== "OWNER" && (
                      <Text style={styles.removeText}>Xóa</Text>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Chưa có thành viên</Text>
                }
              />
            )}

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setAddMemberMode((prev) => !prev)}
            >
              <Text style={styles.optionIcon}>＋</Text>
              <Text style={styles.optionText}>Thêm thành viên</Text>
            </TouchableOpacity>

            {addMemberMode && (
              <View style={styles.addBox}>
                <Text style={styles.addTitle}>Bạn bè có thể thêm</Text>

                {friendsCanAdd.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Không còn bạn bè nào để thêm
                  </Text>
                ) : (
                  friendsCanAdd.map((friend) => {
                    const id = getUserId(friend);

                    return (
                      <TouchableOpacity
                        key={String(id)}
                        style={styles.friendRow}
                        onPress={() => handleAddMember(friend)}
                        disabled={submitting}
                      >
                        <View style={styles.memberAvatar}>
                          <Text>👤</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>
                            {getUserName(friend)}
                          </Text>

                          <Text style={styles.memberRole}>
                            {friend?.status || "Bạn bè"}
                          </Text>
                        </View>

                        <Text style={styles.addText}>Thêm</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => setBackgroundMode((prev) => !prev)}
            >
              <Text style={styles.optionIcon}>🖼️</Text>
              <Text style={styles.optionText}>Đổi nền đoạn chat</Text>
            </TouchableOpacity>

            {backgroundMode && (
              <View style={styles.backgroundBox}>
                <Text style={styles.addTitle}>Chọn nền đoạn chat</Text>

                {BACKGROUNDS.map((bg) => (
                  <TouchableOpacity
                    key={bg.url}
                    style={styles.backgroundItem}
                    onPress={() => handleChangeBackground(bg.url)}
                    disabled={submitting}
                  >
                    <Text style={styles.backgroundText}>{bg.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {chooseOwnerMode && (
              <View style={styles.transferBox}>
                <Text style={styles.addTitle}>
                  Chọn người nhận quyền chủ nhóm
                </Text>

                {ownerCandidates.map((member) => {
                  const id = Number(member?.userId ?? member?.id);

                  return (
                    <TouchableOpacity
                      key={String(id)}
                      style={styles.friendRow}
                      onPress={() => handleLeaveGroupWithNewOwner(member)}
                      disabled={submitting}
                    >
                      <View style={styles.memberAvatar}>
                        <Text>👤</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>
                          {member?.username || member?.name || "Người dùng"}
                        </Text>

                        <Text style={styles.memberRole}>
                          {member?.role || "MEMBER"}
                        </Text>
                      </View>

                      <Text style={styles.addText}>Chọn</Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.cancelTransferBtn}
                  onPress={() => setChooseOwnerMode(false)}
                >
                  <Text style={styles.cancelTransferText}>Hủy chọn</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.dangerRow}
              onPress={handleDeleteGroup}
              disabled={submitting}
            >
              <Text style={styles.dangerIcon}>🗑️</Text>
              <Text style={styles.dangerText}>Giải tán nhóm</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerRow}
              onPress={handleLeaveGroup}
              disabled={submitting}
            >
              <Text style={styles.dangerIcon}>🚪</Text>
              <Text style={styles.dangerText}>Rời nhóm</Text>
            </TouchableOpacity>
          </ScrollView>

          {submitting && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
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
    maxHeight: "90%",
    paddingBottom: 14,
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
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
  },

  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    fontSize: 32,
    color: "#374151",
  },

  groupTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 14,
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },

  avatarText: {
    fontSize: 34,
  },

  groupName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },

  groupSub: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },

  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  editText: {
    fontSize: 18,
    color: "#374151",
  },

  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },

  renameActions: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },

  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },

  cancelText: {
    fontWeight: "700",
    color: "#374151",
  },

  saveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
  },

  saveText: {
    fontWeight: "700",
    color: "#fff",
  },

  messageBtn: {
    marginHorizontal: 18,
    backgroundColor: "#F1F5F9",
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  messageBtnText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },

  section: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 8,
    borderTopColor: "#F1F5F9",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  sectionSub: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
  },

  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  memberName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  memberRole: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },

  removeText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },

  emptyText: {
    color: "#6B7280",
    textAlign: "center",
    padding: 14,
  },

  divider: {
    height: 8,
    backgroundColor: "#F1F5F9",
    marginTop: 12,
  },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },

  optionIcon: {
    fontSize: 22,
    color: "#2563EB",
  },

  optionText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  addBox: {
    marginHorizontal: 18,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
  },

  addTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },

  addText: {
    color: "#2563EB",
    fontWeight: "800",
  },

  backgroundBox: {
    marginHorizontal: 18,
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
  },

  backgroundItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    marginTop: 8,
  },

  backgroundText: {
    color: "#3730A3",
    fontWeight: "800",
  },

  transferBox: {
    marginHorizontal: 18,
    padding: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
  },

  cancelTransferBtn: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },

  cancelTransferText: {
    fontWeight: "800",
    color: "#374151",
  },

  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },

  dangerIcon: {
    fontSize: 22,
  },

  dangerText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#DC2626",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
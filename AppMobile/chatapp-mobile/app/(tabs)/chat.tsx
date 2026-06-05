import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import {
  getFriendsApi,
  getMeApi,
} from "../../src/features/contacts/api/contactsApi";
import { getMyGroupsApi } from "../../src/features/chat/api/groupApi";
import { getCurrentUserId } from "../../src/features/chat/utils/chatHelpers";
import CreateGroupModal from "../../src/features/chat/components/CreateGroupModal";

const API_BASE_URL = "http://10.0.2.2:8080";

const DEFAULT_GROUP_AVATAR =
  "https://ui-avatars.com/api/?name=Group&background=E5E7EB&color=111827";

const DEFAULT_USER_AVATAR =
  "https://ui-avatars.com/api/?name=User&background=E5E7EB&color=111827";

const normalizeImageUrl = (
  url?: string | null,
  fallback: string = DEFAULT_GROUP_AVATAR
) => {
  if (!url) return fallback;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    // Nếu là link S3 cũ bị 403 thì vẫn trả về link đó,
    // onError của Image sẽ log lỗi. User đổi avatar mới sẽ hết.
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  return `${API_BASE_URL}/${url}`;
};

export default function ChatScreen() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const normalizeData = (data: any) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.content)) return data.content;

    if (data && typeof data === "object") {
      if ("friendshipId" in data || "userId" in data || "username" in data) {
        return [data];
      }
    }

    return [];
  };

  const buildPrivateRoomId = (
    myId: number | string,
    otherId: number | string
  ) => {
    const a = Number(myId);
    const b = Number(otherId);

    if (Number.isNaN(a) || Number.isNaN(b)) {
      return `${myId}_${otherId}`;
    }

    return a < b ? `${a}_${b}` : `${b}_${a}`;
  };

  const loadData = async () => {
    try {
      setLoading(true);

      const [meRes, friendsRes] = await Promise.all([
        getMeApi(),
        getFriendsApi(),
      ]);

      setCurrentUser(meRes);
      setFriends(normalizeData(friendsRes));

      try {
        const groupsRes = await getMyGroupsApi();
        const normalizedGroups = normalizeData(groupsRes);

        console.log(
          "getMyGroupsApi response:",
          JSON.stringify(normalizedGroups, null, 2)
        );

        setGroups(normalizedGroups);
      } catch (groupError: any) {
        console.log("getMyGroupsApi error:", groupError);
        console.log("getMyGroupsApi status:", groupError?.response?.status);
        console.log("getMyGroupsApi response:", groupError?.response?.data);

        setGroups([]);
      }
    } catch (error) {
      console.log("load chat list error:", error);
      setFriends([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const openPrivateChat = (friend: any) => {
    const myId = getCurrentUserId(currentUser);

    const otherId =
      friend?.userId ??
      friend?.friendId ??
      friend?.receiverId ??
      friend?.senderId ??
      friend?.id;

    if (!myId || !otherId) return;

    if (String(myId) === String(otherId)) return;

    const roomId = buildPrivateRoomId(myId, otherId);
    const username = encodeURIComponent(
      friend?.username || friend?.name || friend?.fullName || "Chat"
    );

    router.push(`/chat/${roomId}?username=${username}&otherUserId=${otherId}`);
  };

  const openGroupChat = (group: any) => {
    const groupId = group?.id ?? group?.groupId;
    const groupName = encodeURIComponent(group?.name || "Nhóm chat");

    const backgroundUrl = group?.backgroundUrl
      ? encodeURIComponent(normalizeImageUrl(group.backgroundUrl, ""))
      : "";

    const avatarUrl = group?.avatarUrl
      ? encodeURIComponent(normalizeImageUrl(group.avatarUrl, DEFAULT_GROUP_AVATAR))
      : "";

    if (!groupId) return;

    router.push(
      `/chat/${groupId}?username=${groupName}&isGroup=true&backgroundUrl=${backgroundUrl}&avatarUrl=${avatarUrl}`
    );
  };

  const handleGroupCreated = (newGroup: any) => {
    console.log("handleGroupCreated:", newGroup);

    if (!newGroup) return;

    setGroups((prev) => {
      const groupId = newGroup?.id ?? newGroup?.groupId;

      const existed = prev.some((g) => {
        const id = g?.id ?? g?.groupId;
        return String(id) === String(groupId);
      });

      if (existed) return prev;

      return [newGroup, ...prev];
    });

    setShowCreateGroup(false);

    const groupId = newGroup?.id ?? newGroup?.groupId;

    if (groupId) {
      openGroupChat(newGroup);
    }
  };

  const conversations = [
    ...groups.map((g) => ({
      ...g,
      conversationType: "GROUP",
    })),
    ...friends.map((f) => ({
      ...f,
      conversationType: "PRIVATE",
    })),
  ];

  const renderConversationItem = ({ item }: { item: any }) => {
    const isGroup = item?.conversationType === "GROUP";

    const name = isGroup
      ? item?.name || "Nhóm chat"
      : item?.username || item?.name || item?.fullName || "Người dùng";

    const avatar = isGroup
      ? normalizeImageUrl(item?.avatarUrl, DEFAULT_GROUP_AVATAR)
      : normalizeImageUrl(
          item?.avatar || item?.avatarUrl || item?.profilePicture || null,
          DEFAULT_USER_AVATAR
        );

    const status = isGroup ? "Nhóm chat" : item?.status || "Chat ngay";

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        activeOpacity={0.85}
        onPress={() => {
          if (isGroup) {
            openGroupChat(item);
          } else {
            openPrivateChat(item);
          }
        }}
        disabled={!currentUser && !isGroup}
      >
        <Image
          source={{ uri: avatar }}
          style={styles.avatar}
          onError={(e) => {
            console.log("conversation avatar error:", e.nativeEvent);
          }}
        />

        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.lastMessage}>{status}</Text>
        </View>

        <Text style={styles.timeText}>{isGroup ? "Nhóm" : "Chat"}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1296F3" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tin nhắn</Text>
          <Text style={styles.headerSub}>Bạn bè và nhóm chat</Text>
        </View>

        <TouchableOpacity
          style={styles.groupBtn}
          activeOpacity={0.85}
          onPress={() => {
            setShowCreateGroup(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.groupBtnText}>+ Nhóm</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>Chưa có bạn bè hoặc nhóm chat</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item, index) =>
            String(
              item?.conversationType +
                "_" +
                (item?.id ??
                  item?.groupId ??
                  item?.friendshipId ??
                  item?.userId ??
                  index)
            )
          }
          renderItem={renderConversationItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      <CreateGroupModal
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        friends={friends}
        onCreated={handleGroupCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  header: {
    backgroundColor: "#1296F3",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 84,
  },

  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },

  headerSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    marginTop: 2,
  },

  groupBtn: {
    backgroundColor: "#FFFFFF",
    minWidth: 86,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  groupBtnText: {
    color: "#1296F3",
    fontWeight: "700",
    fontSize: 14,
  },

  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyText: {
    color: "#6B7280",
    fontSize: 15,
  },

  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
    backgroundColor: "#fff",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E5E7EB",
  },

  info: {
    flex: 1,
    marginLeft: 12,
  },

  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  lastMessage: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },

  timeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
});
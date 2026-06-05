import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import {
  createPostApi,
  deletePostApi,
  getFeedPostsApi,
} from "../../src/features/post/api/postApi";

import { uploadChatFileApi } from "../../src/features/chat/api/chatApi";
import { getMeApi } from "../../src/features/user/api/userApi";

const API_BASE_URL = "http://10.0.2.2:8080";

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=User&background=E5E7EB&color=111827";

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

const normalizeResponse = (res: any) => {
  return res?.data ?? res;
};

const formatTime = (value?: string) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const mo = String(date.getMonth() + 1).padStart(2, "0");

  return `${h}:${m} ${d}/${mo}`;
};

const extractUploadedFileUrl = (res: any) => {
  const data = normalizeResponse(res);

  if (typeof data === "string") return data;

  return (
    data?.url ||
    data?.fileUrl ||
    data?.path ||
    data?.data ||
    data?.imageUrl ||
    null
  );
};

export default function TimelineScreen() {
  console.log("TIMELINE SCREEN ĐÃ CHẠY");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      const [meRes, feedRes] = await Promise.all([
        getMeApi(),
        getFeedPostsApi(),
      ]);

      const meData = normalizeResponse(meRes);
      const feedData = normalizeResponse(feedRes);

      console.log("getMeApi timeline:", JSON.stringify(meData, null, 2));
      console.log("getFeedPostsApi:", JSON.stringify(feedData, null, 2));

      setCurrentUser(meData);
      setPosts(Array.isArray(feedData) ? feedData : []);
    } catch (error: any) {
      console.log("load timeline error:", error);
      console.log("load timeline status:", error?.response?.status);
      console.log("load timeline response:", error?.response?.data);

      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Thông báo", "Bạn cần cấp quyền truy cập ảnh");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) return;

      setSelectedImage(asset);
    } catch (error) {
      console.log("pick image error:", error);
      Alert.alert("Lỗi", "Không thể chọn ảnh");
    }
  };

  const handleCreatePost = async () => {
    const text = content.trim();

    if (!text && !selectedImage) {
      Alert.alert("Thông báo", "Nhập nội dung hoặc chọn ảnh");
      return;
    }

    try {
      setSubmitting(true);

      let imageUrl: string | null = null;

      if (selectedImage) {
        const uploadRes = await uploadChatFileApi({
          uri: selectedImage.uri,
          name: selectedImage.fileName || `post_${Date.now()}.jpg`,
          type: selectedImage.mimeType || "image/jpeg",
        });

        imageUrl = extractUploadedFileUrl(uploadRes);

        console.log("upload post image response:", uploadRes);
        console.log("post imageUrl:", imageUrl);
      }

      const createdRes = await createPostApi({
        content: text,
        imageUrl,
      });

      const created = normalizeResponse(createdRes);

      setPosts((prev) => [created, ...prev]);
      setContent("");
      setSelectedImage(null);
      setShowCreateModal(false);

      Alert.alert("Thành công", "Đã đăng nhật ký");
    } catch (error: any) {
      console.log("create post error:", error);
      console.log("create post status:", error?.response?.status);
      console.log("create post response:", error?.response?.data);

      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.response?.data ||
          "Không thể đăng nhật ký"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = (post: any) => {
    if (String(post?.userId) !== String(currentUser?.id)) return;

    Alert.alert("Xoá bài viết", "Bạn có chắc muốn xoá bài viết này?", [
      {
        text: "Huỷ",
        style: "cancel",
      },
      {
        text: "Xoá",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePostApi(post.id);

            setPosts((prev) =>
              prev.filter((item) => String(item.id) !== String(post.id))
            );
          } catch (error: any) {
            console.log("delete post error:", error);
            console.log("delete post response:", error?.response?.data);
            Alert.alert("Lỗi", "Không thể xoá bài viết");
          }
        },
      },
    ]);
  };

  const renderPost = ({ item }: { item: any }) => {
    const avatar = normalizeImageUrl(item?.userAvatar) || DEFAULT_AVATAR;
    const imageUrl = normalizeImageUrl(item?.imageUrl);
    const isMine = String(item?.userId) === String(currentUser?.id);

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Image
            source={{ uri: avatar }}
            style={styles.avatar}
            onError={(e) => {
              console.log("post avatar error:", e.nativeEvent);
            }}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.username}>
              {item?.username || "Người dùng"}
            </Text>
            <Text style={styles.timeText}>{formatTime(item?.createdAt)}</Text>
          </View>

          {isMine && (
            <TouchableOpacity onPress={() => handleDeletePost(item)}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        {!!item?.content && (
          <Text style={styles.postContent}>{item.content}</Text>
        )}

        {!!imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={styles.postImage}
            resizeMode="cover"
            onError={(e) => {
              console.log("post image error:", e.nativeEvent);
            }}
          />
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="heart-outline" size={20} color="#6B7280" />
            <Text style={styles.actionText}>Thích</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={18} color="#6B7280" />
            <Text style={styles.actionText}>Bình luận</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="share-social-outline" size={19} color="#6B7280" />
            <Text style={styles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <StatusBar barStyle="light-content" backgroundColor="#1296F3" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Nhật ký</Text>
          <Text style={styles.headerSub}>Tin tức từ bạn bè và mọi người</Text>
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={20} color="#1296F3" />
          <Text style={styles.createBtnText}>Đăng</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#1296F3" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item, index) => String(item?.id ?? index)}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.quickPost}
              onPress={() => setShowCreateModal(true)}
            >
              <Image
                source={{
                  uri:
                    normalizeImageUrl(currentUser?.avatar) || DEFAULT_AVATAR,
                }}
                style={styles.quickAvatar}
                onError={(e) => {
                  console.log("quick avatar error:", e.nativeEvent);
                }}
              />

              <Text style={styles.quickText}>
                Hôm nay bạn muốn chia sẻ gì?
              </Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Chưa có bài viết</Text>
              <Text style={styles.emptySub}>
                Hãy là người đầu tiên đăng nhật ký
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setContent("");
                  setSelectedImage(null);
                }}
              >
                <Text style={styles.cancelText}>Huỷ</Text>
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Tạo nhật ký</Text>

              <TouchableOpacity
                onPress={handleCreatePost}
                disabled={submitting}
              >
                <Text style={styles.postText}>
                  {submitting ? "Đang đăng..." : "Đăng"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.createUserRow}>
              <Image
                source={{
                  uri:
                    normalizeImageUrl(currentUser?.avatar) || DEFAULT_AVATAR,
                }}
                style={styles.avatar}
              />

              <Text style={styles.username}>
                {currentUser?.username || "Người dùng"}
              </Text>
            </View>

            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Bạn đang nghĩ gì?"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
            />

            {!!selectedImage?.uri && (
              <View style={styles.previewBox}>
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.previewImage}
                />

                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.pickImageBtn}
              onPress={handlePickImage}
            >
              <Ionicons name="image-outline" size={22} color="#1296F3" />
              <Text style={styles.pickImageText}>Thêm ảnh</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  header: {
    backgroundColor: "#1296F3",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },

  headerSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
  },

  createBtn: {
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  createBtnText: {
    color: "#1296F3",
    fontWeight: "800",
  },

  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  listContent: {
    padding: 12,
    paddingBottom: 24,
  },

  quickPost: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  quickAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E5E7EB",
  },

  quickText: {
    marginLeft: 12,
    color: "#6B7280",
    fontSize: 15,
  },

  postCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  postHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E5E7EB",
    marginRight: 10,
  },

  username: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  timeText: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },

  postContent: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#111827",
  },

  postImage: {
    marginTop: 12,
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
  },

  actionRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F1F1",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-around",
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  actionText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },

  emptyBox: {
    alignItems: "center",
    marginTop: 80,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },

  emptySub: {
    marginTop: 6,
    color: "#6B7280",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },

  modalBox: {
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 20,
  },

  modalHeader: {
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F1F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cancelText: {
    color: "#6B7280",
    fontWeight: "700",
  },

  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },

  postText: {
    color: "#1296F3",
    fontWeight: "800",
  },

  createUserRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    minHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 16,
    fontSize: 18,
    color: "#111827",
    textAlignVertical: "top",
  },

  previewBox: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
  },

  previewImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#E5E7EB",
  },

  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  pickImageBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  pickImageText: {
    color: "#1296F3",
    fontWeight: "800",
  },
});
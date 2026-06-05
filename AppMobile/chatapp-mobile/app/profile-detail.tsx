import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getMeApi,
  uploadAvatarApi,
  uploadCoverApi,
} from "../src/features/user/api/userApi";

type User = {
  id?: number;
  username?: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthday?: string;
  avatar?: string | null;
  coverImage?: string | null;
};

const { width } = Dimensions.get("window");

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=User&background=E5E7EB&color=111827";

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb";

export default function ProfileDetail() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
  const [cover, setCover] = useState<string>(DEFAULT_COVER);

  const [selectedAvatar, setSelectedAvatar] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [selectedCover, setSelectedCover] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"success" | "error" | "">("");

  const showToast = (toastType: "success" | "error", text: string) => {
    setType(toastType);
    setMessage(text);
  };

  const normalizeUser = (res: any) => {
    return res?.data ?? res;
  };

  const fetchUser = async () => {
    try {
      const res = await getMeApi();
      const data = normalizeUser(res);

      console.log(
        "getMeApi profile-detail response:",
        JSON.stringify(data, null, 2)
      );

      setUser(data);
      setAvatar(data?.avatar || DEFAULT_AVATAR);
      setCover(data?.coverImage || DEFAULT_COVER);
    } catch (err: any) {
      console.log("Lỗi lấy user:", err);
      console.log("Lỗi lấy user status:", err?.response?.status);
      console.log("Lỗi lấy user response:", err?.response?.data);

      showToast("error", "Không thể tải thông tin người dùng");
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
      setType("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [message]);

  const pickImage = async (target: "avatar" | "cover") => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showToast("error", "Cần quyền truy cập ảnh");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: target === "avatar" ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) return;

      if (target === "avatar") {
        setSelectedAvatar(asset);
      } else {
        setSelectedCover(asset);
      }
    } catch (err) {
      console.log("pickImage error:", err);
      showToast("error", "Không thể chọn ảnh");
    }
  };

  const handleUpload = async (asset: ImagePicker.ImagePickerAsset, target: "avatar" | "cover") => {
    setIsUploading(true);

    try {
      const file = {
        uri: asset.uri,
        name:
          asset.fileName ||
          `${target}_${Date.now()}.${target === "avatar" ? "jpg" : "jpg"}`,
        type: asset.mimeType || "image/jpeg",
      };

      const res =
        target === "avatar"
          ? await uploadAvatarApi(file)
          : await uploadCoverApi(file);

      const updatedUser = normalizeUser(res);

      console.log(
        `${target} upload response:`,
        JSON.stringify(updatedUser, null, 2)
      );

      setUser(updatedUser);

      if (target === "avatar") {
        setAvatar(updatedUser?.avatar || DEFAULT_AVATAR);
        setSelectedAvatar(null);
        showToast("success", "Đã cập nhật avatar 🎉");
      } else {
        setCover(updatedUser?.coverImage || DEFAULT_COVER);
        setSelectedCover(null);
        showToast("success", "Đã cập nhật ảnh bìa 🎉");
      }
    } catch (err: any) {
      console.log("upload profile image error:", err);
      console.log("upload profile image status:", err?.response?.status);
      console.log("upload profile image response:", err?.response?.data);

      showToast(
        "error",
        err?.response?.data?.message ||
          err?.response?.data ||
          "Không thể tải ảnh lên"
      );
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#007fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {message !== "" && (
        <View
          style={[
            styles.toast,
            type === "success" ? styles.toastSuccess : styles.toastError,
          ]}
        >
          <Text style={styles.toastText}>{message}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.coverSection}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => pickImage("cover")}
          >
            <Image
              source={{ uri: cover || DEFAULT_COVER }}
              style={styles.coverImage}
              onError={(e) => {
                console.log("Cover load error:", e.nativeEvent);
                if (cover !== DEFAULT_COVER) {
                  setCover(DEFAULT_COVER);
                }
              }}
            />
          </TouchableOpacity>

          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.iconCircle}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={{ flexDirection: "row" }}>
              <TouchableOpacity style={styles.iconCircle}>
                <Ionicons name="time-outline" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.iconCircle, { marginLeft: 15 }]}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.profileInfoSection}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={() => pickImage("avatar")}>
              <Image
                source={{ uri: avatar || DEFAULT_AVATAR }}
                style={styles.avatarImg}
                onError={(e) => {
                  console.log("Avatar load error:", e.nativeEvent);
                  if (avatar !== DEFAULT_AVATAR) {
                    setAvatar(DEFAULT_AVATAR);
                  }
                }}
              />
            </TouchableOpacity>

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Trạng thái hiện tại</Text>
              <View style={styles.statusArrow} />
            </View>
          </View>

          <Text style={styles.userNameText}>{user?.username || "User"}</Text>

          <TouchableOpacity
            style={styles.editBioBtn}
            onPress={() => router.push("/profileInfo")}
          >
            <Feather name="edit-2" size={16} color="#00a3ff" />
            <Text style={styles.editBioText}>Cập nhật giới thiệu bản thân</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="image-outline" size={22} color="#1D9BF0" />
            <Text style={styles.actionText}>Ảnh</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="people-outline" size={22} color="#1D9BF0" />
            <Text style={styles.actionText}>Bạn bè</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="time-outline" size={22} color="#1D9BF0" />
            <Text style={styles.actionText}>Nhật ký</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Thông tin cá nhân</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || "Chưa có"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Số điện thoại</Text>
            <Text style={styles.infoValue}>{user?.phone || "Chưa có"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Giới tính</Text>
            <Text style={styles.infoValue}>{user?.gender || "Chưa có"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày sinh</Text>
            <Text style={styles.infoValue}>{user?.birthday || "Chưa có"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <MenuItem
            icon={
              <MaterialCommunityIcons
                name="account-edit-outline"
                size={22}
                color="#00a3ff"
              />
            }
            title="Chỉnh sửa thông tin cá nhân"
            onPress={() => router.push("/profileInfo")}
          />

          <MenuItem
            icon={
              <Ionicons name="lock-closed-outline" size={21} color="#00a3ff" />
            }
            title="Đổi mật khẩu"
            onPress={() => router.push("/changePassword")}
          />
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      <Modal
        visible={!!selectedAvatar}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAvatar(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Cập nhật avatar?</Text>

            {selectedAvatar && (
              <Image
                source={{ uri: selectedAvatar.uri }}
                style={styles.previewAvatar}
              />
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedAvatar(null)}
                disabled={isUploading}
              >
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => {
                  if (selectedAvatar) {
                    handleUpload(selectedAvatar, "avatar");
                  }
                }}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedCover}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCover(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Cập nhật ảnh bìa?</Text>

            {selectedCover && (
              <Image
                source={{ uri: selectedCover.uri }}
                style={styles.previewCover}
              />
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedCover(null)}
                disabled={isUploading}
              >
                <Text style={styles.cancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => {
                  if (selectedCover) {
                    handleUpload(selectedCover, "cover");
                  }
                }}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Lưu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type MenuItemProps = {
  icon: React.ReactNode;
  title: string;
  onPress?: () => void;
};

function MenuItem({ icon, title, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconContainer}>{icon}</View>
      <Text style={styles.menuTitle}>{title}</Text>
      <Feather name="chevron-right" size={18} color="#bbb" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f2f4",
  },

  loadingCenter: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  toast: {
    position: "absolute",
    top: 55,
    left: 20,
    right: 20,
    zIndex: 9999,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },

  toastSuccess: {
    backgroundColor: "#16A34A",
  },

  toastError: {
    backgroundColor: "#DC2626",
  },

  toastText: {
    color: "#fff",
    fontWeight: "700",
  },

  coverSection: {
    height: 250,
    backgroundColor: "#ddd",
  },

  coverImage: {
    width,
    height: 250,
    backgroundColor: "#ddd",
  },

  headerButtons: {
    position: "absolute",
    top: Platform.OS === "ios" ? 12 : 26,
    left: 15,
    right: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },

  profileInfoSection: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingBottom: 18,
  },

  avatarContainer: {
    marginTop: -58,
    alignItems: "center",
  },

  avatarImg: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#E5E7EB",
  },

  statusBadge: {
    position: "absolute",
    bottom: -4,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },

  statusText: {
    color: "#fff",
    fontSize: 12,
  },

  statusArrow: {
    position: "absolute",
    top: -5,
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(0,0,0,0.65)",
  },

  userNameText: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },

  editBioBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF6FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },

  editBioText: {
    marginLeft: 7,
    color: "#00a3ff",
    fontWeight: "700",
  },

  actionRow: {
    marginTop: 8,
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 14,
  },

  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  actionText: {
    marginTop: 6,
    color: "#111827",
    fontWeight: "600",
  },

  infoCard: {
    marginTop: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: "row",
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },

  infoLabel: {
    width: 120,
    color: "#6B7280",
    fontSize: 14,
  },

  infoValue: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },

  section: {
    marginTop: 8,
    backgroundColor: "#fff",
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },

  menuIconContainer: {
    width: 32,
    alignItems: "center",
  },

  menuTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#111827",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  previewBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
  },

  previewTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },

  previewAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#E5E7EB",
  },

  previewCover: {
    width: "100%",
    height: 170,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
  },

  previewActions: {
    width: "100%",
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },

  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    color: "#111827",
    fontWeight: "700",
  },

  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },

  saveText: {
    color: "#fff",
    fontWeight: "800",
  },
});
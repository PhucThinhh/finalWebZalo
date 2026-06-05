import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";

import {
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { getMeApi } from "../../src/features/user/api/userApi";

type MenuItemProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  showArrow?: boolean;
  onPress?: () => void;
};

const MenuItem = ({
  icon,
  title,
  subtitle,
  showArrow = true,
  onPress,
}: MenuItemProps) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIconContainer}>{icon}</View>

    <View style={styles.menuTextContainer}>
      <Text style={styles.menuTitle}>{title}</Text>
      {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
    </View>

    {showArrow && <Feather name="chevron-right" size={18} color="#bbb" />}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  // 🔥 CALL API
  const fetchUser = async () => {
  try {
    const res = await getMeApi();

    console.log("getMeApi profile response:", JSON.stringify(res, null, 2));

    setUser(res);
  } catch (err: any) {
    console.log("Lỗi lấy user:", err);
    console.log("Lỗi lấy user status:", err?.response?.status);
    console.log("Lỗi lấy user response:", err?.response?.data);
  }
};

  // 🔥 AUTO REFRESH KHI QUAY LẠI
  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [])
  );

  // 🔥 LOGOUT
  const handleLogout = async () => {
    Alert.alert("Xác nhận", "Bạn có muốn đăng xuất không?", [
      { text: "Huỷ" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem("token");
            router.replace("/login");
          } catch (err) {
            console.log("Lỗi logout:", err);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#00a3ff" barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <Ionicons name="search" size={22} color="#fff" />
        <TextInput
          placeholder="Tìm kiếm"
          placeholderTextColor="rgba(255,255,255,0.7)"
          style={styles.searchInput}
        />
        <Ionicons name="settings-outline" size={22} color="#fff" />
      </View>

      <ScrollView style={styles.content}>
        {/* USER */}
        <TouchableOpacity
          style={styles.userSection}
          onPress={() => router.push("/profile-detail")}
        >
          <Image
  source={{
    uri:
      user?.avatar ||
      "https://randomuser.me/api/portraits/men/32.jpg",
  }}
  style={styles.avatar}
  onError={(e) => {
    console.log("Avatar load error:", e.nativeEvent);
  }}
/>

          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.username || "User"}</Text>
            <Text style={styles.userSubtitle}>Xem trang cá nhân</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* SECTION 1 */}
        <View style={styles.section}>
          <MenuItem
            icon={
              <MaterialCommunityIcons
                name="cloud-outline"
                size={22}
                color="#00a3ff"
              />
            }
            title="zCloud"
            subtitle="Không gian lưu trữ dữ liệu trên đám mây"
          />
          <MenuItem
            icon={<Feather name="star" size={20} color="#7b61ff" />}
            title="zStyle – Nổi bật trên Zalo"
            subtitle="Hình nền và nhạc cho cuộc gọi"
          />
        </View>

        <View style={styles.divider} />

        {/* SECTION 2 */}
        <View style={styles.section}>
          <MenuItem
            icon={<Ionicons name="folder-outline" size={20} color="#00a3ff" />}
            title="My Documents"
          />
          <MenuItem
            icon={
              <Ionicons name="pie-chart-outline" size={20} color="#00a3ff" />
            }
            title="Dữ liệu trên máy"
          />
          <MenuItem
            icon={<Ionicons name="wallet-outline" size={20} color="#00a3ff" />}
            title="Ví QR"
          />
        </View>

        <View style={styles.divider} />

        {/* SECTION 3 */}
        <View style={styles.section}>
          <MenuItem
            icon={
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#00a3ff"
              />
            }
            title="Tài khoản và bảo mật"
          />
          <MenuItem
            icon={
              <Ionicons name="lock-closed-outline" size={20} color="#00a3ff" />
            }
            title="Đổi mật khẩu"
            onPress={() => router.push("/changePassword")}
          />
        </View>

        <View style={styles.divider} />

        {/* LOGOUT */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ff3b30" />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#00a3ff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    height: 55,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    marginLeft: 15,
  },
  content: {
    flex: 1,
    backgroundColor: "#f1f2f4",
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  avatarContainer: {},
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: "#eee",
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  userSubtitle: {
    fontSize: 13,
    color: "#777",
    marginTop: 3,
  },
  divider: {
    height: 8,
    backgroundColor: "#f1f2f4",
  },
  section: {
    backgroundColor: "#fff",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 15,
    paddingRight: 10,
  },
  menuIconContainer: {
    width: 30,
    alignItems: "center",
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 4,
  },
  menuTitle: {
    fontSize: 16,
    color: "#000",
  },
  menuSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 3,
  },
  arrowIcon: {
    marginLeft: 10,
  },

  // 🔥 LOGOUT STYLE
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  logoutText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#ff3b30",
    fontWeight: "500",
  },
});

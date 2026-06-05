import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  BellOff,
  ChevronUp,
  Crown,
  LogOut,
  Mic,
  MicOff,
  PhoneOff,
  Pin,
  Search,
  Settings,
  Shield,
  UserMinus,
  UserPlus,
  Users,
  Video,
} from "lucide-react";

import Sidebar from "../components/Sidebar";
import ChatBox from "../components/chatBox";
import ChatInput from "../components/ChatInput";
import CreateGroup from "../components/CreateGroup";
import AiAssistantBox from "../components/AiAssistantBox";

import FriendsList from "../../friend/components/FriendsList";
import FriendRequests from "../../friend/components/FriendRequests";
import FriendSearch from "../../friend/components/FriendSearch";

import useChat from "../hooks/useChat";
import useUser from "../hooks/useUser";

import ProfileModal from "../../user/components/ProfileModal";
import ChangePasswordModal from "../../user/components/ChangePasswordModal";
import { getUserInfoApi } from "../../user/api/userApi";
import CreatePollModal from "../components/CreatePollModal";

import useAudioCall from "../hooks/useAudioCall";

import {
  disconnectSocket,
  joinRoom,
  leaveRoom,
  subscribeOnlineList,
  subscribeConversationUpdates,
} from "../socket/socket";

import {
  deleteConversationApi,
  blockUserApi,
  getBlockStatusApi,
  unblockUserApi,
  getMyGroupsApi,
  addMemberApi,
  getGroupMembersApi,
  removeMemberApi,
  deleteGroupApi,
  updateRoleApi,
  transferOwnerApi,
  leaveGroupApi,
  markAsReadApi,
  getUnreadCountApi,
  getPrivateConversationsApi,
  uploadFileApi,
  updateGroupAvatarApi,
  updateGroupNameApi,
  updateChatBackgroundApi,
  getChatBackgroundApi,
  reactMessageApi,
  clearMessageReactionsApi,
  updateNicknameApi,
  getNicknameApi,
  pinMessageApi,
  unpinMessageApi,
  getPinnedMessagesApi,
  askAiAssistantApi,
} from "../api/chatApi";
import { getFriendsApi } from "../../friend/api/friendApi";

import {
  connectSocket,
  sendMessageSocket,
  subscribeGroupUpdates,
  subscribeUserStatus,
  subscribeCallSignal,
} from "../socket/socket";

import { getMessagesApi } from "../api/chatApi";

const DEFAULT_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="%231e293b"/><circle cx="32" cy="24" r="12" fill="%23e2e8f0"/><path d="M12 56c4-12 14-18 20-18s16 6 20 18" fill="%23e2e8f0"/></svg>';

function ChatPage() {
  const navigate = useNavigate();

  const { messages, setMessages, input, setInput, addMessage, messagesEndRef } =
    useChat();

  const { user, fetchUser } = useUser();

  const [activeTab, setActiveTab] = useState("chat");
  const [selectedUser, setSelectedUser] = useState(null);

  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollRealtimeMap, setPollRealtimeMap] = useState({});

  const [, setShowMenu] = useState(false);
  const [showPrivateInfoModal, setShowPrivateInfoModal] = useState(false);
  const [privateInfo, setPrivateInfo] = useState(null);
  const [privateInfoLoading, setPrivateInfoLoading] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [groupMemberCount, setGroupMemberCount] = useState(0);
  const [showViewMembersModal, setShowViewMembersModal] = useState(false);
  const [viewMembersList, setViewMembersList] = useState([]);
  const [viewMembersLoading, setViewMembersLoading] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showUpdateRoleModal, setShowUpdateRoleModal] = useState(false);
  const [showTransferOwnerModal, setShowTransferOwnerModal] = useState(false);
  const [friendCandidates, setFriendCandidates] = useState([]);
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [roleCandidates, setRoleCandidates] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [selectedRoleUserId, setSelectedRoleUserId] = useState(null);
  const [selectedRoleValue, setSelectedRoleValue] = useState("MEMBER");
  const [currentGroupRole, setCurrentGroupRole] = useState("MEMBER");
  const [ownerTransferCandidates, setOwnerTransferCandidates] = useState([]);
  const [selectedOwnerTransferId, setSelectedOwnerTransferId] = useState(null);

  const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [chatBackground, setChatBackground] = useState("");
  const [backgroundShared, setBackgroundShared] = useState(false);

  const [forwardMessage, setForwardMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState(null);

  const [forwardSearch, setForwardSearch] = useState("");
  const [forwardTargets, setForwardTargets] = useState([]);
  const [selectedForwardTargets, setSelectedForwardTargets] = useState([]);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isRemovedFromGroup, setIsRemovedFromGroup] = useState(false);

  const [joinedGroupRooms, setJoinedGroupRooms] = useState([]);
  const groupConversationByRoomRef = useRef(new Map());

  const [removedGroupRooms, setRemovedGroupRooms] = useState(new Set());
  const removedGroupRoomsRef = useRef(new Set());

  const [showPinnedList, setShowPinnedList] = useState(false);

  const [blockStatus, setBlockStatus] = useState({
    blockedByMe: false,
    blockedByOther: false,
  });

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [mutedConversationIds, setMutedConversationIds] = useState(new Set());
  const [pinnedConversationIds, setPinnedConversationIds] = useState(new Set());

  const currentUserId = user?.id || user?._id;
  const selectedGroupRef = useRef(null);
  const currentUserIdRef = useRef(null);

  const [friendNickname, setFriendNickname] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);

  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);

  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  

  const conversationStorageKey = useMemo(() => {
    if (!currentUserId) return null;
    return `chat_conversations_${currentUserId}`;
  }, [currentUserId]);

  const mutedStorageKey = useMemo(() => {
    if (!currentUserId) return null;
    return `chat_muted_conversations_${currentUserId}`;
  }, [currentUserId]);

  const pinnedConversationStorageKey = useMemo(() => {
    if (!currentUserId) return null;
    return `chat_pinned_conversations_${currentUserId}`;
  }, [currentUserId]);

  const resolveAvatar = (avatar) => {
    if (!avatar) return DEFAULT_AVATAR;
    if (avatar.startsWith("data:image")) return avatar;
    if (avatar.startsWith("http")) return avatar;
    return `http://localhost:8080${avatar}`;
  };

  const buildLastMessageText = (msg) => {
    if (!msg) return "";

    if (msg.type === "SYSTEM") {
      return msg.content || "Có cập nhật trong đoạn chat";
    }

    if (msg.type === "CALL") {
      return msg.content || "Cuộc gọi";
    }

    const isMe = Number(msg.senderId) === Number(currentUserId);

    if (msg.isRecalled) {
      return isMe ? "Bạn đã thu hồi tin nhắn" : "Tin nhắn đã được thu hồi";
    }

    let text = "";

    if (msg.type === "FILE") {
      if (msg.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        text = "Đã gửi một ảnh";
      } else if (msg.fileUrl?.endsWith(".pdf")) {
        text = "Đã gửi một PDF";
      } else {
        text = "Đã gửi một tệp";
      }
    } else if (msg.type === "FORWARD") {
      text = msg.originalContent
        ? `Đã chuyển tiếp: ${msg.originalContent}`
        : "Đã chuyển tiếp một tin nhắn";
    } else {
      text = msg.content || msg.text || "";
    }

    if (!text) return "";

    if (isMe) {
      return `Bạn: ${text}`;
    }

    // Nếu là group thì backend đã có senderName
    if (String(msg.roomId || "").startsWith("group_") && msg.senderName) {
      return `${msg.senderName}: ${text}`;
    }

    return text;
  };

  const getFriendId = (friend) =>
    Number(friend?.userId ?? friend?.friendId ?? friend?.id);

  const getFriendName = (friend) =>
    friend?.username || friend?.name || `User ${getFriendId(friend)}`;

  const getMemberRole = (member) =>
    String(member?.role || "MEMBER").toUpperCase();

  const memberRoleLabel = (role) => {
    const r = String(role || "MEMBER").toUpperCase();
    if (r === "OWNER") return "Chủ nhóm";
    if (r === "ADMIN") return "Phó nhóm";
    return "Thành viên";
  };

  /** Backend GET /chat/group/members → GroupMemberDTO: userId, username, avatar, role */
  const enrichMemberFromDto = (m, friendById) => {
    const memberId = Number(m?.userId ?? m?.user_id ?? m?.id);
    if (!Number.isFinite(memberId) || memberId <= 0) return null;

    const friendInfo = friendById?.get?.(memberId);

    const nameFromDto = String(
      m?.username ?? m?.userName ?? m?.name ?? ""
    ).trim();

    const avatarRaw = m?.avatar ?? m?.Avatar;

    const avatarFromDto =
      avatarRaw && String(avatarRaw).trim() !== ""
        ? String(avatarRaw).trim()
        : null;

    const isMe = Number(memberId) === Number(currentUserId);

    return {
      id: memberId,
      userId: memberId,

      // 🔥 FIX QUAN TRỌNG
      username: isMe
        ? user?.username || "Bạn" // 👈 lấy từ useUser()
        : friendInfo?.username ||
          (nameFromDto && !/^User\s+\d+$/i.test(nameFromDto)
            ? nameFromDto
            : `User ${memberId}`),

      avatar: isMe
        ? user?.avatar || avatarFromDto
        : friendInfo?.avatar ?? avatarFromDto ?? null,

      role: getMemberRole(m),
    };
  };

  const loadGroupMemberRows = async (groupId = selectedGroup?.id) => {
    if (!groupId) return [];

    const [friendsRes, membersRes] = await Promise.all([
      getFriendsApi(),
      getGroupMembersApi(groupId),
    ]);

    const friends = Array.isArray(friendsRes.data) ? friendsRes.data : [];
    const members = Array.isArray(membersRes.data) ? membersRes.data : [];
    const friendById = new Map(
      friends.map((friend) => [getFriendId(friend), friend])
    );

    return members.map((m) => enrichMemberFromDto(m, friendById)).filter(Boolean);
  };

  const sortConversationsByLatest = (list) => {
    return [...list].sort((a, b) => {
      const pinnedA = pinnedConversationIds.has(a.id);
      const pinnedB = pinnedConversationIds.has(b.id);

      if (pinnedA !== pinnedB) {
        return pinnedA ? -1 : 1;
      }

      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;

      return timeB - timeA;
    });
  };

  const upsertConversation = (conversation) => {
    setConversations((prev) => {
      const nextConversation = {
        ...conversation,
        lastMessageAt: conversation.lastMessageAt || new Date().toISOString(),
      };

      const existed = prev.find((item) => item.id === nextConversation.id);

      const next = existed
        ? [
            { ...existed, ...nextConversation },
            ...prev.filter((item) => item.id !== nextConversation.id),
          ]
        : [nextConversation, ...prev];

      return sortConversationsByLatest(next);
    });
  };

  const moveConversationToTop = (
    targetRoomId,
    latestAt = null,
    latestMsg = null
  ) => {
    if (!targetRoomId) return;

    setConversations((prev) => {
      const index = prev.findIndex((item) => item.roomId === targetRoomId);
      if (index < 0) return prev;

      const matched = {
        ...prev[index],
        lastMessageAt: latestAt || new Date().toISOString(),
        lastMessageText: latestMsg
          ? buildLastMessageText(latestMsg)
          : prev[index].lastMessageText,
      };

      const next = [matched, ...prev.filter((_, i) => i !== index)];

      return sortConversationsByLatest(next);
    });
  };

  const applyConversationMeta = async (conversationList) => {
    if (!Array.isArray(conversationList) || conversationList.length === 0) {
      return conversationList;
    }

    const updated = await Promise.all(
      conversationList.map(async (conversation) => {
        if (!conversation.roomId) return conversation;

        let unreadCount = Number(conversation.unreadCount || 0);
        let lastMessageAt = conversation.lastMessageAt || null;
        let lastMessageText = conversation.lastMessageText || "";

        try {
          const unreadRes = await getUnreadCountApi(conversation.roomId);
          unreadCount = Number(unreadRes.data || 0);
        } catch (error) {
          console.log("Get unread count lỗi:", error);
        }

        try {
          const msgRes = await getMessagesApi(conversation.roomId);
          const messageList = Array.isArray(msgRes.data) ? msgRes.data : [];

          if (messageList.length > 0) {
            const lastMessage = messageList[messageList.length - 1];

            lastMessageAt = lastMessage.createdAt || lastMessageAt;
            lastMessageText = buildLastMessageText(lastMessage);
          } else {
            // Nếu là chat cá nhân mà không còn tin nhắn nào sau khi xoá hội thoại
            // thì không cho hiện lại trên sidebar
            if (conversation.type === "PRIVATE") {
              return null;
            }
          }
        } catch (error) {
          console.log("Get last message lỗi:", error);
        }

        return {
          ...conversation,
          unreadCount,
          lastMessageAt,
          lastMessageText,
        };
      })
    );

    return sortConversationsByLatest(updated.filter(Boolean));
  };

  const handleForwardClick = async (msg) => {
    setForwardMessage(msg);
    setForwardSearch("");
    setSelectedForwardTargets([]);

    try {
      const friendsRes = await getFriendsApi();
      const friends = Array.isArray(friendsRes.data) ? friendsRes.data : [];

      const friendTargets = friends
        .map((friend) => {
          const id = getFriendId(friend);

          if (!id || Number(id) === Number(currentUserId)) {
            return null;
          }

          return {
            id,
            type: "PRIVATE",
            name: getFriendName(friend),
            avatar: resolveAvatar(friend.avatar),
            targetUser: {
              id,
              username: getFriendName(friend),
              avatar: friend.avatar,
            },
          };
        })
        .filter(Boolean);

      const groupTargets = conversations
        .filter((conversation) => conversation.type === "GROUP")
        .map((conversation) => ({
          id:
            conversation.targetGroup?.id ||
            String(conversation.id || "").replace("group_", ""),
          type: "GROUP",
          name: conversation.name,
          avatar: conversation.avatar,
          roomId: conversation.roomId,
          targetGroup: conversation.targetGroup,
        }))
        .filter((item) => item.id);

      const map = new Map();

      [...friendTargets, ...groupTargets].forEach((item) => {
        const key = `${item.type}_${item.id}`;
        map.set(key, item);
      });

      setForwardTargets(Array.from(map.values()));
      setShowForwardModal(true);
    } catch (error) {
      console.error("Load danh sách forward lỗi:", error);
      toast.error("Không tải được danh sách chuyển tiếp");
    }
  };

  const toggleForwardTarget = (target) => {
    const key = `${target.type}_${target.id}`;

    setSelectedForwardTargets((prev) => {
      const existed = prev.some((item) => `${item.type}_${item.id}` === key);

      if (existed) {
        return prev.filter((item) => `${item.type}_${item.id}` !== key);
      }

      if (prev.length >= 100) {
        toast.warning("Chỉ có thể chọn tối đa 100 người/nhóm");
        return prev;
      }

      return [...prev, target];
    });
  };

  const handleForwardToSelected = () => {
    if (!forwardMessage || selectedForwardTargets.length === 0) return;

    const forwardContent =
      forwardMessage.originalContent ||
      forwardMessage.content ||
      forwardMessage.text ||
      "";

    selectedForwardTargets.forEach((target) => {
      const isGroupTarget = target.type === "GROUP";

      const newRoomId = isGroupTarget
        ? `group_${target.id}`
        : [Number(currentUserId), Number(target.id)]
            .sort((a, b) => a - b)
            .join("_");

      const msg = {
        senderId: Number(currentUserId),
        receiverId: isGroupTarget ? null : Number(target.id),
        roomId: newRoomId,

        content: forwardContent,
        fileUrl: forwardMessage.fileUrl || null,

        type: forwardMessage.type === "FILE" ? "FILE" : "FORWARD",

        originalSenderId:
          forwardMessage.originalSenderId || forwardMessage.senderId,
        originalContent: forwardContent,
        originalMessageId:
          forwardMessage.originalMessageId || forwardMessage.id,
      };

      sendMessageSocket(msg);

      upsertConversation({
        id: isGroupTarget ? `group_${target.id}` : `private_${newRoomId}`,
        type: isGroupTarget ? "GROUP" : "PRIVATE",
        name: target.name,
        avatar: target.avatar,
        roomId: newRoomId,
        unreadCount: 0,
        lastMessageAt: new Date().toISOString(),
        lastMessageText: "Bạn: Đã chuyển tiếp một tin nhắn",
        targetUser: isGroupTarget ? null : target.targetUser,
        targetGroup: isGroupTarget ? target.targetGroup || target : null,
      });
    });

    toast.success(`Đã chuyển tiếp đến ${selectedForwardTargets.length} nơi`);

    setShowForwardModal(false);
    setForwardMessage(null);
    setForwardSearch("");
    setForwardTargets([]);
    setSelectedForwardTargets([]);
  };

  const handleOpenLeaveGroupConfirm = async () => {
    if (!selectedGroup?.id || !currentUserId) return;

    try {
      const rows = await loadGroupMemberRows(selectedGroup.id);
      const me = rows.find((member) => member.id === Number(currentUserId));
      const others = rows.filter(
        (member) => member.id && member.id !== Number(currentUserId)
      );

      setCurrentGroupRole(me?.role || "MEMBER");

      if (me?.role === "OWNER") {
        setOwnerTransferCandidates(others);
        setSelectedOwnerTransferId(null);
      } else {
        setOwnerTransferCandidates([]);
        setSelectedOwnerTransferId(null);
      }
    } catch (error) {
      console.log("Load leave group members lỗi:", error);
      toast.error("Không tải được danh sách thành viên");
      return;
    }

    setShowLeaveConfirmModal(true);
  };

  const handleConfirmLeaveGroup = async () => {
    if (!selectedGroup?.id || !currentUserId) return;

    try {
      setLeavingGroup(true);

      const rows = await loadGroupMemberRows(selectedGroup.id);
      const me = rows.find((member) => member.id === Number(currentUserId));
      const isOwnerNow = me?.role === "OWNER";
      const activeOtherMembers = rows.filter(
        (member) => member.id && member.id !== Number(currentUserId)
      );

      setCurrentGroupRole(me?.role || "MEMBER");

      let newOwnerId = null;

      if (isOwnerNow && activeOtherMembers.length > 0) {
        newOwnerId = selectedOwnerTransferId;

        if (!newOwnerId) {
          toast.error("Bạn cần chọn thành viên nhận quyền trưởng nhóm trước khi rời nhóm");
          return;
        }

        const target = activeOtherMembers.find(
          (member) => Number(member.id) === Number(newOwnerId)
        );

        if (!target || Number(target.id) === Number(currentUserId)) {
          toast.error("Thành viên nhận quyền không hợp lệ");
          return;
        }

        newOwnerId = Number(target.id);
      }

      await leaveGroupApi(selectedGroup.id, Number(currentUserId), newOwnerId);

      setIsRemovedFromGroup(true);
      setShowLeaveConfirmModal(false);
      setShowGroupMenu(false);
      setInfoPanelOpen(false);

      toast.success("Đã rời nhóm");
    } catch (error) {
      const message = error?.response?.data || "Rời nhóm thất bại";

      if (String(message).includes("Truong nhom") || String(message).includes("Chủ nhóm")) {
        toast.error("Bạn phải chọn trưởng nhóm mới trước khi rời nhóm");
        return;
      }

      toast.error(message);
    } finally {
      setLeavingGroup(false);
    }
  };

  const handleChangeGroupAvatar = async (e) => {
    const file = e.target.files?.[0];

    if (!file || !selectedGroup?.id || !currentUserId) return;

    try {
      const uploadRes = await uploadFileApi(file);

      const avatarUrl =
        uploadRes.data?.url ||
        uploadRes.data?.fileUrl ||
        uploadRes.data?.path ||
        uploadRes.data;

      if (!avatarUrl) {
        toast.error("Upload ảnh thất bại");
        return;
      }

      const res = await updateGroupAvatarApi(
        selectedGroup.id,
        avatarUrl,
        Number(currentUserId)
      );

      const newAvatar = res.data?.avatar || avatarUrl;

      setSelectedGroup((prev) =>
        prev
          ? {
              ...prev,
              avatar: newAvatar,
            }
          : prev
      );

      setConversations((prev) =>
        prev.map((item) =>
          item.id === `group_${selectedGroup.id}`
            ? {
                ...item,
                avatar: resolveAvatar(newAvatar),
                targetGroup: {
                  ...item.targetGroup,
                  avatar: newAvatar,
                },
              }
            : item
        )
      );

      toast.success("Đã đổi ảnh nhóm");
    } catch (error) {
      console.error("Đổi ảnh nhóm lỗi:", error);
      toast.error(error?.response?.data || "Đổi ảnh nhóm thất bại");
    } finally {
      e.target.value = "";
    }
  };

  const handleOpenRenameGroupModal = () => {
    if (!selectedGroup?.id) return;

    setNewGroupName(selectedGroup.name || "");
    setShowRenameGroupModal(true);
  };

  const handleUpdateGroupName = async () => {
    if (!selectedGroup?.id || !currentUserId) return;

    const name = newGroupName.trim();

    if (!name) {
      toast.error("Tên nhóm không được để trống");
      return;
    }

    try {
      setRenamingGroup(true);

      const res = await updateGroupNameApi(
        selectedGroup.id,
        name,
        Number(currentUserId)
      );

      const updatedName = res.data?.name || name;

      setSelectedGroup((prev) =>
        prev
          ? {
              ...prev,
              name: updatedName,
            }
          : prev
      );

      setConversations((prev) =>
        prev.map((item) =>
          item.id === `group_${selectedGroup.id}`
            ? {
                ...item,
                name: updatedName,
                targetGroup: {
                  ...item.targetGroup,
                  name: updatedName,
                },
              }
            : item
        )
      );

      setShowRenameGroupModal(false);
      toast.success("Đã đổi tên nhóm");
    } catch (error) {
      console.error("Đổi tên nhóm lỗi:", error);
      toast.error(error?.response?.data || "Đổi tên nhóm thất bại");
    } finally {
      setRenamingGroup(false);
    }
  };

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedGroup?.id || !currentUserId) {
      setCurrentGroupRole("MEMBER");
      setOwnerTransferCandidates([]);
      setSelectedOwnerTransferId(null);
      return;
    }

    let cancelled = false;

    const syncCurrentGroupRole = async () => {
      try {
        const rows = await loadGroupMemberRows(selectedGroup.id);
        if (cancelled) return;

        const me = rows.find((member) => member.id === Number(currentUserId));
        const otherMembers = rows.filter(
          (member) => member.id && member.id !== Number(currentUserId)
        );

        setCurrentGroupRole(me?.role || "MEMBER");
        setGroupMemberCount(rows.length);
        setOwnerTransferCandidates(otherMembers);
        setSelectedOwnerTransferId(otherMembers[0]?.id ?? null);
      } catch (error) {
        console.log("Load group role lỗi:", error);
        if (!cancelled) {
          setCurrentGroupRole("MEMBER");
          setOwnerTransferCandidates([]);
          setSelectedOwnerTransferId(null);
        }
      }
    };

    syncCurrentGroupRole();

    return () => {
      cancelled = true;
    };
  }, [selectedGroup?.id, currentUserId]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    removedGroupRoomsRef.current = removedGroupRooms;
  }, [removedGroupRooms]);

  useEffect(() => {
    if (!currentUserId) return;

    const fetchPrivateConversations = async () => {
      try {
        const res = await getPrivateConversationsApi();

        const privateConversationsRaw = Array.isArray(res.data)
          ? res.data.map((item) => ({
              id: item.id,
              type: "PRIVATE",
              name: item.name,
              avatar: resolveAvatar(item.avatar),
              roomId: item.roomId,
              unreadCount: Number(item.unreadCount || 0),
              lastMessageAt: item.lastMessageAt,
              lastMessageText: item.lastMessageText || "",
              targetUser: {
                id: item.targetUser?.id,
                username: item.targetUser?.username,
                avatar: item.targetUser?.avatar,
              },
            }))
          : [];

        const privateConversations = await applyConversationMeta(
          privateConversationsRaw
        );

        setConversations((prev) => {
          const groupConversations = prev.filter((c) => c.type === "GROUP");

          return sortConversationsByLatest([
            ...groupConversations,
            ...privateConversations,
          ]);
        });
      } catch (error) {
        console.error("Load private conversations lỗi:", error);
      }
    };

    fetchPrivateConversations();
  }, [currentUserId]);

  useEffect(() => {
    if (!conversationStorageKey) return;

    try {
      const saved = localStorage.getItem(conversationStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setConversations(parsed);
        }
      }
    } catch (error) {
      console.log("Load conversations localStorage lỗi:", error);
    }
  }, [conversationStorageKey]);

  useEffect(() => {
    if (!conversationStorageKey) return;

    try {
      localStorage.setItem(
        conversationStorageKey,
        JSON.stringify(conversations)
      );
    } catch (error) {
      console.log("Save conversations localStorage lỗi:", error);
    }
  }, [conversations, conversationStorageKey]);

  useEffect(() => {
    if (!mutedStorageKey) return;

    try {
      const saved = localStorage.getItem(mutedStorageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setMutedConversationIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch (error) {
      console.log("Load muted conversations lỗi:", error);
      setMutedConversationIds(new Set());
    }
  }, [mutedStorageKey]);

  useEffect(() => {
    if (!mutedStorageKey) return;

    localStorage.setItem(
      mutedStorageKey,
      JSON.stringify(Array.from(mutedConversationIds))
    );
  }, [mutedConversationIds, mutedStorageKey]);

  useEffect(() => {
    if (!pinnedConversationStorageKey) return;

    try {
      const saved = localStorage.getItem(pinnedConversationStorageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setPinnedConversationIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch (error) {
      console.log("Load pinned conversations lỗi:", error);
      setPinnedConversationIds(new Set());
    }
  }, [pinnedConversationStorageKey]);

  useEffect(() => {
    if (!pinnedConversationStorageKey) return;

    localStorage.setItem(
      pinnedConversationStorageKey,
      JSON.stringify(Array.from(pinnedConversationIds))
    );
    setConversations((prev) => sortConversationsByLatest(prev));
  }, [pinnedConversationIds, pinnedConversationStorageKey]);

  useEffect(() => {
    if (!user?.id) return;

    let statusSub = null;
    let listSub = null;
    let groupSub = null;
    let conversationSub = null;

    const userId = Number(user.id);

    const syncMyGroups = async (focusGroupId = null) => {
      try {
        const res = await getMyGroupsApi(userId);

        const groupConversationsRaw = res.data.map((group) => ({
          id: `group_${group.id}`,
          type: "GROUP",
          name: group.name,
          avatar: resolveAvatar(group.avatar),
          roomId: `group_${group.id}`,
          unreadCount: 0,
          lastMessageAt: null,
          targetGroup: {
            id: group.id,
            name: group.name,
            avatar: group.avatar,
          },
        }));

        const groupConversations = await applyConversationMeta(
          groupConversationsRaw
        );
        groupConversationByRoomRef.current = new Map(
          groupConversations.map((group) => [group.roomId, group])
        );

        setJoinedGroupRooms(groupConversations.map((group) => group.roomId));

        setConversations((prev) => {
          const privateConversations = prev.filter((c) => c.type !== "GROUP");

          const prevUnread = new Map(
            prev
              .filter((c) => c.type === "GROUP")
              .map((c) => [c.id, Number(c.unreadCount || 0)])
          );

          const mergedGroups = groupConversations.map((g) => ({
            ...g,
            unreadCount: g.unreadCount ?? prevUnread.get(g.id) ?? 0,
          }));

          let merged = [...mergedGroups, ...privateConversations];

          if (focusGroupId) {
            const targetRoomId = `group_${focusGroupId}`;

            merged = merged.map((item) =>
              item.roomId === targetRoomId
                ? {
                    ...item,
                    lastMessageAt: new Date().toISOString(),
                  }
                : item
            );
          }

          return sortConversationsByLatest(merged);
        });
      } catch (err) {
        console.error("Sync group realtime lỗi:", err);
      }
    };

    connectSocket(user.id, () => {
      conversationSub = subscribeConversationUpdates(
        userId,
        async (message) => {
          if (!message?.roomId) return;

          const privateRoomId = message.roomId;

          // Chỉ xử lý chat cá nhân
          if (String(privateRoomId).startsWith("group_")) return;

          const conversationId = `private_${privateRoomId}`;

          const senderId = Number(message.senderId);
          const receiverId = Number(message.receiverId);

          const otherUserId =
            senderId === Number(currentUserId) ? receiverId : senderId;

          if (!otherUserId) return;

          try {
            const res = await getUserInfoApi(otherUserId);
            const otherUser = res.data;

            upsertConversation({
              id: conversationId,
              type: "PRIVATE",
              name: otherUser.username,
              avatar: resolveAvatar(otherUser.avatar),
              roomId: privateRoomId,
              unreadCount: selectedConversationId === conversationId ? 0 : 1,
              lastMessageAt: message.createdAt || new Date().toISOString(),
              lastMessageText: buildLastMessageText(message),
              targetUser: {
                id: otherUser.id,
                username: otherUser.username,
                avatar: otherUser.avatar,
              },
            });
          } catch (error) {
            console.log("Load conversation user info lỗi:", error);
          }
        }
      );
      listSub = subscribeOnlineList((list) => {
        console.log("👥 LIST:", list);
        const newSet = new Set(list.map((id) => Number(id)));
        setOnlineUsers(newSet);
      });

      statusSub = subscribeUserStatus((data) => {
        console.log("🔥 STATUS:", data);

        setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          const userId = Number(data.userId);

          if (data.status === "ONLINE") {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }

          return newSet;
        });
      });

      syncMyGroups();
      groupSub = subscribeGroupUpdates(userId, (event) => {
        const action = String(event?.action || "");
        const groupId = String(event?.groupId || "").trim();
        const roomId = groupId ? `group_${groupId}` : null;
        if (
          (action === "GROUP_MEMBER_REMOVED" ||
            action === "GROUP_MEMBER_ADDED") &&
          roomId
        ) {
          const activeGroup = selectedGroupRef.current;
          const myId = Number(currentUserIdRef.current);

          const isCurrentOpeningGroup =
            activeGroup && String(activeGroup.id) === String(groupId);

          getGroupMembersApi(groupId)
            .then((res) => {
              const memberIds = Array.isArray(res.data)
                ? res.data.map((m) => Number(m?.userId)).filter(Boolean)
                : [];

              const stillInGroup = memberIds.includes(myId);

              setGroupMemberCount(memberIds.length);

              if (isCurrentOpeningGroup) {
                setIsRemovedFromGroup(!stillInGroup);

                if (!stillInGroup) {
                  // đánh dấu room này đã bị kick
                  setRemovedGroupRooms((prev) => {
                    const next = new Set(prev);
                    next.add(roomId);
                    return next;
                  });

                  // rời socket room
                  leaveRoom(roomId);

                  setShowGroupMenu(false);
                  setShowViewMembersModal(false);
                  setShowAddMemberModal(false);
                  setShowRemoveMemberModal(false);
                  setShowUpdateRoleModal(false);
                  setShowRenameGroupModal(false);

                  toast.warning(
                    "Bạn đã bị xoá khỏi nhóm và không thể trả lời cuộc trò chuyện này"
                  );
                }
              } else if (action === "GROUP_MEMBER_ADDED") {
                setRemovedGroupRooms((prev) => {
                  const next = new Set(prev);
                  next.delete(roomId);
                  return next;
                });

                toast.success("Bạn đã được thêm lại vào nhóm");
              }
            })
            .catch(() => {
              if (isCurrentOpeningGroup) {
                setIsRemovedFromGroup(true);

                setShowGroupMenu(false);
                setShowViewMembersModal(false);
                setShowAddMemberModal(false);
                setShowRemoveMemberModal(false);
                setShowUpdateRoleModal(false);
                setShowRenameGroupModal(false);
              }
            });
        }

        if (action === "GROUP_AVATAR_UPDATED" && event?.avatar && roomId) {
          setConversations((prev) =>
            prev.map((item) =>
              item.roomId === roomId
                ? {
                    ...item,
                    avatar: resolveAvatar(event.avatar),
                    targetGroup: {
                      ...item.targetGroup,
                      avatar: event.avatar,
                    },
                  }
                : item
            )
          );

          setSelectedGroup((prev) =>
            prev && String(prev.id) === String(groupId)
              ? {
                  ...prev,
                  avatar: event.avatar,
                }
              : prev
          );
        }

        if (action === "GROUP_NAME_UPDATED" && event?.groupName && roomId) {
          setConversations((prev) =>
            prev.map((item) =>
              item.roomId === roomId
                ? {
                    ...item,
                    name: event.groupName,
                    targetGroup: {
                      ...item.targetGroup,
                      name: event.groupName,
                    },
                  }
                : item
            )
          );

          setSelectedGroup((prev) =>
            prev && String(prev.id) === String(groupId)
              ? {
                  ...prev,
                  name: event.groupName,
                }
              : prev
          );
        }

        syncMyGroups(groupId || null);
        if (roomId) {
          moveConversationToTop(roomId);
        }

        const actionMessage = {
          GROUP_CREATED: "Bạn vừa được thêm vào một nhóm mới",
          GROUP_MEMBER_ADDED: "Bạn vừa được thêm vào nhóm",
          GROUP_MEMBER_REMOVED: "Bạn đã rời nhóm / bị xoá khỏi nhóm",
          GROUP_DELETED: "Nhóm đã được giải tán",
          GROUP_AVATAR_UPDATED: "Ảnh nhóm đã được cập nhật",
          GROUP_NAME_UPDATED: "Tên nhóm đã được cập nhật",
        }[action];

        if (actionMessage) {
          toast.info(actionMessage);
        }
      });
    });

    return () => {
      statusSub?.unsubscribe();
      listSub?.unsubscribe();
      groupSub?.unsubscribe();
      conversationSub?.unsubscribe();
    };
  }, [user?.id]);

  const roomId = useMemo(() => {
    if (selectedGroup) {
      return `group_${selectedGroup.id}`;
    }

    if (!currentUserId || (!selectedUser && !selectedGroup)) return null;

    return [Number(currentUserId), Number(selectedUser.id)]
      .sort((a, b) => a - b)
      .join("_");
  }, [currentUserId, selectedUser, selectedGroup]);

  const handleSendCallMessage = ({ status, durationText }) => {
    if (!roomId || !currentUserId || !selectedUser?.id) return;

    const statusText = {
      ENDED: "Cuộc gọi thoại đi",
      MISSED: "Cuộc gọi nhỡ",
      REJECTED: "Cuộc gọi đã bị từ chối",
    }[status];

    const content =
      status === "ENDED" ? `${statusText} · ${durationText}` : statusText;

    const msg = {
      senderId: Number(currentUserId),
      receiverId: Number(selectedUser.id),
      roomId,
      content,
      type: "CALL",
      callStatus: status,
      callType: "AUDIO",
      callDuration: durationText,
    };

    sendMessageSocket(msg);
  };

  const {
    incomingCall,
    callStatus,
    remoteAudioRef,

    isMicMuted,
    callTimeText,

    startAudioCall,
    acceptCall,
    rejectCall,
    endCall,

    toggleMic,
    toggleCameraPlaceholder,

    handleCallSignal,
  } = useAudioCall({
    roomId,
    currentUserId,
    selectedUser,
    selectedGroup,
    user,
    onCallMessage: handleSendCallMessage,
  });

  useEffect(() => {
    if (!roomId) {
      setPinnedMessages([]);
      return;
    }

    const loadPinnedMessages = async () => {
      try {
        const res = await getPinnedMessagesApi(roomId);

        setPinnedMessages(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.log("Load pinned messages lỗi:", error);
        setPinnedMessages([]);
      }
    };

    loadPinnedMessages();
  }, [roomId]);

  const loadPrivateNickname = async (targetRoomId, targetUserId) => {
    if (!targetRoomId || !targetUserId) {
      setFriendNickname("");
      setNicknameInput("");
      return;
    }

    try {
      const res = await getNicknameApi(targetRoomId, targetUserId);

      const nickname = res.data?.nickname || "";

      setFriendNickname(nickname);
      setNicknameInput(nickname);
    } catch (error) {
      console.log("Load biệt danh lỗi:", error);
      setFriendNickname("");
      setNicknameInput("");
    }
  };

  

  const handleUpdateNickname = async (overrideNickname = null) => {
    if (!roomId || !selectedUser?.id) return;

    try {
      setSavingNickname(true);

      const res = await updateNicknameApi(
        roomId,
        selectedUser.id,
        overrideNickname !== null ? overrideNickname : nicknameInput
      );

      const newNickname = res.data?.nickname || "";

      setFriendNickname(newNickname);
      setNicknameInput(newNickname);

      setConversations((prev) =>
        prev.map((item) =>
          item.roomId === roomId
            ? {
                ...item,
                name:
                  newNickname ||
                  item.targetUser?.username ||
                  selectedUser.username,
              }
            : item
        )
      );

      setShowNicknameModal(false);
      toast.success(newNickname ? "Đã đổi biệt danh" : "Đã xoá biệt danh");
    } catch (error) {
      console.error("Đổi biệt danh lỗi:", error);
      toast.error(error?.response?.data || "Đổi biệt danh thất bại");
    } finally {
      setSavingNickname(false);
    }
  };

  const handlePinMessage = async (messageId) => {
    if (!messageId) return;

    try {
      const res = await pinMessageApi(messageId);
      const pinned = res.data;

      setPinnedMessages((prev) => {
        const existed = prev.some(
          (m) => String(m.id || m._id) === String(pinned.id || pinned._id)
        );

        if (existed) {
          return prev.map((m) =>
            String(m.id || m._id) === String(pinned.id || pinned._id)
              ? pinned
              : m
          );
        }

        return [pinned, ...prev];
      });

      setMessages((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === String(messageId)
            ? {
                ...m,
                pinned: true,
                pinnedBy: currentUserId,
                pinnedAt: new Date().toISOString(),
              }
            : m
        )
      );

      toast.success("Đã ghim tin nhắn");
    } catch (error) {
      console.error("Ghim tin nhắn lỗi:", error);
      toast.error(error?.response?.data || "Ghim tin nhắn thất bại");
    }
  };


  const reloadCurrentRoom = async () => {
    if (!roomId) return;

    try {
      const res = await getMessagesApi(roomId);

      const history = Array.isArray(res.data)
        ? res.data.map((msg) => ({
            id: msg.id || msg._id,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            roomId: msg.roomId,

            content: msg.content,
            createdAt: msg.createdAt,
            deletedBy: msg.deletedBy,
            isRecalled: msg.isRecalled,

            fileUrl: msg.fileUrl,
            type: msg.type,

            originalSenderId: msg.originalSenderId,
            originalContent: msg.originalContent,
            originalMessageId: msg.originalMessageId,

            senderName: msg.senderName,
            senderAvatar: msg.senderAvatar,

            reactions: Array.isArray(msg.reactions) ? msg.reactions : [],

            pinned: msg.pinned,
            pinnedBy: msg.pinnedBy,
            pinnedAt: msg.pinnedAt,

            pollId: msg.pollId,
          }))
        : [];

      setMessages(history);

      const pinnedRes = await getPinnedMessagesApi(roomId);
      setPinnedMessages(Array.isArray(pinnedRes.data) ? pinnedRes.data : []);
    } catch (error) {
      console.log("Reload room sau khi tạo bình chọn lỗi:", error);
    }
  };
  const handleUnpinMessage = async (messageId) => {
    if (!messageId) return;

    try {
      await unpinMessageApi(messageId);

      setPinnedMessages((prev) =>
        prev.filter((m) => String(m.id || m._id) !== String(messageId))
      );

      setMessages((prev) =>
        prev.map((m) =>
          String(m.id || m._id) === String(messageId)
            ? {
                ...m,
                pinned: false,
                pinnedBy: null,
                pinnedAt: null,
              }
            : m
        )
      );

      toast.success("Đã bỏ ghim tin nhắn");
    } catch (error) {
      console.error("Bỏ ghim lỗi:", error);
      toast.error(error?.response?.data || "Bỏ ghim thất bại");
    }
  };

  const handleSelectConversation = async (conversation) => {
    setSelectedConversationId(conversation.id);

    if (conversation.roomId) {
      markAsReadApi(conversation.roomId).catch((error) =>
        console.log("Mark as read lỗi:", error)
      );
    }

    setConversations((prev) =>
      prev.map((item) =>
        item.id === conversation.id ? { ...item, unreadCount: 0 } : item
      )
    );
    setActiveTab("chat");
    setShowMenu(false);
    setShowMessageSearch(false);
    setShowGroupMenu(false);

    if (conversation.type === "GROUP") {
      setSelectedGroup(conversation.targetGroup);
      setIsRemovedFromGroup(false);
      setSelectedUser(null);
      setFriendNickname("");
      setNicknameInput("");
      setShowNicknameModal(false);
      setNicknameInput("");
      setBlockStatus({
        blockedByMe: false,
        blockedByOther: false,
      });
      return;
    }

    setSelectedGroup(null);
    setIsRemovedFromGroup(false);
    setSelectedUser(conversation.targetUser);

    loadPrivateNickname(conversation.roomId, conversation.targetUser?.id);

    try {
      const res = await getBlockStatusApi(conversation.targetUser.id);

      setBlockStatus({
        blockedByMe: res.data?.blockedByMe ?? false,
        blockedByOther: res.data?.blockedByOther ?? false,
      });
    } catch (err) {
      console.log("Check block lỗi", err);
    }
  };
  useEffect(() => {
    if (!roomId) {
      setChatBackground("");
      return;
    }

    const loadBackground = async () => {
      try {
        const res = await getChatBackgroundApi(roomId);

        const bg = typeof res.data === "string" ? res.data : "";

        setChatBackground(bg || "");
      } catch (error) {
        console.log("Load background lỗi:", error);
        setChatBackground("");
      }
    };

    loadBackground();
  }, [roomId]);

  const handleSelectGroup = (group) => {
    const conversation = {
      id: `group_${group.id}`,
      type: "GROUP",
      name: group.name,
      avatar: resolveAvatar(group.avatar),
      roomId: `group_${group.id}`,
      unreadCount: 0,
      targetGroup: {
        id: group.id,
        name: group.name,
        avatar: group.avatar,
      },
    };

    upsertConversation(conversation);
    setSelectedConversationId(conversation.id);
    setSelectedGroup({
      id: group.id,
      name: group.name,
    });
    setIsRemovedFromGroup(false);
    setFriendNickname("");
    setNicknameInput("");
    setShowNicknameModal(false);
    setSelectedUser(null);
    setShowMenu(false);
    setShowGroupMenu(false);
    setActiveTab("chat");
  };

  const handleDeleteConversation = async () => {
    if (!roomId) return;

    try {
      await deleteConversationApi(roomId);

      setMessages([]);
      setSelectedUser(null);
      setSelectedGroup(null);
      setSelectedConversationId(null);
      setConversations((prev) => prev.filter((item) => item.roomId !== roomId));
      if (conversationStorageKey) {
        try {
          const saved = localStorage.getItem(conversationStorageKey);
          const parsed = saved ? JSON.parse(saved) : [];

          if (Array.isArray(parsed)) {
            const next = parsed.filter((item) => item.roomId !== roomId);
            localStorage.setItem(conversationStorageKey, JSON.stringify(next));
          }
        } catch (error) {
          console.log("Remove conversation localStorage lỗi:", error);
        }
      }
      setShowMenu(false);
    } catch (error) {
      console.error("❌ Lỗi xoá hội thoại:", error);
    }
  };

  useEffect(() => {
    if (!currentUserId) return;

    const fetchGroups = async () => {
      try {
        const res = await getMyGroupsApi(currentUserId);

        const groupConversationsRaw = res.data.map((group) => ({
          id: `group_${group.id}`,
          type: "GROUP",
          name: group.name,
          avatar: resolveAvatar(group.avatar),
          roomId: `group_${group.id}`,
          unreadCount: 0,
          lastMessageAt: null,
          targetGroup: {
            id: group.id,
            name: group.name,
            avatar: group.avatar,
          },
        }));

        const groupConversations = await applyConversationMeta(
          groupConversationsRaw
        );
        groupConversationByRoomRef.current = new Map(
          groupConversations.map((group) => [group.roomId, group])
        );

        setJoinedGroupRooms(groupConversations.map((group) => group.roomId));

        setConversations((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));

          const newOnes = groupConversations.filter(
            (g) => !existingIds.has(g.id)
          );

          return sortConversationsByLatest([...newOnes, ...prev]);
        });
      } catch (err) {
        console.error("Load group lỗi:", err);
      }
    };

    fetchGroups();
  }, [currentUserId]);

  useEffect(() => {
    if (!roomId) return;

    const loadHistory = async () => {
      try {
        const res = await getMessagesApi(roomId);
        console.log("API DATA:", res.data);

        const history = res.data.map((msg) => ({
          id: msg.id || msg._id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          roomId: msg.roomId,

          content: msg.content,
          createdAt: msg.createdAt,
          deletedBy: msg.deletedBy,
          isRecalled: msg.isRecalled,

          fileUrl: msg.fileUrl,
          type: msg.type,

          originalSenderId: msg.originalSenderId,
          originalContent: msg.originalContent,
          originalMessageId: msg.originalMessageId,

          senderName: msg.senderName,
          senderAvatar: msg.senderAvatar,

          reactions: Array.isArray(msg.reactions) ? msg.reactions : [],

          pinned: msg.pinned,
          pinnedBy: msg.pinnedBy,
          pinnedAt: msg.pinnedAt,

          pollId: msg.pollId,
        }));

        setMessages(history);

        const lastMessage = history[history.length - 1];

        setConversations((prev) => {
          const next = prev.map((item) =>
            item.roomId === roomId
              ? {
                  ...item,
                  unreadCount: 0,
                  lastMessageAt: lastMessage?.createdAt || item.lastMessageAt,
                  lastMessageText: lastMessage
                    ? buildLastMessageText(lastMessage)
                    : item.lastMessageText,
                }
              : item
          );

          return sortConversationsByLatest(next);
        });

        markAsReadApi(roomId).catch((error) =>
          console.log("Mark read after load lỗi:", error)
        );
      } catch (err) {
        console.error("Load history lỗi:", err);
      }
    };

    setMessages([]);
    loadHistory();
  }, [roomId, setMessages]);

  useEffect(() => {
    if (!roomId) return;

    const sub = subscribeCallSignal(roomId, handleCallSignal);

    return () => {
      sub?.unsubscribe();
    };
  }, [roomId, handleCallSignal]);

  useEffect(() => {
    if (!selectedGroup?.id || !currentUserId) {
      setIsRemovedFromGroup(false);
      return;
    }

    const checkGroupMembership = async () => {
      const groupRoomId = `group_${selectedGroup.id}`;

      try {
        const res = await getGroupMembersApi(selectedGroup.id);

        const memberIds = Array.isArray(res.data)
          ? res.data.map((m) => Number(m?.userId)).filter(Boolean)
          : [];

        const isMember = memberIds.includes(Number(currentUserId));

        setIsRemovedFromGroup(!isMember);

        // Nếu không còn trong nhóm thì rời socket room
        if (!isMember) {
          setRemovedGroupRooms((prev) => {
            const next = new Set(prev);
            next.add(groupRoomId);
            return next;
          });

          leaveRoom(groupRoomId);
        } else {
          setRemovedGroupRooms((prev) => {
            const next = new Set(prev);
            next.delete(groupRoomId);
            return next;
          });
        }
      } catch {
        setIsRemovedFromGroup(true);
        leaveRoom(groupRoomId);
      }
    };

    checkGroupMembership();
  }, [selectedGroup, currentUserId]);

  useEffect(() => {
    setShowViewMembersModal(false);
    setViewMembersList([]);

    if (!selectedGroup?.id) {
      setGroupMemberCount(0);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await getGroupMembersApi(selectedGroup.id);
        const n = Array.isArray(res.data) ? res.data.length : 0;
        if (!cancelled) setGroupMemberCount(n);
      } catch {
        if (!cancelled) setGroupMemberCount(0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedGroup?.id]);

  useEffect(() => {
    const handleLogoutSync = (event) => {
      if (event.key === "logout") {
        navigate("/", { replace: true });
      }
    };

    window.addEventListener("storage", handleLogoutSync);

    return () => {
      window.removeEventListener("storage", handleLogoutSync);
    };
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!currentUserId || conversations.length === 0) return;

    const roomIds = [
      ...new Set(
        [
          ...conversations.map((conversation) => conversation.roomId),
          ...joinedGroupRooms,
        ]
          .filter(Boolean)
          .filter((joinedRoomId) => !removedGroupRooms.has(joinedRoomId))
      ),
    ];

    roomIds.forEach((joinedRoomId) => {
      joinRoom(
        joinedRoomId,

        // ================= MESSAGE =================
        (message) => {
          if (!message) return;

          const incomingRoomId = message.roomId || joinedRoomId;

          if (removedGroupRoomsRef.current.has(incomingRoomId)) {
            return;
          }
          const incomingConversationId = incomingRoomId.startsWith("group_")
            ? incomingRoomId
            : `private_${incomingRoomId}`;

          moveConversationToTop(incomingRoomId, message.createdAt, message);

          const isActiveConversation =
            selectedConversationId === incomingConversationId;

          if (isActiveConversation) {
            const incomingMessage = {
              id: message.id,
              senderId: message.senderId,
              receiverId: message.receiverId,
              roomId: message.roomId || incomingRoomId,

              content: message.content,
              createdAt: message.createdAt,
              deletedBy: message.deletedBy,
              isRecalled: message.isRecalled,

              fileUrl: message.fileUrl,
              type: message.type,

              originalSenderId: message.originalSenderId,
              originalContent: message.originalContent,
              originalMessageId: message.originalMessageId,

              senderName: message.senderName,
              senderAvatar: message.senderAvatar,

              reactions: Array.isArray(message.reactions)
                ? message.reactions
                : [],

              pollId: message.pollId,

              pinned: message.pinned,
              pinnedBy: message.pinnedBy,
              pinnedAt: message.pinnedAt,
            };

            setMessages((prev) => {
              const incomingId = String(incomingMessage.id || "");

              const hasExactMessage = prev.some(
                (item) => String(item.id || item._id) === incomingId
              );

              if (hasExactMessage) {
                return prev.map((item) =>
                  String(item.id || item._id) === incomingId
                    ? { ...item, ...incomingMessage }
                    : item
                );
              }

              const tempIndex = prev.findIndex((item) => {
                if (!item?.tempId) return false;
                if (Number(item.senderId) !== Number(incomingMessage.senderId)) {
                  return false;
                }
                if (String(item.roomId || "") !== String(incomingMessage.roomId || "")) {
                  return false;
                }
                if (String(item.type || "TEXT") !== String(incomingMessage.type || "TEXT")) {
                  return false;
                }

                const sameContent =
                  String(item.content || "") ===
                  String(incomingMessage.content || "");
                const sameFile =
                  String(item.fileUrl || "") ===
                  String(incomingMessage.fileUrl || "");
                const sameReply =
                  String(item.originalMessageId || "") ===
                  String(incomingMessage.originalMessageId || "");

                return sameContent && sameFile && sameReply;
              });

              if (tempIndex < 0) {
                return [...prev, incomingMessage];
              }

              return prev.map((item, index) =>
                index === tempIndex ? incomingMessage : item
              );
            });

            setConversations((prev) => {
              const existed = prev.some(
                (conversation) => conversation.id === incomingConversationId
              );

              if (!existed && incomingRoomId.startsWith("group_")) {
                const groupMeta =
                  groupConversationByRoomRef.current.get(incomingRoomId);

                if (!groupMeta) return prev;

                const restoredConversation = {
                  ...groupMeta,
                  unreadCount: 0,
                  lastMessageAt: message.createdAt || new Date().toISOString(),
                  lastMessageText: buildLastMessageText(message),
                };

                return sortConversationsByLatest([
                  restoredConversation,
                  ...prev,
                ]);
              }

              const next = prev.map((conversation) =>
                conversation.id === incomingConversationId
                  ? {
                      ...conversation,
                      lastMessageAt:
                        message.createdAt || new Date().toISOString(),
                      lastMessageText: buildLastMessageText(message),
                    }
                  : conversation
              );

              return sortConversationsByLatest(next);
            });

            return;
          }

          if (Number(message.senderId) === Number(currentUserId)) return;

          const isMutedConversation =
            mutedConversationIds.has(incomingConversationId);

          setConversations((prev) => {
            const existed = prev.some(
              (conversation) => conversation.id === incomingConversationId
            );

            if (!existed && incomingRoomId.startsWith("group_")) {
              const groupMeta =
                groupConversationByRoomRef.current.get(incomingRoomId);

              if (!groupMeta) return prev;

              const restoredConversation = {
                ...groupMeta,
                unreadCount: isMutedConversation ? 0 : 1,
                lastMessageAt: message.createdAt || new Date().toISOString(),
                lastMessageText: buildLastMessageText(message),
              };

              return sortConversationsByLatest([restoredConversation, ...prev]);
            }

            const next = prev.map((conversation) =>
              conversation.id === incomingConversationId
                ? {
                    ...conversation,
                    unreadCount: isMutedConversation
                      ? conversation.unreadCount || 0
                      : (conversation.unreadCount || 0) + 1,
                    lastMessageAt:
                      message.createdAt || new Date().toISOString(),
                    lastMessageText: buildLastMessageText(message),
                  }
                : conversation
            );

            return sortConversationsByLatest(next);
          });
        },

        // ================= DELETE =================
        (deletedId) => {
          const activeConversation = conversations.find(
            (conversation) => conversation.id === selectedConversationId
          );

          if (
            !activeConversation ||
            activeConversation.roomId !== joinedRoomId
          ) {
            return;
          }

          setMessages((prev) =>
            prev.map((m) =>
              String(m.id || m._id) === String(deletedId)
                ? { ...m, deletedBy: currentUserId }
                : m
            )
          );
        },

        // ================= RECALL =================
        (recallId) => {
          const activeConversation = conversations.find(
            (conversation) => conversation.id === selectedConversationId
          );

          if (
            !activeConversation ||
            activeConversation.roomId !== joinedRoomId
          ) {
            return;
          }

          setMessages((prev) =>
            prev.map((m) =>
              String(m.id || m._id) === String(recallId)
                ? { ...m, isRecalled: true }
                : m
            )
          );
        },

        // ================= BACKGROUND REALTIME =================
        (backgroundEvent) => {
          if (!backgroundEvent?.background) return;

          const activeConversation = conversations.find(
            (conversation) => conversation.id === selectedConversationId
          );

          if (
            !activeConversation ||
            activeConversation.roomId !== joinedRoomId
          ) {
            return;
          }

          setChatBackground(backgroundEvent.background);

          if (Number(backgroundEvent.updatedBy) !== Number(currentUserId)) {
            toast.info(
              `${backgroundEvent.updatedByName || "Ai đó"} đã đổi nền đoạn chat`
            );
          }
        },

        // ================= REACTION REALTIME =================
        (reactionEvent) => {
          if (!reactionEvent?.messageId) return;

          setMessages((prev) =>
            prev.map((msg) =>
              String(msg.id || msg._id) === String(reactionEvent.messageId)
                ? {
                    ...msg,
                    reactions: Array.isArray(reactionEvent.reactions)
                      ? reactionEvent.reactions
                      : [],
                  }
                : msg
            )
          );
        },

        (pinEvent) => {
          if (!pinEvent?.id && !pinEvent?._id) return;

          const pinId = pinEvent.id || pinEvent._id;
          const isPinned = Boolean(pinEvent.pinned);

          setMessages((prev) =>
            prev.map((msg) =>
              String(msg.id || msg._id) === String(pinId)
                ? {
                    ...msg,
                    pinned: isPinned,
                    pinnedBy: pinEvent.pinnedBy || null,
                    pinnedAt: pinEvent.pinnedAt || null,
                  }
                : msg
            )
          );

          setPinnedMessages((prev) => {
            if (!isPinned) {
              return prev.filter(
                (m) => String(m.id || m._id) !== String(pinId)
              );
            }

            const existed = prev.some(
              (m) => String(m.id || m._id) === String(pinId)
            );

            if (existed) {
              return prev.map((m) =>
                String(m.id || m._id) === String(pinId) ? pinEvent : m
              );
            }

            return [pinEvent, ...prev];
          });
        },
        (pollEvent) => {
          if (!pollEvent?.id) return;

          setPollRealtimeMap((prev) => ({
            ...prev,
            [pollEvent.id]: pollEvent,
          }));
        }
      );
    });

    return () => {
      roomIds.forEach((joinedRoomId) => leaveRoom(joinedRoomId));
    };
  }, [
    conversations,
    currentUserId,
    selectedConversationId,
    addMessage,
    setMessages,
    joinedGroupRooms,
    removedGroupRooms,
    mutedConversationIds,
  ]);

  const handleSendMessage = (messageText) => {
    if (selectedGroup && isRemovedFromGroup) {
      console.warn("BLOCK SEND: removed from group", {
        groupId: selectedGroup.id,
        currentUserId,
      });
      toast.error(
        "Bạn đã bị xoá ra khỏi nhóm và không thể trả lời cuộc trò chuyện này"
      );
      return;
    }

    if (
      !selectedGroup &&
      (blockStatus.blockedByMe || blockStatus.blockedByOther)
    ) {
      toast.error("Không thể gửi tin nhắn");
      return;
    }

    const content = (messageText ?? input)?.trim();

    if (!content) return;
    if (!currentUserId || (!selectedUser && !selectedGroup)) return;

    const tempId = `temp_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const replyMeta = replyMessage
      ? {
          originalSenderId: replyMessage.senderId != null
            ? Number(replyMessage.senderId)
            : null,
          originalContent: replyMessage.content || "Tin nhắn",
          originalMessageId: String(replyMessage.id || ""),
        }
      : {};

    const msg = {
      tempId,
      senderId: Number(currentUserId),
      receiverId: selectedUser?.id || null,
      roomId,
      content,
      type: "TEXT",
      createdAt,
      ...replyMeta,
    };

    // ✅ Hiện ngay trong box chat của người gửi, không cần reload
    addMessage({
      id: tempId,
      tempId,
      senderId: Number(currentUserId),
      receiverId: selectedUser?.id || null,
      roomId,
      content,
      type: "TEXT",
      createdAt,
      deletedBy: null,
      isRecalled: false,
      reactions: [],
      pinned: false,
      pinnedBy: null,
      pinnedAt: null,
      ...replyMeta,
    });

    sendMessageSocket(msg);

    if (selectedGroup) {
      upsertConversation({
        id: `group_${selectedGroup.id}`,
        type: "GROUP",
        name: selectedGroup.name,
        avatar: resolveAvatar(selectedGroup.avatar),
        roomId: `group_${selectedGroup.id}`,
        lastMessageAt: createdAt,
        lastMessageText: `Bạn: ${content}`,
        targetGroup: selectedGroup,
      });
    } else if (selectedUser) {
      const privateRoomId = [Number(currentUserId), Number(selectedUser.id)]
        .sort((a, b) => a - b)
        .join("_");

      upsertConversation({
        id: `private_${privateRoomId}`,
        type: "PRIVATE",
        name: selectedUser.username,
        avatar: resolveAvatar(selectedUser.avatar),
        roomId: privateRoomId,
        lastMessageAt: createdAt,
        lastMessageText: `Bạn: ${content}`,
        targetUser: selectedUser,
      });
    }

    setInput("");
    setReplyMessage(null);
  };

  const handleSendFile = (fileUrl) => {
    if (selectedGroup && isRemovedFromGroup) {
      console.warn("BLOCK SEND FILE: removed from group", {
        groupId: selectedGroup.id,
        currentUserId,
      });
      toast.error(
        "Bạn đã bị xoá ra khỏi nhóm và không thể trả lời cuộc trò chuyện này"
      );
      return;
    }

    if (
      !selectedGroup &&
      (blockStatus.blockedByMe || blockStatus.blockedByOther)
    ) {
      toast.error("Bạn đã chặn người này");
      return;
    }

    if (!currentUserId || (!selectedUser && !selectedGroup)) return;

    const replyMeta = replyMessage
      ? {
          originalSenderId: replyMessage.senderId != null
            ? Number(replyMessage.senderId)
            : null,
          originalContent: replyMessage.content || "Tin nhắn",
          originalMessageId: String(replyMessage.id || ""),
        }
      : {};

    const msg = {
      senderId: Number(currentUserId),
      receiverId: selectedUser?.id || null,
      roomId,
      type: "FILE",
      fileUrl,
      ...replyMeta,
    };

    sendMessageSocket(msg);
    setReplyMessage(null);
  };

  const handleSelectUser = async (u) => {
    const userId = u.friendId || u.userId || u.id;

    const targetUser = {
      id: userId,
      username: u.username,
      avatar: u.avatar,
    };

    const privateRoomId = [Number(currentUserId), Number(userId)]
      .sort((a, b) => a - b)
      .join("_");

    const conversation = {
      id: `private_${privateRoomId}`,
      type: "PRIVATE",
      name: u.username,
      avatar: resolveAvatar(u.avatar),
      roomId: privateRoomId,
      unreadCount: 0,
      targetUser,
    };

    setSelectedUser(targetUser);
    setSelectedGroup(null);
    setSelectedConversationId(conversation.id);
    setShowMenu(false);
    setShowGroupMenu(false);
    setActiveTab("chat");
    upsertConversation(conversation);
    loadPrivateNickname(privateRoomId, userId);

    try {
      const res = await getBlockStatusApi(userId);

      setBlockStatus({
        blockedByMe: res.data?.blockedByMe ?? false,
        blockedByOther: res.data?.blockedByOther ?? false,
      });
    } catch (err) {
      console.log("Check block lỗi", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");

    disconnectSocket();

    localStorage.setItem("logout", Date.now());

    navigate("/", { replace: true });
  };

  const handleOpenViewMembersModal = async () => {
    if (!selectedGroup?.id) return;

    if (isRemovedFromGroup) {
      toast.error("Bạn đã bị xoá khỏi nhóm nên không thể xem thành viên");
      return;
    }

    setShowGroupMenu(false);
    setShowViewMembersModal(true);
    setViewMembersLoading(true);
    setViewMembersList([]);

    try {
      const rows = await loadGroupMemberRows(selectedGroup.id);

      setViewMembersList(rows);
      setGroupMemberCount(rows.length);
    } catch (error) {
      console.error("View members lỗi:", error);
      toast.error("Không tải được danh sách thành viên");
    } finally {
      setViewMembersLoading(false);
    }
  };

  


  

  const handleOpenAddMemberModal = async () => {
    try {
      if (!selectedGroup?.id) return;

      const [friendsRes, membersRes] = await Promise.all([
        getFriendsApi(),
        getGroupMembersApi(selectedGroup.id),
      ]);

      const list = Array.isArray(friendsRes.data) ? friendsRes.data : [];
      const existingMemberIds = new Set(
        Array.isArray(membersRes.data)
          ? membersRes.data.map((m) => Number(m?.userId)).filter(Boolean)
          : []
      );

      const filteredCandidates = list.filter(
        (friend) => !existingMemberIds.has(getFriendId(friend))
      );

      setFriendCandidates(filteredCandidates);
      setSelectedMemberIds([]);
      setShowAddMemberModal(true);
      setShowGroupMenu(false);
    } catch (error) {
      console.error("Load friends lỗi:", error);
      toast.error("Không tải được danh sách bạn bè");
    }
  };

  const handleOpenRemoveMemberModal = async () => {
    try {
      if (!selectedGroup?.id) return;
      if (!isCurrentGroupManager) {
        toast.error("Chỉ trưởng nhóm hoặc phó nhóm mới được xoá thành viên");
        return;
      }

      const mappedMembers = (await loadGroupMemberRows(selectedGroup.id))
        .filter((row) => row.id && row.id !== Number(currentUserId))
        .filter((row) => row.role !== "OWNER")
        .filter((row) => isCurrentGroupOwner || row.role !== "ADMIN");

      setMemberCandidates(mappedMembers);
      setSelectedMemberIds([]);
      setShowRemoveMemberModal(true);
      setShowGroupMenu(false);
    } catch (error) {
      console.error("Load members lỗi:", error);
      toast.error("Không tải được danh sách thành viên");
    }
  };

  const handleOpenUpdateRoleModal = async () => {
    try {
      if (!selectedGroup?.id) return;

      const rows = await loadGroupMemberRows(selectedGroup.id);
      const me = rows.find((member) => member.id === Number(currentUserId));
      setCurrentGroupRole(me?.role || "MEMBER");

      if (me?.role !== "OWNER") {
        toast.error("Chỉ trưởng nhóm mới được bầu hoặc hạ phó nhóm");
        return;
      }

      const mappedRoleCandidates = rows
        .filter(
          (member) =>
            member.id &&
            member.id !== Number(currentUserId) &&
            member.role !== "OWNER"
        );

      setRoleCandidates(mappedRoleCandidates);
      setSelectedRoleUserId(mappedRoleCandidates[0]?.id ?? null);
      setSelectedRoleValue(mappedRoleCandidates[0]?.role ?? "MEMBER");
      setShowUpdateRoleModal(true);
      setShowGroupMenu(false);
    } catch (error) {
      console.error("Load role members lỗi:", error);
      toast.error("Không tải được danh sách thành viên");
    }
  };

  const handleOpenTransferOwnerModal = async () => {
    try {
      if (!selectedGroup?.id || !currentUserId) return;

      const rows = await loadGroupMemberRows(selectedGroup.id);
      const me = rows.find((member) => member.id === Number(currentUserId));
      setCurrentGroupRole(me?.role || "MEMBER");

      if (me?.role !== "OWNER") {
        toast.error("Chỉ trưởng nhóm mới được chuyển quyền trưởng nhóm");
        return;
      }

      const candidates = rows.filter(
        (member) =>
          member.id &&
          member.id !== Number(currentUserId) &&
          member.role !== "OWNER"
      );

      setOwnerTransferCandidates(candidates);
      setSelectedOwnerTransferId(null);
      setShowTransferOwnerModal(true);
      setShowGroupMenu(false);
    } catch (error) {
      console.error("Load transfer owner members lỗi:", error);
      toast.error("Không tải được danh sách thành viên để chuyển quyền");
    }
  };

  const toggleSelectMember = (friend) => {
    const id = getFriendId(friend);
    if (!id) return;

    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddMembersToGroup = async () => {
    if (!selectedGroup?.id || selectedMemberIds.length === 0) return;

    try {
      await Promise.all(
        selectedMemberIds.map((userId) =>
          addMemberApi(selectedGroup.id, userId)
        )
      );
      toast.success("Thêm thành viên vào nhóm thành công! 🎉");
      setShowAddMemberModal(false);
      setSelectedMemberIds([]);
      try {
        const countRes = await getGroupMembersApi(selectedGroup.id);
        setGroupMemberCount(
          Array.isArray(countRes.data) ? countRes.data.length : 0
        );
      } catch {
        /* ignore */
      }
    } catch (error) {
      console.error("Add member lỗi:", error);
      const message = error?.response?.data || "Thêm thành viên thất bại";

      if (
        typeof message === "string" &&
        (message.includes("Không thuộc nhóm") ||
          message.includes("Khong thuoc nhom"))
      ) {
        toast.error("Không thuộc nhóm");
        return;
      }

      if (
        typeof message === "string" &&
        (message.includes("User đã trong nhóm") ||
          message.includes("User da trong nhom"))
      ) {
        toast.error("User đã trong nhóm");
        return;
      }

      toast.error("Thêm thành viên thất bại");
    }
  };

  const handleRemoveMembersFromGroup = async () => {
    if (!selectedGroup?.id || selectedMemberIds.length === 0) return;

    try {
      await Promise.all(
        selectedMemberIds.map((userId) =>
          removeMemberApi(selectedGroup.id, userId, Number(currentUserId))
        )
      );
      toast.success("Xoá thành viên khỏi nhóm thành công! 🎉");
      setMemberCandidates((prev) =>
        prev.filter((item) => !selectedMemberIds.includes(getFriendId(item)))
      );
      setSelectedMemberIds([]);
      setShowRemoveMemberModal(false);
      try {
        const countRes = await getGroupMembersApi(selectedGroup.id);
        setGroupMemberCount(
          Array.isArray(countRes.data) ? countRes.data.length : 0
        );
      } catch {
        /* ignore */
      }
    } catch (error) {
      console.error("Remove member lỗi:", error);
      const message = error?.response?.data || "Xoá thành viên thất bại";

      if (
        typeof message === "string" &&
        message.includes("Bạn không thuộc nhóm")
      ) {
        toast.error("Bạn không thuộc nhóm");
        return;
      }

      if (
        typeof message === "string" &&
        message.includes("Bạn không có quyền")
      ) {
        toast.error("Bạn không có quyền");
        return;
      }

      if (
        typeof message === "string" &&
        message.includes("Không thể tự xoá chính mình")
      ) {
        toast.error("Không thể tự xoá chính mình");
        return;
      }

      if (
        typeof message === "string" &&
        message.includes("User không trong nhóm")
      ) {
        toast.error("User không trong nhóm");
        return;
      }

      toast.error("Xoá thành viên thất bại");
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup?.id || !currentUserId) return;

    try {
      await deleteGroupApi(selectedGroup.id, Number(currentUserId));

      setConversations((prev) =>
        prev.filter((item) => item.id !== `group_${selectedGroup.id}`)
      );
      setSelectedGroup(null);
      setSelectedConversationId(null);
      setMessages([]);
      setShowGroupMenu(false);

      toast.success("Giải tán nhóm thành công! 🎉");
    } catch (error) {
      const message = error?.response?.data || "Giải tán nhóm thất bại";

      if (
        typeof message === "string" &&
        message.includes("Group không tồn tại")
      ) {
        toast.error("Group không tồn tại");
        return;
      }

      if (
        typeof message === "string" &&
        message.includes("Bạn không có quyền giải tán nhóm")
      ) {
        toast.error("Bạn không có quyền giải tán nhóm");
        return;
      }

      toast.error("Giải tán nhóm thất bại");
    }
  };

  const handleChangeChatBackground = async (e) => {
    const file = e.target.files?.[0];

    if (!file || !roomId) return;

    try {
      const uploadRes = await uploadFileApi(file);

      const backgroundUrl =
        uploadRes.data?.url ||
        uploadRes.data?.fileUrl ||
        uploadRes.data?.path ||
        uploadRes.data;

      if (!backgroundUrl) {
        toast.error("Upload ảnh nền thất bại");
        return;
      }

      const scope = backgroundShared ? "SHARED" : "PERSONAL";

      await updateChatBackgroundApi(roomId, backgroundUrl, scope);

      setChatBackground(backgroundUrl);

      toast.success(
        backgroundShared
          ? "Đã đổi nền cho cả đoạn chat"
          : "Đã đổi nền chỉ mình bạn"
      );
    } catch (error) {
      console.error("Đổi nền chat lỗi:", error);
      toast.error(error?.response?.data || "Đổi nền thất bại");
    } finally {
      e.target.value = "";
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedGroup?.id || !selectedRoleUserId || !currentUserId) return;

    try {
      await updateRoleApi(
        selectedGroup.id,
        Number(selectedRoleUserId),
        selectedRoleValue,
        Number(currentUserId)
      );

      setRoleCandidates((prev) =>
        prev.map((member) =>
          member.id === Number(selectedRoleUserId)
            ? { ...member, role: selectedRoleValue }
            : member
        )
      );
      setShowUpdateRoleModal(false);
      toast.success("Cập nhật quyền thành công! 🎉");
    } catch (error) {
      const message = error?.response?.data || "Cập nhật quyền thất bại";

      if (typeof message === "string" && message.includes("Không thuộc nhóm")) {
        toast.error("Không thuộc nhóm");
        return;
      }
      if (typeof message === "string" && message.includes("Không có quyền")) {
        toast.error("Không có quyền");
        return;
      }
      if (
        typeof message === "string" &&
        message.includes("User không tồn tại")
      ) {
        toast.error("User không tồn tại");
        return;
      }
      if (
        typeof message === "string" &&
        message.includes("Không thể sửa OWNER")
      ) {
        toast.error("Không thể sửa OWNER");
        return;
      }

      toast.error("Cập nhật quyền thất bại");
    }
  };

  const handleTransferOwner = async (targetUserId = selectedOwnerTransferId) => {
    if (!selectedGroup?.id || !targetUserId || !currentUserId) return;

    try {
      const rows = await loadGroupMemberRows(selectedGroup.id);
      const me = rows.find((member) => member.id === Number(currentUserId));
      const target = rows.find((member) => member.id === Number(targetUserId));

      setCurrentGroupRole(me?.role || "MEMBER");

      if (me?.role !== "OWNER") {
        toast.error("Chỉ trưởng nhóm hiện tại mới được chuyển quyền");
        return;
      }

      if (!target || target.role === "OWNER") {
        toast.error("Thành viên nhận quyền không hợp lệ");
        return;
      }

      await transferOwnerApi(
        selectedGroup.id,
        Number(targetUserId),
        Number(currentUserId)
      );

      setCurrentGroupRole("ADMIN");
      setRoleCandidates((prev) =>
        prev.map((member) =>
          member.id === Number(targetUserId)
            ? { ...member, role: "OWNER" }
            : member
        )
      );
      setShowUpdateRoleModal(false);
      setShowTransferOwnerModal(false);
      setShowLeaveConfirmModal(false);
      setSelectedOwnerTransferId(null);
      toast.success("Đã chuyển quyền trưởng nhóm");
    } catch (error) {
      console.error("Transfer owner lỗi:", error);
      const message = error?.response?.data || "Chuyển quyền trưởng nhóm thất bại";

      if (String(message).includes("Chi truong nhom")) {
        toast.error("Chỉ trưởng nhóm hiện tại mới được chuyển quyền");
        return;
      }

      if (String(message).includes("khong thuoc nhom") || String(message).includes("roi nhom")) {
        toast.error("Bạn không còn là thành viên hoạt động của nhóm này");
        return;
      }

      toast.error(message);
    }
  };

  const currentTitle = selectedGroup
    ? selectedGroup.name
    : friendNickname || selectedUser?.username || "Cuộc trò chuyện";

  const handleOpenPrivateInfoModal = async () => {
    if (!selectedUser?.id) return;

    setShowMenu(false);
    setPrivateInfo(selectedUser);
    setShowPrivateInfoModal(true);

    try {
      setPrivateInfoLoading(true);

      const res = await getUserInfoApi(selectedUser.id);

      setPrivateInfo(res.data);
    } catch (error) {
      console.error("Load user info lỗi:", error);
      toast.error("Không tải được thông tin người dùng");
    } finally {
      setPrivateInfoLoading(false);
    }
  };

  const handleOpenUserProfile = async (profileUser) => {
    const targetId = profileUser?.id || profileUser?.userId;
    if (!targetId) return;

    setShowMenu(false);
    setPrivateInfo(profileUser);
    setShowPrivateInfoModal(true);

    try {
      setPrivateInfoLoading(true);
      const res = await getUserInfoApi(targetId);
      setPrivateInfo(res.data);
    } catch (error) {
      console.error("Load user info lỗi:", error);
      toast.error("Không tải được thông tin người dùng");
    } finally {
      setPrivateInfoLoading(false);
    }
  };

  const currentAvatar = selectedGroup
    ? resolveAvatar(selectedGroup?.avatar)
    : resolveAvatar(selectedUser?.avatar);

  const isCurrentGroupOwner = currentGroupRole === "OWNER";
  const isCurrentGroupManager =
    currentGroupRole === "OWNER" || currentGroupRole === "ADMIN";

  const resolveChatAsset = (url) => {
    if (!url) return "";
    const value = String(url);
    if (value.startsWith("data:") || value.startsWith("http")) return value;
    if (value.startsWith("/")) return `http://localhost:8080${value}`;
    return `http://localhost:8080/uploads/${value}`;
  };

  const sharedMediaMessages = messages.filter(
    (msg) =>
      msg?.fileUrl &&
      String(msg.fileUrl).match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)
  );

  const sharedFileMessages = messages.filter(
    (msg) =>
      msg?.fileUrl &&
      !String(msg.fileUrl).match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)
  );

  const sharedLinks = messages
    .map((msg) => {
      const text = String(msg?.content || msg?.text || "");
      const match = text.match(/https?:\/\/[^\s]+/i);
      return match
        ? {
            id: msg.id || msg._id || `${match[0]}_${msg.createdAt || ""}`,
            url: match[0],
            createdAt: msg.createdAt,
          }
        : null;
    })
    .filter(Boolean);

  const normalizeAiSearchText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase();

  const aiSearchStopWords = new Set([
    "ai",
    "anh",
    "cho",
    "co",
    "cua",
    "dua",
    "file",
    "giup",
    "hinh",
    "link",
    "minh",
    "nay",
    "pdf",
    "ra",
    "tai",
    "tim",
    "trong",
    "xem",
  ]);

  const getAiSearchTokens = (question) =>
    normalizeAiSearchText(question)
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !aiSearchStopWords.has(token));

  const getAiAssistantAttachments = (question) => {
    const normalizedQuestion = normalizeAiSearchText(question);
    const tokens = getAiSearchTokens(question);
    const wantsImages = /\b(anh|hinh|image|photo|picture|jpeg|jpg|png|gif|webp)\b/.test(
      normalizedQuestion
    );
    const wantsLinks = /\b(link|url|website|web|trang)\b/.test(
      normalizedQuestion
    );
    const wantsFiles = /\b(file|tep|pdf|doc|docx|word|excel|xls|xlsx|ppt|pptx|slide|zip|rar|video|mp4|wmv)\b/.test(
      normalizedQuestion
    );

    const hasUsefulTokenMatch = (text) => {
      if (!tokens.length) return true;
      const normalizedText = normalizeAiSearchText(text);
      return tokens.some((token) => normalizedText.includes(token));
    };

    const matchesFileType = (fileName) => {
      const normalizedFileName = normalizeAiSearchText(fileName);
      if (normalizedQuestion.includes("pdf")) {
        return normalizedFileName.endsWith(".pdf");
      }
      if (/\b(doc|docx|word)\b/.test(normalizedQuestion)) {
        return /\.(doc|docx)$/i.test(fileName);
      }
      if (/\b(excel|xls|xlsx)\b/.test(normalizedQuestion)) {
        return /\.(xls|xlsx)$/i.test(fileName);
      }
      if (/\b(ppt|pptx|slide)\b/.test(normalizedQuestion)) {
        return /\.(ppt|pptx)$/i.test(fileName);
      }
      if (/\b(zip|rar)\b/.test(normalizedQuestion)) {
        return /\.(zip|rar)$/i.test(fileName);
      }
      if (/\b(video|mp4|wmv)\b/.test(normalizedQuestion)) {
        return /\.(mp4|mov|avi|wmv|mkv|webm)$/i.test(fileName);
      }
      return true;
    };

    const attachments = [];

    if (wantsImages) {
      sharedMediaMessages
        .filter((msg) =>
          hasUsefulTokenMatch(`${msg.fileUrl || ""} ${msg.content || ""}`)
        )
        .slice(0, 8)
        .forEach((msg, index) => {
          const url = resolveChatAsset(msg.fileUrl);
          attachments.push({
            id: msg.id || msg._id || `image_${index}`,
            type: "image",
            title: String(msg.fileUrl || "Ảnh trong chat").split("/").pop(),
            subtitle: msg.createdAt
              ? `Gửi lúc ${msg.createdAt}`
              : "Ảnh trong hội thoại",
            url,
            thumbnailUrl: url,
          });
        });
    }

    if (wantsFiles) {
      sharedFileMessages
        .filter((msg) => {
          const fileName = String(msg.fileUrl || "").split("/").pop();
          return (
            matchesFileType(fileName) &&
            hasUsefulTokenMatch(`${fileName} ${msg.content || ""}`)
          );
        })
        .slice(0, 8)
        .forEach((msg, index) => {
          const fileName = String(msg.fileUrl || "Tệp đính kèm")
            .split("/")
            .pop();
          attachments.push({
            id: msg.id || msg._id || `file_${index}`,
            type: "file",
            title: fileName,
            subtitle: msg.createdAt
              ? `Gửi lúc ${msg.createdAt}`
              : "Tệp trong hội thoại",
            url: resolveChatAsset(msg.fileUrl),
          });
        });
    }

    if (wantsLinks) {
      sharedLinks
        .filter((link) => hasUsefulTokenMatch(link.url))
        .slice(0, 8)
        .forEach((link, index) => {
          attachments.push({
            id: link.id || `link_${index}`,
            type: "link",
            title: link.url.replace(/^https?:\/\//i, ""),
            subtitle: link.createdAt
              ? `Gửi lúc ${link.createdAt}`
              : "Link trong hội thoại",
            url: link.url,
          });
        });
    }

    return attachments.slice(0, 10);
  };

  const formatAiMessage = (msg) => {
    const senderId = msg.senderId || msg.sender?._id || msg.sender || msg.userId;
    const senderName =
      Number(senderId) === Number(currentUserId)
        ? "Bạn"
        : msg.senderName || msg.sender?.username || selectedUser?.username || "Người khác";

    return {
      id: msg.id || msg._id,
      senderId,
      senderName,
      type: msg.type || "TEXT",
      content:
        msg.content ||
        msg.text ||
        msg.originalContent ||
        (msg.fileUrl ? "Tệp đính kèm" : ""),
      fileUrl: msg.fileUrl || "",
      createdAt: msg.createdAt || "",
      recalled: Boolean(msg.isRecalled),
      pinned: Boolean(msg.pinned),
    };
  };

  const buildAiAssistantContext = async () => {
    let friends = [];

    try {
      const res = await getFriendsApi();
      friends = Array.isArray(res.data) ? res.data : [];
    } catch (error) {
      console.log("Load friends for AI assistant lỗi:", error);
    }

    const normalizedFriends = friends
      .map((friend) => {
        const id = getFriendId(friend);
        return {
          id,
          name: getFriendName(friend),
          online: onlineUsers.has(Number(id)),
        };
      })
      .filter((friend) => friend.id);

    const onlineFriends = normalizedFriends.filter((friend) => friend.online);
    const currentConversation = selectedGroup
      ? {
          type: "GROUP",
          id: selectedGroup.id,
          name: selectedGroup.name,
          roomId,
          memberCount: groupMemberCount,
        }
      : selectedUser
        ? {
            type: "PRIVATE",
            id: selectedUser.id,
            name: friendNickname || selectedUser.username,
            roomId,
            online: onlineUsers.has(Number(selectedUser.id)),
          }
        : null;

    const context = {
      currentUser: {
        id: currentUserId,
        username: user?.username,
        phone: user?.phone,
        email: user?.email,
      },
      friends: {
        total: normalizedFriends.length,
        onlineCount: onlineFriends.length,
        online: onlineFriends,
        all: normalizedFriends.slice(0, 80),
      },
      conversations: conversations.slice(0, 30).map((conversation) => ({
        id: conversation.id,
        type: conversation.type,
        name: conversation.name,
        roomId: conversation.roomId,
        lastMessageText: conversation.lastMessageText,
        unreadCount: conversation.unreadCount || 0,
        pinned: pinnedConversationIds.has(conversation.id),
        muted: mutedConversationIds.has(conversation.id),
      })),
      currentConversation,
      currentConversationData: {
        messageCount: messages.length,
        recentMessages: messages.slice(-40).map(formatAiMessage),
        pinnedMessages: pinnedMessages.slice(0, 10).map(formatAiMessage),
        images: sharedMediaMessages.slice(0, 30).map((msg) => ({
          id: msg.id || msg._id,
          fileUrl: msg.fileUrl,
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        })),
        files: sharedFileMessages.slice(0, 30).map((msg) => ({
          id: msg.id || msg._id,
          fileUrl: msg.fileUrl,
          fileName: String(msg.fileUrl || "").split("/").pop(),
          senderId: msg.senderId,
          createdAt: msg.createdAt,
        })),
        links: sharedLinks.slice(0, 30),
      },
    };

    return JSON.stringify(context, null, 2).slice(0, 14000);
  };

  const handleAskAiAssistant = async (question) => {
    const attachments = getAiAssistantAttachments(question);
    const context = await buildAiAssistantContext();
    const res = await askAiAssistantApi({
      question,
      context,
    });

    const answer = res.data?.answer || "AI chưa có phản hồi.";

    if (!attachments.length) {
      return { answer, attachments: [] };
    }

    const attachmentLabel =
      attachments.length === 1
        ? "Mình đã đính kèm kết quả phù hợp bên dưới."
        : `Mình đã đính kèm ${attachments.length} kết quả phù hợp bên dưới.`;

    return {
      answer: `${answer}\n\n${attachmentLabel}`,
      attachments,
    };
  };

  const handleToggleBlockUser = async () => {
    if (!selectedUser?.id) return;

    try {
      if (blockStatus.blockedByMe) {
        await unblockUserApi(selectedUser.id);
        toast.success("Đã bỏ chặn người dùng");
      } else {
        await blockUserApi(selectedUser.id);
        toast.success("Đã chặn người dùng");
      }

      const res = await getBlockStatusApi(selectedUser.id);

      setBlockStatus({
        blockedByMe: res.data?.blockedByMe ?? false,
        blockedByOther: res.data?.blockedByOther ?? false,
      });
    } catch (error) {
      console.log("Block/unblock lỗi:", error);
      toast.error("Thao tác thất bại");
    }
  };

  const handleToggleMuteConversation = () => {
    if (!selectedConversationId) return;

    setMutedConversationIds((prev) => {
      const next = new Set(prev);

      if (next.has(selectedConversationId)) {
        next.delete(selectedConversationId);
        toast.success("Đã bật thông báo hội thoại");
      } else {
        next.add(selectedConversationId);
        toast.success("Đã tắt thông báo hội thoại");
      }

      return next;
    });
  };

  const handleTogglePinConversation = () => {
    if (!selectedConversationId) return;

    setPinnedConversationIds((prev) => {
      const next = new Set(prev);

      if (next.has(selectedConversationId)) {
        next.delete(selectedConversationId);
        toast.success("Đã bỏ ghim hội thoại");
      } else {
        next.add(selectedConversationId);
        toast.success("Đã ghim hội thoại");
      }

      return next;
    });
  };

  const isCurrentConversationMuted =
    !!selectedConversationId && mutedConversationIds.has(selectedConversationId);

  const isCurrentConversationPinned =
    !!selectedConversationId && pinnedConversationIds.has(selectedConversationId);

  return (
    <div className="w-screen h-screen flex bg-[#0f172a] overflow-hidden text-slate-200 font-sans relative">
      <div className="relative z-[200] border-r border-slate-800/60 shadow-2xl bg-[#0b1120]">
        <Sidebar
          user={user}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          onLogout={handleLogout}
          onOpenProfile={() => setShowProfile(true)}
          onChangePassword={() => setShowChangePassword(true)}
          onSelectTab={setActiveTab}
          activeTab={activeTab}
          aiAssistantOpen={aiAssistantOpen}
          onToggleAiAssistant={() => setAiAssistantOpen((prev) => !prev)}
        />
      </div>

      {(activeTab === "chat" || activeTab === "group") && (
        <aside className="w-[340px] shrink-0 border-r border-slate-800/60 bg-[#111827] flex flex-col">
          <div className="p-4 border-b border-slate-800/60">
            <div className="text-xl font-semibold text-white mb-1">
              Cuộc trò chuyện
            </div>
            <div className="text-sm text-slate-400">
              {conversations.length} hội thoại
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {conversations.length === 0 ? (
              <div className="text-slate-500 text-sm px-3 py-4">
                Chưa có cuộc trò chuyện nào
              </div>
            ) : (
              conversations.map((item) => {
                const isActive = selectedConversationId === item.id;
                const isPinnedConversation = pinnedConversationIds.has(item.id);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectConversation(item)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition ${
                      isActive
                        ? "bg-blue-500/20 border border-blue-500/30"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <img
                      src={item.avatar || DEFAULT_AVATAR}
                      alt=""
                      className="w-14 h-14 rounded-full object-cover bg-slate-700 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium truncate flex items-center justify-between gap-2">
                        <span className="truncate">{item.name}</span>
                        {isPinnedConversation && (
                          <span
                            title="Da ghim hoi thoai"
                            className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-200"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3.5 w-3.5"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M12 17v5" />
                              <path d="M9 10.5 4.5 15" />
                              <path d="m14 4 6 6" />
                              <path d="m5 14 5 5" />
                              <path d="m8 12 7-7 4 4-7 7" />
                            </svg>
                          </span>
                        )}
                        {item.unreadCount > 0 && (
                          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-blue-500 text-white text-[11px] leading-[22px] text-center font-semibold">
                            {item.unreadCount > 99 ? "99+" : item.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 truncate">
                        {item.lastMessageText ||
                          (item.type === "GROUP"
                            ? "Nhóm chat"
                            : "Chat cá nhân")}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}

      <main className="flex-1 min-w-0 flex flex-col bg-gradient-to-b from-[#1e293b] to-[#0f172a] relative z-40 transition-[width,flex-basis] duration-300 ease-out">
        {activeTab === "chat" &&
          (!selectedUser && !selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center shadow-inner">
                <span className="text-4xl">💬</span>
              </div>
              <p className="text-slate-500 font-medium">
                Chọn một cuộc trò chuyện để bắt đầu
              </p>
            </div>
          ) : (
            <>
              <header className="h-[92px] px-8 flex items-center justify-between bg-[#111827]/95 backdrop-blur-xl border-b border-slate-700/60 shadow-[0_8px_24px_rgba(0,0,0,0.35)] z-20">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <div className="absolute -inset-[3px] rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-blue-500 opacity-90"></div>

                    <img
                      src={currentAvatar}
                      alt=""
                      className="relative w-14 h-14 rounded-full object-cover border-2 border-slate-900 bg-slate-700 cursor-pointer shadow-lg"
                      onClick={() => {
                        if (selectedGroup) {
                          setInfoPanelOpen(true);
                        } else {
                          handleOpenPrivateInfoModal();
                        }
                      }}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    {selectedGroup && !isRemovedFromGroup && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-blue-600 border-2 border-slate-900 z-50 shadow-md"
                        title="Đổi ảnh nhóm"
                      >
                        📷
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleChangeGroupAvatar}
                        />
                      </label>
                    )}

                    {!selectedGroup && (
                      <span
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-900 ${
                          onlineUsers.has(Number(selectedUser?.id))
                            ? "bg-emerald-500"
                            : "bg-slate-500"
                        }`}
                      />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <h2
                      onClick={() => {
                        setInfoPanelOpen(true);
                      }}
                      className={`!text-white text-[22px] font-bold tracking-wide truncate max-w-[720px] drop-shadow-sm ${
                        !selectedGroup
                          ? "cursor-pointer hover:!text-blue-300"
                          : ""
                      }`}
                    >
                      {currentTitle}
                    </h2>

                    <div className="flex items-center gap-2 mt-1">
                      {!selectedGroup &&
                      onlineUsers.has(Number(selectedUser?.id)) ? (
                        <>
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                          <span className="text-sm text-emerald-400 font-medium">
                            Đang hoạt động
                          </span>
                        </>
                      ) : selectedGroup ? (
                        <>
                          <span className="w-2.5 h-2.5 bg-blue-400 rounded-full"></span>
                          <span className="text-sm text-slate-300 font-medium">
                            Nhóm chat · {groupMemberCount} thành viên
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2.5 h-2.5 bg-slate-500 rounded-full"></span>
                          <span className="text-sm text-slate-400 font-medium">
                            Ngoại tuyến
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 relative shrink-0">
                  <button
                    onClick={() => setShowMessageSearch((prev) => !prev)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                      showMessageSearch
                        ? "bg-blue-500/20 text-blue-300"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                    title="Tìm tin nhắn"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </button>

                  {!selectedGroup && selectedUser && (
                    <button
                      type="button"
                      onClick={startAudioCall}
                      className="w-11 h-11 rounded-full flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white transition"
                      title="Gọi thoại"
                    >
                      📞
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setInfoPanelOpen((prev) => !prev)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                      infoPanelOpen
                        ? "bg-blue-500/20 text-blue-300"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                    title="Thông tin hội thoại"
                  >
                    <span className="relative w-[22px] h-[18px] rounded-sm border-2 border-current inline-flex">
                      <span className="w-[7px] border-r-2 border-current h-full" />
                    </span>
                  </button>
                </div>
              </header>

              {pinnedMessages.length > 0 && (
                <div className="relative">
                  <div className="px-6 py-2 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setShowPinnedList((prev) => !prev)}
                      className="flex items-center gap-3 min-w-0 text-left flex-1"
                    >
                      <span className="text-orange-400 text-lg">📌</span>

                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">
                          Tin nhắn đã ghim · {pinnedMessages.length}
                        </div>

                        <div className="text-sm text-white truncate max-w-[600px]">
                          {pinnedMessages[0]?.content ||
                            pinnedMessages[0]?.originalContent ||
                            (pinnedMessages[0]?.fileUrl
                              ? "Tệp đính kèm"
                              : "Tin nhắn")}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowPinnedList((prev) => !prev)}
                      className="text-sm text-slate-300 hover:text-blue-400 font-medium"
                    >
                      Xem tất cả
                    </button>
                  </div>

                  {showPinnedList && (
                    <div className="absolute left-0 right-0 top-full z-50 bg-slate-900 border-b border-slate-700 shadow-xl max-h-[260px] overflow-y-auto">
                      {pinnedMessages.map((msg) => {
                        const msgId = msg.id || msg._id;

                        return (
                          <div
                            key={msgId}
                            className="px-6 py-3 border-b border-slate-800 flex items-center justify-between gap-4 hover:bg-slate-800"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(
                                  `msg-${msgId}`
                                );

                                if (el) {
                                  el.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                  });
                                }

                                setShowPinnedList(false);
                              }}
                              className="flex items-center gap-3 min-w-0 text-left flex-1"
                            >
                              <span className="text-orange-400">📌</span>

                              <div className="min-w-0">
                                <div className="text-sm text-white truncate">
                                  {msg.content ||
                                    msg.originalContent ||
                                    (msg.fileUrl ? "Tệp đính kèm" : "Tin nhắn")}
                                </div>

                                <div className="text-xs text-slate-400 mt-0.5">
                                  Bấm để đi tới tin nhắn
                                </div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUnpinMessage(msgId)}
                              className="text-xs text-red-400 hover:text-red-300 shrink-0"
                            >
                              Bỏ ghim
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 relative overflow-hidden">
                <ChatBox
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  currentUserId={currentUserId}
                  setMessages={setMessages}
                  onForwardMessage={handleForwardClick}
                  onReplyMessage={setReplyMessage}
                  onOpenUserProfile={handleOpenUserProfile}
                  onPinMessage={handlePinMessage}
                  onUnpinMessage={handleUnpinMessage}
                  pollRealtimeMap={pollRealtimeMap}
                  onReactMessage={async (messageId, emoji) => {
                    try {
                      await reactMessageApi(messageId, emoji);
                    } catch (error) {
                      console.error("React message lỗi:", error);
                      toast.error("Thả cảm xúc thất bại");
                    }
                  }}
                  showSearch={showMessageSearch}
                  onCloseSearch={() => setShowMessageSearch(false)}
                  chatBackground={chatBackground}
                  onClearReactions={async (messageId) => {
                    try {
                      await clearMessageReactionsApi(messageId);
                    } catch (error) {
                      console.error("Xoá cảm xúc lỗi:", error);
                      toast.error("Xoá cảm xúc thất bại");
                    }
                  }}
                />
              </div>

              <div className="p-4 bg-transparent">
                {selectedGroup ? (
                  isRemovedFromGroup ? (
                    <div className="text-center text-red-400 font-medium">
                      🚫 Bạn đã bị xoá ra khỏi nhóm và không thể trả lời cuộc
                      trò chuyện này
                    </div>
                  ) : (
                    <ChatInput
                      input={input}
                      setInput={setInput}
                      onSend={handleSendMessage}
                      onSendFile={handleSendFile}
                      onOpenPoll={() => setShowPollModal(true)}
                      replyToMessage={replyMessage}
                      onCancelReply={() => setReplyMessage(null)}
                    />
                  )
                ) : blockStatus.blockedByMe ? (
                  <div className="text-center text-red-400">
                    🚫 Bạn đã chặn người này
                  </div>
                ) : blockStatus.blockedByOther ? (
                  <div className="text-center text-yellow-400">
                    ⚠️ Bạn đã bị người này chặn
                  </div>
                ) : (
                  <ChatInput
                    input={input}
                    setInput={setInput}
                    onSend={handleSendMessage}
                    onSendFile={handleSendFile}
                    replyToMessage={replyMessage}
                    onCancelReply={() => setReplyMessage(null)}
                  />
                )}
              </div>
            </>
          ))}

        {activeTab !== "chat" && activeTab !== "group" && (
          <div className="flex-1 p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {activeTab === "friends" && (
              <FriendsList
                onSelectUser={handleSelectUser}
                onlineUsers={onlineUsers}
                currentUserId={currentUserId}
              />
            )}
            {activeTab === "requests" && <FriendRequests />}
            {activeTab === "search" && (
              <FriendSearch onSelectUser={handleSelectUser} />
            )}
          </div>
        )}

        {activeTab === "group" && (
          <CreateGroup
            user={user}
            friends={[]}
            onCreated={(group) => {
              handleSelectGroup(group);
              setShowMenu(false);
            }}
          />
        )}
      </main>

      <aside
        className={`h-full shrink-0 overflow-hidden border-l border-slate-800/70 bg-[#1f242b] transition-[width,opacity] duration-300 ease-out ${
          infoPanelOpen && (selectedUser || selectedGroup)
            ? "w-[380px] opacity-100"
            : "w-0 opacity-0"
        }`}
      >
        <div className="w-[380px] h-full flex flex-col text-slate-100">
          <div className="h-[92px] px-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xl font-bold">Thông tin hội thoại</h3>
            <button
              type="button"
              onClick={() => setInfoPanelOpen(false)}
              className="w-9 h-9 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Đóng"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <section className="px-6 py-7 text-center bg-[#22272e]">
              <img
                src={currentAvatar || DEFAULT_AVATAR}
                alt=""
                className="w-20 h-20 rounded-full object-cover mx-auto bg-slate-700 border-2 border-slate-600"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />

              <div className="mt-4 flex items-center justify-center gap-2">
                <h4 className="text-xl font-bold truncate max-w-[250px]">
                  {currentTitle}
                </h4>

                {!selectedGroup && selectedUser && (
                  <button
                    type="button"
                    onClick={() => setShowNicknameModal(true)}
                    className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                    title="Đổi biệt danh"
                  >
                    ✎
                  </button>
                )}
              </div>

              <div
                className={`mt-6 grid gap-3 ${
                  selectedGroup ? "grid-cols-4" : "grid-cols-3"
                }`}
              >
                <button
                  type="button"
                  onClick={handleToggleMuteConversation}
                  className="flex flex-col items-center gap-2 text-sm text-slate-200"
                >
                  <span
                    className={`w-11 h-11 rounded-full flex items-center justify-center ${
                      isCurrentConversationMuted
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-slate-700"
                    }`}
                  >
                    <BellOff size={20} />
                  </span>
                  <span className="text-xs leading-tight">Tắt thông báo</span>
                </button>

                {!selectedGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMessageSearch(true);
                      setInfoPanelOpen(false);
                    }}
                    className="flex flex-col items-center gap-2 text-sm text-slate-200"
                  >
                    <span className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center">
                      <Search size={20} />
                    </span>
                    <span className="text-xs leading-tight">Tìm tin</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTogglePinConversation}
                  className="flex flex-col items-center gap-2 text-sm text-slate-200"
                >
                  <span
                    className={`w-11 h-11 rounded-full flex items-center justify-center ${
                      isCurrentConversationPinned
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-slate-700"
                    }`}
                  >
                    <Pin size={20} />
                  </span>
                  <span className="text-xs leading-tight">Ghim hội thoại</span>
                </button>

                {selectedGroup && (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenAddMemberModal}
                      className="flex flex-col items-center gap-2 text-sm text-slate-200"
                    >
                      <span className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center">
                        <UserPlus size={20} />
                      </span>
                      <span className="text-xs leading-tight">Thêm thành viên</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const section = document.getElementById("group-manage-panel");
                        section?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="flex flex-col items-center gap-2 text-sm text-slate-200"
                    >
                      <span className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center">
                        <Settings size={20} />
                      </span>
                      <span className="text-xs leading-tight">Quản lý nhóm</span>
                    </button>
                  </>
                )}
              </div>
            </section>

            {selectedGroup && (
              <section
                id="group-manage-panel"
                className="border-t border-slate-900 bg-[#1f242b]"
              >
                <div className="px-5 py-4 flex items-center justify-between">
                  <h4 className="text-lg font-bold">Thành viên nhóm</h4>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">
                    {memberRoleLabel(currentGroupRole)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenViewMembersModal}
                  className="w-full px-5 pb-4 flex items-center gap-3 text-left hover:bg-white/5"
                >
                  <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-200">
                    <Users size={21} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{groupMemberCount} thành viên</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Xem danh sách thành viên trong nhóm
                    </div>
                  </div>
                </button>

                {!isRemovedFromGroup && (
                  <div className="px-5 pb-5 space-y-2">
                    <button
                      type="button"
                      onClick={handleOpenAddMemberModal}
                      className="w-full flex items-center gap-3 rounded-lg px-1 py-3 hover:bg-white/5 text-left"
                    >
                      <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-emerald-300">
                        <UserPlus size={20} />
                      </span>
                      <span className="font-semibold">Thêm thành viên</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenRemoveMemberModal}
                      disabled={!isCurrentGroupManager}
                      className="w-full flex items-center gap-3 rounded-lg px-1 py-3 hover:bg-white/5 text-left disabled:opacity-45"
                    >
                      <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-red-300">
                        <UserMinus size={20} />
                      </span>
                      <span className="font-semibold">Xóa thành viên</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenUpdateRoleModal}
                      disabled={!isCurrentGroupOwner}
                      className="w-full flex items-center gap-3 rounded-lg px-1 py-3 hover:bg-white/5 text-left disabled:opacity-45"
                    >
                      <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-blue-300">
                        <Shield size={20} />
                      </span>
                      <div>
                        <div className="font-semibold">Bầu / hạ phó nhóm</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Chỉ trưởng nhóm được thực hiện
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenTransferOwnerModal}
                      disabled={!isCurrentGroupOwner}
                      className="w-full flex items-center gap-3 rounded-lg px-1 py-3 hover:bg-white/5 text-left disabled:opacity-45"
                    >
                      <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-yellow-300">
                        <Crown size={20} />
                      </span>
                      <div>
                        <div className="font-semibold">Chuyển quyền trưởng nhóm</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Chọn thành viên thay bạn làm trưởng nhóm
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenLeaveGroupConfirm}
                      className="w-full flex items-center gap-3 rounded-lg px-1 py-3 hover:bg-red-500/10 text-left text-red-400"
                    >
                      <span className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <LogOut size={20} />
                      </span>
                      <span className="font-semibold">Rời nhóm</span>
                    </button>
                  </div>
                )}
              </section>
            )}

            <section className="border-t border-slate-900 bg-[#1f242b]">
              <div className="px-5 py-4 flex items-center justify-between">
                <h4 className="text-lg font-bold">Ảnh/Video</h4>
                <span className="text-slate-400">⌄</span>
              </div>

              {sharedMediaMessages.length > 0 ? (
                <div className="px-5 pb-5 grid grid-cols-3 gap-2">
                  {sharedMediaMessages.slice(0, 6).map((msg, index) => (
                    <a
                      key={msg.id || msg._id || index}
                      href={resolveChatAsset(msg.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square rounded-md overflow-hidden bg-slate-800 border border-slate-700"
                    >
                      <img
                        src={resolveChatAsset(msg.fileUrl)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="px-5 pb-5 text-sm text-slate-500">
                  Chưa có ảnh hoặc video
                </div>
              )}
            </section>

            <section className="border-t border-slate-900 bg-[#1f242b]">
              <div className="px-5 py-4 flex items-center justify-between">
                <h4 className="text-lg font-bold">File</h4>
                <span className="text-slate-400">⌄</span>
              </div>

              <div className="px-5 pb-5 space-y-3">
                {sharedFileMessages.length > 0 ? (
                  sharedFileMessages.slice(0, 4).map((msg, index) => {
                    const fileName = String(msg.fileUrl || "")
                      .split("/")
                      .pop();

                    return (
                      <a
                        key={msg.id || msg._id || index}
                        href={resolveChatAsset(msg.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-lg hover:bg-white/5 py-2"
                      >
                        <span className="w-11 h-11 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold">
                          {String(fileName || "F").split(".").pop()?.slice(0, 3).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="font-semibold truncate">
                            {fileName || "Tệp đính kèm"}
                          </div>
                          <div className="text-xs text-slate-400">
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleDateString("vi-VN")
                              : ""}
                          </div>
                        </div>
                      </a>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-500">Chưa có file</div>
                )}
              </div>
            </section>

            <section className="border-t border-slate-900 bg-[#1f242b]">
              <div className="px-5 py-4 flex items-center justify-between">
                <h4 className="text-lg font-bold">Link</h4>
                <span className="text-slate-400">⌄</span>
              </div>

              <div className="px-5 pb-5 space-y-3">
                {sharedLinks.length > 0 ? (
                  sharedLinks.slice(0, 3).map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-lg hover:bg-white/5 py-2"
                    >
                      <span className="w-11 h-11 rounded-lg border border-slate-700 flex items-center justify-center text-xl">
                        🔗
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{link.url}</div>
                        <div className="text-xs text-blue-400 truncate">
                          {link.url.replace(/^https?:\/\//, "")}
                        </div>
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Chưa có link</div>
                )}
              </div>
            </section>

            <section className="border-t border-slate-900 bg-[#1f242b]">
              <div className="px-5 py-4 flex items-center justify-between">
                <h4 className="text-lg font-bold">Thiết lập</h4>
                <span className="text-slate-400">⌄</span>
              </div>

              <div className="px-5 pb-5 space-y-1">
                <div className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold">Áp dụng nền cho cả đoạn chat</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Tắt: chỉ mình bạn thấy · Bật: người còn lại hoặc nhóm cùng thấy
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBackgroundShared((prev) => !prev)}
                    className={`w-12 h-7 rounded-full p-1 shrink-0 transition ${
                      backgroundShared ? "bg-blue-500" : "bg-slate-600"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition ${
                        backgroundShared ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <label className="flex items-center gap-3 px-1 py-3 rounded-lg hover:bg-white/5 cursor-pointer">
                  <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                    🖼️
                  </span>
                  <span className="font-semibold">Đổi nền đoạn chat</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleChangeChatBackground}
                  />
                </label>

                {!selectedGroup && selectedUser && (
                  <button
                    type="button"
                    onClick={handleToggleBlockUser}
                    className={`w-full flex items-center gap-3 px-1 py-3 rounded-lg hover:bg-white/5 text-left ${
                      blockStatus.blockedByMe
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    <span className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                      {blockStatus.blockedByMe ? "🔓" : "🚫"}
                    </span>
                    <span className="font-semibold">
                      {blockStatus.blockedByMe
                        ? "Bỏ chặn người dùng"
                        : "Chặn người dùng"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteConversation();
                    setInfoPanelOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-1 py-3 rounded-lg hover:bg-red-500/10 text-left text-red-400"
                >
                  <span className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-xl">
                    🗑️
                  </span>
                  <span className="font-semibold">Xóa hội thoại</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </aside>

      {false && !aiAssistantOpen && (
        <button
          type="button"
          onClick={() => setAiAssistantOpen(true)}
          className="fixed right-6 bottom-6 z-[1100] h-14 px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl flex items-center gap-2 font-semibold transition"
          title="Mở AI Chatbox"
        >
          <span className="text-xl">✨</span>
          AI
        </button>
      )}

      <AiAssistantBox
        open={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        onAsk={handleAskAiAssistant}
      />

      {showForwardModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div className="w-[760px] max-h-[88vh] bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden">
            {/* HEADER */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
              <h3 className="text-xl font-semibold">Chia sẻ</h3>

              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(false);
                  setForwardMessage(null);
                  setSelectedForwardTargets([]);
                }}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-3xl text-slate-600"
              >
                ×
              </button>
            </div>

            {/* SEARCH */}
            <div className="px-6 py-4 border-b border-slate-100">
              <input
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
                placeholder="🔍 Tìm kiếm..."
                className="w-full px-4 py-3 rounded-lg border border-blue-400 outline-none text-slate-900"
              />
            </div>

            <div className="grid grid-cols-[1fr_320px] h-[430px]">
              {/* LEFT */}
              <div className="overflow-y-auto border-r border-slate-200">
                <div className="px-6 py-3 flex gap-6 border-b border-slate-100 text-[16px]">
                  <button className="text-blue-600 font-semibold border-b-2 border-blue-600 pb-2">
                    Gần đây
                  </button>
                  <button className="text-slate-700 pb-2">
                    Nhóm trò chuyện
                  </button>
                  <button className="text-slate-700 pb-2">Bạn bè</button>
                </div>

                <div className="py-2">
                  {forwardTargets
                    .filter((target) =>
                      String(target.name || "")
                        .toLowerCase()
                        .includes(forwardSearch.trim().toLowerCase())
                    )
                    .map((target) => {
                      const key = `${target.type}_${target.id}`;
                      const checked = selectedForwardTargets.some(
                        (item) => `${item.type}_${item.id}` === key
                      );

                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => toggleForwardTarget(target)}
                          className="w-full flex items-center gap-4 px-6 py-3 hover:bg-slate-50 text-left"
                        >
                          <span
                            className={`w-5 h-5 rounded border flex items-center justify-center ${
                              checked
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {checked ? "✓" : ""}
                          </span>

                          <img
                            src={target.avatar || DEFAULT_AVATAR}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover bg-slate-200"
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_AVATAR;
                            }}
                          />

                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 truncate">
                              {target.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {target.type === "GROUP"
                                ? "Nhóm trò chuyện"
                                : "Bạn bè"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* RIGHT */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold">
                    Đã chọn: {selectedForwardTargets.length}/100
                  </div>

                  {selectedForwardTargets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedForwardTargets([])}
                      className="text-blue-600"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {selectedForwardTargets.map((target) => (
                    <div
                      key={`${target.type}_${target.id}`}
                      className="flex items-center gap-3"
                    >
                      <img
                        src={target.avatar || DEFAULT_AVATAR}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover bg-slate-200"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />

                      <div className="flex-1 truncate">{target.name}</div>

                      <button
                        type="button"
                        onClick={() => toggleForwardTarget(target)}
                        className="text-xl text-slate-500 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PREVIEW */}
            <div className="px-6 py-4 border-t border-slate-200">
              <div className="bg-slate-100 rounded-lg px-4 py-3">
                <div className="font-semibold text-sm mb-1">
                  Chia sẻ tin nhắn
                </div>
                <div className="text-slate-700 truncate">
                  {forwardMessage?.originalContent ||
                    forwardMessage?.content ||
                    forwardMessage?.text ||
                    (forwardMessage?.fileUrl ? "Tệp đính kèm" : "Tin nhắn")}
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForwardModal(false);
                  setForwardMessage(null);
                  setSelectedForwardTargets([]);
                }}
                className="px-7 py-3 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={selectedForwardTargets.length === 0}
                onClick={handleForwardToSelected}
                className="px-7 py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50"
              >
                Chia sẻ
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivateInfoModal && selectedUser && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[1000]">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[430px] max-h-[88vh] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* HEADER */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100 bg-white">
              <h3 className="text-[20px] font-semibold text-slate-900">
                Thông tin tài khoản
              </h3>

              <button
                type="button"
                onClick={() => setShowPrivateInfoModal(false)}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-3xl text-slate-600"
              >
                ×
              </button>
            </div>

            {/* BODY CUỘN */}
            <div className="max-h-[calc(88vh-64px)] overflow-y-auto">
              {/* COVER */}
              <div className="h-[190px] bg-slate-200 overflow-hidden">
                {privateInfo?.coverImage ? (
                  <img
                    src={resolveAvatar(privateInfo.coverImage)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-blue-300 via-indigo-300 to-cyan-200" />
                )}
              </div>

              {/* PROFILE */}
              <div className="relative px-6 pt-16 pb-5 bg-white">
                <img
                  src={resolveAvatar(
                    privateInfo?.avatar || selectedUser?.avatar
                  )}
                  alt=""
                  className="absolute -top-12 left-5 w-24 h-24 rounded-full object-cover object-center border-4 border-white bg-slate-200 shadow-md"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />

                <div className="ml-32 -mt-10 min-h-[70px] flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[24px] font-bold text-slate-900 truncate">
                      {friendNickname ||
                        privateInfo?.username ||
                        selectedUser?.username ||
                        "Người dùng"}
                    </h4>

                    <button
                      type="button"
                      onClick={() => {
                        setNicknameInput(friendNickname || "");
                        setShowNicknameModal(true);
                      }}
                      className="text-slate-500 text-xl hover:text-blue-500 transition"
                      title="Đổi biệt danh"
                    >
                      ✎
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        onlineUsers.has(Number(selectedUser?.id))
                          ? "bg-emerald-500"
                          : "bg-slate-400"
                      }`}
                    />

                    <span
                      className={`text-[15px] ${
                        onlineUsers.has(Number(selectedUser?.id))
                          ? "text-emerald-600"
                          : "text-slate-500"
                      }`}
                    >
                      {onlineUsers.has(Number(selectedUser?.id))
                        ? "Đang hoạt động"
                        : "Ngoại tuyến"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPrivateInfoModal(false)}
                  className="w-full mt-5 py-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[17px]"
                >
                  Nhắn tin
                </button>
              </div>

              <div className="h-2 bg-slate-100" />

              {/* PERSONAL INFO */}
              <div className="px-6 py-5 bg-white">
                <h4 className="font-semibold text-slate-900 text-[20px] mb-5">
                  Thông tin cá nhân
                </h4>

                {privateInfoLoading ? (
                  <div className="text-slate-500 text-sm">
                    Đang tải thông tin...
                  </div>
                ) : (
                  <div className="space-y-4 text-[16px]">
                    <div className="grid grid-cols-[130px_1fr] gap-4">
                      <span className="text-slate-500">Giới tính</span>
                      <span className="text-slate-900">
                        {privateInfo?.gender || "Chưa cập nhật"}
                      </span>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] gap-4">
                      <span className="text-slate-500">Ngày sinh</span>
                      <span className="text-slate-900">
                        {privateInfo?.birthday || "Chưa cập nhật"}
                      </span>
                    </div>

                    <div className="grid grid-cols-[130px_1fr] gap-4">
                      <span className="text-slate-500">Điện thoại</span>
                      <span className="text-slate-900">
                        {privateInfo?.phone || "Chưa cập nhật"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-2 bg-slate-100" />

              {/* IMAGE SECTION */}
              <div className="px-6 py-5 bg-white">
                <h4 className="font-semibold text-slate-900 text-[20px] mb-5">
                  Hình ảnh
                </h4>

                <div className="h-24 rounded-lg flex items-center justify-center text-slate-500 text-[16px]">
                  Chưa có ảnh nào được chia sẻ
                </div>
              </div>

              <div className="h-2 bg-slate-100" />

              {/* ACTIONS */}
              <div className="hidden">
                <button
                  type="button"
                  onClick={() => {
                    setShowPrivateInfoModal(false);
                    setShowMessageSearch(true);
                  }}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 text-left"
                >
                  <span className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">
                    🔍
                  </span>
                  <span className="font-medium text-[17px]">Tìm tin nhắn</span>
                </button>

                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100">
                  <div className="pr-4">
                    <div className="font-medium text-[16px] text-slate-900">
                      Áp dụng cho cả đoạn chat
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      Tắt: chỉ mình bạn thấy · Bật: người còn lại hoặc nhóm cùng
                      thấy
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setBackgroundShared((prev) => !prev)}
                    className={`w-12 h-7 rounded-full p-1 transition ${
                      backgroundShared ? "bg-blue-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white transition ${
                        backgroundShared ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <label className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 text-left cursor-pointer">
                  <span className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">
                    🖼️
                  </span>
                  <span className="font-medium text-[17px]">
                    Đổi nền đoạn chat
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleChangeChatBackground(e);
                      setShowPrivateInfoModal(false);
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (blockStatus.blockedByMe) {
                        await unblockUserApi(selectedUser.id);
                        toast.success("Đã bỏ chặn người dùng");
                      } else {
                        await blockUserApi(selectedUser.id);
                        toast.success("Đã chặn người dùng");
                      }

                      const res = await getBlockStatusApi(selectedUser.id);

                      setBlockStatus({
                        blockedByMe: res.data?.blockedByMe ?? false,
                        blockedByOther: res.data?.blockedByOther ?? false,
                      });
                    } catch (error) {
                      console.log("Block/unblock lỗi:", error);
                      toast.error("Thao tác thất bại");
                    }
                  }}
                  className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 text-left ${
                    blockStatus.blockedByMe
                      ? "text-emerald-600"
                      : "text-yellow-600"
                  }`}
                >
                  <span className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">
                    {blockStatus.blockedByMe ? "🔓" : "🚫"}
                  </span>

                  <span className="font-medium text-[17px]">
                    {blockStatus.blockedByMe
                      ? "Bỏ chặn người dùng"
                      : "Chặn người dùng"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteConversation();
                    setShowPrivateInfoModal(false);
                  }}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-red-50 text-left text-red-500"
                >
                  <span className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-xl">
                    🗑
                  </span>
                  <span className="font-medium text-[17px]">Xoá hội thoại</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNicknameModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1100]">
          <div className="w-[420px] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold">Đổi biệt danh</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Biệt danh này chỉ hiển thị với bạn
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNicknameModal(false)}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-2xl text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={resolveAvatar(selectedUser?.avatar)}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover bg-slate-200"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />

                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {selectedUser?.username || "Người dùng"}
                  </div>
                  <div className="text-sm text-slate-500">
                    Tên thật của người này sẽ không bị thay đổi
                  </div>
                </div>
              </div>

              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Biệt danh
              </label>

              <input
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                autoFocus
                maxLength={50}
                placeholder="Nhập biệt danh..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:border-blue-500 text-slate-900"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUpdateNickname();
                  }
                }}
              />

              <div className="text-right text-xs text-slate-400 mt-1">
                {nicknameInput.length}/50
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-between gap-3">
              <button
                type="button"
                disabled={savingNickname || !friendNickname}
                onClick={() => handleUpdateNickname("")}
                className="px-5 py-2.5 rounded-xl bg-red-50 text-red-500 font-semibold hover:bg-red-100 disabled:opacity-50"
              >
                Xoá biệt danh
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={savingNickname}
                  onClick={() => setShowNicknameModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
                >
                  Huỷ
                </button>

                <button
                  type="button"
                  disabled={savingNickname}
                  onClick={() => handleUpdateNickname()}
                  className="px-5 py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50"
                >
                  {savingNickname ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedGroup && showGroupMenu && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[430px] max-h-[88vh] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold">Thông tin nhóm</h3>

              <button
                type="button"
                onClick={() => setShowGroupMenu(false)}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-2xl text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(88vh-65px)] overflow-y-auto">
              {/* GROUP INFO */}
              <div className="px-5 py-5">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <img
                      src={currentAvatar}
                      alt={selectedGroup.name}
                      className="w-20 h-20 rounded-full object-cover bg-slate-200 border border-slate-300"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    {!isRemovedFromGroup && (
                      <label
                        className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-slate-300 shadow flex items-center justify-center cursor-pointer hover:bg-slate-100"
                        title="Đổi ảnh nhóm"
                      >
                        📷
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleChangeGroupAvatar}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-base truncate">
                        {selectedGroup.name}
                      </h4>

                      {!isRemovedFromGroup && (
                        <button
                          type="button"
                          onClick={handleOpenRenameGroupModal}
                          className="text-slate-500 hover:text-blue-500"
                          title="Đổi tên nhóm"
                        >
                          ✎
                        </button>
                      )}
                    </div>

                    <p className="text-sm text-slate-500 mt-1">
                      Nhóm chat · {groupMemberCount} thành viên
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowGroupMenu(false)}
                  className="w-full mt-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-800"
                >
                  Nhắn tin
                </button>

                {isRemovedFromGroup && (
                  <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium leading-relaxed">
                    🚫 Bạn đã bị xoá khỏi nhóm. Bạn chỉ có thể xem lại lịch sử
                    chat trước đó và không thể thao tác với nhóm này.
                  </div>
                )}
              </div>

              <div className="h-2 bg-slate-100" />

              {/* MEMBERS */}
              {!isRemovedFromGroup && (
                <>
                  <div className="h-2 bg-slate-100" />

                  {/* MEMBERS */}
                  <div className="px-5 py-4">
                    <button
                      type="button"
                      onClick={handleOpenViewMembersModal}
                      className="w-full flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-left font-semibold">
                          Thành viên ({groupMemberCount})
                        </h4>
                        <p className="text-sm text-slate-500 mt-1">
                          Xem danh sách thành viên trong nhóm
                        </p>
                      </div>

                      <span className="text-slate-400 text-xl">›</span>
                    </button>
                  </div>
                </>
              )}

              <div className="h-2 bg-slate-100" />

              {/* ACTIONS */}
              {!isRemovedFromGroup && (
                <>
                  <div className="h-2 bg-slate-100" />

                  <div className="py-2">
                    <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
                      <div className="pr-4">
                        <div className="font-medium text-slate-900">
                          Áp dụng nền cho cả nhóm
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Tắt: chỉ mình bạn thấy · Bật: mọi thành viên cùng thấy
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setBackgroundShared((prev) => !prev)}
                        className={`w-12 h-7 rounded-full p-1 transition ${
                          backgroundShared ? "bg-blue-500" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white transition ${
                            backgroundShared ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <label className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left cursor-pointer">
                      <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                        🖼️
                      </span>

                      <div className="flex-1">
                        <div className="font-medium text-slate-900">
                          Đổi nền đoạn chat
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {backgroundShared
                            ? "Đang bật: đổi cho cả nhóm"
                            : "Đang tắt: chỉ mình bạn thấy"}
                        </div>
                      </div>

                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          handleChangeChatBackground(e);
                          setShowGroupMenu(false);
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleOpenAddMemberModal}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                        +
                      </span>
                      <span className="font-medium">Thêm thành viên</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenRemoveMemberModal}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                        −
                      </span>
                      <span className="font-medium text-red-500">
                        Xoá thành viên
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenUpdateRoleModal}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center">
                        🛡
                      </span>
                      <span className="font-medium">Cập nhật quyền</span>
                    </button>
                  </div>
                </>
              )}
              {/* DANGER */}
              {!isRemovedFromGroup && (
                <>
                  <div className="h-2 bg-slate-100" />

                  {/* DANGER */}
                  <div className="py-2">
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50 text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                        🗑
                      </span>
                      <span className="font-medium text-red-500">
                        Giải tán nhóm
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenLeaveGroupConfirm}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50 text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                        🚪
                      </span>
                      <span className="font-medium text-red-500">Rời nhóm</span>
                    </button>
                  </div>
                </>
              )}

              <div className="h-2 bg-slate-100" />

              <div className="py-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteConversation();
                    setShowGroupMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-red-50 text-left"
                >
                  <span className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                    🗑
                  </span>

                  <div>
                    <div className="font-medium text-red-500">
                      Xoá hội thoại
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLeaveConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1200]">
          <div className="w-[460px] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Rời nhóm?
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Bạn vẫn có thể xem lại lịch sử chat trước đó
                </p>
              </div>

              <button
                type="button"
                disabled={leavingGroup}
                onClick={() => setShowLeaveConfirmModal(false)}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-2xl text-slate-600 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl">
                  🚪
                </div>

                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {selectedGroup?.name || "Nhóm chat"}
                  </div>
                  <div className="text-sm text-slate-500">
                    Sau khi rời nhóm, bạn không thể nhắn tiếp trong nhóm này.
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 leading-relaxed">
                Bạn có chắc muốn rời khỏi nhóm này không?
              </div>

              {isCurrentGroupOwner && ownerTransferCandidates.length > 0 && (
                <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="font-semibold text-yellow-800">
                    Chọn trưởng nhóm mới trước khi rời
                  </div>
                  <div className="text-xs text-yellow-700 mt-1">
                    Hệ thống sẽ chuyển quyền cho người này rồi mới cho bạn rời nhóm.
                  </div>

                  <div className="mt-3 max-h-48 overflow-y-auto space-y-2">
                    {ownerTransferCandidates.map((member) => (
                      <button
                        type="button"
                        key={member.id}
                        onClick={() => setSelectedOwnerTransferId(Number(member.id))}
                        className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                          Number(selectedOwnerTransferId) === Number(member.id)
                            ? "border-yellow-500 bg-white"
                            : "border-transparent bg-white/60 hover:bg-white"
                        }`}
                      >
                        <img
                          src={resolveAvatar(member?.avatar)}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                          className="w-10 h-10 rounded-full object-cover bg-slate-200"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">
                            {member.username}
                          </div>
                          <div className="text-xs text-slate-500">
                            {memberRoleLabel(member.role)}
                          </div>
                        </div>
                        {Number(selectedOwnerTransferId) === Number(member.id) && (
                          <Crown size={18} className="text-yellow-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                disabled={leavingGroup}
                onClick={() => setShowLeaveConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
              >
                Huỷ
              </button>

              <button
                type="button"
                disabled={leavingGroup}
                onClick={handleConfirmLeaveGroup}
                className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {leavingGroup ? "Đang rời..." : "Rời nhóm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPollModal && roomId && (
        <CreatePollModal
          roomId={roomId}
          onClose={() => setShowPollModal(false)}
          onCreated={async () => {
            setShowPollModal(false);
            await reloadCurrentRoom();
          }}
        />
      )}

      {showRenameGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000]">
          <div className="w-[420px] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-white text-lg font-semibold">
                  Đổi tên nhóm
                </h3>
                <p className="text-slate-400 text-sm mt-0.5">
                  Nhập tên mới cho nhóm chat
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRenameGroupModal(false)}
                className="w-9 h-9 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <label className="text-slate-300 text-sm mb-2 block">
                Tên nhóm
              </label>

              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                autoFocus
                maxLength={80}
                placeholder="Nhập tên nhóm..."
                className="w-full px-4 py-3 rounded-xl bg-slate-900/70 border border-slate-600 text-white outline-none focus:border-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleUpdateGroupName();
                  }
                }}
              />

              <div className="text-right text-xs text-slate-500 mt-1">
                {newGroupName.length}/80
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                type="button"
                disabled={renamingGroup}
                onClick={() => setShowRenameGroupModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
              >
                Huỷ
              </button>

              <button
                type="button"
                disabled={renamingGroup || !newGroupName.trim()}
                onClick={handleUpdateGroupName}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {renamingGroup ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewMembersModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div className="w-[430px] max-h-[88vh] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* HEADER */}
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Thành viên nhóm
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {selectedGroup?.name} ·{" "}
                  {viewMembersLoading
                    ? "Đang tải..."
                    : `${viewMembersList.length} người`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowViewMembersModal(false)}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-2xl text-slate-600"
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="max-h-[calc(88vh-64px)] overflow-y-auto scrollbar-thin">
              {viewMembersLoading ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Đang tải danh sách thành viên...
                </div>
              ) : viewMembersList.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Không có dữ liệu thành viên
                </div>
              ) : (
                <div className="py-2">
                  {viewMembersList.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition"
                    >
                      <img
                        src={resolveAvatar(member?.avatar)}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                        className="w-12 h-12 rounded-full object-cover bg-slate-200 shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-900 truncate">
                            {member.username}
                          </div>

                          {Number(member.id) === Number(currentUserId) && (
                            <span className="text-xs text-slate-500">
                              (bạn)
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-slate-500 mt-0.5">
                          {memberRoleLabel(member.role)}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          member.role === "OWNER"
                            ? "bg-yellow-50 text-yellow-600"
                            : member.role === "ADMIN"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {memberRoleLabel(member.role)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999]">
          <div className="w-[460px] max-h-[88vh] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* HEADER */}
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Thêm thành viên
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Chọn bạn bè để thêm vào nhóm
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedMemberIds([]);
                }}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-2xl text-slate-600"
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="max-h-[calc(88vh-144px)] overflow-y-auto">
              {friendCandidates.length === 0 ? (
                <div className="py-14 px-5 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-3xl mb-3">
                    👥
                  </div>
                  <div className="font-semibold text-slate-800">
                    Không có bạn bè để thêm
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Tất cả bạn bè của bạn có thể đã ở trong nhóm
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  {friendCandidates.map((friend, index) => {
                    const friendId = getFriendId(friend);
                    const checked = selectedMemberIds.includes(friendId);

                    return (
                      <button
                        type="button"
                        key={friendId || index}
                        onClick={() => toggleSelectMember(friend)}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition ${
                          checked ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            checked
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {checked && <span className="text-xs">✓</span>}
                        </div>

                        <img
                          src={resolveAvatar(friend?.avatar)}
                          alt={getFriendName(friend)}
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                          className="w-12 h-12 rounded-full object-cover bg-slate-200 shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {getFriendName(friend)}
                          </div>
                          <div className="text-sm text-slate-500 mt-0.5">
                            Bạn bè
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="h-20 px-5 border-t border-slate-200 bg-white flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Đã chọn{" "}
                <span className="font-semibold text-blue-600">
                  {selectedMemberIds.length}
                </span>{" "}
                thành viên
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setSelectedMemberIds([]);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                >
                  Huỷ
                </button>

                <button
                  type="button"
                  onClick={handleAddMembersToGroup}
                  disabled={selectedMemberIds.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Thêm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRemoveMemberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999]">
          <div className="w-[460px] max-h-[88vh] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* HEADER */}
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Xoá thành viên
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Chọn thành viên muốn xoá khỏi nhóm
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowRemoveMemberModal(false);
                  setSelectedMemberIds([]);
                }}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-2xl text-slate-600"
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="max-h-[calc(88vh-144px)] overflow-y-auto">
              {memberCandidates.length === 0 ? (
                <div className="py-14 px-5 text-center">
                  <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto text-3xl mb-3">
                    −
                  </div>
                  <div className="font-semibold text-slate-800">
                    Không có thành viên để xoá
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Chủ nhóm và chính bạn sẽ không hiển thị trong danh sách này
                  </div>
                </div>
              ) : (
                <div className="py-2">
                  {memberCandidates.map((member, index) => {
                    const memberId = getFriendId(member);
                    const checked = selectedMemberIds.includes(memberId);

                    return (
                      <button
                        type="button"
                        key={memberId || index}
                        onClick={() => toggleSelectMember(member)}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition ${
                          checked ? "bg-red-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            checked
                              ? "border-red-500 bg-red-500 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {checked && <span className="text-xs">✓</span>}
                        </div>

                        <img
                          src={resolveAvatar(member?.avatar)}
                          alt={getFriendName(member)}
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                          className="w-12 h-12 rounded-full object-cover bg-slate-200 shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {getFriendName(member)}
                          </div>

                          <div className="text-sm text-slate-500 mt-0.5">
                            {memberRoleLabel(member.role)}
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            member.role === "ADMIN"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {memberRoleLabel(member.role)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="h-20 px-5 border-t border-slate-200 bg-white flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Đã chọn{" "}
                <span className="font-semibold text-red-500">
                  {selectedMemberIds.length}
                </span>{" "}
                thành viên
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRemoveMemberModal(false);
                    setSelectedMemberIds([]);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                >
                  Huỷ
                </button>

                <button
                  type="button"
                  onClick={handleRemoveMembersFromGroup}
                  disabled={selectedMemberIds.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Xoá khỏi nhóm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTransferOwnerModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000]">
          <div className="w-[460px] max-h-[88vh] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Chuyển quyền trưởng nhóm
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Chọn một thành viên làm trưởng nhóm mới
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowTransferOwnerModal(false);
                  setSelectedOwnerTransferId(null);
                }}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-2xl text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(88vh-144px)] overflow-y-auto">
              {ownerTransferCandidates.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Không có thành viên phù hợp để chuyển quyền
                </div>
              ) : (
                <div className="p-5 space-y-2">
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 leading-relaxed">
                    Sau khi chuyển quyền, bạn sẽ trở thành phó nhóm. Trưởng nhóm mới sẽ có toàn quyền quản lý nhóm.
                  </div>

                  {ownerTransferCandidates.map((member) => (
                    <button
                      type="button"
                      key={member.id}
                      onClick={() => setSelectedOwnerTransferId(Number(member.id))}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        Number(selectedOwnerTransferId) === Number(member.id)
                          ? "border-yellow-500 bg-yellow-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <img
                        src={resolveAvatar(member?.avatar)}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                        className="w-11 h-11 rounded-full object-cover bg-slate-200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 truncate">
                          {member.username}
                        </div>
                        <div className="text-sm text-slate-500">
                          {memberRoleLabel(member.role)}
                        </div>
                      </div>
                      {Number(selectedOwnerTransferId) === Number(member.id) && (
                        <Crown size={20} className="text-yellow-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-20 px-5 border-t border-slate-200 bg-white flex justify-end items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowTransferOwnerModal(false);
                  setSelectedOwnerTransferId(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                Huỷ
              </button>

              <button
                type="button"
                onClick={() => handleTransferOwner(selectedOwnerTransferId)}
                disabled={!selectedOwnerTransferId}
                className="px-5 py-2.5 rounded-xl bg-yellow-500 text-white font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Chuyển quyền
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpdateRoleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div className="w-[460px] max-h-[88vh] bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* HEADER */}
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Cập nhật quyền
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Chọn thành viên và phân quyền mới
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowUpdateRoleModal(false)}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-2xl text-slate-600"
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="max-h-[calc(88vh-144px)] overflow-y-auto scrollbar-thin">
              {roleCandidates.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Không có thành viên phù hợp để cập nhật quyền
                </div>
              ) : (
                <div className="py-2">
                  {roleCandidates.map((member, index) => {
                    const isSelected = selectedRoleUserId === member.id;

                    return (
                      <button
                        type="button"
                        key={member.id || index}
                        onClick={() => {
                          setSelectedRoleUserId(member.id);
                          setSelectedRoleValue(member.role || "MEMBER");
                        }}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition ${
                          isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-blue-500 bg-blue-500"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>

                        <img
                          src={resolveAvatar(member?.avatar)}
                          alt={getFriendName(member)}
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_AVATAR;
                          }}
                          className="w-12 h-12 rounded-full object-cover bg-slate-200 shrink-0"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {getFriendName(member)}
                          </div>

                          <div className="text-sm text-slate-500 mt-0.5">
                            Quyền hiện tại:{" "}
                            <span
                              className={`font-semibold ${
                                member.role === "ADMIN"
                                  ? "text-blue-600"
                                  : member.role === "OWNER"
                                  ? "text-yellow-600"
                                  : "text-slate-600"
                              }`}
                            >
                              {memberRoleLabel(member.role)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <div className="h-2 bg-slate-100 mt-2" />

                  <div className="px-5 py-4">
                    <label className="text-slate-900 font-semibold mb-3 block">
                      Quyền mới
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedRoleValue("MEMBER")}
                        className={`p-3 rounded-xl border text-left transition ${
                          selectedRoleValue === "MEMBER"
                            ? "bg-blue-50 border-blue-500 text-blue-700"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-semibold">Thành viên</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Nhắn tin, xem nhóm
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRoleValue("ADMIN")}
                        className={`p-3 rounded-xl border text-left transition ${
                          selectedRoleValue === "ADMIN"
                            ? "bg-blue-50 border-blue-500 text-blue-700"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-semibold">Phó nhóm</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Được xoá thành viên và quản lý nhóm
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="h-20 px-5 border-t border-slate-200 bg-white flex justify-end items-center gap-3">
              <button
                type="button"
                onClick={() => setShowUpdateRoleModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                Huỷ
              </button>

              <button
                type="button"
                onClick={handleUpdateRole}
                disabled={!selectedRoleUserId}
                className="px-5 py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}

      {(showProfile || showChangePassword) && (
        <div className="fixed inset-0 flex items-center justify-center z-[999]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setShowProfile(false);
              setShowChangePassword(false);
            }}
          ></div>

          <div className="relative z-[1000] shadow-2xl">
            {showProfile && (
              <ProfileModal
                onClose={() => setShowProfile(false)}
                refreshUser={fetchUser}
              />
            )}
            {showChangePassword && (
              <ChangePasswordModal
                onClose={() => setShowChangePassword(false)}
              />
            )}
          </div>
        </div>
      )}

      {incomingCall && callStatus === "RINGING" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1500]">
          <div className="w-[360px] bg-white text-slate-900 rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto text-4xl mb-4">
              📞
            </div>

            <h3 className="text-xl font-bold">
              {incomingCall.callerName || "Ai đó"} đang gọi
            </h3>

            <p className="text-sm text-slate-500 mt-1">Cuộc gọi thoại đến</p>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={rejectCall}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600"
              >
                Từ chối
              </button>

              <button
                type="button"
                onClick={acceptCall}
                className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600"
              >
                Nghe máy
              </button>
            </div>
          </div>
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay playsInline />
      {callStatus !== "IDLE" && callStatus !== "RINGING" && (
        <div className="fixed inset-0 z-[1500] bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 flex items-center justify-center">
          <div className="w-[520px] h-[780px] max-h-[92vh] bg-[#9ca3af] rounded-[24px] shadow-2xl overflow-hidden border border-white/20 flex flex-col">
            {/* TOP BAR */}
            <div className="h-[58px] bg-[#f4f4f5] flex items-center justify-between px-5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500"></span>
                <span className="w-3.5 h-3.5 rounded-full bg-yellow-400"></span>
                <span className="w-3.5 h-3.5 rounded-full bg-green-500"></span>
              </div>

              <div className="font-bold text-slate-700 text-[17px]">
                Zalo Call - {user?.username || "Bạn"}
              </div>

              <button
                type="button"
                onClick={endCall}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center"
                title="Đóng"
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="relative flex-1 bg-[#9ca3af] flex items-center justify-center">
              <div className="absolute top-0 left-0 bg-black px-6 py-4 text-emerald-400 font-mono text-[24px] font-bold tracking-wider">
                {callTimeText}
              </div>

              <div className="flex flex-col items-center">
                <div className="w-[190px] h-[190px] rounded-full bg-white/85 border-4 border-white/70 shadow-xl flex items-center justify-center overflow-hidden">
                  <img
                    src={resolveAvatar(selectedUser?.avatar)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                </div>

                <div className="mt-6 text-center">
                  <div className="text-white text-2xl font-bold drop-shadow">
                    {selectedUser?.username ||
                      incomingCall?.callerName ||
                      "Người dùng"}
                  </div>

                  <div className="text-white/80 text-sm mt-1">
                    {callStatus === "CALLING"
                      ? "Đang gọi..."
                      : "Đang trong cuộc gọi"}
                  </div>
                </div>
              </div>
            </div>

            {/* CONTROL BAR */}
            <div className="h-[96px] bg-black flex items-center justify-center gap-7 shrink-0">
              <button
                type="button"
                onClick={toggleCameraPlaceholder}
                className="h-14 min-w-[150px] px-6 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center gap-4 transition [&>span]:hidden"
                title="Mở camera"
              >
                <Video size={25} strokeWidth={2.2} />
                <ChevronUp size={20} className="text-white/70" />
                <span className="text-2xl">🎥</span>
                <span className="text-white/70 text-xl">⌃</span>
              </button>

              <button
                type="button"
                onClick={endCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition [&>span]:hidden"
                title="Kết thúc cuộc gọi"
              >
                <PhoneOff size={30} strokeWidth={2.4} />
              </button>

              <button
                type="button"
                onClick={toggleMic}
                className={`h-14 min-w-[150px] px-6 rounded-full border flex items-center justify-center gap-4 transition [&>span]:hidden ${
                  isMicMuted
                    ? "bg-red-500/20 border-red-400 text-red-300"
                    : "bg-white/5 border-white/15 text-white hover:bg-white/10"
                }`}
                title={isMicMuted ? "Bật micro" : "Tắt micro"}
              >
                {isMicMuted ? (
                  <MicOff size={26} strokeWidth={2.2} />
                ) : (
                  <Mic size={26} strokeWidth={2.2} />
                )}
                <ChevronUp size={20} className="text-white/70" />
                <span className="text-3xl">{isMicMuted ? "🔇" : "🎙️"}</span>
                <span className="text-white/70 text-xl">⌃</span>
              </button>

              <button
                type="button"
                onClick={() => toast.info("Cài đặt cuộc gọi sẽ làm sau")}
                className="w-14 h-14 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition [&>span]:hidden"
                title="Cài đặt"
              >
                <Settings size={28} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPage;

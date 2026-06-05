import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Sidebar from "../components/Sidebar";
import ChatBox from "../components/chatBox";
import ChatInput from "../components/ChatInput";
import CreateGroup from "../components/CreateGroup";

import FriendsList from "../../friend/components/FriendsList";
import FriendRequests from "../../friend/components/FriendRequests";
import FriendSearch from "../../friend/components/FriendSearch";

import useChat from "../hooks/useChat";
import useUser from "../hooks/useUser";

import ProfileModal from "../../user/components/ProfileModal";
import ChangePasswordModal from "../../user/components/ChangePasswordModal";

import {
  disconnectSocket,
  joinRoom,
  leaveRoom,
  subscribeOnlineList,
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
  leaveGroupApi,
  getMessagesApi,
} from "../api/chatApi";

import { getFriendsApi } from "../../friend/api/friendApi";

import {
  connectSocket,
  sendMessageSocket,
  subscribeGroupUpdates,
  subscribeUserStatus,
} from "../socket/socket";

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

  const [showMenu, setShowMenu] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [groupMemberCount, setGroupMemberCount] = useState(0);

  const [showViewMembersModal, setShowViewMembersModal] = useState(false);
  const [viewMembersList, setViewMembersList] = useState([]);
  const [viewMembersLoading, setViewMembersLoading] = useState(false);

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [showUpdateRoleModal, setShowUpdateRoleModal] = useState(false);

  const [friendCandidates, setFriendCandidates] = useState([]);
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [roleCandidates, setRoleCandidates] = useState([]);

  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [selectedRoleUserId, setSelectedRoleUserId] = useState(null);
  const [selectedRoleValue, setSelectedRoleValue] = useState("MEMBER");

  const [forwardMessage, setForwardMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isRemovedFromGroup, setIsRemovedFromGroup] = useState(false);

  const [blockStatus, setBlockStatus] = useState({
    blockedByMe: false,
    blockedByOther: false,
  });

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);

  const currentUserId = user?.id || user?._id;

  // id dùng cho UI
  const groupConversationId = (groupId) => `group_${groupId}`;

  // roomId thật dùng cho API/socket/backend
  const groupRoomId = (groupId) => String(groupId);

  const conversationStorageKey = useMemo(() => {
    if (!currentUserId) return null;
    return `chat_conversations_${currentUserId}`;
  }, [currentUserId]);

  const resolveAvatar = (avatar) => {
    if (!avatar) return DEFAULT_AVATAR;
    if (avatar.startsWith("data:image")) return avatar;
    if (avatar.startsWith("http")) return avatar;
    return `http://localhost:8080${avatar}`;
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
    if (r === "ADMIN") return "Quản trị";

    return "Thành viên";
  };

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

      username: isMe
        ? user?.username || "Bạn"
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

  const upsertConversation = (conversation) => {
    setConversations((prev) => {
      const existed = prev.find((item) => item.id === conversation.id);

      if (existed) {
        return [
          { ...existed, ...conversation },
          ...prev.filter((item) => item.id !== conversation.id),
        ];
      }

      return [conversation, ...prev];
    });
  };

  const moveConversationToTop = (targetRoomId) => {
    if (!targetRoomId) return;

    setConversations((prev) => {
      const index = prev.findIndex((item) => item.roomId === targetRoomId);

      if (index <= 0) return prev;

      const matched = prev[index];

      return [matched, ...prev.filter((_, i) => i !== index)];
    });
  };

  const handleForwardClick = (msg) => {
    setForwardMessage(msg);
    setShowForwardModal(true);
  };

  const handleForwardToTarget = (target) => {
    if (!forwardMessage || !currentUserId) return;

    const isGroupTarget = target?.type === "GROUP";

    const targetId = isGroupTarget
      ? target?.id
      : target?.friendId || target?.userId || target?.id;

    if (!targetId) {
      toast.error("Không xác định được người nhận");
      return;
    }

    const newRoomId = isGroupTarget
      ? groupRoomId(targetId)
      : [Number(currentUserId), Number(targetId)]
          .sort((a, b) => a - b)
          .join("_");

    const msg = {
      senderId: Number(currentUserId),
      receiverId: isGroupTarget ? null : Number(targetId),
      roomId: newRoomId,
      groupId: isGroupTarget ? String(targetId) : null,
      isGroup: isGroupTarget,
      content: forwardMessage.content,
      fileUrl: forwardMessage.fileUrl,
      type: forwardMessage.type === "FILE" ? "FILE" : "FORWARD",
      originalSenderId: forwardMessage.senderId,
      originalContent: forwardMessage.content,
      originalMessageId: forwardMessage.id,
    };

    sendMessageSocket(msg);

    setShowForwardModal(false);
    setForwardMessage(null);
  };

  const forwardableGroups = useMemo(() => {
    return conversations.filter((conversation) => {
      if (conversation.type !== "GROUP") return false;
      if (!selectedGroup?.id) return true;

      return String(conversation.targetGroup?.id) !== String(selectedGroup.id);
    });
  }, [conversations, selectedGroup]);

  const handleLeaveGroup = async () => {
    if (!selectedGroup?.id || !currentUserId) return;

    if (!window.confirm("Bạn có chắc muốn rời nhóm?")) return;

    try {
      await leaveGroupApi(selectedGroup.id);

      setConversations((prev) =>
        prev.filter((item) => item.id !== groupConversationId(selectedGroup.id))
      );

      setSelectedGroup(null);
      setSelectedConversationId(null);
      setMessages([]);
      setShowGroupMenu(false);

      toast.success("Đã rời nhóm 👋");
    } catch (error) {
      const message = error?.response?.data || "Rời nhóm thất bại";

      if (String(message).includes("Chủ nhóm")) {
        toast.error("Bạn phải chuyển quyền trước khi rời nhóm");
        return;
      }

      toast.error(message);
    }
  };

  useEffect(() => {
    if (!conversationStorageKey) return;

    try {
      const saved = localStorage.getItem(conversationStorageKey);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const normalized = parsed.map((item) => {
            if (item.type === "GROUP") {
              const groupId =
                item.targetGroup?.id ||
                String(item.id || "").replace(/^group_/, "");

              return {
                ...item,
                id: groupConversationId(groupId),
                roomId: groupRoomId(groupId),
                targetGroup: {
                  ...(item.targetGroup || {}),
                  id: groupId,
                  name: item.targetGroup?.name || item.name,
                },
              };
            }

            return item;
          });

          setConversations(normalized);
        }
      }
    } catch (error) {
      console.log("Load conversations localStorage lỗi:", error);
    }
  }, [conversationStorageKey]);

  useEffect(() => {
    if (!conversationStorageKey) return;

    try {
      localStorage.setItem(conversationStorageKey, JSON.stringify(conversations));
    } catch (error) {
      console.log("Save conversations localStorage lỗi:", error);
    }
  }, [conversations, conversationStorageKey]);

  useEffect(() => {
    if (!user?.id) return;

    let statusSub = null;
    let listSub = null;
    let groupSub = null;

    const userId = Number(user.id);

    const syncMyGroups = async (focusGroupId = null) => {
      try {
        const res = await getMyGroupsApi(userId);

        const groupConversations = res.data.map((group) => ({
          id: groupConversationId(group.id),
          type: "GROUP",
          name: group.name,
          avatar: DEFAULT_AVATAR,
          roomId: groupRoomId(group.id),
          unreadCount: 0,
          targetGroup: {
            id: group.id,
            name: group.name,
          },
        }));

        setConversations((prev) => {
          const privateConversations = prev.filter((c) => c.type !== "GROUP");

          const prevUnread = new Map(
            prev
              .filter((c) => c.type === "GROUP")
              .map((c) => [c.id, Number(c.unreadCount || 0)])
          );

          const mergedGroups = groupConversations.map((g) => ({
            ...g,
            unreadCount: prevUnread.get(g.id) ?? 0,
          }));

          if (focusGroupId) {
            const targetConversationId = groupConversationId(focusGroupId);
            const idx = mergedGroups.findIndex(
              (g) => g.id === targetConversationId
            );

            if (idx > 0) {
              const [picked] = mergedGroups.splice(idx, 1);
              mergedGroups.unshift(picked);
            }
          }

          return [...mergedGroups, ...privateConversations];
        });
      } catch (err) {
        console.error("Sync group realtime lỗi:", err);
      }
    };

    connectSocket(user.id, () => {
      listSub = subscribeOnlineList((list) => {
        const newSet = new Set(list.map((id) => Number(id)));
        setOnlineUsers(newSet);
      });

      statusSub = subscribeUserStatus((data) => {
        setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          const uid = Number(data.userId);

          if (data.status === "ONLINE") {
            newSet.add(uid);
          } else {
            newSet.delete(uid);
          }

          return newSet;
        });
      });

      syncMyGroups();

      groupSub = subscribeGroupUpdates(userId, (event) => {
        const action = String(event?.action || "");
        const groupId = String(event?.groupId || "").trim();
        const roomId = groupId ? groupRoomId(groupId) : null;

        syncMyGroups(groupId || null);

        if (roomId) {
          moveConversationToTop(roomId);
        }

        const actionMessage = {
          GROUP_CREATED: "Bạn vừa được thêm vào một nhóm mới",
          GROUP_MEMBER_ADDED: "Bạn vừa được thêm vào nhóm",
          GROUP_MEMBER_REMOVED: "Bạn đã rời nhóm / bị xoá khỏi nhóm",
          GROUP_DELETED: "Nhóm đã được giải tán",
          GROUP_RENAMED: "Nhóm đã được đổi tên",
          GROUP_BACKGROUND_CHANGED: "Nền nhóm đã được thay đổi",
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
    };
  }, [user?.id]);

  const roomId = useMemo(() => {
    if (selectedGroup) {
      return groupRoomId(selectedGroup.id);
    }

    if (!currentUserId || (!selectedUser && !selectedGroup)) return null;

    return [Number(currentUserId), Number(selectedUser.id)]
      .sort((a, b) => a - b)
      .join("_");
  }, [currentUserId, selectedUser, selectedGroup]);

  const handleSelectConversation = async (conversation) => {
    setSelectedConversationId(conversation.id);

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
      setBlockStatus({
        blockedByMe: false,
        blockedByOther: false,
      });
      return;
    }

    setSelectedGroup(null);
    setIsRemovedFromGroup(false);
    setSelectedUser(conversation.targetUser);

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

  const handleSelectGroup = (group) => {
    const conversation = {
      id: groupConversationId(group.id),
      type: "GROUP",
      name: group.name,
      avatar: DEFAULT_AVATAR,
      roomId: groupRoomId(group.id),
      unreadCount: 0,
      targetGroup: {
        id: group.id,
        name: group.name,
      },
    };

    upsertConversation(conversation);

    setSelectedConversationId(conversation.id);
    setSelectedGroup({
      id: group.id,
      name: group.name,
    });
    setIsRemovedFromGroup(false);
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

      setConversations((prev) =>
        prev.filter((item) => item.roomId !== roomId)
      );

      setShowMenu(false);
    } catch (error) {
      console.error("Lỗi xoá hội thoại:", error);
    }
  };

  useEffect(() => {
    if (!currentUserId) return;

    const fetchGroups = async () => {
      try {
        const res = await getMyGroupsApi(currentUserId);

        const groupConversations = res.data.map((group) => ({
          id: groupConversationId(group.id),
          type: "GROUP",
          name: group.name,
          avatar: DEFAULT_AVATAR,
          roomId: groupRoomId(group.id),
          unreadCount: 0,
          targetGroup: {
            id: group.id,
            name: group.name,
          },
        }));

        setConversations((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newOnes = groupConversations.filter(
            (g) => !existingIds.has(g.id)
          );

          return [...newOnes, ...prev];
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
        console.log("LOAD HISTORY roomId:", roomId);

        const res = await getMessagesApi(roomId);

        console.log("API DATA:", res.data);

        const history = res.data.map((msg) => ({
          id: msg.id || msg._id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          roomId: msg.roomId,
          groupId: msg.groupId,
          isGroup: msg.isGroup,
          content: msg.content,
          createdAt: msg.createdAt,
          deletedBy: msg.deletedBy,
          isDeleted: msg.isDeleted,
          isRecalled: msg.isRecalled,
          isPinned: msg.isPinned,
          pinnedAt: msg.pinnedAt,
          pinnedBy: msg.pinnedBy,
          fileUrl: msg.fileUrl,
          type: msg.type,
          originalSenderId: msg.originalSenderId,
          originalContent: msg.originalContent,
          originalMessageId: msg.originalMessageId,
        }));

        setMessages(history);
      } catch (err) {
        console.error("Load history lỗi:", err);
      }
    };

    setMessages([]);
    loadHistory();
  }, [roomId, setMessages]);

  useEffect(() => {
    if (!selectedGroup?.id || !currentUserId) {
      setIsRemovedFromGroup(false);
      return;
    }

    const checkGroupMembership = async () => {
      try {
        const res = await getGroupMembersApi(selectedGroup.id);

        const memberIds = Array.isArray(res.data)
          ? res.data.map((m) => Number(m?.userId)).filter(Boolean)
          : [];

        const isMember = memberIds.includes(Number(currentUserId));

        setIsRemovedFromGroup(!isMember);
      } catch (error) {
        setIsRemovedFromGroup(true);
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
        conversations
          .map((conversation) => conversation.roomId)
          .filter(Boolean)
          .map(String)
      ),
    ];

    roomIds.forEach((joinedRoomId) => {
      joinRoom(
        joinedRoomId,
        (message) => {
          if (!message) return;

          const incomingRoomId = String(message.roomId || joinedRoomId);

          const incomingConversationId =
            message.isGroup || message.groupId
              ? groupConversationId(message.groupId || incomingRoomId)
              : `private_${incomingRoomId}`;

          moveConversationToTop(incomingRoomId);

          const isActiveConversation =
            selectedConversationId === incomingConversationId;

          if (isActiveConversation) {
            addMessage({
              id: message.id,
              senderId: message.senderId,
              receiverId: message.receiverId,
              roomId: message.roomId,
              groupId: message.groupId,
              isGroup: message.isGroup,
              content: message.content,
              createdAt: message.createdAt,
              isDeleted: message.isDeleted,
              isRecalled: message.isRecalled,
              isPinned: message.isPinned,
              fileUrl: message.fileUrl,
              type: message.type,
              originalSenderId: message.originalSenderId,
              originalContent: message.originalContent,
              originalMessageId: message.originalMessageId,
            });
            return;
          }

          if (Number(message.senderId) === Number(currentUserId)) return;

          setConversations((prev) =>
            prev.map((conversation) =>
              conversation.id === incomingConversationId
                ? {
                    ...conversation,
                    unreadCount: (conversation.unreadCount || 0) + 1,
                  }
                : conversation
            )
          );
        },
        (deletedId) => {
          const activeConversation = conversations.find(
            (conversation) => conversation.id === selectedConversationId
          );

          if (!activeConversation || activeConversation.roomId !== joinedRoomId) {
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
        (recallId) => {
          const activeConversation = conversations.find(
            (conversation) => conversation.id === selectedConversationId
          );

          if (!activeConversation || activeConversation.roomId !== joinedRoomId) {
            return;
          }

          setMessages((prev) =>
            prev.map((m) =>
              String(m.id || m._id) === String(recallId)
                ? { ...m, isRecalled: true }
                : m
            )
          );
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
  ]);

  const handleSendMessage = () => {
    if (selectedGroup && isRemovedFromGroup) {
      toast.error(
        "Bạn đã bị xoá ra khỏi nhóm và không thể trả lời cuộc trò chuyện này"
      );
      return;
    }

    if (!selectedGroup && (blockStatus.blockedByMe || blockStatus.blockedByOther)) {
      toast.error("Không thể gửi tin nhắn");
      return;
    }

    if (!input?.trim()) return;
    if (!currentUserId || (!selectedUser && !selectedGroup)) return;

    const msg = {
      senderId: Number(currentUserId),
      receiverId: selectedGroup ? null : Number(selectedUser?.id),
      roomId,
      groupId: selectedGroup ? String(selectedGroup.id) : null,
      isGroup: !!selectedGroup,
      content: input.trim(),
      type: "TEXT",
      fileUrl: null,
    };

    console.log("WEB SEND MESSAGE:", msg);

    sendMessageSocket(msg);

    if (selectedGroup) {
      upsertConversation({
        id: groupConversationId(selectedGroup.id),
        type: "GROUP",
        name: selectedGroup.name,
        avatar: DEFAULT_AVATAR,
        roomId: groupRoomId(selectedGroup.id),
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
        targetUser: selectedUser,
      });
    }

    setInput("");
  };

  const handleSendFile = (fileUrl) => {
    if (selectedGroup && isRemovedFromGroup) {
      toast.error(
        "Bạn đã bị xoá ra khỏi nhóm và không thể trả lời cuộc trò chuyện này"
      );
      return;
    }

    if (!selectedGroup && (blockStatus.blockedByMe || blockStatus.blockedByOther)) {
      toast.error("Bạn đã chặn người này");
      return;
    }

    if (!currentUserId || (!selectedUser && !selectedGroup)) return;

    const msg = {
      senderId: Number(currentUserId),
      receiverId: selectedGroup ? null : Number(selectedUser?.id),
      roomId,
      groupId: selectedGroup ? String(selectedGroup.id) : null,
      isGroup: !!selectedGroup,
      type: "FILE",
      fileUrl,
      content: "Tệp đính kèm",
    };

    console.log("WEB SEND FILE:", msg);

    sendMessageSocket(msg);
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
      name: targetUser.username,
      avatar: resolveAvatar(targetUser.avatar),
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

    setShowGroupMenu(false);
    setShowViewMembersModal(true);
    setViewMembersLoading(true);
    setViewMembersList([]);

    try {
      const [friendsRes, membersRes] = await Promise.all([
        getFriendsApi(),
        getGroupMembersApi(selectedGroup.id),
      ]);

      const friends = Array.isArray(friendsRes.data) ? friendsRes.data : [];

      const friendById = new Map(
        friends.map((friend) => [getFriendId(friend), friend])
      );

      const members = Array.isArray(membersRes.data) ? membersRes.data : [];

      const rows = members
        .map((m) => enrichMemberFromDto(m, friendById))
        .filter(Boolean);

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

      const [friendsRes, membersRes] = await Promise.all([
        getFriendsApi(),
        getGroupMembersApi(selectedGroup.id),
      ]);

      const friends = Array.isArray(friendsRes.data) ? friendsRes.data : [];
      const members = Array.isArray(membersRes.data) ? membersRes.data : [];

      const friendById = new Map(
        friends.map((friend) => [getFriendId(friend), friend])
      );

      const mappedMembers = members
        .map((m) => enrichMemberFromDto(m, friendById))
        .filter(Boolean)
        .filter((row) => row.id && row.id !== Number(currentUserId));

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

      const [friendsRes, membersRes] = await Promise.all([
        getFriendsApi(),
        getGroupMembersApi(selectedGroup.id),
      ]);

      const friends = Array.isArray(friendsRes.data) ? friendsRes.data : [];
      const members = Array.isArray(membersRes.data) ? membersRes.data : [];

      const friendById = new Map(
        friends.map((friend) => [getFriendId(friend), friend])
      );

      const mappedRoleCandidates = members
        .map((m) => enrichMemberFromDto(m, friendById))
        .filter(Boolean)
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
        selectedMemberIds.map((userId) => addMemberApi(selectedGroup.id, userId))
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
        // ignore
      }
    } catch (error) {
      console.error("Add member lỗi:", error);

      const message = error?.response?.data || "Thêm thành viên thất bại";

      if (typeof message === "string" && message.includes("Không thuộc nhóm")) {
        toast.error("Không thuộc nhóm");
        return;
      }

      if (typeof message === "string" && message.includes("Không có quyền")) {
        toast.error("Không có quyền");
        return;
      }

      if (typeof message === "string" && message.includes("User đã trong nhóm")) {
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
        // ignore
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
        prev.filter((item) => item.id !== groupConversationId(selectedGroup.id))
      );

      setSelectedGroup(null);
      setSelectedConversationId(null);
      setMessages([]);
      setShowGroupMenu(false);

      toast.success("Giải tán nhóm thành công! 🎉");
    } catch (error) {
      const message = error?.response?.data || "Giải tán nhóm thất bại";

      if (typeof message === "string" && message.includes("Group không tồn tại")) {
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

      if (typeof message === "string" && message.includes("User không tồn tại")) {
        toast.error("User không tồn tại");
        return;
      }

      if (typeof message === "string" && message.includes("Không thể sửa OWNER")) {
        toast.error("Không thể sửa OWNER");
        return;
      }

      toast.error("Cập nhật quyền thất bại");
    }
  };

  const currentTitle = selectedGroup
    ? selectedGroup.name
    : selectedUser?.username || "Cuộc trò chuyện";

  const currentAvatar = selectedGroup
    ? DEFAULT_AVATAR
    : resolveAvatar(selectedUser?.avatar);

  return (
    <div className="w-screen h-screen flex bg-[#0f172a] overflow-hidden text-slate-200 font-sans relative">
      <div className="z-30 border-r border-slate-800/60 shadow-2xl bg-[#0b1120]">
        <Sidebar
          user={user}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          onLogout={handleLogout}
          onOpenProfile={() => setShowProfile(true)}
          onChangePassword={() => setShowChangePassword(true)}
          onSelectTab={setActiveTab}
          activeTab={activeTab}
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

                        {item.unreadCount > 0 && (
                          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-blue-500 text-white text-[11px] leading-[22px] text-center font-semibold">
                            {item.unreadCount > 99 ? "99+" : item.unreadCount}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 mt-1 truncate">
                        {item.type === "GROUP" ? "Nhóm chat" : "Chat cá nhân"}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col bg-gradient-to-b from-[#1e293b] to-[#0f172a] relative z-40">
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
              <header className="h-20 px-8 flex items-center justify-between bg-slate-900/40 backdrop-blur-xl border-b border-white/5 shadow-lg z-20">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full opacity-75"></div>

                    <img
                      src={currentAvatar}
                      alt=""
                      className={`relative w-12 h-12 rounded-full object-cover border-2 border-slate-900 bg-slate-700 ${
                        selectedGroup ? "cursor-pointer" : ""
                      }`}
                      onClick={() => {
                        if (!selectedGroup) return;
                        setShowGroupMenu((prev) => !prev);
                      }}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />

                    {!selectedGroup && (
                      <span
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-800 ${
                          onlineUsers.has(Number(selectedUser?.id))
                            ? "bg-emerald-500"
                            : "bg-slate-500"
                        }`}
                      />
                    )}

                    {selectedGroup && showGroupMenu && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-14 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        <button
                          onClick={handleOpenViewMembersModal}
                          className="w-full text-left px-4 py-3 hover:bg-slate-700/80 text-slate-100 transition border-b border-slate-700/80"
                        >
                          👥 Xem thành viên
                          <span className="ml-1.5 text-xs font-semibold text-indigo-300">
                            ({groupMemberCount})
                          </span>
                        </button>

                        <button
                          onClick={handleOpenAddMemberModal}
                          className="w-full text-left px-4 py-3 hover:bg-blue-500/10 text-blue-300 transition"
                        >
                          ➕ Thêm thành viên
                        </button>

                        <button
                          onClick={handleOpenRemoveMemberModal}
                          className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-300 transition"
                        >
                          ➖ Xoá thành viên
                        </button>

                        <button
                          onClick={handleOpenUpdateRoleModal}
                          className="w-full text-left px-4 py-3 hover:bg-violet-500/10 text-violet-300 transition"
                        >
                          🛡️ Cập nhật quyền
                        </button>

                        <button
                          onClick={handleDeleteGroup}
                          className="w-full text-left px-4 py-3 hover:bg-red-500/20 text-red-400 transition"
                        >
                          🗑️ Giải tán nhóm
                        </button>

                        <button
                          onClick={handleLeaveGroup}
                          className="w-full text-left px-4 py-3 hover:bg-yellow-500/10 text-yellow-300 transition"
                        >
                          🚪 Rời nhóm
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <h2 className="text-white text-lg font-bold tracking-tight uppercase">
                      {currentTitle}
                    </h2>

                    <div className="flex items-center gap-1.5">
                      {!selectedGroup &&
                      onlineUsers.has(Number(selectedUser?.id)) ? (
                        <>
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                          <span className="text-xs text-emerald-400 font-medium">
                            Đang hoạt động
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          {selectedGroup
                            ? `Nhóm chat · ${groupMemberCount} thành viên`
                            : "Ngoại tuyến"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 relative">
                  <button
                    onClick={() => setShowMessageSearch((prev) => !prev)}
                    className={`p-2.5 rounded-full hover:bg-white/5 ${
                      showMessageSearch ? "text-blue-400" : "text-slate-400"
                    }`}
                  >
                    🔍
                  </button>

                  {!selectedGroup && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu((prev) => !prev);
                        }}
                        className="p-2.5 rounded-full hover:bg-white/5 text-slate-400 text-xl"
                      >
                        ⋮
                      </button>

                      {showMenu && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-12 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                        >
                          <button
                            onClick={async () => {
                              try {
                                if (blockStatus.blockedByMe) {
                                  await unblockUserApi(selectedUser.id);
                                } else {
                                  await blockUserApi(selectedUser.id);
                                }

                                const res = await getBlockStatusApi(
                                  selectedUser.id
                                );

                                setBlockStatus({
                                  blockedByMe: res.data?.blockedByMe ?? false,
                                  blockedByOther:
                                    res.data?.blockedByOther ?? false,
                                });

                                setShowMenu(false);
                              } catch (err) {
                                console.log("Block/unblock lỗi:", err);
                              }
                            }}
                            className={`w-full text-left px-4 py-3 transition ${
                              blockStatus.blockedByMe
                                ? "hover:bg-green-500/10 text-green-400"
                                : "hover:bg-yellow-500/10 text-yellow-400"
                            }`}
                          >
                            {blockStatus.blockedByMe
                              ? "🔓 Bỏ chặn"
                              : "🚫 Chặn người dùng"}
                          </button>

                          <div className="h-px bg-slate-700" />

                          <button
                            onClick={handleDeleteConversation}
                            className="w-full text-left px-4 py-3 hover:bg-red-500/10 text-red-400 transition"
                          >
                            🗑️ Xoá hội thoại
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </header>

              <div className="flex-1 relative overflow-hidden">
                <ChatBox
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  currentUserId={currentUserId}
                  setMessages={setMessages}
                  onForwardMessage={handleForwardClick}
                  showSearch={showMessageSearch}
                  onCloseSearch={() => setShowMessageSearch(false)}
                />
              </div>

              <div className="p-4 bg-transparent">
                {selectedGroup ? (
                  isRemovedFromGroup ? (
                    <div className="text-center text-red-400 font-medium">
                      🚫 Bạn đã bị xoá ra khỏi nhóm và không thể trả lời cuộc trò
                      chuyện này
                    </div>
                  ) : (
                    <ChatInput
                      input={input}
                      setInput={setInput}
                      onSend={handleSendMessage}
                      onSendFile={handleSendFile}
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

      {showForwardModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div className="bg-slate-800 p-4 rounded-xl w-96 max-h-[500px] overflow-y-auto">
            <h3 className="text-white mb-3">Chọn người để chuyển tiếp</h3>

            <div className="mb-4">
              <h4 className="text-slate-300 text-sm mb-2">
                Chuyển tiếp tới nhóm
              </h4>

              {forwardableGroups.length === 0 ? (
                <div className="text-slate-500 text-sm">
                  Không có nhóm phù hợp để chuyển tiếp
                </div>
              ) : (
                <div className="space-y-2">
                  {forwardableGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() =>
                        handleForwardToTarget({
                          id: group.targetGroup?.id,
                          type: "GROUP",
                        })
                      }
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-slate-200"
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <h4 className="text-slate-300 text-sm mb-2">
              Chuyển tiếp tới cá nhân
            </h4>

            <FriendsList onSelectUser={(u) => handleForwardToTarget(u)} />

            <button
              onClick={() => setShowForwardModal(false)}
              className="mt-3 text-sm text-slate-400"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {showViewMembersModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div className="bg-slate-800 p-4 rounded-xl w-[440px] max-h-[560px] overflow-y-auto shadow-2xl border border-slate-700">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-white text-lg font-semibold">
                  Thành viên nhóm
                </h3>
                <p className="text-slate-400 text-sm mt-0.5">
                  {selectedGroup?.name}{" "}
                  <span className="text-indigo-300 font-medium">
                    · {viewMembersLoading ? "…" : viewMembersList.length} người
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowViewMembersModal(false)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            {viewMembersLoading ? (
              <div className="text-slate-400 text-sm py-8 text-center">
                Đang tải danh sách…
              </div>
            ) : viewMembersList.length === 0 ? (
              <div className="text-slate-400 text-sm py-6">
                Không có dữ liệu thành viên
              </div>
            ) : (
              <ul className="space-y-2">
                {viewMembersList.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-700/50"
                  >
                    <img
                      src={resolveAvatar(member?.avatar)}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                      className="w-10 h-10 rounded-full object-cover bg-slate-700 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {member.username}
                        {Number(member.id) === Number(currentUserId) && (
                          <span className="text-slate-500 font-normal text-xs ml-1">
                            (bạn)
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 mt-0.5">
                        {memberRoleLabel(member.role)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowViewMembersModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div className="bg-slate-800 p-4 rounded-xl w-[420px] max-h-[520px] overflow-y-auto">
            <h3 className="text-white mb-3">Thêm thành viên vào nhóm</h3>

            {friendCandidates.length === 0 ? (
              <div className="text-slate-400 text-sm">Chưa có bạn bè để thêm</div>
            ) : (
              <div className="space-y-2">
                {friendCandidates.map((friend, index) => {
                  const friendId = getFriendId(friend);
                  const checked = selectedMemberIds.includes(friendId);

                  return (
                    <label
                      key={friendId || index}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectMember(friend)}
                      />

                      <img
                        src={resolveAvatar(friend?.avatar)}
                        alt={getFriendName(friend)}
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                        className="w-9 h-9 rounded-full object-cover bg-slate-700"
                      />

                      <span className="text-white">{getFriendName(friend)}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200"
              >
                Huỷ
              </button>

              <button
                onClick={handleAddMembersToGroup}
                disabled={selectedMemberIds.length === 0}
                className="px-3 py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {showRemoveMemberModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div className="bg-slate-800 p-4 rounded-xl w-[420px] max-h-[520px] overflow-y-auto">
            <h3 className="text-white mb-3">Xoá thành viên khỏi nhóm</h3>

            {memberCandidates.length === 0 ? (
              <div className="text-slate-400 text-sm">
                Không có thành viên để xoá
              </div>
            ) : (
              <div className="space-y-2">
                {memberCandidates.map((member, index) => {
                  const memberId = getFriendId(member);
                  const checked = selectedMemberIds.includes(memberId);

                  return (
                    <label
                      key={memberId || index}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectMember(member)}
                      />

                      <img
                        src={resolveAvatar(member?.avatar)}
                        alt={getFriendName(member)}
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                        className="w-9 h-9 rounded-full object-cover bg-slate-700"
                      />

                      <span className="text-white">{getFriendName(member)}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowRemoveMemberModal(false)}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200"
              >
                Huỷ
              </button>

              <button
                onClick={handleRemoveMembersFromGroup}
                disabled={selectedMemberIds.length === 0}
                className="px-3 py-2 rounded-lg bg-red-500 text-white disabled:opacity-50"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpdateRoleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999]">
          <div className="bg-slate-800 p-4 rounded-xl w-[420px] max-h-[520px] overflow-y-auto">
            <h3 className="text-white mb-3">Cập nhật quyền thành viên</h3>

            {roleCandidates.length === 0 ? (
              <div className="text-slate-400 text-sm">
                Không có thành viên phù hợp để cập nhật quyền
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {roleCandidates.map((member, index) => (
                    <label
                      key={member.id || index}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="update-role-user"
                        checked={selectedRoleUserId === member.id}
                        onChange={() => {
                          setSelectedRoleUserId(member.id);
                          setSelectedRoleValue(member.role || "MEMBER");
                        }}
                      />

                      <img
                        src={resolveAvatar(member?.avatar)}
                        alt={getFriendName(member)}
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                        className="w-9 h-9 rounded-full object-cover bg-slate-700"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="text-white truncate">
                          {getFriendName(member)}
                        </div>

                        <div className="text-xs text-slate-400">
                          Quyền hiện tại: {member.role}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mb-4">
                  <label className="text-slate-300 text-sm mb-1 block">
                    Quyền mới
                  </label>

                  <select
                    value={selectedRoleValue}
                    onChange={(e) => setSelectedRoleValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 outline-none"
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowUpdateRoleModal(false)}
                className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200"
              >
                Huỷ
              </button>

              <button
                onClick={handleUpdateRole}
                disabled={!selectedRoleUserId}
                className="px-3 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50"
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
    </div>
  );
}

export default ChatPage;
import axiosClient from "../../../services/axiosClient";

// lấy tin nhắn
export const getMessagesApi = (roomId) => {
  return axiosClient.get(`/chat/messages/${roomId}`);
};

// xoá tin nhắn (1 chiều)
export const deleteMessageApi = (messageId) => {
  return axiosClient.delete(`/chat/message/${messageId}`);
};

// 🔥 THU HỒI TIN NHẮN (2 chiều)
export const recallMessageApi = (messageId) => {
  return axiosClient.put(`/chat/message/recall/${messageId}`);
};

export const deleteConversationApi = (roomId) => {
  return axiosClient.delete(`/chat/conversation/${roomId}`);
};

export const uploadFileApi = (file) => {
  const formData = new FormData();
  formData.append("file", file);

  return axiosClient.post("/file/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

// 🔥 block user
export const blockUserApi = (targetId) => {
  return axiosClient.post(`/block/${targetId}`);
};

// 🔥 unblock
export const unblockUserApi = (targetId) => {
  return axiosClient.delete(`/block/${targetId}`);
};

// 🔥 check block
export const checkBlockApi = (targetId) => {
  return axiosClient.get(`/block/check/${targetId}`);
};

export const getBlockStatusApi = (targetId) => {
  return axiosClient.get(`/block/status/${targetId}`);
};

export const createGroupApi = (data) => {
  return axiosClient.post("http://localhost:8080/api/chat/group/create", data);
};

export const getMyGroupsApi = (userId) => {
  return axiosClient.get(`/chat/group/my-groups?userId=${userId}`);
};

export const addMemberApi = (groupId, userId) => {
  return axiosClient.post(
    `/chat/group/add-member?groupId=${groupId}&userId=${userId}`
  );
};
/** Trả về mảng GroupMemberDTO: { userId, username, avatar, role } */
export const getGroupMembersApi = (groupId) => {
  return axiosClient.get(`/chat/group/members?groupId=${groupId}`);
};

export const removeMemberApi = (groupId, userId, currentUserId) => {
  return axiosClient.delete(
    `/chat/group/remove-member?groupId=${groupId}&userId=${userId}&currentUserId=${currentUserId}`
  );
};

export const deleteGroupApi = (groupId, currentUserId) => {
  return axiosClient.delete(
    `/chat/group/delete?groupId=${groupId}&currentUserId=${currentUserId}`
  );
};

export const updateRoleApi = (groupId, userId, role, currentUserId) => {
  return axiosClient.put(
    `/chat/group/update-role?groupId=${groupId}&userId=${userId}&role=${role}&currentUserId=${currentUserId}`
  );
};

export const leaveGroupApi = (groupId, userId) => {
  return axiosClient.delete(
    `/chat/group/leave?groupId=${groupId}&userId=${userId}`
  );
};

export const markAsReadApi = (roomId) => {
  return axiosClient.post(`/chat/read/${roomId}`);
};

export const getUnreadCountApi = (roomId) => {
  return axiosClient.get(`/chat/unread/${roomId}`);
};

export const getPrivateConversationsApi = () => {
  return axiosClient.get(`/chat/private-conversations`);
};
export const updateGroupAvatarApi = (groupId, avatar, currentUserId) => {
  return axiosClient.put(
    `/chat/group/avatar?groupId=${groupId}&avatar=${encodeURIComponent(
      avatar
    )}&currentUserId=${currentUserId}`
  );
};
export const updateGroupNameApi = (groupId, name, currentUserId) => {
  return axiosClient.put(
    `/chat/group/name?groupId=${groupId}&name=${encodeURIComponent(
      name
    )}&currentUserId=${currentUserId}`
  );
};

export const updateChatBackgroundApi = (
  roomId,
  background,
  scope = "PERSONAL"
) => {
  return axiosClient.put(`/chat/background/${roomId}`, null, {
    params: {
      background,
      scope,
    },
  });
};

export const getChatBackgroundApi = (roomId) => {
  return axiosClient.get(`/chat/background/${roomId}`);
};

// 🔥 THẢ CẢM XÚC TIN NHẮN
export const reactMessageApi = (messageId, emoji) => {
  return axiosClient.post(`/chat/message/${messageId}/reaction`, null, {
    params: {
      emoji,
    },
  });
};

export const clearMessageReactionsApi = (messageId) => {
  return axiosClient.delete(`/chat/message/${messageId}/reaction`);
};

// =========================
// ĐỔI BIỆT DANH CHAT ĐƠN
// =========================
export const updateNicknameApi = (roomId, targetUserId, nickname) => {
  return axiosClient.post(`/chat/nickname/update`, {
    roomId,
    targetUserId,
    nickname,
  });
};

// =========================
// LẤY BIỆT DANH CHAT ĐƠN
// =========================
export const getNicknameApi = (roomId, targetUserId) => {
  return axiosClient.get(`/chat/nickname`, {
    params: {
      roomId,
      targetUserId,
    },
  });
};

// =========================
// PIN MESSAGE
// =========================
export const pinMessageApi = (messageId) => {
  return axiosClient.put(`/chat/message/${messageId}/pin`);
};

export const unpinMessageApi = (messageId) => {
  return axiosClient.put(`/chat/message/${messageId}/unpin`);
};

export const getPinnedMessagesApi = (roomId) => {
  return axiosClient.get(`/chat/pinned/${roomId}`);
};

// =========================
// POLL / BÌNH CHỌN
// =========================
export const createPollApi = (data) => {
  return axiosClient.post("/chat/polls", data);
};

export const getPollApi = (pollId) => {
  return axiosClient.get(`/chat/polls/${pollId}`);
};

export const votePollApi = (pollId, optionIds) => {
  return axiosClient.post(`/chat/polls/${pollId}/vote`, {
    optionIds,
  });
};

export const addPollOptionApi = (pollId, text) => {
  return axiosClient.post(`/chat/polls/${pollId}/options`, {
    text,
  });
};

export const closePollApi = (pollId) => {
  return axiosClient.put(`/chat/polls/${pollId}/close`);
};

export const suggestMessageByAiApi = (message) => {
  return axiosClient.post("/chat/ai/suggestions", {
    message,
  });
};

export const askAiAssistantApi = ({ question, context }) => {
  return axiosClient.post("/chat/ai/assistant", {
    question,
    context,
  });
};

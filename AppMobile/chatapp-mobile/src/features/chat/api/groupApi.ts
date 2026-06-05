import axiosClient from "../../../shared/api/axios";

export const createGroupApi = async (payload: {
  name: string;
  memberIds: number[];
}) => {
  const res = await axiosClient.post("/chat/group/create", payload);
  return res.data;
};

export const getMyGroupsApi = async () => {
  const res = await axiosClient.get("/chat/group/my-groups");
  return res.data;
};

export const getGroupMembersApi = async (groupId: string) => {
  const res = await axiosClient.get("/chat/group/members", {
    params: { groupId },
  });

  return res.data;
};

export const renameGroupApi = async (groupId: string, name: string) => {
  const res = await axiosClient.put("/chat/group/rename", null, {
    params: {
      groupId,
      name,
    },
  });

  return res.data;
};

export const updateGroupBackgroundApi = async (
  groupId: string,
  backgroundUrl: string
) => {
  const res = await axiosClient.put("/chat/group/background", null, {
    params: {
      groupId,
      backgroundUrl,
    },
  });

  return res.data;
};

export const updateGroupAvatarApi = async (
  groupId: string,
  avatarUrl: string
) => {
  const res = await axiosClient.put("/chat/group/avatar", null, {
    params: {
      groupId,
      avatarUrl,
    },
  });

  return res.data;
};

export const leaveGroupApi = async (
  groupId: string,
  newOwnerId?: number | null
) => {
  const res = await axiosClient.delete("/chat/group/leave", {
    params: {
      groupId,
      ...(newOwnerId !== null && newOwnerId !== undefined
        ? { newOwnerId }
        : {}),
    },
  });

  return res.data;
};

export const deleteGroupApi = async (groupId: string) => {
  const res = await axiosClient.delete("/chat/group/delete", {
    params: { groupId },
  });

  return res.data;
};

export const addGroupMemberApi = async (groupId: string, userId: number) => {
  const res = await axiosClient.post("/chat/group/add-member", null, {
    params: {
      groupId,
      userId,
    },
  });

  return res.data;
};

export const removeGroupMemberApi = async (
  groupId: string,
  userId: number
) => {
  const res = await axiosClient.delete("/chat/group/remove-member", {
    params: {
      groupId,
      userId,
    },
  });

  return res.data;
};
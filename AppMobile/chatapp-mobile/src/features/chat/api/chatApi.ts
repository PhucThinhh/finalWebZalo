import axiosClient from "../../../shared/api/axios";

export const getMessagesByRoomApi = async (roomId: string | number) => {
  const res = await axiosClient.get(`/chat/messages/${roomId}`);
  return res.data;
};

export const recallMessageApi = async (messageId: string | number) => {
  const res = await axiosClient.put(`/chat/message/recall/${messageId}`);
  return res.data;
};

export const deleteMessageApi = async (messageId: string | number) => {
  const res = await axiosClient.delete(`/chat/message/${messageId}`);
  return res.data;
};

export const deleteConversationApi = async (roomId: string | number) => {
  const res = await axiosClient.delete(`/chat/conversation/${roomId}`);
  return res.data;
};

export const uploadChatFileApi = async (file: {
  uri: string;
  name: string;
  type: string;
}) => {
  const formData = new FormData();

  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as any);

  const res = await axiosClient.post("/file/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    transformRequest: (data) => data,
  });

  return res.data;
};

export const suggestMessageByAiApi = async (message: string) => {
  const res = await axiosClient.post("/chat/ai/suggestions", { message });
  return res.data;
};

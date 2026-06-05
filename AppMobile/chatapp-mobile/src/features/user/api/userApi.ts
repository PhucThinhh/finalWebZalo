import axiosClient from "../../../shared/api/axios";

// GET USER
export const getMeApi = async () => {
  const res = await axiosClient.get("/user/me");
  return res.data;
};

// UPLOAD AVATAR
export const uploadAvatarApi = async (file: {
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

  const res = await axiosClient.post("/user/upload-avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    transformRequest: (data) => data,
  });

  return res.data;
};

// UPLOAD COVER
export const uploadCoverApi = async (file: {
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

  const res = await axiosClient.post("/user/upload-cover", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    transformRequest: (data) => data,
  });

  return res.data;
};

export const updateUserApi = async (data: any) => {
  const res = await axiosClient.put("/user/update", data);
  return res.data;
};

export const changePasswordApi = async (data: any) => {
  const res = await axiosClient.post("/user/change-password", data);
  return res.data;
};
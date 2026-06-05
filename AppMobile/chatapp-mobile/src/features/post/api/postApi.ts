import axiosClient from "../../../shared/api/axios";

export const getFeedPostsApi = async () => {
  const res = await axiosClient.get("/posts/feed");
  return res.data;
};

export const getMyPostsApi = async () => {
  const res = await axiosClient.get("/posts/me");
  return res.data;
};

export const createPostApi = async (payload: {
  content?: string;
  imageUrl?: string | null;
}) => {
  const res = await axiosClient.post("/posts", payload);
  return res.data;
};

export const deletePostApi = async (postId: string) => {
  const res = await axiosClient.delete(`/posts/${postId}`);
  return res.data;
};
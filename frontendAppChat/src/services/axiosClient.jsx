import axios from "axios";

const axiosClient = axios.create({
  baseURL: "http://localhost:8080/api",
});

// 👉 REQUEST: gắn token từ localStorage
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// 👉 RESPONSE: xử lý lỗi 401
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }

    if (error.response?.status === 423) {
      const lockedUser = {
        phone: localStorage.getItem("phone") || "",
        username: localStorage.getItem("username") || "",
        message:
          typeof error.response?.data === "string"
            ? error.response.data
            : "Tài khoản của bạn đã bị khóa",
      };

      localStorage.setItem("lockedAccountNotice", JSON.stringify(lockedUser));
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      window.location.href = "/login?locked=1";
    }

    return Promise.reject(error);
  }
);

export default axiosClient;

import axiosClient from "../../../services/axiosClient";

export const loginApi = (data) => {
  return axiosClient.post("/auth/login", data);
};
export const sendOtpApi = (email) => {
  return axiosClient.post("/auth/send-otp", { email });
};

export const verifyOtpApi = (data) => {
  return axiosClient.post("/auth/verify-otp", data);
};

export const registerApi = (data) => {
  return axiosClient.post("/auth/register", data);
};
export const forgotPasswordApi = (email) => {
  return axiosClient.post("auth/forgot-password", { email });
}
  

export const resetPasswordApi = (data) => {
return axiosClient.post("auth/reset-password", data);
};

export const submitLockAppealApi = (data) => {
  return axiosClient.post("/auth/lock-appeals", data);
};

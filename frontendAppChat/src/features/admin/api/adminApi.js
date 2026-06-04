import axiosClient from "../../../services/axiosClient";

export const getAdminUsersApi = () => {
  return axiosClient.get("/admin/users");
};

export const getAdminSummaryApi = () => {
  return axiosClient.get("/admin/users/summary");
};

export const updateAdminUserRoleApi = (userId, role) => {
  return axiosClient.put(`/admin/users/${userId}/role`, null, {
    params: { role },
  });
};

export const lockAdminUserApi = (userId) => {
  return axiosClient.put(`/admin/users/${userId}/lock`);
};

export const unlockAdminUserApi = (userId) => {
  return axiosClient.put(`/admin/users/${userId}/unlock`);
};

export const getAdminUserDeviceApi = (userId) => {
  return axiosClient.get(`/admin/users/${userId}/device`);
};

export const getAdminHealthApi = () => {
  return axiosClient.get("/admin/users/health");
};

export const getPendingLockAppealsApi = () => {
  return axiosClient.get("/admin/users/lock-appeals");
};

export const approveLockAppealApi = (appealId) => {
  return axiosClient.put(`/admin/users/lock-appeals/${appealId}/approve`);
};

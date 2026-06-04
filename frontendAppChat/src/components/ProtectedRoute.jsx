import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import axiosClient from "../services/axiosClient";

export default function ProtectedRoute({ children, roleRequired }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const allowedRoles = Array.isArray(roleRequired) ? roleRequired : [roleRequired];

  useEffect(() => {
    if (!token) return;

    const checkAccountStatus = async () => {
      try {
        await axiosClient.get("/user/me");
      } catch {
        // axios interceptor handles 401/423 redirects.
      }
    };

    checkAccountStatus();
    const timer = setInterval(checkAccountStatus, 8000);

    return () => clearInterval(timer);
  }, [token]);

  // chưa login
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // sai role
  if (roleRequired && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

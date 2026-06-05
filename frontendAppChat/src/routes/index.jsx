import { Routes, Route, Navigate } from "react-router-dom";

// pages
import Login from "../features/auth/pages/LoginPage";
import Register from "../features/auth/pages/RegisterPage";
import Chat from "../features/chat/pages/Chat";
import AdminPage from "../features/admin/pages/AdminPage";
import ForgotPassword from "../features/auth/pages/ForgotPasswordPage";

// 🔥 chỉ dùng 1 route bảo vệ
import ProtectedRoute from "../components/ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>
      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* user */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute roleRequired={["USER", "ADMIN"]}>
            <Chat />
          </ProtectedRoute>
        }
      />

      {/* admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roleRequired="ADMIN">
            <AdminPage />
          </ProtectedRoute>
        }
      />

      {/* default */}
      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default AppRoutes;

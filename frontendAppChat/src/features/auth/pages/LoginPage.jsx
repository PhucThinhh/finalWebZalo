import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { loginApi, submitLockAppealApi } from "../api/authApi";

function Login() {
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockedNotice, setLockedNotice] = useState(null);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealChecked, setAppealChecked] = useState(false);
  const [appealLoading, setAppealLoading] = useState(false);
  const [errors, setErrors] = useState({ phone: "", password: "" });

  useEffect(() => {
    const lockedRaw = localStorage.getItem("lockedAccountNotice");
    if (lockedRaw) {
      try {
        const parsed = JSON.parse(lockedRaw);
        setLockedNotice(parsed);
        setPhone(parsed.phone || "");
      } catch {
        setLockedNotice({
          phone: "",
          message: "Tài khoản của bạn đã bị khóa",
        });
      }
    }

    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (token && role) {
      navigate(role === "ADMIN" ? "/admin" : "/chat");
    }
  }, [navigate]);

  const validate = () => {
    const nextErrors = {
      phone: !phone ? "Vui lòng nhập SĐT" : "",
      password: !password ? "Vui lòng nhập mật khẩu" : "",
    };
    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const res = await loginApi({ phone, password });
      const { token, role, username } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("phone", phone);
      localStorage.setItem("username", username || "");
      localStorage.removeItem("lockedAccountNotice");

      navigate(role === "ADMIN" ? "/admin" : "/chat");
    } catch (error) {
      const message =
        typeof error.response?.data === "string"
          ? error.response.data
          : "Sai tài khoản hoặc mật khẩu";

      if (message.toLowerCase().includes("khóa")) {
        const notice = { phone, username: "", message };
        localStorage.setItem("lockedAccountNotice", JSON.stringify(notice));
        setLockedNotice(notice);
      }

      setErrors((prev) => ({ ...prev, password: message }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAppeal = async () => {
    const targetPhone = lockedNotice?.phone || phone;

    if (!appealChecked) {
      toast.warning("Bạn cần tích chọn xác nhận gửi phản hồi cho admin");
      return;
    }

    if (!targetPhone) {
      toast.error("Thiếu số điện thoại tài khoản bị khóa");
      return;
    }

    if (!appealMessage.trim()) {
      toast.error("Vui lòng nhập nội dung phản hồi");
      return;
    }

    try {
      setAppealLoading(true);
      await submitLockAppealApi({
        phone: targetPhone,
        message: appealMessage.trim(),
      });
      toast.success("Đã gửi phản hồi, vui lòng chờ admin duyệt");
      localStorage.removeItem("lockedAccountNotice");
      setLockedNotice(null);
      setAppealMessage("");
      setAppealChecked(false);
    } catch (error) {
      toast.error(error.response?.data || "Không gửi được phản hồi");
    } finally {
      setAppealLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen flex justify-center items-center bg-white z-[9999]">
      <div className="w-[370px] p-10 bg-white rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.08),0_5px_15px_rgba(0,0,0,0.04)] text-center">
        <div className="flex justify-center mb-5">
          <div className="w-[70px] h-[70px] rounded-full bg-white flex items-center justify-center text-[35px] shadow-[inset_6px_6px_12px_#d9d9d9,inset_-6px_-6px_12px_#ffffff]">
            💬
          </div>
        </div>

        <h2 className="text-[#333] mb-2 text-2xl font-bold">
          Đăng nhập ChatApp
        </h2>

        <p className="text-[#888] text-[15px] mb-[30px]">
          Cùng kết nối và chia sẻ ngay
        </p>

        <div className="text-left mb-[22px]">
          <label className="block text-[#555] mb-2 text-sm font-medium">
            Số điện thoại
          </label>
          <input
            placeholder="09xx..."
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setErrors((prev) => ({ ...prev, phone: "" }));
            }}
            className="w-full px-4 py-3 rounded-[15px] bg-[#f0f2f5] shadow-[inset_4px_4px_8px_#d1d9e6,inset_-4px_-4px_8px_#ffffff] outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {errors.phone && (
            <p className="text-red-500 text-[13px] mt-1">{errors.phone}</p>
          )}
        </div>

        <div className="text-left mb-[22px]">
          <div className="flex justify-between mb-2">
            <label className="text-[#555] text-sm font-medium">Mật khẩu</label>
            <span
              onClick={() => navigate("/forgot-password")}
              className="cursor-pointer text-[13px] text-[#005ae0]"
            >
              Quên?
            </span>
          </div>

          <div className="relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
              className="w-full pl-4 pr-12 py-3.5 rounded-[15px] bg-[#f0f2f5] shadow-[inset_4px_4px_8px_#d1d9e6,inset_-4px_-4px_8px_#ffffff] outline-none"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <button
              type="button"
              className="absolute right-4"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {errors.password && (
            <p className="text-red-500 text-[13px] mt-1">{errors.password}</p>
          )}
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3.5 rounded-[30px] bg-[#005ae0] text-white font-bold disabled:opacity-60"
        >
          {loading ? "Đang xác thực..." : "Đăng nhập"}
        </button>

        <p className="text-[#888] mt-7 text-[15px]">
          Chưa có tài khoản?{" "}
          <span
            className="text-[#005ae0] font-bold cursor-pointer"
            onClick={() => navigate("/register")}
          >
            Đăng ký ngay
          </span>
        </p>
      </div>

      {lockedNotice && (
        <div className="fixed inset-0 z-[10000] bg-black/40 flex items-center justify-center p-4">
          <div className="w-[460px] max-w-full rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                Tài khoản của bạn đã bị khóa
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                Bạn có thể gửi phản hồi để admin xem xét mở khóa tài khoản.
              </p>
            </div>

            <div className="p-6 space-y-4 text-left">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Số điện thoại
                </label>
                <input
                  value={lockedNotice.phone || phone}
                  onChange={(e) =>
                    setLockedNotice((prev) => ({
                      ...(prev || {}),
                      phone: e.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Nội dung phản hồi
                </label>
                <textarea
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  placeholder="Nhập lý do hoặc thông tin muốn admin xem xét..."
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none resize-none focus:border-blue-500"
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={appealChecked}
                  onChange={(e) => setAppealChecked(e.target.checked)}
                  className="mt-1"
                />
                <span>Tôi muốn gửi phản hồi này cho admin để xem xét mở khóa.</span>
              </label>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setLockedNotice(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSubmitAppeal}
                disabled={appealLoading}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60"
              >
                {appealLoading ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;

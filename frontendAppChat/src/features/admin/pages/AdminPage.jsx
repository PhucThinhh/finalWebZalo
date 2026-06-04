import {
  Activity,
  Ban,
  CheckCircle2,
  Cpu,
  LogOut,
  MonitorSmartphone,
  RefreshCcw,
  Shield,
  ShieldCheck,
  Users,
  MessageSquareWarning,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getAdminHealthApi,
  getAdminSummaryApi,
  getAdminUserDeviceApi,
  getAdminUsersApi,
  getPendingLockAppealsApi,
  lockAdminUserApi,
  approveLockAppealApi,
  unlockAdminUserApi,
  updateAdminUserRoleApi,
} from "../api/adminApi";

const statCards = [
  { key: "totalUsers", label: "Tổng user", icon: Users, tone: "blue" },
  { key: "onlineUsers", label: "Đang online", icon: Activity, tone: "emerald" },
  { key: "lockedUsers", label: "Bị khóa", icon: Ban, tone: "rose" },
  { key: "adminUsers", label: "Admin", icon: ShieldCheck, tone: "amber" },
];

function formatDate(value) {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN");
}

function formatBytes(value) {
  if (!Number.isFinite(Number(value))) return "0 MB";
  return `${(Number(value) / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(ms) {
  const totalSeconds = Math.floor(Number(ms || 0) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function AdminPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState({});
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deviceModal, setDeviceModal] = useState(null);
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) =>
      [user.username, user.email, user.phone, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [users, search]);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [usersRes, appealsRes] = await Promise.all([
        getAdminUsersApi(),
        getPendingLockAppealsApi().catch(() => ({ data: [] })),
      ]);
      const nextUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      setUsers(nextUsers);
      setAppeals(Array.isArray(appealsRes.data) ? appealsRes.data : []);

      try {
        const summaryRes = await getAdminSummaryApi();
        setSummary(summaryRes.data || {});
      } catch (error) {
        console.log("Load admin summary fallback:", error);
        setSummary({
          totalUsers: nextUsers.length,
          onlineUsers: nextUsers.filter((user) => user.online).length,
          lockedUsers: nextUsers.filter((user) => user.locked).length,
          adminUsers: nextUsers.filter((user) => user.role === "ADMIN").length,
        });
      }

      try {
        const healthRes = await getAdminHealthApi();
        setHealth(healthRes.data || null);
      } catch (error) {
        console.log("Load admin health optional error:", error);
        setHealth(null);
      }
    } catch (error) {
      console.log("Load admin dashboard error:", error);
      toast.error(error.response?.data || "Không tải được admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const handleRoleChange = async (user, role) => {
    try {
      const res = await updateAdminUserRoleApi(user.id, role);
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? res.data : item))
      );
      toast.success("Đã cập nhật role");
      loadDashboard();
    } catch (error) {
      toast.error(error.response?.data || "Không đổi được role");
    }
  };

  const handleToggleLock = async (user) => {
    try {
      const res = user.locked
        ? await unlockAdminUserApi(user.id)
        : await lockAdminUserApi(user.id);

      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? res.data : item))
      );
      toast.success(user.locked ? "Đã mở khóa user" : "Đã khóa user");
      loadDashboard();
    } catch (error) {
      toast.error(error.response?.data || "Không cập nhật được trạng thái");
    }
  };

  const handleOpenDevice = async (user) => {
    try {
      const res = await getAdminUserDeviceApi(user.id);
      setDeviceModal(res.data);
    } catch (error) {
      toast.error(error.response?.data || "Không lấy được thông tin thiết bị");
    }
  };

  const handleApproveAppeal = async (appeal) => {
    try {
      await approveLockAppealApi(appeal.id);
      toast.success("Đã duyệt mở khóa tài khoản");
      loadDashboard();
    } catch (error) {
      toast.error(error.response?.data || "Không duyệt được phản hồi");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <header className="h-20 px-8 border-b border-slate-800 bg-[#111827] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý user, phân quyền, khóa tài khoản và theo dõi hệ thống
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/chat")}
            className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
          >
            Về chat
          </button>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCcw size={17} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="h-10 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 flex items-center gap-2"
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="p-8 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {statCards.map(({ key, label, icon: Icon, tone }) => (
            <div
              key={key}
              className="rounded-xl border border-slate-800 bg-[#111827] p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="text-3xl font-bold mt-2">
                    {summary[key] ?? 0}
                  </p>
                </div>
                <span
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    tone === "blue"
                      ? "bg-blue-500/15 text-blue-300"
                      : tone === "emerald"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : tone === "rose"
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  <Icon size={24} />
                </span>
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="rounded-xl border border-slate-800 bg-[#111827] overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Người dùng</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Admin chỉ được đổi role/khóa tài khoản USER, không tác động admin ngang cấp.
                </p>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, email, SĐT..."
                className="w-72 rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="text-left px-5 py-3">User</th>
                    <th className="text-left px-5 py-3">Trạng thái</th>
                    <th className="text-left px-5 py-3">Role</th>
                    <th className="text-left px-5 py-3">Đăng nhập gần nhất</th>
                    <th className="text-right px-5 py-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isPeerAdmin = user.role === "ADMIN";
                    const missingId = !user.id;

                    return (
                      <tr
                        key={user.id || user.email || user.phone}
                        className="border-t border-slate-800 hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">
                            {user.username || "Người dùng"}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {user.email} · {user.phone}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs ${
                                user.online
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-slate-700 text-slate-300"
                              }`}
                            >
                              {user.online ? "Online" : "Offline"}
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs ${
                                user.locked
                                  ? "bg-red-500/15 text-red-300"
                                  : "bg-blue-500/15 text-blue-300"
                              }`}
                            >
                              {user.locked ? "Đã khóa" : "Hoạt động"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <select
                            value={user.role || "USER"}
                            disabled={isPeerAdmin || missingId}
                            onChange={(e) => handleRoleChange(user, e.target.value)}
                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          {formatDate(user.lastLoginAt)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenDevice(user)}
                              disabled={missingId}
                              className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center justify-center"
                              title="Thiết bị đăng nhập"
                            >
                              <MonitorSmartphone size={17} />
                            </button>

                            <button
                              type="button"
                              disabled={isPeerAdmin || missingId}
                              onClick={() => handleToggleLock(user)}
                              className={`h-9 px-3 rounded-lg inline-flex items-center gap-2 disabled:opacity-40 ${
                                user.locked
                                  ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                  : "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                              }`}
                            >
                              {user.locked ? (
                                <>
                                  <CheckCircle2 size={16} />
                                  Mở khóa
                                </>
                              ) : (
                                <>
                                  <Ban size={16} />
                                  Khóa
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
                  <MessageSquareWarning size={22} />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Chờ duyệt</h2>
                  <p className="text-xs text-slate-400">
                    Phản hồi mở khóa từ user
                  </p>
                </div>
              </div>

              {appeals.length === 0 ? (
                <div className="text-sm text-slate-500">
                  Không có phản hồi đang chờ duyệt
                </div>
              ) : (
                <div className="space-y-3">
                  {appeals.map((appeal) => (
                    <div
                      key={appeal.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <div className="font-semibold text-white">
                        {appeal.username || "Người dùng"}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {appeal.phone} · {formatDate(appeal.createdAt)}
                      </div>
                      <p className="text-sm text-slate-300 mt-3 leading-6">
                        {appeal.message}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleApproveAppeal(appeal)}
                        className="mt-3 w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                      >
                        Duyệt mở khóa
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                  <Cpu size={22} />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Sức khỏe hệ thống</h2>
                  <p className="text-xs text-slate-400">
                    Server, bộ nhớ, phản hồi DB
                  </p>
                </div>
              </div>

              {health ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Trạng thái</span>
                    <span className="text-emerald-300 font-semibold">
                      {health.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Uptime</span>
                    <span>{formatUptime(health.uptimeMs)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">DB response</span>
                    <span>{health.dbResponseMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Online socket</span>
                    <span>{health.onlineSocketUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CPU cores</span>
                    <span>{health.processors}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Memory</span>
                    <span>
                      {formatBytes(health.usedMemoryBytes)} /{" "}
                      {formatBytes(health.maxMemoryBytes)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Chưa có dữ liệu</div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">
              <div className="flex items-center gap-3 mb-3">
                <Shield size={20} className="text-blue-300" />
                <h2 className="text-lg font-bold">Quy tắc quyền</h2>
              </div>
              <p className="text-sm text-slate-400 leading-6">
                Admin có thể đổi role và khóa/mở khóa USER. Admin không thể tự khóa,
                tự đổi quyền, hoặc thay đổi quyền/trạng thái của admin ngang cấp.
              </p>
            </div>
          </aside>
        </section>
      </main>

      {deviceModal && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4">
          <div className="w-[560px] max-w-full rounded-2xl bg-[#111827] border border-slate-700 text-slate-100 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Thiết bị đăng nhập</h3>
                <p className="text-sm text-slate-400">{deviceModal.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setDeviceModal(null)}
                className="w-9 h-9 rounded-full hover:bg-white/10 text-slate-400"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div>
                <div className="text-slate-400 mb-1">Trạng thái</div>
                <div>{deviceModal.online ? "Đang online" : "Offline"}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Lần đăng nhập cuối</div>
                <div>{formatDate(deviceModal.lastLoginAt)}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">IP</div>
                <div>{deviceModal.lastLoginIp || "Chưa có"}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">User-Agent</div>
                <div className="break-words leading-6">
                  {deviceModal.lastLoginUserAgent || "Chưa có"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;

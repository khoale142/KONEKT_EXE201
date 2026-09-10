import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  Plus,
  KeyRound,
  Building2,
  CheckCircle2,
  Clock,
  ArrowRight,
  MapPin,
  Crown,
  LogOut,
  RefreshCw,
  AlertCircle,
  X,
} from "lucide-react";
import {
  workspaceApi,
  WorkspaceTenant,
  PendingStoreRequest,
  VerifiedStoreInvite,
} from "../api/workspace.api";
import { useAuthStore } from "../../../app/store/auth.store";

export default function SelectTenantPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);
  const logout = useAuthStore((s) => s.logout);

  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<WorkspaceTenant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingStoreRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Modal State: Tạo thương hiệu mới (Owner)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandAddress, setBrandAddress] = useState("");
  const [brandPhone, setBrandPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal State: Kích hoạt mã mời Store (Internal Member / Partner)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifiedStore, setVerifiedStore] = useState<VerifiedStoreInvite | null>(null);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState("");
  const [desiredPosition, setDesiredPosition] = useState("Nhân viên vận hành");
  const [note, setNote] = useState("");
  const [joining, setJoining] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workspaceApi.getWorkspaces();
      setTenants(data.tenants || []);
      setPendingRequests(data.pendingRequests || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể tải danh sách thương hiệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  const handleSelectTenant = async (tenant: WorkspaceTenant) => {
    try {
      setLoading(true);
      const data = await workspaceApi.selectTenant({ tenantId: tenant.tenantId });
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);

      // Nếu chỉ có 1 store và là staff/pos -> vào thẳng POS
      if (tenant.role === "staff" && tenant.stores.length === 1) {
        navigate("/pos/order", { replace: true });
        return;
      }

      // Ngược lại, chuyển tới trang Chọn Store (đối với Owner có thể chọn toàn chuỗi hoặc chọn chi nhánh)
      navigate("/workspace/select-store", { replace: true, state: { tenant } });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể chuyển đổi không gian làm việc");
      setLoading(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) {
      setCreateError("Vui lòng nhập tên thương hiệu / quán");
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      const data = await workspaceApi.createTenant({
        brandName: brandName.trim(),
        address: brandAddress.trim() || undefined,
        phone: brandPhone.trim() || undefined,
        fullName: user?.fullName,
      });

      setTokensAndUser(data.accessToken, data.refreshToken, data.user);
      setShowCreateModal(false);
      navigate("/workspace/select-store", { replace: true });
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || "Không thể tạo thương hiệu mới");
    } finally {
      setCreating(false);
    }
  };

  const handleVerifyInviteCode = async () => {
    if (!inviteCode.trim()) return;
    try {
      setVerifyingCode(true);
      setInviteError(null);
      const store = await workspaceApi.verifyStoreInvite(inviteCode.trim());
      setVerifiedStore(store);
    } catch (err: any) {
      setVerifiedStore(null);
      setInviteError(err?.response?.data?.message || "Mã mời chi nhánh không hợp lệ");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleJoinStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedStore) {
      setInviteError("Vui lòng kiểm tra mã mời cửa hàng trước khi gửi yêu cầu");
      return;
    }
    if (!fullName.trim()) {
      setInviteError("Vui lòng nhập họ và tên của bạn");
      return;
    }

    try {
      setJoining(true);
      setInviteError(null);
      await workspaceApi.submitJoinStoreRequest({
        storeInviteCode: verifiedStore.inviteCode,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        desiredPosition: desiredPosition.trim() || undefined,
        note: note.trim() || undefined,
      });

      setInviteSuccess(
        `Đã gửi yêu cầu gia nhập chi nhánh "${verifiedStore.storeName}" thành công! Vui lòng đợi Chủ quán duyệt.`
      );
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteSuccess(null);
        setVerifiedStore(null);
        setInviteCode("");
        void loadWorkspaces();
      }, 1800);
    } catch (err: any) {
      setInviteError(err?.response?.data?.message || "Không thể gửi yêu cầu gia nhập");
    } finally {
      setJoining(false);
    }
  };

  const formatRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return { label: "CHỦ QUÁN", bg: "#EBF3EC", color: "#3D503C", border: "#C6DBC9" };
      case "store_manager":
        return { label: "QUẢN LÝ CỬA HÀNG", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" };
      case "staff":
        return { label: "NHÂN VIÊN", bg: "#FFFBEB", color: "#B45309", border: "#FDE68A" };
      default:
        return { label: role.toUpperCase(), bg: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" };
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FAF6F3",
        color: "#2A3B2C",
        fontFamily: 'var(--font-sans, "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E8E0D5",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "#3D503C",
              color: "#FAF6F3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(61, 80, 60, 0.25)",
            }}
          >
            <Store size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              KONEKT POS
            </div>
            <div style={{ fontSize: "0.72rem", color: "#687668", fontWeight: 600 }}>
              Trung Tâm Không Gian Làm Việc (Workspace Hub)
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>
              {user?.fullName || user?.username || "Thành viên"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#687668" }}>
              {user?.email || "Tài khoản đa thương hiệu"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #E8E0D5",
              background: "#FFFFFF",
              color: "#687668",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#DC2626";
              e.currentTarget.style.color = "#DC2626";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E8E0D5";
              e.currentTarget.style.color = "#687668";
            }}
          >
            <LogOut size={15} />
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main
        style={{
          flex: 1,
          maxWidth: 1080,
          width: "100%",
          margin: "0 auto",
          padding: "40px 20px 80px",
        }}
      >
        {/* Hero Section */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#2A3B2C",
              marginBottom: 8,
            }}
          >
            Chọn Thương Hiệu Làm Việc
          </h1>
          <p style={{ color: "#687668", fontSize: "0.98rem", maxWidth: 640, margin: "0 auto" }}>
            Tài khoản của bạn hỗ trợ quản trị và làm việc trên nhiều chuỗi cà phê độc lập. Chọn thương
            hiệu để tiếp tục hoặc liên kết thêm cơ sở mới.
          </p>
        </div>

        {/* Action Buttons Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#2A3B2C" }}>
            Danh Sách Thương Hiệu ({tenants.length})
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                setShowInviteModal(true);
                setInviteError(null);
                setVerifiedStore(null);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 9,
                border: "1px solid #D1DBD2",
                background: "#FFFFFF",
                color: "#3D503C",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D503C")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#D1DBD2")}
            >
              <KeyRound size={16} strokeWidth={2.3} color="#3D503C" />
              Kích hoạt mã mời Store
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setCreateError(null);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 9,
                border: "none",
                background: "#3D503C",
                color: "#FAF6F3",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 3px 10px rgba(61, 80, 60, 0.25)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#38533C")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#3D503C")}
            >
              <Plus size={17} strokeWidth={2.5} />
              Tạo thương hiệu mới
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E8E0D5",
            }}
          >
            <RefreshCw
              size={28}
              className="animate-spin"
              style={{ margin: "0 auto 12px", color: "#3D503C" }}
            />
            <div style={{ fontWeight: 600 }}>Đang tải danh sách thương hiệu...</div>
          </div>
        ) : error ? (
          <div
            style={{
              padding: "24px",
              background: "#FEF2F2",
              border: "1px solid #FCA5A5",
              borderRadius: 12,
              color: "#991B1B",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <AlertCircle size={20} />
            <div style={{ flex: 1, fontWeight: 600 }}>{error}</div>
            <button
              onClick={() => void loadWorkspaces()}
              style={{
                background: "#991B1B",
                color: "#FFFFFF",
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Thử lại
            </button>
          </div>
        ) : tenants.length === 0 ? (
          /* Empty State */
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E8E0D5",
              boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: "rgba(61, 80, 60, 0.08)",
                color: "#3D503C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <Building2 size={32} strokeWidth={2.2} />
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 8 }}>
              Bạn chưa tham gia thương hiệu nào
            </h3>
            <p style={{ color: "#687668", fontSize: "0.92rem", maxWidth: 460, margin: "0 auto 24px" }}>
              Hãy khởi tạo một quán mới nếu bạn là Chủ quán, hoặc kích hoạt mã mời nội bộ từ Cửa hàng
              trưởng nếu bạn đã được tuyển dụng vào làm.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 22px",
                  borderRadius: 9,
                  border: "none",
                  background: "#3D503C",
                  color: "#FAF6F3",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Plus size={18} />
                Khởi tạo thương hiệu mới
              </button>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 22px",
                  borderRadius: 9,
                  border: "1px solid #D1DBD2",
                  background: "#FFFFFF",
                  color: "#3D503C",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <KeyRound size={18} />
                Kích hoạt mã mời Store
              </button>
            </div>
          </div>
        ) : (
          /* Tenants Grid */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
              marginBottom: 40,
            }}
          >
            {tenants.map((t) => {
              const badge = formatRoleBadge(t.role);
              const isOwnerRole = t.role === "owner" || t.role === "platform_admin";

              return (
                <div
                  key={t.tenantId}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 16,
                    border: "1px solid #E8E0D5",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.borderColor = "#C4D6C6";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(61, 80, 60, 0.10)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "#E8E0D5";
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.03)";
                  }}
                >
                  <div>
                    {/* Top Row: Icon + Role Badge */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 12,
                          background: isOwnerRole ? "#3D503C" : "#364D39",
                          color: "#FAF6F3",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.2rem",
                          fontWeight: 800,
                          boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
                        }}
                      >
                        {isOwnerRole ? <Crown size={22} /> : <Store size={22} />}
                      </div>

                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          letterSpacing: 0.6,
                          color: badge.color,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          padding: "3px 8px",
                          borderRadius: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Brand Name & Code */}
                    <h3
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        color: "#2A3B2C",
                        marginBottom: 4,
                        lineHeight: 1.25,
                      }}
                    >
                      {t.tenantName}
                    </h3>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: "#687668",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        marginBottom: 16,
                      }}
                    >
                      Mã chuỗi: <code style={{ background: "#F4EFEB", padding: "1px 6px", borderRadius: 4 }}>{t.tenantCode}</code>
                    </div>

                    {/* Stores Count summary */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "#4A5A4C",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        background: "#FAF6F3",
                        padding: "8px 12px",
                        borderRadius: 8,
                        marginBottom: 20,
                      }}
                    >
                      <MapPin size={15} strokeWidth={2.2} color="#3D503C" />
                      <span>
                        {t.stores.length} chi nhánh đang vận hành
                      </span>
                    </div>
                  </div>

                  {/* Enter Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectTenant(t)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "11px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "#3D503C",
                      color: "#FFFFFF",
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.16s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#38533C")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#3D503C")}
                  >
                    Vào làm việc
                    <ArrowRight size={16} strokeWidth={2.4} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#92400E",
                marginBottom: 16,
              }}
            >
              <Clock size={18} />
              Yêu Cầu Gia Nhập Đang Chờ Chủ Quán Duyệt ({pendingRequests.length})
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    background: "#FFFBEB",
                    border: "1px solid #FDE68A",
                    borderRadius: 12,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "1rem", color: "#92400E", marginBottom: 3 }}>
                      {req.tenantName} — {req.storeName}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#78350F" }}>
                      Vị trí đăng ký: <strong>{req.desiredPosition || "Nhân sự"}</strong>
                      {req.storeAddress ? ` · Địa chỉ: ${req.storeAddress}` : ""}
                    </div>
                  </div>

                  <span
                    style={{
                      background: "#FEF3C7",
                      color: "#B45309",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid #FCD34D",
                    }}
                  >
                    Chờ duyệt
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: Khởi Tạo Thương Hiệu Mới (Chủ quán) */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FAF6F3",
              border: "1px solid #E8E0D5",
              borderRadius: 16,
              maxWidth: 500,
              width: "100%",
              padding: "32px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                border: "none",
                background: "transparent",
                color: "#687668",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "#3D503C",
                  color: "#FAF6F3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <Crown size={24} />
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "#2A3B2C" }}>
                Khởi Tạo Thương Hiệu Mới
              </h2>
              <p style={{ color: "#687668", fontSize: "0.85rem", marginTop: 4 }}>
                Mở một chuỗi quán cà phê mới với đầy đủ quyền quản trị Owner.
              </p>
            </div>

            {createError && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#991B1B",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: "0.84rem",
                  marginBottom: 16,
                  fontWeight: 600,
                }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                  Tên quán / Thương hiệu <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: KONEKT Specialty Coffee, The Daily Brew..."
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #D1DBD2",
                    fontSize: "0.92rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                  Địa chỉ trụ sở / Chi nhánh #1
                </label>
                <input
                  type="text"
                  placeholder="Số nhà, tên đường, quận, thành phố..."
                  value={brandAddress}
                  onChange={(e) => setBrandAddress(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #D1DBD2",
                    fontSize: "0.92rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                  Số điện thoại quán
                </label>
                <input
                  type="text"
                  placeholder="090..."
                  value={brandPhone}
                  onChange={(e) => setBrandPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #D1DBD2",
                    fontSize: "0.92rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid #D1DBD2",
                    background: "#FFFFFF",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#3D503C",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    cursor: creating ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {creating && <RefreshCw size={15} className="animate-spin" />}
                  {creating ? "Đang tạo..." : "Xác nhận tạo quán"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Kích Hoạt Mã Mời Store (Internal Member / Partner) */}
      {showInviteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FAF6F3",
              border: "1px solid #E8E0D5",
              borderRadius: 16,
              maxWidth: 520,
              width: "100%",
              padding: "32px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                border: "none",
                background: "transparent",
                color: "#687668",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "#3D503C",
                  color: "#FAF6F3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <KeyRound size={22} />
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "#2A3B2C" }}>
                Kích Hoạt Mã Mời Chi Nhánh
              </h2>
              <p style={{ color: "#687668", fontSize: "0.85rem", marginTop: 4 }}>
                Nhập mã mời nội bộ từ Cửa hàng trưởng để gửi yêu cầu kích hoạt tài khoản làm việc.
              </p>
            </div>

            {inviteSuccess ? (
              <div
                style={{
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  color: "#166534",
                  padding: "16px",
                  borderRadius: 10,
                  fontSize: "0.92rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <CheckCircle2 size={20} />
                {inviteSuccess}
              </div>
            ) : (
              <form onSubmit={handleJoinStore} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {inviteError && (
                  <div
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FCA5A5",
                      color: "#991B1B",
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: "0.84rem",
                      fontWeight: 600,
                    }}
                  >
                    {inviteError}
                  </div>
                )}

                {/* Step 1: Nhập mã store */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                    Mã mời Store (Do quản lý cung cấp) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Ví dụ: STR-001-A1B2"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase());
                        setVerifiedStore(null);
                      }}
                      required
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #D1DBD2",
                        fontSize: "0.95rem",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      disabled={verifyingCode || !inviteCode.trim()}
                      onClick={handleVerifyInviteCode}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "1px solid #3D503C",
                        background: "#3D503C",
                        color: "#FFFFFF",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        cursor: verifyingCode ? "not-allowed" : "pointer",
                      }}
                    >
                      {verifyingCode ? "Kiểm tra..." : "Kiểm tra"}
                    </button>
                  </div>
                </div>

                {/* Preview Chi nhánh sau khi verify */}
                {verifiedStore && (
                  <div
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #C4D6C6",
                      borderRadius: 10,
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: "0.8rem", fontWeight: 700, marginBottom: 4 }}>
                      <CheckCircle2 size={16} />
                      Mã hợp lệ — Đã xác định cơ sở:
                    </div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#2A3B2C" }}>
                      {verifiedStore.tenantName} · {verifiedStore.storeName}
                    </div>
                    {verifiedStore.storeAddress && (
                      <div style={{ fontSize: "0.8rem", color: "#687668", marginTop: 2 }}>
                        {verifiedStore.storeAddress}
                      </div>
                    )}
                  </div>
                )}

                {/* Thông tin nhân sự */}
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                    Họ và tên của bạn <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #D1DBD2",
                      fontSize: "0.92rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      placeholder="09..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #D1DBD2",
                        fontSize: "0.92rem",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                      Vị trí đảm nhận
                    </label>
                    <input
                      type="text"
                      placeholder="Thu ngân, Pha chế..."
                      value={desiredPosition}
                      onChange={(e) => setDesiredPosition(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #D1DBD2",
                        fontSize: "0.92rem",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                    Ghi chú / Lời nhắn tới Chủ quán
                  </label>
                  <textarea
                    placeholder="Ví dụ: Đã trao đổi qua phỏng vấn ngày hôm qua..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #D1DBD2",
                      fontSize: "0.9rem",
                      outline: "none",
                      boxSizing: "border-box",
                      resize: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "1px solid #D1DBD2",
                      background: "#FFFFFF",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={joining || !verifiedStore}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#3D503C",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      cursor: joining || !verifiedStore ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {joining && <RefreshCw size={15} className="animate-spin" />}
                    {joining ? "Đang gửi..." : "Gửi yêu cầu kích hoạt"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

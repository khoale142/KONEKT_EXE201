import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  Building2,
  BarChart3,
  ShoppingCart,
  MapPin,
  Phone,
  Copy,
  Check,
  Plus,
  ArrowRight,
  ArrowLeft,
  Crown,
  LogOut,
  RefreshCw,
  X,
} from "lucide-react";
import { workspaceApi, WorkspaceStore, WorkspaceTenant } from "../api/workspace.api";
import { useAuthStore, isOwnerOrAdmin } from "../../../app/store/auth.store";
import api from "../../../lib/http/axios";

export default function SelectStorePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);
  const logout = useAuthStore((s) => s.logout);

  const [tenant, setTenant] = useState<WorkspaceTenant | null>(null);
  const [storesList, setStoresList] = useState<WorkspaceStore[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal tạo Store mới
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreAddress, setNewStoreAddress] = useState("");
  const [newStorePhone, setNewStorePhone] = useState("");
  const [addingStore, setAddingStore] = useState(false);
  const [addStoreError, setAddStoreError] = useState<string | null>(null);

  const isOwner = isOwnerOrAdmin(user);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const data = await workspaceApi.getWorkspaces();
        // Lấy tenant hiện tại từ user token hoặc từ location.state
        const currentTenantId = user?.tenantId;
        const currentTenant =
          data.tenants.find((t) => t.tenantId === currentTenantId) || data.tenants[0];

        if (!currentTenant) {
          navigate("/workspace/select-tenant", { replace: true });
          return;
        }

        setTenant(currentTenant);
        setStoresList(currentTenant.stores || []);
      } catch {
        navigate("/workspace/select-tenant", { replace: true });
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [user?.tenantId]);

  const handleCopyInviteCode = (code?: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSelectStoreForPos = async (store: WorkspaceStore) => {
    if (!tenant) return;
    try {
      const data = await workspaceApi.selectTenant({
        tenantId: tenant.tenantId,
        storeId: store.id,
      });
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);
      navigate("/pos", { replace: true });
    } catch {
      navigate("/pos");
    }
  };

  const handleSelectStoreForManager = async (store: WorkspaceStore) => {
    if (!tenant) return;
    try {
      const data = await workspaceApi.selectTenant({
        tenantId: tenant.tenantId,
        storeId: store.id,
      });
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);
      navigate("/store/manager", { replace: true });
    } catch {
      navigate("/store/manager");
    }
  };

  const handleGoToAllTenantDashboard = async () => {
    if (!tenant) return;
    try {
      const data = await workspaceApi.selectTenant({
        tenantId: tenant.tenantId,
      });
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);
      navigate("/office/dashboard", { replace: true });
    } catch {
      navigate("/office/dashboard");
    }
  };

  const handleCreateNewStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      setAddStoreError("Vui lòng nhập tên chi nhánh");
      return;
    }

    try {
      setAddingStore(true);
      setAddStoreError(null);
      // Gọi API tạo store trực tiếp
      await api.post("/stores", {
        name: newStoreName.trim(),
        address: newStoreAddress.trim() || undefined,
        phone: newStorePhone.trim() || undefined,
      });

      // Reload danh sách
      const updated = await workspaceApi.getWorkspaces();
      const current = updated.tenants.find((t) => t.tenantId === tenant?.tenantId);
      if (current) {
        setTenant(current);
        setStoresList(current.stores || []);
      }
      setShowAddStoreModal(false);
      setNewStoreName("");
      setNewStoreAddress("");
      setNewStorePhone("");
    } catch (err: any) {
      setAddStoreError(err?.response?.data?.message || "Không thể tạo chi nhánh mới");
    } finally {
      setAddingStore(false);
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            onClick={() => navigate("/workspace/select-tenant")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #D1DBD2",
              background: "#FAF6F3",
              color: "#3D503C",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={15} />
            Đổi thương hiệu
          </button>

          <div style={{ height: 20, width: 1, background: "#E8E0D5" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#3D503C",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.1 }}>
                {tenant?.tenantName || "Thương hiệu"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#687668", fontWeight: 600 }}>
                Mã: {tenant?.tenantCode} · Vai trò: {tenant?.role?.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
          padding: "36px 20px 80px",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              background: "#FFFFFF",
              borderRadius: 16,
              border: "1px solid #E8E0D5",
              marginTop: 20,
            }}
          >
            <RefreshCw
              size={28}
              className="animate-spin"
              style={{ margin: "0 auto 12px", color: "#3D503C" }}
            />
            <div style={{ fontWeight: 600 }}>Đang tải danh sách cơ sở...</div>
          </div>
        ) : (
          <>
            {/* Title */}
            <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: "1.85rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#2A3B2C",
              marginBottom: 6,
            }}
          >
            Chọn Điểm Bán / Chức Năng Hoạt Động
          </h1>
          <p style={{ color: "#687668", fontSize: "0.92rem", margin: 0 }}>
            Bạn đang làm việc trong thương hiệu <strong>{tenant?.tenantName}</strong>. Hãy chọn xem báo cáo
            toàn chuỗi hoặc chọn chi nhánh để mở POS bán hàng.
          </p>
        </div>

        {/* VIP BANNER DÀNH CHO OWNER: Báo cáo toàn bộ Tenant */}
        {isOwner && (
          <div
            style={{
              background: "linear-gradient(135deg, #3D503C 0%, #1E2D20 100%)",
              borderRadius: 18,
              padding: "26px 28px",
              color: "#FAF6F3",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 18,
              marginBottom: 32,
              boxShadow: "0 8px 24px rgba(61, 80, 60, 0.22)",
            }}
          >
            <div style={{ maxWidth: 620 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#D2E4D4",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  marginBottom: 10,
                  textTransform: "uppercase",
                }}
              >
                <Crown size={14} />
                Trung Tâm Điều Hành Toàn Chuỗi (Head-Office)
              </div>
              <h2 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 6px 0", color: "#FFFFFF" }}>
                Dashboard Báo Cáo Tổng Hợp Toàn Bộ Thương Hiệu
              </h2>
              <p style={{ margin: 0, color: "#B8CCBA", fontSize: "0.88rem", lineHeight: 1.5 }}>
                Theo dõi tức thì hiệu suất doanh thu, chi phí, tồn kho, duyệt phiếu kiểm kê, thực đơn và
                quản lý nhân sự của toàn bộ {storesList.length} chi nhánh trên một màn hình duy nhất.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGoToAllTenantDashboard}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "13px 22px",
                borderRadius: 10,
                border: "1px solid rgba(255, 255, 255, 0.25)",
                background: "#FAF6F3",
                color: "#3D503C",
                fontSize: "0.95rem",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                transition: "all 0.16s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#FAF6F3")}
            >
              <BarChart3 size={18} strokeWidth={2.4} />
              Xem Dashboard toàn chuỗi
              <ArrowRight size={16} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {/* Header Danh sách Chi nhánh */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#2A3B2C" }}>
              Danh Sách Chi Nhánh Cửa Hàng ({storesList.length})
            </div>
            <div style={{ fontSize: "0.82rem", color: "#687668" }}>
              Mỗi chi nhánh sở hữu mã mời nội bộ riêng để kích hoạt nhân sự và mở ca bán hàng POS.
            </div>
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setShowAddStoreModal(true);
                setAddStoreError(null);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
                borderRadius: 8,
                border: "1px solid #D1DBD2",
                background: "#FFFFFF",
                color: "#3D503C",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
              }}
            >
              <Plus size={16} />
              Mở thêm chi nhánh mới
            </button>
          )}
        </div>

        {/* Grid các Store */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {storesList.map((st) => (
            <div
              key={st.id}
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                border: "1px solid #E8E0D5",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 4px 14px rgba(0,0,0,0.02)",
                transition: "all 0.16s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C4D6C6")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E8E0D5")}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "#F4EFEB",
                      color: "#3D503C",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Store size={20} />
                  </div>

                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: st.isActive ? "#166534" : "#991B1B",
                      background: st.isActive ? "#F0FDF4" : "#FEF2F2",
                      border: `1px solid ${st.isActive ? "#BBF7D0" : "#FCA5A5"}`,
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {st.isActive ? "ĐANG HOẠT ĐỘNG" : "TẠM NGHỈ"}
                  </span>
                </div>

                <h3 style={{ fontSize: "1.18rem", fontWeight: 800, margin: "0 0 6px 0" }}>
                  {st.name}
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {st.address && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#687668" }}>
                      <MapPin size={14} flex-shrink={0} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {st.address}
                      </span>
                    </div>
                  )}

                  {st.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#687668" }}>
                      <Phone size={14} flex-shrink={0} />
                      <span>{st.phone}</span>
                    </div>
                  )}
                </div>

                {/* Mã mời Store (Internal Invite Code) */}
                {st.inviteCode && (
                  <div
                    style={{
                      background: "#FAF6F3",
                      border: "1px dashed #D1DBD2",
                      borderRadius: 8,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 18,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#687668", textTransform: "uppercase" }}>
                        Mã mời nội bộ Store
                      </div>
                      <code style={{ fontSize: "0.92rem", fontWeight: 800, color: "#3D503C", fontFamily: "monospace" }}>
                        {st.inviteCode}
                      </code>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyInviteCode(st.inviteCode)}
                      title="Sao chép mã mời"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: "1px solid #D1DBD2",
                        background: copiedCode === st.inviteCode ? "#F0FDF4" : "#FFFFFF",
                        color: copiedCode === st.inviteCode ? "#166534" : "#3D503C",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {copiedCode === st.inviteCode ? <Check size={13} /> : <Copy size={13} />}
                      {copiedCode === st.inviteCode ? "Đã chép" : "Sao chép"}
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleSelectStoreForPos(st)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "10px",
                    borderRadius: 9,
                    border: "none",
                    background: "#3D503C",
                    color: "#FFFFFF",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <ShoppingCart size={15} />
                  Mở POS
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectStoreForManager(st)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "10px",
                    borderRadius: 9,
                    border: "1px solid #D1DBD2",
                    background: "#FAF6F3",
                    color: "#2A3B2C",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Store size={15} />
                  Quản trị
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
        )}
      </main>

      {/* MODAL Mở Thêm Chi Nhánh Mới */}
      {showAddStoreModal && (
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
              maxWidth: 480,
              width: "100%",
              padding: "32px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setShowAddStoreModal(false)}
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

            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 6px 0" }}>
              Thêm Chi Nhánh Mới
            </h2>
            <p style={{ color: "#687668", fontSize: "0.85rem", margin: "0 0 20px 0" }}>
              Chi nhánh mới sẽ được tự động cấp mã mời nội bộ để kết nối nhân viên và mở quầy bán hàng.
            </p>

            {addStoreError && (
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
                {addStoreError}
              </div>
            )}

            <form onSubmit={handleCreateNewStore} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 5 }}>
                  Tên chi nhánh <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: KONEKT - Chi nhánh Quận 1"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
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
                  Địa chỉ chi nhánh
                </label>
                <input
                  type="text"
                  placeholder="Số nhà, tên đường, phường, quận..."
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
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
                  Số điện thoại chi nhánh
                </label>
                <input
                  type="text"
                  placeholder="09..."
                  value={newStorePhone}
                  onChange={(e) => setNewStorePhone(e.target.value)}
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
                  onClick={() => setShowAddStoreModal(false)}
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
                  disabled={addingStore}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#3D503C",
                    color: "#FFFFFF",
                    fontWeight: 700,
                    cursor: addingStore ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {addingStore && <RefreshCw size={15} className="animate-spin" />}
                  {addingStore ? "Đang tạo..." : "Xác nhận tạo chi nhánh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

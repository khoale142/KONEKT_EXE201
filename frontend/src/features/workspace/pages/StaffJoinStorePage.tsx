import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { workspaceApi, VerifiedStoreInvite } from "../api/workspace.api";
import { useAuthStore } from "../../../app/store/auth.store";
import {
  Store,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  LogOut,
  MapPin,
  Phone,
  Send,
} from "lucide-react";

export default function StaffJoinStorePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);
  const statusBusy = useRef(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [rejectedReason, setRejectedReason] = useState("");

  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedStore, setVerifiedStore] = useState<VerifiedStoreInvite | null>(null);
  const [verifyError, setVerifyError] = useState("");

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState("");
  const [desiredPosition, setDesiredPosition] = useState("Nhân viên pha chế / Barista");
  const [customPosition, setCustomPosition] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [pendingReqInfo, setPendingReqInfo] = useState<{
    storeName?: string;
    desiredPosition?: string;
    createdAt?: string;
  } | null>(null);

  const [refreshingStatus, setRefreshingStatus] = useState(false);

  // Nếu user đã có storeId và tenantId rồi, chuyển thẳng vào store staff
  useEffect(() => {
    if (user?.storeId && user?.tenantId && !user.requireStoreJoin && user.scope !== 'onboarding') {
      if (user.roles?.includes("store_manager")) {
        navigate("/store/manager", { replace: true });
      } else {
        navigate("/store/staff", { replace: true });
      }
    }
  }, [user, navigate]);

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = (codeToVerify || inviteCodeInput).trim().toUpperCase();
    if (!code) {
      setVerifyError("Vui lòng nhập mã cửa hàng do Chủ quán cấp.");
      return;
    }

    setVerifying(true);
    setVerifyError("");
    setVerifiedStore(null);

    try {
      const data = await workspaceApi.verifyStoreInvite(code);
      setVerifiedStore(data);
    } catch (err: any) {
      setVerifyError(
        err?.response?.data?.message || "Mã cửa hàng không hợp lệ hoặc chi nhánh tạm ngưng hoạt động."
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedStore) {
      setSubmitError("Vui lòng xác nhận mã cửa hàng hợp lệ trước khi gửi yêu cầu.");
      return;
    }
    if (!fullName.trim()) {
      setSubmitError("Vui lòng nhập họ và tên của bạn.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const pos = desiredPosition === "Khác" ? customPosition.trim() || "Nhân viên vận hành" : desiredPosition;

    try {
      await workspaceApi.submitJoinStoreRequest({
        storeInviteCode: verifiedStore.inviteCode,
        fullName: fullName.trim(),
        email: user?.email || "",
        phone: phone.trim() || undefined,
        desiredPosition: pos,
        note: note.trim() || undefined,
      });

      setRejectedReason("");
      setPendingReqInfo({
        storeName: verifiedStore.storeName,
        desiredPosition: pos,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message || "Không thể gửi yêu cầu gia nhập. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (statusBusy.current || !user) return;
    statusBusy.current = true; setRefreshingStatus(true);
    try {
      const result = await workspaceApi.getJoinStatus();
      setStatusError('');
      setPendingReqInfo(result.status === 'pending' ? result.request : null);
      setRejectedReason(result.status === 'rejected' ? result.request?.rejectedReason || 'Chủ quán chưa chấp nhận yêu cầu. Bạn có thể gửi yêu cầu mới.' : '');
      if (result.status === 'approved') {
        const session = await workspaceApi.activate();
        setTokensAndUser(session.accessToken, session.refreshToken, session.user);
        navigate(session.user.roles.includes('store_manager') ? '/store/manager' : '/store/staff', { replace: true });
      }
    } catch (err: any) { setStatusError(err?.response?.data?.message || 'Mất kết nối. Chưa kiểm tra được trạng thái duyệt.'); }
    finally { statusBusy.current = false; setRefreshingStatus(false); setStatusLoaded(true); }
  };
  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    void handleRefreshStatus();
    const refreshVisible = () => { if (document.visibilityState === 'visible') void handleRefreshStatus(); };
    const timer = window.setInterval(refreshVisible, 10000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { clearInterval(timer); window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [user?.sub]);
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 16px",
        background: "#EFE9DF",
        color: "#27402F",
        fontFamily: 'var(--font-sans, "Be Vietnam Pro", -apple-system, sans-serif)',
      }}
    >
      {statusError && <p role="alert">{statusError} <button onClick={() => void handleRefreshStatus()}>Thử lại</button></p>}
      {rejectedReason && <p role="status">Yêu cầu đã bị từ chối: {rejectedReason}</p>}
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "#27402F",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#3D5E46",
              color: "#FAF7F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(61, 94, 70, 0.28)",
            }}
          >
            <Store size={24} strokeWidth={2.4} />
          </div>
          <span style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            KONEKT POS
          </span>
        </Link>
        <p style={{ margin: 0, color: "#556B5A", fontSize: "0.95rem", fontWeight: 500 }}>
          Gia Nhập Cửa Hàng & Kích Hoạt Quyền Làm Việc
        </p>
      </div>

      {/* Main Container */}
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#DFD6C7",
          borderRadius: 24,
          padding: 8,
          boxShadow: "0 16px 40px rgba(45, 68, 52, 0.12)",
        }}
      >
        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 18,
            padding: "28px 26px 24px",
            border: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          {/* User Profile Micro-Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 16,
              marginBottom: 20,
              borderBottom: "1px solid #DFD6C7",
            }}
          >
            <div>
              <span style={{ fontSize: "0.8rem", color: "#556B5A" }}>Đăng nhập với tài khoản:</span>
              <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#27402F" }}>
                {user?.fullName || user?.username} ({user?.email})
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              style={{
                background: "transparent",
                border: "1px solid #DFD6C7",
                borderRadius: 8,
                padding: "6px 10px",
                color: "#687668",
                fontSize: "0.8rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <LogOut size={14} />
              <span>Đổi tài khoản</span>
            </button>
          </div>

          {/* TRẠNG THÁI: ĐANG CHỜ DUYỆT (PENDING STATE) */}
          {!statusLoaded ? (<p role="status">Đang kiểm tra trạng thái gia nhập…</p>) : pendingReqInfo ? (
            <div>
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 8px 24px",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "#F2EBE0",
                    border: "2px solid #DFD6C7",
                    color: "#3D5E46",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <Clock size={32} />
                </div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#27402F", margin: "0 0 8px" }}>
                  Yêu Cầu Đang Chờ Phê Duyệt
                </h2>
                <p style={{ fontSize: "0.9rem", color: "#556B5A", margin: 0, lineHeight: 1.5 }}>
                  Yêu cầu gia nhập của bạn đã được gửi thành công tới Chủ quán.
                </p>
              </div>

              {/* Thông tin đã gửi */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #DFD6C7",
                  borderRadius: 14,
                  padding: "16px 18px",
                  marginBottom: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  fontSize: "0.88rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#556B5A" }}>Cửa hàng xin gia nhập:</span>
                  <strong style={{ color: "#27402F" }}>{pendingReqInfo.storeName || "Chi nhánh đã chọn"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#556B5A" }}>Vị trí ứng tuyển:</span>
                  <strong style={{ color: "#3D5E46" }}>{pendingReqInfo.desiredPosition || "Nhân viên"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#556B5A" }}>Trạng thái:</span>
                  <span
                    style={{
                      background: "#FFF4E5",
                      color: "#B76E00",
                      padding: "2px 8px",
                      borderRadius: 6,
                      fontSize: "0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    Chờ duyệt
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={handleRefreshStatus}
                  disabled={refreshingStatus}
                  style={{
                    width: "100%",
                    padding: "12px 18px",
                    borderRadius: 12,
                    border: "none",
                    background: "#3D5E46",
                    color: "#FAF7F2",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    cursor: refreshingStatus ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 14px rgba(61, 94, 70, 0.25)",
                  }}
                >
                  <RefreshCw size={17} className={refreshingStatus ? "spin" : ""} />
                  <span>{refreshingStatus ? "Đang kiểm tra..." : "Kiểm Tra Trạng Thái Duyệt"}</span>
                </button>

                <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#556B5A", margin: "4px 0 0" }}>
                  Khi Chủ quán phê duyệt và phân vai trò, bạn sẽ được tự động chuyển vào màn hình làm việc.
                </p>
              </div>
            </div>
          ) : (
            /* FORM NHẬP MÃ CỬA HÀNG VÀ GỬI YÊU CẦU */
            <div>
              <div style={{ marginBottom: 18 }}>
                <h2
                  style={{
                    fontSize: "1.28rem",
                    fontWeight: 800,
                    color: "#27402F",
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Nhập Mã Cửa Hàng (Store Code)
                </h2>
                <p style={{ fontSize: "0.88rem", color: "#556B5A", margin: 0, lineHeight: 1.5 }}>
                  Chủ quán sẽ cung cấp cho bạn một mã cửa hàng (VD: <code>STORE-1-KONEKT</code>).
                </p>
              </div>

              {verifyError && (
                <div
                  style={{
                    background: "#FBEBEB",
                    border: "1px solid #F0C4C4",
                    borderRadius: 12,
                    padding: "10px 14px",
                    marginBottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "#992E2E",
                    fontSize: "0.88rem",
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <div>{verifyError}</div>
                </div>
              )}

              {/* Ô nhập mã mời */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Nhập mã: VD STORE-1-KONEKT"
                  value={inviteCodeInput}
                  onChange={(e) => {
                    setInviteCodeInput(e.target.value.toUpperCase());
                    setVerifiedStore(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleVerifyCode();
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #DFD6C7",
                    background: "#FFFFFF",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    color: "#27402F",
                    outline: "none",
                    textTransform: "uppercase",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleVerifyCode()}
                  disabled={verifying || !inviteCodeInput.trim()}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: "#3D5E46",
                    color: "#FAF7F2",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    cursor: verifying || !inviteCodeInput.trim() ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {verifying ? "Đang tra..." : "Xác nhận"}
                </button>
              </div>

              {/* Card thông tin chi nhánh khi đã verify thành công */}
              {verifiedStore && (
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "2px solid #3D5E46",
                    borderRadius: 14,
                    padding: "16px 18px",
                    marginBottom: 18,
                    boxShadow: "0 4px 14px rgba(61, 94, 70, 0.12)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={20} color="#3D5E46" />
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#3D5E46" }}>
                      Đã xác nhận chi nhánh hợp lệ
                    </span>
                  </div>

                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#27402F", marginBottom: 4 }}>
                    {verifiedStore.storeName}
                  </div>
                  <div style={{ fontSize: "0.88rem", color: "#556B5A", marginBottom: 8 }}>
                    Thương hiệu: <strong>{verifiedStore.tenantName}</strong>
                  </div>

                  {verifiedStore.storeAddress && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#687668", marginBottom: 4 }}>
                      <MapPin size={14} />
                      <span>{verifiedStore.storeAddress}</span>
                    </div>
                  )}

                  {verifiedStore.storePhone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#687668" }}>
                      <Phone size={14} />
                      <span>{verifiedStore.storePhone}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Form gửi yêu cầu gia nhập chi nhánh */}
              {verifiedStore && (
                <form onSubmit={handleSubmitRequest} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {submitError && (
                    <div
                      style={{
                        background: "#FBEBEB",
                        border: "1px solid #F0C4C4",
                        borderRadius: 10,
                        padding: "10px 12px",
                        color: "#992E2E",
                        fontSize: "0.85rem",
                      }}
                    >
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#27402F", marginBottom: 6 }}>
                      Họ và tên <span style={{ color: "#D14343" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #DFD6C7",
                        background: "#FFFFFF",
                        fontSize: "0.92rem",
                        color: "#27402F",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#27402F", marginBottom: 6 }}>
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      placeholder="VD: 0901234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #DFD6C7",
                        background: "#FFFFFF",
                        fontSize: "0.92rem",
                        color: "#27402F",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#27402F", marginBottom: 6 }}>
                      Vị trí ứng tuyển / Vai trò mong muốn
                    </label>
                    <select
                      value={desiredPosition}
                      onChange={(e) => setDesiredPosition(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #DFD6C7",
                        background: "#FFFFFF",
                        fontSize: "0.92rem",
                        color: "#27402F",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="Nhân viên pha chế / Barista">Nhân viên pha chế / Barista</option>
                      <option value="Nhân viên thu ngân">Nhân viên thu ngân (POS Cashier)</option>
                      <option value="Nhân viên phục vụ">Nhân viên phục vụ</option>
                      <option value="Trưởng ca (Shift Leader)">Trưởng ca (Shift Leader)</option>
                      <option value="Quản lý cửa hàng (Store Manager)">Quản lý cửa hàng (Store Manager)</option>
                      <option value="Khác">Khác...</option>
                    </select>
                  </div>

                  {desiredPosition === "Khác" && (
                    <div>
                      <input
                        type="text"
                        placeholder="Nhập vị trí mong muốn của bạn"
                        value={customPosition}
                        onChange={(e) => setCustomPosition(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid #DFD6C7",
                          background: "#FFFFFF",
                          fontSize: "0.92rem",
                          color: "#27402F",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#27402F", marginBottom: 6 }}>
                      Lời nhắn / Ghi chú gửi Chủ quán
                    </label>
                    <textarea
                      placeholder="VD: Em xin ứng tuyển ca sáng từ thứ 2 đến thứ 6..."
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #DFD6C7",
                        background: "#FFFFFF",
                        fontSize: "0.92rem",
                        color: "#27402F",
                        boxSizing: "border-box",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      marginTop: 4,
                      width: "100%",
                      padding: "13px 20px",
                      borderRadius: 12,
                      border: "none",
                      background: submitting ? "#6E8B75" : "#3D5E46",
                      color: "#FAF7F2",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      cursor: submitting ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 4px 14px rgba(61, 94, 70, 0.25)",
                    }}
                  >
                    <Send size={18} />
                    <span>{submitting ? "Đang gửi yêu cầu..." : "Gửi Yêu Cầu Gia Nhập"}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

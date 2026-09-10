import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../../../app/store/auth.store";
import { AlertCircle, ArrowRight, UserPlus, ShieldCheck, Building2 } from "lucide-react";

export default function StaffRegisterPage() {
  const navigate = useNavigate();
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Vui lòng nhập họ và tên của bạn.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Email không hợp lệ.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await authApi.registerStaff({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
      });

      // Lưu token vào Zustand Auth Store và điều hướng sang trang Onboarding nhập mã cửa hàng
      setTokensAndUser(res.accessToken, res.refreshToken, res.user);
      navigate("/workspace/join-store", { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Đăng ký tài khoản không thành công. Vui lòng kiểm tra lại thông tin."
      );
    } finally {
      setSubmitting(false);
    }
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
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
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
            <UserPlus size={24} strokeWidth={2.4} />
          </div>
          <span style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            KONEKT POS
          </span>
        </Link>
        <p style={{ margin: 0, color: "#556B5A", fontSize: "0.95rem", fontWeight: 500 }}>
          Cổng Đăng Ký Tài Khoản Nhân Viên Cửa Hàng
        </p>
      </div>

      {/* Double-Bezel Card Container */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
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
            padding: "28px 28px 24px",
            border: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h2
              style={{
                fontSize: "1.35rem",
                fontWeight: 800,
                color: "#27402F",
                margin: "0 0 6px",
                letterSpacing: "-0.02em",
              }}
            >
              Tạo Tài Khoản Nhân Viên
            </h2>
            <p style={{ fontSize: "0.88rem", color: "#556B5A", margin: 0, lineHeight: 1.5 }}>
              Sau khi tạo tài khoản, bạn sẽ nhập <strong>Mã cửa hàng</strong> do Chủ quán cấp để gửi yêu cầu gia nhập chi nhánh.
            </p>
          </div>

          {error && (
            <div
              style={{
                background: "#FBEBEB",
                border: "1px solid #F0C4C4",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 18,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                color: "#992E2E",
                fontSize: "0.88rem",
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#27402F",
                  marginBottom: 6,
                }}
              >
                Họ và tên của bạn <span style={{ color: "#D14343" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn An"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #DFD6C7",
                  background: "#FFFFFF",
                  fontSize: "0.92rem",
                  color: "#27402F",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#27402F",
                  marginBottom: 6,
                }}
              >
                Email đăng nhập <span style={{ color: "#D14343" }}>*</span>
              </label>
              <input
                type="email"
                placeholder="VD: an.barista@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #DFD6C7",
                  background: "#FFFFFF",
                  fontSize: "0.92rem",
                  color: "#27402F",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#27402F",
                  marginBottom: 6,
                }}
              >
                Mật khẩu <span style={{ color: "#D14343" }}>*</span>
              </label>
              <input
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #DFD6C7",
                  background: "#FFFFFF",
                  fontSize: "0.92rem",
                  color: "#27402F",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#27402F",
                  marginBottom: 6,
                }}
              >
                Số điện thoại liên hệ
              </label>
              <input
                type="tel"
                placeholder="VD: 0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #DFD6C7",
                  background: "#FFFFFF",
                  fontSize: "0.92rem",
                  color: "#27402F",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Banner quy trình 3 bước */}
            <div
              style={{
                marginTop: 4,
                padding: "12px 14px",
                background: "#F2EBE0",
                borderRadius: 12,
                border: "1px solid #DFD6C7",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <ShieldCheck size={16} color="#3D5E46" />
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#27402F" }}>
                  Quy trình kích hoạt tài khoản:
                </span>
              </div>
              <ol style={{ margin: "0 0 0 18px", padding: 0, fontSize: "0.8rem", color: "#556B5A", lineHeight: 1.5 }}>
                <li>Tạo tài khoản cá nhân của bạn.</li>
                <li>Nhập mã cửa hàng do Chủ quán / Quản lý cấp.</li>
                <li>Chủ quán duyệt & phân quyền vào ca làm việc.</li>
              </ol>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 8,
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
                transition: "all 0.15s ease",
              }}
            >
              <span>{submitting ? "Đang khởi tạo tài khoản..." : "Tiếp Tục · Nhập Mã Cửa Hàng"}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          {/* Footnotes & Switch links */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid #DFD6C7",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: "0.85rem",
              textAlign: "center",
            }}
          >
            <div>
              <span style={{ color: "#556B5A" }}>Đã có tài khoản? </span>
              <Link
                to="/login"
                style={{
                  color: "#3D5E46",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Đăng nhập ngay
              </Link>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Building2 size={14} color="#556B5A" />
              <span style={{ color: "#556B5A" }}>Bạn là Chủ thương hiệu? </span>
              <Link
                to="/register/owner"
                style={{
                  color: "#3D5E46",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Khởi tạo cửa hàng mới
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

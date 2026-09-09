import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Store,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../../../app/store/auth.store";

export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Vui lòng nhập đầy đủ Email và Mật khẩu");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await authApi.loginKonekt({ identifier: identifier.trim(), password });
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);

      // Điều hướng thông minh theo vai trò
      const role = data.user?.role || data.user?.roles?.[0];
      if (role === "owner" || role === "platform_admin") {
        navigate("/office", { replace: true });
      } else if (role === "store_manager") {
        navigate("/store/manager", { replace: true });
      } else if (role === "staff") {
        navigate("/pos/order", { replace: true });
      } else {
        navigate("/office", { replace: true });
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Đăng nhập không thành công. Vui lòng kiểm tra lại email hoặc mật khẩu."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (role: "owner" | "manager" | "staff") => {
    setDemoLoading(role);
    setError(null);
    try {
      const data = await authApi.demoLogin(role);
      setTokensAndUser(data.accessToken, data.refreshToken, data.user);

      if (role === "owner") {
        navigate("/office", { replace: true });
      } else if (role === "manager") {
        navigate("/store/manager", { replace: true });
      } else {
        navigate("/pos/order", { replace: true });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || `Không thể kết nối tài khoản demo ${role}`);
    } finally {
      setDemoLoading(null);
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
        background: "#FAF6F3",
        color: "#2A3B2C",
        fontFamily: 'var(--font-sans, "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "#2A3B2C",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#364D39",
              color: "#FAF6F3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(54, 77, 57, 0.25)",
            }}
          >
            <Store size={22} strokeWidth={2.4} />
          </div>
          <span style={{ fontSize: "1.45rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            KONEKT POS
          </span>
        </Link>
        <p style={{ margin: 0, color: "#687668", fontSize: "0.92rem", fontWeight: 500 }}>
          Cổng Đăng Nhập Người Dùng Hệ Thống & Bán Hàng
        </p>
      </div>

      {/* Double-Bezel Card Architecture */}
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#E8E0D5",
          borderRadius: 24,
          padding: 6,
          boxShadow: "0 20px 48px rgba(42, 59, 44, 0.10)",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 20,
            border: "1px solid #D8CFC4",
            padding: "32px 28px",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(54, 77, 57, 0.08)",
                color: "#364D39",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 10,
              }}
            >
              <Sparkles size={13} strokeWidth={2.2} />
              Cổng Doanh Nghiệp (Merchant)
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 800, color: "#1E2C20" }}>
              Đăng Nhập Cửa Hàng
            </h1>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "#687668", lineHeight: 1.5 }}>
              Dành cho Chủ cửa hàng (Owner), Quản lý chi nhánh và Thu ngân bán hàng tại quầy.
            </p>
          </div>

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 10,
                color: "#991B1B",
                fontSize: "0.85rem",
                marginBottom: 20,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Email Input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#2A3B2C",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                Email đăng nhập
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={17}
                  color="#8A9688"
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="owner@cuahang.com hoặc email của bạn"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 42px",
                    background: "#FAF6F3",
                    border: "1.5px solid #D8CFC4",
                    borderRadius: 10,
                    fontSize: "0.92rem",
                    color: "#2A3B2C",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease",
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "#2A3B2C",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  Mật khẩu
                </label>
              </div>
              <div style={{ position: "relative" }}>
                <Lock
                  size={17}
                  color="#8A9688"
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 42px 12px 42px",
                    background: "#FAF6F3",
                    border: "1.5px solid #D8CFC4",
                    borderRadius: 10,
                    fontSize: "0.92rem",
                    color: "#2A3B2C",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s ease",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#8A9688",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "13px 20px",
                background: "#364D39",
                color: "#FAF6F3",
                border: "none",
                borderRadius: 10,
                fontSize: "0.95rem",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 14px rgba(54, 77, 57, 0.24)",
                transition: "transform 0.15s ease",
              }}
            >
              <span>{loading ? "Đang xác thực..." : "Đăng Nhập Vào Hệ Thống"}</span>
              <ArrowRight size={17} />
            </button>
          </form>

          {/* Divider */}
          <div
            style={{
              margin: "24px 0 20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#A2AEA3",
              fontSize: "0.78rem",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#E8E0D5" }} />
            <span>HOẶC TRẢI NGHIỆM DEMO 1-CHẠM</span>
            <div style={{ flex: 1, height: 1, background: "#E8E0D5" }} />
          </div>

          {/* Demo Login Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <button
              type="button"
              disabled={!!demoLoading}
              onClick={() => handleQuickDemo("owner")}
              style={{
                padding: "8px 6px",
                background: "#FAF6F3",
                border: "1px solid #D8CFC4",
                borderRadius: 8,
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#2A3B2C",
                cursor: "pointer",
              }}
            >
              {demoLoading === "owner" ? "..." : "Chủ Quán"}
            </button>
            <button
              type="button"
              disabled={!!demoLoading}
              onClick={() => handleQuickDemo("manager")}
              style={{
                padding: "8px 6px",
                background: "#FAF6F3",
                border: "1px solid #D8CFC4",
                borderRadius: 8,
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#2A3B2C",
                cursor: "pointer",
              }}
            >
              {demoLoading === "manager" ? "..." : "Quản Lý"}
            </button>
            <button
              type="button"
              disabled={!!demoLoading}
              onClick={() => handleQuickDemo("staff")}
              style={{
                padding: "8px 6px",
                background: "#FAF6F3",
                border: "1px solid #D8CFC4",
                borderRadius: 8,
                fontSize: "0.78rem",
                fontWeight: 600,
                color: "#2A3B2C",
                cursor: "pointer",
              }}
            >
              {demoLoading === "staff" ? "..." : "POS Thu Ngân"}
            </button>
          </div>

          {/* Register Prompt */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: "1px solid #F0EAE2",
              textAlign: "center",
              fontSize: "0.85rem",
              color: "#687668",
            }}
          >
            <span>Chưa có tài khoản cửa hàng? </span>
            <Link
              to="/register/owner"
              style={{ color: "#364D39", fontWeight: 700, textDecoration: "underline" }}
            >
              Mở Cửa Hàng Mới Ngay
            </Link>
          </div>
        </div>
      </div>

      {/* Back to Home link */}
      <div style={{ marginTop: 24 }}>
        <Link
          to="/"
          style={{
            fontSize: "0.84rem",
            color: "#687668",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Quay về trang chủ KONEKT
        </Link>
      </div>
    </div>
  );
}

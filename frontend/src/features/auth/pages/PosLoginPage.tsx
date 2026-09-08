import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api/auth.api";
import { portalToBasePath, useAuthStore } from "../../../app/store/auth.store";

export default function PosLoginPage() {
  const navigate = useNavigate();
  const setTokensAndUser = useAuthStore((s) => s.setTokensAndUser);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    try {
      const data = await authApi.loginPos(username, password);

      const storeId = Number(data.user?.storeId);
      const normalizedStoreId = Number.isFinite(storeId) && storeId > 0 ? storeId : undefined;
      const normalizedStoreName =
        typeof data.user?.storeName === "string" && data.user.storeName.trim()
          ? data.user.storeName.trim()
          : normalizedStoreId
            ? `Store #${normalizedStoreId}`
            : undefined;

      const user = {
        id: data.user?.id,
        sub: String(data.user?.id),
        username: data.user?.username,
        fullName: data.user?.fullName,
        portal: data.user?.portal,
        roles: data.user?.roles,
        storeId: normalizedStoreId,
        storeName: normalizedStoreName,
        storeIds: data.user?.storeIds ?? (normalizedStoreId ? [normalizedStoreId] : undefined),
        stores:
          data.user?.stores ??
          (normalizedStoreId
            ? [
                {
                  id: normalizedStoreId,
                  name: normalizedStoreName || `Store #${normalizedStoreId}`,
                },
              ]
            : undefined),
      } as const;

      setTokensAndUser(data.accessToken, data.refreshToken, user);
      navigate(portalToBasePath("POS", user.roles), { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Đăng nhập POS thất bại");
    }
  };

  return (
    <div className="cafe-page">
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">Đăng nhập máy POS</h1>
        <p className="cafe-subtitle">
          Dùng tài khoản cửa hàng để vào giao diện bán hàng tại quầy.{" "}
          <Link to="/" className="cafe-link">
            Chọn cổng khác
          </Link>{" "}
          nếu bạn không đăng nhập bằng máy POS.
        </p>

        <form onSubmit={onSubmit} className="cafe-form">
          <div>
            <label className="cafe-label">
              Tên đăng nhập <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="text"
              placeholder="Nhập username POS"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="cafe-label">
              Mật khẩu <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="cafe-btn-primary" style={{ width: "100%" }}>
            Đăng nhập POS
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <Link to="/" className="cafe-link" style={{ textAlign: "center" }}>
              ← Quay lại chọn cổng đăng nhập
            </Link>
            <p className="cafe-subtitle" style={{ margin: 0, textAlign: "center", fontSize: "0.9rem" }}>
              Nếu quên thông tin đăng nhập, vui lòng liên hệ quản lý cửa hàng hoặc office.
            </p>
          </div>

          {err && (
            <p className="cafe-error" style={{ marginTop: 8 }}>
              {err}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

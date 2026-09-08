import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../app/store/auth.store";

type DashboardActionItem = {
  to?: string;
  label: string;
  disabled?: boolean;
};

const actionItems: DashboardActionItem[] = [
  { to: "/pos/pickup", label: "Tạo order và thu tiền" },
  { to: "/pos/held-orders", label: "Đơn đang giữ" },
  { to: "/pos/online-orders", label: "Xác nhận đơn online" },
  { to: "/pos/issues", label: "Phản ánh đơn hàng" },
  { to: "/pos/paid-orders", label: "Tra cứu và refund" },
  { to: "/pos/kds", label: "KDS view" },
  { to: "/pos/customer-preview", label: "Màn hình khách tại quầy" },
  { to: "/pos/shift-reconciliation", label: "Chốt ca và kiểm quỹ" },
  { to: "/pos/report", label: "Báo cáo doanh thu" },
  { to: "/pos/action-logs", label: "Nhật ký thao tác" },
];

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function ActionTile({ label, to, disabled }: DashboardActionItem) {
  const content = (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        width: "100%",
        borderRadius: 24,
        padding: "18px 16px",
        boxSizing: "border-box",
        background: "linear-gradient(180deg, #7f9577 0%, #71876a 100%)",
        border: "1px solid rgba(99, 119, 92, 0.18)",
        boxShadow: "0 10px 22px rgba(92, 112, 85, 0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        color: "#f8f8f4",
        fontSize: "clamp(15px, 1.25vw, 18px)",
        fontWeight: 700,
        lineHeight: 1.35,
        letterSpacing: "-0.01em",
        overflow: "hidden",
        wordBreak: "break-word",
      }}
    >
      <span>{label}</span>
    </div>
  );

  if (disabled || !to) {
    return content;
  }

  return (
    <Link
      to={to}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {content}
    </Link>
  );
}

function TileRow({ items }: { items: DashboardActionItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 18,
        flex: 1,
        minHeight: 0,
      }}
    >
      {items.map((item, index) => (
        <ActionTile
          key={item.to || `tile-${index}`}
          to={item.to}
          label={item.label}
          disabled={item.disabled}
        />
      ))}
    </div>
  );
}

export default function PosDashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const storeDisplayName = useMemo(() => {
    return user?.storeName?.trim() || "Coffee Chain POS";
  }, [user]);

  const firstRowItems = actionItems.slice(0, 5);
  const secondRowItems = actionItems.slice(5, 10);

  const onLogout = () => {
    logout();
    navigate("/login/pos", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4efe8",
        padding: 18,
        boxSizing: "border-box",
        fontFamily:
          '"Segoe UI", Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          minHeight: "calc(100vh - 36px)",
          background: "#faf7f2",
          border: "1px solid #e8dfd4",
          borderRadius: 28,
          boxShadow: "0 12px 28px rgba(88, 71, 53, 0.05)",
          padding: 18,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 220px 180px",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              background: "#f5f1eb",
              border: "1px solid #e5dbcf",
              borderRadius: 24,
              padding: "18px 22px",
              minHeight: 112,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "#7a6b5b",
                marginBottom: 8,
              }}
            >
              POS terminal
            </div>

            <div
              title={storeDisplayName}
              style={{
                fontSize: "clamp(20px, 2vw, 24px)",
                fontWeight: 750,
                color: "#2f2b27",
                lineHeight: 1.25,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {storeDisplayName}
            </div>
          </div>

          <div
            style={{
              background: "#f5f1eb",
              border: "1px solid #e5dbcf",
              borderRadius: 24,
              minHeight: 112,
              padding: "14px 16px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#2f2b27",
                lineHeight: 1.1,
              }}
            >
              {formatClock(now)}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#7a6b5b",
              }}
            >
              {formatDate(now)}
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            style={{
              minHeight: 112,
              border: "none",
              borderRadius: 24,
              background: "#f3dfdd",
              color: "#c5564b",
              fontSize: 16,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: "0 8px 18px rgba(197, 86, 75, 0.08)",
            }}
          >
            Đăng xuất
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <TileRow items={firstRowItems} />
          <TileRow items={secondRowItems} />
        </div>
      </div>
    </div>
  );
}
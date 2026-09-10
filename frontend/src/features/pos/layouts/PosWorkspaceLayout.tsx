import { useEffect, useState, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Coffee,
  Clock,
  Settings,
  LogOut,
  Building2,
  Receipt,
  PauseCircle,
  ChefHat,
  Wallet,
  ShoppingBag,
} from "lucide-react";
import { useAuthStore, isOwnerOrAdmin } from "../../../app/store/auth.store";
import { posListHeldOrders } from "../api/orders.api";
import PosSettingsModal from "../components/PosSettingsModal";

export default function PosWorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [clock, setClock] = useState(new Date());
  const [heldCount, setHeldCount] = useState<number>(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Cập nhật đồng hồ thời gian thực mỗi giây
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Lấy số lượng đơn đang giữ
  const fetchHeldCount = () => {
    posListHeldOrders()
      .then((res) => {
        if (res?.ok && Array.isArray(res.orders)) {
          setHeldCount(res.orders.length);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchHeldCount();
    const interval = setInterval(fetchHeldCount, 20000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const storeName = useMemo(() => {
    return user?.storeName || "KONEKT POS";
  }, [user]);

  const navItems = [
    {
      to: "/pos",
      label: "Bán Hàng",
      icon: <Coffee size={18} />,
      active: location.pathname === "/pos" || location.pathname === "/pos/order",
    },
    {
      to: "/pos/held",
      label: "Đơn Đang Giữ",
      icon: <PauseCircle size={18} />,
      badge: heldCount > 0 ? heldCount : undefined,
      active: location.pathname === "/pos/held",
    },
    {
      to: "/pos/orders",
      label: "Lịch Sử Đơn",
      icon: <Receipt size={18} />,
      active: location.pathname === "/pos/orders",
    },
    {
      to: "/pos/kds",
      label: "Bếp KDS",
      icon: <ChefHat size={18} />,
      active: location.pathname === "/pos/kds",
    },
    {
      to: "/pos/shift",
      label: "Ca Bán Hàng",
      icon: <Wallet size={18} />,
      active: location.pathname === "/pos/shift" || location.pathname === "/pos/shift-reconciliation",
    },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "#FAF8F5",
        fontFamily: '"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          height: "60px",
          backgroundColor: "#1E2C20",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        {/* Left: Store Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "220px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShoppingBag size={20} color="#FAF8F5" />
          </div>
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: "-0.01em",
              }}
              title={storeName}
            >
              {storeName}
            </div>
            <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.65)", display: "flex", alignItems: "center", gap: "4px" }}>
              <span>KONEKT Web POS</span>
              <span>•</span>
              <span style={{ color: "#84E1BC", fontWeight: 600 }}>
                {user?.fullName || user?.username || "Thu ngân"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: 5 Nav Tabs */}
        <nav style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {navItems.map((item) => {
            const isActive = item.active;
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: isActive ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid transparent",
                  backgroundColor: isActive ? "rgba(255, 255, 255, 0.16)" : "transparent",
                  color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.72)",
                  fontSize: "13px",
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge != null && (
                  <span
                    style={{
                      backgroundColor: "#EF4444",
                      color: "#FFFFFF",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "10px",
                      padding: "1px 6px",
                      minWidth: "16px",
                      textAlign: "center",
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Actions & Clock */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Nút Cài đặt */}
          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              color: "#FAF8F5",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Cài đặt định danh & hóa đơn"
          >
            <Settings size={15} />
            <span>Cài đặt</span>
          </button>

          {/* Clock */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              backgroundColor: "rgba(0, 0, 0, 0.22)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#E2E8F0",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Clock size={14} color="#94A3B8" />
            <span>
              {clock.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          {/* Nút Về Quản Trị (Chỉ hiển thị cho Owner/Admin) */}
          {isOwnerOrAdmin(user) && (
            <button
              onClick={() => navigate("/office/dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 12px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#364D39",
                color: "#FAF8F5",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Quay lại Trung tâm Quản trị Back-office"
            >
              <Building2 size={15} />
              <span>Quản Trị</span>
            </button>
          )}

          {/* Nút Đăng Xuất */}
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "7px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "#FCA5A5",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Đăng xuất khỏi POS"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Main Feature View */}
      <main
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#FAF8F5",
        }}
      >
        <Outlet />
      </main>

      {/* Modal Cài Đặt POS */}
      <PosSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          fetchHeldCount();
        }}
      />
    </div>
  );
}

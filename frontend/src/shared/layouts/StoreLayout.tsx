import { type PropsWithChildren, type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../app/store/auth.store";
import OpsNotificationDropdown from "../../features/ops-notifications/components/OpsNotificationDropdown";
import Button from "../components/Button";
import useIsMobileViewport from "../hooks/useIsMobileViewport";

const storeTheme = {
  sidebarBg: "#f6f1e7",
  sidebarBorder: "#ddd1bc",
  headerBg: "#fdfaf4",
  headerBorder: "#e7dcc8",
  brand: "#3f5a40",
  text: "#5f584c",
  textStrong: "#2f3e2f",
  activeText: "#3f5a40",
  activeBg: "#e3eadb",
  activeBorder: "#b8c6ae",
  avatarBg: "#e8dfd1",
  avatarText: "#5e5447",
  divider: "#e7dcc8",
};

type NavItem = {
  to: string;
  label: string;
  match: (pathname: string) => boolean;
};

export default function StoreLayout({ children }: PropsWithChildren) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const isMobile = useIsMobileViewport();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isManager = user?.roles?.includes("store_manager");
  const homePath = isManager ? "/store/manager" : "/store/staff";
  const userDisplayName = user?.fullName || user?.username || "Tài khoản cửa hàng";

  const navItems: NavItem[] = isManager
    ? [
        { to: "/store/manager", label: "Trang chủ", match: (path) => path === "/store/manager" },
        {
          to: "/store/manager/employees",
          label: "Nhân viên",
          match: (path) => path.startsWith("/store/manager/employees"),
        },
        {
          to: "/store/manager/schedules",
          label: "Lịch làm việc",
          match: (path) =>
            path.startsWith("/store/manager/schedules") ||
            path.startsWith("/store/manager/assign-schedule"),
        },
        {
          to: "/store/manager/schedule-requests",
          label: "Yêu cầu đổi ca",
          match: (path) => path.startsWith("/store/manager/schedule-requests"),
        },
        {
          to: "/store/manager/attendance",
          label: "Chấm công",
          match: (path) => path.startsWith("/store/manager/attendance"),
        },
        {
          to: "/store/manager/store-report",
          label: "Báo cáo quán",
          match: (path) => path.startsWith("/store/manager/store-report"),
        },
        {
          to: "/store/manager/payroll",
          label: "Bảng lương",
          match: (path) => path === "/store/manager/payroll",
        },
        {
          to: "/store/manager/inventory-shift",
          label: "Tồn kho",
          match: (path) => path.startsWith("/store/manager/inventory-shift"),
        },
        {
          to: "/store/manager/audit-reports",
          label: "Phiếu Audit",
          match: (path) => path.startsWith("/store/manager/audit-reports"),
        },
        {
          to: "/store/manager/help",
          label: "Hỗ trợ",
          match: (path) => path === "/store/manager/help",
        },
      ]
    : [
        { to: "/store/staff", label: "Trang chủ", match: (path) => path === "/store/staff" },
        {
          to: "/store/staff/profile",
          label: "Hồ sơ cá nhân",
          match: (path) => path.startsWith("/store/staff/profile"),
        },
        {
          to: "/store/staff/schedules",
          label: "Lịch làm việc",
          match: (path) => path.startsWith("/store/staff/schedules"),
        },
        {
          to: "/store/staff/payroll",
          label: "Bảng lương",
          match: (path) => path === "/store/staff/payroll",
        },
        {
          to: "/store/staff/inventory-shift",
          label: "Kiểm kê tồn kho",
          match: (path) =>
            path.startsWith("/store/staff/inventory-shift") ||
            path.startsWith("/store/staff/inventory-history"),
        },
        {
          to: "/store/staff/inventory-receipts",
          label: "Nhập hàng",
          match: (path) => path.startsWith("/store/staff/inventory-receipts"),
        },
        {
          to: "/inventory/disposals/my",
          label: "Hủy hàng",
          match: (path) => path.startsWith("/inventory/disposals"),
        },
      ];

  useEffect(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [location.pathname, isMobile]);

  const sidebarContent = (
    <>
      <Link
        to={homePath}
        style={{
          textDecoration: "none",
          color: storeTheme.brand,
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: "1.85rem",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          marginBottom: 20,
          padding: "4px 8px 10px",
        }}
      >
        kōhī coffee
      </Link>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {navItems.map((item) => (
          <SidebarLink key={item.to} to={item.to} active={item.match(location.pathname)}>
            {item.label}
          </SidebarLink>
        ))}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${storeTheme.divider}` }}>
        <Button
          variant="ghost"
          onClick={logout}
          style={{ width: "100%", justifyContent: "flex-start", color: "#9f3b2f" }}
        >
          Đăng xuất
        </Button>
      </div>
    </>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
        background: "#f1f5f0",
      }}
    >
      {isMobile ? (
        <>
          {isMenuOpen ? (
            <button
              type="button"
              aria-label="Đóng menu điều hướng"
              onClick={() => setIsMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                border: "none",
                background: "rgba(44, 44, 44, 0.36)",
                zIndex: 180,
                cursor: "pointer",
              }}
            />
          ) : null}
          <aside
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              left: isMenuOpen ? 0 : "-100%",
              width: "min(82vw, 320px)",
              borderRight: `1px solid ${storeTheme.sidebarBorder}`,
              padding: "24px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: storeTheme.sidebarBg,
              zIndex: 220,
              boxShadow: isMenuOpen ? "0 18px 40px rgba(0, 0, 0, 0.18)" : "none",
              transition: "left 0.2s ease",
              overflowY: "auto",
            }}
          >
            {sidebarContent}
          </aside>
        </>
      ) : (
        <aside
          style={{
            borderRight: `1px solid ${storeTheme.sidebarBorder}`,
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: storeTheme.sidebarBg,
          }}
        >
          {sidebarContent}
        </aside>
      )}

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            minHeight: isMobile ? "72px" : "64px",
            background: storeTheme.headerBg,
            borderBottom: `1px solid ${storeTheme.headerBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: isMobile ? "space-between" : "flex-end",
            padding: isMobile ? "12px 16px" : "0 24px",
            gap: isMobile ? "12px" : "24px",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          {isMobile ? (
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              style={{
                border: `1px solid ${storeTheme.headerBorder}`,
                borderRadius: 10,
                background: "#fffdf9",
                color: storeTheme.textStrong,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                padding: "9px 14px",
                flexShrink: 0,
              }}
            >
              Menu
            </button>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "12px" : "24px", minWidth: 0 }}>
            <OpsNotificationDropdown />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                paddingLeft: isMobile ? 0 : "16px",
                borderLeft: isMobile ? "none" : `1px solid ${storeTheme.divider}`,
                minWidth: 0,
              }}
            >
              <div style={{ textAlign: "right", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: storeTheme.textStrong,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: isMobile ? 132 : "none",
                  }}
                >
                  {userDisplayName}
                </div>
                <div style={{ fontSize: "12px", color: storeTheme.text }}>
                  {user?.roles?.[0]?.replace("_", " ").toUpperCase()}
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: storeTheme.avatarBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: storeTheme.avatarText,
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                {(user?.fullName || user?.username || "?").charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <main
          style={{
            padding: isMobile ? "16px" : "32px",
            background: "#f1f5f0",
            flex: 1,
            overflowX: "auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  children,
  active,
}: {
  to: string;
  children: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      style={{
        textDecoration: "none",
        color: active ? storeTheme.activeText : storeTheme.text,
        fontWeight: active ? 700 : 500,
        padding: "10px 12px",
        borderRadius: "10px",
        background: active ? storeTheme.activeBg : "transparent",
        border: active ? `1px solid ${storeTheme.activeBorder}` : "1px solid transparent",
        transition: "all 0.2s",
        fontSize: "14px",
      }}
    >
      {children}
    </Link>
  );
}

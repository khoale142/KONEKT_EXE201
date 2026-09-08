import { type PropsWithChildren, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../app/store/auth.store";
import useIsMobileViewport from "../hooks/useIsMobileViewport";

type NavItem = { to: string; label: string; section?: string; roles: string[] };

const ALL_NAV: NavItem[] = [
  { to: "/office/dm", label: "Tổng quan", section: "Quản lý chung", roles: ["district_manager", "admin"] },
  { to: "/office/reports/revenue", label: "Doanh thu / Chi tiêu", roles: ["district_manager", "admin"] },
  { to: "/office/dm/inventory-waste", label: "Tồn kho & hủy hàng", roles: ["district_manager", "admin"] },
  { to: "/office/dm/inventory-shift", label: "Duyệt kiểm hàng", roles: ["district_manager", "admin"] },
  { to: "/office/complaints", label: "Phản hồi khách hàng", roles: ["district_manager", "admin"] },

  { to: "/office/marketing/contents", label: "Nội dung marketing", section: "Marketing & CSKH", roles: ["marketing_sale", "admin"] },
  { to: "/office/marketing/contents/new", label: "Tạo bài viết", roles: ["marketing_sale", "admin"] },
  { to: "/office/marketing/point-vouchers", label: "Voucher đổi điểm", roles: ["marketing_sale", "admin"] },
  { to: "/office/marketing/complaints", label: "Chăm sóc khách hàng", roles: ["marketing_sale", "admin"] },

  { to: "/office/audit/stores", label: "Đối chiếu dữ liệu quán", section: "Audit & QC", roles: ["auditor", "admin"] },
  { to: "/office/audit/flags", label: "Audit flags", roles: ["auditor", "admin"] },
  { to: "/office/audit/reports", label: "Audit reports", roles: ["auditor", "admin"] },
  { to: "/office/hr", label: "Bảng điều khiển HR", section: "Human Resources", roles: ["hr_manager", "admin"] },
  { to: "/office/hr/profile-requests", label: "Yêu cầu chỉnh hồ sơ", roles: ["hr_manager", "admin"] },
  { to: "/office/hr/employees", label: "Nhân sự", roles: ["hr_manager", "admin"] },
  { to: "/office/hr/attendance", label: "Giám sát chấm công", roles: ["hr_manager", "admin"] },
  { to: "/office/hr/schedules", label: "Lịch làm việc", roles: ["hr_manager", "admin"] },
  { to: "/office/hr/payroll", label: "Quỹ lương", roles: ["hr_manager", "admin"] },
  { to: "/office/hr/requests", label: "Yêu cầu tuyển / sa thải", roles: ["hr_manager", "admin"] },
];

const officeTheme = {
  sidebarBg: "#f6f1e7",
  sidebarBorder: "#ddd1bc",
  headerBg: "#fdfaf4",
  headerBorder: "#e7dcc8",
  brand: "#3f5a40",
  brandMeta: "#8a7f6a",
  text: "#5f584c",
  textStrong: "#2f3e2f",
  activeText: "#3f5a40",
  activeBg: "#e3eadb",
  activeBorder: "#b8c6ae",
  divider: "#e7dcc8",
  avatarBg: "#e8dfd1",
  avatarText: "#5e5447",
  pageBg: "#f1f5f0",
  maxWidth: undefined as string | undefined,
};

const hrTheme = {
  sidebarBg: "#f6f1e7",
  sidebarBorder: "#ddd1bc",
  headerBg: "#fdfaf4",
  headerBorder: "#e7dcc8",
  brand: "#3f5a40",
  brandMeta: "#8a7f6a",
  text: "#5f584c",
  textStrong: "#2f3e2f",
  activeText: "#3f5a40",
  activeBg: "#e3eadb",
  activeBorder: "#b8c6ae",
  divider: "#e7dcc8",
  avatarBg: "#e8dfd1",
  avatarText: "#5e5447",
  pageBg: "#f1f5f0",
  maxWidth: "1120px",
  fontFamily: 'var(--font-sans, "DM Sans", system-ui, sans-serif)',
};

function isNavActive(pathname: string, to: string, allNavItems: NavItem[]) {
  if (pathname === to) return true;
  // Chỉ prefix-match khi KHÔNG có nav item con nào cụ thể hơn
  // VD: /office/marketing/contents KHÔNG prefix-match /office/marketing/contents/new
  //     vì đã có nav item riêng cho /new
  const hasMoreSpecificItem = allNavItems.some(
    (other) => other.to !== to && other.to.startsWith(`${to}/`),
  );
  if (hasMoreSpecificItem) return false;
  return pathname.startsWith(`${to}/`);
}

function formatRoleLabel(role?: string) {
  if (role === "marketing_sale") return "MARKETING & CSKH";
  return role ? role.replace(/_/g, " ").toUpperCase() : "OFFICE";
}

export default function OfficeWorkspaceLayout({ children }: PropsWithChildren) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const isMobile = useIsMobileViewport();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const userRoles = user?.roles ?? [];
  const navItems = ALL_NAV.filter((item) => item.roles.some((role) => userRoles.includes(role)));
  const isHrSurface = location.pathname.startsWith("/office/hr");
  const theme = isHrSurface ? hrTheme : officeTheme;
  const homePath = isHrSurface ? "/office/hr" : "/office";
  const userDisplayName = user?.fullName || user?.username || "Tài khoản office";

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
          color: theme.brand,
          fontFamily: "inherit",
          fontSize: "1.7rem",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          marginBottom: 20,
          padding: "4px 8px 6px",
        }}
      >
        kōhī coffee
      </Link>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {navItems.map((item) => {
          const active = isNavActive(location.pathname, item.to, navItems);
          return (
            <div key={item.to}>
              {item.section && !isHrSurface ? (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: theme.brandMeta,
                    padding: "14px 12px 6px",
                    letterSpacing: 1,
                  }}
                >
                  {item.section}
                </div>
              ) : null}

              <Link
                to={item.to}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: active ? theme.activeText : theme.text,
                  background: active ? theme.activeBg : "transparent",
                  border: active ? `1px solid ${theme.activeBorder}` : "1px solid transparent",
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  transition: "all 0.18s ease",
                }}
              >
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
        fontFamily: isHrSurface ? hrTheme.fontFamily : "inherit",
        background: theme.pageBg,
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
              borderRight: `1px solid ${theme.sidebarBorder}`,
              padding: "24px 16px",
              display: "flex",
              flexDirection: "column",
              background: theme.sidebarBg,
              color: theme.textStrong,
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
            borderRight: `1px solid ${theme.sidebarBorder}`,
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            background: theme.sidebarBg,
            color: theme.textStrong,
          }}
        >
          {sidebarContent}
        </aside>
      )}

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            minHeight: isMobile ? "72px" : "64px",
            background: theme.headerBg,
            borderBottom: `1px solid ${theme.headerBorder}`,
            display: "flex",
            alignItems: "center",
            justifyContent: isMobile ? "space-between" : "flex-end",
            padding: isMobile ? "12px 16px" : "0 24px",
            gap: isMobile ? 12 : 24,
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
                border: `1px solid ${theme.headerBorder}`,
                borderRadius: 10,
                background: "#fffdf9",
                color: theme.textStrong,
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingLeft: isMobile ? 0 : 16,
              borderLeft: isMobile ? "none" : `1px solid ${theme.divider}`,
              minWidth: 0,
            }}
          >
            <div style={{ textAlign: "right", minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.textStrong,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: isMobile ? 138 : "none",
                }}
              >
                {userDisplayName}
              </div>
              <div style={{ fontSize: 12, color: theme.text }}>{formatRoleLabel(user?.roles?.[0])}</div>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: theme.avatarBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: theme.avatarText,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {user?.fullName?.charAt(0) || "?"}
            </div>
            <button
              onClick={() => { logout(); window.location.href = "/"; }}
              style={{
                marginLeft: 4,
                border: `1px solid #d7c6b4`,
                borderRadius: 8,
                background: "#fffdf9",
                color: "#9f3b2f",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                padding: "5px 12px",
                letterSpacing: 0.1,
              }}
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            background: theme.pageBg,
            padding: isMobile ? "16px" : "32px",
            overflowY: "auto",
            overflowX: "auto",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: isMobile ? "100%" : theme.maxWidth,
              margin: "0 auto",
              minWidth: 0,
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

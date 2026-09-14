import { type PropsWithChildren, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, isOwnerOrAdmin } from "../../app/store/auth.store";
import useIsMobileViewport from "../hooks/useIsMobileViewport";
import WorkspaceSwitcher from "../components/WorkspaceSwitcher";
import { workspaceApi } from "../../features/workspace/api/workspace.api";
import {
  LayoutDashboard,
  Coffee,
  PackageCheck,
  Sparkles,
  Users,
  Monitor,
  LogOut,
  Menu as MenuIcon,
  Crown,
  Store as StoreIcon,
  Calculator,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  roles: string[];
  icon: LucideIcon;
  isUpcoming?: boolean;
  subLabel?: string;
  description?: string;
};

type NavSection = {
  sectionTitle: string;
  items: NavItem[];
};

/**
 * Navigation Sections — CONSOLIDATED HUBS ARCHITECTURE (5 Unified Centers + Future Accounting)
 * ──────────────────────────────────────────────────────────
 * VẬN HÀNH & KINH DOANH:
 * 1. Tổng quan chuỗi: /office/dashboard
 * 2. Thực đơn & Định lượng: /office/menu
 * 3. Kho & Vật tư: /office/inventory
 * 4. Khuyến mãi & Ưu đãi: /office/promotions
 *
 * QUẢN TRỊ NỘI BỘ:
 * 5. Quản lý nhân sự: /office/hr (kèm Badge số request chờ duyệt)
 * 6. Tài chính & Kế toán (Dành sẵn vị trí cho Thu - chi, Công nợ KH, Công nợ NCC)
 */
const NAV_SECTIONS: NavSection[] = [
  {
    sectionTitle: "VẬN HÀNH & KINH DOANH",
    items: [
      {
        to: "/office/dashboard",
        label: "Tổng quan chuỗi",
        roles: ["owner", "store_manager"],
        icon: LayoutDashboard,
        description: "Báo cáo doanh thu, ca làm việc & hiệu suất kinh doanh toàn chuỗi",
      },
      {
        to: "/office/menu",
        label: "Thực đơn & Định lượng",
        roles: ["owner", "store_manager"],
        icon: Coffee,
        description: "Quản lý món bán lẻ, công thức định lượng đa size & giá vốn",
      },
      {
        to: "/office/inventory",
        label: "Kho & Quản lý vật tư",
        roles: ["owner", "store_manager"],
        icon: PackageCheck,
        description: "Nhập - xuất - tồn nguyên vật liệu, kiểm kê & cảnh báo định mức kho",
      },
      {
        to: "/office/promotions",
        label: "Khuyến mãi & Ưu đãi",
        roles: ["owner"],
        icon: Sparkles,
        description: "Chương trình giảm giá, voucher & chính sách khách hàng thân thiết",
      },
    ],
  },
  {
    sectionTitle: "QUẢN TRỊ NỘI BỘ",
    items: [
      {
        to: "/office/hr",
        label: "Quản lý nhân sự",
        roles: ["owner"],
        icon: Users,
        description: "Hồ sơ nhân viên, phân quyền cửa hàng & xét duyệt tài khoản",
      },
      {
        to: "#accounting-upcoming",
        label: "Tài chính & Kế toán",
        roles: ["owner"],
        icon: Calculator,
        isUpcoming: true,
        subLabel: "Thu - chi, Công nợ KH & NCC",
        description: "Thu - chi, dòng tiền, công nợ khách hàng & NCC (Đang phát triển)",
      },
    ],
  },
];

/**
 * Theme Xanh rêu thanh lịch chuẩn theo bảng màu mẫu của Chủ Quán (#3D503C & #FEF8EE)
 */
const ownerTheme = {
  sidebarBg: "#3D503C", // Xanh rêu mẫu tươi mắt, không bị đậm tối
  sidebarBorder: "rgba(255, 255, 255, 0.10)",
  headerBg: "#FFFFFF", // Trắng tinh khiết nổi bật trên nền kem
  headerBorder: "#E4DFD6", // Đường kẻ ngăn cách chuẩn ảnh mẫu
  headerShadow: "0 4px 20px -2px rgba(61, 80, 60, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.03)", // Đổ bóng phân tầng rõ rệt
  brand: "#FFFFFF",
  brandBadge: "CHỦ QUÁN",
  brandBadgeBg: "rgba(255, 255, 255, 0.16)",
  brandBadgeText: "#EBF3EA",
  brandMeta: "#C5D6C4",
  text: "#D5E2D4",
  textStrong: "#FFFFFF",
  activeText: "#FFFFFF",
  activeBg: "#4E654D", // Nền active sáng hơn nhẹ nhàng, tương phản rõ nét với #3D503C
  activeBorder: "rgba(255, 255, 255, 0.22)",
  hoverBg: "rgba(255, 255, 255, 0.09)",
  hoverText: "#FFFFFF",
  divider: "#E4DFD6",
  avatarBg: "#3D503C",
  avatarText: "#FFFFFF",
  pageBg: "#F8F6F1", // Nền kem nhẹ thanh lịch #F8F6F1 (dẹp màu vàng ố)
  maxWidth: undefined as string | undefined,
  fontFamily: 'var(--font-sans, "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  isDarkSidebar: true,
};

/**
 * Theme cho Quản lý cơ sở / Vận hành chung
 */
const officeTheme = {
  sidebarBg: "#F8F6F1",
  sidebarBorder: "#E8E3DA",
  headerBg: "#FFFFFF",
  headerBorder: "#E8E3DA",
  headerShadow: "0 4px 20px -2px rgba(61, 80, 60, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.03)",
  brand: "#3D503C",
  brandBadge: "QUẢN LÝ",
  brandBadgeBg: "rgba(61, 80, 60, 0.10)",
  brandBadgeText: "#3D503C",
  brandMeta: "#6b6b6b",
  text: "#616F60",
  textStrong: "#2C3B2B",
  activeText: "#3D503C",
  activeBg: "rgba(61, 80, 60, 0.12)",
  activeBorder: "#50694F",
  hoverBg: "rgba(61, 80, 60, 0.06)",
  hoverText: "#2C3B2B",
  divider: "#E8E3DA",
  avatarBg: "#3D503C",
  avatarText: "#FFFFFF",
  pageBg: "#F8F6F1",
  maxWidth: undefined as string | undefined,
  fontFamily: 'var(--font-sans, "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  isDarkSidebar: false,
};

const hrTheme = {
  ...officeTheme,
  maxWidth: "1120px",
};

function isNavActive(pathname: string, to: string) {
  if (to.startsWith("#")) return false;
  if (pathname === to) return true;
  if (to === "/office/dashboard" && (pathname === "/office" || pathname === "/office/dashboard" || pathname.startsWith("/office/reports"))) return true;
  if (to === "/office/menu" && pathname.startsWith("/office/menu")) return true;
  if (to === "/office/inventory" && (pathname.startsWith("/office/inventory") || pathname.startsWith("/office/dm/inventory"))) return true;
  if (to === "/office/promotions" && (pathname.startsWith("/office/promotions") || pathname.startsWith("/office/marketing"))) return true;
  if (to === "/office/hr" && pathname.startsWith("/office/hr")) return true;
  return pathname.startsWith(`${to}/`);
}

function formatRoleLabel(role?: string) {
  switch (role) {
    case 'owner': return 'CHỦ QUÁN';
    case 'platform_admin': return 'QUẢN TRỊ HỆ THỐNG';
    case 'store_manager': return 'QUẢN LÝ CỬA HÀNG';
    case 'staff': return 'NHÂN VIÊN';
    default: return role ? role.replace(/_/g, ' ').toUpperCase() : 'OFFICE';
  }
}

export default function OfficeWorkspaceLayout({ children }: PropsWithChildren) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pendingStaffCount, setPendingStaffCount] = useState<number>(0);
  const userRoles = user?.roles ?? [];

  // Tooltip flyout hiển thị thông tin trang khi menu thu nhỏ
  const [hoveredNav, setHoveredNav] = useState<{
    item: NavItem;
    top: number;
    active: boolean;
  } | null>(null);

  // Phóng to / Thu nhỏ menu điều hướng (Mặc định là thu nhỏ theo chỉ đạo của Chủ quán)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("konekt_sidebar_collapsed");
    if (saved !== null) return saved === "true";
    return true; // Mặc định là thu nhỏ!
  });

  function toggleCollapsed() {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("konekt_sidebar_collapsed", String(next));
      return next;
    });
  }

  // Owner thấy tất cả nav items (superuser bypass)
  const showOwner = isOwnerOrAdmin(user);
  const [staffRevision, setStaffRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setStaffRevision(v => v + 1);
    window.addEventListener('konekt:staff-changed', refresh);
    return () => window.removeEventListener('konekt:staff-changed', refresh);
  }, []);

  useEffect(() => {
    let active = true;
    workspaceApi
      .getStaffRequests()
      .then((res) => {
        if (active) {
          const count = res.filter((r) => r.status === "pending").length;
          setPendingStaffCount(count);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname, user?.tenantId, staffRevision]);

  const isHrSurface = location.pathname.startsWith("/office/hr");
  // Nếu là Owner -> Dùng Theme xanh rêu mẫu (#3D503C & #FEF8EE)
  const theme = showOwner ? ownerTheme : (isHrSurface ? hrTheme : officeTheme);
  const homePath = isHrSurface ? "/office/hr" : "/office/dashboard";
  const userDisplayName = user?.fullName || user?.username || "Tài khoản office";

  useEffect(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [location.pathname, isMobile]);

  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Brand Header */}
      <div
        style={{
          padding: isCollapsed ? "0 0 12px" : "2px 4px 14px",
          borderBottom: `1px solid ${theme.isDarkSidebar ? "rgba(255, 255, 255, 0.10)" : theme.divider}`,
          marginBottom: 14,
          display: "flex",
          flexDirection: isCollapsed ? "column" : "row",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          gap: isCollapsed ? 6 : 8,
        }}
      >
        <Link
          to={homePath}
          style={{
            textDecoration: "none",
            color: theme.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: 10,
            minWidth: 0,
            flex: isCollapsed ? "none" : 1,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: theme.isDarkSidebar ? "#4A6249" : "#3D503C",
              border: theme.isDarkSidebar ? "1px solid rgba(255, 255, 255, 0.18)" : "none",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.18)",
              flexShrink: 0,
            }}
          >
            {showOwner ? (
              <Crown size={20} strokeWidth={2.3} />
            ) : (
              <StoreIcon size={20} strokeWidth={2.2} />
            )}
          </div>
          {!isCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  color: theme.brand,
                  whiteSpace: "nowrap",
                }}
              >
                KONEKT POS
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <span
                  style={{
                    fontSize: "0.64rem",
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    color: theme.brandBadgeText,
                    background: theme.brandBadgeBg,
                    padding: "1px 6px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {theme.brandBadge}
                </span>
              </div>
            </div>
          )}
        </Link>

        {/* Nút mũi tên đơn giản phóng to / thu nhỏ */}
        {!isMobile && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title={isCollapsed ? "Mở rộng thanh menu" : "Thu nhỏ thanh menu"}
            style={{
              border: "none",
              background: "rgba(255, 255, 255, 0.08)",
              color: "#FFFFFF",
              cursor: "pointer",
              width: 26,
              height: 26,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
              flexShrink: 0,
              marginTop: isCollapsed ? 4 : 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.20)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
          >
            {isCollapsed ? (
              <ChevronRight size={15} strokeWidth={2.4} />
            ) : (
              <ChevronLeft size={15} strokeWidth={2.4} />
            )}
          </button>
        )}
      </div>

      {/* Navigation List with Sections & Comfortable Button Sizes */}
      <nav
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: isCollapsed ? 12 : 16,
          paddingRight: isCollapsed ? 0 : 2,
        }}
      >
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            showOwner ? true : item.roles.some((role) => userRoles.includes(role))
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.sectionTitle}>
              {/* Section Header Label or Subtle Divider */}
              {isCollapsed ? (
                <div
                  style={{
                    height: 1,
                    background: theme.isDarkSidebar ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                    margin: "2px 6px 8px",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    color: theme.isDarkSidebar ? "#A6BEA5" : "#7E8E7D",
                    textTransform: "uppercase",
                    padding: "4px 10px 8px",
                    userSelect: "none",
                  }}
                >
                  {section.sectionTitle}
                </div>
              )}

              {/* Section Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: isCollapsed ? 4 : 6 }}>
                {visibleItems.map((item) => {
                  const active = isNavActive(location.pathname, item.to);
                  const IconComp = item.icon;

                  // Upcoming placeholder item (Tài chính & Kế toán)
                  if (item.isUpcoming) {
                    return (
                      <div
                        key={item.to}
                        onMouseEnter={(e) => {
                          if (isCollapsed) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredNav({
                              item,
                              top: rect.top + rect.height / 2,
                              active: false,
                            });
                          }
                        }}
                        onMouseLeave={() => {
                          if (isCollapsed) {
                            setHoveredNav(null);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: isCollapsed ? "center" : "flex-start",
                          gap: isCollapsed ? 0 : 10,
                          padding: isCollapsed ? "6px 0" : "10px 12px",
                          borderRadius: 10,
                          background: "rgba(255, 255, 255, 0.04)",
                          border: "1px dashed rgba(255, 255, 255, 0.16)",
                          color: theme.isDarkSidebar ? "#B3C7B2" : "#8A9989",
                          cursor: "default",
                          opacity: 0.88,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: "rgba(255, 255, 255, 0.06)",
                            color: theme.isDarkSidebar ? "#B3C7B2" : "#8A9989",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <IconComp size={19} strokeWidth={1.8} />
                        </div>
                        {!isCollapsed && (
                          <>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>
                                {item.label}
                              </div>
                              {item.subLabel && (
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    color: theme.isDarkSidebar ? "#8EA58D" : "#8A9989",
                                    marginTop: 2,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {item.subLabel}
                                </div>
                              )}
                            </div>
                            <span
                              style={{
                                background: "rgba(255, 255, 255, 0.12)",
                                color: theme.isDarkSidebar ? "#E4EFE3" : "#4A5D49",
                                fontSize: "0.66rem",
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 6,
                                letterSpacing: 0.2,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Sắp có
                            </span>
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.to}
                      style={{ position: "relative" }}
                      onMouseEnter={(e) => {
                        if (isCollapsed) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredNav({
                            item,
                            top: rect.top + rect.height / 2,
                            active,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        if (isCollapsed) {
                          setHoveredNav(null);
                        }
                      }}
                    >
                      <Link
                        to={item.to}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: isCollapsed ? "center" : "flex-start",
                          gap: isCollapsed ? 0 : 10,
                          padding: isCollapsed ? "6px 0" : "9px 11px",
                          borderRadius: 10,
                          textDecoration: "none",
                          color: active ? theme.activeText : theme.text,
                          background: active ? theme.activeBg : "transparent",
                          border: active ? `1px solid ${theme.activeBorder}` : "1px solid transparent",
                          fontWeight: active ? 700 : 500,
                          fontSize: 13,
                          transition: "all 0.16s ease",
                          boxShadow: active && theme.isDarkSidebar ? "0 2px 10px rgba(0,0,0,0.18)" : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = theme.hoverBg;
                            e.currentTarget.style.color = theme.hoverText;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = theme.text;
                          }
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: active
                              ? (theme.isDarkSidebar ? "#FFFFFF" : theme.activeBg)
                              : (theme.isDarkSidebar ? "rgba(255, 255, 255, 0.08)" : "rgba(61, 80, 60, 0.06)"),
                            color: active
                              ? (theme.isDarkSidebar ? "#3D503C" : theme.activeText)
                              : (theme.isDarkSidebar ? "#D5E2D4" : "#616F60"),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            boxShadow: active && theme.isDarkSidebar ? "0 2px 6px rgba(0, 0, 0, 0.14)" : "none",
                            transition: "all 0.16s ease",
                            position: "relative",
                          }}
                        >
                          <IconComp size={19} strokeWidth={active ? 2.4 : 1.9} />
                          {isCollapsed && item.to === "/office/hr" && pendingStaffCount > 0 && (
                            <span
                              style={{
                                position: "absolute",
                                top: -2,
                                right: -2,
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "#F59E0B",
                                boxShadow: "0 0 4px #F59E0B",
                              }}
                            />
                          )}
                        </div>
                        {!isCollapsed && (
                          <>
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                              }}
                            >
                              {item.label}
                            </span>
                            {item.to === "/office/hr" && pendingStaffCount > 0 && (
                              <span
                                style={{
                                  marginLeft: "auto",
                                  background: "#F59E0B",
                                  color: "#1E293B",
                                  fontSize: "0.74rem",
                                  fontWeight: 800,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  boxShadow: "0 1px 4px rgba(245, 158, 11, 0.35)",
                                }}
                              >
                                {pendingStaffCount}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        fontFamily: theme.fontFamily,
        background: theme.pageBg,
        overflow: "hidden",
      }}
    >
      {/* Mobile Drawer */}
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
                background: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(2px)",
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
              width: "min(84vw, 320px)",
              borderRight: `1px solid ${theme.sidebarBorder}`,
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              background: theme.sidebarBg,
              color: theme.textStrong,
              zIndex: 220,
              boxShadow: isMenuOpen ? "0 18px 40px rgba(0, 0, 0, 0.35)" : "none",
              transition: "left 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
              overflowY: "auto",
            }}
          >
            {sidebarContent}
          </aside>
        </>
      ) : (
        /* Desktop Sidebar (Thu nhỏ 60px / Phóng to 240px) */
        <aside
          style={{
            width: isCollapsed ? "60px" : "240px",
            minWidth: isCollapsed ? "60px" : "240px",
            maxWidth: isCollapsed ? "60px" : "240px",
            height: "100vh",
            flexShrink: 0,
            overflowY: "auto",
            overflowX: "hidden",
            borderRight: `1px solid ${theme.sidebarBorder}`,
            boxShadow: theme.isDarkSidebar
              ? "4px 0 16px rgba(0, 0, 0, 0.14)"
              : "2px 0 8px rgba(61, 80, 60, 0.05)",
            padding: isCollapsed ? "14px 6px" : "18px 10px",
            display: "flex",
            flexDirection: "column",
            background: theme.sidebarBg,
            color: theme.textStrong,
            zIndex: 40,
            transition:
              "width 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.22s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.22s cubic-bezier(0.16, 1, 0.3, 1), padding 0.22s ease",
          }}
        >
          {sidebarContent}
        </aside>
      )}

      {/* Main Content Area — Cuộn độc lập, khóa cứng thanh menu */}
      <div
        style={{
          flex: 1,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Top Header — Tách biệt rõ ràng với Background nhờ Nền Trắng + Border + Đổ bóng Phân tầng */}
        <header
          style={{
            minHeight: isMobile ? "64px" : "66px",
            background: theme.headerBg,
            borderBottom: `1px solid ${theme.headerBorder}`,
            boxShadow: theme.headerShadow,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "10px 16px" : "0 32px",
            gap: isMobile ? 12 : 20,
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
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: `1px solid ${theme.headerBorder}`,
                borderRadius: 8,
                background: "#FFFFFF",
                color: "#2C3B2B",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                padding: "7px 12px",
                flexShrink: 0,
              }}
            >
              <MenuIcon size={16} />
              Menu
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleCollapsed}
              title={isCollapsed ? "Mở rộng thanh menu" : "Thu nhỏ thanh menu"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                border: `1px solid ${theme.headerBorder}`,
                borderRadius: 8,
                background: "#FFFFFF",
                color: "#2C3B2B",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#F8F6F1";
                e.currentTarget.style.borderColor = "#3D503C";
                e.currentTarget.style.color = "#3D503C";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.borderColor = theme.headerBorder;
                e.currentTarget.style.color = "#2C3B2B";
              }}
            >
              {isCollapsed ? (
                <ChevronRight size={17} strokeWidth={2.3} />
              ) : (
                <ChevronLeft size={17} strokeWidth={2.3} />
              )}
            </button>
          )}

          {/* Right Side Header Items */}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 16, marginLeft: "auto" }}>
            {/* Workspace Switcher (Multi-Tenant Hub) */}
            <WorkspaceSwitcher />

          {/* ── NÚT CHUYỂN ĐỔI POS — Chỉ hiển thị cho Owner ── */}
          {showOwner ? (
            <button
              type="button"
              onClick={() => navigate('/pos')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                borderRadius: 10,
                background: '#3D503C',
                color: '#FEF8EE',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '9px 18px',
                letterSpacing: 0.1,
                transition: 'all 180ms ease',
                boxShadow: '0 2px 8px rgba(61, 80, 60, 0.25)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2C3B2B';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(61, 80, 60, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#3D503C';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(61, 80, 60, 0.25)';
              }}
            >
              <Monitor size={17} strokeWidth={2.2} />
              Mở POS Bán Hàng
            </button>
          ) : null}

          {/* User Profile & Logout */}
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
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "#1E2C20",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: isMobile ? 120 : "none",
                }}
              >
                {userDisplayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#687668",
                  letterSpacing: 0.2,
                }}
              >
                {formatRoleLabel(user?.roles?.[0])}
              </div>
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
                fontWeight: 800,
                fontSize: 14,
                boxShadow: "0 2px 6px rgba(54, 77, 57, 0.2)",
                flexShrink: 0,
              }}
            >
              {user?.fullName?.charAt(0)?.toUpperCase() || "K"}
            </div>

            <button
              type="button"
              onClick={() => { logout(); window.location.href = "/"; }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginLeft: 2,
                border: "1px solid #D8CFC4",
                borderRadius: 8,
                background: "#FFFFFF",
                color: "#9F3B2F",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                padding: "6px 12px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FFF5F5";
                e.currentTarget.style.borderColor = "#FCA5A5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.borderColor = "#D8CFC4";
              }}
            >
              <LogOut size={13} />
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

        {/* Workspace Body */}
        <main
          style={{
            flex: 1,
            background: theme.pageBg,
            padding: isMobile ? "16px 12px" : "24px 28px",
            overflowY: "auto",
            overflowX: "hidden",
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

      {/* ── Tooltip Flyout hiển thị thông tin trang khi Menu thu nhỏ ── */}
      {isCollapsed && hoveredNav && (
        <div
          style={{
            position: "fixed",
            left: 68,
            top: hoveredNav.top,
            transform: "translateY(-50%)",
            zIndex: 9999,
            background: "#1E2C20",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: 10,
            padding: "10px 14px",
            boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.45), 0 4px 10px -2px rgba(0, 0, 0, 0.25)",
            pointerEvents: "none",
            width: 250,
            animation: "navFlyoutFadeIn 0.12s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Mũi tên chỉ vào icon tương ứng */}
          <div
            style={{
              position: "absolute",
              left: -6,
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderRight: "6px solid #1E2C20",
            }}
          />

          {/* Tiêu đề trang + Icon + Trạng thái */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: hoveredNav.item.description ? 4 : 0 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: hoveredNav.active ? "#FFFFFF" : "rgba(255, 255, 255, 0.12)",
                color: hoveredNav.active ? "#3D503C" : "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <hoveredNav.item.icon size={13} strokeWidth={2.4} />
            </div>

            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: -0.1,
                flex: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {hoveredNav.item.label}
            </span>

            {hoveredNav.active && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#D1FAE5",
                  background: "rgba(16, 185, 129, 0.25)",
                  padding: "1.5px 6px",
                  borderRadius: 4,
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  whiteSpace: "nowrap",
                }}
              >
                Đang xem
              </span>
            )}

            {hoveredNav.item.isUpcoming && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#FEF3C7",
                  background: "rgba(245, 158, 11, 0.25)",
                  padding: "1.5px 6px",
                  borderRadius: 4,
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  whiteSpace: "nowrap",
                }}
              >
                Sắp có
              </span>
            )}

            {hoveredNav.item.to === "/office/hr" && pendingStaffCount > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#FEF3C7",
                  background: "rgba(245, 158, 11, 0.3)",
                  padding: "1.5px 6px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                }}
              >
                {pendingStaffCount} chờ duyệt
              </span>
            )}
          </div>

          {/* Mô tả chi tiết tính năng của trang */}
          {hoveredNav.item.description && (
            <div
              style={{
                fontSize: 11,
                color: "#C5D6C4",
                lineHeight: 1.45,
                paddingLeft: 30,
              }}
            >
              {hoveredNav.item.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

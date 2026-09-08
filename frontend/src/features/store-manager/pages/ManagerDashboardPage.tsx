import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  managerDashboardApi,
  type StoreDashboardInsights,
} from "../api/managerDashboard.api";
import {
  getTodayStoreReport,
  type StoreReportResponse,
} from "../api/storeReport.api";
import { useAuthStore } from "../../../app/store/auth.store";
import { formatDateVN, getTodayVN } from "../../shared/utils/formatDateTime";
import {
  DashboardShell,
  DashboardHero,
  RoleBadge,
  DashboardSection,
  FeatureCard,
  FeatureGrid,
  DashIcons,
  dash,
  StatStrip,
} from "../../shared/dashboard/dashboardUi";

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function formatMoney(value: number | null | undefined) {
  return moneyFormatter.format(Number(value || 0));
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${Number(value).toFixed(1)} phút`;
}

const OPERATIONS = [
  {
    to: "/store/manager/schedules",
    title: "Lịch làm cửa hàng",
    description: "Xem lịch tuần của toàn bộ nhân viên trong cửa hàng.",
    icon: DashIcons.calendar,
    featured: true,
  },
  {
    to: "/store/manager/assign-schedule",
    title: "Phân công lịch",
    description: "Tạo và cập nhật ca làm cho nhân viên, trưởng ca.",
    icon: DashIcons.assign,
    featured: false,
  },
  {
    to: "/store/manager/attendance-insights",
    title: "Phân tích chấm công",
    description:
      "Bảng vắng, hàng đợi xử lý, ngày nóng — báo cáo đầy đủ theo kỳ.",
    icon: DashIcons.zap,
    featured: false,
  },
  {
    to: "/store/manager/store-report",
    title: "Doanh thu & tình trạng quán",
    description:
      "Xem doanh thu, tiến độ xử lý đơn, cảnh báo vận hành và đơn đặc biệt của cửa hàng.",
    icon: DashIcons.wallet,
    featured: true,
  },
  {
    to: "/store/manager/schedule-requests",
    title: "Duyệt đổi ca",
    description: "Xem và phê duyệt các yêu cầu thay đổi lịch làm từ nhân viên.",
    icon: DashIcons.edit,
    featured: true,
  },

  // ===== TỒN HÀNG =====
  {
    to: "/store/manager/inventory-shift",
    title: "Kiểm hàng theo ca",
    description: "Nhập hoặc cập nhật số liệu kiểm hàng của ca.",
    icon: DashIcons.clipboard,
    featured: true,
  },
  {
    to: "/store/inventory/store-manager-approval",
    title: "Xác nhận phiếu kiểm hàng",
    description:
      "Phiếu trưởng ca gửi: xem lại, xác nhận hoặc trả lại — bước cửa hàng trong quy trình kiểm kê.",
    icon: DashIcons.edit,
    featured: false,
  },

  // ===== NHẬP HÀNG =====
  {
    to: "/store/staff/inventory-receipts",
    title: "Nhập hàng",
    description: "Tạo hoặc cập nhật phiếu nhập kho khi cửa hàng nhận hàng thực tế.",
    icon: DashIcons.assign,
    featured: true,
  },
  {
    to: "/store/inventory/receipt-store-manager-approval",
    title: "Xác nhận phiếu nhập hàng",
    description:
      "Xem lại và xác nhận phiếu nhập kho do trưởng ca hoặc nhân viên gửi lên.",
    icon: DashIcons.edit,
    featured: false,
  },

  // ===== HỦY HÀNG =====
  {
    to: "/inventory/disposals/manage",
    title: "Quản lý hủy hàng",
    description:
      "Xem report hủy hàng, xử lý và lập đơn hủy theo luồng cửa hàng.",
    icon: DashIcons.clipboard,
    featured: true,
  },
  {
    to: "/inventory/disposals/history",
    title: "Lịch sử hủy hàng",
    description: "Theo dõi các đơn hủy hàng đã xử lý tại cửa hàng.",
    icon: DashIcons.clock,
    featured: false,
  },

  {
    to: "/store/manager/audit-reports",
    title: "Phiếu Audit",
    description: "Xem và quản lý biên bản kiểm toán cửa hàng.",
    icon: DashIcons.clipboard,
    featured: false,
  },
] as const;

const HR_LINKS = [
  {
    to: "/store/manager/employees",
    title: "Nhân viên cửa hàng",
    description: "Danh sách, tìm kiếm và mở hồ sơ từng người.",
    icon: DashIcons.users,
    featured: false,
  },
  {
    to: "/store/manager/profile-requests",
    title: "Yêu cầu chỉnh hồ sơ",
    description: "Các đơn cập nhật thông tin chờ xử lý tại cửa hàng.",
    icon: DashIcons.user,
    featured: false,
  },
  {
    to: "/store/manager/payroll",
    title: "Bảng lương (Payroll)",
    description:
      "Quản lý và chốt bảng lương tổng hợp của tất cả nhân sự cửa hàng.",
    icon: DashIcons.wallet,
    featured: true,
  },
] as const;

const MAX_ALERTS_PREVIEW = 4;
const MAX_ACTION_PREVIEW = 4;

function actionTypeAccent(type: string): { border: string; bg: string } {
  if (type === "overdue_checkout") return { border: "#c53030", bg: "#fff5f5" };
  if (
    type === "absent" ||
    type === "awaiting_checkin" ||
    type === "missing_checkout_late"
  ) {
    return { border: "#dd6b20", bg: "#fffaf0" };
  }
  return { border: "#718096", bg: "#f7fafc" };
}

function reportTone(
  type: "revenue" | "positive" | "warning" | "neutral",
): { background: string; border: string; valueColor: string; labelColor: string } {
  if (type === "revenue") {
    return {
      background: "#eff7ee",
      border: "#cfe0cb",
      valueColor: "#1f6d35",
      labelColor: "#2d5e3e",
    };
  }
  if (type === "positive") {
    return {
      background: "#eef6ff",
      border: "#c9dcf5",
      valueColor: "#1d4f91",
      labelColor: "#335f99",
    };
  }
  if (type === "warning") {
    return {
      background: "#fff7e8",
      border: "#f1dfbb",
      valueColor: "#8a5a00",
      labelColor: "#8a5a00",
    };
  }
  return {
    background: "#f8faf7",
    border: dash.border,
    valueColor: dash.primaryDark,
    labelColor: dash.muted,
  };
}

function StoreReportKpiCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "revenue" | "positive" | "warning" | "neutral";
}) {
  const palette = reportTone(tone);
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        padding: "16px 18px",
        minHeight: 118,
      }}
    >
      <div
        style={{
          fontSize: "0.74rem",
          fontWeight: 800,
          color: palette.labelColor,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: "1.7rem",
          lineHeight: 1.05,
          fontWeight: 900,
          color: palette.valueColor,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {hint ? (
        <div
          style={{
            marginTop: 10,
            fontSize: "0.8rem",
            color: dash.muted,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export default function ManagerDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  useEffect(() => {
    if (user && !selectedStoreId) {
      setSelectedStoreId(Number(user.storeId || user.storeIds?.[0] || null));
    }
  }, [user, selectedStoreId]);

  const [insights, setInsights] = useState<StoreDashboardInsights | null>(null);
  const [storeReport, setStoreReport] = useState<StoreReportResponse | null>(null);
  const [storeReportAlerts, setStoreReportAlerts] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setInsightsLoading(true);
        setInsightsError("");
        if (!selectedStoreId) {
          setInsights(null);
          setStoreReport(null);
          setStoreReportAlerts([]);
          return;
        }
        const [attendanceResult, reportResult] = await Promise.allSettled([
          managerDashboardApi.getDashboardInsights(Number(selectedStoreId), 7),
          getTodayStoreReport(),
        ]);

        if (attendanceResult.status !== "fulfilled") {
          throw attendanceResult.reason;
        }

        setInsights(attendanceResult.value);
        if (reportResult.status === "fulfilled") {
          setStoreReport(reportResult.value);
          setStoreReportAlerts([
            ...reportResult.value.alerts.map((item) => `[Báo cáo quán] ${item}`),
            ...reportResult.value.insights.map((item) => `[Báo cáo quán] ${item}`),
          ]);
        } else {
          setStoreReport(null);
          setStoreReportAlerts([]);
        }

        if (reportResult.status !== "fulfilled") {
          console.error(reportResult.reason);
        }
      } catch (e) {
        console.error(e);
        setInsightsError(
          "Không tải được tóm tắt chấm công. Thử làm mới trang.",
        );
        setInsights(null);
        setStoreReport(null);
        setStoreReportAlerts([]);
      } finally {
        setInsightsLoading(false);
      }
    };
    load();
  }, [selectedStoreId]);

  const name = user?.fullName || user?.username || "bạn";
  const s = insights?.summaryToday;
  const dashboardAlerts = [...(insights?.alerts || []), ...storeReportAlerts];
  const moreAlerts = dashboardAlerts.length > MAX_ALERTS_PREVIEW;
  const moreActions =
    insights && insights.actionQueue.length > MAX_ACTION_PREVIEW;
  const reportSummary = storeReport?.summary;

  return (
    <DashboardShell>
      <DashboardHero
        badge={<RoleBadge>Quản lý cửa hàng</RoleBadge>}
        title={`Xin chào, ${name}`}
        subtitle="Tổng quan nhanh — xem số liệu hôm nay, cảnh báo quan trọng và chuyển tới từng module khi cần chi tiết."
        footer={
          insightsLoading ? (
            <span style={{ fontSize: "0.875rem", opacity: 0.9 }}>
              Đang tải số liệu hôm nay…
            </span>
          ) : !selectedStoreId ? (
            <span style={{ fontSize: "0.875rem", opacity: 0.9 }}>
              Chưa gán cửa hàng cho tài khoản — liên hệ quản trị.
            </span>
          ) : insightsError ? (
            <span style={{ fontSize: "0.875rem", opacity: 0.95 }}>
              {insightsError}
            </span>
          ) : s ? (
            <StatStrip
              items={[
                {
                  label: "Có lịch hôm nay",
                  value: s.scheduledShifts,
                  hint: formatDateVN(getTodayVN()),
                },
                { label: "Đã check-in", value: s.checkedIn },
                { label: "Đi trễ / vi phạm giờ", value: s.late },
                { label: "Vắng mặt", value: s.absent },
                { label: "Trong ca, chưa check-in", value: s.awaitingCheckIn },
                { label: "Hết ca, chưa check-out", value: s.overdueCheckout },
              ]}
            />
          ) : null
        }
      />

      <DashboardSection
        title="KPI quán hôm nay"
        description="Rút gọn từ báo cáo quán để nhìn nhanh sức bán và áp lực vận hành ngay trên dashboard."
        emphasized
      >
        {!selectedStoreId || insightsLoading ? (
          <div
            style={{
              borderRadius: dash.radiusLg,
              border: `1px solid ${dash.border}`,
              background: dash.surface,
              padding: "18px 20px",
              color: dash.muted,
              fontSize: "0.9rem",
            }}
          >
            Đang tải KPI doanh thu và vận hành...
          </div>
        ) : !reportSummary ? (
          <div
            style={{
              borderRadius: dash.radiusLg,
              border: `1px solid ${dash.border}`,
              background: dash.surface,
              padding: "18px 20px",
              color: dash.muted,
              fontSize: "0.9rem",
            }}
          >
            Chưa lấy được dữ liệu báo cáo quán hôm nay. Bạn vẫn có thể mở{" "}
            <Link
              to="/store/manager/store-report"
              style={{ color: dash.primary, fontWeight: 700 }}
            >
              báo cáo quán
            </Link>{" "}
            để kiểm tra chi tiết.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            }}
          >
            <StoreReportKpiCard
              label="Doanh thu ghi nhận"
              value={formatMoney(reportSummary.netSales)}
              hint={`Gross sales ${formatMoney(reportSummary.grossSales)}.`}
              tone="revenue"
            />
            <StoreReportKpiCard
              label="Đơn bán thường"
              value={String(reportSummary.recognizedOrders)}
              hint={`AOV ${formatMoney(reportSummary.averageOrderValue)}.`}
              tone="positive"
            />
            <StoreReportKpiCard
              label="Đơn chậm trên 15 phút"
              value={String(reportSummary.preparingOver15m)}
              hint={`Trên 30 phút: ${reportSummary.preparingOver30m} đơn.`}
              tone={reportSummary.preparingOver15m > 0 ? "warning" : "positive"}
            />
            <StoreReportKpiCard
              label="TG hoàn tất trung bình"
              value={formatMinutes(reportSummary.avgCompletedMinutes)}
              hint={`Tỷ lệ hoàn tất ${formatPercent(reportSummary.completionRatePct)}.`}
            />
            <StoreReportKpiCard
              label="Tỷ lệ đơn member"
              value={formatPercent(reportSummary.memberOrderSharePct)}
              hint={`${reportSummary.memberOrders} đơn member trong ngày.`}
            />
            <StoreReportKpiCard
              label="Đơn đặc biệt"
              value={String(reportSummary.specialOrders)}
              hint={`Giá trị phi doanh thu ${formatMoney(reportSummary.specialValue)}.`}
              tone={reportSummary.specialOrders > 0 ? "warning" : "neutral"}
            />
          </div>
        )}
      </DashboardSection>

      <div
        style={{
          background: dash.surface,
          borderRadius: dash.radiusLg,
          border: `1px solid ${dash.border}`,
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
          marginBottom: 24,
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: dash.primaryDark,
                }}
              >
                Cần chú ý hôm nay
              </div>
            </div>
            {user?.stores && user.stores.length > 1 && (
              <div style={{ minWidth: "160px" }}>
                <select
                  value={selectedStoreId || ""}
                  onChange={(e) => setSelectedStoreId(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: `1px solid ${dash.border}`,
                    background: "#fff",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: dash.primaryDark,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {user.stores.map((st: any) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link
              to="/store/manager/attendance-insights"
              style={{
                fontSize: "0.82rem",
                fontWeight: 700,
                color: "#fff",
                textDecoration: "none",
                padding: "10px 14px",
                borderRadius: 10,
                background: dash.primary,
                border: `1px solid ${dash.primaryDark}`,
              }}
            >
              Phân tích chi tiết
            </Link>
          </div>
        </div>

        {!selectedStoreId || insightsLoading ? (
          <p style={{ margin: 0, fontSize: "0.875rem", color: dash.muted }}>
            Đang tải…
          </p>
        ) : insightsError ? (
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#c53030" }}>
            {insightsError}
          </p>
        ) : !insights ? (
          <p style={{ margin: 0, fontSize: "0.875rem", color: dash.muted }}>
            Chưa có dữ liệu.
          </p>
        ) : (
          <>
            {dashboardAlerts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: dash.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Cảnh báo
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    color: "#1e293b",
                    fontSize: "0.875rem",
                    lineHeight: 1.55,
                  }}
                >
                  {dashboardAlerts.slice(0, MAX_ALERTS_PREVIEW).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
                {moreAlerts ? (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "0.8rem",
                      color: dash.muted,
                    }}
                  >
                    +{dashboardAlerts.length - MAX_ALERTS_PREVIEW} cảnh báo khác
                    —{" "}
                    <Link
                      to="/store/manager/store-report"
                      style={{ color: dash.primary, fontWeight: 700 }}
                    >
                      xem đầy đủ
                    </Link>
                  </p>
                ) : null}
              </div>
            )}

            {insights.actionQueue.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: dash.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 10,
                  }}
                >
                  Ưu tiên xử lý
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: 10,
                  }}
                >
                  {insights.actionQueue
                    .slice(0, MAX_ACTION_PREVIEW)
                    .map((a, idx) => {
                      const accent = actionTypeAccent(a.type);
                      return (
                        <div
                          key={`${a.type}-${a.userId}-${idx}`}
                          style={{
                            borderLeft: `4px solid ${accent.border}`,
                            background: accent.bg,
                            borderRadius: 10,
                            padding: "10px 12px",
                            border: `1px solid ${dash.border}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: accent.border,
                            }}
                          >
                            {a.priorityLabel}
                          </div>
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: "0.85rem",
                              color: "#0f172a",
                              marginTop: 4,
                            }}
                          >
                            {a.headline}
                          </div>
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "#4a5568",
                              marginTop: 4,
                              lineHeight: 1.45,
                            }}
                          >
                            {a.detail}
                          </div>
                        </div>
                      );
                    })}
                </div>
                {moreActions ? (
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: "0.8rem",
                      color: dash.muted,
                    }}
                  >
                    +{insights.actionQueue.length - MAX_ACTION_PREVIEW} mục khác
                    trong hàng đợi —{" "}
                    <Link
                      to="/store/manager/attendance-insights"
                      style={{ color: dash.primary, fontWeight: 700 }}
                    >
                      mở phân tích chi tiết
                    </Link>
                  </p>
                ) : null}
              </div>
            )}

            {dashboardAlerts.length === 0 &&
              insights.actionQueue.length === 0 && (
                <p
                  style={{ margin: 0, fontSize: "0.875rem", color: dash.muted }}
                >
                  Không có cảnh báo nổi bật trong dữ liệu hiện tại. Vẫn có thể
                  xem báo cáo kỳ tại phân tích chi tiết.
                </p>
              )}

            {(insights.absentDetails.length > 0 ||
              insights.lateLeaders.length > 0 ||
              insights.hotDays.length > 0) && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: `1px solid ${dash.border}`,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                  fontSize: "0.82rem",
                  color: "#475569",
                }}
              >
                {insights.absentDetails.length > 0 && (
                  <span>
                    <strong>{insights.absentDetails.length}</strong> ca vắng
                    (trong kỳ báo cáo)
                  </span>
                )}
                {insights.lateLeaders.length > 0 && (
                  <span>
                    <strong>{insights.lateLeaders.length}</strong> nhân viên đi
                    trễ lặp lại
                  </span>
                )}
                {insights.hotDays.length > 0 && (
                  <span>
                    <strong>{insights.hotDays.length}</strong> ngày “nóng” về sự
                    cố
                  </span>
                )}
              </div>
            )}
          </>
        )}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${dash.border}`,
            fontSize: "0.78rem",
            color: dash.muted,
            lineHeight: 1.5,
          }}
        >
          Chỉ hiển thị phần rút gọn. Xem bảng đầy đủ tại{" "}
          <Link
            to="/store/manager/help"
            style={{ color: dash.primary, fontWeight: 700, textDecoration: "none" }}
          >
            Hỗ trợ
          </Link>
          .
        </div>
      </div>

      <DashboardSection
        title="Vận hành cửa hàng"
        description="Lịch, chấm công, đối soát, phân tích và kiểm kê."
        emphasized
      >
        <FeatureGrid>
          {OPERATIONS.map((item) => (
            <FeatureCard
              key={item.to}
              to={item.to}
              title={item.title}
              description={item.description}
              icon={item.icon}
              featured={item.featured}
            />
          ))}
        </FeatureGrid>
      </DashboardSection>

      <DashboardSection
        title="Nhân sự & hồ sơ"
        description="Danh sách nhân viên, đơn chỉnh hồ sơ và payroll."
      >
        <FeatureGrid>
          {HR_LINKS.map((item) => (
            <FeatureCard
              key={item.to}
              to={item.to}
              title={item.title}
              description={item.description}
              icon={item.icon}
              featured={item.featured}
            />
          ))}
        </FeatureGrid>
      </DashboardSection>
    </DashboardShell>
  );
}


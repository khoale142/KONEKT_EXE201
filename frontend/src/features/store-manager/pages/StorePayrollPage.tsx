import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../../../app/store/auth.store";
import { payrollApi } from "../../staff/api/payroll.api";
import { dash } from "../../shared/dashboard/dashboardUi";
import { employmentTypeLabelVi, isFullTimeEmployment } from "../../shared/utils/employmentShiftTypes";
import { asFiniteNumber } from "../../shared/utils/safeNumber";
import { PageHeader } from "../../shared/components/PageHeader";

const FULL_TIME_NET_MONTHLY_SALARY = 9_000_000;

type StorePayrollRow = {
  user_id: number;
  employment_type: string;
  total_shifts: number;
  total_hours: number;
  gross_salary: number;
  scheduled_shifts?: number;
  scheduled_hours?: number;
  full_schedule_gross_salary?: number;
  _user?: {
    full_name?: string;
    role_name?: string;
  };
};

type StorePayrollSummary = {
  store_id: number;
  store_name: string | null;
  revenue: number;
  current_month_revenue: number;
  revenue_source_month?: number;
  revenue_source_year?: number;
  pt_payroll_pct: number;
  pt_fund_target: number;
  pt_projected_gross: number;
  pt_projected_full_schedule_gross: number;
  pt_remaining_budget: number;
  pt_remaining_budget_if_full_schedule: number;
};

export default function StorePayrollPage() {
  const user = useAuthStore((s) => s.user);
  const storeId = user?.storeId;

  const d = new Date();
  const [month, setMonth] = useState<number>(d.getMonth() + 1);
  const [year, setYear] = useState<number>(d.getFullYear());
  const [payrolls, setPayrolls] = useState<StorePayrollRow[]>([]);
  const [summary, setSummary] = useState<StorePayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchPayrolls = async (m: number, y: number) => {
    if (!storeId) return;
    setLoading(true);
    setError("");
    try {
      const res = await payrollApi.getStorePayrolls(storeId, m, y);
      const rows = Array.isArray(res.data?.rows) ? res.data.rows : [];
      setPayrolls(rows);
      setSummary(res.data?.summary ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể tải dữ liệu quỹ lương của cửa hàng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPayrolls(month, year);
  }, [storeId, month, year]);

  const fmt = (n: unknown) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(asFiniteNumber(n));

  const revenueReference = useMemo(() => {
    const sourceMonth = Number(summary?.revenue_source_month);
    const sourceYear = Number(summary?.revenue_source_year);
    if (Number.isFinite(sourceMonth) && sourceMonth >= 1 && sourceMonth <= 12 && Number.isFinite(sourceYear)) {
      return { month: sourceMonth, year: sourceYear };
    }
    return month === 1
      ? { month: 12, year: year - 1 }
      : { month: month - 1, year };
  }, [month, year, summary?.revenue_source_month, summary?.revenue_source_year]);

  const projectedStatus = useMemo(() => {
    const remaining = asFiniteNumber(summary?.pt_remaining_budget_if_full_schedule);
    if (remaining >= 0) return { label: "Trong quỹ", color: "#22543d", bg: "#c6f6d5" };
    return { label: "Vượt quỹ", color: "#9b2c2c", bg: "#fed7d7" };
  }, [summary]);

  return (
    <div style={{ padding: "24px 32px", display: "grid", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <PageHeader
          backTo="/store/manager"
          backLabel="Trang quản lý"
          title="Quỹ lương cửa hàng"
          subtitle="Store Manager theo dõi quỹ lương part-time của tháng đang xem. Bảng này chỉ hiển thị nhân sự vận hành tại cửa hàng; tài khoản office và máy POS không được tính là nhân viên."
          style={{ marginBottom: 0, flex: "1 1 560px" }}
        />

        <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 4 }}>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={selectStyle}>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={selectStyle}>
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div style={errorBox}>{error}</div>}

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <SummaryCard
            label={`Doanh thu tháng ${month}/${year}`}
            value={fmt(summary.current_month_revenue)}
            tone="blue"
          />
          <SummaryCard
            label={`Quỹ PT mục tiêu (${summary.pt_payroll_pct}% từ tháng trước)`}
            value={fmt(summary.pt_fund_target)}
            tone="yellow"
          />
          <SummaryCard label="Lương PT đã ghi nhận" value={fmt(summary.pt_projected_gross)} tone="green" />
          <SummaryCard label="Lương PT nếu đủ ca đã xếp" value={fmt(summary.pt_projected_full_schedule_gross)} tone="purple" />
        </div>
      )}

      {summary && (
        <div style={{ background: dash.surface, borderRadius: 18, padding: 18, boxShadow: dash.shadow, border: `1px solid ${dash.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: dash.muted, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.6 }}>Cân đối theo lịch</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: projectedStatus.color, marginTop: 6 }}>
                {fmt(summary.pt_remaining_budget_if_full_schedule)}
              </div>
              <div style={{ fontSize: 13, color: dash.muted, marginTop: 6 }}>
                So sánh quỹ PT mục tiêu lấy từ doanh thu tháng {revenueReference.month}/{revenueReference.year} với tổng lương PT nếu nhân viên đi đủ toàn bộ ca đã xếp trong tháng {month}/{year}. Doanh thu tháng {month}/{year} hiện tại: {fmt(summary.current_month_revenue)}.
              </div>
            </div>
            <span style={{ padding: "8px 14px", borderRadius: 999, background: projectedStatus.bg, color: projectedStatus.color, fontWeight: 800 }}>
              {projectedStatus.label}
            </span>
          </div>
        </div>
      )}

      <div style={{ background: dash.surface, borderRadius: 18, boxShadow: dash.shadow, border: `1px solid ${dash.border}`, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 36, textAlign: "center", color: dash.muted }}>Đang tải dữ liệu...</div>
        ) : payrolls.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: dash.muted }}>Không có nhân sự cho kỳ {month}/{year}.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: dash.pageBg, borderBottom: `1px solid ${dash.border}` }}>
                <th style={th}>Nhân viên</th>
                <th style={th}>Loại HĐ</th>
                <th style={{ ...th, textAlign: "right" }}>Đã làm</th>
                <th style={{ ...th, textAlign: "right" }}>Đã xếp</th>
                <th style={{ ...th, textAlign: "right" }}>Lương đã ghi nhận</th>
                <th style={{ ...th, textAlign: "right" }}>Lương nếu đủ ca</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p, idx) => {
                const isFt = isFullTimeEmployment(p.employment_type);
                return (
                  <tr key={p.user_id} style={{ borderBottom: idx === payrolls.length - 1 ? "none" : `1px solid ${dash.border}` }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{p._user?.full_name || `Nhân sự #${p.user_id}`}</div>
                      <div style={{ fontSize: 12, color: dash.muted }}>{p._user?.role_name || "staff"}</div>
                    </td>
                    <td style={td}>{employmentTypeLabelVi(p.employment_type)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div>{p.total_shifts} ca</div>
                      <div style={{ fontSize: 12, color: dash.muted }}>{asFiniteNumber(p.total_hours).toFixed(1)} giờ</div>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div>{asFiniteNumber(p.scheduled_shifts).toFixed(0)} ca</div>
                      <div style={{ fontSize: 12, color: dash.muted }}>{asFiniteNumber(p.scheduled_hours).toFixed(1)} giờ</div>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: isFt ? "#553c9a" : "#0f172a" }}>
                      {isFt ? `${fmt(FULL_TIME_NET_MONTHLY_SALARY)}/tháng` : fmt(p.gross_salary)}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: isFt ? "#553c9a" : dash.primary }}>
                      {isFt ? `${fmt(FULL_TIME_NET_MONTHLY_SALARY)}/tháng` : fmt(p.full_schedule_gross_salary)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 13, color: dash.muted, lineHeight: 1.6 }}>
        Quỹ đang bám theo logic head-officer: quỹ PT của tháng {month}/{year} = doanh thu tháng {revenueReference.month}/{revenueReference.year} x % quỹ PT của cửa hàng. Lương full-time chỉ để tham khảo vận hành, không dùng để Store Manager cân quỹ ca part-time. Các tài khoản office như DM, audit, marketing/sales và máy POS không nằm trong bảng lương nhân sự của cửa hàng.
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "blue" | "yellow" | "green" | "purple" }) {
  const tones = {
    blue: { bg: "#ebf8ff", color: "#1a365d" },
    yellow: { bg: "#fefcbf", color: "#744210" },
    green: { bg: "#c6f6d5", color: "#22543d" },
    purple: { bg: "#e9d8fd", color: "#553c9a" },
  } as const;
  const t = tones[tone];
  return (
    <div style={{ background: t.bg, color: t.color, borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{value}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${dash.border}`,
  background: "#fff",
  fontWeight: 600,
};

const th: React.CSSProperties = {
  padding: "14px 18px",
  textAlign: "left",
  color: dash.muted,
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const td: React.CSSProperties = {
  padding: "16px 18px",
  color: "#334155",
  verticalAlign: "top",
};

const errorBox: React.CSSProperties = {
  background: "#fff5f5",
  color: "#c53030",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #fed7d7",
};

import { useEffect, useMemo, useState } from "react";
import { payrollApi } from "../api/payroll.api";
import { employmentTypeLabelVi, isFullTimeEmployment } from "../../shared/utils/employmentShiftTypes";
import { asFiniteNumber } from "../../shared/utils/safeNumber";
import { dash } from "../../shared/dashboard/dashboardUi";
import { PageHeader } from "../../shared/components/PageHeader";

type PayrollData = {
  month: number;
  year: number;
  employment_type: string;
  total_shifts: number;
  total_hours: number;
  hourly_wage_snapshot: number;
  base_salary_snapshot?: number;
  gross_salary: number;
  total_deductions: number;
  net_salary: number;
  status: string;
  tax_rate_pct?: number;
  tax_amount?: number;
  uniform_deduction?: number;
  fuel_allowance?: number;
  scheduled_shifts?: number;
  scheduled_hours?: number;
  full_schedule_gross_salary?: number;
  full_schedule_net_salary?: number;
};

export default function PayrollPage() {
  const d = new Date();
  const [month, setMonth] = useState<number>(d.getMonth() + 1);
  const [year, setYear] = useState<number>(d.getFullYear());
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchPayroll = async (m: number, y: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await payrollApi.getMyPayroll(m, y);
      setPayroll(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể tải dữ liệu lương.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPayroll(month, year);
  }, [month, year]);

  const fmt = (n: unknown) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(asFiniteNumber(n));

  const statusTone = useMemo(() => {
    if (payroll?.status === "FINALIZED") return { bg: "#c6f6d5", color: "#22543d", label: "Đã chốt" };
    return { bg: "#fefcbf", color: "#744210", label: "Tạm tính" };
  }, [payroll?.status]);

  const isFullTime = payroll ? isFullTimeEmployment(payroll.employment_type) : false;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 960, margin: "0 auto", display: "grid", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <PageHeader
          backTo="/store/staff"
          backLabel="Trang nhân viên"
          title="Bảng lương nhân viên"
          subtitle="Part-time tính theo giờ. Full-time hưởng lương cứng 9.000.000 đ net/tháng và không quy đổi theo giờ."
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

      {loading && <div style={panelStyle}>Đang tải dữ liệu...</div>}
      {error && <div style={errorStyle}>{error}</div>}
      {!loading && !error && !payroll && <div style={panelStyle}>Không có dữ liệu lương cho kỳ này.</div>}

      {!loading && !error && payroll && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <InfoCard label="Loại hợp đồng" value={employmentTypeLabelVi(payroll.employment_type)} />
            <InfoCard label="Giờ đã làm" value={`${asFiniteNumber(payroll.total_hours).toFixed(1)} giờ`} />
            <InfoCard label="Giờ đã xếp" value={`${asFiniteNumber(payroll.scheduled_hours).toFixed(1)} giờ`} />
            <InfoCard
              label={isFullTime ? "Lương cứng" : "Đơn giá"}
              value={
                isFullTime
                  ? `${fmt(payroll.base_salary_snapshot)}/tháng`
                  : `${fmt(payroll.hourly_wage_snapshot)}/giờ`
              }
            />
            <div style={{ ...panelStyle, background: statusTone.bg, color: statusTone.color }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Trạng thái</div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{statusTone.label}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr", gap: 20 }}>
            <div style={panelStyle}>
              <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 18, color: "#0f172a" }}>
                {isFullTime ? "Lương cứng full-time" : "Bảng tính lương thực nhận"}
              </h3>
              {isFullTime ? (
                <div style={{ fontSize: 14, color: dash.muted, lineHeight: 1.7 }}>
                  <p style={{ marginTop: 0 }}>
                    Nhân viên full-time nhận lương cứng cố định theo tháng, không tính theo số giờ làm.
                  </p>
                  <BreakdownRow label="Lương cứng net / tháng" value={fmt(payroll.base_salary_snapshot)} strong />
                </div>
              ) : (
                <>
                  <BreakdownRow label="Lương theo giờ thực tế" value={fmt(payroll.gross_salary)} />
                  <BreakdownRow label="Trợ cấp xăng xe" value={`+ ${fmt(payroll.fuel_allowance)}`} positive />
                  <BreakdownRow label={`Thuế (${asFiniteNumber(payroll.tax_rate_pct).toFixed(0)}%)`} value={`- ${fmt(payroll.tax_amount)}`} negative />
                  <BreakdownRow label="Đồng phục" value={`- ${fmt(payroll.uniform_deduction)}`} negative />
                  <BreakdownRow label="Tổng khấu trừ" value={`- ${fmt(payroll.total_deductions)}`} negative strong />
                  <div style={{ height: 1, background: dash.border, margin: "14px 0" }} />
                </>
              )}
              <BreakdownRow label="Thực nhận" value={fmt(payroll.net_salary)} strong accent />
            </div>

            <div style={panelStyle}>
              <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: 18, color: "#0f172a" }}>
                {isFullTime ? "Thông tin tham chiếu" : "Nếu đi đủ tất cả ca đã xếp"}
              </h3>
              {isFullTime ? (
                <div style={{ fontSize: 14, color: dash.muted, lineHeight: 1.6 }}>
                  <p style={{ marginTop: 0 }}>Lương full-time không thay đổi theo số giờ hoặc số ca trong tháng.</p>
                  <p style={{ margin: "0 0 10px" }}>Số ca đã xếp: <strong style={{ color: "#0f172a" }}>{asFiniteNumber(payroll.scheduled_shifts).toFixed(0)} ca</strong></p>
                  <p style={{ margin: "0 0 10px" }}>Số giờ đã ghi nhận: <strong style={{ color: "#0f172a" }}>{asFiniteNumber(payroll.total_hours).toFixed(1)} giờ</strong></p>
                  <p style={{ margin: 0 }}>Mức lương net tháng này: <strong style={{ color: dash.primary }}>{fmt(payroll.full_schedule_net_salary)}</strong></p>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: dash.muted, lineHeight: 1.6 }}>
                  <p style={{ marginTop: 0 }}>Hệ thống tính sẵn mức lương tham khảo nếu bạn đi đủ toàn bộ ca đã được xếp trong tháng.</p>
                  <p style={{ margin: "0 0 10px" }}>Lương gross theo lịch: <strong style={{ color: "#0f172a" }}>{fmt(payroll.full_schedule_gross_salary)}</strong></p>
                  <p style={{ margin: "0 0 10px" }}>Số ca đã xếp: <strong style={{ color: "#0f172a" }}>{asFiniteNumber(payroll.scheduled_shifts).toFixed(0)} ca</strong></p>
                  <p style={{ margin: 0 }}>Thực nhận dự kiến nếu đi đủ: <strong style={{ color: dash.primary }}>{fmt(payroll.full_schedule_net_salary)}</strong></p>
                </div>
              )}
            </div>
          </div>

          <div style={{ ...panelStyle, background: "#f8fafc" }}>
            <div style={{ fontSize: 13, color: dash.muted, lineHeight: 1.7 }}>
              {isFullTime ? (
                <>
                  Chính sách đang áp dụng:
                  <br />- Full-time hưởng lương cứng 9.000.000 VND net mỗi tháng.
                  <br />- Không tính lương theo giờ và chưa tách gross/tax trong flow hiện tại.
                  <br />- Số giờ và số ca chỉ dùng để theo dõi chấm công.
                </>
              ) : (
                <>
                  Chính sách đang áp dụng:
                  <br />- Lương cơ bản tính theo 25.000 VND mỗi giờ làm đã ghi nhận.
                  <br />- Trợ cấp xăng xe cố định 100.000 VND mỗi tháng.
                  <br />- Thuế tạm tính: {asFiniteNumber(payroll.tax_rate_pct).toFixed(0)}% trên lương gross.
                  <br />- Đồng phục tạm trừ cố định 50.000 VND/tháng.
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 12, color: dash.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 8 }}>{value}</div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  positive,
  negative,
  strong,
  accent,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  strong?: boolean;
  accent?: boolean;
}) {
  const color = accent ? dash.primary : positive ? "#22543d" : negative ? "#c53030" : "#0f172a";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0" }}>
      <span style={{ color: dash.muted, fontWeight: strong ? 700 : 500 }}>{label}</span>
      <span style={{ color, fontWeight: strong ? 900 : 700 }}>{value}</span>
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

const panelStyle: React.CSSProperties = {
  background: dash.surface,
  borderRadius: 18,
  padding: 20,
  boxShadow: dash.shadow,
  border: `1px solid ${dash.border}`,
};

const errorStyle: React.CSSProperties = {
  background: "#fff5f5",
  color: "#c53030",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #fed7d7",
};

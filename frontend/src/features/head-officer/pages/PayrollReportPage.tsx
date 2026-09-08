import { useEffect, useState } from "react";
import {
  headOfficerApi,
  type PayrollRowV2,
  type StaffMember,
} from "../api/head-officer.api";
import {
  employmentTypeLabelVi,
  isFullTimeEmployment,
} from "../../shared/utils/employmentShiftTypes";

const FULL_TIME_NET_MONTHLY_SALARY = 9_000_000;

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(n);
}

function StaffSection({
  title,
  titleColor,
  headerBg,
  wageLabel,
  emptyLabel,
  staff,
  renderWage,
}: {
  title: string;
  titleColor: string;
  headerBg: string;
  wageLabel: string;
  emptyLabel: string;
  staff: StaffMember[];
  renderWage: (staff: StaffMember) => string;
}) {
  return (
    <div>
      <div style={{ fontWeight: 700, color: titleColor, marginBottom: 8 }}>{title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: headerBg }}>
            <th style={sth}>Họ tên</th>
            <th style={sth}>Chức vụ</th>
            <th style={sth}>Loại HĐ</th>
            <th style={sth}>{wageLabel}</th>
          </tr>
        </thead>
        <tbody>
          {staff.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ ...std, color: "#718096" }}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            staff.map((u) => {
              const isFt = isFullTimeEmployment(u.employment_type);
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid #f0f4f8" }}>
                  <td style={std}>{u.full_name}</td>
                  <td style={std}>{u.role_name}</td>
                  <td style={std}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: isFt ? "#e9d8fd" : "#c6f6d5",
                        color: isFt ? "#553c9a" : "#276749",
                      }}
                    >
                      {employmentTypeLabelVi(u.employment_type)}
                    </span>
                  </td>
                  <td style={{ ...std, fontWeight: 700 }}>{renderWage(u)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function StoreStaffPanel({
  storeId,
  storeName,
  onClose,
}: {
  storeId: number;
  storeName: string;
  onClose: () => void;
}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    headOfficerApi
      .getStoreStaff(storeId)
      .then(setStaff)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải nhân sự"))
      .finally(() => setLoading(false));
  }, [storeId]);

  const fullTimeStaff = staff.filter((u) => isFullTimeEmployment(u.employment_type));
  const partTimeStaff = staff.filter((u) => !isFullTimeEmployment(u.employment_type));

  return (
    <tr>
      <td colSpan={8} style={{ padding: 0, background: "#f7fafc", borderBottom: "2px solid #e2e8f0" }}>
        <div style={{ padding: "14px 20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span style={{ fontWeight: 700, color: "#2d3748", fontSize: 14 }}>
              Nhân sự - {storeName}
            </span>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#718096",
                fontSize: 18,
              }}
            >
              x
            </button>
          </div>

          {loading && <p style={{ color: "#718096", fontSize: 13 }}>Đang tải...</p>}
          {err && <p style={{ color: "red", fontSize: 13 }}>{err}</p>}

          {!loading && !err && (
            <div style={{ display: "grid", gap: 16 }}>
              <StaffSection
                title="Nhân sự full-time"
                titleColor="#553c9a"
                headerBg="#f3e8ff"
                wageLabel="Lương cứng / tháng"
                emptyLabel="Không có nhân sự full-time."
                staff={fullTimeStaff}
                renderWage={() => `${fmt(FULL_TIME_NET_MONTHLY_SALARY)} net`}
              />
              <StaffSection
                title="Nhân sự part-time"
                titleColor="#276749"
                headerBg="#edfdf4"
                wageLabel="Lương / giờ"
                emptyLabel="Không có nhân sự part-time."
                staff={partTimeStaff}
                renderWage={(u) => fmt(Number(u.hourly_wage))}
              />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function PayrollReportPage() {
  const [data, setData] = useState<PayrollRowV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandedStore, setExpandedStore] = useState<number | null>(null);
  const [editPct, setEditPct] = useState<Record<number, string>>({});
  const [savingPct, setSavingPct] = useState<Record<number, boolean>>({});
  const [pctMsg, setPctMsg] = useState<Record<number, string>>({});

  const dateFrom = `${month}-01`;
  const dateTo = (() => {
    const [y, mo] = month.split("-").map(Number);
    return `${month}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}`;
  })();

  useEffect(() => {
    setLoading(true);
    headOfficerApi
      .getPayrollReportV2({ dateFrom, dateTo })
      .then(setData)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }, [month]);

  async function savePct(storeId: number) {
    const raw = editPct[storeId];
    const val = parseFloat(raw);
    if (Number.isNaN(val) || val < 0 || val > 50) {
      setPctMsg((p) => ({ ...p, [storeId]: "Nhập 0-50" }));
      return;
    }
    setSavingPct((p) => ({ ...p, [storeId]: true }));
    try {
      await headOfficerApi.updatePtPayrollPct(storeId, val);
      setData((prev) =>
        prev.map((r) =>
          r.store_id === storeId
            ? {
                ...r,
                pt_payroll_pct: val,
                pt_fund_target: Math.round((Number(r.revenue) * val) / 100),
              }
            : r
        )
      );
      setEditPct((p) => {
        const next = { ...p };
        delete next[storeId];
        return next;
      });
      setPctMsg((p) => ({ ...p, [storeId]: "Đã lưu" }));
      setTimeout(() => {
        setPctMsg((p) => ({ ...p, [storeId]: "" }));
      }, 2000);
    } catch (e: any) {
      setPctMsg((p) => ({ ...p, [storeId]: e?.response?.data?.message || "Lỗi lưu" }));
    } finally {
      setSavingPct((p) => ({ ...p, [storeId]: false }));
    }
  }

  const totalPT = data.reduce((s, r) => s + Number(r.pt_payroll_actual), 0);
  const totalFT = data.reduce((s, r) => s + Number(r.ft_payroll_actual), 0);
  const totalTarget = data.reduce((s, r) => s + Number(r.pt_fund_target), 0);
  const totalRev = data.reduce((s, r) => s + Number(r.revenue), 0);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Quản lý Quỹ lương</h1>
      <p style={{ color: "#718096", marginBottom: 16 }}>
        Part-time theo quỹ lương/doanh thu. Full-time là lương cứng 9.000.000 đ net/tháng, tách riêng khỏi flow tính lương theo giờ.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <label style={{ fontWeight: 600, fontSize: 13 }}>Tháng:</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", fontSize: 14 }}
        />
      </div>

      {loading && <p style={{ color: "#718096" }}>Đang tải...</p>}
      {err && <p style={{ color: "#c53030" }}>{err}</p>}

      {!loading && !err && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))",
              gap: 12,
              marginBottom: 24,
            }}
          >
            {[
              { label: "Doanh thu chuỗi", value: fmt(totalRev), bg: "#ebf8ff", color: "#1a365d" },
              { label: "Quỹ PT (mục tiêu)", value: fmt(totalTarget), bg: "#fefcbf", color: "#744210" },
              { label: "Lương PT thực tế", value: fmt(totalPT), bg: "#c6f6d5", color: "#22543d" },
              { label: "Lương FT thực tế", value: fmt(totalFT), bg: "#e9d8fd", color: "#44337a" },
            ].map((card) => (
              <div key={card.label} style={{ padding: "14px 16px", borderRadius: 10, background: card.bg }}>
                <div style={{ fontSize: 12, color: card.color, marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
              <thead>
                <tr style={{ background: "#edf2f7", textAlign: "left" }}>
                  <th style={th}>Cơ sở</th>
                  <th style={th}>Doanh thu</th>
                  <th style={th}>% Quỹ PT</th>
                  <th style={th}>Quỹ PT (M.tiêu)</th>
                  <th style={th}>Lương PT (T.tế)</th>
                  <th style={th}>Lương FT (T.tế)</th>
                  <th style={th}>PT / FT</th>
                  <th style={th}></th>
                </tr>
              </thead>
              {data.map((r) => {
                const isExpanded = expandedStore === r.store_id;
                const ptOver =
                  Number(r.pt_payroll_actual) > Number(r.pt_fund_target) &&
                  Number(r.pt_fund_target) > 0;
                const isEditPct = r.store_id in editPct;

                return (
                  <tbody key={r.store_id}>
                    <tr
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid #f0f4f8",
                        background: isExpanded ? "#ebf8ff" : ptOver ? "#fff5f5" : "white",
                      }}
                    >
                      <td style={td}>
                        <strong>{r.store_name}</strong>
                      </td>
                      <td style={td}>{fmt(Number(r.revenue))}</td>
                      <td style={td}>
                        {isEditPct ? (
                          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input
                              type="number"
                              min={0}
                              max={50}
                              step={0.5}
                              value={editPct[r.store_id]}
                              onChange={(e) =>
                                setEditPct((p) => ({ ...p, [r.store_id]: e.target.value }))
                              }
                              style={{
                                width: 60,
                                padding: "3px 6px",
                                border: "1px solid #4299e1",
                                borderRadius: 6,
                                fontSize: 13,
                              }}
                            />
                            %
                            <button
                              onClick={() => savePct(r.store_id)}
                              disabled={savingPct[r.store_id]}
                              style={btnGreen}
                            >
                              {savingPct[r.store_id] ? "..." : "Lưu"}
                            </button>
                            <button
                              onClick={() =>
                                setEditPct((p) => {
                                  const next = { ...p };
                                  delete next[r.store_id];
                                  return next;
                                })
                              }
                              style={btnGray}
                            >
                              Hủy
                            </button>
                          </span>
                        ) : (
                          <span
                            onClick={() =>
                              setEditPct((p) => ({
                                ...p,
                                [r.store_id]: String(r.pt_payroll_pct ?? 10),
                              }))
                            }
                            style={{
                              cursor: "pointer",
                              color: "#2b6cb0",
                              fontWeight: 700,
                              textDecoration: "underline dotted",
                            }}
                            title="Bấm để chỉnh %"
                          >
                            {r.pt_payroll_pct ?? 10}%
                          </span>
                        )}
                        {pctMsg[r.store_id] && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: "#38a169" }}>
                            {pctMsg[r.store_id]}
                          </span>
                        )}
                      </td>
                      <td style={td}>{fmt(Number(r.pt_fund_target))}</td>
                      <td style={td}>
                        <span style={{ fontWeight: 600 }}>{fmt(Number(r.pt_payroll_actual))}</span>
                        {ptOver && (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: "1px 6px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: "#fed7d7",
                              color: "#c53030",
                            }}
                          >
                            Vượt ngưỡng
                          </span>
                        )}
                      </td>
                      <td style={td}>{fmt(Number(r.ft_payroll_actual))}</td>
                      <td style={td}>
                        <span style={{ fontSize: 12, color: "#38a169" }}>{r.pt_count} PT</span>
                        {" / "}
                        <span style={{ fontSize: 12, color: "#553c9a" }}>{r.ft_count} FT</span>
                      </td>
                      <td style={td}>
                        <button
                          onClick={() =>
                            setExpandedStore((prev) => (prev === r.store_id ? null : r.store_id))
                          }
                          style={isExpanded ? btnBlueActive : btnBlue}
                        >
                          {isExpanded ? "Thu gọn" : "Nhân sự"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <StoreStaffPanel
                        storeId={r.store_id}
                        storeName={r.store_name}
                        onClose={() => setExpandedStore(null)}
                      />
                    )}
                  </tbody>
                );
              })}
            </table>
          </div>

          <p style={{ marginTop: 10, fontSize: 12, color: "#a0aec0" }}>
            * Quỹ PT = % đã thiết lập x doanh thu thực tế tháng. Full-time tính lương cứng 9.000.000 đ net/tháng cho mỗi nhân sự đang active tại cửa hàng.
          </p>
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "11px 14px",
  fontSize: 13,
  fontWeight: 700,
  color: "#4a5568",
};

const td: React.CSSProperties = {
  padding: "11px 14px",
  fontSize: 13,
};

const sth: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#4a5568",
  textAlign: "left",
};

const std: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 13,
};

const btnBlue: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid #bee3f8",
  background: "#ebf8ff",
  color: "#2b6cb0",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const btnBlueActive: React.CSSProperties = {
  ...btnBlue,
  background: "#bee3f8",
  borderColor: "#90cdf4",
};

const btnGreen: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 6,
  border: "none",
  background: "#38a169",
  color: "white",
  fontSize: 12,
  cursor: "pointer",
};

const btnGray: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  background: "white",
  color: "#718096",
  fontSize: 12,
  cursor: "pointer",
};


import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchHrEmployeeDirectory } from "../api/hrEmployeeDirectory.api";
import type { HrEmployeeRow } from "../types/hr.types";
import HrPageHeader from "../components/HrPageHeader";
import { employmentTypeLabelVi } from "../../../shared/utils/employmentShiftTypes";

const border = "1px solid #e2e8f0";

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  store_manager: { bg: "#bee3f8", color: "#2a4365" },
  shift_leader: { bg: "#e9d8fd", color: "#553c9a" },
  staff: { bg: "#c6f6d5", color: "#276749" },
};

const EMPLOYMENT_BADGE: Record<string, { bg: string; color: string }> = {
  full_time: { bg: "#c6f6d5", color: "#276749" },
  part_time: { bg: "#fefcbf", color: "#975a16" },
};

export default function HREmployeesPage() {
  const [rows, setRows] = useState<HrEmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [storeFilter, setStoreFilter] = useState<number | "all">("all");
  const [roleFilter, setRoleFilter] = useState("");
  const [empTypeFilter, setEmpTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetchHrEmployeeDirectory()
      .then(setRows)
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        setError(msg || "Không tải được danh sách");
      })
      .finally(() => setLoading(false));
  }, []);

  const storeOptions = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => m.set(Number(r.storeId), r.storeName));
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, "vi"),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (storeFilter !== "all" && Number(r.storeId) !== storeFilter) return false;
      if (roleFilter && !r.roleName.toLowerCase().includes(roleFilter.toLowerCase())) return false;
      if (empTypeFilter !== "all" && r.employmentType !== empTypeFilter) return false;
      if (!qq) return true;
      const blob = `${r.fullName} ${r.userId} ${r.roleName}`.toLowerCase();
      return blob.includes(qq);
    });
  }, [rows, q, storeFilter, roleFilter, empTypeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const ptCount = rows.filter((r) => r.employmentType === "part_time").length;
    const ftCount = rows.filter((r) => r.employmentType === "full_time").length;
    const partTimeRows = rows.filter((r) => r.employmentType === "part_time");
    const avgHourlyWage = partTimeRows.length > 0
      ? Math.round(partTimeRows.reduce((sum, r) => sum + Number(r.hourlyWage), 0) / partTimeRows.length)
      : 0;
    const roleMap = new Map<string, number>();
    rows.forEach((r) => {
      roleMap.set(r.roleName, (roleMap.get(r.roleName) || 0) + 1);
    });
    return {
      total: rows.length,
      ptCount,
      ftCount,
      avgHourlyWage,
      roleMap,
      storeCount: storeOptions.length,
    };
  }, [rows, storeOptions]);

  return (
    <div>
      <HrPageHeader
        title="Nhân sự (HR)"
        description="Danh sách nhân viên toàn chuỗi. Lọc theo cửa hàng, vai trò, loại hình hoặc tìm theo tên."
      />

      {error ? <p style={{ color: "#c53030" }}>{error}</p> : null}

      {/* Statistics Bar */}
      {!loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {[
            { label: "Tổng nhân viên", value: stats.total, color: "#2d3748" },
            { label: "Full-time", value: stats.ftCount, color: "#276749" },
            { label: "Part-time", value: stats.ptCount, color: "#975a16" },
            { label: "Cửa hàng", value: stats.storeCount, color: "#2b6cb0" },
            { label: "Lương giờ TB (PT)", value: formatCurrencyVnd(stats.avgHourlyWage), color: "#553c9a" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                border: border,
                borderRadius: 12,
                padding: "14px 16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: 11, color: "#718096", fontWeight: 600, textTransform: "uppercase" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 2 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
          padding: 16,
          background: "#fff",
          border: border,
          borderRadius: 10,
        }}
      >
        <input
          placeholder="Tìm theo tên / ID / vai trò…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: border, minWidth: 240, flex: 1 }}
        />
        <select
          value={storeFilter === "all" ? "all" : String(storeFilter)}
          onChange={(e) =>
            setStoreFilter(e.target.value === "all" ? "all" : Number(e.target.value))
          }
          style={{ padding: "8px 12px", borderRadius: 8, border: border }}
        >
          <option value="all">Mọi cửa hàng</option>
          {storeOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={empTypeFilter}
          onChange={(e) => setEmpTypeFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: border }}
        >
          <option value="all">Mọi loại</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
        </select>
        <input
          placeholder="Lọc vai trò…"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: border, width: 160 }}
        />
        <div style={{ fontSize: 13, color: "#718096", alignSelf: "center", fontWeight: 600 }}>
          {filtered.length} / {rows.length} kết quả
        </div>
      </div>

      {loading ? <p>Đang tải…</p> : null}

      {/* Table */}
      <div style={{ background: "#fff", border: border, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f7fafc", textAlign: "left" }}>
              <th style={{ padding: 12, fontWeight: 700 }}>Họ tên</th>
              <th style={{ padding: 12, fontWeight: 700 }}>Cửa hàng</th>
              <th style={{ padding: 12, fontWeight: 700 }}>Vai trò</th>
              <th style={{ padding: 12, fontWeight: 700 }}>Loại</th>
              <th style={{ padding: 12, fontWeight: 700, textAlign: "right" }}>Lương</th>
              <th style={{ padding: 12 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const roleBadge = ROLE_BADGE[r.roleName] || { bg: "#edf2f7", color: "#4a5568" };
              const empBadge = EMPLOYMENT_BADGE[r.employmentType] || { bg: "#edf2f7", color: "#4a5568" };
              return (
                <tr
                  key={`${r.storeId}-${r.userId}`}
                  style={{ borderTop: border, transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f7fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{r.fullName}</div>
                    <div style={{ fontSize: 11, color: "#a0aec0" }}>ID: {r.userId}</div>
                  </td>
                  <td style={{ padding: 12 }}>{r.storeName}</td>
                  <td style={{ padding: 12 }}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        background: roleBadge.bg,
                        color: roleBadge.color,
                      }}
                    >
                      {r.roleName}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        background: empBadge.bg,
                        color: empBadge.color,
                      }}
                    >
                      {employmentTypeLabelVi(r.employmentType)}
                    </span>
                  </td>
                  <td style={{ padding: 12, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {formatCompensation(r)}
                  </td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    <Link
                      to={`/office/hr/employees/${r.userId}?storeId=${r.storeId}`}
                      style={{
                        color: "#3182ce",
                        fontWeight: 600,
                        fontSize: 13,
                        textDecoration: "none",
                      }}
                    >
                      Chi tiết →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 ? (
          <p style={{ padding: 24, color: "#718096", textAlign: "center" }}>
            Không có nhân viên nào khớp bộ lọc.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatCurrencyVnd(value: number | null | undefined): string {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${safeValue.toLocaleString("vi-VN")} \u0111`;
}

function formatCompensation(row: HrEmployeeRow): string {
  if (row.employmentType === "full_time") {
    return "Theo lương tháng";
  }

  return `${formatCurrencyVnd(row.hourlyWage)} / giờ`;
}




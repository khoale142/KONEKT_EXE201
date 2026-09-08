import { useEffect, useState } from "react";
import {
  headOfficerApi,
  type WasteRow,
  type WasteReportDetail,
} from "../api/head-officer.api";

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

import { formatDateTime } from "../../../utils/dateUtils";

function fmtDate(s: string) {
  if (!s) return "—";
  return formatDateTime(s);
}

// ─── Waste report detail panel (drill-down) ───────────────────────────────────
// Chỉ xem lịch sử báo cáo hủy hàng do nhân viên quán tạo — không tạo mới từ portal OFFICE
function WasteDetailPanel({
  storeId,
  storeName,
  onClose,
}: {
  storeId: number;
  storeName: string;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<WasteReportDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  function load() {
    setLoading(true);
    headOfficerApi
      .getWasteDetail(storeId)
      .then(setReports)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [storeId]);

  return (
    <tr>
      <td
        colSpan={5}
        style={{ padding: 0, background: "#fffff0", borderBottom: "2px solid #e2e8f0" }}
      >
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <span style={{ fontWeight: 700, color: "#2d3748", fontSize: 14 }}>
              Lịch sử báo cáo hủy hàng — {storeName}
            </span>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#718096",
                fontSize: 18,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>

          {loading && <p style={{ color: "#718096", fontSize: 13 }}>Đang tải...</p>}
          {err && <p style={{ color: "red", fontSize: 13 }}>{err}</p>}
          {!loading && !err && reports.length === 0 && (
            <p style={{ color: "#a0aec0", fontSize: 13 }}>
              Chưa có báo cáo hủy hàng nào cho cơ sở này
            </p>
          )}
          {!loading && !err && reports.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {reports.map((rep) => {
                const isOpen = expandedReport === rep.id;
                return (
                  <div
                    key={rep.id}
                    style={{
                      background: "white",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        cursor: "pointer",
                        background: isOpen ? "#fffbeb" : "white",
                      }}
                      onClick={() => setExpandedReport(isOpen ? null : rep.id)}
                    >
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "#2d3748", fontSize: 13 }}>
                          #{rep.id} · {fmtDate(rep.created_at)}
                        </span>
                        <span style={{ fontSize: 12, color: "#718096" }}>
                          Người báo cáo: {rep.reported_by}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            background: "#fff5f5",
                            color: "#c53030",
                            borderRadius: 99,
                            padding: "2px 8px",
                            fontWeight: 600,
                          }}
                        >
                          {rep.item_count} nguyên liệu · {fmt(Number(rep.total_cost))}
                        </span>
                      </div>
                      <span style={{ color: "#a0aec0", fontSize: 14 }}>{isOpen ? "▲" : "▼"}</span>
                    </div>

                    {isOpen && (
                      <div style={{ padding: "0 14px 12px" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 12,
                          }}
                        >
                          <thead>
                            <tr style={{ background: "#f7fafc" }}>
                              <th style={sth}>Nguyên liệu</th>
                              <th style={sth}>Đơn vị</th>
                              <th style={sth}>Số lượng hủy</th>
                              <th style={sth}>Đơn giá</th>
                              <th style={sth}>Chi phí</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rep.items.map((it, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #f0f4f8" }}>
                                <td style={std}>{it.ingredient_name}</td>
                                <td style={std}>{it.storage_unit}</td>
                                <td style={std}>{it.quantity}</td>
                                <td style={std}>{fmt(Number(it.cost_per_unit))}</td>
                                <td style={{ ...std, color: "#c53030", fontWeight: 600 }}>
                                  {fmt(Number(it.item_cost))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
// Portal OFFICE chỉ xem báo cáo hủy hàng do nhân viên quán tạo
export default function WasteReportPage() {
  const [data, setData] = useState<WasteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [expandedStore, setExpandedStore] = useState<number | null>(null);

  function loadData() {
    setLoading(true);
    headOfficerApi
      .getWasteReport()
      .then(setData)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  const totalWaste = data.reduce((s, r) => s + Number(r.waste_cost), 0);
  const avgRate =
    data.length > 0
      ? data.reduce((s, r) => s + Number(r.waste_rate_pct), 0) / data.length
      : 0;

  function toggleStore(storeId: number) {
    setExpandedStore((prev) => (prev === storeId ? null : storeId));
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Báo cáo Hủy hàng</h1>
      <p style={{ color: "#718096", marginBottom: 20 }}>
        Tổng hợp hủy hàng & tỉ lệ hàng hủy — bấm vào cơ sở để xem lịch sử hủy hàng
      </p>

      {loading && <p>Đang tải...</p>}
      {err && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ padding: 16, borderRadius: 10, background: "#fefcbf", flex: "1 1 200px" }}>
              <div style={{ fontSize: 13, color: "#975a16" }}>Tổng chi phí hủy</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#744210" }}>{fmt(totalWaste)}</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: "#fed7d7", flex: "1 1 200px" }}>
              <div style={{ fontSize: 13, color: "#9b2c2c" }}>Tỉ lệ hủy TB</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#742a2a" }}>{avgRate.toFixed(2)}%</div>
            </div>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ background: "#edf2f7", textAlign: "left" }}>
                <th style={th}>Quán</th>
                <th style={th}>Số lượng hủy</th>
                <th style={th}>Chi phí hủy</th>
                <th style={th}>Tỉ lệ hủy (%)</th>
                <th style={th}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const isExpanded = expandedStore === r.store_id;
                return (
                  <>
                    <tr
                      key={r.store_id}
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid #edf2f7",
                        background: isExpanded ? "#fffbeb" : "white",
                      }}
                    >
                      <td style={td}>{r.store_name}</td>
                      <td style={td}>{r.waste_count}</td>
                      <td style={{ ...td, color: "#c53030" }}>{fmt(Number(r.waste_cost))}</td>
                      <td style={td}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            background: Number(r.waste_rate_pct) > 3 ? "#fed7d7" : "#c6f6d5",
                            color: Number(r.waste_rate_pct) > 3 ? "#c53030" : "#276749",
                          }}
                        >
                          {Number(r.waste_rate_pct).toFixed(2)}%
                        </span>
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => toggleStore(r.store_id)}
                          style={isExpanded ? btnOrangeActive : btnOrange}
                        >
                          {isExpanded ? "▲ Thu gọn" : "▼ Xem chi tiết"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <WasteDetailPanel
                        key={`waste-${r.store_id}`}
                        storeId={r.store_id}
                        storeName={r.store_name}
                        onClose={() => setExpandedStore(null)}
                      />
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#4a5568" };
const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14 };
const sth: React.CSSProperties = { padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#4a5568", textAlign: "left" };
const std: React.CSSProperties = { padding: "8px 12px", fontSize: 12 };
const btnOrange: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 6, border: "1px solid #fbd38d",
  background: "#fffaf0", color: "#c05621", fontWeight: 600, fontSize: 12, cursor: "pointer",
};
const btnOrangeActive: React.CSSProperties = {
  ...btnOrange, background: "#fbd38d", borderColor: "#f6ad55",
};


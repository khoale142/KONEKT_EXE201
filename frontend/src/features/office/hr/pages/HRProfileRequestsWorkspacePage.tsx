import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listProfileRequestsForHr, type HrProfileRequestListItem } from "../api/hrProfile.api";
import HrPageHeader from "../components/HrPageHeader";
import {
  changeSummaryLines,
  changesFromRequestedData,
  inferRequestGroup,
  statusBadgeStyle,
  statusLabelFallback,
} from "../utils/profileRequestDisplay";
import { dash } from "../../../shared/dashboard/dashboardUi";

const listGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: 20,
  background: "#fffdf9",
  borderRadius: 18,
  border: "1px solid #ddd8cc",
  boxShadow: "0 10px 28px rgba(47, 93, 58, 0.08)",
  color: "inherit",
  textDecoration: "none",
};

export default function HRProfileRequestsWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HrProfileRequestListItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listProfileRequestsForHr()
      .then((response) => setRows(response))
      .catch((e: any) => setError(e?.response?.data?.message || "Không tải được danh sách yêu cầu"))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const pending = rows.filter((row) => !row.status || row.status === "pending_hr").length;
    const rejected = rows.filter((row) => row.status === "rejected" || row.status === "rejected_by_hr").length;
    return {
      total: rows.length,
      pending,
      rejected,
    };
  }, [rows]);

  return (
    <div>
      <HrPageHeader
        title="Yêu cầu chỉnh sửa hồ sơ"
        description="Danh sách các phiếu Store Manager đã chuyển tiếp lên HR. Mỗi thẻ cho biết nhân viên nào đang xin cập nhật gì và mức độ cần xử lý."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <Metric label="Tổng phiếu" value={loading ? "—" : stats.total} />
          <Metric label="Đang chờ HR" value={loading ? "—" : stats.pending} />
          <Metric label="Đã từ chối" value={loading ? "—" : stats.rejected} />
        </div>
      </HrPageHeader>

      {loading ? <p style={{ color: dash.muted }}>Đang tải...</p> : null}
      {error ? <p style={{ color: "#c53030" }}>{error}</p> : null}

      {!loading && !error ? (
        rows.length === 0 ? (
          <div
            style={{
              padding: 28,
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              color: "#718096",
              textAlign: "center",
            }}
          >
            Hiện không có yêu cầu nào đang chờ HR xử lý.
          </div>
        ) : (
          <div style={listGridStyle}>
            {rows.map((row) => {
              const status = row.status ?? "pending_hr";
              const badge = statusBadgeStyle(status);
              const changes = changesFromRequestedData(row.requestedData ?? {});
              const summary = changeSummaryLines(changes);
              const requestGroup = inferRequestGroup(row.requestedData ?? {});
              const createdAt = row.createdAt
                ? new Date(row.createdAt).toLocaleString("vi-VN")
                : "Chưa rõ thời gian";

              return (
                <Link key={row.id} to={`/office/hr/profile-requests/${row.id}`} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ fontSize: 22, fontWeight: 800, color: "#16301f" }}>
                          {row.fullName || row.message}
                        </span>
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {statusLabelFallback(status)}
                        </span>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                        <MetaPill label={`Phiếu #${row.id}`} />
                        <MetaPill label={row.roleName || "Nhân sự"} />
                        <MetaPill label={requestGroup} />
                      </div>

                      <div style={{ color: dash.muted, fontSize: 14, lineHeight: 1.65 }}>
                        {summary ? `Nội dung thay đổi: ${summary}` : "Mở chi tiết để xem đầy đủ các trường thay đổi."}
                      </div>
                      <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
                        Gửi lúc {createdAt}
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: 180,
                        padding: "12px 14px",
                        borderRadius: 14,
                        background: "#f7fbf6",
                        border: "1px solid #d7e5d8",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>
                        Tóm tắt xử lý
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.6, color: "#16301f" }}>
                        {status === "pending_hr"
                          ? "Cần HR xác nhận để cập nhật hồ sơ chính thức."
                          : "Phiếu này đã qua bước xử lý, mở chi tiết để xem quyết định."}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "14px 16px",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      <div style={{ fontSize: "0.72rem", opacity: 0.84, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.45rem", fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 10px",
        borderRadius: 999,
        background: "#f4efe6",
        border: "1px solid #e3d8c7",
        color: "#6b5d4b",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

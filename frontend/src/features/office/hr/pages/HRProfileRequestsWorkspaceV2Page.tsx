import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { dash } from "../../../shared/dashboard/dashboardUi";
import { listProfileRequestsForHr, type HrProfileRequestListItem } from "../api/hrProfile.api";
import HrPageHeader from "../components/HrPageHeader";
import {
  changeSummaryLines,
  changesFromRequestedData,
  extractRequestNote,
  inferRequestGroup,
  statusBadgeStyle,
  statusLabelFallback,
} from "../utils/profileRequestDisplayWorkspace";

const listGridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const cardStyle: CSSProperties = {
  display: "block",
  padding: 22,
  background: "linear-gradient(180deg, #fffdf9 0%, #f8fbf7 100%)",
  borderRadius: 20,
  border: "1px solid #ddd8cc",
  boxShadow: "0 12px 30px rgba(47, 93, 58, 0.08)",
  color: "inherit",
  textDecoration: "none",
};

const helperCardStyle: CSSProperties = {
  padding: 18,
  borderRadius: 18,
  border: "1px solid #ddd8cc",
  background: "#fffaf3",
  color: "#4b5563",
  lineHeight: 1.7,
};

export default function HRProfileRequestsWorkspaceV2Page() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HrProfileRequestListItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listProfileRequestsForHr()
      .then((response) => setRows(response))
      .catch((e: any) => setError(e?.response?.data?.message || "Không tải được danh sách yêu cầu."))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const pending = rows.filter((row) => !row.status || row.status === "pending_hr").length;
    const approved = rows.filter((row) => row.status === "approved").length;
    const rejected = rows.filter((row) => row.status === "rejected" || row.status === "rejected_by_hr").length;

    return {
      total: rows.length,
      pending,
      approved,
      rejected,
    };
  }, [rows]);

  return (
    <div>
      <HrPageHeader
        title="Yêu cầu chỉnh sửa hồ sơ"
        description="Danh sách các phiếu Store Manager đã chuyển lên HR. Mỗi phiếu cho biết nhân viên muốn cập nhật nội dung gì, gửi lúc nào và đang ở bước xử lý nào."
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
          <Metric label="Đã duyệt" value={loading ? "—" : stats.approved} />
          <Metric label="Đã từ chối" value={loading ? "—" : stats.rejected} />
        </div>
      </HrPageHeader>

      <div style={{ display: "grid", gap: 18 }}>
        <section style={helperCardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#16301f", marginBottom: 8 }}>
            Cách đọc nhanh danh sách
          </div>
          <div>
            Mỗi thẻ thể hiện người gửi, nhóm thông tin thay đổi, các trường chính cần duyệt và thời điểm gửi.
            Mở chi tiết để xem so sánh giữa hồ sơ hiện tại và nội dung đề xuất mới trước khi ra quyết định.
          </div>
        </section>

        {loading ? <p style={{ color: dash.muted }}>Đang tải danh sách yêu cầu...</p> : null}
        {error ? <p style={{ color: "#c53030" }}>{error}</p> : null}

        {!loading && !error ? (
          rows.length === 0 ? (
            <div
              style={{
                padding: 28,
                background: "#fff",
                borderRadius: 18,
                border: "1px solid #ddd8cc",
                color: "#718096",
                textAlign: "center",
              }}
            >
              Hiện chưa có yêu cầu nào đang chờ HR xử lý.
            </div>
          ) : (
            <div style={listGridStyle}>
              {rows.map((row) => {
                const status = row.status ?? "pending_hr";
                const badge = statusBadgeStyle(status);
                const changes = changesFromRequestedData(row.requestedData ?? {});
                const summary = changeSummaryLines(changes);
                const requestGroup = inferRequestGroup(row.requestedData ?? {});
                const requestNote = extractRequestNote(row.requestedData ?? {});
                const createdAt = row.createdAt
                  ? new Date(row.createdAt).toLocaleString("vi-VN")
                  : "Chưa rõ thời gian";

                return (
                  <Link key={row.id} to={`/office/hr/profile-requests/${row.id}`} style={cardStyle}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.7fr) minmax(250px, 0.9fr)",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 10,
                            marginBottom: 10,
                          }}
                        >
                          <span style={{ fontSize: 24, fontWeight: 800, color: "#16301f" }}>
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

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                          <MetaPill label={`Phiếu #${row.id}`} />
                          <MetaPill label={row.roleName || "Nhân sự"} />
                          <MetaPill label={requestGroup} />
                          <MetaPill label={`${changes.length} trường thay đổi`} />
                        </div>

                        <div style={{ color: dash.muted, fontSize: 14, lineHeight: 1.7 }}>
                          {summary
                            ? `Nội dung cập nhật chính: ${summary}.`
                            : "Mở chi tiết để xem đầy đủ các trường thay đổi."}
                        </div>

                        {requestNote ? (
                          <div
                            style={{
                              marginTop: 12,
                              padding: "12px 14px",
                              borderRadius: 14,
                              background: "#fffaf3",
                              border: "1px solid #efe1cb",
                              color: "#4a3f35",
                              fontSize: 14,
                              lineHeight: 1.65,
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Ghi chú người gửi</div>
                            <div>{requestNote}</div>
                          </div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 12,
                          alignContent: "start",
                        }}
                      >
                        <InfoPanel
                          label="Thời điểm gửi"
                          value={createdAt}
                          note="Dùng để ưu tiên các phiếu đang chờ lâu."
                        />
                        <InfoPanel
                          label="Hành động tiếp theo"
                          value={
                            status === "pending_hr"
                              ? "Mở chi tiết để đối chiếu và ra quyết định."
                              : "Phiếu đã có kết quả xử lý. Mở chi tiết để xem quyết định."
                          }
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        ) : null}
      </div>
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

function InfoPanel({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "#f7fbf6",
        border: "1px solid #d7e5d8",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#16301f", lineHeight: 1.6 }}>{value}</div>
      {note ? <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>{note}</div> : null}
    </div>
  );
}

import type { CSSProperties } from "react";
import {
  getScheduleRequestPresentation,
  type ScheduleRequestDetail,
} from "../utils/scheduleRequestDetails";

export type ScheduleRequestHistoryItem = {
  id: number | string;
  requesterName?: string | null;
  requestType?: string | null;
  status?: string | null;
  createdAt?: string | null;
  detail?: ScheduleRequestDetail | null;
};

type Props = {
  items: ScheduleRequestHistoryItem[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyText: string;
};

const cardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 18,
  border: "1px solid #e5e7eb",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

export default function ScheduleRequestHistoryList({
  items,
  page,
  totalPages,
  onPageChange,
  emptyText,
}: Props) {
  if (items.length === 0) {
    return (
      <div
        style={{
          ...cardStyle,
          padding: 32,
          textAlign: "center",
          color: "#6b7280",
        }}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((item) => {
        const kind = item.detail?.requestType ?? item.requestType ?? "";
        const detailView = getScheduleRequestPresentation({
          kind,
          detail: item.detail,
        });
        const statusMeta = getStatusMeta(item.status);
        const decisionNote = String(item.detail?.decision?.note || "").trim();

        return (
          <div key={item.id} style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  <strong style={{ color: "#111827", fontSize: 16 }}>
                    {item.requesterName || "Nhân viên"}
                  </strong>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: statusMeta.bg,
                      color: statusMeta.color,
                      fontWeight: 700,
                    }}
                  >
                    {statusMeta.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                    {getRequestKindLabel(kind)}
                  </span>
                </div>
                {decisionNote ? (
                  <div style={{ fontSize: 13, color: "#4b5563" }}>
                    Ghi chú xử lý: {decisionNote}
                  </div>
                ) : null}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                {item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "—"}
              </div>
            </div>

            {detailView.hasDetail ? (
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: 12,
                }}
              >
                <div style={{ marginBottom: 8, fontSize: 13, color: "#64748b" }}>
                  Ngày làm việc:{" "}
                  <strong style={{ color: "#111827" }}>{detailView.workDateLabel}</strong>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <InfoBox
                    label="Ca hiện tại"
                    title={detailView.currentTitle}
                    timeLabel={detailView.currentTimeLabel}
                  />
                  <InfoBox
                    label={detailView.desiredPanelLabel}
                    title={detailView.desiredTitle}
                    timeLabel={detailView.desiredTimeLabel}
                    emphasized
                  />
                </div>
                {detailView.reason ? (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: "1px dashed #cbd5e1",
                      fontSize: 13,
                      color: "#475569",
                    }}
                  >
                    <strong>Lý do:</strong> {detailView.reason}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {totalPages > 1 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => {
            const active = pageNumber === page;
            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                style={{
                  minWidth: 38,
                  height: 38,
                  borderRadius: 10,
                  border: `1px solid ${active ? "#2f5d3a" : "#d1d5db"}`,
                  background: active ? "#2f5d3a" : "#fff",
                  color: active ? "#fff" : "#374151",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {pageNumber}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function InfoBox({
  label,
  title,
  timeLabel,
  emphasized = false,
}: {
  label: string;
  title: string;
  timeLabel: string;
  emphasized?: boolean;
}) {
  return (
    <div
      style={{
        flex: "1 1 230px",
        minWidth: 230,
        background: emphasized ? "#eff6ff" : "#fff",
        border: `1px solid ${emphasized ? "#bfdbfe" : "#e2e8f0"}`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: emphasized ? "#2563eb" : "#94a3b8",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#475569" }}>{timeLabel}</div>
    </div>
  );
}

function getRequestKindLabel(kind: string) {
  if (kind === "CHANGE_TIME") return "Đổi giờ làm";
  if (kind === "CHANGE_SHIFT") return "Đổi ca";
  if (kind === "DROP_SHIFT") return "Xin nghỉ ca";
  return kind || "Yêu cầu";
}

function getStatusMeta(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") {
    return { label: "Đã chấp nhận", bg: "#dcfce7", color: "#166534" };
  }
  if (normalized === "rejected") {
    return { label: "Đã từ chối", bg: "#fee2e2", color: "#b91c1c" };
  }
  if (normalized === "expired") {
    return { label: "Đã hết hạn", bg: "#fef3c7", color: "#b45309" };
  }
  return { label: "Đang chờ xử lý", bg: "#eff6ff", color: "#2563eb" };
}

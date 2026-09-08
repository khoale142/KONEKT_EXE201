import { useEffect, useMemo, useState } from "react";
import { posGetActionLogs, type PosActionLogItem } from "../api/posActionLogs.api";

const ACTION_OPTIONS = [
  "",
  "SHIFT_OPEN",
  "SHIFT_CLOSE",
  "ORDER_CREATE",
  "ORDER_PAY",
  "ORDER_REFUND",
  "ORDER_CANCEL_PENDING",
  "ORDER_ATTACH_MEMBER",
  "ORDER_CHANGE_TYPE",
  "ORDER_CHANGE_CARD",
  "MEMBER_QUICK_CREATE",
  "OFFLINE_SYNC",
  "OFFLINE_RESYNC",
];

const ACTION_LABELS: Record<string, string> = {
  SHIFT_OPEN: "Mở ca",
  SHIFT_CLOSE: "Đóng ca",
  ORDER_CREATE: "Tạo đơn",
  ORDER_PAY: "Thu tiền",
  ORDER_REFUND: "Hoàn tiền",
  ORDER_CANCEL_PENDING: "Hủy đơn pending",
  ORDER_ATTACH_MEMBER: "Gắn member",
  ORDER_CHANGE_TYPE: "Đổi loại đơn",
  ORDER_CHANGE_CARD: "Đổi số thẻ",
  MEMBER_QUICK_CREATE: "Tạo member nhanh",
  OFFLINE_SYNC: "Đồng bộ offline",
  OFFLINE_RESYNC: "Đồng bộ lại offline",
};

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function prettyJson(value: any) {
  if (value == null) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getActionLabel(actionType?: string | null) {
  if (!actionType) return "-";
  return ACTION_LABELS[actionType] || actionType.split("_").join(" ");
}

function getActorLabel(row: PosActionLogItem) {
  if (row.actorName) return row.actorName;
  if (row.actorId != null) return `#${row.actorId}`;
  return "-";
}

export default function PosActionLogsPage() {
  const today = useMemo(() => new Date(), []);
  const [dateFrom, setDateFrom] = useState(toDateInputValue(today));
  const [dateTo, setDateTo] = useState(toDateInputValue(today));
  const [actionType, setActionType] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [logs, setLogs] = useState<PosActionLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PosActionLogItem | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await posGetActionLogs({
        dateFrom,
        dateTo,
        actionType: actionType || undefined,
        orderCode: orderCode.trim() || undefined,
        limit: 100,
        offset: 0,
      });
      setLogs(data.logs || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Không tải được nhật ký");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="pos-screen pos-ui pos-action-log-page">
      <div className="pos-shell pos-shell--wide">
        <div className="pos-topbar">
          <div className="pos-topbar__main">
            <div className="pos-topbar__eyebrow">POS logs</div>
            <h1 className="pos-topbar__title">Nhật ký thao tác POS</h1>
            <p className="pos-topbar__subtitle">Xem log theo ngày, thao tác và order code.</p>
          </div>

          <div className="pos-inline-actions">
            <button onClick={load} disabled={loading}>
              {loading ? "Đang tải..." : "Tải lại"}
            </button>
          </div>
        </div>

        <div className="pos-panel" style={{ marginTop: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>Từ ngày</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>Đến ngày</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>Loại thao tác</span>
              <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
                {ACTION_OPTIONS.map((x) => (
                  <option key={x || "ALL"} value={x}>
                    {x || "Tất cả"}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>Order code</span>
              <input
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                placeholder="VD: OD2026..."
              />
            </label>

            <div style={{ display: "flex", alignItems: "end" }}>
              <button onClick={load} disabled={loading} style={{ width: "100%" }}>
                {loading ? "Đang lọc..." : "Lọc"}
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="pos-alert pos-alert--danger">{error}</div> : null}

        <div className="pos-table-shell pos-action-log-table" style={{ marginTop: 18 }}>
          <div className="pos-action-log-table__header">
            <div>Thời gian</div>
            <div>Thao tác</div>
            <div>Actor</div>
            <div>Order</div>
            <div>Member</div>
            <div>Ghi chú</div>
            <div></div>
          </div>

          {loading ? (
            <div className="pos-action-log-table__empty">Đang tải...</div>
          ) : logs.length === 0 ? (
            <div className="pos-action-log-table__empty">Không có dữ liệu</div>
          ) : (
            logs.map((row) => (
              <div key={row.id} className="pos-action-log-table__row">
                <div className="pos-action-log-table__cell">{formatDateTime(row.createdAt)}</div>

                <div className="pos-action-log-table__cell">
                  <div className="pos-action-log-table__primary">
                    {getActionLabel(row.actionType)}
                  </div>
                  <div className="pos-action-log-table__secondary">{row.actionType}</div>
                  {row.reconciliationId ? (
                    <div className="pos-action-log-table__meta">Ca #{row.reconciliationId}</div>
                  ) : null}
                </div>

                <div className="pos-action-log-table__cell">
                  <div className="pos-action-log-table__primary">{getActorLabel(row)}</div>
                  <div className="pos-action-log-table__meta">{row.actorType || "Actor"}</div>
                </div>

                <div className="pos-action-log-table__cell">
                  <div className="pos-action-log-table__primary">{row.orderCode || "-"}</div>
                  {row.pickupNumber != null ? (
                    <div className="pos-action-log-table__meta">Pickup: {row.pickupNumber}</div>
                  ) : null}
                </div>

                <div className="pos-action-log-table__cell">
                  <div className="pos-action-log-table__primary">
                    {row.memberName || row.memberPhone || row.memberId || "-"}
                  </div>
                  {row.memberPhone ? (
                    <div className="pos-action-log-table__meta">{row.memberPhone}</div>
                  ) : null}
                </div>

                <div className="pos-action-log-table__cell">
                  <div className="pos-action-log-table__note">{row.note || "-"}</div>
                </div>

                <div className="pos-action-log-table__cell pos-action-log-table__cell--action">
                  <button onClick={() => setSelected(row)}>Chi tiết</button>
                </div>
              </div>
            ))
          )}
        </div>

        {selected ? (
          <div className="pos-modal-backdrop" onClick={() => setSelected(null)}>
            <div
              className="pos-modal-card pos-scroll"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(1000px, 100%)",
                maxHeight: "85vh",
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <h2 style={{ margin: 0 }}>
                  {selected.actionType} #{selected.id}
                </h2>
                <button onClick={() => setSelected(null)}>Đóng</button>
              </div>

              <div className="pos-muted" style={{ marginBottom: 12 }}>
                {formatDateTime(selected.createdAt)}
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Before</div>
                  <pre>{prettyJson(selected.beforeData)}</pre>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>After</div>
                  <pre>{prettyJson(selected.afterData)}</pre>
                </div>

                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Metadata</div>
                  <pre>{prettyJson(selected.metadata)}</pre>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


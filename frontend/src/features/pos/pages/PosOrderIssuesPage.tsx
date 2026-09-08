import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  posOrderIssuesApi,
  type PosOrderIssue,
  type PosOrderIssueStatus,
  type PosOrderIssueType,
} from "../api/posOrderIssues.api";

const STATUS_LABEL: Record<string, string> = {
  open: "Mới gửi",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

const TYPE_LABEL: Record<string, string> = {
  missing_item: "Thiếu món",
  wrong_item: "Sai món",
  damaged_item: "Món bị đổ / hỏng",
  quality_issue: "Chất lượng không ổn",
  long_wait: "Chờ quá lâu",
  other: "Khác",
};

function getStatusBadgeClass(status: string) {
  if (status === "resolved") return "pos-badge pos-badge--success";
  if (status === "rejected" || status === "cancelled") return "pos-badge pos-badge--danger";
  if (status === "in_progress") return "pos-badge pos-badge--warning";
  return "pos-badge pos-badge--info";
}

export default function PosOrderIssuesPage() {
  const nav = useNavigate();
  const [issues, setIssues] = useState<PosOrderIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [issueType, setIssueType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [resolutionNoteMap, setResolutionNoteMap] = useState<Record<number, string>>({});
  const [internalNoteMap, setInternalNoteMap] = useState<Record<number, string>>({});

  const activeCount = useMemo(
    () => issues.filter((x) => x.status === "open" || x.status === "in_progress").length,
    [issues],
  );

  const loadIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await posOrderIssuesApi.listIssues({
        search: search.trim() || undefined,
        status: (status || undefined) as PosOrderIssueStatus | undefined,
        issueType: (issueType || undefined) as PosOrderIssueType | undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 100,
      });

      setIssues(res.issues || []);

      setResolutionNoteMap((prev) => {
        const next = { ...prev };
        for (const issue of res.issues || []) {
          if (next[issue.id] == null) next[issue.id] = issue.resolutionNote || "";
        }
        return next;
      });

      setInternalNoteMap((prev) => {
        const next = { ...prev };
        for (const issue of res.issues || []) {
          if (next[issue.id] == null) next[issue.id] = issue.internalNote || "";
        }
        return next;
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được phản ánh");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const handleUpdate = async (
    issue: PosOrderIssue,
    nextStatus: "in_progress" | "resolved" | "rejected",
  ) => {
    setSavingId(issue.id);
    setError(null);
    try {
      const res = await posOrderIssuesApi.updateStatus(issue.id, {
        status: nextStatus,
        internalNote: internalNoteMap[issue.id] || undefined,
        resolutionNote: resolutionNoteMap[issue.id] || undefined,
      });
      setIssues((prev) => prev.map((x) => (x.id === issue.id ? res.issue : x)));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Cập nhật phản ánh thất bại");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="pos-screen pos-ui pos-issues-page">
      <div className="pos-shell pos-shell--medium">
        <div className="pos-topbar">
          <div className="pos-topbar__main">
            <div className="pos-topbar__eyebrow">Order issues</div>
            <h2 className="pos-topbar__title">Phản ánh đơn hàng</h2>
            <p className="pos-topbar__subtitle">
              Staff và POS theo dõi các phản ánh sau bán để cập nhật trạng thái xử lý.
            </p>
          </div>

          <div className="pos-inline-actions">
            <span className="pos-badge pos-badge--warning">{activeCount} đang mở</span>
            <button onClick={loadIssues} disabled={loading}>
              {loading ? "Đang tải..." : "Tải lại"}
            </button>
            <button onClick={() => nav("/pos", { replace: true })}>Về dashboard</button>
          </div>
        </div>

        <div className="pos-panel" style={{ marginTop: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã đơn / tên khách / số điện thoại"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="open">Mới gửi</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="resolved">Đã xử lý</option>
              <option value="rejected">Từ chối</option>
            </select>

            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
            >
              <option value="">Tất cả loại phản ánh</option>
              <option value="missing_item">Thiếu món</option>
              <option value="wrong_item">Sai món</option>
              <option value="damaged_item">Món bị đổ / hỏng</option>
              <option value="quality_issue">Chất lượng không ổn</option>
              <option value="long_wait">Chờ quá lâu</option>
              <option value="other">Khác</option>
            </select>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Từ ngày
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Đến ngày
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>

            <button onClick={loadIssues} disabled={loading}>
              {loading ? "Đang tải..." : "Lọc"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="pos-alert pos-alert--danger" style={{ marginTop: 16 }}>
            {error}
          </div>
        ) : null}

        <div className="pos-card-grid" style={{ marginTop: 18 }}>
          {issues.length === 0 && !loading ? (
            <div className="pos-empty-state">Chưa có phản ánh nào khớp với bộ lọc hiện tại.</div>
          ) : null}

          {issues.map((issue) => (
            <div key={issue.id} className="pos-list-card" style={{ padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div className="pos-stack pos-stack--compact" style={{ gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>
                      {issue.orderCode || `#${issue.orderId}`}
                    </div>
                    <span className={getStatusBadgeClass(issue.status)}>
                      {STATUS_LABEL[issue.status] || issue.status}
                    </span>
                    <span className="pos-badge pos-badge--info">
                      {TYPE_LABEL[issue.issueType] || issue.issueType}
                    </span>
                  </div>

                  <div className="pos-muted">
                    Khách: {issue.customerName || "-"}
                    {issue.customerPhone ? ` • ${issue.customerPhone}` : ""}
                  </div>

                  <div className="pos-muted">
                    Số thẻ: {issue.pickupNumber ?? "-"} • Gửi lúc: {issue.createdAt}
                  </div>
                </div>
              </div>

              <div className="pos-summary-box" style={{ marginTop: 14, whiteSpace: "pre-wrap" }}>
                {issue.description}
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <textarea
                  value={internalNoteMap[issue.id] || ""}
                  onChange={(e) =>
                    setInternalNoteMap((prev) => ({ ...prev, [issue.id]: e.target.value }))
                  }
                  placeholder="Ghi chú nội bộ cho staff/POS"
                  rows={2}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
                <textarea
                  value={resolutionNoteMap[issue.id] || ""}
                  onChange={(e) =>
                    setResolutionNoteMap((prev) => ({ ...prev, [issue.id]: e.target.value }))
                  }
                  placeholder="Phản hồi gửi cho khách khi xử lý / từ chối"
                  rows={3}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </div>

              <div className="pos-inline-actions" style={{ marginTop: 14 }}>
                <button
                  onClick={() => handleUpdate(issue, "in_progress")}
                  disabled={savingId === issue.id || issue.status !== "open"}
                >
                  Nhận xử lý
                </button>

                <button
                  onClick={() => handleUpdate(issue, "resolved")}
                  disabled={
                    savingId === issue.id || ["resolved", "rejected"].includes(issue.status)
                  }
                >
                  Đánh dấu đã xử lý
                </button>

                <button
                  onClick={() => handleUpdate(issue, "rejected")}
                  disabled={
                    savingId === issue.id || ["resolved", "rejected"].includes(issue.status)
                  }
                >
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

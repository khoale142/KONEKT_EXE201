import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { memberOrderIssuesApi, type MemberOrderIssue } from "../api/memberOrderIssues.api";

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

export default function MemberOrderIssuesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as { successMessage?: string } | null)?.successMessage || "";

  const [issues, setIssues] = useState<MemberOrderIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [issueType, setIssueType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadIssues = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await memberOrderIssuesApi.listIssues({
        search: search.trim() || undefined,
        status: (status || undefined) as any,
        issueType: (issueType || undefined) as any,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 100,
      });
      setIssues(res.issues || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được danh sách phản ánh");
      if (e?.response?.status === 401) navigate("/login/customer", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, []);

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="cafe-hero" style={{ padding: "40px 24px 36px" }}>
        <h1 className="cafe-hero-title" style={{ marginBottom: 8 }}>Phản ánh của tôi</h1>
        <p className="cafe-hero-subtitle">Theo dõi các phản ánh sau khi nhận đơn</p>
      </section>

      <main className="cafe-page-main cafe-page-main--wide">
        {successMessage ? (
          <div style={{ padding: "14px 18px", background: "rgba(39,174,96,0.12)", border: "1px solid rgba(39,174,96,0.28)", borderRadius: 12, color: "var(--cafe-success)", fontSize: "0.92rem", marginBottom: 18 }}>
            {successMessage}
          </div>
        ) : null}
{error ? (
          <div style={{ padding: "14px 18px", background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 12, color: "var(--cafe-error)", fontSize: "0.9rem", marginBottom: 24 }}>
            {error}
          </div>
        ) : null}

        <div className="cafe-card-elevated" style={{ marginBottom: 20, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <p style={{ margin: 0, color: "var(--cafe-text-muted)", fontSize: "0.95rem" }}>
            Nếu đơn có vấn đề sau khi nhận, bạn có thể gửi phản ánh để quán xử lý.
          </p>
          <Link to="/customer/orders" className="cafe-btn-secondary" style={{ textDecoration: "none" }}>
            Xem đơn hàng
          </Link>
        </div>

        <div className="cafe-filter-bar" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã đơn / cửa hàng / nội dung"
            style={{ minWidth: 260, flex: 1 }}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">Tất cả trạng thái</option>
            <option value="open">Mới gửi</option>
            <option value="in_progress">Đang xử lý</option>
            <option value="resolved">Đã xử lý</option>
            <option value="rejected">Từ chối</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select value={issueType} onChange={(e) => setIssueType(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">Tất cả loại phản ánh</option>
            <option value="missing_item">Thiếu món</option>
            <option value="wrong_item">Sai món</option>
            <option value="damaged_item">Món bị đổ / hỏng</option>
            <option value="quality_issue">Chất lượng không ổn</option>
            <option value="long_wait">Chờ quá lâu</option>
            <option value="other">Khác</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
            Từ ngày
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
            Đến ngày
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button type="button" className="cafe-btn-primary" onClick={loadIssues}>Lọc</button>
          {(search || status || issueType || dateFrom || dateTo) ? (
            <button
              type="button"
className="cafe-btn-secondary"
              onClick={() => {
                setSearch("");
                setStatus("");
                setIssueType("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Xóa lọc
            </button>
          ) : null}
        </div>

        {loading ? (
          <p style={{ color: "var(--cafe-text-muted)", padding: 32, textAlign: "center" }}>Đang tải...</p>
        ) : issues.length === 0 ? (
          <div className="cafe-empty-state">
            <p className="cafe-empty-state-icon">📝</p>
            <p className="cafe-empty-state-title">Bạn chưa có phản ánh nào.</p>
            <Link to="/customer/orders" className="cafe-btn-primary cafe-btn-cta" style={{ textDecoration: "none" }}>
              Xem đơn hàng đã mua
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {issues.map((issue) => (
              <div key={issue.id} className="cafe-card-elevated" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <strong style={{ fontSize: "1.02rem", color: "var(--cafe-olive-dark)" }}>
                        {issue.orderCode || `Đơn #${issue.orderId}`}
                      </strong>
                      <span className={`cafe-status-badge cafe-status-badge--${issue.status}`}>
                        {STATUS_LABEL[issue.status] || issue.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--cafe-text-muted)" }}>
                      {issue.storeName || "—"} • {TYPE_LABEL[issue.issueType] || issue.issueType}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.86rem", color: "var(--cafe-text-muted)" }}>
                    <div>Gửi lúc: {issue.createdAt}</div>
                    {issue.resolvedAt ? <div>Xử lý lúc: {issue.resolvedAt}</div> : null}
                  </div>
                </div>

                <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{issue.description}</p>

                {issue.resolutionNote ? (
                  <div style={{ padding: 12, borderRadius: 10, background: "var(--cafe-cream)", marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Phản hồi từ quán</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{issue.resolutionNote}</div>
                  </div>
                ) : null}
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
                    {issue.pickupNumber ? `Số lấy hàng: ${issue.pickupNumber}` : "Chưa có số lấy hàng"}
                  </div>
                  <Link to={`/customer/orders/${issue.orderId}`} className="cafe-link">
                    Xem lại đơn hàng →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <CafeFooter />
      <ChatButton />
    </div>
  );
}
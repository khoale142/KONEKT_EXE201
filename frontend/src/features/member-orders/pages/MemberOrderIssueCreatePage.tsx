import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { memberOrdersApi } from "../api/memberOrders.api";
import { memberOrderIssuesApi, type MemberOrderIssueType } from "../api/memberOrderIssues.api";

const ISSUE_OPTIONS: Array<{ value: MemberOrderIssueType; label: string; hint: string }> = [
  { value: "missing_item", label: "Thiếu món", hint: "Đơn thiếu một hoặc nhiều món đã đặt" },
  { value: "wrong_item", label: "Sai món", hint: "Quán giao nhầm món / sai size / sai topping" },
  { value: "damaged_item", label: "Món bị đổ / hỏng", hint: "Ly bị đổ, đóng gói lỗi hoặc sản phẩm không còn nguyên vẹn" },
  { value: "quality_issue", label: "Chất lượng không ổn", hint: "Món không đúng kỳ vọng về chất lượng hoặc hương vị" },
  { value: "long_wait", label: "Chờ quá lâu", hint: "Thời gian chờ nhận món quá lâu" },
  { value: "other", label: "Khác", hint: "Các vấn đề khác liên quan đến đơn hàng" },
];

export default function MemberOrderIssueCreatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const orderId = id ? Number(id) : NaN;

  const [data, setData] = useState<Awaited<ReturnType<typeof memberOrdersApi.getOrderDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issueType, setIssueType] = useState<MemberOrderIssueType>("missing_item");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(orderId)) {
      setError("Mã đơn không hợp lệ");
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await memberOrdersApi.getOrderDetail(orderId);
        setData(res);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Không tải được đơn hàng");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const handleSubmit = async () => {
    if (!data) return;
    if (description.trim().length < 10) {
      setError("Vui lòng nhập mô tả ít nhất 10 ký tự");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await memberOrderIssuesApi.createIssue(data.order.id, {
        issueType,
        description: description.trim(),
      });
      navigate("/customer/issues", {
        replace: true,
        state: {
          successMessage: `Đã gửi phản ánh cho đơn ${data.order.orderCode}. Quán sẽ kiểm tra và phản hồi sớm.`,
        },
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Gửi phản ánh thất bại");
} finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />
      <section className="cafe-hero">
        <h1 className="cafe-hero-title">Gửi phản ánh đơn hàng</h1>
        <p className="cafe-hero-subtitle">Tạo phản ánh riêng, không ảnh hưởng phần đánh giá sao</p>
      </section>

      <main style={{ flex: 1, padding: 32, maxWidth: 760, margin: "0 auto", width: "100%" }}>
        {loading ? (
          <p style={{ color: "var(--cafe-text-muted)", textAlign: "center" }}>Đang tải...</p>
        ) : error && !data ? (
          <div style={{ textAlign: "center" }}>
            <p className="cafe-error">{error}</p>
            <Link to="/customer/orders" className="cafe-link">← Danh sách đơn hàng</Link>
          </div>
        ) : data ? (
          <div className="cafe-card" style={{ padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <p><strong>Mã đơn:</strong> {data.order.orderCode}</p>
              <p><strong>Cửa hàng:</strong> {data.order.storeName || "—"}</p>
              <p><strong>Trạng thái:</strong> {data.order.status}</p>
              <p><strong>Hoàn thành lúc:</strong> {data.order.completedAt || "-"}</p>
              {data.order.pickupNumber ? <p><strong>Số lấy hàng:</strong> {data.order.pickupNumber}</p> : null}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Loại phản ánh</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as MemberOrderIssueType)}
                className="cafe-input"
                style={{ width: "100%" }}
              >
                {ISSUE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
                {ISSUE_OPTIONS.find((x) => x.value === issueType)?.hint}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Mô tả chi tiết</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="cafe-input"
                placeholder="Ví dụ: thiếu 1 ly trà đào size M, đơn nhận lúc 19:20, tôi chỉ nhận được 2/3 món..."
                style={{ width: "100%", padding: 12 }}
              />
              <div style={{ marginTop: 8, fontSize: "0.85rem", color: "var(--cafe-text-muted)" }}>
Chỉ nhận phản ánh đơn đã hoàn thành và trong vòng 48 giờ sau khi nhận hàng.
              </div>
            </div>

            {error ? <p className="cafe-error" style={{ marginBottom: 16 }}>{error}</p> : null}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="button" className="cafe-btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Đang gửi..." : "Gửi phản ánh"}
              </button>
              <Link to={`/customer/orders/${data.order.id}`} className="cafe-btn-secondary" style={{ textDecoration: "none" }}>
                Quay lại đơn hàng
              </Link>
            </div>
          </div>
        ) : null}
      </main>

      <CafeFooter />
      <ChatButton />
    </div>
  );
}
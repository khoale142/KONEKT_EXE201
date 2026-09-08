import { Link, useSearchParams } from "react-router-dom";
import { usePaymentStatus } from "../hooks/usePaymentStatus";

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const resultParam = searchParams.get("result");
  const orderId = orderIdParam ? parseInt(orderIdParam, 10) : null;

  // Polling: backend là nguồn sự thật, trang này sẽ tự hiển thị theo `data?.status`.
  // (Không dùng `data` trong chính tham số hook để tránh lỗi "used before declaration".)
  const { data, isLoading, isError } = usePaymentStatus(orderId, { refetchInterval: 2000 });

  if (!orderId) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>Thiếu thông tin đơn hàng.</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>Đang kiểm tra trạng thái thanh toán...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p>Không thể tải trạng thái. Vui lòng thử lại sau.</p>
      </div>
    );
  }

  const status = data?.status ?? "PENDING";

  const linkToPos = (
    <p style={{ marginTop: 16 }}>
      <Link to="/pos" style={{ color: "#2563eb", textDecoration: "underline" }}>
        ← Về POS
      </Link>
    </p>
  );

  if (status === "PAID") {
    return (
      <div style={{ padding: 32, maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ color: "var(--success, #22c55e)" }}>Thanh toán thành công</h2>
        <p>Đơn hàng #{orderId} đã được thanh toán.</p>
        {data?.paidAt && (
          <p style={{ fontSize: 14, color: "#666" }}>
            Thời gian: {new Date(data.paidAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
          </p>
        )}
        {linkToPos}
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div style={{ padding: 32, maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ color: "var(--error, #ef4444)" }}>Thanh toán thất bại</h2>
        <p>Đơn hàng #{orderId} chưa được thanh toán. Bạn có thể thử thanh toán lại.</p>
        {linkToPos}
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 400, margin: "0 auto", textAlign: "center" }}>
      <p>
        {resultParam === "success"
          ? "Đang xác nhận thanh toán..."
          : "Trạng thái: Đang chờ thanh toán."}
      </p>
      <p style={{ fontSize: 14, color: "#666" }}>Trang sẽ tự cập nhật khi có kết quả.</p>
      {linkToPos}
    </div>
  );
}

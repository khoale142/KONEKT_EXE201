import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { showToast } from "../../../shared/components/Toast";
import { memberOrdersApi } from "../api/memberOrders.api";
import { usePaymentStatus } from "../../payment/hooks/usePaymentStatus";
import PendingFlowLeaveGuardModal from "../components/PendingFlowLeaveGuardModal";
import { usePendingFlowLeaveGuard } from "../hooks/usePendingFlowLeaveGuard";

type PaymentQrState = {
  url: string | null;
  expiresAt: string | null;
  amount: number;
  orderRef: string | null;
  content: string | null;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
};

type PaymentSuccessState = {
  success: true;
  mode: "paid";
  orderId: number;
  orderCode: string;
  finalAmount: number;
  earnedPoints: number;
  pointsBalance: number | null;
  paidAt: string | null;
};

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function getPaymentStatusLabel(status: PaymentQrState["status"]) {
  switch (status) {
    case "PAID":
      return "Thanh toán thành công";
    case "FAILED":
      return "Thanh toán thất bại";
    case "EXPIRED":
      return "Mã QR đã hết hạn";
    default:
      return "Chờ thanh toán";
  }
}

export default function MemberResumePaymentPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const orderId = id ? Number(id) : NaN;
  const successHandledRef = useRef(false);
  const paymentEntryState = (location.state as {
    fromCheckout?: boolean;
    orderCode?: string;
    finalAmount?: number;
    earnedPoints?: number;
  } | null) ?? null;

  const [order, setOrder] =
    useState<Awaited<ReturnType<typeof memberOrdersApi.getOrderDetail>>["order"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<PaymentQrState | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [successState, setSuccessState] = useState<PaymentSuccessState | null>(null);

  const leaveGuard = usePendingFlowLeaveGuard({
    enabled: Boolean(!paymentCompleted && order && order.status === "pending" && (resuming || qr?.url)),
  });

  const shouldPollPaymentStatus = Boolean(
    !paymentCompleted && order && order.status === "pending" && qr?.status === "PENDING"
  );

  const { data: paymentStatus } = usePaymentStatus(order?.id ?? null, {
    enabled: shouldPollPaymentStatus,
    refetchInterval: 2000,
  });

  const createSuccessStateFromDetail = (
    detail: Awaited<ReturnType<typeof memberOrdersApi.getOrderDetail>>,
    paidAtFallback?: string | null
  ): PaymentSuccessState => ({
    success: true,
    mode: "paid",
    orderId: detail.order.id,
    orderCode: detail.order.orderCode,
    finalAmount: detail.order.finalAmount,
    earnedPoints: detail.rewardSummary?.earnedPoints ?? paymentEntryState?.earnedPoints ?? 0,
    pointsBalance: detail.rewardSummary?.pointsBalance ?? null,
    paidAt: detail.payments.find((payment) => payment.paidAt)?.paidAt ?? paidAtFallback ?? null,
  });

  const buildPaymentSuccessState = async (
    targetOrderId: number,
    paidAtFallback?: string | null
  ): Promise<PaymentSuccessState> => {
    try {
      const detail = await memberOrdersApi.getOrderDetail(targetOrderId);
      return createSuccessStateFromDetail(detail, paidAtFallback);
    } catch {
      return {
        success: true,
        mode: "paid",
        orderId: targetOrderId,
        orderCode: paymentEntryState?.orderCode ?? order?.orderCode ?? "",
        finalAmount: paymentEntryState?.finalAmount ?? order?.finalAmount ?? 0,
        earnedPoints: paymentEntryState?.earnedPoints ?? 0,
        pointsBalance: null,
        paidAt: paidAtFallback ?? null,
      };
    }
  };

  const handlePaymentSuccess = async (targetOrderId: number, paidAtFallback?: string | null) => {
    if (successHandledRef.current) return;
    successHandledRef.current = true;
    setPaymentCompleted(true);
    showToast("success", "Thanh toán thành công");
    const nextState = await buildPaymentSuccessState(targetOrderId, paidAtFallback);
    setSuccessState(nextState);
  };

  useEffect(() => {
    if (!successState) return;
    navigate(`/customer/orders/${successState.orderId}/payment/success`, {
      replace: true,
      state: successState,
    });
  }, [navigate, successState]);

  useEffect(() => {
    if (!Number.isFinite(orderId)) {
      setError("Mã đơn không hợp lệ.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const res = await memberOrdersApi.getOrderDetail(orderId);
        if (cancelled) return;

        setOrder(res.order);

        if (res.order.status === "paid" || res.order.status === "completed") {
          setPaymentCompleted(true);
          setSuccessState(createSuccessStateFromDetail(res));
          return;
        }

        if (res.order.status !== "pending") {
          navigate(`/customer/orders/${orderId}`, { replace: true });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.message || "Không tải được thông tin thanh toán.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, orderId]);

  useEffect(() => {
    if (!paymentStatus || !order) return;

    if (paymentStatus.status === "PAID") {
      setQr((prev) => (prev ? { ...prev, status: "PAID" } : prev));
      void handlePaymentSuccess(order.id, paymentStatus.paidAt);
      return;
    }

    if (paymentStatus.status === "FAILED" || paymentStatus.status === "EXPIRED") {
      setQr((prev) =>
        prev
          ? {
              ...prev,
              status: paymentStatus.status,
              expiresAt: paymentStatus.expiredAt ?? prev.expiresAt,
            }
          : prev
      );
    }
  }, [order, paymentStatus]);

  const handleResumePayment = async () => {
    if (!order) return;

    successHandledRef.current = false;
    setResuming(true);
    setError("");

    try {
      const res = await memberOrdersApi.resumePayment(order.id);

      if (res.status === "PAID") {
        void handlePaymentSuccess(order.id);
        return;
      }

      if (!res.qrImageUrl) {
        setQr(null);
        setError("Không thể tạo lại mã thanh toán cho đơn hàng này. Vui lòng thử lại sau.");
        return;
      }

      setQr({
        url: res.qrImageUrl,
        expiresAt: res.expiresAt ?? null,
        amount: res.amount,
        orderRef: res.orderRef ?? null,
        content: res.content ?? null,
        status: res.status,
      });
    } catch (e: any) {
      setQr(null);
      setError(e?.response?.data?.message || "Không thể tiếp tục thanh toán cho đơn hàng này. Vui lòng thử lại sau.");
    } finally {
      setResuming(false);
    }
  };

  useEffect(() => {
    if (!order || order.status !== "pending") return;
    void handleResumePayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.status]);

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="cafe-hero">
        <h1 className="cafe-hero-title">Tiếp tục thanh toán</h1>
        <p className="cafe-hero-subtitle">
          Hoàn tất thanh toán để quán tiếp tục xử lý đơn hàng của bạn.
        </p>
      </section>

      <main className="cafe-page-main">
        <div className="cafe-card-elevated" style={{ padding: 28 }}>
          {loading ? (
            <p style={{ margin: 0, color: "var(--cafe-text-muted)" }}>Đang tải thông tin đơn hàng...</p>
          ) : error ? (
            <div>
              <p className="cafe-error" style={{ marginBottom: 16 }}>
                {error}
              </p>
              <div className="cafe-btn-group" style={{ justifyContent: "flex-start", marginTop: 0 }}>
                {order?.status === "pending" ? (
                  <button
                    type="button"
                    className="cafe-btn-primary"
                    onClick={handleResumePayment}
                    disabled={resuming}
                  >
                    {resuming ? "Đang xử lý..." : "Thử lại"}
                  </button>
                ) : null}
                {order ? (
                  <Link
                    to={`/customer/orders/${order.id}`}
                    className="cafe-btn-secondary"
                    style={{ textDecoration: "none" }}
                  >
                    Xem chi tiết đơn
                  </Link>
                ) : (
                  <Link to="/customer" className="cafe-btn-secondary" style={{ textDecoration: "none" }}>
                    Về trang chủ
                  </Link>
                )}
              </div>
            </div>
          ) : order ? (
            <>
              {paymentEntryState?.fromCheckout ? (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "rgba(61, 80, 60, 0.08)",
                    border: "1px solid rgba(61, 80, 60, 0.16)",
                    marginBottom: 20,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--cafe-olive-dark)" }}>
                    Đơn hàng đã được tạo. Vui lòng quét mã QR để hoàn tất thanh toán online.
                  </p>
                </div>
              ) : null}

              <div
                style={{
                  padding: 18,
                  borderRadius: 14,
                  background: "rgba(61, 80, 60, 0.08)",
                  border: "1px solid rgba(61, 80, 60, 0.16)",
                  marginBottom: 20,
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, color: "var(--cafe-olive-dark)" }}>
                  Mã đơn: {order.orderCode}
                </p>
                <p style={{ margin: "6px 0 0", color: "var(--cafe-text-muted)" }}>
                  {order.storeName || "Cửa hàng"} · {formatMoney(paymentEntryState?.finalAmount ?? order.finalAmount)}
                </p>
              </div>

              <p style={{ margin: "0 0 14px", color: "var(--cafe-text-muted)" }}>
                Nếu mã QR cũ đã hết hạn, hệ thống sẽ tự tạo mã mới cho chính đơn hàng này.
              </p>

              {shouldPollPaymentStatus ? (
                <p style={{ margin: "0 0 14px", color: "var(--cafe-text-muted)" }}>
                  Đang chờ xác nhận thanh toán...
                </p>
              ) : null}

              {resuming && !qr?.url ? (
                <p style={{ margin: 0, color: "var(--cafe-text-muted)" }}>Đang chuẩn bị phiên thanh toán...</p>
              ) : qr?.url ? (
                <div style={{ display: "grid", gap: 18 }}>
                  <div style={{ textAlign: "center" }}>
                    <img src={qr.url} alt="VietQR" style={{ width: "100%", maxWidth: 300, borderRadius: 16 }} />
                  </div>

                  <div
                    style={{
                      padding: 18,
                      borderRadius: 16,
                      background: "var(--cafe-cream)",
                      border: "1px solid var(--cafe-cream-dark)",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      <strong>Trạng thái:</strong> {getPaymentStatusLabel(qr.status)}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Số tiền cần thanh toán:</strong> {formatMoney(qr.amount || order.finalAmount)}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Mã đơn hàng:</strong> {paymentEntryState?.orderCode || order.orderCode}
                    </p>
                    {qr.content ? (
                      <p style={{ margin: 0 }}>
                        <strong>Nội dung chuyển khoản:</strong> {qr.content}
                      </p>
                    ) : null}
                    {!qr.content && qr.orderRef ? (
                      <p style={{ margin: 0 }}>
                        <strong>Nội dung chuyển khoản:</strong> {qr.orderRef}
                      </p>
                    ) : null}
                    {qr.expiresAt ? (
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
                        Hết hạn QR: {new Date(qr.expiresAt).toLocaleString("vi-VN")}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : qr?.status === "FAILED" || qr?.status === "EXPIRED" ? (
                <p className="cafe-error" style={{ margin: 0 }}>
                  Mã QR đã hết hạn hoặc thanh toán chưa thành công. Vui lòng tạo lại mã QR để tiếp tục.
                </p>
              ) : null}

              <div className="cafe-btn-group">
                <button type="button" className="cafe-btn-primary" onClick={handleResumePayment} disabled={resuming}>
                  {resuming ? "Đang tạo mã mới..." : "Tạo lại mã QR"}
                </button>
                <Link
                  to={`/customer/orders/${order.id}`}
                  className="cafe-btn-secondary"
                  style={{ textDecoration: "none" }}
                >
                  Xem chi tiết đơn
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </main>

      <CafeFooter />
      <ChatButton />
      <PendingFlowLeaveGuardModal
        open={leaveGuard.open}
        title="Bạn muốn rời khỏi trang thanh toán?"
        description="Đơn hàng của bạn chưa được thanh toán hoàn tất. Nếu thoát ra bây giờ, bạn vẫn có thể tiếp tục thanh toán sau từ trang chủ."
        onStay={leaveGuard.stay}
        onLeave={leaveGuard.leave}
      />
    </div>
  );
}

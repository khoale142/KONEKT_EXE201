import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { memberOrdersApi } from "../api/memberOrders.api";
import { useOnlineCartStore } from "../store/onlineCart.store";
import { resolveCheckoutResultState } from "../utils/checkoutResultStorage";

type PaymentResultLocationState = {
  success?: boolean;
  orderCode?: string;
  finalAmount?: number;
  orderId?: number;
  earnedPoints?: number;
  mode?: "created" | "paid";
  paidAt?: string | null;
  pointsBalance?: number | null;
} | null;

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

export default function MemberPaymentResultPage() {
  const { id } = useParams();
  const location = useLocation();
  const locationState = (location.state as PaymentResultLocationState) ?? null;
  const legacyState = useMemo(
    () =>
      resolveCheckoutResultState(
        locationState as {
          success?: boolean;
          orderCode?: string;
          finalAmount?: number;
          orderId?: number;
          earnedPoints?: number;
        } | null
      ),
    [locationState, location.key]
  );

  const routeOrderId = id ? Number(id) : NaN;
  const isPaidResult = locationState?.mode === "paid" || Number.isFinite(routeOrderId);
  const success = Boolean(locationState?.success ?? legacyState?.success ?? isPaidResult);
  const orderId = Number.isFinite(routeOrderId)
    ? routeOrderId
    : locationState?.orderId ?? legacyState?.orderId;

  const [detail, setDetail] =
    useState<Awaited<ReturnType<typeof memberOrdersApi.getOrderDetail>> | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!success) return;
    useOnlineCartStore.getState().clearCart();
  }, [success]);

  useEffect(() => {
    if (!success || !orderId) return;

    let cancelled = false;
    setLoadingDetail(true);

    (async () => {
      try {
        const res = await memberOrdersApi.getOrderDetail(orderId);
        if (!cancelled) {
          setDetail(res);
        }
      } catch {
        if (!cancelled) {
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, success]);

  const orderCode = detail?.order.orderCode ?? locationState?.orderCode ?? legacyState?.orderCode ?? "";
  const finalAmount =
    detail?.order.finalAmount ?? locationState?.finalAmount ?? legacyState?.finalAmount ?? 0;
  const earnedPoints =
    detail?.rewardSummary?.earnedPoints ??
    locationState?.earnedPoints ??
    legacyState?.earnedPoints ??
    0;
  const pointsBalance =
    detail?.rewardSummary?.pointsBalance ?? locationState?.pointsBalance ?? null;
  const paidAt =
    detail?.payments.find((payment) => payment.paidAt)?.paidAt ??
    locationState?.paidAt ??
    null;

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <main
        style={{
          flex: 1,
          padding: 32,
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div className="cafe-card" style={{ padding: 40 }}>
          {success ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 16, color: "var(--cafe-success)" }}>✓</div>
              <h1 className="cafe-title" style={{ color: "var(--cafe-success)" }}>
                {isPaidResult ? "Thanh toán thành công" : "Đặt hàng thành công"}
              </h1>
              <p className="cafe-subtitle" style={{ marginTop: 8 }}>
                {isPaidResult
                  ? "Đơn hàng của bạn đã được thanh toán thành công."
                  : "Vui lòng hoàn tất chuyển khoản online để quán xử lý đơn."}
              </p>

              {loadingDetail && !detail ? (
                <p style={{ marginTop: 24, color: "var(--cafe-text-muted)" }}>
                  Đang tải thông tin đơn hàng...
                </p>
              ) : (
                <div
                  style={{
                    marginTop: 32,
                    padding: 24,
                    background: "var(--cafe-cream)",
                    borderRadius: 12,
                    textAlign: "left",
                  }}
                >
                  {orderCode ? (
                    <p style={{ margin: "0 0 10px", fontWeight: 600 }}>Mã đơn: {orderCode}</p>
                  ) : null}
                  {finalAmount > 0 ? (
                    <p style={{ margin: "0 0 10px" }}>
                      {isPaidResult ? "Số tiền đã thanh toán" : "Số tiền cần thanh toán"}:{" "}
                      {formatMoney(finalAmount)}
                    </p>
                  ) : null}
                  {isPaidResult && paidAt ? (
                    <p style={{ margin: "0 0 10px" }}>Thời gian thanh toán: {paidAt}</p>
                  ) : null}

                  {isPaidResult ? (
                    <>
                      <p
                        style={{
                          margin: "14px 0 0",
                          color: earnedPoints > 0 ? "var(--cafe-success)" : "var(--cafe-text-muted)",
                          fontWeight: earnedPoints > 0 ? 600 : 500,
                        }}
                      >
                        {earnedPoints > 0
                          ? `Bạn đã được cộng ${earnedPoints} điểm thưởng`
                          : "Điểm thưởng của đơn hàng đã được cập nhật theo chính sách hiện tại"}
                      </p>
                      {pointsBalance != null ? (
                        <p style={{ margin: "10px 0 0", color: "var(--cafe-text-muted)", fontSize: "0.92rem" }}>
                          Tổng điểm hiện tại: {Number(pointsBalance).toLocaleString("vi-VN")} điểm
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p style={{ margin: "14px 0 0", color: "var(--cafe-text-muted)", fontSize: "0.92rem" }}>
                        Điểm tích lũy sẽ được cộng sau khi thanh toán và đơn được xử lý theo quy định quán.
                      </p>
                      <p
                        style={{
                          margin: "10px 0 0",
                          color: earnedPoints > 0 ? "var(--cafe-success)" : "var(--cafe-text-muted)",
                          fontWeight: earnedPoints > 0 ? 600 : 500,
                        }}
                      >
                        {earnedPoints > 0
                          ? `Ước tính +${earnedPoints} điểm sau khi hoàn tất thanh toán`
                          : "Đơn từ 1.000đ trở lên thường được tích điểm sau khi thanh toán"}
                      </p>
                    </>
                  )}
                </div>
              )}

              <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
                {orderId && !isPaidResult ? (
                  <Link
                    to={`/customer/orders/${orderId}/payment`}
                    className="cafe-btn-primary"
                    style={{ padding: 14, textDecoration: "none", textAlign: "center" }}
                  >
                    Mở mã QR - thanh toán ngay
                  </Link>
                ) : null}

                {orderId ? (
                  <Link
                    to={`/customer/orders/${orderId}`}
                    className="cafe-btn-secondary"
                    style={{ padding: 14, textDecoration: "none", textAlign: "center" }}
                  >
                    Xem đơn hàng
                  </Link>
                ) : null}

                {!isPaidResult ? (
                  <Link
                    to="/customer/orders"
                    className="cafe-btn-secondary"
                    style={{ padding: 14, textDecoration: "none", textAlign: "center" }}
                  >
                    Danh sách đơn hàng
                  </Link>
                ) : null}

                <Link
                  to="/customer"
                  className="cafe-btn-secondary"
                  style={{ padding: 14, textDecoration: "none", textAlign: "center" }}
                >
                  Về trang chủ
                </Link>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 16, color: "var(--cafe-error)" }}>✕</div>
              <h1 className="cafe-title">Thanh toán thất bại</h1>
              <p style={{ marginTop: 16, color: "var(--cafe-text-muted)" }}>
                Đã xảy ra lỗi. Vui lòng thử lại.
              </p>
              <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
                <Link
                  to="/customer/order"
                  className="cafe-btn-primary"
                  style={{ padding: 14, textDecoration: "none", textAlign: "center" }}
                >
                  Thử lại
                </Link>
                <Link
                  to="/customer"
                  className="cafe-btn-secondary"
                  style={{ padding: 14, textDecoration: "none", textAlign: "center" }}
                >
                  Về trang chủ
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <CafeFooter />
      <ChatButton />
    </div>
  );
}

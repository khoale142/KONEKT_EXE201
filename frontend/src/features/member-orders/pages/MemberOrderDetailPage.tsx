import { useEffect, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams, useBlocker } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { showToast } from "../../../shared/components/Toast";
import StarRating from "../../../shared/components/StarRating";
import { memberOrdersApi } from "../api/memberOrders.api";
import { useOnlineCartStore } from "../store/onlineCart.store";
import { getPublicMenu } from "../../menu/api/menu.api";
import { getPaymentStatus, initVietqrPayment } from "../../payment/api/payment.api";

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  paid: "Đã thanh toán",
  completed: "Hoàn thành",
  voided: "Đã hủy",
  refunded: "Đã hoàn tiền",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  gateway: "Thanh toán online",
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
};

function getOrderReviewLabel(value: number) {
  if (value >= 4.5) return "Rất hài lòng";
  if (value >= 4.0) return "Hài lòng";
  if (value >= 3.0) return "Ổn";
  if (value >= 2.0) return "Chưa tốt";
  if (value > 0) return "Cần cải thiện";
  return "Chưa đánh giá";
}

function ReviewMetricChip({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        background: "#f6f3ef",
        border: "1px solid #e7ddd1",
        color: "#5a4636",
        fontSize: "0.84rem",
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 700 }}>{value.toFixed(1)}</span>
    </span>
  );
}

export default function MemberOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderId = id ? Number(id) : NaN;

  const [data, setData] = useState<Awaited<ReturnType<typeof memberOrdersApi.getOrderDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewServiceRating, setReviewServiceRating] = useState(0);
  const [reviewFoodRating, setReviewFoodRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [payResumeLoading, setPayResumeLoading] = useState(false);
  const [payQr, setPayQr] = useState<{ url: string | null; expiresAt: string | null; status: string } | null>(null);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [postponeReason, setPostponeReason] = useState("");
  const [postponeTime, setPostponeTime] = useState("");
  const [postponeSubmitting, setPostponeSubmitting] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderMessage, setReorderMessage] = useState<{ type: "ok" | "warn"; text: string } | null>(null);

  const { setStore, addItem } = useOnlineCartStore();

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
        setError(e?.response?.data?.message || "Không tải được chi tiết đơn");
        if (e?.response?.status === 401) navigate("/login/customer", { replace: true });
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, navigate]);

  const canReview = data && data.order.status === "completed";
  const myOrderReview = data?.orderReview ?? null;

  useEffect(() => {
    if (!data || !canReview) return;
    const raw = searchParams.get("rating");
    if (raw == null || raw === "") return;

    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 5) return;

    const stars = Math.min(5, Math.max(1, Math.floor(n)));
    setReviewRating(stars);
    setReviewServiceRating(myOrderReview?.serviceRating ?? stars);
    setReviewFoodRating(myOrderReview?.foodRating ?? stars);
    setReviewComment(myOrderReview?.comment ?? "");
    setShowReviewModal(true);
    setSearchParams({}, { replace: true });
  }, [data, canReview, myOrderReview, searchParams, setSearchParams]);

  useEffect(() => {
    if (!data) return;

    if (data.order.status !== "pending") {
      if (searchParams.get("pay") === "1") setSearchParams({}, { replace: true });
      return;
    }

    const wantPay = searchParams.get("pay") === "1";
    if (!wantPay) return;

    let cancelled = false;

    (async () => {
      setPayResumeLoading(true);
      try {
        const st = await getPaymentStatus(data.order.id);
        if (cancelled) return;

        if (st.status === "PAID") {
          setPayQr(null);
          const res = await memberOrdersApi.getOrderDetail(data.order.id);
          if (!cancelled) setData(res);
          setSearchParams({}, { replace: true });
          return;
        }

        if (st.status === "EXPIRED" || st.status === "FAILED") {
          setPayQr({ url: null, expiresAt: null, status: st.status });
          return;
        }

        const init = await initVietqrPayment(data.order.id);
        if (cancelled) return;

        setPayQr({
          url: init.qrImageUrl,
          expiresAt: init.expiresAt ?? null,
          status: init.status,
        });
      } catch {
        if (!cancelled) setPayQr({ url: null, expiresAt: null, status: "ERROR" });
      } finally {
        if (!cancelled) setPayResumeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, searchParams, setSearchParams]);

  const inUnpaidPaymentFlow =
    data != null &&
    data.order.status === "pending" &&
    (searchParams.get("pay") === "1" || Boolean(payQr?.url) || payResumeLoading);

  const leaveGuardBlocker = useBlocker(inUnpaidPaymentFlow);

  useEffect(() => {
    if (leaveGuardBlocker.state !== "blocked") return;
    const ok = window.confirm(
      "Bạn đang trong bước thanh toán đơn hàng. Rời trang bây giờ? Bạn có thể tiếp tục sau từ Trang khách hoặc mục Đơn hàng."
    );
    if (ok) leaveGuardBlocker.proceed();
    else leaveGuardBlocker.reset();
  }, [leaveGuardBlocker]);

  useEffect(() => {
    if (!inUnpaidPaymentFlow) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [inUnpaidPaymentFlow]);

  const syncOverallFromParts = (svc: number, food: number) => {
    if (svc < 1 || food < 1) return;
    setReviewRating(Math.round((svc + food) / 2));
  };

  const handleOpenReview = () => {
    const r = myOrderReview;
    const overall = r?.rating ?? 0;
    setReviewRating(overall);
    setReviewServiceRating(r?.serviceRating ?? overall);
    setReviewFoodRating(r?.foodRating ?? overall);
    setReviewComment(r?.comment ?? "");
    setShowReviewModal(true);
  };

  const handleCloseReviewModal = () => {
    if (reviewSubmitting) return;
    setShowReviewModal(false);
  };

  const handleSubmitOrderReview = async () => {
    if (!data || reviewRating < 1 || reviewServiceRating < 1 || reviewFoodRating < 1) {
      alert("Vui lòng đánh giá đủ Dịch vụ, Thực phẩm / đồ uống và Tổng thể");
      return;
    }

    setReviewSubmitting(true);
    try {
      const res = await memberOrdersApi.createOrderReview(data.order.id, {
        rating: reviewRating,
        serviceRating: reviewServiceRating,
        foodRating: reviewFoodRating,
        comment: reviewComment.trim(),
      });

      setData((prev) => (prev ? { ...prev, orderReview: res.review } : null));
      setShowReviewModal(false);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message ?? "Gửi đánh giá thất bại");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSubmitPostpone = async () => {
    if (!data) return;
    const reason = postponeReason.trim();
    const expectedArrivalAt = postponeTime.trim();

    if (reason.length < 5) {
      alert("Vui lòng nhập lý do (ít nhất 5 ký tự)");
      return;
    }

    let expectedArrivalDate: Date | null = null;
    if (expectedArrivalAt) {
      expectedArrivalDate = new Date(expectedArrivalAt);
      if (Number.isNaN(expectedArrivalDate.getTime())) {
        alert("Thời điểm dự kiến ghé lấy không hợp lệ");
        return;
      }

      if (expectedArrivalDate.getTime() <= Date.now()) {
        alert("Thời điểm dự kiến ghé lấy phải sau thời điểm hiện tại");
        return;
      }
    }

    setPostponeSubmitting(true);
    try {
      await memberOrdersApi.createPickupPostponeRequest(data.order.id, {
        reason,
        expectedArrivalAt: expectedArrivalDate ? expectedArrivalDate.toISOString() : null,
      });
      setShowPostponeModal(false);
      setPostponeReason("");
      setPostponeTime("");
      const res = await memberOrdersApi.getOrderDetail(data.order.id);
      setData(res);
      alert("Đã gửi thông báo cho quán.");
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Không gửi được thông báo");
    } finally {
      setPostponeSubmitting(false);
    }
  };

  const handleReorder = async () => {
    if (!data) return;
    const { order, items: orderItems } = data;
    const storeId = order.storeId;
    const storeName = order.storeName ?? "Cửa hàng";

    setReorderLoading(true);
    setReorderMessage(null);

    try {
      const menuRes = await getPublicMenu();
      const variantMap = new Map<number, { productName: string; size: string; price: number; isSoldOut?: boolean }>();

      for (const cat of menuRes.categories || []) {
        for (const p of cat.products || []) {
          for (const v of p.variants || []) {
            variantMap.set(v.id, {
              productName: p.name ?? "Món",
              size: v.size ?? "",
              price: v.price ?? 0,
              isSoldOut: (p as any).isSoldOut,
            });
          }
        }
      }

      setStore(storeId, storeName);
      const added: string[] = [];
      const skipped: string[] = [];

      for (const it of orderItems) {
        const variant = variantMap.get(it.productVariantId);
        if (!variant) {
          skipped.push(`${it.productName} ${it.variantSize} (không còn trong thực đơn)`);
          continue;
        }

        if (variant.isSoldOut) {
          skipped.push(`${variant.productName} ${variant.size} (hết món)`);
          continue;
        }

        addItem({
          productVariantId: it.productVariantId,
          productName: variant.productName,
          size: variant.size,
          price: variant.price,
          quantity: it.quantity,
          note: it.note ?? undefined,
        });

        added.push(`${variant.productName} ${variant.size} × ${it.quantity}`);
      }

      if (added.length > 0) {
        const skippedMsg = skipped.length > 0 ? " Một số món không còn: " + skipped.join("; ") : "";
        navigate("/customer/order/cart", {
          state: { reorderInfo: `Đã thêm ${added.length} món vào giỏ.${skippedMsg}` },
        });
      } else {
        setReorderMessage({
          type: "warn",
          text: skipped.length > 0 ? "Không thể thêm món nào: " + skipped.join("; ") : "Đơn không có món nào khả dụng.",
        });
      }
    } catch {
      setReorderMessage({ type: "warn", text: "Không thể tải thực đơn. Vui lòng thử lại." });
    } finally {
      setReorderLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
          <p style={{ color: "var(--cafe-text-muted)" }}>Đang tải...</p>
        </main>
        <CafeFooter />
        <ChatButton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main style={{ flex: 1, padding: 32, maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <p className="cafe-error">{error || "Không tìm thấy đơn hàng"}</p>
          <Link to="/customer/orders" className="cafe-link" style={{ marginTop: 16, display: "inline-block" }}>
            ← Danh sách đơn hàng
          </Link>
        </main>
        <CafeFooter />
        <ChatButton />
      </div>
    );
  }

  const { order, items, payments, discountApplications = [] } = data;
  const pickupDelayNotice = data.pickupDelayNotice ?? data.pickupPostpone?.latestNotice ?? null;
  const isOnlinePickupOrder = payments.some((payment) => String(payment.method || "").toLowerCase() === "gateway");
  const canSendPickupDelayNotice =
    order.status === "paid" && order.pickupNumber == null && isOnlinePickupOrder && !pickupDelayNotice;

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="cafe-hero">
        <h1 className="cafe-hero-title">Chi tiết đơn hàng</h1>
        <p className="cafe-hero-subtitle">{order.orderCode}</p>
      </section>

      <main style={{ flex: 1, padding: 32, maxWidth: 600, margin: "0 auto", width: "100%" }}>
        <div className="cafe-card" style={{ padding: 24 }}>
          {order.status === "pending" && (
            <div
              style={{
                marginBottom: 20,
                padding: 16,
                borderRadius: 12,
                background: "rgba(61, 80, 60, 0.08)",
                border: "1px solid rgba(61, 80, 60, 0.2)",
              }}
            >
              <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Đơn chưa hoàn tất thanh toán</p>
              <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--cafe-text-muted)" }}>
                Bạn có thể mở lại mã QR để chuyển khoản (nếu còn hạn).
              </p>

              {payResumeLoading ? (
                <p style={{ margin: 0, fontSize: "0.9rem" }}>Đang tải trạng thái thanh toán...</p>
              ) : payQr?.url ? (
                <div style={{ textAlign: "center" }}>
                  <img src={payQr.url} alt="VietQR" style={{ maxWidth: 260, borderRadius: 12 }} />
                  {payQr.expiresAt && (
                    <p style={{ marginTop: 8, fontSize: "0.85rem", color: "var(--cafe-text-muted)" }}>
                      Hết hạn QR: {new Date(payQr.expiresAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>
              ) : payQr?.status === "EXPIRED" || payQr?.status === "FAILED" || payQr?.status === "ERROR" ? (
                <p className="cafe-error" style={{ margin: 0 }}>
                  Liên kết thanh toán đã hết hạn hoặc lỗi. Vui lòng liên hệ quán hoặc đặt đơn mới.
                </p>
              ) : (
                <Link
                  to={`/customer/orders/${order.id}/payment`}
                  className="cafe-btn-primary"
                  style={{ display: "inline-block", padding: "10px 18px", textDecoration: "none" }}
                >
                  Tiếp tục thanh toán
                </Link>
              )}
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <p>
              <strong>Cửa hàng:</strong> {order.storeName}
            </p>
            {order.storeAddress && (
              <p style={{ margin: "4px 0 0", color: "var(--cafe-text-muted)" }}>{order.storeAddress}</p>
            )}
            <p style={{ marginTop: 12 }}>
              <strong>Trạng thái:</strong> {STATUS_LABEL[order.status] || order.status}
            </p>
            <p>
              <strong>Ngày đặt:</strong> {order.createdAt || "-"}
            </p>
            {order.pickupNumber && (
              <p>
                <strong>Số thứ tự lấy hàng:</strong> {order.pickupNumber}
              </p>
            )}
            {order.specialNote && order.specialNote.trim() && (
              <p style={{ marginTop: 8 }}>
                <strong>Ghi chú đơn hàng:</strong> {order.specialNote}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12 }}>Sản phẩm</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((item) => {
                const isGiftItem = Number(item.unitPrice) === 0;

                return (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      padding: "12px 0",
                      borderBottom: "1px solid var(--cafe-cream)",
                      color: isGiftItem ? "var(--cafe-success)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {isGiftItem && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 10px",
                              borderRadius: 999,
                              background: "rgba(77, 124, 15, 0.12)",
                              color: "var(--cafe-success)",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              lineHeight: 1.4,
                            }}
                          >
                            🎁 Món tặng
                          </span>
                        )}
                        <span>
                          {item.productName} {item.variantSize} × {item.quantity}
                        </span>
                      </span>

                      {item.note && item.note.trim() ? (
                        <span style={{ color: "var(--cafe-text-muted)", fontSize: "0.85rem" }}>
                          Ghi chú: {item.note}
                        </span>
                      ) : null}
                    </div>

                    <span style={{ color: isGiftItem ? "var(--cafe-success)" : undefined }}>
                      {(item.unitPrice * item.quantity).toLocaleString("vi-VN")}đ
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <span>Tạm tính</span>
              <span>{order.totalAmount.toLocaleString("vi-VN")}đ</span>
            </div>

            {discountApplications.length > 0 &&
              discountApplications.map((d, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    color: "var(--cafe-success)",
                  }}
                >
                  <span>
                    Giảm {d.sourceType === "VOUCHER" ? "voucher" : "khuyến mãi"}
                    {d.sourceName ? ` (${d.sourceName})` : ""}
                  </span>
                  <span>-{d.discountAmount.toLocaleString("vi-VN")}đ</span>
                </div>
              ))}

            {order.discountAmount > 0 && discountApplications.length === 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  color: "var(--cafe-success)",
                }}
              >
                <span>Giảm giá</span>
                <span>-{order.discountAmount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "16px 0",
                fontWeight: 600,
                fontSize: "1.1rem",
              }}
            >
              <span>Tổng thanh toán</span>
              <span>{order.finalAmount.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>

          {payments.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 8 }}>Phương thức thanh toán</h3>
              {payments.map((p, idx) => (
                <p key={idx} style={{ margin: "4px 0", fontSize: "0.9rem" }}>
                  {PAYMENT_METHOD_LABEL[p.method?.toLowerCase()] || p.method} - {p.amount.toLocaleString("vi-VN")}đ
                  {p.referenceCode && ` (${p.referenceCode})`}
                </p>
              ))}
            </div>
          )}

          {pickupDelayNotice && (
            <div
              style={{
                marginBottom: 24,
                padding: 16,
                borderRadius: 16,
                background: "rgba(180, 138, 63, 0.08)",
                border: "1px solid rgba(180, 138, 63, 0.22)",
              }}
            >
              <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#6f4f1f" }}>Bạn đã báo bận cho quán</p>
              <p style={{ margin: 0, color: "var(--cafe-text-muted)", fontSize: "0.92rem" }}>
                Quán sẽ ghi nhận thông tin này khi xác nhận đơn.
              </p>
              <p style={{ margin: "10px 0 0", fontSize: "0.92rem" }}>
                <strong>Lý do:</strong> {pickupDelayNotice.reason}
              </p>
              {pickupDelayNotice.expectedArrivalAt ? (
                <p style={{ margin: "6px 0 0", fontSize: "0.92rem" }}>
                  <strong>Dự kiến ghé lấy:</strong> {pickupDelayNotice.expectedArrivalAt}
                </p>
              ) : null}
              <p style={{ margin: "6px 0 0", fontSize: "0.92rem" }}>
                <strong>Gửi lúc:</strong> {pickupDelayNotice.createdAt}
              </p>
            </div>
          )}

          {canSendPickupDelayNotice && (
            <div style={{ marginBottom: 24 }}>
              <button
                type="button"
                className="cafe-btn-secondary"
                onClick={() => setShowPostponeModal(true)}
                style={{ width: "100%", padding: 12 }}
              >
                Báo bận / hoãn đến lấy
              </button>
            </div>
          )}

          {canReview && (
            <div style={{ marginBottom: 24, paddingTop: 24, borderTop: "1px solid var(--cafe-cream)" }}>
              <h3 style={{ marginBottom: 12 }}>Đánh giá đơn hàng</h3>

              {myOrderReview ? (
                <div
                  style={{
                    padding: 16,
                    background: "#fff",
                    borderRadius: 16,
                    border: "1px solid #ece3d8",
                    boxShadow: "0 8px 24px rgba(92, 70, 53, 0.05)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <StarRating rating={myOrderReview.rating} size={20} />
                    <span style={{ fontWeight: 600 }}>{getOrderReviewLabel(myOrderReview.rating)}</span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    <ReviewMetricChip label="Dịch vụ" value={myOrderReview.serviceRating} />
                    <ReviewMetricChip label="Thực phẩm / đồ uống" value={myOrderReview.foodRating} />
                  </div>

                  {myOrderReview.comment && (
                    <p style={{ margin: "12px 0 0", fontSize: "0.92rem", color: "var(--cafe-text-muted)", lineHeight: 1.6 }}>
                      {myOrderReview.comment}
                    </p>
                  )}

                  <button
                    type="button"
                    className="cafe-btn-secondary"
                    onClick={handleOpenReview}
                    style={{ marginTop: 14, padding: "8px 16px" }}
                  >
                    Sửa đánh giá
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="cafe-btn-primary"
                  onClick={handleOpenReview}
                  style={{ padding: "10px 20px" }}
                >
                  Đánh giá đơn hàng này
                </button>
              )}
            </div>
          )}

          {order.status === "completed" && (
            <div style={{ marginBottom: 24, paddingTop: 24, borderTop: "1px solid var(--cafe-cream)" }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <Link
                  to={`/customer/orders/${order.id}/issue`}
                  className="cafe-btn-secondary"
                  style={{ textDecoration: "none", padding: "10px 16px" }}
                >
                  Gửi phản ánh đơn hàng
                </Link>

                <Link to="/customer/issues" className="cafe-link" style={{ alignSelf: "center" }}>
                  Xem phản ánh của tôi
                </Link>
              </div>

              <button
                type="button"
                className="cafe-btn-secondary"
                onClick={handleReorder}
                disabled={reorderLoading}
                style={{ width: "100%", padding: 12 }}
              >
                {reorderLoading ? "Đang xử lý..." : "Đặt lại đơn này"}
              </button>

              {reorderMessage && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: "0.9rem",
                    color: reorderMessage.type === "ok" ? "var(--cafe-success)" : "var(--cafe-error)",
                  }}
                >
                  {reorderMessage.text}
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Link to="/customer/order" className="cafe-btn-primary" style={{ padding: "12px 24px", textDecoration: "none" }}>
            Đặt hàng ngay
          </Link>
          <Link to="/customer/orders" className="cafe-link">
            ← Danh sách đơn hàng
          </Link>
        </div>
      </main>

      <CafeFooter />
      <ChatButton />

      {showReviewModal && (
        <div
          onClick={handleCloseReviewModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#fff",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            }}
          >
            <h2 style={{ margin: 0, marginBottom: 20, fontSize: "1.8rem", color: "#2f2a26" }}>
              Đánh giá đơn hàng
            </h2>

            <p style={{ margin: "0 0 16px", color: "var(--cafe-text-muted)", fontSize: "0.92rem" }}>
              Đánh giá này chỉ áp dụng cho đơn mang về, tách biệt với đánh giá cửa hàng.
            </p>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Dịch vụ</div>
              <StarRating
                rating={reviewServiceRating}
                setRating={(n) => {
                  setReviewServiceRating(n);
                  syncOverallFromParts(n, reviewFoodRating);
                }}
                size={28}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Thực phẩm / đồ uống</div>
              <StarRating
                rating={reviewFoodRating}
                setRating={(n) => {
                  setReviewFoodRating(n);
                  syncOverallFromParts(reviewServiceRating, n);
                }}
                size={28}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>
                Tổng thể (gợi ý từ 2 tiêu chí, có thể chỉnh ±1 sao)
              </div>
              <StarRating rating={reviewRating} setRating={setReviewRating} size={30} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Nội dung đánh giá</div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm của bạn..."
                className="cafe-input"
                style={{
                  width: "100%",
                  minHeight: 110,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="cafe-btn-secondary"
                onClick={handleCloseReviewModal}
                disabled={reviewSubmitting}
                style={{ minWidth: 110 }}
              >
                Hủy
              </button>

              <button
                type="button"
                className="cafe-btn-primary"
                onClick={handleSubmitOrderReview}
                disabled={reviewSubmitting}
                style={{ minWidth: 150 }}
              >
                {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPostponeModal && (
        <div
          onClick={() => !postponeSubmitting && setShowPostponeModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#fff",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            }}
          >
            <h2 style={{ margin: 0, marginBottom: 16 }}>Báo bận / hoãn đến lấy</h2>

            <p style={{ margin: "0 0 16px", color: "var(--cafe-text-muted)", fontSize: "0.92rem", lineHeight: 1.6 }}>
              Nếu bạn chưa thể đến lấy ngay, hãy báo cho quán biết. Quán sẽ ghi nhận thông tin này khi xác nhận đơn.
            </p>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Lý do</div>
              <textarea
                value={postponeReason}
                onChange={(e) => setPostponeReason(e.target.value)}
                className="cafe-input"
                placeholder="Ví dụ: Tôi đang bận việc, sẽ ghé lấy sau một chút."
                style={{ width: "100%", minHeight: 100, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Thời điểm dự kiến ghé lấy (nếu có)</div>
              <input
                type="datetime-local"
                value={postponeTime}
                onChange={(e) => setPostponeTime(e.target.value)}
                className="cafe-input"
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="cafe-btn-secondary"
                onClick={() => setShowPostponeModal(false)}
                disabled={postponeSubmitting}
              >
                Hủy
              </button>

              <button
                type="button"
                className="cafe-btn-primary"
                onClick={handleSubmitPostpone}
                disabled={postponeSubmitting}
              >
                {postponeSubmitting ? "Đang gửi..." : "Gửi thông báo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

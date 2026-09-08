import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { useOnlineCartStore, useCurrentStoreItems, useCurrentStoreCombos } from "../store/onlineCart.store";
import { getStoreDetail } from "../../stores/api/stores.api";
import { memberOrdersApi } from "../api/memberOrders.api";
import type { MemberAppliedComboRule } from "../api/memberOrders.api";
import { memberApi } from "../../member/api/member.api";
import PendingFlowLeaveGuardModal from "../components/PendingFlowLeaveGuardModal";
import { usePendingFlowLeaveGuard } from "../hooks/usePendingFlowLeaveGuard";

type SelectedGiftItem = {
  productVariantId: number;
  quantity: number;
  note?: string;
};

type GiftSelectableVariant = {
  productVariantId: number;
  productName: string;
  size: string;
  price: number;
};

type GiftSelectionState = {
  required: boolean;
  ruleId: number | null;
  expectedQty: number;
  eligibleVariants: GiftSelectableVariant[];
} | null;

export default function MemberCheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const checkoutState = location.state as {
    voucherCode?: string;
    promotionCode?: string;
    appliedComboRules?: MemberAppliedComboRule[];
    selectedGiftItems?: SelectedGiftItem[];
  } | null;

  const voucherCodeFromCart = checkoutState?.voucherCode;
  const promotionCodeFromCart = checkoutState?.promotionCode;
  const appliedComboRulesFromCart = checkoutState?.appliedComboRules || [];
  const selectedGiftItemsFromCart = checkoutState?.selectedGiftItems || [];

  const { storeId, storeName, getItemsForApi, getCombosForApi, clearCart } = useOnlineCartStore();
  const items = useCurrentStoreItems();
  const combos = useCurrentStoreCombos();
  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    fullName: "",
    phone: "",
  });
  const [pricing, setPricing] = useState<{
    subtotalAmount: number;
    promotionDiscountAmount: number;
    voucherDiscountAmount: number;
    totalDiscountAmount: number;
    finalAmount: number;
    offerValidation?: {
      sourceType: "PROMOTION" | "VOUCHER";
      isEligible: boolean;
      status: "APPLIED" | "INELIGIBLE" | "GIFT_SELECTION_REQUIRED";
      message: string;
    } | null;
    appliedVoucher?: { rewardName: string; voucherCode: string } | null;
    appliedPromotion?: { name: string; code: string } | null;
    giftSelection?: GiftSelectionState;
  } | null>(null);

  const shouldGuardLeaving =
    !redirectingToPayment &&
    !loading &&
    Boolean(storeId) &&
    (items.length > 0 || combos.length > 0);
  const leaveGuard = usePendingFlowLeaveGuard({ enabled: shouldGuardLeaving });

  useEffect(() => {
    if (redirectingToPayment) return;
    if (!storeId || (items.length === 0 && combos.length === 0)) {
      navigate("/customer/order", { replace: true });
      return;
    }
  }, [redirectingToPayment, storeId, items.length, combos.length, navigate]);

  useEffect(() => {
    if (!storeId) return;
    getStoreDetail(String(storeId))
      .then((s) => setStoreAddress(s?.address ?? null))
      .catch(() => setStoreAddress(null));
  }, [storeId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await memberApi.getProfile();
        const c = (res as { customer?: { fullName?: string; phone?: string } })?.customer;
        if (c) {
          setCustomerInfo({
            fullName: c.fullName ?? "",
            phone: (c.phone ?? "").replace(/\D/g, "").slice(0, 10),
          });
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (!storeId || (items.length === 0 && combos.length === 0)) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await memberOrdersApi.previewPricing({
          storeId,
          voucherCode: voucherCodeFromCart || undefined,
          promotionCode: promotionCodeFromCart || undefined,
          selectedGiftItems: selectedGiftItemsFromCart,
          items: getItemsForApi(),
          combos: getCombosForApi(),
          appliedComboRules: appliedComboRulesFromCart,
        });

        if (!cancelled) {
          setPricing({
            ...res.pricing,
            appliedVoucher: res.pricing.appliedVoucher ?? null,
            appliedPromotion: res.pricing.appliedPromotion ?? null,
            giftSelection: res.pricing.giftSelection ?? null,
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setPricing(null);
          setError(e?.response?.data?.message || "Không tính được giá");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [
    storeId,
    items,
    combos,
    voucherCodeFromCart,
    promotionCodeFromCart,
    appliedComboRulesFromCart,
    selectedGiftItemsFromCart,
    getCombosForApi,
    getItemsForApi,
  ]);

  const selectedGiftVariantDetails = useMemo(() => {
    if (!pricing?.giftSelection || selectedGiftItemsFromCart.length === 0) return [];

    const byId = new Map(
      pricing.giftSelection.eligibleVariants.map((variant) => [
        variant.productVariantId,
        variant,
      ]),
    );

    return selectedGiftItemsFromCart
      .map((item) => {
        const variant = byId.get(item.productVariantId);
        if (!variant) return null;

        return {
          ...item,
          productName: variant.productName,
          size: variant.size,
          price: variant.price,
        };
      })
      .filter(Boolean) as Array<{
      productVariantId: number;
      quantity: number;
      note?: string;
      productName: string;
      size: string;
      price: number;
    }>;
  }, [pricing?.giftSelection, selectedGiftItemsFromCart]);

  const offerValidation = pricing?.offerValidation ?? null;
  const hasOfferEligibilityError = !!offerValidation && !offerValidation.isEligible;
  const requiresGiftSelection = !!pricing?.giftSelection?.required;

  const handlePayOnline = async () => {
    const name = customerInfo.fullName.trim();
    const phone = customerInfo.phone.trim();

    if (!name) {
      setError("Vui lòng nhập họ tên");
      return;
    }
    if (!phone) {
      setError("Vui lòng nhập số điện thoại");
      return;
    }
    if (phone.length < 10) {
      setError("Số điện thoại không hợp lệ");
      return;
    }
    if (hasOfferEligibilityError) {
      setError(offerValidation?.message || "Mã ưu đãi hiện chưa đủ điều kiện áp dụng");
      return;
    }
    if (requiresGiftSelection) {
      setError(
        offerValidation?.message ||
          "Ưu đãi này cần chọn món tặng trước khi thanh toán",
      );
      return;
    }
    if (!storeId || !pricing) return;

    setError("");
    setLoading(true);

    try {
      const res = await memberOrdersApi.createOrder({
        storeId,
        voucherCode: voucherCodeFromCart || undefined,
        promotionCode: promotionCodeFromCart || undefined,
        selectedGiftItems: selectedGiftItemsFromCart,
        items: getItemsForApi(),
        combos: getCombosForApi(),
        appliedComboRules: appliedComboRulesFromCart,
        paymentReferenceCode: `MEMBER-ONLINE-${Date.now()}`,
      });

      setRedirectingToPayment(true);
      navigate(`/customer/orders/${res.order.id}/payment`, {
        replace: true,
        state: {
          fromCheckout: true,
          orderCode: res.order.orderCode,
          finalAmount: res.order.finalAmount,
          orderId: res.order.id,
          earnedPoints: res.earnedPoints ?? 0,
        },
      });
      clearCart();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Đặt hàng thất bại");
    } finally {
      setLoading(false);
    }
  };

  if (!storeId || (items.length === 0 && combos.length === 0)) return null;

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="order-hero">
        <h1 className="order-hero__title">Thanh toán</h1>
        <div className="order-hero__store-card">
          <div className="order-hero__store-info">
            <p className="order-hero__store-name">📍 {storeName}</p>
            {storeAddress && <p className="order-hero__store-address">{storeAddress}</p>}
          </div>
        </div>
      </section>

      <main className="cafe-page-main">
        <div className="cafe-info-box">
          <h3 className="cafe-info-box-title">✓ Xác nhận đặt hàng</h3>
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: "0.9rem", color: "var(--cafe-olive-dark)" }}>
              Lưu ý đặt hàng:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.9rem", lineHeight: 1.8, color: "var(--cafe-text)" }}>
              <li>Khách hàng cần <strong>tự đến lấy</strong> đơn tại cửa hàng.</li>
              <li>Sau khi đặt xong, hãy <strong>đưa đơn hàng đã đặt</strong> (mã đơn) cho nhân viên.</li>
              <li>Nhận <strong>số/thứ tự</strong> từ nhân viên.</li>
              <li>Sau đó nhân viên mới bắt đầu làm món.</li>
            </ul>
          </div>
        </div>

        <div className="cafe-card-elevated" style={{ padding: 28 }}>
          {error && (
            <p className="cafe-error" style={{ marginBottom: 16 }}>
              {error}
            </p>
          )}

          {loading && !pricing ? (
            <p style={{ color: "var(--cafe-text-muted)", padding: 20 }}>Đang tính giá...</p>
          ) : pricing ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <h3 className="cafe-section-heading">Thông tin nhận hàng</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label className="cafe-label" style={{ display: "block", marginBottom: 8 }}>
                      Họ và tên <span style={{ color: "var(--cafe-error)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={customerInfo.fullName}
                      onChange={(e) => setCustomerInfo((s) => ({ ...s, fullName: e.target.value }))}
                      placeholder="Nhập họ tên"
                      className="cafe-input"
                      style={{ width: "100%", padding: "14px 16px" }}
                    />
                  </div>
                  <div>
                    <label className="cafe-label" style={{ display: "block", marginBottom: 8 }}>
                      Số điện thoại <span style={{ color: "var(--cafe-error)" }}>*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo((s) => ({ ...s, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                      placeholder="Nhập số điện thoại"
                      className="cafe-input"
                      style={{ width: "100%", padding: "14px 16px" }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 28, paddingTop: 28, borderTop: "1px solid var(--cafe-cream-dark)" }}>
                <h3 className="cafe-section-heading">Đơn hàng</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {items.map((i) => (
                    <li
                      key={i.productVariantId}
                      style={{
                        padding: "14px 0",
                        borderBottom: "1px solid var(--cafe-cream-dark)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <span>
                          {i.productName} {i.size} × {i.quantity}
                        </span>
                        <span style={{ flexShrink: 0 }}>{(i.price * i.quantity).toLocaleString("vi-VN")}đ</span>
                      </div>
                      {i.note?.trim() ? (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: "0.85rem",
                            color: "var(--cafe-text-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          Ghi chú: {i.note.trim()}
                        </p>
                      ) : null}
                    </li>
                  ))}

                  {combos.map((c) => (
                    <li
                      key={`combo-${c.comboId}`}
                      style={{
                        padding: "14px 0",
                        borderBottom: "1px solid var(--cafe-cream-dark)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <span>Combo: {c.comboName} × {c.quantity}</span>
                        <span style={{ flexShrink: 0 }}>{(c.comboPrice * c.quantity).toLocaleString("vi-VN")}đ</span>
                      </div>
                    </li>
                  ))}

                  {selectedGiftVariantDetails.map((gift) => (
                    <li
                      key={`gift-${gift.productVariantId}`}
                      style={{
                        padding: "14px 0",
                        borderBottom: "1px solid var(--cafe-cream-dark)",
                        color: "var(--cafe-success)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                          <span>🎁 {gift.productName} {gift.size} × {gift.quantity}</span>
                          <div style={{ marginTop: 4, fontSize: "0.82rem", color: "var(--cafe-text-muted)" }}>
                            Giá niêm yết: {gift.price.toLocaleString("vi-VN")}đ
                          </div>
                        </div>
                        <span style={{ flexShrink: 0 }}>0đ</span>
                      </div>
                    </li>
                  ))}

                  {selectedGiftVariantDetails.length === 0 &&
                    selectedGiftItemsFromCart.map((gift, index) => (
                      <li
                        key={`gift-fallback-${gift.productVariantId}-${index}`}
                        style={{
                          padding: "14px 0",
                          borderBottom: "1px solid var(--cafe-cream-dark)",
                          color: "var(--cafe-success)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <span>🎁 Món được tặng × {gift.quantity}</span>
                          <span style={{ flexShrink: 0 }}>0đ</span>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>

              <div style={{ marginBottom: 24, padding: "20px 0", borderTop: "1px solid var(--cafe-cream-dark)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "0.95rem" }}>
                  <span>Tạm tính</span>
                  <span>{pricing.subtotalAmount.toLocaleString("vi-VN")}đ</span>
                </div>

                {pricing.promotionDiscountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", color: "var(--cafe-success)", fontSize: "0.95rem" }}>
                    <span>Giảm khuyến mãi{pricing.appliedPromotion ? ` (${pricing.appliedPromotion.name})` : ""}</span>
                    <span>-{pricing.promotionDiscountAmount.toLocaleString("vi-VN")}đ</span>
                  </div>
                )}

                {pricing.voucherDiscountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", color: "var(--cafe-success)", fontSize: "0.95rem" }}>
                    <span>Giảm voucher{pricing.appliedVoucher ? ` (${pricing.appliedVoucher.rewardName})` : ""}</span>
                    <span>-{pricing.voucherDiscountAmount.toLocaleString("vi-VN")}đ</span>
                  </div>
                )}

                {offerValidation?.message ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: !offerValidation.isEligible
                        ? "rgba(220, 38, 38, 0.08)"
                        : offerValidation.status === "GIFT_SELECTION_REQUIRED"
                          ? "rgba(146, 64, 14, 0.08)"
                          : "rgba(22, 163, 74, 0.08)",
                      color: !offerValidation.isEligible
                        ? "var(--cafe-error)"
                        : offerValidation.status === "GIFT_SELECTION_REQUIRED"
                          ? "var(--cafe-brown)"
                          : "var(--cafe-success)",
                      fontSize: "0.9rem",
                      fontWeight: offerValidation.isEligible ? 600 : 700,
                    }}
                  >
                    {offerValidation.message}
                  </div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "18px 0 12px",
                    fontWeight: 700,
                    fontSize: "1.2rem",
                    color: "var(--cafe-olive-dark)",
                  }}
                >
                  <span>Tổng thanh toán</span>
                  <span>{pricing.finalAmount.toLocaleString("vi-VN")}đ</span>
                </div>

                {Math.floor(pricing.finalAmount / 1000) > 0 && (
                  <p style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--cafe-success)", fontWeight: 600 }}>
                    ✨ Bạn sẽ được cộng {Math.floor(pricing.finalAmount / 1000)} điểm
                  </p>
                )}

                <p style={{ fontSize: "0.88rem", marginTop: 4 }}>
                  <Link to="/customer/vouchers" state={{ returnTo: "/customer/order/checkout" }} className="cafe-link">
                    Đổi điểm lấy voucher / Xem kho voucher →
                  </Link>
                </p>
              </div>

              <button
                type="button"
                className="cafe-btn-primary cafe-btn-cta"
                style={{ width: "100%", padding: "16px 24px", fontSize: "1.05rem" }}
                onClick={handlePayOnline}
                disabled={loading || hasOfferEligibilityError || requiresGiftSelection}
              >
                {loading
                  ? "Đang xử lý..."
                  : hasOfferEligibilityError
                    ? "Mã ưu đãi chưa đủ điều kiện"
                    : requiresGiftSelection
                      ? "Cần chọn món tặng trước"
                      : "Thanh toán online"}
              </button>
            </>
          ) : null}
        </div>
      </main>

      <CafeFooter />
      <ChatButton />

      <PendingFlowLeaveGuardModal
        open={leaveGuard.open}
        title="Bạn có chắc muốn thoát?"
        description="Đơn hàng của bạn đang ở bước xác nhận và chưa thanh toán xong. Nếu thoát ra bây giờ, bạn sẽ cần quay lại để hoàn tất thanh toán."
        onStay={leaveGuard.stay}
        onLeave={leaveGuard.leave}
      />
    </div>
  );
}

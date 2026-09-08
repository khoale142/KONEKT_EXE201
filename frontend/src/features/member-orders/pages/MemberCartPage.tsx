import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { useOnlineCartStore, useCurrentStoreItems, useCurrentStoreCombos } from "../store/onlineCart.store";
import { getStoreDetail } from "../../stores/api/stores.api";
import { memberApi, type CustomerPromotion, type CustomerVoucher } from "../../member/api/member.api";
import { memberOrdersApi, type MemberAppliedComboRule, type MemberComboRulePreview } from "../api/memberOrders.api";

function formatVnDate(v?: string | null) {
  if (!v) return "";
  try {
    return new Date(v).toLocaleDateString("vi-VN");
  } catch {
    return v;
  }
}

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

type SelectedGiftItem = {
  productVariantId: number;
  quantity: number;
  note?: string;
};

export default function MemberCartPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reorderInfo = (location.state as { reorderInfo?: string })?.reorderInfo;
  const {
    storeId,
    storeName,
    updateQuantity,
    updateComboQuantity,
    updateNote,
    removeItem,
    removeCombo,
    getItemsForApi,
    getCombosForApi,
  } =
    useOnlineCartStore();
  const items = useCurrentStoreItems();
  const combos = useCurrentStoreCombos();
  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [promotions, setPromotions] = useState<CustomerPromotion[]>([]);
  const [vouchers, setVouchers] = useState<CustomerVoucher[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offerDropdownOpen, setOfferDropdownOpen] = useState(false);
  const offerDropdownRef = useRef<HTMLDivElement>(null);
  /** "" | promo-{id} | vch-{id} */
  const [selectedOffer, setSelectedOffer] = useState("");
  const [previewPricing, setPreviewPricing] = useState<{
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
    giftSelection?: GiftSelectionState;
  } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [autoAppliedComboRules, setAutoAppliedComboRules] = useState<MemberAppliedComboRule[]>([]);
  const [autoComboLabel, setAutoComboLabel] = useState("");
  const [giftSelection, setGiftSelection] = useState<GiftSelectionState>(null);
  const [selectedGiftItems, setSelectedGiftItems] = useState<SelectedGiftItem[]>([]);

  useEffect(() => {
    if (!storeId || (items.length === 0 && combos.length === 0)) {
      navigate("/customer/order", { replace: true });
    }
  }, [storeId, items.length, combos.length, navigate]);

  useEffect(() => {
    if (!storeId) return;
    getStoreDetail(String(storeId))
      .then((s) => setStoreAddress(s?.address ?? null))
      .catch(() => setStoreAddress(null));
  }, [storeId]);

  const handleChangeStore = () => {
    navigate("/customer/order", { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOffersLoading(true);
      try {
        const [promoRes, vchRes] = await Promise.all([
          memberApi.getPublicPromotions().catch(() => ({ promotions: [] as CustomerPromotion[] })),
          memberApi.getMyVouchers().catch(() => ({ vouchers: [] as CustomerVoucher[] })),
        ]);
        if (cancelled) return;
        setPromotions(promoRes.promotions ?? []);
        const issued = (vchRes.vouchers ?? []).filter((v) => String(v.status).toUpperCase() === "ISSUED");
        setVouchers(issued);
      } finally {
        if (!cancelled) setOffersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (selectedOffer || items.length === 0) {
      setAutoAppliedComboRules([]);
      setAutoComboLabel("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await memberOrdersApi.previewComboRules(
          items.map((i) => ({
            productVariantId: i.productVariantId,
            quantity: i.quantity,
          }))
        );
        if (cancelled) return;
        const ranked: Array<{
          rule: MemberComboRulePreview;
          application: MemberComboRulePreview["applications"][number];
          saving: number;
        }> = [];
        for (const rule of res.eligibleRules || []) {
          for (const app of rule.applications || []) {
            const original = (app.selectedItems || []).reduce((s, x) => s + Number(x.unitPrice || 0), 0);
            const saving = Math.max(0, original - Number(rule.comboPrice || 0));
            if (saving > 0) ranked.push({ rule, application: app, saving });
          }
        }
        ranked.sort((a, b) => b.saving - a.saving);
        const best = ranked[0];
        if (!best) {
          setAutoAppliedComboRules([]);
          setAutoComboLabel("");
          return;
        }
        setAutoAppliedComboRules([
          {
            comboRuleId: best.rule.comboRuleId,
            selectedItems: best.application.selectedItems.map((x) => ({
              productVariantId: x.productVariantId,
              quantity: 1,
            })),
          },
        ]);
        setAutoComboLabel(`${best.rule.name} (tiết kiệm ~${best.saving.toLocaleString("vi-VN")}đ)`);
      } catch {
        if (!cancelled) {
          setAutoAppliedComboRules([]);
          setAutoComboLabel("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, selectedOffer]);

  useEffect(() => {
    if (!storeId || (items.length === 0 && combos.length === 0)) return;
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError("");
    (async () => {
      try {
        let voucherCode: string | undefined;
        let promotionCode: string | undefined;
        if (selectedOffer.startsWith("promo-")) {
          promotionCode = promotions.find((p) => `promo-${p.id}` === selectedOffer)?.code;
        } else if (selectedOffer.startsWith("vch-")) {
          voucherCode = vouchers.find((v) => `vch-${v.id}` === selectedOffer)?.voucherCode;
        }
        const res = await memberOrdersApi.previewPricing({
          storeId,
          voucherCode,
          promotionCode,
          selectedGiftItems,
          items: getItemsForApi(),
          combos: getCombosForApi(),
          appliedComboRules: selectedOffer ? [] : autoAppliedComboRules,
        });
        if (!cancelled) {
          setPreviewPricing(res.pricing);
          setGiftSelection(res.pricing.giftSelection ?? null);
          setPreviewError("");
        }
      } catch (e: any) {
        if (!cancelled) {
          setPreviewPricing(null);
          setGiftSelection(null);
          setPreviewError(e?.response?.data?.message || "Không thể áp dụng mã");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, selectedOffer, items, combos, promotions, vouchers, getItemsForApi, getCombosForApi, autoAppliedComboRules, selectedGiftItems]);

  useEffect(() => {
    if (!giftSelection) {
      if (selectedGiftItems.length > 0) setSelectedGiftItems([]);
      return;
    }

    const allowedIds = new Set(giftSelection.eligibleVariants.map((x) => x.productVariantId));
    const sanitized = selectedGiftItems.filter((x) => allowedIds.has(x.productVariantId)).slice(0, giftSelection.expectedQty);

    const same =
      sanitized.length === selectedGiftItems.length &&
      sanitized.every((item, index) => {
        const cur = selectedGiftItems[index];
        return cur && cur.productVariantId === item.productVariantId && cur.quantity === item.quantity && cur.note === item.note;
      });

    if (!same) {
      setSelectedGiftItems(sanitized);
    }
  }, [giftSelection, selectedGiftItems]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (offerDropdownRef.current && !offerDropdownRef.current.contains(e.target as Node)) {
        setOfferDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const promoBySelectValue = useMemo(() => {
    const m = new Map<string, string>();
    promotions.forEach((p) => m.set(`promo-${p.id}`, p.code));
    return m;
  }, [promotions]);

  const voucherBySelectValue = useMemo(() => {
    const m = new Map<string, string>();
    vouchers.forEach((v) => m.set(`vch-${v.id}`, v.voucherCode));
    return m;
  }, [vouchers]);

  const selectedGiftVariantDetails = useMemo(() => {
    if (!giftSelection || selectedGiftItems.length === 0) return [];

    const byId = new Map(
      giftSelection.eligibleVariants.map((variant) => [
        variant.productVariantId,
        variant,
      ]),
    );

    return selectedGiftItems
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
  }, [giftSelection, selectedGiftItems]);

  const subtotal =
    items.reduce((s, i) => s + i.price * i.quantity, 0) +
    combos.reduce((s, c) => s + c.comboPrice * c.quantity, 0);
  const displayAmount = previewPricing?.finalAmount ?? subtotal;
  const offerValidation = previewPricing?.offerValidation ?? null;
  const hasOfferError = !!selectedOffer && !!previewError;
  const hasOfferEligibilityError =
    !!selectedOffer && !previewError && !!offerValidation && !offerValidation.isEligible;
  const selectedGiftQty = selectedGiftItems.reduce((sum, item) => sum + item.quantity, 0);
  const canCheckout =
    !hasOfferError &&
    !hasOfferEligibilityError &&
    !previewLoading &&
    (!giftSelection || selectedGiftQty === giftSelection.expectedQty);

  const handleToggleGiftVariant = (variant: GiftSelectableVariant) => {
    const exists = selectedGiftItems.some((item) => item.productVariantId === variant.productVariantId);

    if (exists) {
      setSelectedGiftItems((prev) =>
        prev.filter((item) => item.productVariantId !== variant.productVariantId)
      );
      return;
    }

    if (!giftSelection) return;
    if (selectedGiftQty >= giftSelection.expectedQty) return;

    setSelectedGiftItems((prev) => [
      ...prev,
      {
        productVariantId: variant.productVariantId,
        quantity: 1,
      },
    ]);
  };

  const clearGiftSelection = () => {
    if (selectedGiftItems.length > 0) {
      setSelectedGiftItems([]);
    }
  };

  const handleCheckout = () => {
    if (!canCheckout) return;
    let voucherCode: string | undefined;
    let promotionCode: string | undefined;
    if (selectedOffer.startsWith("promo-")) {
      promotionCode = promoBySelectValue.get(selectedOffer);
    } else if (selectedOffer.startsWith("vch-")) {
      voucherCode = voucherBySelectValue.get(selectedOffer);
    }
    navigate("/customer/order/checkout", {
      state: {
        voucherCode,
        promotionCode,
        appliedComboRules: selectedOffer ? [] : autoAppliedComboRules,
        selectedGiftItems,
      },
    });
  };

  const getSelectedOfferLabel = () => {
    if (!selectedOffer) return "Không dùng mã giảm giá";
    if (selectedOffer.startsWith("promo-")) {
      const p = promotions.find((x) => `promo-${x.id}` === selectedOffer);
      return p ? `${p.name} — ${p.code}` : selectedOffer;
    }
    const v = vouchers.find((x) => `vch-${x.id}` === selectedOffer);
    return v ? `${v.reward.name} (${v.voucherCode})` : selectedOffer;
  };

  if (!storeId) return null;

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="order-hero">
        <h1 className="order-hero__title">Giỏ hàng</h1>
        <div className="order-hero__store-card">
          <div className="order-hero__store-info">
            <p className="order-hero__store-name">📍 {storeName}</p>
            {storeAddress && <p className="order-hero__store-address">{storeAddress}</p>}
          </div>
          <button type="button" onClick={handleChangeStore} className="order-hero__btn-change-store">
            Đổi quán
          </button>
        </div>
      </section>

      <main className="cafe-page-main">
        {reorderInfo && (
          <div className="cafe-alert-success">
            {reorderInfo}
          </div>
        )}
        <div className="cafe-card-elevated" style={{ padding: 28 }}>
          {items.length === 0 ? (
            <p style={{ color: "var(--cafe-text-muted)", padding: 20 }}>Giỏ hàng trống. Hãy thêm món từ thực đơn.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {items.map((item) => (
                  <div key={item.productVariantId} className="cafe-cart-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: "1rem", color: "var(--cafe-olive-dark)" }}>
                          {item.productName} {item.size}
                        </strong>
                        <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "var(--cafe-brown)", fontWeight: 600 }}>
                          {item.price.toLocaleString("vi-VN")}đ × {item.quantity}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="cafe-qty-control">
                          <button type="button" onClick={() => updateQuantity(item.productVariantId, -1)}>−</button>
                          <span>{item.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(item.productVariantId, 1)}>+</button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productVariantId)}
                          style={{
                            color: "var(--cafe-error)",
                            fontSize: "0.85rem",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "6px 10px",
                            textDecoration: "underline",
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <input
                        type="text"
                        value={item.note ?? ""}
                        onChange={(e) => updateNote(item.productVariantId, e.target.value)}
                        placeholder="Ghi chú (vd: ít đường, ít đá...)"
                        className="cafe-input"
                        style={{ width: "100%", padding: "10px 14px", fontSize: "0.9rem" }}
                      />
                    </div>
                  </div>
                ))}
                {combos.map((combo) => (
                  <div key={`combo-${combo.comboId}`} className="cafe-cart-item">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: "1rem", color: "var(--cafe-olive-dark)" }}>
                          Combo: {combo.comboName}
                        </strong>
                        <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "var(--cafe-brown)", fontWeight: 600 }}>
                          {combo.comboPrice.toLocaleString("vi-VN")}đ × {combo.quantity}
                        </p>
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                          {combo.items.map((child, idx) => (
                            <span key={`${combo.comboId}-${child.productVariantId}-${idx}`} style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)" }}>
                              {child.quantity} x {child.productName} ({child.size})
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="cafe-qty-control">
                          <button type="button" onClick={() => updateComboQuantity(combo.comboId, -1)}>−</button>
                          <span>{combo.quantity}</span>
                          <button type="button" onClick={() => updateComboQuantity(combo.comboId, 1)}>+</button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCombo(combo.comboId)}
                          style={{
                            color: "var(--cafe-error)",
                            fontSize: "0.85rem",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "6px 10px",
                            textDecoration: "underline",
                          }}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 28, paddingTop: 28, borderTop: "1px solid var(--cafe-cream-dark)" }}>
                <h3 className="cafe-section-heading">Khuyến mãi / Voucher</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)", marginBottom: 8 }}>
                  Chọn một mã (không dùng chung voucher và promotion).
                </p>
                <div ref={offerDropdownRef} style={{ position: "relative", marginBottom: 8 }}>
                  <button
                    type="button"
                    className="cafe-input"
                    onClick={() => setOfferDropdownOpen((o) => !o)}
                    disabled={offersLoading}
                    style={{
                      width: "100%",
                      padding: "10px 36px 10px 12px",
                      cursor: offersLoading ? "not-allowed" : "pointer",
                      textAlign: "left",
                      borderRadius: 8,
                      border: "1px solid var(--cafe-cream-dark)",
                      background: "var(--cafe-cream)",
                      fontSize: "0.95rem",
                      appearance: "none",
                      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                    }}
                  >
                    {getSelectedOfferLabel()}
                  </button>
                  {offerDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: "var(--cafe-cream)",
                        border: "1px solid var(--cafe-cream-dark)",
                        borderRadius: 12,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                        zIndex: 1000,
                        maxHeight: 240,
                        overflowY: "auto",
                        overscrollBehavior: "contain",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOffer("");
                          clearGiftSelection();
                          setOfferDropdownOpen(false);
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "12px 16px",
                          textAlign: "left",
                          border: "none",
                          background: selectedOffer === "" ? "rgba(0,0,0,0.06)" : "transparent",
                          cursor: "pointer",
                          fontSize: "0.95rem",
                        }}
                      >
                        Không dùng mã giảm giá
                      </button>
                      {promotions.length > 0 && (
                        <>
                          <div style={{ padding: "8px 16px 4px", fontSize: "0.75rem", color: "var(--cafe-text-muted)", fontWeight: 600 }}>
                            Khuyến mãi (Promotion)
                          </div>
                          {promotions.map((p) => (
                            <button
                              key={`promo-${p.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedOffer(`promo-${p.id}`);
                                clearGiftSelection();
                                setOfferDropdownOpen(false);
                              }}
                              style={{
                                display: "block",
                                width: "100%",
                                padding: "10px 16px 10px 24px",
                                textAlign: "left",
                                border: "none",
                                background: selectedOffer === `promo-${p.id}` ? "rgba(0,0,0,0.06)" : "transparent",
                                cursor: "pointer",
                                fontSize: "0.9rem",
                              }}
                            >
                              <div>{p.name} — {p.code}</div>
                              <div style={{ fontSize: "0.8rem", color: "var(--cafe-text-muted)", marginTop: 2 }}>
                                Đơn tối thiểu {(p.minOrderAmount || 0).toLocaleString("vi-VN")}đ · HSĐ {formatVnDate(p.startAt)}–{formatVnDate(p.endAt)}
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                      {vouchers.length > 0 && (
                        <>
                          <div style={{ padding: "8px 16px 4px", fontSize: "0.75rem", color: "var(--cafe-text-muted)", fontWeight: 600 }}>
                            Voucher của tôi
                          </div>
                          {vouchers.map((v) => (
                            <button
                              key={`vch-${v.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedOffer(`vch-${v.id}`);
                                clearGiftSelection();
                                setOfferDropdownOpen(false);
                              }}
                              style={{
                                display: "block",
                                width: "100%",
                                padding: "10px 16px 10px 24px",
                                textAlign: "left",
                                border: "none",
                                background: selectedOffer === `vch-${v.id}` ? "rgba(0,0,0,0.06)" : "transparent",
                                cursor: "pointer",
                                fontSize: "0.9rem",
                              }}
                            >
                              <div>{v.reward.name} ({v.voucherCode})</div>
                              <div style={{ fontSize: "0.8rem", color: "var(--cafe-text-muted)", marginTop: 2 }}>
                                Đơn tối thiểu {(v.reward.minOrderAmount || 0).toLocaleString("vi-VN")}đ · Hết hạn {formatVnDate(v.expiresAt)}
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
                {previewError && (
                  <p className="cafe-error" style={{ fontSize: "0.85rem", marginTop: 6 }}>
                    {previewError}
                  </p>
                )}
                {!previewError && selectedOffer && offerValidation?.message ? (
                  <p
                    style={{
                      fontSize: "0.85rem",
                      marginTop: 6,
                      color: !offerValidation.isEligible
                        ? "var(--cafe-error)"
                        : offerValidation.status === "GIFT_SELECTION_REQUIRED"
                          ? "var(--cafe-brown)"
                          : "var(--cafe-success)",
                      fontWeight: offerValidation.isEligible ? 600 : 700,
                    }}
                  >
                    {offerValidation.message}
                  </p>
                ) : null}
                {offersLoading && (
                  <p style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)" }}>Đang tải danh sách...</p>
                )}
                {!offersLoading && promotions.length === 0 && vouchers.length === 0 && (
                  <p style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)" }}>
                    Chưa có khuyến mãi hoặc voucher.{" "}
                    <Link to="/customer/vouchers" state={{ returnTo: "/customer/order/cart" }} className="cafe-link">Đổi điểm lấy voucher →</Link>
                  </p>
                )}
                {(promotions.length > 0 || vouchers.length > 0) && (
                  <p style={{ fontSize: "0.85rem", marginTop: 8 }}>
                    <Link to="/customer/vouchers" state={{ returnTo: "/customer/order/cart" }} className="cafe-link">
                      Đổi điểm lấy voucher / Xem kho voucher →
                    </Link>
                  </p>
                )}
              </div>

              {!selectedOffer && autoComboLabel && (
                <div style={{ marginTop: 12, color: "var(--cafe-success)", fontSize: "0.9rem", fontWeight: 600 }}>
                  Tự động áp combo: {autoComboLabel}
                </div>
              )}

              {giftSelection && (
                <div
                  style={{
                    marginTop: 20,
                    padding: 20,
                    borderTop: "1px solid var(--cafe-cream-dark)",
                    borderBottom: "1px solid var(--cafe-cream-dark)",
                    background: "rgba(255,255,255,0.4)",
                    borderRadius: 12,
                  }}
                >
                  <h3 className="cafe-section-heading" style={{ marginBottom: 8 }}>
                    Chọn món được tặng
                  </h3>

                  <p style={{ fontSize: "0.9rem", color: "var(--cafe-text-muted)", marginBottom: 12 }}>
                    {giftSelection.required
                      ? `Đơn hàng đã đủ điều kiện ưu đãi. Vui lòng chọn ${giftSelection.expectedQty} món được tặng để tiếp tục thanh toán.`
                      : `Bạn đã chọn ${selectedGiftQty}/${giftSelection.expectedQty} món được tặng. Có thể xem lại hoặc đổi lựa chọn bên dưới.`}
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {giftSelection.eligibleVariants.map((variant) => {
                      const selected = selectedGiftItems.some(
                        (item) => item.productVariantId === variant.productVariantId,
                      );

                      return (
                        <button
                          key={variant.productVariantId}
                          type="button"
                          onClick={() => handleToggleGiftVariant(variant)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: 6,
                            padding: "14px 16px",
                            borderRadius: 12,
                            border: selected
                              ? "2px solid var(--cafe-success)"
                              : "1px solid var(--cafe-cream-dark)",
                            background: selected ? "rgba(77, 124, 15, 0.08)" : "#fff",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <strong style={{ color: "var(--cafe-olive-dark)", fontSize: "0.95rem" }}>
                            {variant.productName} {variant.size}
                          </strong>
                          <span style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)" }}>
                            Giá niêm yết: {variant.price.toLocaleString("vi-VN")}đ
                          </span>
                          {selected && (
                            <span style={{ fontSize: "0.82rem", color: "var(--cafe-success)", fontWeight: 700 }}>
                              Đã chọn
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <p
                    style={{
                      marginTop: 12,
                      marginBottom: selectedGiftVariantDetails.length > 0 ? 12 : 0,
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color:
                        selectedGiftQty === giftSelection.expectedQty
                          ? "var(--cafe-success)"
                          : "var(--cafe-text-muted)",
                    }}
                  >
                    Đã chọn {selectedGiftQty}/{giftSelection.expectedQty} món được tặng
                  </p>

                  {selectedGiftVariantDetails.length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 14,
                        borderRadius: 10,
                        background: "#fff",
                        border: "1px solid var(--cafe-cream-dark)",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 10px",
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          color: "var(--cafe-olive-dark)",
                        }}
                      >
                        Món quà bạn đã chọn
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedGiftVariantDetails.map((gift) => (
                          <div
                            key={`selected-gift-${gift.productVariantId}`}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 12px",
                              borderRadius: 8,
                              background: "rgba(77, 124, 15, 0.06)",
                            }}
                          >
                            <div>
                              <strong style={{ color: "var(--cafe-olive-dark)", fontSize: "0.92rem" }}>
                                🎁 {gift.productName} {gift.size}
                              </strong>
                              <div style={{ fontSize: "0.82rem", color: "var(--cafe-text-muted)", marginTop: 2 }}>
                                Số lượng: {gift.quantity} · Giá niêm yết: {gift.price.toLocaleString("vi-VN")}đ
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedGiftItems((prev) =>
                                  prev.filter((item) => item.productVariantId !== gift.productVariantId),
                                )
                              }
                              style={{
                                border: "none",
                                background: "none",
                                color: "var(--cafe-error)",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                textDecoration: "underline",
                                padding: 0,
                              }}
                            >
                              Bỏ chọn
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 24, padding: "20px 0", borderTop: "1px solid var(--cafe-cream-dark)" }}>
                {previewLoading && selectedOffer ? (
                  <span style={{ color: "var(--cafe-text-muted)", fontSize: "1rem" }}>Đang tính giá...</span>
                ) : (
                  <>
                    {previewPricing && previewPricing.totalDiscountAmount > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={{ fontSize: "0.95rem" }}>Tạm tính: {previewPricing.subtotalAmount.toLocaleString("vi-VN")}đ</span>
                        <span style={{ color: "var(--cafe-success)", fontSize: "0.95rem" }}>
                          Giảm: -{previewPricing.totalDiscountAmount.toLocaleString("vi-VN")}đ
                        </span>
                        <span style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--cafe-olive-dark)" }}>Tổng: {displayAmount.toLocaleString("vi-VN")}đ</span>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: "1.15rem", color: "var(--cafe-olive-dark)" }}>Tổng: {displayAmount.toLocaleString("vi-VN")}đ</span>
                    )}
                  </>
                )}
              </div>

              <div className="cafe-btn-group">
                <Link to="/customer/order/menu" className="cafe-btn-secondary cafe-btn-cta" style={{ textDecoration: "none" }}>
                  Tiếp tục chọn món
                </Link>
                <button
                  type="button"
                  className="cafe-btn-primary cafe-btn-cta"
                  onClick={handleCheckout}
                  disabled={!canCheckout}
                >
                  {hasOfferError || hasOfferEligibilityError
                    ? "Mã ưu đãi chưa đủ điều kiện"
                    : giftSelection && selectedGiftQty !== giftSelection.expectedQty
                      ? "Vui lòng chọn đủ món tặng"
                      : "Tiếp tục thanh toán"}
                </button>
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

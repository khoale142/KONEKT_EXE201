import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import { memberApi, type CustomerPromotion } from "../api/member.api";
import {
  resolveCustomerMarketingBack,
  type CustomerMarketingNavState,
} from "../lib/customerMarketingNav";

function formatMoney(n?: number | null) {
  return `${Number(n || 0).toLocaleString("vi-VN")}đ`;
}

function formatDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function buildPromotionValueText(item: CustomerPromotion) {
  if (item.benefitType === "GIFT") {
    return item.requiresGiftSelection ? "Quà tặng (có chọn món)" : "Quà tặng";
  }

  if (item.promotionType === "ORDER_FIXED") {
    return formatMoney(item.discountAmount);
  }

  if (item.promotionType === "ORDER_PERCENT") {
    const pct = `${item.discountPercent || 0}%`;
    return item.maxDiscountAmount != null
      ? `${pct} (tối đa ${formatMoney(item.maxDiscountAmount)})`
      : pct;
  }

  return "Ưu đãi";
}

function getPromotionTypeLabel(item: CustomerPromotion) {
  if (item.promotionType === "ORDER_PERCENT") return "Giảm phần trăm";
  if (item.promotionType === "ORDER_FIXED") return "Giảm tiền cố định";
  if (item.promotionType === "BUY_X_GET_Y") return "Mua món này tặng món kia";
  if (item.promotionType === "GIFT_WITH_PURCHASE") {
    return "Đơn đạt giá trị tối thiểu tặng món";
  }
  return item.promotionType;
}

function buildGiftRewardText(params: {
  rewardQty?: number | null;
  rewardSize?: string | null;
  rewardCategoryName?: string | null;
}) {
  const parts = [
    params.rewardQty ? `${params.rewardQty}` : "",
    params.rewardSize ? `size ${params.rewardSize}` : "",
    params.rewardCategoryName || "món quà",
  ]
    .filter(Boolean)
    .join(" ");

  return parts || "quà tặng";
}

function buildGiftConditionText(item: CustomerPromotion) {
  if (!item.ruleSummary) {
    if (item.benefitType === "GIFT" && item.minOrderAmount > 0) {
      return `Đơn từ ${formatMoney(item.minOrderAmount)} được tặng quà`;
    }
    return null;
  }

  const r = item.ruleSummary;

  if (r.ruleType === "GIFT_WITH_PURCHASE") {
    const rewardText = buildGiftRewardText({
      rewardQty: r.rewardQty,
      rewardSize: r.rewardSize,
      rewardCategoryName: r.rewardCategoryName,
    });

    if (item.minOrderAmount > 0) {
      return `Đơn từ ${formatMoney(item.minOrderAmount)} được tặng ${rewardText}`;
    }

    return `Đơn đạt điều kiện sẽ được tặng ${rewardText}`;
  }

  const triggerPart = [
    r.triggerQty ? `Mua ${r.triggerQty}` : "",
    r.triggerSize ? `size ${r.triggerSize}` : "",
    r.triggerCategoryName || "món",
  ]
    .filter(Boolean)
    .join(" ");

  const rewardPart = [
    `tặng ${r.rewardQty}`,
    r.rewardSize ? `size ${r.rewardSize}` : "",
    r.rewardCategoryName || "món quà",
  ]
    .filter(Boolean)
    .join(" ");

  return `${triggerPart} → ${rewardPart}`;
}

export default function CustomerPromotionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const navState = location.state as CustomerMarketingNavState | null;
  const backTarget = resolveCustomerMarketingBack(navState, "/customer");
  const crossLinkState: CustomerMarketingNavState = { returnTo: backTarget };
  const selectedPromotionId = params.id ? Number(params.id) : null;
  const [items, setItems] = useState<CustomerPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await memberApi.getPublicPromotions();
        if (cancelled) return;
        setItems(res.promotions || []);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.response?.data?.message || "Không tải được khuyến mãi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="cafe-theme"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <CafeHeader />

      <main
        style={{
          flex: 1,
          padding: 32,
          maxWidth: 960,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            className="cafe-btn-secondary"
            onClick={() => navigate(backTarget)}
          >
            ← Quay lại trang chủ
          </button>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/customer/vouchers" state={crossLinkState} className="cafe-link">
              Voucher của tôi
            </Link>
          </div>
        </div>

        <div className="cafe-card" style={{ padding: 24 }}>
          <h1 className="cafe-title">Khuyến mãi hiện có</h1>

          <div
            style={{
              marginBottom: 18,
              padding: "12px 14px",
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#334155",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Khuyến mãi sẽ được áp dụng khi thanh toán tại POS nếu đơn hàng đạt đủ điều kiện. Với
            khuyến mãi quà tặng, nhân viên có thể cần chọn món quà ngay tại quầy.
          </div>

          {loading ? <p>Đang tải...</p> : null}
          {err ? <p className="cafe-error">{err}</p> : null}
          {!loading && !err && items.length === 0 ? (
            <p>Hiện chưa có khuyến mãi công khai.</p>
          ) : null}

          <div style={{ display: "grid", gap: 16 }}>
            {items
              .slice()
              .sort((a, b) => {
                if (selectedPromotionId == null) return 0;
                if (a.id === selectedPromotionId) return -1;
                if (b.id === selectedPromotionId) return 1;
                return 0;
              })
              .map((item) => {
                const giftConditionText = buildGiftConditionText(item);
                const isSelected = selectedPromotionId != null && item.id === selectedPromotionId;

                return (
                  <div
                    key={item.id}
                    className="cafe-card"
                    style={{
                      padding: 18,
                      border: isSelected ? "2px solid #7c4d2f" : undefined,
                      boxShadow: isSelected ? "0 0 0 4px rgba(124, 77, 47, 0.08)" : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                          {item.bannerTitle || item.name}
                        </h3>

                        <div
                          style={{
                            fontSize: 14,
                            color: "var(--cafe-text-muted)",
                            marginBottom: 10,
                          }}
                        >
                          Mã: <b>{item.code}</b>
                        </div>

                        <div style={{ marginBottom: 10 }}>
                          {item.bannerContent || item.description || "Không có mô tả"}
                        </div>

                        <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                          <div>
                            <b>Loại:</b> {getPromotionTypeLabel(item)}
                          </div>

                          <div>
                            <b>Ưu đãi:</b> {buildPromotionValueText(item)}
                          </div>

                          {giftConditionText ? (
                            <div>
                              <b>Điều kiện quà tặng:</b> {giftConditionText}
                            </div>
                          ) : null}

                          <div>
                            <b>Đơn tối thiểu:</b> {formatMoney(item.minOrderAmount)}
                          </div>

                          <div>
                            <b>Bắt đầu:</b> {formatDate(item.startAt)}
                          </div>

                          <div>
                            <b>Kết thúc:</b> {formatDate(item.endAt)}
                          </div>

                          {item.requiresGiftSelection ? (
                            <div>
                              <b>Lưu ý:</b> Cần chọn món tặng khi áp dụng tại POS
                            </div>
                          ) : item.benefitType === "GIFT" ? (
                            <div>
                              <b>Lưu ý:</b> Quà tặng sẽ được áp dụng khi đơn đủ điều kiện tại POS
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {item.bannerImageUrl ? (
                        <img
                          src={item.bannerImageUrl}
                          alt={item.name}
                          style={{
                            width: 180,
                            height: 120,
                            objectFit: "cover",
                            borderRadius: 12,
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </main>
    </div>
  );
}

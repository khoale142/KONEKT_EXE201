import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import {
  memberApi,
  type CustomerVoucher,
  type VoucherRewardDef,
} from "../api/member.api";
import {
  resolveCustomerMarketingBack,
  type CustomerMarketingNavState,
} from "../lib/customerMarketingNav";

type ProfileLite = {
  id: number;
  fullName: string;
  points: number;
  level: string;
};

function formatMoney(n?: number | null) {
  return `${Number(n || 0).toLocaleString("vi-VN")}đ`;
}

function formatDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function renderRewardValue(reward: {
  benefitType?: "DISCOUNT" | "GIFT";
  rewardType?: "FIXED" | "PERCENT" | null;
  discountAmount?: number | null;
  discountPercent?: number | null;
  maxDiscountAmount?: number | null;
  requiresGiftSelection?: boolean;
}) {
  if (reward.benefitType === "GIFT") {
    return reward.requiresGiftSelection
      ? "Quà tặng (có chọn món)"
      : "Quà tặng";
  }

  if (reward.rewardType === "FIXED") {
    return formatMoney(reward.discountAmount);
  }

  const pct = `${reward.discountPercent || 0}%`;
  return reward.maxDiscountAmount != null
    ? `${pct} (tối đa ${formatMoney(reward.maxDiscountAmount)})`
    : pct;
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

function buildRewardConditionText(params: {
  minOrderAmount?: number | null;
  ruleSummary?: {
    ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";
    triggerQty: number;
    triggerSize?: string | null;
    rewardQty: number;
    rewardSize?: string | null;
    triggerCategoryName?: string | null;
    rewardCategoryName?: string | null;
  } | null;
}) {
  const minOrderAmount = Number(params.minOrderAmount || 0);
  const r = params.ruleSummary;

  if (!r) {
    return minOrderAmount > 0
      ? `Đơn từ ${formatMoney(minOrderAmount)} mới áp dụng được voucher này`
      : null;
  }

  if (r.ruleType === "GIFT_WITH_PURCHASE") {
    const rewardText = buildGiftRewardText({
      rewardQty: r.rewardQty,
      rewardSize: r.rewardSize,
      rewardCategoryName: r.rewardCategoryName,
    });

    if (minOrderAmount > 0) {
      return `Đơn từ ${formatMoney(minOrderAmount)} được tặng ${rewardText}`;
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

function getVoucherStatusMeta(status: string) {
  if (status === "ISSUED") {
    return {
      label: "Chưa dùng",
      background: "#ecfdf5",
      color: "#166534",
    };
  }

  if (status === "ISSUED_NOT_READY") {
    return {
      label: "Chưa tới ngày dùng",
      background: "#eff6ff",
      color: "#1d4ed8",
    };
  }

  if (status === "USED") {
    return {
      label: "Đã dùng",
      background: "#f3f4f6",
      color: "#374151",
    };
  }

  return {
    label: "Hết hiệu lực",
    background: "#fef2f2",
    color: "#991b1b",
  };
}

function buildVoucherShortText(voucher: CustomerVoucher) {
  const reward = voucher.reward;

  if (reward.description && reward.description.trim()) {
    return reward.description.trim();
  }

  if (reward.benefitType === "GIFT") {
    return reward.requiresGiftSelection
      ? "Quà tặng áp dụng tại quầy/POS"
      : "Voucher quà tặng";
  }

  if (reward.rewardType === "FIXED") {
    return `Ưu đãi ${formatMoney(reward.discountAmount)}`;
  }

  if (reward.rewardType === "PERCENT") {
    return reward.maxDiscountAmount != null
      ? `Ưu đãi ${reward.discountPercent || 0}% (tối đa ${formatMoney(
          reward.maxDiscountAmount
        )})`
      : `Ưu đãi ${reward.discountPercent || 0}%`;
  }

  return "Voucher ưu đãi";
}

export default function CustomerVouchersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const navState = location.state as CustomerMarketingNavState | null;
  const backTarget = resolveCustomerMarketingBack(navState, "/customer");
  const crossLinkState: CustomerMarketingNavState = { returnTo: backTarget };
  const selectedRewardId = params.id ? Number(params.id) : null;

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [rewards, setRewards] = useState<VoucherRewardDef[]>([]);
  const [vouchers, setVouchers] = useState<CustomerVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"redeem" | "mine">("redeem");
  const [voucherView, setVoucherView] = useState<"unused" | "used" | "expired">(
    "unused"
  );
  const [stamps, setStamps] = useState<{
    totalStampsEarned: number;
    stampsInCurrentCycle: number;
    cycleSize: number;
    untilNextReward: number;
    rewardConfigured: boolean;
  } | null>(null);
  const [stampHistory, setStampHistory] = useState<
    Array<{
      stampId: number;
      orderId: number;
      orderCode: string | null;
      storeId: number | null;
      storeName: string | null;
      stampedAt: string;
    }>
  >([]);

  useEffect(() => {
    if (selectedRewardId != null) {
      setTab("redeem");
    }
  }, [selectedRewardId]);

  const loadAll = async () => {
    setLoading(true);
    setErr("");
    try {
      const [profileRes, rewardsRes, vouchersRes, stampsRes, stampHistoryRes] =
        await Promise.all([
          memberApi.getProfile(),
          memberApi.getPublicVoucherRewards(),
          memberApi.getMyVouchers(),
          memberApi.getMyStamps().catch(() => null),
          memberApi.getMyStampHistory({ limit: 12 }).catch(() => null),
        ]);

      setProfile({
        id: profileRes.customer.id,
        fullName: profileRes.customer.fullName,
        points: profileRes.customer.points,
        level: profileRes.customer.level,
      });
      setRewards(rewardsRes.rewards || []);
      setVouchers(vouchersRes.vouchers || []);
      setStamps(stampsRes?.stamps ?? null);
      setStampHistory(stampHistoryRes?.items ?? []);
    } catch (e: any) {
      if (e?.response?.status === 401) {
        navigate("/login/customer", { replace: true });
        return;
      }
      setErr(e?.response?.data?.message || "Không tải được voucher");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const activeRewards = useMemo(() => {
    return rewards.filter((r) => {
      if (r.totalQuantity == null) return true;
      return r.redeemedQuantity < r.totalQuantity;
    });
  }, [rewards]);

  const unusedVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const s = v.effectiveStatus || v.status;
      return s === "ISSUED" || s === "ISSUED_NOT_READY";
    });
  }, [vouchers]);

  const usedVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const s = v.effectiveStatus || v.status;
      return s === "USED";
    });
  }, [vouchers]);

  const expiredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const s = v.effectiveStatus || v.status;
      return s === "EXPIRED" || s === "CANCELLED";
    });
  }, [vouchers]);

  const currentVoucherList = useMemo(() => {
    if (voucherView === "used") return usedVouchers;
    if (voucherView === "expired") return expiredVouchers;
    return unusedVouchers;
  }, [voucherView, unusedVouchers, usedVouchers, expiredVouchers]);

  const [redeemTarget, setRedeemTarget] = useState<VoucherRewardDef | null>(
    null
  );

  const handleRedeem = async (reward: VoucherRewardDef) => {
    if (!profile) return;

    if (profile.points < reward.pointsCost) {
      setErr("Bạn không đủ điểm để đổi voucher này");
      setSuccess("");
      return;
    }

    setRedeemTarget(reward);
  };

  const confirmRedeem = async () => {
    if (!redeemTarget) return;
    setRedeemingId(redeemTarget.id);
    setErr("");
    setSuccess("");

    try {
      const res = await memberApi.redeemVoucherReward({
        rewardDefId: redeemTarget.id,
      });
      setSuccess(
        `${res.message}. Mã voucher của bạn: ${res.voucher.voucherCode}. Hãy đưa mã này cho thu ngân khi thanh toán tại POS.`
      );
      await loadAll();
      setTab("mine");
      setVoucherView("unused");
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Đổi voucher thất bại");
    } finally {
      setRedeemingId(null);
      setRedeemTarget(null);
    }
  };

  function renderCompactVoucherCard(voucher: CustomerVoucher) {
    const statusMeta = getVoucherStatusMeta(
      voucher.effectiveStatus || voucher.status
    );

    return (
      <div
        key={voucher.id}
        className="cafe-card"
        style={{
          padding: 18,
          borderRadius: 22,
          background: "#fff",
          border: "1px solid #f0ece6",
          boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              lineHeight: 1.25,
              marginBottom: 8,
              color: "#2b2118",
            }}
          >
            {voucher.reward.name}
          </div>

          <div
            style={{
              color: "#5f5b55",
              fontSize: 14,
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            {buildVoucherShortText(voucher)}
          </div>

          <div style={{ color: "#7a746b", fontSize: 13, marginBottom: 6 }}>
            Hết hạn vào {formatDate(voucher.expiresAt)}
          </div>

          {(voucher.effectiveStatus || voucher.status) ===
          "ISSUED_NOT_READY" ? (
            <div style={{ color: "#1d4ed8", fontSize: 13 }}>
              Voucher này chưa tới thời gian áp dụng.
            </div>
          ) : null}
        </div>

        <div
          style={{
            whiteSpace: "nowrap",
            padding: "6px 10px",
            borderRadius: 999,
            background: statusMeta.background,
            color: statusMeta.color,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {statusMeta.label}
        </div>
      </div>
    );
  }

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
            <Link
              to="/customer/promotions"
              state={crossLinkState}
              className="cafe-link"
            >
              Khuyến mãi
            </Link>
            <Link to="/customer/rewards" className="cafe-link">
              Điểm & check-in
            </Link>
          </div>
        </div>

        <div className="cafe-card" style={{ padding: 24 }}>
          <h1 className="cafe-title">Voucher của tôi</h1>

          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <button
              className={
                tab === "redeem" ? "cafe-btn-primary" : "cafe-btn-secondary"
              }
              onClick={() => setTab("redeem")}
              type="button"
            >
              Đổi điểm lấy voucher
            </button>
            <button
              className={
                tab === "mine" ? "cafe-btn-primary" : "cafe-btn-secondary"
              }
              onClick={() => setTab("mine")}
              type="button"
            >
              Kho quà
            </button>
          </div>

          {tab === "redeem" && profile ? (
            <div
              style={{
                marginBottom: 18,
                padding: 14,
                borderRadius: 14,
                background: "#f6f1eb",
              }}
            >
              <div>
                <b>Khách hàng:</b> {profile.fullName}
              </div>
              <div>
                <b>Điểm hiện tại:</b> {profile.points}
              </div>
              <div>
                <b>Hạng:</b> {profile.level}
              </div>
            </div>
          ) : null}

          {tab === "redeem" && stamps ? (
            <div
              style={{
                marginBottom: 18,
                padding: 16,
                borderRadius: 14,
                border: "1px solid rgba(183, 137, 58, 0.35)",
                background: "linear-gradient(135deg, #fffdf9 0%, #f6f1eb 100%)",
              }}
            >
              <h2 style={{ margin: "0 0 10px", fontSize: "1.1rem" }}>
                Tích tem
              </h2>
              <p
                style={{
                  margin: "0 0 12px",
                  color: "#5c4a3a",
                  lineHeight: 1.5,
                }}
              >
                Mỗi đơn hoàn thành tại cửa hàng (có tài khoản thành viên) được
                tính <strong>1 tem</strong>.{" "}
                {stamps.rewardConfigured && stamps.cycleSize > 0
                  ? `Đủ ${stamps.cycleSize} tem trong một chu kỳ để nhận ưu đãi.`
                  : "Hệ thống đang ghi nhận tem, nhưng chưa có cấu hình tự động đổi quà."}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {stamps.rewardConfigured && stamps.cycleSize > 0 ? (
                  <>
                    <span
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "var(--cafe-olive-dark, #2d3319)",
                      }}
                    >
                      {stamps.stampsInCurrentCycle}/{stamps.cycleSize} tem
                    </span>
                    {stamps.untilNextReward > 0 ? (
                      <span style={{ color: "#6b5b4d" }}>
                        Còn {stamps.untilNextReward} tem để đủ chu kỳ
                      </span>
                    ) : stamps.totalStampsEarned > 0 ? (
                      <span style={{ color: "#6b5b4d" }}>
                        Đã đủ chu kỳ - kiểm tra mục voucher của bạn
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: "var(--cafe-olive-dark, #2d3319)",
                    }}
                  >
                    Tổng tem đã tích: {stamps.totalStampsEarned}
                  </span>
                )}
              </div>
              {!stamps.rewardConfigured ? (
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: "0.85rem",
                    color: "#8a7a6a",
                  }}
                >
                  Chương trình đổi quà tự động chưa được cấu hình trên hệ thống.
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "redeem" && stamps && stampHistory.length > 0 ? (
            <div className="cafe-card" style={{ marginBottom: 18, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px" }}>Lịch sử tích tem gần đây</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {stampHistory.map((item) => (
                  <div
                    key={item.stampId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      fontSize: "0.92rem",
                    }}
                  >
                    <span>
                      <b>{item.orderCode || `Đơn #${item.orderId}`}</b>
                      {item.storeName ? ` · ${item.storeName}` : ""}
                    </span>
                    <span style={{ color: "var(--cafe-text-muted)" }}>
                      {formatDate(item.stampedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "redeem" ? (
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
              <div>
                <b>Cách dùng:</b>
              </div>
              <div>1. Đổi điểm để nhận voucher.</div>
              <div>
                2. Sau khi đổi thành công, voucher sẽ nằm ở tab <b>Kho quà</b>.
              </div>
              <div>
                3. Khi thanh toán, đưa mã voucher cho thu ngân tại POS để áp
                dụng.
              </div>
            </div>
          ) : null}

          {loading ? <p>Đang tải...</p> : null}
          {err ? <p className="cafe-error">{err}</p> : null}
          {success ? <p className="cafe-success">{success}</p> : null}

          {!loading && tab === "redeem" ? (
            <div style={{ display: "grid", gap: 16 }}>
              {activeRewards.length === 0 ? (
                <p>Hiện chưa có voucher reward nào.</p>
              ) : null}

              {activeRewards
                .slice()
                .sort((a, b) => {
                  if (selectedRewardId == null) return 0;
                  if (a.id === selectedRewardId) return -1;
                  if (b.id === selectedRewardId) return 1;
                  return 0;
                })
                .map((reward) => {
                  const enoughPoints = (profile?.points || 0) >= reward.pointsCost;
                  const rewardConditionText = buildRewardConditionText({
                    minOrderAmount: reward.minOrderAmount,
                    ruleSummary: reward.ruleSummary,
                  });
                  const isSelected =
                    selectedRewardId != null && reward.id === selectedRewardId;

                  return (
                    <div
                      key={reward.id}
                      className="cafe-card"
                      style={{
                        padding: 18,
                        border: isSelected ? "2px solid #7c4d2f" : undefined,
                        boxShadow: isSelected
                          ? "0 0 0 4px rgba(124, 77, 47, 0.08)"
                          : undefined,
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
                            {reward.bannerTitle || reward.name}
                          </h3>

                          <div
                            style={{
                              fontSize: 14,
                              color: "var(--cafe-text-muted)",
                              marginBottom: 10,
                            }}
                          >
                            Mã reward: <b>{reward.code}</b>
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            {reward.bannerContent ||
                              reward.description ||
                              "Không có mô tả"}
                          </div>

                          <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                            <div>
                              <b>Điểm cần đổi:</b> {reward.pointsCost}
                            </div>

                            <div>
                              <b>Ưu đãi:</b> {renderRewardValue(reward)}
                            </div>

                            {rewardConditionText ? (
                              <div>
                                <b>Điều kiện áp dụng:</b> {rewardConditionText}
                              </div>
                            ) : null}

                            <div>
                              <b>Đơn tối thiểu:</b>{" "}
                              {formatMoney(reward.minOrderAmount)}
                            </div>

                            {reward.validDays ? (
                              <div>
                                <b>Hạn dùng:</b> {reward.validDays} ngày từ lúc
                                đổi
                              </div>
                            ) : null}

                            {reward.fixedStartAt && reward.fixedEndAt ? (
                              <div>
                                <b>Khung hiệu lực:</b>{" "}
                                {formatDate(reward.fixedStartAt)} -{" "}
                                {formatDate(reward.fixedEndAt)}
                              </div>
                            ) : null}

                            {reward.totalQuantity != null ? (
                              <div>
                                <b>Còn lại:</b>{" "}
                                {Math.max(
                                  0,
                                  reward.totalQuantity -
                                    reward.redeemedQuantity
                                )}
                              </div>
                            ) : null}

                            {reward.requiresGiftSelection ? (
                              <div>
                                <b>Lưu ý:</b> Voucher này cần chọn món tặng khi
                                áp dụng tại POS
                              </div>
                            ) : reward.benefitType === "GIFT" ? (
                              <div>
                                <b>Lưu ý:</b> Quà tặng sẽ được áp dụng khi đơn đủ
                                điều kiện tại POS
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ minWidth: 180, textAlign: "right" }}>
                          <button
                            className="cafe-btn-primary"
                            disabled={!enoughPoints || redeemingId === reward.id}
                            onClick={() => handleRedeem(reward)}
                            type="button"
                          >
                            {redeemingId === reward.id ? "Đang đổi..." : "Đổi ngay"}
                          </button>

                          {!enoughPoints ? (
                            <div
                              style={{
                                color: "crimson",
                                marginTop: 8,
                                fontSize: 13,
                              }}
                            >
                              Không đủ điểm
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : null}

          {!loading && tab === "mine" ? (
            <div style={{ display: "grid", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => setVoucherView("unused")}
                  className={
                    voucherView === "unused"
                      ? "cafe-btn-primary"
                      : "cafe-btn-secondary"
                  }
                  style={{ borderRadius: 999, minWidth: 120 }}
                >
                  Chưa dùng
                </button>

                <button
                  type="button"
                  onClick={() => setVoucherView("used")}
                  className={
                    voucherView === "used"
                      ? "cafe-btn-primary"
                      : "cafe-btn-secondary"
                  }
                  style={{ borderRadius: 999, minWidth: 120 }}
                >
                  Đã dùng
                </button>

                <button
                  type="button"
                  onClick={() => setVoucherView("expired")}
                  className={
                    voucherView === "expired"
                      ? "cafe-btn-primary"
                      : "cafe-btn-secondary"
                  }
                  style={{ borderRadius: 999, minWidth: 120 }}
                >
                  Hết hạn
                </button>
              </div>

              {vouchers.length === 0 ? (
                <div className="cafe-card" style={{ padding: 20 }}>
                  Bạn chưa có voucher nào.
                </div>
              ) : currentVoucherList.length === 0 ? (
                <div className="cafe-card" style={{ padding: 20 }}>
                  Không có voucher trong mục này.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  {currentVoucherList.map(renderCompactVoucherCard)}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>

      <ConfirmModal
        open={redeemTarget != null}
        title="Đổi điểm lấy voucher"
        variant="primary"
        confirmLabel="Đổi ngay"
        loading={redeemingId != null}
        onConfirm={confirmRedeem}
        onCancel={() => setRedeemTarget(null)}
      >
        <p style={{ margin: 0 }}>
          Đổi <b>{redeemTarget?.pointsCost} điểm</b> để lấy voucher "
          <b>{redeemTarget?.name}</b>"?
        </p>
      </ConfirmModal>
    </div>
  );
}
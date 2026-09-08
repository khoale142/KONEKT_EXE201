import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { useAuthStore } from "../../../app/store/auth.store";
import { memberApi } from "../../member/api/member.api";
import { marketingApi } from "../../marketing/api/marketing.api";
import { formatMarketingDate } from "../../marketing/lib/marketingContent.utils.ts";
import type { PublicMarketingContent } from "../../marketing/types/marketingContent.types.ts";
import { MARKETING_CONTENT_TYPE_LABELS } from "../../marketing/types/marketingContent.types.ts";
import { useMemberResumePendingOrder } from "../../member-orders/hooks/useMemberResumePendingOrder.ts";
import { getPublicMenu } from "../../menu/api/menu.api";
import { getStoreLocations } from "../../stores/api/stores.api";
import BestSellerSection from "../components/BestSellerSection";
import FinalCTASection from "../components/FinalCTASection";
import HeroSection from "../components/HeroSection";
import LoyaltySection from "../components/LoyaltySection";
import NewsPromotionSection from "../components/NewsPromotionSection";
import QuickActions from "../components/QuickActions";
import StoreLocatorSection from "../components/StoreLocatorSection";
import type {
  HomeActionItem,
  HomeHeroSlide,
  HomeNewsCategory,
  HomeNewsItem,
  HomeProductItem,
  HomeStoreItem,
} from "../components/home.types";
import "../components/home.css";

type ProfileLite = {
  points?: number;
};

const MARKETING_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80",
];

function getMarketingFallbackImage(index: number) {
  return MARKETING_FALLBACK_IMAGES[index % MARKETING_FALLBACK_IMAGES.length];
}

function mapMarketingCategory(
  type: PublicMarketingContent["type"],
): Exclude<HomeNewsCategory, "all"> {
  if (type === "PROMOTION") return "promotion";
  if (type === "VOUCHER") return "voucher";
  if (type === "NEW_PRODUCT") return "new_product";
  if (type === "NEW_STORE") return "new_store";
  if (type === "TRENDING") return "trending";
  return "news";
}

function mapMarketingItem(item: PublicMarketingContent, index: number): HomeNewsItem {
  return {
    id: `marketing-${item.id}`,
    category: mapMarketingCategory(item.type),
    title: item.title,
    description:
      item.summary || "Nội dung thương hiệu mới nhất đang được cập nhật cho khách hàng.",
    imageUrl: item.coverImageUrl || getMarketingFallbackImage(index),
    publishedAt: formatMarketingDate(item.publishedAt),
    views: item.viewCount,
    badgeLabel: item.badgeLabel || (item.isFeatured ? "Nổi bật" : undefined),
    isFeatured: item.isFeatured,
    typeLabel: MARKETING_CONTENT_TYPE_LABELS[item.type],
    to: item.resolvedUrl || item.destinationPath || `/discover/${item.slug}`,
  };
}

type HomeCheckinStatus = {
  today: string;
  checkedInToday: boolean;
  streak?: number;
  pointsAwarded?: number;
  streakIfCheckInToday?: number;
  pointsPreview?: number;
};

type HomeRewardsSummary = {
  points: number;
  checkin: HomeCheckinStatus | null;
  nextVoucherPointsCost: number | null;
};

export default function CustomerHomePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const customerCheckinFlash = useAuthStore((state) => state.customerCheckinFlash);
  const dismissCustomerCheckinFlash = useAuthStore((state) => state.dismissCustomerCheckinFlash);

  const isCustomerLoggedIn = user?.portal === "CUSTOMER";
  const shouldShowBackButton = location.pathname !== "/customer";
  const { pending: pendingBanner } = useMemberResumePendingOrder(Boolean(isCustomerLoggedIn));

  const [bestSellers, setBestSellers] = useState<HomeProductItem[]>([]);
  const [newsItems, setNewsItems] = useState<HomeNewsItem[]>([]);
  const [featuredNewsItems, setFeaturedNewsItems] = useState<HomeNewsItem[]>([]);
  const [stores, setStores] = useState<HomeStoreItem[]>([]);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [voucherCount, setVoucherCount] = useState(0);

  const [summary, setSummary] = useState<HomeRewardsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/customer", { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [menuRes, marketingRes, storesRes] = await Promise.all([
          getPublicMenu(),
          marketingApi.getHomeMarketingContents({
            featuredLimit: 2,
            latestLimit: 6,
            sectionLimit: 4,
          }),
          getStoreLocations(),
        ]);

        if (cancelled) return;

        const productPool = menuRes.categories.flatMap((cat) =>
          cat.products.map((product) => {
            const variantPrice = product.variants[0]?.price || 0;
            const badge: HomeProductItem["badge"] = product.isBestSeller
              ? "Bán chạy"
              : product.isNew
                ? "Mới"
                : undefined;

            return {
              id: String(product.id ?? `${cat.key}-${product.name}`),
              name: product.name,
              imageUrl: product.imageUrl,
              badge,
              priceText: `${variantPrice.toLocaleString("vi-VN")}đ`,
              to: "/customer/order",
            } as HomeProductItem;
          }),
        );

        const prioritized = productPool
          .filter((item) => item.badge === "Bán chạy")
          .concat(productPool.filter((item) => item.badge !== "Bán chạy"))
          .slice(0, 5);

        setBestSellers(prioritized);
        setNewsItems((marketingRes?.latestPosts || []).map(mapMarketingItem));
        setFeaturedNewsItems((marketingRes?.featuredBanners || []).map(mapMarketingItem));
        setStores(
          storesRes.slice(0, 3).map((store) => ({
            id: store.id,
            name: store.name,
            address: store.address,
            city: store.city,
            openHours: store.openHours,
            to: `/stores/${store.id}`,
          })),
        );
      } catch {
        if (!cancelled) {
          setBestSellers([]);
          setNewsItems([]);
          setFeaturedNewsItems([]);
          setStores([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isCustomerLoggedIn) {
      setProfile(null);
      setVoucherCount(0);
      return;
    }

    (async () => {
      try {
        const [profileRes, vouchersRes] = await Promise.all([
          memberApi.getProfile(),
          memberApi.getMyVouchers(),
        ]);

        if (cancelled) return;

        setProfile({ points: Number(profileRes?.customer?.points || 0) });
        setVoucherCount(
          (vouchersRes.vouchers || []).filter((voucher) => voucher.status === "ISSUED").length,
        );
      } catch {
        if (!cancelled) {
          setProfile(null);
          setVoucherCount(0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCustomerLoggedIn]);

  useEffect(() => {
    let cancelled = false;

    if (!isCustomerLoggedIn) {
      setSummary(null);
      setSummaryLoading(false);
      setSummaryError("");
      return;
    }

    setSummaryLoading(true);
    setSummaryError("");

    (async () => {
      try {
        const [profileRes, checkinRes, rewardsRes] = await Promise.all([
          memberApi.getProfile(),
          memberApi.getRewardsCheckin().catch(() => null),
          memberApi.getPublicVoucherRewards().catch(() => null),
        ]);

        if (cancelled) return;

        const activeRewards =
          rewardsRes?.rewards?.filter(
            (reward) =>
              reward.totalQuantity == null || reward.redeemedQuantity < reward.totalQuantity,
          ) ?? [];

        const nextVoucherPointsCost =
          activeRewards.length > 0
            ? activeRewards.reduce(
                (min, reward) => Math.min(min, Number(reward.pointsCost || 0)),
                Number.POSITIVE_INFINITY,
              )
            : null;

        setSummary({
          points: Number(profileRes.customer?.points ?? 0),
          checkin: checkinRes?.checkin ?? null,
          nextVoucherPointsCost:
            nextVoucherPointsCost != null && Number.isFinite(nextVoucherPointsCost)
              ? nextVoucherPointsCost
              : null,
        });
      } catch (error: any) {
        if (cancelled) return;
        setSummary(null);
        setSummaryError(error?.response?.data?.message || "Không tải được trạng thái điểm thưởng");
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCustomerLoggedIn]);

  useEffect(() => {
    if (!customerCheckinFlash) return;

    const timer = window.setTimeout(() => {
      dismissCustomerCheckinFlash();
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [customerCheckinFlash, dismissCustomerCheckinFlash]);

  const heroSlides = useMemo<HomeHeroSlide[]>(
    () => [
      {
        id: "hero-1",
        imageUrl:
          "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1500&q=80",
        title: "Ưu đãi hấp dẫn mỗi ngày",
        description: "Khám phá món mới và đặt hàng nhanh chỉ với vài thao tác.",
        primaryCtaTo: "/customer/order",
        secondaryCtaTo: "/discover",
      },
      {
        id: "hero-2",
        imageUrl:
          "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?auto=format&fit=crop&w=1500&q=80",
        title: "Khám phá món mới và chiến dịch theo mùa",
        description:
          "Bộ sưu tập theo mùa với hương vị mới mẻ, phù hợp mọi thời điểm trong ngày.",
        primaryCtaTo: "/customer/order",
        secondaryCtaTo: "/discover",
      },
      {
        id: "hero-3",
        imageUrl:
          "https://images.unsplash.com/photo-1464306076886-da185f6a9d05?auto=format&fit=crop&w=1500&q=80",
        title: "Thưởng thức hương vị yêu thích tại cửa hàng gần bạn",
        description:
          "Đặt nhanh tại chi nhánh thuận tiện, nhận ưu đãi hội viên và tích điểm dễ dàng.",
        primaryCtaTo: "/customer/vouchers",
        secondaryCtaTo: "/customer/promotions",
      },
    ],
    [],
  );

  const quickActions = useMemo<HomeActionItem[]>(
    () => [
      {
        id: "qa-order",
        title: "Đặt hàng online",
        subtitle: "Đặt món nhanh chỉ với vài bước",
        icon: "🛍️",
        to: "/customer/order",
      },
      {
        id: "qa-menu",
        title: "Xem thực đơn",
        subtitle: "Khám phá đồ uống và món ăn mới",
        icon: "📖",
        to: "/menu",
      },
      {
        id: "qa-discover",
        title: "Khám phá thương hiệu",
        subtitle: "Theo dõi bài viết, món mới và chiến dịch",
        icon: "✨",
        to: "/discover",
      },
      {
        id: "qa-member",
        title: "Ưu đãi hội viên",
        subtitle: "Nhận voucher và tích điểm",
        icon: "🎁",
        to: "/customer/vouchers",
      },
    ],
    [],
  );

  const pointsToNextVoucher = useMemo(() => {
    if (!summary || summary.nextVoucherPointsCost == null) return null;
    return Math.max(0, summary.nextVoucherPointsCost - summary.points);
  }, [summary]);

  const checkinHeadline = summary?.checkin?.checkedInToday
    ? `Hôm nay bạn đã nhận ${summary.checkin.pointsAwarded ?? 0} điểm từ check-in`
    : "Phần thưởng check-in hôm nay đang chờ bạn";

  return (
    <div
      className="cafe-theme"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <CafeHeader />

      <main className="home-page-main">
        {shouldShowBackButton ? (
          <div style={{ marginBottom: 16 }}>
            <button type="button" className="cafe-btn-secondary" onClick={handleGoBack}>
              ← Quay lại trang trước
            </button>
          </div>
        ) : null}

        {customerCheckinFlash ? (
          <div
            className="cafe-alert-success"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <strong>Check-in thành công.</strong> Hôm nay bạn nhận +
              {customerCheckinFlash.pointsAwarded} điểm, chuỗi {customerCheckinFlash.streak} ngày.
            </div>
            <button
              type="button"
              onClick={dismissCustomerCheckinFlash}
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "1rem",
              }}
              aria-label="Đóng thông báo check-in"
            >
              x
            </button>
          </div>
        ) : null}

        {isCustomerLoggedIn ? (
          <section
            className="cafe-card home-reward-hero"
          >
            <div className="home-reward-hero__top">
              <div className="home-reward-hero__intro">
                <div className="home-reward-hero__badge">
                  Daily Reward
                </div>

                <h1 className="cafe-title" style={{ marginBottom: 10 }}>
                  {checkinHeadline}
                </h1>

                <p className="cafe-subtitle" style={{ marginBottom: 0, maxWidth: 560 }}>
                  Mỗi ngày ghé lại trang khách hàng, hệ thống sẽ tự check-in một lần theo giờ Việt
                  Nam. Điểm tích lũy từ check-in giúp bạn tiến gần hơn tới voucher đổi điểm.
                </p>
              </div>

              <div className="home-reward-hero__actions">
                <Link
                  to="/customer/rewards"
                  className="cafe-btn-primary"
                  style={{ textDecoration: "none" }}
                >
                  Xem điểm & check-in
                </Link>

                <Link
                  to="/customer/vouchers"
                  className="cafe-btn-secondary"
                  style={{ textDecoration: "none" }}
                >
                  Xem voucher của tôi
                </Link>
              </div>
            </div>

            {summaryLoading ? (
              <p style={{ color: "var(--cafe-text-muted)", margin: "18px 0 0" }}>
                Đang tải tiến độ phần thưởng...
              </p>
            ) : summaryError ? (
              <p style={{ color: "#9b2c2c", margin: "18px 0 0" }}>{summaryError}</p>
            ) : summary ? (
              <>
                <div
                  className="home-reward-hero__stats"
                >
                  <div className="home-reward-hero__stat">
                    <div className="home-reward-hero__stat-label">
                      Điểm hiện có
                    </div>
                    <div className="home-reward-hero__stat-value">
                      {summary.points.toLocaleString("vi-VN")}
                    </div>
                  </div>

                  <div className="home-reward-hero__stat">
                    <div className="home-reward-hero__stat-label">
                      Chuỗi hiện tại
                    </div>
                    <div className="home-reward-hero__stat-value">
                      {summary.checkin?.checkedInToday
                        ? summary.checkin.streak ?? 1
                        : summary.checkin?.streakIfCheckInToday ?? 1}{" "}
                      ngày
                    </div>
                  </div>

                  <div className="home-reward-hero__stat">
                    <div className="home-reward-hero__stat-label">
                      {summary.checkin?.checkedInToday ? "Thưởng hôm nay" : "Thưởng dự kiến"}
                    </div>
                    <div className="home-reward-hero__stat-value">
                      +
                      {summary.checkin?.checkedInToday
                        ? summary.checkin.pointsAwarded ?? 0
                        : summary.checkin?.pointsPreview ?? 0}
                    </div>
                  </div>

                  <div className="home-reward-hero__stat">
                    <div className="home-reward-hero__stat-label">
                      Mốc voucher gần nhất
                    </div>
                    <div className="home-reward-hero__stat-value home-reward-hero__stat-value--compact">
                      {pointsToNextVoucher == null
                        ? "Xem trong kho voucher"
                        : pointsToNextVoucher <= 0
                          ? "Bạn đã đủ điểm đổi voucher"
                          : `Còn ${pointsToNextVoucher.toLocaleString("vi-VN")} điểm nữa`}
                    </div>
                  </div>
                </div>

                <div
                  className="home-reward-hero__note"
                >
                  {summary.checkin?.checkedInToday ? (
                    <>
                      Bạn đã có lượt check-in hôm nay. Hãy quay lại vào ngày mai để giữ chuỗi{" "}
                      <strong>{summary.checkin.streak ?? 1} ngày</strong> và tích thêm điểm thưởng.
                    </>
                  ) : (
                    <>
                      Hôm nay bạn chưa có lượt check-in được ghi nhận. Mở lại trang khách hàng hoặc
                      trang điểm thưởng để hệ thống nhận lượt ngày mới và cộng khoảng{" "}
                      <strong>{summary.checkin?.pointsPreview ?? 0} điểm</strong>.
                    </>
                  )}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {pendingBanner ? (
          <div className="home-pending-banner">
            <p className="home-pending-banner__title">Bạn có đơn hàng chưa hoàn tất thanh toán</p>
            <p className="home-pending-banner__meta">
              {pendingBanner.storeName ? `${pendingBanner.storeName} · ` : ""}
              Mã {pendingBanner.orderCode} · {pendingBanner.finalAmount.toLocaleString("vi-VN")}đ
            </p>
            <div className="home-pending-banner__actions">
              {pendingBanner.canResumePayment ? (
                <Link to={`/customer/orders/${pendingBanner.id}/payment`} className="cafe-btn-primary">
                  Tiếp tục thanh toán
                </Link>
              ) : null}

              <Link
                to={`/customer/orders/${pendingBanner.id}`}
                className={pendingBanner.canResumePayment ? "cafe-btn-secondary" : "cafe-btn-primary"}
              >
                Xem chi tiết đơn
              </Link>
            </div>
          </div>
        ) : null}

        <HeroSection slides={heroSlides} />
        <QuickActions items={quickActions} />
        <BestSellerSection items={bestSellers} />
        <NewsPromotionSection items={newsItems} featuredItems={featuredNewsItems} />
        <LoyaltySection
          points={profile?.points}
          voucherCount={voucherCount}
          isLoggedIn={isCustomerLoggedIn}
        />
        <StoreLocatorSection stores={stores} />
        <FinalCTASection />
      </main>

      <CafeFooter />
      <ChatButton />
    </div>
  );
}

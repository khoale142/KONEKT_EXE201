import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getPublicMenu, type MenuCategory } from "../../menu/api/menu.api";
import { memberApi } from "../../member/api/member.api";
import {
  marketingApi,
  type MarketingOffer,
} from "../api/marketing.api";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { showToast } from "../../../shared/components/Toast";

function fmt(n?: number | null) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(n || 0));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toDateTimeLocalMinValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

type StoreOption = {
  id: number;
  name: string;
  address?: string;
};

type ProductOption = {
  id: number | null;
  name: string;
  categoryKey: string;
  categoryName: string;
};

type VariantOption = {
  id: number;
  productId: number | null;
  categoryKey: string;
  categoryName: string;
  productName: string;
  size: string;
  price: number;
  label: string;
};

type StoreScopeMode = "ALL" | "SELECTED" | "ALL_EXCEPT";
type MarketingPageView = "campaign" | "point-reward" | "stamp-reward";

type CampaignForm = {
  code: string;
  name: string;
  description: string;

  benefitType: "DISCOUNT" | "GIFT";
  promotionType:
  | "ORDER_FIXED"
  | "ORDER_PERCENT"
  | "BUY_X_GET_Y"
  | "GIFT_WITH_PURCHASE";

  discountAmount: number;
  discountPercent: number;
  maxDiscountAmount: number;
  minOrderAmount: number;

  startAt: string;
  endAt: string;
  isPublic: boolean;
  storeScopeMode: StoreScopeMode;
  storeIds: number[];
  excludedStoreIds: number[];
  allowWithVoucher: boolean;

  ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";

  triggerCategoryId: string;
  triggerProductIds: number[];
  triggerVariantIds: number[];
  triggerSize: string;
  triggerQty: number;

  rewardCategoryId: string;
  rewardProductIds: number[];
  rewardVariantIds: number[];
  rewardSize: string;
  rewardQty: number;

  allowCustomerChoice: boolean;
};

type RewardForm = {
  code: string;
  name: string;
  description: string;

  benefitType: "DISCOUNT" | "GIFT";
  rewardType: "FIXED" | "PERCENT";

  discountAmount: number;
  discountPercent: number;
  maxDiscountAmount: number;
  minOrderAmount: number;
  pointsCost: number;
  validDays: number;
  fixedStartAt: string;
  fixedEndAt: string;
  totalQuantity: number;
  isPublic: boolean;
  storeScopeMode: StoreScopeMode;
  storeIds: number[];
  excludedStoreIds: number[];

  ruleType: "BUY_X_GET_Y" | "GIFT_WITH_PURCHASE";

  triggerCategoryId: string;
  triggerProductIds: number[];
  triggerVariantIds: number[];
  triggerSize: string;
  triggerQty: number;

  rewardCategoryId: string;
  rewardProductIds: number[];
  rewardVariantIds: number[];
  rewardSize: string;
  rewardQty: number;

  allowCustomerChoice: boolean;
};

const EMPTY_CAMPAIGN: CampaignForm = {
  code: "",
  name: "",
  description: "",

  benefitType: "DISCOUNT",
  promotionType: "ORDER_FIXED",

  discountAmount: 0,
  discountPercent: 0,
  maxDiscountAmount: 0,
  minOrderAmount: 0,

  startAt: "",
  endAt: "",
  isPublic: false,
  storeScopeMode: "ALL",
  storeIds: [],
  excludedStoreIds: [],
  allowWithVoucher: false,

  ruleType: "BUY_X_GET_Y",

  triggerCategoryId: "",
  triggerProductIds: [],
  triggerVariantIds: [],
  triggerSize: "",
  triggerQty: 1,

  rewardCategoryId: "",
  rewardProductIds: [],
  rewardVariantIds: [],
  rewardSize: "",
  rewardQty: 1,

  allowCustomerChoice: false,
};

const EMPTY_REWARD: RewardForm = {
  code: "",
  name: "",
  description: "",

  benefitType: "DISCOUNT",
  rewardType: "FIXED",

  discountAmount: 0,
  discountPercent: 0,
  maxDiscountAmount: 0,
  minOrderAmount: 0,
  pointsCost: 0,
  validDays: 30,
  fixedStartAt: "",
  fixedEndAt: "",
  totalQuantity: 0,
  isPublic: true,
  storeScopeMode: "ALL",
  storeIds: [],
  excludedStoreIds: [],

  ruleType: "BUY_X_GET_Y",

  triggerCategoryId: "",
  triggerProductIds: [],
  triggerVariantIds: [],
  triggerSize: "",
  triggerQty: 1,

  rewardCategoryId: "",
  rewardProductIds: [],
  rewardVariantIds: [],
  rewardSize: "",
  rewardQty: 1,

  allowCustomerChoice: false,
};

function toNullableNumber(v: string): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseStoreIds(ids: number[]) {
  return ids.filter((x) => Number.isInteger(x) && x > 0);
}

function getEffectiveStoreScopeMode(params: {
  storeScopeMode: StoreScopeMode;
  storeIds: number[];
  excludedStoreIds: number[];
}): StoreScopeMode {
  if (params.storeScopeMode === "SELECTED") return "SELECTED";
  if (params.storeScopeMode === "ALL_EXCEPT") return "ALL_EXCEPT";
  return "ALL";
}

function toggleNumberInList(list: number[], value: number) {
  if (!Number.isInteger(value) || value <= 0) return list;
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value];
}

function resolveMarketingView(pathname: string): MarketingPageView {
  if (pathname.endsWith("/promotions")) return "campaign";
  if (pathname.endsWith("/stamp-vouchers")) return "stamp-reward";
  return "point-reward";
}

export default function VouchersPage() {
  const location = useLocation();
  const marketingView = useMemo(
    () => resolveMarketingView(location.pathname),
    [location.pathname]
  );

  const [data, setData] = useState<MarketingOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [stampRewardCode, setStampRewardCode] = useState("");

  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN);
  const [rewardForm, setRewardForm] = useState(EMPTY_REWARD);

  const [campaignTriggerVariantSearch, setCampaignTriggerVariantSearch] =
    useState("");
  const [campaignTriggerProductSearch, setCampaignTriggerProductSearch] =
    useState("");
  const [campaignRewardVariantSearch, setCampaignRewardVariantSearch] =
    useState("");
  const [campaignRewardProductSearch, setCampaignRewardProductSearch] =
    useState("");

  const [rewardTriggerVariantSearch, setRewardTriggerVariantSearch] =
    useState("");
  const [rewardTriggerProductSearch, setRewardTriggerProductSearch] =
    useState("");
  const [rewardGiftVariantSearch, setRewardGiftVariantSearch] = useState("");
  const [rewardGiftProductSearch, setRewardGiftProductSearch] = useState("");

  const nowMin = useMemo(() => toDateTimeLocalMinValue(), []);

  const load = () => {
    setLoading(true);
    setErr("");
    marketingApi
      .getOffers()
      .then(setData)
      .catch((e) => setErr(e?.response?.data?.message || "Lỗi tải dữ liệu"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingLookups(true);
      try {
        const [storesRes, menuRes] = await Promise.all([
          memberApi.getStores(),
          getPublicMenu(),
        ]);

        if (cancelled) return;

        const storeRows = Array.isArray(storesRes?.stores)
          ? storesRes.stores
          : [];

        setStores(
          storeRows.map((x: any) => ({
            id: Number(x.id),
            name: String(x.name || `Store #${x.id}`),
            address: x.address || "",
          }))
        );

        const menuCategories: MenuCategory[] = Array.isArray(menuRes?.categories)
          ? menuRes.categories
          : [];

        const nextProducts: ProductOption[] = [];
        const nextVariants: VariantOption[] = [];

        for (const c of menuCategories) {
          if (String(c.key || "") === "BEST_SELLER") continue;

          const categoryKey = String(c.key || "");
          const categoryName = String(c.name || c.key || "");

          for (const p of c.products || []) {
            const productId =
              typeof p.id === "number" && Number.isFinite(p.id)
                ? Number(p.id)
                : null;

            nextProducts.push({
              id: productId,
              name: String(p.name || ""),
              categoryKey,
              categoryName,
            });

            for (const v of p.variants || []) {
              if (!v?.id) continue;

              nextVariants.push({
                id: Number(v.id),
                productId,
                categoryKey,
                categoryName,
                productName: String(p.name || ""),
                size: String(v.size || ""),
                price: Number(v.price || 0),
                label: `${String(p.name || "")} - ${String(v.size || "")} - ${Number(
                  v.price || 0
                ).toLocaleString()}đ`,
              });
            }
          }
        }

        setProducts(nextProducts);
        setVariants(nextVariants);

        console.log("LOOKUP STORES:", storeRows);
        console.log("LOOKUP MENU CATEGORIES:", menuCategories);
        console.log("LOOKUP VARIANTS:", nextVariants);
      } catch (e) {
        console.error("Load lookup data failed", e);
        if (!cancelled) {
          setStores([]);
          setProducts([]);
          setVariants([]);
        }
      } finally {
        if (!cancelled) setLoadingLookups(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const campaigns = useMemo(
    () => data.filter((x) => x.kind === "PROMOTION"),
    [data]
  );

  const rewards = useMemo(
    () => data.filter((x) => x.kind === "VOUCHER_REWARD"),
    [data]
  );

  const pointRewards = useMemo(
    () => rewards.filter((x) => Number(x.stampsRequired || 0) <= 0),
    [rewards]
  );

  const stampRewards = useMemo(
    () => rewards.filter((x) => Number(x.stampsRequired || 0) > 0),
    [rewards]
  );

  const activeStampReward = useMemo(
    () => stampRewards.find((x) => x.isActive) || null,
    [stampRewards]
  );

  const isCampaignView = marketingView === "campaign";
  const isPointRewardView = marketingView === "point-reward";
  const isStampRewardView = marketingView === "stamp-reward";

  const rewardPageTitle = isStampRewardView
    ? "Voucher tích tem"
    : "Voucher reward đổi điểm";

  const rewardCreateTitle = isStampRewardView
    ? "Cấu hình voucher tích tem"
    : "Tạo voucher reward đổi điểm";

  const pageDescription = isCampaignView
    ? "Quản lý promotion áp dụng trực tiếp cho đơn hàng."
    : isStampRewardView
      ? "Nhập mã code của voucher reward để chuyển nó thành voucher tích tem. Chương trình tích tem luôn dùng 9 tem."
      : "Quản lý voucher reward để khách đổi điểm lấy voucher code.";

  const visibleItems = isCampaignView
    ? campaigns
    : isStampRewardView
      ? stampRewards
      : pointRewards;

  const activeItems = useMemo(
    () => visibleItems.filter((x) => x.status === "active"),
    [visibleItems]
  );

  const scheduledItems = useMemo(
    () => visibleItems.filter((x) => x.status === "scheduled"),
    [visibleItems]
  );

  const expiredItems = useMemo(
    () => visibleItems.filter((x) => x.status === "expired"),
    [visibleItems]
  );

  const inactiveItems = useMemo(
    () => visibleItems.filter((x) => x.status === "inactive"),
    [visibleItems]
  );

  useEffect(() => {
    if (!isStampRewardView) return;
    setStampRewardCode(activeStampReward?.code || "");
  }, [activeStampReward?.code, isStampRewardView]);

  const productOptions = products.map((x, idx) => ({
    value: x.id != null ? String(x.id) : `virtual-${idx}`,
    label: `${x.name} (${x.categoryName})`,
  }));

  const variantOptions = variants.map((x) => ({
    value: String(x.id),
    label: x.label,
  }));

  const productMap = new Map(
    products
      .filter((x) => x.id != null)
      .map((x) => [Number(x.id), x] as const)
  );

  const variantMap = new Map(variants.map((x) => [x.id, x] as const));

  function getProductLabel(productId: number) {
    const p = productMap.get(productId);
    if (!p) return `Product #${productId}`;
    return `${p.name} (${p.categoryName})`;
  }

  function getVariantLabel(variantId: number) {
    const v = variantMap.get(variantId);
    if (!v) return `Variant #${variantId}`;
    return v.label;
  }

  const handleCreateCampaign = async () => {
    if (
      !campaignForm.code ||
      !campaignForm.name ||
      !campaignForm.startAt ||
      !campaignForm.endAt
    ) {
      showToast("error", "Nhập đủ thông tin promotion");
      return;
    }

    const now = Date.now();
    const startMs = new Date(campaignForm.startAt).getTime();
    const endMs = new Date(campaignForm.endAt).getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      showToast("error", "Thời gian promotion không hợp lệ");
      return;
    }

    if (startMs < now) {
      showToast("error", "Không được chọn thời gian bắt đầu ở quá khứ");
      return;
    }

    if (endMs < now) {
      showToast("error", "Không được chọn thời gian kết thúc ở quá khứ");
      return;
    }

    if (endMs <= startMs) {
      showToast(
        "error",
        "Thời gian kết thúc phải lớn hơn thời gian bắt đầu"
      );
      return;
    }

    if (campaignForm.benefitType === "DISCOUNT") {
      if (
        campaignForm.promotionType === "ORDER_FIXED" &&
        campaignForm.discountAmount <= 0
      ) {
        showToast("error", "Promotion giảm tiền phải có giá trị > 0");
        return;
      }

      if (
        campaignForm.promotionType === "ORDER_PERCENT" &&
        (campaignForm.discountPercent <= 0 || campaignForm.discountPercent > 100)
      ) {
        showToast("error", "Promotion giảm % phải trong khoảng 1..100");
        return;
      }

      if (
        campaignForm.promotionType === "ORDER_PERCENT" &&
        campaignForm.maxDiscountAmount < 0
      ) {
        showToast("error", "Max discount không hợp lệ");
        return;
      }
    } else {
      if (
        campaignForm.ruleType === "BUY_X_GET_Y" &&
        campaignForm.triggerVariantIds.length === 0 &&
        campaignForm.triggerProductIds.length === 0 &&
        !toNullableNumber(campaignForm.triggerCategoryId)
      ) {
        showToast(
          "error",
          "Mua X tặng Y phải có ít nhất 1 trigger variant, product hoặc category"
        );
        return;
      }

      if (campaignForm.triggerQty <= 0 || campaignForm.rewardQty <= 0) {
        showToast("error", "Rule quà tặng phải có triggerQty và rewardQty > 0");
        return;
      }

      const hasRewardTarget =
        campaignForm.rewardProductIds.length > 0 ||
        campaignForm.rewardVariantIds.length > 0 ||
        !!toNullableNumber(campaignForm.rewardCategoryId);

      if (!hasRewardTarget) {
        showToast(
          "error",
          "Phải chọn ít nhất 1 reward variant, product hoặc category"
        );
        return;
      }
    }

    const campaignScopeMode = getEffectiveStoreScopeMode({
      storeScopeMode: campaignForm.storeScopeMode,
      storeIds: campaignForm.storeIds,
      excludedStoreIds: campaignForm.excludedStoreIds,
    });

    if (
      campaignScopeMode === "SELECTED" &&
      parseStoreIds(campaignForm.storeIds).length === 0
    ) {
      showToast("error", "Phải chọn ít nhất 1 cửa hàng áp dụng");
      return;
    }

    if (
      campaignScopeMode === "ALL_EXCEPT" &&
      parseStoreIds(campaignForm.excludedStoreIds).length === 0
    ) {
      showToast("error", "Phải chọn ít nhất 1 cửa hàng loại trừ");
      return;
    }

    setSaving(true);
    try {
      await marketingApi.createCampaign({
        code: campaignForm.code.toUpperCase(),
        name: campaignForm.name,
        description: campaignForm.description || null,

        benefitType: campaignForm.benefitType,
        promotionType:
          campaignForm.benefitType === "DISCOUNT"
            ? campaignForm.promotionType === "ORDER_PERCENT"
              ? "ORDER_PERCENT"
              : "ORDER_FIXED"
            : campaignForm.ruleType,

        discountAmount:
          campaignForm.benefitType === "DISCOUNT" &&
            campaignForm.promotionType === "ORDER_FIXED"
            ? campaignForm.discountAmount
            : null,

        discountPercent:
          campaignForm.benefitType === "DISCOUNT" &&
            campaignForm.promotionType === "ORDER_PERCENT"
            ? campaignForm.discountPercent
            : null,

        maxDiscountAmount:
          campaignForm.benefitType === "DISCOUNT" &&
            campaignForm.promotionType === "ORDER_PERCENT" &&
            campaignForm.maxDiscountAmount > 0
            ? campaignForm.maxDiscountAmount
            : null,

        minOrderAmount: campaignForm.minOrderAmount,
        startAt: campaignForm.startAt,
        endAt: campaignForm.endAt,
        isPublic: campaignForm.isPublic,
        isAllStores: campaignScopeMode !== "SELECTED",
        storeIds:
          campaignScopeMode === "SELECTED"
            ? parseStoreIds(campaignForm.storeIds)
            : [],
        excludedStoreIds:
          campaignScopeMode === "ALL_EXCEPT"
            ? parseStoreIds(campaignForm.excludedStoreIds)
            : [],
        allowWithVoucher: campaignForm.allowWithVoucher,

        rule:
          campaignForm.benefitType === "GIFT"
            ? {
              ruleType: campaignForm.ruleType,
              triggerCategoryId: toNullableNumber(
                campaignForm.triggerCategoryId
              ),
              triggerProductIds: campaignForm.triggerProductIds,
              triggerVariantIds: campaignForm.triggerVariantIds,
              triggerSize: campaignForm.triggerSize.trim() || null,
              triggerQty: campaignForm.triggerQty,

              rewardCategoryId: toNullableNumber(campaignForm.rewardCategoryId),
              rewardProductIds: campaignForm.rewardProductIds,
              rewardVariantIds: campaignForm.rewardVariantIds,
              rewardSize: campaignForm.rewardSize.trim() || null,
              rewardQty: campaignForm.rewardQty,

              allowCustomerChoice: campaignForm.allowCustomerChoice,
            }
            : undefined,
      } as any);

      setCampaignForm(EMPTY_CAMPAIGN);
      setCampaignTriggerVariantSearch("");
      setCampaignTriggerProductSearch("");
      setCampaignRewardVariantSearch("");
      setCampaignRewardProductSearch("");
      load();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || "Tạo promotion thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateReward = async () => {
    if (!rewardForm.code || !rewardForm.name) {
      showToast("error", "Nhập đủ thông tin voucher reward");
      return;
    }

    if (rewardForm.pointsCost <= 0) {
      showToast("error", "Voucher đổi điểm phải có pointsCost > 0");
      return;
    }

    const now = Date.now();
    const fixedStartMs = rewardForm.fixedStartAt
      ? new Date(rewardForm.fixedStartAt).getTime()
      : null;
    const fixedEndMs = rewardForm.fixedEndAt
      ? new Date(rewardForm.fixedEndAt).getTime()
      : null;

    if (fixedStartMs != null && Number.isNaN(fixedStartMs)) {
      showToast("error", "Thời gian bắt đầu không hợp lệ");
      return;
    }

    if (fixedEndMs != null && Number.isNaN(fixedEndMs)) {
      showToast("error", "Thời gian kết thúc không hợp lệ");
      return;
    }

    if (fixedStartMs != null && fixedStartMs < now) {
      showToast("error", "Không được chọn thời gian bắt đầu ở quá khứ");
      return;
    }

    if (fixedEndMs != null && fixedEndMs < now) {
      showToast("error", "Không được chọn thời gian kết thúc ở quá khứ");
      return;
    }

    if (
      fixedStartMs != null &&
      fixedEndMs != null &&
      fixedEndMs <= fixedStartMs
    ) {
      showToast(
        "error",
        "Thời gian kết thúc phải lớn hơn thời gian bắt đầu"
      );
      return;
    }

    if (rewardForm.pointsCost < 0) {
      showToast("error", "Điểm đổi phải >= 0");
      return;
    }

    if (rewardForm.benefitType === "DISCOUNT") {
      if (rewardForm.rewardType === "FIXED" && rewardForm.discountAmount <= 0) {
        showToast("error", "Voucher FIXED phải có discountAmount > 0");
        return;
      }

      if (
        rewardForm.rewardType === "PERCENT" &&
        (rewardForm.discountPercent <= 0 || rewardForm.discountPercent > 100)
      ) {
        showToast("error", "Voucher PERCENT phải trong khoảng 1..100");
        return;
      }

      if (
        rewardForm.rewardType === "PERCENT" &&
        rewardForm.maxDiscountAmount < 0
      ) {
        showToast("error", "Max discount không hợp lệ");
        return;
      }
    } else {
      if (
        rewardForm.ruleType === "BUY_X_GET_Y" &&
        rewardForm.triggerVariantIds.length === 0 &&
        rewardForm.triggerProductIds.length === 0 &&
        !toNullableNumber(rewardForm.triggerCategoryId)
      ) {
        showToast(
          "error",
          "Voucher mua X tặng Y phải có ít nhất 1 trigger variant, product hoặc category"
        );
        return;
      }

      if (rewardForm.triggerQty <= 0 || rewardForm.rewardQty <= 0) {
        showToast("error", "Rule quà tặng phải có triggerQty và rewardQty > 0");
        return;
      }

      const hasRewardTarget =
        rewardForm.rewardProductIds.length > 0 ||
        rewardForm.rewardVariantIds.length > 0 ||
        !!toNullableNumber(rewardForm.rewardCategoryId);

      if (!hasRewardTarget) {
        showToast(
          "error",
          "Phải chọn ít nhất 1 reward variant, product hoặc category"
        );
        return;
      }
    }

    const rewardScopeMode = getEffectiveStoreScopeMode({
      storeScopeMode: rewardForm.storeScopeMode,
      storeIds: rewardForm.storeIds,
      excludedStoreIds: rewardForm.excludedStoreIds,
    });

    if (
      rewardScopeMode === "SELECTED" &&
      parseStoreIds(rewardForm.storeIds).length === 0
    ) {
      showToast("error", "Phải chọn ít nhất 1 cửa hàng áp dụng");
      return;
    }

    if (
      rewardScopeMode === "ALL_EXCEPT" &&
      parseStoreIds(rewardForm.excludedStoreIds).length === 0
    ) {
      showToast("error", "Phải chọn ít nhất 1 cửa hàng loại trừ");
      return;
    }

    setSaving(true);
    try {
      await marketingApi.createVoucherReward({
        code: rewardForm.code.toUpperCase(),
        name: rewardForm.name,
        description: rewardForm.description || null,

        benefitType: rewardForm.benefitType,
        rewardType:
          rewardForm.benefitType === "DISCOUNT"
            ? rewardForm.rewardType
            : undefined,

        discountAmount:
          rewardForm.benefitType === "DISCOUNT" &&
            rewardForm.rewardType === "FIXED"
            ? rewardForm.discountAmount
            : null,

        discountPercent:
          rewardForm.benefitType === "DISCOUNT" &&
            rewardForm.rewardType === "PERCENT"
            ? rewardForm.discountPercent
            : null,

        maxDiscountAmount:
          rewardForm.benefitType === "DISCOUNT" &&
            rewardForm.rewardType === "PERCENT" &&
            rewardForm.maxDiscountAmount > 0
            ? rewardForm.maxDiscountAmount
            : null,

        minOrderAmount: rewardForm.minOrderAmount,
        pointsCost: rewardForm.pointsCost,
        stampsRequired: null,
        validDays:
          rewardForm.fixedStartAt || rewardForm.fixedEndAt
            ? null
            : rewardForm.validDays,
        fixedStartAt: rewardForm.fixedStartAt || null,
        fixedEndAt: rewardForm.fixedEndAt || null,
        totalQuantity:
          rewardForm.totalQuantity > 0 ? rewardForm.totalQuantity : null,
        isPublic: rewardForm.isPublic,
        isAllStores: rewardScopeMode !== "SELECTED",
        storeIds:
          rewardScopeMode === "SELECTED"
            ? parseStoreIds(rewardForm.storeIds)
            : [],
        excludedStoreIds:
          rewardScopeMode === "ALL_EXCEPT"
            ? parseStoreIds(rewardForm.excludedStoreIds)
            : [],

        rule:
          rewardForm.benefitType === "GIFT"
            ? {
              ruleType: rewardForm.ruleType,
              triggerCategoryId: toNullableNumber(rewardForm.triggerCategoryId),
              triggerProductIds: rewardForm.triggerProductIds,
              triggerVariantIds: rewardForm.triggerVariantIds,
              triggerSize: rewardForm.triggerSize.trim() || null,
              triggerQty: rewardForm.triggerQty,

              rewardCategoryId: toNullableNumber(rewardForm.rewardCategoryId),
              rewardProductIds: rewardForm.rewardProductIds,
              rewardVariantIds: rewardForm.rewardVariantIds,
              rewardSize: rewardForm.rewardSize.trim() || null,
              rewardQty: rewardForm.rewardQty,

              allowCustomerChoice: rewardForm.allowCustomerChoice,
            }
            : undefined,
      } as any);

      setRewardForm(EMPTY_REWARD);
      setRewardTriggerVariantSearch("");
      setRewardTriggerProductSearch("");
      setRewardGiftVariantSearch("");
      setRewardGiftProductSearch("");
      load();
    } catch (e: any) {
      showToast(
        "error",
        e?.response?.data?.message || "Tạo voucher reward thất bại"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchStampReward = async () => {
    const code = stampRewardCode.trim().toUpperCase();
    if (!code) {
      alert("Nhập mã code voucher reward cần dùng cho tích tem");
      return;
    }

    setSaving(true);
    try {
      await marketingApi.switchStampVoucherByCode(code);
      setStampRewardCode(code);
      load();
      alert("Đã cập nhật voucher tích tem");
    } catch (e: any) {
      alert(e?.response?.data?.message || "Cập nhật voucher tích tem thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: MarketingOffer) => {
    try {
      if (item.kind === "PROMOTION") {
        await marketingApi.toggleCampaign(item.id, !item.isActive);
      } else {
        await marketingApi.toggleVoucherReward(item.id, !item.isActive);
      }
      load();
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || "Lỗi cập nhật trạng thái");
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<MarketingOffer | null>(null);

  const handleDelete = async (item: MarketingOffer) => {
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "PROMOTION") {
        await marketingApi.deleteCampaign(deleteTarget.id);
      } else {
        await marketingApi.deleteVoucherReward(deleteTarget.id);
      }
      load();
      showToast("success", `Đã xóa "${deleteTarget.code}"`);
    } catch (e: any) {
      showToast("error", e?.response?.data?.message || "Lỗi xóa");
    } finally {
      setDeleteTarget(null);
    }
  };

  const renderOfferValue = (item: MarketingOffer) => {
    if (item.benefitType === "GIFT") {
      return item.requiresGiftSelection ? "Quà tặng (có chọn món)" : "Quà tặng";
    }

    if (item.discountType === "FIXED") {
      return fmt(item.discountAmount);
    }

    const pct = `${item.discountPercent || 0}%`;
    return item.maxDiscountAmount && item.maxDiscountAmount > 0
      ? `${pct} (tối đa ${fmt(item.maxDiscountAmount)})`
      : pct;
  };

  const renderOfferTable = (title: string, items: MarketingOffer[]) => {
    if (items.length === 0) return null;

    return (
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 10 }}>{title}</h3>

        <div style={tableWrapStyle}>
          <table
            style={{
              ...tableStyle,
              minWidth: 980,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "96px" }} />
              <col style={{ width: "180px" }} />
              <col style={{ width: "27%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "84px" }} />
              <col style={{ width: "128px" }} />
            </colgroup>

            <thead>
              <tr style={{ background: "#edf2f7" }}>
                <th style={thCompact}>Loại</th>
                <th style={thCompact}>Code</th>
                <th style={thCompact}>Tên</th>
                <th style={thCompact}>Ưu đãi</th>
                <th style={thCompact}>Điều kiện</th>
                <th style={thCompact}>Trạng thái</th>
                <th style={{ ...thCompact, textAlign: "center" }}>Đã dùng</th>
                <th style={{ ...thCompact, textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.kind}-${item.id}`}
                  style={{ borderBottom: "1px solid #edf2f7" }}
                >
                  <td style={typeCellStyle}>
                    {item.kind === "PROMOTION"
                      ? "Promotion"
                      : Number(item.stampsRequired || 0) > 0
                        ? "Voucher tích tem"
                        : "Voucher reward"}
                  </td>

                  <td style={codeCellStyle}>{item.code}</td>

                  <td style={nameCellStyle}>{item.name}</td>

                  <td style={offerCellStyle}>{renderOfferValue(item)}</td>

                  <td style={conditionCellStyle}>
                    <div>Đơn tối thiểu: {fmt(item.minOrderAmount)}</div>
                    {item.kind === "VOUCHER_REWARD" ? (
                      <div style={{ marginTop: 4 }}>
                        {Number(item.stampsRequired || 0) > 0
                          ? `Tem cần đủ: ${item.stampsRequired || 0}`
                          : `Điểm đổi: ${item.pointsCost || 0}`}
                      </div>
                    ) : null}
                  </td>

                  <td style={statusCellStyle}>
                    <span style={badge(item.status)}>{item.status}</span>
                  </td>

                  <td style={usedCountCellStyle}>{item.usedCount}</td>

                  <td style={actionCellStyle}>
                    <div style={actionStackStyle}>
                      <button
                        style={btnAction}
                        onClick={() => handleToggle(item)}
                      >
                        {item.isActive ? "Tắt" : "Bật"}
                      </button>

                      <button
                        style={btnDanger}
                        onClick={() => handleDelete(item)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>
            {isCampaignView ? "Promotion trực tiếp" : rewardPageTitle}
          </h1>
          <p style={{ color: "#718096", marginTop: 6 }}>{pageDescription}</p>
          <div style={{ fontSize: 12, color: "#718096", marginTop: 6 }}>
            {loadingLookups
              ? "Đang tải menu / cửa hàng..."
              : `Lookup loaded: ${stores.length} stores, ${products.length} products, ${variants.length} variants`}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <Link
          to="/office/marketing/promotions"
          style={{
            ...(isCampaignView ? btnPrimary : btnSecondary),
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Promotion trực tiếp
        </Link>
        <Link
          to="/office/marketing/point-vouchers"
          style={{
            ...(isPointRewardView ? btnPrimary : btnSecondary),
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Voucher reward đổi điểm
        </Link>
        <Link
          to="/office/marketing/stamp-vouchers"
          style={{
            ...(isStampRewardView ? btnPrimary : btnSecondary),
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Voucher tích tem
        </Link>
      </div>

      {isCampaignView && (
        <div style={card}>
          <h3>Tạo promotion trực tiếp</h3>

          <div style={grid2}>
            <Input
              label="Code"
              value={campaignForm.code}
              onChange={(v) =>
                setCampaignForm({ ...campaignForm, code: v.toUpperCase() })
              }
            />
            <Input
              label="Tên chương trình"
              value={campaignForm.name}
              onChange={(v) => setCampaignForm({ ...campaignForm, name: v })}
            />
          </div>

          <div style={grid2}>
            <Select
              label="Kiểu ưu đãi"
              value={campaignForm.benefitType}
              onChange={(v) =>
                setCampaignForm({
                  ...campaignForm,
                  benefitType: v as CampaignForm["benefitType"],
                })
              }
              options={[
                { value: "DISCOUNT", label: "Giảm giá" },
                { value: "GIFT", label: "Tặng món" },
              ]}
            />

            {campaignForm.benefitType === "DISCOUNT" ? (
              <Select
                label="Loại promotion"
                value={campaignForm.promotionType}
                onChange={(v) =>
                  setCampaignForm({
                    ...campaignForm,
                    promotionType: v as CampaignForm["promotionType"],
                  })
                }
                options={[
                  { value: "ORDER_FIXED", label: "Giảm tiền theo đơn" },
                  { value: "ORDER_PERCENT", label: "Giảm % theo đơn" },
                ]}
              />
            ) : (
              <Select
                label="Loại rule quà tặng"
                value={campaignForm.ruleType}
                onChange={(v) =>
                  setCampaignForm({
                    ...campaignForm,
                    ruleType: v as CampaignForm["ruleType"],
                  })
                }
                options={[
                  { value: "BUY_X_GET_Y", label: "Mua món này tặng món kia" },
                  {
                    value: "GIFT_WITH_PURCHASE",
                    label: "Đơn đạt giá trị tối thiểu tặng món",
                  },
                ]}
              />
            )}
          </div>

          {campaignForm.benefitType === "DISCOUNT" ? (
            <>
              <div style={grid2}>
                {campaignForm.promotionType === "ORDER_FIXED" ? (
                  <Input
                    label="Giảm tiền"
                    type="number"
                    value={String(campaignForm.discountAmount)}
                    onChange={(v) =>
                      setCampaignForm({
                        ...campaignForm,
                        discountAmount: Number(v),
                      })
                    }
                  />
                ) : (
                  <Input
                    label="Giảm %"
                    type="number"
                    value={String(campaignForm.discountPercent)}
                    onChange={(v) =>
                      setCampaignForm({
                        ...campaignForm,
                        discountPercent: Number(v),
                      })
                    }
                  />
                )}
                <div />
              </div>

              {campaignForm.promotionType === "ORDER_PERCENT" ? (
                <div style={grid2}>
                  <Input
                    label="Giảm tối đa"
                    type="number"
                    value={String(campaignForm.maxDiscountAmount)}
                    onChange={(v) =>
                      setCampaignForm({
                        ...campaignForm,
                        maxDiscountAmount: Number(v),
                      })
                    }
                  />
                  <div />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {campaignForm.ruleType === "BUY_X_GET_Y" ? (
                <>
                  <div style={grid2}>
                    <MultiOptionPicker
                      label="Chọn nhiều trigger variants"
                      searchText={campaignTriggerVariantSearch}
                      onSearchTextChange={setCampaignTriggerVariantSearch}
                      options={variantOptions}
                      selectedValues={campaignForm.triggerVariantIds}
                      onChange={(next) =>
                        setCampaignForm({
                          ...campaignForm,
                          triggerVariantIds: next,
                        })
                      }
                      placeholder="Gõ tên món trigger..."
                    />

                    <MultiOptionPicker
                      label="Chọn nhiều trigger products"
                      searchText={campaignTriggerProductSearch}
                      onSearchTextChange={setCampaignTriggerProductSearch}
                      options={productOptions.filter(
                        (x) => !String(x.value).startsWith("virtual-")
                      )}
                      selectedValues={campaignForm.triggerProductIds}
                      onChange={(next) =>
                        setCampaignForm({
                          ...campaignForm,
                          triggerProductIds: next,
                        })
                      }
                      placeholder="Gõ tên product trigger..."
                    />
                  </div>

                  <SelectedNumberTags
                    label="Trigger variants đã chọn"
                    values={campaignForm.triggerVariantIds}
                    getLabel={getVariantLabel}
                    onRemove={(id) =>
                      setCampaignForm({
                        ...campaignForm,
                        triggerVariantIds: campaignForm.triggerVariantIds.filter(
                          (x) => x !== id
                        ),
                      })
                    }
                  />

                  <SelectedNumberTags
                    label="Trigger products đã chọn"
                    values={campaignForm.triggerProductIds}
                    getLabel={getProductLabel}
                    onRemove={(id) =>
                      setCampaignForm({
                        ...campaignForm,
                        triggerProductIds: campaignForm.triggerProductIds.filter(
                          (x) => x !== id
                        ),
                      })
                    }
                  />

                  <div style={grid2}>
                    <Input
                      label="Trigger categoryId"
                      value={campaignForm.triggerCategoryId}
                      onChange={(v) =>
                        setCampaignForm({
                          ...campaignForm,
                          triggerCategoryId: v,
                        })
                      }
                    />
                    <Input
                      label="Trigger qty"
                      type="number"
                      value={String(campaignForm.triggerQty)}
                      onChange={(v) =>
                        setCampaignForm({
                          ...campaignForm,
                          triggerQty: Number(v),
                        })
                      }
                    />
                  </div>

                  <div style={grid2}>
                    <Input
                      label="Trigger size"
                      value={campaignForm.triggerSize}
                      onChange={(v) =>
                        setCampaignForm({
                          ...campaignForm,
                          triggerSize: v,
                        })
                      }
                    />
                    <div />
                  </div>
                </>
              ) : (
                <div
                  style={{
                    marginBottom: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 14,
                  }}
                >
                  Rule này dùng cho case đơn đạt giá trị tối thiểu thì tặng món.
                  Không cần chọn trigger product / trigger variant.
                  Chỉ cần nhập đơn tối thiểu + món tặng + số lượng quà.
                </div>
              )}

              <div style={grid2}>
                <MultiOptionPicker
                  label="Chọn nhiều reward variants"
                  searchText={campaignRewardVariantSearch}
                  onSearchTextChange={setCampaignRewardVariantSearch}
                  options={variantOptions}
                  selectedValues={campaignForm.rewardVariantIds}
                  onChange={(next) =>
                    setCampaignForm({
                      ...campaignForm,
                      rewardVariantIds: next,
                    })
                  }
                  placeholder="Gõ tên món tặng..."
                />

                <MultiOptionPicker
                  label="Chọn nhiều reward products"
                  searchText={campaignRewardProductSearch}
                  onSearchTextChange={setCampaignRewardProductSearch}
                  options={productOptions.filter(
                    (x) => !String(x.value).startsWith("virtual-")
                  )}
                  selectedValues={campaignForm.rewardProductIds}
                  onChange={(next) =>
                    setCampaignForm({
                      ...campaignForm,
                      rewardProductIds: next,
                    })
                  }
                  placeholder="Gõ tên product tặng..."
                />
              </div>

              <SelectedNumberTags
                label="Reward variants đã chọn"
                values={campaignForm.rewardVariantIds}
                getLabel={getVariantLabel}
                onRemove={(id) =>
                  setCampaignForm({
                    ...campaignForm,
                    rewardVariantIds: campaignForm.rewardVariantIds.filter(
                      (x) => x !== id
                    ),
                  })
                }
              />

              <SelectedNumberTags
                label="Reward products đã chọn"
                values={campaignForm.rewardProductIds}
                getLabel={getProductLabel}
                onRemove={(id) =>
                  setCampaignForm({
                    ...campaignForm,
                    rewardProductIds: campaignForm.rewardProductIds.filter(
                      (x) => x !== id
                    ),
                  })
                }
              />

              <div style={grid2}>
                <Input
                  label="Reward categoryId"
                  value={campaignForm.rewardCategoryId}
                  onChange={(v) =>
                    setCampaignForm({
                      ...campaignForm,
                      rewardCategoryId: v,
                    })
                  }
                />
                <Input
                  label="Reward qty"
                  type="number"
                  value={String(campaignForm.rewardQty)}
                  onChange={(v) =>
                    setCampaignForm({
                      ...campaignForm,
                      rewardQty: Number(v),
                    })
                  }
                />
              </div>

              <div style={grid2}>
                <Input
                  label="Reward size"
                  value={campaignForm.rewardSize}
                  onChange={(v) =>
                    setCampaignForm({
                      ...campaignForm,
                      rewardSize: v,
                    })
                  }
                />
                <Select
                  label="Cho khách chọn quà"
                  value={campaignForm.allowCustomerChoice ? "true" : "false"}
                  onChange={(v) =>
                    setCampaignForm({
                      ...campaignForm,
                      allowCustomerChoice: v === "true",
                    })
                  }
                  options={[
                    { value: "false", label: "Không" },
                    { value: "true", label: "Có" },
                  ]}
                />
              </div>
            </>
          )}

          <div style={grid2}>
            <Input
              label="Đơn tối thiểu"
              type="number"
              value={String(campaignForm.minOrderAmount)}
              onChange={(v) =>
                setCampaignForm({
                  ...campaignForm,
                  minOrderAmount: Number(v),
                })
              }
            />
            <Select
              label="Công khai"
              value={campaignForm.isPublic ? "true" : "false"}
              onChange={(v) =>
                setCampaignForm({ ...campaignForm, isPublic: v === "true" })
              }
              options={[
                { value: "false", label: "Không" },
                { value: "true", label: "Có" },
              ]}
            />
          </div>

          <div style={grid2}>
            <Select
              label="Phạm vi cửa hàng"
              value={campaignForm.storeScopeMode}
              onChange={(v) =>
                setCampaignForm({
                  ...campaignForm,
                  storeScopeMode: v as StoreScopeMode,
                })
              }
              options={[
                { value: "ALL", label: "Toàn hệ thống" },
                { value: "SELECTED", label: "Chỉ một số cửa hàng" },
                {
                  value: "ALL_EXCEPT",
                  label: "Toàn hệ thống trừ các cửa hàng này",
                },
              ]}
            />
            <Select
              label="Cho phép đi cùng voucher"
              value={campaignForm.allowWithVoucher ? "true" : "false"}
              onChange={(v) =>
                setCampaignForm({
                  ...campaignForm,
                  allowWithVoucher: v === "true",
                })
              }
              options={[
                { value: "false", label: "Không" },
                { value: "true", label: "Có" },
              ]}
            />
          </div>

          {campaignForm.storeScopeMode === "SELECTED" ? (
            <MultiStorePicker
              label="Chọn cửa hàng áp dụng"
              stores={stores}
              selectedIds={campaignForm.storeIds}
              onChange={(ids) =>
                setCampaignForm({ ...campaignForm, storeIds: ids })
              }
            />
          ) : null}

          {campaignForm.storeScopeMode === "ALL_EXCEPT" ? (
            <MultiStorePicker
              label="Chọn cửa hàng loại trừ"
              stores={stores}
              selectedIds={campaignForm.excludedStoreIds}
              onChange={(ids) =>
                setCampaignForm({ ...campaignForm, excludedStoreIds: ids })
              }
            />
          ) : null}

          <div style={grid2}>
            <Input
              label="Bắt đầu"
              type="datetime-local"
              value={campaignForm.startAt}
              min={nowMin}
              onChange={(v) => setCampaignForm({ ...campaignForm, startAt: v })}
            />
            <Input
              label="Kết thúc"
              type="datetime-local"
              value={campaignForm.endAt}
              min={campaignForm.startAt || nowMin}
              onChange={(v) => setCampaignForm({ ...campaignForm, endAt: v })}
            />
          </div>

          <TextArea
            label="Mô tả"
            value={campaignForm.description}
            onChange={(v) =>
              setCampaignForm({ ...campaignForm, description: v })
            }
          />

          <button onClick={handleCreateCampaign} disabled={saving} style={btnPrimary}>
            {saving ? "Đang lưu..." : "Tạo promotion"}
          </button>
        </div>
      )}

      {isStampRewardView && (
        <div style={card}>
          <h3>{rewardCreateTitle}</h3>

          <div
            style={{
              marginTop: 10,
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#334155",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <div><b>Cách dùng voucher tích tem:</b></div>
            <div>1. Tạo voucher ở trang <b>Voucher reward đổi điểm</b> như bình thường.</div>
            <div>2. Nhập đúng mã code của voucher đó vào ô bên dưới.</div>
            <div>3. Bấm xác nhận để thay voucher tích tem cũ bằng voucher vừa nhập.</div>
            <div>4. Chương trình tích tem luôn dùng cố định <b>9 tem</b>.</div>
          </div>

          <div style={grid2}>
            <Input
              label="Mã code voucher reward"
              value={stampRewardCode}
              onChange={(v) => setStampRewardCode(v.toUpperCase())}
            />
            <div
              style={{
                marginBottom: 12,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#9a3412",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Voucher được chọn sẽ được chuyển sang quà tích tem, tự động đặt <b>pointsCost = 0</b>,
              <b>stampsRequired = 9</b>, và ẩn khỏi danh sách voucher đổi điểm công khai.
            </div>
          </div>

          <button onClick={handleSwitchStampReward} disabled={saving} style={btnPrimary}>
            {saving ? "Đang lưu..." : "Xác nhận đổi voucher tích tem"}
          </button>

          <div
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Cấu hình hiện tại</div>
            {activeStampReward ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div><b>Code:</b> {activeStampReward.code}</div>
                <div><b>Tên:</b> {activeStampReward.name}</div>
                <div><b>Ưu đãi:</b> {renderOfferValue(activeStampReward)}</div>
                <div><b>Tem cần đủ:</b> 9</div>
                <div><b>Đơn tối thiểu:</b> {fmt(activeStampReward.minOrderAmount)}</div>
                <div><b>Trạng thái:</b> {activeStampReward.status}</div>
              </div>
            ) : (
              <div>Hiện chưa có voucher tích tem nào được cấu hình active.</div>
            )}
          </div>
        </div>
      )}

      {isPointRewardView && (
        <div style={card}>
          <h3>{rewardCreateTitle}</h3>

          <div
            style={{
              marginTop: 10,
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#334155",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <div>
              <b>Cách dùng voucher reward:</b>
            </div>
            <>
              <div>1. Marketing tạo reward đổi điểm tại đây.</div>
              <div>2. Khách vào app/web member để đổi điểm và nhận voucher code thực tế.</div>
              <div>3. Thu ngân nhập voucher code đó tại POS để áp dụng.</div>
              <div>4. Nếu POS đang gắn member, voucher phải thuộc đúng khách đó.</div>
            </>
          </div>

          <div style={grid2}>
            <Input
              label="Code"
              value={rewardForm.code}
              onChange={(v) =>
                setRewardForm({ ...rewardForm, code: v.toUpperCase() })
              }
            />
            <Input
              label="Tên reward"
              value={rewardForm.name}
              onChange={(v) => setRewardForm({ ...rewardForm, name: v })}
            />
          </div>

          <div style={grid2}>
            <Select
              label="Kiểu reward"
              value={rewardForm.benefitType}
              onChange={(v) =>
                setRewardForm({
                  ...rewardForm,
                  benefitType: v as RewardForm["benefitType"],
                })
              }
              options={[
                { value: "DISCOUNT", label: "Giảm giá" },
                { value: "GIFT", label: "Tặng món" },
              ]}
            />

            {rewardForm.benefitType === "DISCOUNT" ? (
              <Select
                label="Loại reward"
                value={rewardForm.rewardType}
                onChange={(v) =>
                  setRewardForm({
                    ...rewardForm,
                    rewardType: v as RewardForm["rewardType"],
                  })
                }
                options={[
                  { value: "FIXED", label: "Giảm tiền" },
                  { value: "PERCENT", label: "Giảm %" },
                ]}
              />
            ) : (
              <Select
                label="Loại rule quà tặng"
                value={rewardForm.ruleType}
                onChange={(v) =>
                  setRewardForm({
                    ...rewardForm,
                    ruleType: v as RewardForm["ruleType"],
                  })
                }
                options={[
                  { value: "BUY_X_GET_Y", label: "Mua món này tặng món kia" },
                  {
                    value: "GIFT_WITH_PURCHASE",
                    label: "Đơn đạt giá trị tối thiểu tặng món",
                  },
                ]}
              />
            )}
          </div>

          {rewardForm.benefitType === "DISCOUNT" ? (
            <>
              <div style={grid2}>
                {rewardForm.rewardType === "FIXED" ? (
                  <Input
                    label="Giảm tiền"
                    type="number"
                    value={String(rewardForm.discountAmount)}
                    onChange={(v) =>
                      setRewardForm({
                        ...rewardForm,
                        discountAmount: Number(v),
                      })
                    }
                  />
                ) : (
                  <Input
                    label="Giảm %"
                    type="number"
                    value={String(rewardForm.discountPercent)}
                    onChange={(v) =>
                      setRewardForm({
                        ...rewardForm,
                        discountPercent: Number(v),
                      })
                    }
                  />
                )}
                <div />
              </div>

              {rewardForm.rewardType === "PERCENT" ? (
                <div style={grid2}>
                  <Input
                    label="Giảm tối đa"
                    type="number"
                    value={String(rewardForm.maxDiscountAmount)}
                    onChange={(v) =>
                      setRewardForm({
                        ...rewardForm,
                        maxDiscountAmount: Number(v),
                      })
                    }
                  />
                  <div />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {rewardForm.ruleType === "BUY_X_GET_Y" ? (
                <>
                  <div style={grid2}>
                    <MultiOptionPicker
                      label="Chọn nhiều trigger variants"
                      searchText={rewardTriggerVariantSearch}
                      onSearchTextChange={setRewardTriggerVariantSearch}
                      options={variantOptions}
                      selectedValues={rewardForm.triggerVariantIds}
                      onChange={(next) =>
                        setRewardForm({
                          ...rewardForm,
                          triggerVariantIds: next,
                        })
                      }
                      placeholder="Gõ tên món trigger..."
                    />

                    <MultiOptionPicker
                      label="Chọn nhiều trigger products"
                      searchText={rewardTriggerProductSearch}
                      onSearchTextChange={setRewardTriggerProductSearch}
                      options={productOptions.filter(
                        (x) => !String(x.value).startsWith("virtual-")
                      )}
                      selectedValues={rewardForm.triggerProductIds}
                      onChange={(next) =>
                        setRewardForm({
                          ...rewardForm,
                          triggerProductIds: next,
                        })
                      }
                      placeholder="Gõ tên product trigger..."
                    />
                  </div>

                  <SelectedNumberTags
                    label="Trigger variants đã chọn"
                    values={rewardForm.triggerVariantIds}
                    getLabel={getVariantLabel}
                    onRemove={(id) =>
                      setRewardForm({
                        ...rewardForm,
                        triggerVariantIds: rewardForm.triggerVariantIds.filter(
                          (x) => x !== id
                        ),
                      })
                    }
                  />

                  <SelectedNumberTags
                    label="Trigger products đã chọn"
                    values={rewardForm.triggerProductIds}
                    getLabel={getProductLabel}
                    onRemove={(id) =>
                      setRewardForm({
                        ...rewardForm,
                        triggerProductIds: rewardForm.triggerProductIds.filter(
                          (x) => x !== id
                        ),
                      })
                    }
                  />

                  <div style={grid2}>
                    <Input
                      label="Trigger categoryId"
                      value={rewardForm.triggerCategoryId}
                      onChange={(v) =>
                        setRewardForm({
                          ...rewardForm,
                          triggerCategoryId: v,
                        })
                      }
                    />
                    <Input
                      label="Trigger qty"
                      type="number"
                      value={String(rewardForm.triggerQty)}
                      onChange={(v) =>
                        setRewardForm({
                          ...rewardForm,
                          triggerQty: Number(v),
                        })
                      }
                    />
                  </div>

                  <div style={grid2}>
                    <Input
                      label="Trigger size"
                      value={rewardForm.triggerSize}
                      onChange={(v) =>
                        setRewardForm({
                          ...rewardForm,
                          triggerSize: v,
                        })
                      }
                    />
                    <div />
                  </div>
                </>
              ) : (
                <div
                  style={{
                    marginBottom: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 14,
                  }}
                >
                  Rule này dùng cho case đơn đạt giá trị tối thiểu thì tặng món.
                  Không cần chọn trigger product / trigger variant.
                  Chỉ cần nhập đơn tối thiểu + món tặng + số lượng quà.
                </div>
              )}

              <div style={grid2}>
                <MultiOptionPicker
                  label="Chọn nhiều reward variants"
                  searchText={rewardGiftVariantSearch}
                  onSearchTextChange={setRewardGiftVariantSearch}
                  options={variantOptions}
                  selectedValues={rewardForm.rewardVariantIds}
                  onChange={(next) =>
                    setRewardForm({
                      ...rewardForm,
                      rewardVariantIds: next,
                    })
                  }
                  placeholder="Gõ tên món tặng..."
                />

                <MultiOptionPicker
                  label="Chọn nhiều reward products"
                  searchText={rewardGiftProductSearch}
                  onSearchTextChange={setRewardGiftProductSearch}
                  options={productOptions.filter(
                    (x) => !String(x.value).startsWith("virtual-")
                  )}
                  selectedValues={rewardForm.rewardProductIds}
                  onChange={(next) =>
                    setRewardForm({
                      ...rewardForm,
                      rewardProductIds: next,
                    })
                  }
                  placeholder="Gõ tên product tặng..."
                />
              </div>

              <SelectedNumberTags
                label="Reward variants đã chọn"
                values={rewardForm.rewardVariantIds}
                getLabel={getVariantLabel}
                onRemove={(id) =>
                  setRewardForm({
                    ...rewardForm,
                    rewardVariantIds: rewardForm.rewardVariantIds.filter(
                      (x) => x !== id
                    ),
                  })
                }
              />

              <SelectedNumberTags
                label="Reward products đã chọn"
                values={rewardForm.rewardProductIds}
                getLabel={getProductLabel}
                onRemove={(id) =>
                  setRewardForm({
                    ...rewardForm,
                    rewardProductIds: rewardForm.rewardProductIds.filter(
                      (x) => x !== id
                    ),
                  })
                }
              />

              <div style={grid2}>
                <Input
                  label="Reward categoryId"
                  value={rewardForm.rewardCategoryId}
                  onChange={(v) =>
                    setRewardForm({
                      ...rewardForm,
                      rewardCategoryId: v,
                    })
                  }
                />
                <Input
                  label="Reward qty"
                  type="number"
                  value={String(rewardForm.rewardQty)}
                  onChange={(v) =>
                    setRewardForm({
                      ...rewardForm,
                      rewardQty: Number(v),
                    })
                  }
                />
              </div>

              <div style={grid2}>
                <Input
                  label="Reward size"
                  value={rewardForm.rewardSize}
                  onChange={(v) =>
                    setRewardForm({
                      ...rewardForm,
                      rewardSize: v,
                    })
                  }
                />
                <Select
                  label="Cho khách chọn quà"
                  value={rewardForm.allowCustomerChoice ? "true" : "false"}
                  onChange={(v) =>
                    setRewardForm({
                      ...rewardForm,
                      allowCustomerChoice: v === "true",
                    })
                  }
                  options={[
                    { value: "false", label: "Không" },
                    { value: "true", label: "Có" },
                  ]}
                />
              </div>
            </>
          )}

          <div style={grid2}>
            <Input
              label="Điểm cần đổi"
              type="number"
              value={String(rewardForm.pointsCost)}
              onChange={(v) =>
                setRewardForm({ ...rewardForm, pointsCost: Number(v) })
              }
            />
            <Input
              label="Đơn tối thiểu"
              type="number"
              value={String(rewardForm.minOrderAmount)}
              onChange={(v) =>
                setRewardForm({
                  ...rewardForm,
                  minOrderAmount: Number(v),
                })
              }
            />
          </div>

          <div style={grid2}>
            <Input
              label="Số ngày hiệu lực"
              type="number"
              value={String(rewardForm.validDays)}
              onChange={(v) =>
                setRewardForm({ ...rewardForm, validDays: Number(v) })
              }
            />
            <Input
              label="Tổng số lượng (0 = không giới hạn)"
              type="number"
              value={String(rewardForm.totalQuantity)}
              onChange={(v) =>
                setRewardForm({ ...rewardForm, totalQuantity: Number(v) })
              }
            />
          </div>

          <div style={grid2}>
            <Select
              label="Công khai"
              value={rewardForm.isPublic ? "true" : "false"}
              onChange={(v) =>
                setRewardForm({ ...rewardForm, isPublic: v === "true" })
              }
              options={[
                { value: "true", label: "Có" },
                { value: "false", label: "Không" },
              ]}
            />
            <div />
          </div>

          <div style={grid2}>
            <Select
              label="Phạm vi cửa hàng"
              value={rewardForm.storeScopeMode}
              onChange={(v) =>
                setRewardForm({
                  ...rewardForm,
                  storeScopeMode: v as StoreScopeMode,
                })
              }
              options={[
                { value: "ALL", label: "Toàn hệ thống" },
                { value: "SELECTED", label: "Chỉ một số cửa hàng" },
                {
                  value: "ALL_EXCEPT",
                  label: "Toàn hệ thống trừ các cửa hàng này",
                },
              ]}
            />
            <div />
          </div>

          {rewardForm.storeScopeMode === "SELECTED" ? (
            <MultiStorePicker
              label="Chọn cửa hàng áp dụng"
              stores={stores}
              selectedIds={rewardForm.storeIds}
              onChange={(ids) =>
                setRewardForm({ ...rewardForm, storeIds: ids })
              }
            />
          ) : null}

          {rewardForm.storeScopeMode === "ALL_EXCEPT" ? (
            <MultiStorePicker
              label="Chọn cửa hàng loại trừ"
              stores={stores}
              selectedIds={rewardForm.excludedStoreIds}
              onChange={(ids) =>
                setRewardForm({ ...rewardForm, excludedStoreIds: ids })
              }
            />
          ) : null}

          <div style={grid2}>
            <Input
              label="Bắt đầu cố định (optional)"
              type="datetime-local"
              value={rewardForm.fixedStartAt}
              min={nowMin}
              onChange={(v) =>
                setRewardForm({ ...rewardForm, fixedStartAt: v })
              }
            />
            <Input
              label="Kết thúc cố định (optional)"
              type="datetime-local"
              value={rewardForm.fixedEndAt}
              min={rewardForm.fixedStartAt || nowMin}
              onChange={(v) =>
                setRewardForm({ ...rewardForm, fixedEndAt: v })
              }
            />
          </div>

          <TextArea
            label="Mô tả"
            value={rewardForm.description}
            onChange={(v) => setRewardForm({ ...rewardForm, description: v })}
          />

          <button onClick={handleCreateReward} disabled={saving} style={btnPrimary}>
            {saving ? "Đang lưu..." : rewardCreateTitle}
          </button>
        </div>
      )}

      {loading && <p>Đang tải...</p>}
      {err && <p style={{ color: "red" }}>{err}</p>}

      {!loading && !err && !isStampRewardView && (
        <div style={{ marginTop: 20 }}>
          {renderOfferTable("Đang hoạt động", activeItems)}
          {renderOfferTable("Sắp diễn ra", scheduledItems)}
          {renderOfferTable("Đã hết hạn", expiredItems)}
          {renderOfferTable("Đã tắt", inactiveItems)}
        </div>
      )}

      <ConfirmModal
        open={deleteTarget != null}
        title="Xác nhận xóa"
        variant="danger"
        confirmLabel="Xóa"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        <p style={{ margin: 0 }}>
          Xóa "<b>{deleteTarget?.code}</b>"? Hành động này không thể hoàn tác.
        </p>
      </ConfirmModal>
    </div>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{props.label}</label>
      <input
        type={props.type || "text"}
        value={props.value}
        min={props.min}
        onChange={(e) => props.onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{props.label}</label>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{ ...inputStyle, minHeight: 90 }}
      />
    </div>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{props.label}</label>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={inputStyle}
      >
        {props.options.map((x) => (
          <option key={`${props.label}-${x.value}`} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MultiOptionPicker(props: {
  label: string;
  searchText: string;
  onSearchTextChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  selectedValues: number[];
  onChange: (next: number[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = props.searchText.trim()
    ? props.options.filter((x) =>
      normalizeText(x.label).includes(normalizeText(props.searchText))
    )
    : props.options.slice(0, 30);

  return (
    <div ref={wrapRef} style={{ marginBottom: 12, position: "relative" }}>
      <label style={labelStyle}>{props.label}</label>

      <input
        value={props.searchText}
        onChange={(e) => {
          props.onSearchTextChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={props.placeholder || "Tìm kiếm..."}
        style={inputStyle}
      />

      {open ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: 4,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            maxHeight: 220,
            overflow: "auto",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", color: "#718096" }}>
              Không có kết quả
            </div>
          ) : (
            filtered.map((x) => {
              const id = Number(x.value);
              const selected = props.selectedValues.includes(id);

              return (
                <button
                  key={`${props.label}-${x.value}`}
                  type="button"
                  onClick={() => {
                    if (!Number.isInteger(id) || id <= 0) return;
                    props.onChange(toggleNumberInList(props.selectedValues, id));
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: "1px solid #edf2f7",
                    background: selected ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  {x.label}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function SelectedNumberTags(props: {
  label: string;
  values: number[];
  getLabel: (id: number) => string;
  onRemove: (id: number) => void;
}) {
  if (props.values.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={labelStyle}>{props.label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {props.values.map((id) => (
          <div
            key={`${props.label}-${id}`}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              background: "#edf2f7",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{props.getLabel(id)}</span>
            <button
              type="button"
              onClick={() => props.onRemove(id)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiStorePicker(props: {
  label: string;
  stores: StoreOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const [keyword, setKeyword] = useState("");

  const filtered = props.stores.filter((x) => {
    const q = keyword.trim().toLowerCase();
    if (!q) return true;
    return (
      x.name.toLowerCase().includes(q) ||
      (x.address || "").toLowerCase().includes(q)
    );
  });

  const selectedStores = props.stores.filter((x) =>
    props.selectedIds.includes(x.id)
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{props.label}</label>

      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Tìm store theo tên / địa chỉ"
        style={inputStyle}
      />

      <div
        style={{
          marginTop: 6,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#fff",
          maxHeight: 180,
          overflow: "auto",
        }}
      >
        {filtered.map((s) => {
          const checked = props.selectedIds.includes(s.id);
          return (
            <label
              key={s.id}
              style={{
                display: "block",
                padding: "10px 12px",
                borderBottom: "1px solid #edf2f7",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) {
                    props.onChange([...props.selectedIds, s.id]);
                  } else {
                    props.onChange(props.selectedIds.filter((id) => id !== s.id));
                  }
                }}
                style={{ marginRight: 8 }}
              />
              <b>{s.name}</b>
              {s.address ? ` - ${s.address}` : ""}
            </label>
          );
        })}
      </div>

      {selectedStores.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {selectedStores.map((s) => (
            <div
              key={`tag-${s.id}`}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "#edf2f7",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{s.name}</span>
              <button
                type="button"
                onClick={() =>
                  props.onChange(props.selectedIds.filter((id) => id !== s.id))
                }
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function badge(status?: string): React.CSSProperties {
  const map: Record<
    string,
    { background: string; color: string }
  > = {
    active: {
      background: "#ecfdf5",
      color: "#166534",
    },
    scheduled: {
      background: "#eff6ff",
      color: "#1d4ed8",
    },
    expired: {
      background: "#fff7ed",
      color: "#c2410c",
    },
    inactive: {
      background: "#f1f5f9",
      color: "#475569",
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 700,
    ...(map[status || ""] || map.inactive),
  };
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  marginBottom: 20,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  overflow: "hidden",
};

const th: React.CSSProperties = {
  padding: "12px 10px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  color: "#2d3748",
};

const td: React.CSSProperties = {
  padding: "12px 10px",
  verticalAlign: "top",
  fontSize: 14,
  color: "#2d3748",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#fff",
};

const btnPrimary: React.CSSProperties = {
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const tableWrapStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  borderRadius: 12,
};

const thCompact: React.CSSProperties = {
  ...th,
  padding: "14px 12px",
  whiteSpace: "nowrap",
};

const tdCompact: React.CSSProperties = {
  ...td,
  padding: "16px 12px",
  lineHeight: 1.55,
  verticalAlign: "top",
};

const codeCellStyle: React.CSSProperties = {
  ...tdCompact,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const typeCellStyle: React.CSSProperties = {
  ...tdCompact,
  color: "#334155",
};

const nameCellStyle: React.CSSProperties = {
  ...tdCompact,
  minWidth: 220,
};

const offerCellStyle: React.CSSProperties = {
  ...tdCompact,
  minWidth: 170,
};

const conditionCellStyle: React.CSSProperties = {
  ...tdCompact,
  minWidth: 170,
};

const statusCellStyle: React.CSSProperties = {
  ...tdCompact,
  whiteSpace: "nowrap",
};

const usedCountCellStyle: React.CSSProperties = {
  ...tdCompact,
  textAlign: "center",
  whiteSpace: "nowrap",
};

const actionCellStyle: React.CSSProperties = {
  ...tdCompact,
  width: 128,
  minWidth: 128,
};

const actionStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  alignItems: "stretch",
};

const btnAction: React.CSSProperties = {
  ...btnSecondary,
  width: "100%",
  minHeight: 40,
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const btnDanger: React.CSSProperties = {
  ...btnAction,
  color: "#dc2626",
  borderColor: "#fca5a5",
  background: "#fff",
};
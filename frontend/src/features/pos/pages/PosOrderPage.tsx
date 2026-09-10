import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore, isOwnerOrAdmin } from "../../../app/store/auth.store";
import {
  posGetMenu,
  type MenuCategory,
  type MenuCombo,
  type MenuVariant,
} from "../api/menu.api";
import {
  posCreateOrder,
  posCreateOrderForGateway,
  posGetHeldOrderSnapshot,
  posHoldOrder,
  posListAvailablePromotions,
  posPayHeldOrder,
  posPreviewOrderPricing,
  type PosAppliedComboRule,
  type PosOrderPricing,
  type PosSelectedGiftItem,
  type PosServiceMode,
} from "../api/orders.api";
import { initVietqrPayment } from "../../payment/api/payment.api";
import { usePaymentStatus } from "../../payment/hooks/usePaymentStatus";
import { posFindMember, posQuickCreateMember } from "../api/members.api";
import {
  previewComboRules,
  type ComboRulePreview,
  type ComboRuleSuggestedPreview,
} from "../api/comboRules.api";
import { getCurrentShiftReconciliation } from "../api/shiftReconciliations.api";
import {
  publishPosCustomerPreview,
  type PosCustomerPreviewSnapshot,
} from "../utils/posCustomerPreviewSession";
import PosReceiptModal, { type ReceiptOrderData } from "../components/PosReceiptModal";
import {
  DEFAULT_SETTINGS,
  SERVICE_MODE_OPTIONS,
  type PosSettingsData,
} from "../components/PosSettingsModal";
import { posGetStoreConfig } from "../api/orders.api";

type CartKey = string;

type CartItem = {
  variantId: number;
  productName: string;
  size: string;
  price: number;
  qty: number;
  categoryKey: string;
  note?: string;
};

type ComboCartItem = {
  comboId: number;
  name: string;
  comboPrice: number;
  qty: number;
  items: Array<{
    productVariantId: number;
    productName: string;
    size: string;
    quantity: number;
  }>;
};

type PaymentMethod = "cash" | "transfer";
type CashPresetValue = "exact" | "custom" | string;
type PageMode = "cart" | "combo" | "promotion" | "payment";
type OrderType =
  | "NORMAL"
  | "TEST"
  | "FREE"
  | "INTERNAL"
  | "GUEST"
  | "COMPENSATION";


type DisplayComboItem = {
  key: string;
  type: "fixed" | "dynamic";
  name: string;
  price: number;
  qty: number;
  description: string;
  comboId?: number;
  comboRuleId?: number;
};

type PromotionListItem = {
  id: number;
  code: string;
  name: string;
  promotionType: string;
  discountAmount?: number | null;
  discountPercent?: number | null;
  maxDiscountAmount?: number | null;
  minOrderAmount: number;
  startAt?: string | null;
  endAt?: string | null;
  description?: string | null;
};

type DisplayCartRow =
  | {
    type: "item";
    key: string;
    item: CartItem;
  }
  | {
    type: "combo";
    key: string;
    combo: DisplayComboItem;
  };

const CATEGORY_LABEL: Record<string, string> = {
  BEST_SELLER: "Ban chay nhat",
  BAKERY_SWEET: "Banh ngot",
  BAKERY_SAVORY: "Banh man",
  COFFEE: "Ca phe truyen thong",
  ESPRESSO: "Espresso",
  PHINDI: "Phindi",
  TEA: "Tra",
  FREEZE: "Freeze",
  JUICE: "Nuoc ep",
  TOPPING: "Topping",
  OTHERS: "Nước khác",
};


function formatMoney(n: number) {
  return `${Number(n || 0).toLocaleString()}d`;
}

function isSpecialOrderType(orderType: OrderType) {
  return orderType !== "NORMAL";
}

function getOrderTypeLabel(orderType: OrderType) {
  switch (orderType) {
    case "TEST":
      return "TEST";
    case "FREE":
      return "FREE";
    case "INTERNAL":
      return "INTERNAL";
    case "GUEST":
      return "GUEST";
    case "COMPENSATION":
      return "COMP";
    default:
      return "NORMAL";
  }
}

function LoyaltyStatusHint(props: { hasMember: boolean }) {
  const { hasMember } = props;

  return (
    <div
      className={hasMember ? "pos-alert pos-alert--success" : "pos-alert pos-alert--warning"}
      style={{ marginTop: 8, padding: "10px 12px" }}
    >
      <div style={{ fontWeight: 700 }}>
        {hasMember ? "Đã gắn member cho đơn này." : "Chưa gắn member cho đơn này."}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45 }}>
        {hasMember
          ? "Tem và điểm sẽ được cộng khi đơn hoàn thành trên KDS."
          : "Đơn vẫn thanh toán được, nhưng khách sẽ không được tích tem hoặc nhận điểm thành viên cho đơn này."}
      </div>
    </div>
  );
}

function buildSelectedGiftItemsFromMap(params: {
  qtyMap: Record<number, number>;
  notes: Record<number, string>;
}) {
  return Object.entries(params.qtyMap)
    .map(([variantId, qty]) => ({
      productVariantId: Number(variantId),
      quantity: Number(qty || 0),
      note: (params.notes[Number(variantId)] || "").trim() || undefined,
    }))
    .filter((x) => x.quantity > 0);
}

function ceilTo(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function getSmartCashSuggestions(total: number): number[] {
  const values = new Set<number>();

  if (total <= 50000) {
    values.add(50000);
    values.add(100000);
    values.add(200000);
  } else if (total <= 100000) {
    values.add(100000);
    values.add(200000);
    values.add(500000);
  } else if (total <= 200000) {
    values.add(200000);
    values.add(300000);
    values.add(400000);
    values.add(500000);
  } else if (total <= 500000) {
    values.add(500000);
    values.add(1000000);
    values.add(2000000);
  } else if (total <= 1000000) {
    values.add(1000000);
    values.add(1500000);
    values.add(2000000);
  } else {
    const rounded10k = ceilTo(total, 10000);
    const rounded50k = ceilTo(total, 50000);
    const rounded100k = ceilTo(total, 100000);
    values.add(rounded10k);
    values.add(rounded50k);
    values.add(rounded100k);
    values.add(ceilTo(total * 1.2, 50000));
    values.add(ceilTo(total * 1.5, 50000));
    values.add(ceilTo(total * 2, 100000));
  }

  return Array.from(values)
    .filter((x) => x > total)
    .sort((a, b) => a - b)
    .slice(0, 5);
}

function getComboDisplayNameFromRule(
  rule: ComboRulePreview,
  cartItems: CartItem[]
) {
  const firstApp = rule.applications?.[0];
  const selectedItems = firstApp?.selectedItems || [];

  const names = selectedItems
    .map((x) => {
      const cartItem = cartItems.find((it) => it.variantId === x.productVariantId);

      const productName =
        String(x.productName || "").trim() ||
        String(cartItem?.productName || "").trim();

      const size =
        String(x.size || "").trim() ||
        String(cartItem?.size || "").trim();

      if (!productName) return null;
      return size ? `${productName} (${size})` : productName;
    })
    .filter(Boolean) as string[];

  const uniqueNames = Array.from(new Set(names));

  if (uniqueNames.length > 0) {
    return uniqueNames.join(" + ");
  }

  return rule.name || "Combo ưu đãi";
}

function getVariantGridColumns(count: number) {
  if (count <= 1) return "1fr";
  if (count === 2) return "repeat(2, minmax(0, 1fr))";
  return "repeat(3, minmax(0, 1fr))";
}

export default function PosOrderPage() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [sp] = useSearchParams();

  const specialModeHint = sp.get("special") === "1";

  const pickupNumber = Number(sp.get("pickup") || "");
  const heldOrderId = Number(sp.get("heldOrderId") || "");
  const isHeldMode = Number.isFinite(heldOrderId) && heldOrderId > 0;

  // POS Modernized Settings & Identification State
  const [posConfig, setPosConfig] = useState<PosSettingsData>(DEFAULT_SETTINGS);
  const [serviceMode, setServiceMode] = useState<string>("table");
  const [serviceIdentifier, setServiceIdentifier] = useState<string>("");
  const [customerNameInput, setCustomerNameInput] = useState<string>("");
  const [customerPhoneInput, setCustomerPhoneInput] = useState<string>("");
  const [manualDiscountPercent, setManualDiscountPercent] = useState<number>(0);
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [receiptOrderData, setReceiptOrderData] = useState<ReceiptOrderData | null>(null);

  const [mode, setMode] = useState<PageMode>("cart");

  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [combos, setCombos] = useState<MenuCombo[]>([]);
  const [activeCat, setActiveCat] = useState<string>("COFFEE");
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState<Record<CartKey, CartItem>>({});
  const [comboCart, setComboCart] = useState<Record<number, ComboCartItem>>({});
  const [selectedNoteKey, setSelectedNoteKey] = useState<CartKey | null>(null);

  const [phone, setPhone] = useState("");
  const [member, setMember] = useState<{
    id: number;
    fullName: string;
    points: number;
  } | null>(null);
  const [memberErr, setMemberErr] = useState<string | null>(null);
  const [findingMember, setFindingMember] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [quickCreateMsg, setQuickCreateMsg] = useState<string | null>(null);

  const [orderType, setOrderType] = useState<OrderType>(
    specialModeHint ? "TEST" : "NORMAL"
  );
  const [specialNote, setSpecialNote] = useState("");
  const [orderTypePickerOpen, setOrderTypePickerOpen] = useState(false);

  const [offerMode, setOfferMode] = useState<"voucher" | "promotion">(
    "voucher"
  );
  const [offerCode, setOfferCode] = useState("");
  const [appliedOfferCode, setAppliedOfferCode] = useState("");

  const [availablePromotions, setAvailablePromotions] = useState<
    PromotionListItem[]
  >([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);

  const [pricingPreview, setPricingPreview] = useState<PosOrderPricing | null>(
    null
  );
  const [selectedGiftItems, setSelectedGiftItems] = useState<
    PosSelectedGiftItem[]
  >([]);
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [giftPickerQtyMap, setGiftPickerQtyMap] = useState<
    Record<number, number>
  >({});
  const [giftPickerNotes, setGiftPickerNotes] = useState<
    Record<number, string>
  >({});
  const [pricingLoading, setPricingLoading] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [referenceCode, setReferenceCode] = useState("");
  const [cashPreset, setCashPreset] = useState<CashPresetValue>("exact");
  const [customCashInput, setCustomCashInput] = useState("");
  const [paymentChecked, setPaymentChecked] = useState(false);

  // VietQR gateway order + QR attempt state (transfer payment)
  const [gatewayOrderIdForVietqr, setGatewayOrderIdForVietqr] = useState<number | null>(null);
  const [vietqrQrImageUrl, setVietqrQrImageUrl] = useState<string | null>(null);
  const [vietqrOrderRef, setVietqrOrderRef] = useState<string | null>(null);
  const [vietqrExpiresAt, setVietqrExpiresAt] = useState<string | null>(null);
  const [vietqrRemainingSec, setVietqrRemainingSec] = useState<number>(0);

  const [comboPreviewLoading, setComboPreviewLoading] = useState(false);
  const [eligibleRules, setEligibleRules] = useState<ComboRulePreview[]>([]);
  const [suggestedRules, setSuggestedRules] = useState<ComboRuleSuggestedPreview[]>([]);
  const [selectedAppliedRules, setSelectedAppliedRules] = useState<
    PosAppliedComboRule[]
  >([]);

  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{
    id: number;
    orderCode: string;
    status: string;
    pickupNumber: number;
    finalAmount: number;
    earnedPoints: number;
    paymentMethod: string;
  } | null>(null);

  const [heldMeta, setHeldMeta] = useState<{
    id: number;
    orderCode: string;
    status: string;
    pickupNumber: number;
    finalAmount: number;
    subtotalAmount: number;
    promotionDiscountAmount: number;
    voucherDiscountAmount: number;
    totalDiscountAmount: number;
    createdAt: string;
  } | null>(null);

  const [loadingHeld, setLoadingHeld] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [shiftChecking, setShiftChecking] = useState(true);
  const [shiftBlockedMessage, setShiftBlockedMessage] = useState<string | null>(
    null
  );
  const [shiftWarning, setShiftWarning] = useState<string | null>(null);

  const effectivePickupNumber = heldMeta?.pickupNumber ?? pickupNumber;
  const effectivePickupOk = true;

  const { data: vietqrPaymentStatus } = usePaymentStatus(gatewayOrderIdForVietqr, {
    refetchInterval: 2000,
  });

  // Load POS Settings Config from storage & API
  useEffect(() => {
    const cached = localStorage.getItem("konekt_pos_config");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setPosConfig((prev) => ({ ...prev, ...parsed }));
        if (parsed.defaultServiceMode) {
          setServiceMode(parsed.defaultServiceMode);
        }
      } catch (e) {}
    }
    posGetStoreConfig()
      .then((res) => {
        if (res?.ok && res.config) {
          setPosConfig((prev) => ({ ...prev, ...res.config }));
          if (res.config.defaultServiceMode && !cached) {
            setServiceMode(res.config.defaultServiceMode);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingMenu(true);
      setShiftChecking(true);
      try {
        const [menuRes, shiftRes] = await Promise.all([
          posGetMenu(),
          getCurrentShiftReconciliation(),
        ]);

        setCats(menuRes.categories || []);
        setCombos(menuRes.combos || []);

        const hasCoffee = (menuRes.categories || []).some(
          (c) => c.key === "COFFEE"
        );
        setActiveCat(
          hasCoffee ? "COFFEE" : menuRes.categories?.[0]?.key || "COFFEE"
        );

        const current = shiftRes.current;
        if (!current) {
          setShiftBlockedMessage(
            "Chưa mở ca A/B, vui lòng mở ca trước khi tạo order"
          );
          setShiftWarning(null);
        } else {
          setShiftBlockedMessage(null);
          setShiftWarning(current.reconciliation.warning?.message || null);
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || e.message || "Load menu failed");
      } finally {
        setLoadingMenu(false);
        setShiftChecking(false);
      }
    })();
  }, [nav]);

  // VietQR: backend là nguồn sự thật => chỉ cho phép tạo bill khi payment đã PAID
  useEffect(() => {
    if (!gatewayOrderIdForVietqr) return;
    const st = vietqrPaymentStatus?.status;
    if (st === "PAID") {
      setPaymentChecked(true);
    } else {
      setPaymentChecked(false);
    }
  }, [gatewayOrderIdForVietqr, vietqrPaymentStatus?.status]);

  useEffect(() => {
    if (!vietqrExpiresAt) return;

    const tick = () => {
      const exp = new Date(vietqrExpiresAt).getTime();
      const remaining = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setVietqrRemainingSec(remaining);
    };

    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [vietqrExpiresAt]);

  useEffect(() => {
    if (!isHeldMode || !heldOrderId) return;

    (async () => {
      setLoadingHeld(true);
      try {
        const r = await posGetHeldOrderSnapshot(heldOrderId);
        setHeldMeta(r.order);

        const snap = r.snapshot?.snapshot || {};
        const snapItems = Array.isArray(snap.cartItems) ? snap.cartItems : [];
        const snapCombos = Array.isArray(snap.comboItems) ? snap.comboItems : [];
        const snapAppliedRules = Array.isArray(snap.selectedAppliedRules)
          ? snap.selectedAppliedRules
          : [];
        const snapSelectedGiftItems = Array.isArray(snap.selectedGiftItems)
          ? snap.selectedGiftItems
          : [];

        const nextCart: Record<CartKey, CartItem> = {};
        for (const it of snapItems) {
          nextCart[String(it.variantId)] = {
            variantId: Number(it.variantId),
            productName: String(it.productName || ""),
            size: String(it.size || ""),
            price: Number(it.price || 0),
            qty: Number(it.qty || 0),
            categoryKey: String(it.categoryKey || ""),
            note: it.note || undefined,
          };
        }

        const nextComboCart: Record<number, ComboCartItem> = {};
        for (const cb of snapCombos) {
          nextComboCart[Number(cb.comboId)] = {
            comboId: Number(cb.comboId),
            name: String(cb.name || ""),
            comboPrice: Number(cb.comboPrice || 0),
            qty: Number(cb.qty || 0),
            items: Array.isArray(cb.items)
              ? cb.items.map((x: any) => ({
                productVariantId: Number(x.productVariantId),
                productName: String(x.productName || ""),
                size: String(x.size || ""),
                quantity: Number(x.quantity || 0),
              }))
              : [],
          };
        }

        setCart(nextCart);
        setComboCart(nextComboCart);
        setSelectedAppliedRules(snapAppliedRules);
        setSelectedGiftItems(
          snapSelectedGiftItems.map((x: any) => ({
            productVariantId: Number(x.productVariantId),
            quantity: Number(x.quantity || 0),
            note: x.note || undefined,
          }))
        );
        setGiftPickerOpen(false);
        setGiftPickerQtyMap({});
        setGiftPickerNotes({});

        if (snap.member) {
          setMember({
            id: Number(snap.member.id),
            fullName: String(snap.member.fullName || ""),
            points: Number(snap.member.points || 0),
          });
          setPhone(String(snap.phone || ""));
        }

        if (snap.offerMode === "voucher" || snap.offerMode === "promotion") {
          setOfferMode(snap.offerMode);
        } else if (snap.appliedVoucherCode || snap.voucherCodeInput) {
          setOfferMode("voucher");
        }

        if (snap.offerCode) {
          setOfferCode(String(snap.offerCode));
        } else if (snap.voucherCodeInput) {
          setOfferCode(String(snap.voucherCodeInput));
        }

        if (snap.appliedOfferCode) {
          setAppliedOfferCode(String(snap.appliedOfferCode));
        } else if (snap.appliedVoucherCode) {
          setAppliedOfferCode(String(snap.appliedVoucherCode));
        }

        const heldOrderType = snap.orderType || r.order.orderType || "NORMAL";
        const heldServiceMode =
          snap.serviceMode ||
          (r.order as any).serviceMode ||
          "IN_STORE";

        setOrderType(heldOrderType as OrderType);
        setSpecialNote(String(snap.specialNote || r.order.specialNote || ""));
        setServiceMode(heldServiceMode as PosServiceMode);

        setPricingPreview({
          subtotalAmount: Number(r.order.subtotalAmount || 0),
          directTotalAmount: Number(r.order.subtotalAmount || 0),
          fixedComboTotalAmount: 0,
          ruleComboTotalAmount: 0,
          promotionDiscountAmount: Number(r.order.promotionDiscountAmount || 0),
          voucherDiscountAmount: Number(r.order.voucherDiscountAmount || 0),
          totalDiscountAmount: Number(r.order.totalDiscountAmount || 0),
          finalAmount: Number(r.order.finalAmount || 0),
          appliedVoucher: null,
          appliedPromotion: null,
          giftSelection: null,
          materializedGiftItems: [],
        });

        setMode("payment");
      } catch (e: any) {
        setError(
          e?.response?.data?.message || e.message || "Load held order failed"
        );
      } finally {
        setLoadingHeld(false);
      }
    })();
  }, [isHeldMode, heldOrderId]);

  const active = useMemo(
    () => cats.find((c) => c.key === activeCat),
    [cats, activeCat]
  );

  const cartItems = useMemo(
    () => Object.values(cart).filter((x) => x.qty > 0),
    [cart]
  );

  const comboItems = useMemo(
    () => Object.values(comboCart).filter((x) => x.qty > 0),
    [comboCart]
  );

  const directItemsSubtotal = useMemo(
    () => cartItems.reduce((s, x) => s + x.price * x.qty, 0),
    [cartItems]
  );

  const fixedComboSubtotal = useMemo(
    () => comboItems.reduce((s, x) => s + x.comboPrice * x.qty, 0),
    [comboItems]
  );

  const appliedRuleOriginalTotal = useMemo(() => {
    return eligibleRules
      .filter((rule) =>
        selectedAppliedRules.some((s) => s.comboRuleId === rule.comboRuleId)
      )
      .reduce((sum, rule) => {
        const selected = selectedAppliedRules.find(
          (s) => s.comboRuleId === rule.comboRuleId
        );
        if (!selected) return sum;

        const current = selected.selectedItems.reduce((s, x) => {
          const item = cartItems.find(
            (ci) => ci.variantId === x.productVariantId
          );
          return s + (item?.price || 0) * x.quantity;
        }, 0);

        return sum + current;
      }, 0);
  }, [eligibleRules, selectedAppliedRules, cartItems]);

  const appliedRuleComboTotal = useMemo(() => {
    return eligibleRules
      .filter((rule) =>
        selectedAppliedRules.some((s) => s.comboRuleId === rule.comboRuleId)
      )
      .reduce((sum, rule) => sum + rule.comboPrice, 0);
  }, [eligibleRules, selectedAppliedRules]);

  const appliedRuleSavings = useMemo(
    () => appliedRuleOriginalTotal - appliedRuleComboTotal,
    [appliedRuleOriginalTotal, appliedRuleComboTotal]
  );

  const total = useMemo(() => {
    return (
      directItemsSubtotal + fixedComboSubtotal - Math.max(0, appliedRuleSavings)
    );
  }, [directItemsSubtotal, fixedComboSubtotal, appliedRuleSavings]);

  const quickDiscountAmount = useMemo(() => {
    if (isSpecialOrderType(orderType)) return 0;
    if (manualDiscountPercent <= 0) return 0;
    const base = heldMeta?.subtotalAmount ?? pricingPreview?.subtotalAmount ?? total;
    return Math.round((base * manualDiscountPercent) / 100);
  }, [orderType, manualDiscountPercent, heldMeta?.subtotalAmount, pricingPreview?.subtotalAmount, total]);

  const payableTotal = useMemo(() => {
    if (isSpecialOrderType(orderType)) return 0;
    const raw = heldMeta?.finalAmount ?? pricingPreview?.finalAmount ?? total;
    return Math.max(0, raw - quickDiscountAmount);
  }, [orderType, heldMeta?.finalAmount, pricingPreview?.finalAmount, total, quickDiscountAmount]);

  const smartCashSuggestions = useMemo(
    () => getSmartCashSuggestions(payableTotal),
    [payableTotal]
  );

  const cashReceived = useMemo(() => {
    if (paymentMethod !== "cash") return payableTotal;
    if (cashPreset === "exact") return payableTotal;
    if (cashPreset === "custom") {
      const n = Number((customCashInput || "").replace(/[^\d]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    return Number(cashPreset);
  }, [paymentMethod, cashPreset, customCashInput, payableTotal]);

  const cashChange = useMemo(() => {
    if (paymentMethod !== "cash") return 0;
    return Math.max(0, cashReceived - payableTotal);
  }, [paymentMethod, cashReceived, payableTotal]);

  const cashShort = useMemo(() => {
    if (paymentMethod !== "cash") return 0;
    return Math.max(0, payableTotal - cashReceived);
  }, [paymentMethod, cashReceived, payableTotal]);

  const previewSnapshot = useMemo<PosCustomerPreviewSnapshot | null>(() => {
    const resolvedPickupNumber =
      created?.pickupNumber ??
      (effectivePickupOk ? effectivePickupNumber : null);

    if (resolvedPickupNumber == null) return null;

    return {
      pickupNumber: resolvedPickupNumber,
      mode,
      memberName: member?.fullName || null,
      phone: phone.trim() || null,
      orderType,
      specialNote: specialNote.trim() || null,
      offerMode: appliedOfferCode.trim() ? offerMode : undefined,
      appliedOfferCode: appliedOfferCode.trim() || null,
      pricing: {
        subtotalAmount:
          heldMeta?.subtotalAmount ??
          pricingPreview?.subtotalAmount ??
          total,
        promotionDiscountAmount:
          heldMeta?.promotionDiscountAmount ??
          pricingPreview?.promotionDiscountAmount ??
          0,
        voucherDiscountAmount:
          heldMeta?.voucherDiscountAmount ??
          pricingPreview?.voucherDiscountAmount ??
          0,
        totalDiscountAmount:
          heldMeta?.totalDiscountAmount ??
          pricingPreview?.totalDiscountAmount ??
          0,
        finalAmount:
          created?.finalAmount ??
          heldMeta?.finalAmount ??
          pricingPreview?.finalAmount ??
          payableTotal,
      },
      items: cartItems.map((item) => ({
        key: String(item.variantId),
        productName: item.productName,
        size: item.size || null,
        qty: item.qty,
        unitPrice: item.price,
        note: item.note || null,
        lineTotal: item.price * item.qty,
      })),
      combos: [
        ...comboItems.map((combo) => ({
          key: `fixed-${combo.comboId}`,
          name: combo.name,
          qty: combo.qty,
          comboPrice: combo.comboPrice,
          lineTotal: combo.comboPrice * combo.qty,
          items: combo.items.map((x) => ({
            productName: x.productName,
            size: x.size || null,
            quantity: x.quantity,
          })),
        })),
        ...(selectedAppliedRules
          .map((selected) => {
            const rule = eligibleRules.find(
              (x) => x.comboRuleId === selected.comboRuleId
            );
            if (!rule) return null;

            const app = rule.applications?.[0];
            return {
              key: `dynamic-${rule.comboRuleId}`,
              name: getComboDisplayNameFromRule(rule, cartItems),
              qty: 1,
              comboPrice: rule.comboPrice,
              lineTotal: rule.comboPrice,
              items: (app?.selectedItems || []).map((x) => ({
                productName: x.productName,
                size: x.size || null,
                quantity: 1,
              })),
            };
          })
          .filter(Boolean) as PosCustomerPreviewSnapshot["combos"]),
      ],
      selectedGiftItems: selectedGiftItems.map((gift) => ({
        productVariantId: gift.productVariantId,
        quantity: gift.quantity,
        note: gift.note || null,
      })),
      payment: {
        method: paymentMethod,
        gatewayOrderId: gatewayOrderIdForVietqr,
        orderRef: vietqrOrderRef,
        qrImageUrl: vietqrQrImageUrl,
        expiresAt: vietqrExpiresAt,
        status:
          vietqrPaymentStatus?.status ??
          (gatewayOrderIdForVietqr ? "PENDING" : null),
      },
      created: created
        ? {
          orderCode: created.orderCode,
          pickupNumber: created.pickupNumber,
          finalAmount: created.finalAmount,
          paymentMethod: created.paymentMethod,
          status: created.status,
        }
        : null,
      shiftBlockedMessage,
      updatedAt: new Date().toISOString(),
    };
  }, [
    mode,
    member?.fullName,
    phone,
    orderType,
    specialNote,
    offerMode,
    appliedOfferCode,
    heldMeta?.subtotalAmount,
    heldMeta?.promotionDiscountAmount,
    heldMeta?.voucherDiscountAmount,
    heldMeta?.totalDiscountAmount,
    heldMeta?.finalAmount,
    effectivePickupOk,
    effectivePickupNumber,
    pricingPreview?.subtotalAmount,
    pricingPreview?.promotionDiscountAmount,
    pricingPreview?.voucherDiscountAmount,
    pricingPreview?.totalDiscountAmount,
    pricingPreview?.finalAmount,
    total,
    payableTotal,
    cartItems,
    comboItems,
    selectedAppliedRules,
    eligibleRules,
    selectedGiftItems,
    paymentMethod,
    gatewayOrderIdForVietqr,
    vietqrOrderRef,
    vietqrQrImageUrl,
    vietqrExpiresAt,
    vietqrPaymentStatus?.status,
    created,
    shiftBlockedMessage,
  ]);

  useEffect(() => {
    if (!previewSnapshot) return;
    publishPosCustomerPreview(previewSnapshot);
  }, [previewSnapshot]);

  /** Danh mục thật của sản phẩm (POS cần khi thêm từ tab BEST_SELLER — combo/upsell theo categoryKey). */
  const productIdToCategoryKey = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of cats) {
      if (c.key === "BEST_SELLER") continue;
      for (const p of c.products) {
        if (p.id == null) continue;
        const id = Number(p.id);
        if (Number.isFinite(id)) m.set(id, c.key);
      }
    }
    return m;
  }, [cats]);

  const cartCategoryKeyForProduct = (activeCategory: string, productId: number | undefined) => {
    if (activeCategory !== "BEST_SELLER") return activeCategory;
    if (productId != null) {
      const real = productIdToCategoryKey.get(Number(productId));
      if (real) return real;
    }
    return activeCategory;
  };

  const allProductsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;

    const out: Array<{
      categoryKey: string;
      productId?: number;
      productName: string;
      variants: MenuVariant[];
    }> = [];

    for (const c of cats) {
      for (const p of c.products) {
        const matchedVariants = p.variants.filter((v) => {
          const hay = `${p.name} ${v.size} ${v.sku || ""}`.toLowerCase();
          return hay.includes(q);
        });

        if (matchedVariants.length) {
          out.push({
            categoryKey: c.key,
            productId: p.id,
            productName: p.name,
            variants: matchedVariants,
          });
        }
      }
    }

    return out;
  }, [cats, search]);

  const cartVariantIds = useMemo(() => {
    const s = new Set<number>();
    for (const it of cartItems) s.add(it.variantId);
    return s;
  }, [cartItems]);

  const suggestedCombos = useMemo(() => {
    const suggestions = combos
      .map((combo) => {
        const matchCount = combo.items.filter((x) =>
          cartVariantIds.has(x.productVariantId)
        ).length;
        const totalCount = combo.items.length;
        return { combo, matchCount, totalCount };
      })
      .filter((x) => x.matchCount > 0 && x.matchCount < x.totalCount)
      .sort(
        (a, b) =>
          b.matchCount - a.matchCount ||
          (b.combo.priority || 0) - (a.combo.priority || 0)
      )
      .slice(0, 6);

    return suggestions.map((x) => x.combo);
  }, [combos, cartVariantIds]);


  const displayCartRows = useMemo<DisplayCartRow[]>(() => {
    const rows: DisplayCartRow[] = [];

    for (const it of cartItems) {
      rows.push({
        type: "item",
        key: `item-${it.variantId}`,
        item: it,
      });
    }

    for (const cb of comboItems) {
      rows.push({
        type: "combo",
        key: `fixed-${cb.comboId}`,
        combo: {
          key: `fixed-${cb.comboId}`,
          type: "fixed",
          comboId: cb.comboId,
          name: cb.name,
          price: cb.comboPrice,
          qty: cb.qty,
          description: cb.items
            .map((x) => `${x.quantity} x ${x.productName} (${x.size})`)
            .join(" + "),
        },
      });
    }

    for (const selected of selectedAppliedRules) {
      const rule = eligibleRules.find(
        (r) => r.comboRuleId === selected.comboRuleId
      );
      if (!rule) continue;

      const firstApp = rule.applications?.[0];
      const description =
        firstApp?.selectedItems
          ?.map((x) => `${x.productName}${x.size ? ` (${x.size})` : ""}`)
          .join(" + ") || "";

      rows.push({
        type: "combo",
        key: `dynamic-${rule.comboRuleId}`,
        combo: {
          key: `dynamic-${rule.comboRuleId}`,
          type: "dynamic",
          comboRuleId: rule.comboRuleId,
          name: getComboDisplayNameFromRule(rule, cartItems),
          price: rule.comboPrice,
          qty: 1,
          description,
        },
      });
    }

    return rows;
  }, [cartItems, comboItems, selectedAppliedRules, eligibleRules]);

  const refreshPricingPreview = async (
    code?: string,
    modeArg?: "voucher" | "promotion",
    selectedGiftItemsArg?: PosSelectedGiftItem[]
  ) => {
    if (heldMeta) return;

    const hasAny = cartItems.length > 0 || comboItems.length > 0;
    if (!hasAny) {
      setPricingPreview(null);
      setGiftPickerOpen(false);
      return;
    }

    const finalMode = modeArg ?? offerMode;
    const finalCode = (code ?? appliedOfferCode ?? "").trim() || undefined;
    const finalSelectedGiftItems = selectedGiftItemsArg ?? selectedGiftItems;

    setPricingLoading(true);
    try {
      const r = await posPreviewOrderPricing({
        customerId: member?.id,
        voucherCode: finalMode === "voucher" ? finalCode : undefined,
        promotionCode: finalMode === "promotion" ? finalCode : undefined,
        orderType,
        specialNote,
        selectedGiftItems: finalSelectedGiftItems,
        items: cartItems.map((x) => ({
          productVariantId: x.variantId,
          quantity: x.qty,
          note: x.note || undefined,
        })),
        combos: comboItems.map((x) => ({
          comboId: x.comboId,
          quantity: x.qty,
        })),
        appliedComboRules: selectedAppliedRules,
      });

      setPricingPreview(r.pricing);
      setError(null);

      if (r.pricing?.giftSelection?.required) {
        setGiftPickerOpen(true);
      } else {
        setGiftPickerOpen(false);
      }
    } catch (e: any) {
      setPricingPreview(null);
      setGiftPickerOpen(false);
      setError(
        e?.response?.data?.message || e.message || "Preview pricing failed"
      );
    } finally {
      setPricingLoading(false);
    }
  };

  useEffect(() => {
    if (heldMeta) return;

    const hasAny = cartItems.length > 0 || comboItems.length > 0;
    if (!hasAny) {
      setPricingPreview(null);
      setGiftPickerOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      refreshPricingPreview();
    }, 250);

    return () => clearTimeout(timer);
  }, [
    cartItems,
    comboItems,
    selectedAppliedRules,
    selectedGiftItems,
    member?.id,
    appliedOfferCode,
    offerMode,
    orderType,
    specialNote,
    heldMeta,
  ]);

  const resetComboState = () => {
    setEligibleRules([]);
    setSuggestedRules([]);
    setSelectedAppliedRules([]);
    setComboCart({});
  };

  const resetOfferStateForOrderTypeChange = () => {
    setAppliedOfferCode("");
    setOfferCode("");
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
    setPricingPreview(null);
    setPaymentChecked(false);
    setError(null);
  };

  const addVariant = (
    categoryKey: string,
    productName: string,
    v: MenuVariant
  ) => {
    const key = String(v.id);

    setCart((p) => {
      const cur = p[key];
      const nextQty = (cur?.qty || 0) + 1;
      return {
        ...p,
        [key]: {
          variantId: v.id,
          productName,
          size: v.size,
          price: v.price,
          qty: nextQty,
          categoryKey,
          note: cur?.note,
        },
      };
    });

    resetComboState();
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
    setError(null);
  };

  const dec = (variantId: number) => {
    const key = String(variantId);

    setCart((p) => {
      const cur = p[key];
      if (!cur) return p;
      return {
        ...p,
        [key]: {
          ...cur,
          qty: Math.max(0, cur.qty - 1),
        },
      };
    });

    resetComboState();
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
  };

  const inc = (variantId: number) => {
    const key = String(variantId);

    setCart((p) => {
      const cur = p[key];
      if (!cur) return p;
      return {
        ...p,
        [key]: {
          ...cur,
          qty: cur.qty + 1,
        },
      };
    });

    resetComboState();
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
  };

  const setItemNote = (variantId: number, note: string) => {
    const key = String(variantId);
    setCart((p) => {
      const cur = p[key];
      if (!cur) return p;
      return { ...p, [key]: { ...cur, note } };
    });
  };

  const addCombo = (combo: MenuCombo) => {
    if (appliedOfferCode) {
      setError("Đơn đang áp ưu đãi, không được chọn combo");
      return;
    }

    setSelectedAppliedRules([]);
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});

    setComboCart({
      [combo.id]: {
        comboId: combo.id,
        name: combo.name,
        comboPrice: combo.comboPrice,
        qty: 1,
        items: combo.items.map((x) => ({
          productVariantId: x.productVariantId,
          productName: x.productName,
          size: x.size,
          quantity: x.quantity,
        })),
      },
    });

    setError(null);
    setMode("cart");
  };

  const removeDisplayCombo = (combo: DisplayComboItem) => {
    if (combo.type === "fixed") {
      setComboCart({});
      setSelectedGiftItems([]);
      setGiftPickerOpen(false);
      setGiftPickerQtyMap({});
      setGiftPickerNotes({});
      return;
    }

    if (combo.type === "dynamic" && combo.comboRuleId) {
      setSelectedAppliedRules((prev) =>
        prev.filter((x) => x.comboRuleId !== combo.comboRuleId)
      );
      setSelectedGiftItems([]);
      setGiftPickerOpen(false);
      setGiftPickerQtyMap({});
      setGiftPickerNotes({});
    }
  };

  const findMember = async () => {
    const p = phone.trim();
    if (p.length < 8) {
      setMember(null);
      setMemberErr("Số điện thoại không hợp lệ");
      return;
    }

    setFindingMember(true);
    setMemberErr(null);

    try {
      const r = await posFindMember(p);
      setMember(r.member);

      if (!r.member) {
        setMemberErr("Không tìm thấy member");
        setQuickCreateMsg(null);
      } else {
        setQuickCreateOpen(false);
        setQuickCreateName("");
        setQuickCreateMsg(null);
      }
    } catch (e: any) {
      setMember(null);
      setMemberErr(
        e?.response?.data?.message || e.message || "Find member failed"
      );
    } finally {
      setFindingMember(false);
    }
  };

  const quickCreateMember = async () => {
    const p = phone.trim();
    const fullName = quickCreateName.trim();

    if (!/^[0-9]{10}$/.test(p)) {
      setMemberErr("Số điện thoại không hợp lệ");
      return;
    }

    if (!fullName) {
      setMemberErr("Nhập tên khách");
      return;
    }

    setQuickCreateLoading(true);
    setMemberErr(null);
    setQuickCreateMsg(null);

    try {
      const r = await posQuickCreateMember({
        phone: p,
        fullName,
      });

      setMember(r.member);
      setQuickCreateOpen(false);
      setQuickCreateName("");
      setQuickCreateMsg(
        `Đã tạo member nhanh. Mật khẩu tạm: ${r.tempPassword}. Khách đăng nhập lần đầu sẽ phải đổi mật khẩu.`
      );
    } catch (e: any) {
      setMemberErr(
        e?.response?.data?.message || e.message || "Tạo member thất bại"
      );
    } finally {
      setQuickCreateLoading(false);
    }
  };

  const applyOffer = async () => {
    const code = offerCode.trim();
    if (!code) {
      setAppliedOfferCode("");
      setPricingPreview(null);
      return;
    }

    if (isSpecialOrderType(orderType)) {
      setError("Đơn đặc biệt không được áp voucher/promotion");
      return;
    }

    if (comboItems.length > 0 || selectedAppliedRules.length > 0) {
      setError("Đang có combo trong đơn, không thể áp ưu đãi");
      return;
    }

    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
    setAppliedOfferCode(code);
    await refreshPricingPreview(code, offerMode, []);
  };

  const applyPromotionFromList = async (promo: PromotionListItem) => {
    setError(null);

    if (isSpecialOrderType(orderType)) {
      setError("Đơn đặc biệt không được áp voucher/promotion");
      return;
    }

    if (comboItems.length > 0 || selectedAppliedRules.length > 0) {
      setError("Đang có combo trong đơn, không thể áp promotion");
      return;
    }

    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
    setOfferMode("promotion");
    setOfferCode(promo.code);
    setAppliedOfferCode(promo.code);

    try {
      await refreshPricingPreview(promo.code, "promotion", []);
      setMode("cart");
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e.message || "Áp promotion thất bại"
      );
    }
  };

  const clearOffer = async () => {
    setOfferCode("");
    setAppliedOfferCode("");
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});

    if (heldMeta) {
      setPricingPreview(null);
      return;
    }

    try {
      await refreshPricingPreview("", offerMode, []);
    } catch {
      setPricingPreview(null);
    }
  };

  const confirmGiftSelection = async () => {
    if (!pricingPreview?.giftSelection) return;

    const expectedQty = Number(pricingPreview.giftSelection.expectedQty || 0);
    const selected = buildSelectedGiftItemsFromMap({
      qtyMap: giftPickerQtyMap,
      notes: giftPickerNotes,
    });

    const totalQty = selected.reduce((s, x) => s + x.quantity, 0);

    if (totalQty !== expectedQty) {
      setError(`Cần chọn đúng ${expectedQty} món tặng`);
      return;
    }

    setSelectedGiftItems(selected);
    setGiftPickerOpen(false);
    setError(null);

    await refreshPricingPreview(appliedOfferCode, offerMode, selected);
  };

  const clearGiftSelection = async () => {
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setError(null);

    await refreshPricingPreview(appliedOfferCode, offerMode, []);
  };

  const clearMember = () => {
    setMember(null);
    setPhone("");
    setMemberErr(null);
    setQuickCreateOpen(false);
    setQuickCreateName("");
    setQuickCreateMsg(null);
    setOfferCode("");
    setAppliedOfferCode("");
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
    setPricingPreview(null);
    setOrderType(specialModeHint ? "TEST" : "NORMAL");
    setSpecialNote("");
    setServiceMode("IN_STORE");
  };

  const fetchComboPreview = async (items?: CartItem[]) => {
    const sourceItems = items || cartItems;

    if (!sourceItems.length) {
      setEligibleRules([]);
      setSuggestedRules([]);
      return { eligibleRules: [], suggestedRules: [] };
    }

    const r = await previewComboRules(
      sourceItems.map((x) => ({
        productVariantId: x.variantId,
        quantity: x.qty,
      }))
    );

    const nextEligible = r.eligibleRules || [];
    const nextSuggested = (r.suggestedRules || []).filter(
      (s) => !nextEligible.some((e) => e.comboRuleId === s.comboRuleId)
    );

    setEligibleRules(nextEligible);
    setSuggestedRules(nextSuggested);

    return {
      eligibleRules: nextEligible,
      suggestedRules: nextSuggested,
    };
  };

  const openComboStep = async () => {
    setError(null);

    if (appliedOfferCode) {
      return setError("Đơn đang áp ưu đãi, không được chọn combo");
    }

    if (!cartItems.length && !comboItems.length) {
      return setError("Chưa có món trong giỏ");
    }

    setMode("combo");

    if (!cartItems.length) {
      setEligibleRules([]);
      setSuggestedRules([]);
      return;
    }

    setComboPreviewLoading(true);
    try {
      const preview = await fetchComboPreview();
      if (
        !preview.eligibleRules.length &&
        !preview.suggestedRules.length &&
        !suggestedCombos.length
      ) {
        setError("Chưa có combo phù hợp với giỏ hàng hiện tại");
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Preview combo failed");
    } finally {
      setComboPreviewLoading(false);
    }
  };

  const openPromotionStep = async () => {
    setError(null);

    if (isSpecialOrderType(orderType)) {
      setError("Đơn đặc biệt không được áp voucher/promotion");
      return;
    }

    if (!cartItems.length && !comboItems.length) {
      return setError("Chưa có món trong giỏ");
    }

    if (comboItems.length > 0 || selectedAppliedRules.length > 0) {
      return setError("Đơn đang có combo, không thể chọn promotion");
    }

    setMode("promotion");
    setLoadingPromotions(true);

    try {
      const r = await posListAvailablePromotions({
        customerId: member?.id,
        items: cartItems.map((x) => ({
          productVariantId: x.variantId,
          quantity: x.qty,
        })),
        combos: comboItems.map((x) => ({
          comboId: x.comboId,
          quantity: x.qty,
        })),
        appliedComboRules: selectedAppliedRules.map((rule) => ({
          comboRuleId: rule.comboRuleId,
          selectedItems: rule.selectedItems.map((item) => ({
            productVariantId: item.productVariantId,
            quantity: item.quantity,
          })),
        })),
      });

      setAvailablePromotions(
        (r.promotions || []).map((x) => ({
          id: Number(x.id),
          code: String(x.code),
          name: String(x.name),
          promotionType: String(x.promotionType),
          discountAmount:
            x.discountAmount != null ? Number(x.discountAmount) : null,
          discountPercent:
            x.discountPercent != null ? Number(x.discountPercent) : null,
          maxDiscountAmount:
            x.maxDiscountAmount != null ? Number(x.maxDiscountAmount) : null,
          minOrderAmount: Number(x.minOrderAmount || 0),
          startAt: x.startAt,
          endAt: x.endAt,
          description: x.description || null,
        }))
      );
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
        e.message ||
        "Không tải được danh sách promotion"
      );
    } finally {
      setLoadingPromotions(false);
    }
  };

  const applyRuleFromPreview = (rule: ComboRulePreview) => {
    if (appliedOfferCode) {
      setError("Đơn đang áp ưu đãi, không được áp combo");
      return;
    }

    if (!rule.applications?.length) return;

    const firstApp = rule.applications[0];

    setComboCart({});
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
    setSelectedAppliedRules([
      {
        comboRuleId: rule.comboRuleId,
        selectedItems: firstApp.selectedItems.map((x) => ({
          productVariantId: x.productVariantId,
          quantity: 1,
        })),
      },
    ]);

    setError(null);
    setMode("cart");
  };

  const applySuggestedRule = async (rule: ComboRuleSuggestedPreview) => {
    setError(null);

    try {
      const nextCartMap: Record<CartKey, CartItem> = { ...cart };

      for (const missing of rule.missingItems) {
        const addKey = String(missing.productVariantId);
        const existing = nextCartMap[addKey];

        nextCartMap[addKey] = {
          variantId: missing.productVariantId,
          productName: missing.productName,
          size: missing.size || "",
          price: Number(missing.unitPrice || 0),
          qty: (existing?.qty || 0) + 1,
          categoryKey: String(
            missing.categoryKey || missing.categoryName || "OTHERS"
          ),
          note: existing?.note,
        };
      }

      const nextCartItems = Object.values(nextCartMap).filter((x) => x.qty > 0);

      setCart(nextCartMap);
      setComboCart({});
      setSelectedGiftItems([]);
      setGiftPickerOpen(false);
      setGiftPickerQtyMap({});
      setGiftPickerNotes({});

      const preview = await fetchComboPreview(nextCartItems);
      const matchedRule = preview.eligibleRules.find(
        (x) => x.comboRuleId === rule.comboRuleId
      );

      if (!matchedRule || !matchedRule.applications?.length) {
        setError("Da them mon nhung khong tim thay combo de ap dung");
        setMode("cart");
        return;
      }

      const firstApp = matchedRule.applications[0];

      setSelectedAppliedRules([
        {
          comboRuleId: matchedRule.comboRuleId,
          selectedItems: firstApp.selectedItems.map((x) => ({
            productVariantId: x.productVariantId,
            quantity: 1,
          })),
        },
      ]);

      setMode("cart");
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
        e.message ||
        "Thêm upsell và áp dụng combo failed"
      );
    }
  };



  const goToPaymentStep = () => {
    setError(null);

    if (isSpecialOrderType(orderType) && !specialNote.trim()) {
      return setError("Đơn đặc biệt bắt buộc nhập lý do / ghi chú");
    }

    if (!cartItems.length && !comboItems.length) {
      return setError("Chưa có món trong giỏ");
    }
    if (pricingPreview?.giftSelection?.required) {
      setGiftPickerOpen(true);
      return setError("Cần chọn món tặng trước khi qua bước thanh toán");
    }

    if (isSpecialOrderType(orderType)) {
      setPaymentChecked(true);
      setPaymentMethod("cash");
      setReferenceCode("");
      setCashPreset("exact");
      setCustomCashInput("");
      setMode("payment");
      return;
    }

    setMode("payment");
    setPaymentChecked(false);
  };

  const backToCartStep = () => {
    setMode("cart");
    setPaymentChecked(false);
  };

  const confirmPaymentInfo = () => {
    setError(null);

    if (isSpecialOrderType(orderType)) {
      setPaymentChecked(true);
      return;
    }

    // VietQR gateway: cashier không cần nhập reference thủ công
    if (paymentMethod === "transfer" && gatewayOrderIdForVietqr) {
      const st = vietqrPaymentStatus?.status;
      if (st === "PAID") setPaymentChecked(true);
      else {
        setPaymentChecked(false);
        setError("Chưa thanh toán xong. Vui lòng để khách quét QR trên màn hình khách và đợi hệ thống tự xác nhận.");
      }
      return;
    }

    if (paymentMethod === "cash" && cashReceived < payableTotal) {
      return setError("Số tiền khách đưa chưa đủ để thanh toán");
    }

    if (paymentMethod === "transfer" && !referenceCode.trim()) {
      return setError("Vui lòng tạo QR VietQR trước khi xác nhận thanh toán");
    }

    setPaymentChecked(true);
  };

  const orderBlocked = !!shiftBlockedMessage;
  const editingLocked = !!heldMeta || !!gatewayOrderIdForVietqr;

  const holdCurrentOrder = async () => {
    setError(null);

    if (orderBlocked) {
      return setError("Chưa mở ca A/B, không thể giữ đơn");
    }

    if (isHeldMode) {
      return setError("Đang mở đơn giữ, không thể giữ lại thêm lần nữa");
    }

    if (!cartItems.length && !comboItems.length) {
      return setError("Chưa có món trong giỏ");
    }

    if (pricingPreview?.giftSelection?.required) {
      setGiftPickerOpen(true);
      return setError("Cần chọn món tặng trước khi giữ đơn");
    }

    if (isSpecialOrderType(orderType) && !specialNote.trim()) {
      return setError("Đơn đặc biệt bắt buộc nhập lý do / ghi chú");
    }

    setCreating(true);
    try {
      const trimmedOfferCode = appliedOfferCode.trim() || undefined;

      const r = await posHoldOrder({
        pickupNumber: serviceMode === "table_marker" ? Number(serviceIdentifier) || undefined : undefined,
        customerId: member?.id,
        voucherCode: offerMode === "voucher" ? trimmedOfferCode : undefined,
        promotionCode: offerMode === "promotion" ? trimmedOfferCode : undefined,
        orderType,
        serviceMode,
        serviceIdentifier: serviceIdentifier.trim() || undefined,
        customerName: (serviceMode === "customer_name" ? customerNameInput.trim() : member?.fullName) || undefined,
        customerPhone: (serviceMode === "customer_name" ? customerPhoneInput.trim() : phone.trim()) || undefined,
        specialNote: specialNote.trim() || undefined,
        selectedGiftItems,
        items: cartItems.map((x) => ({
          productVariantId: x.variantId,
          quantity: x.qty,
          note: x.note || undefined,
        })),
        combos: comboItems.map((x) => ({
          comboId: x.comboId,
          quantity: x.qty,
        })),
        appliedComboRules: selectedAppliedRules,
        snapshot: {
          cartItems,
          comboItems,
          selectedAppliedRules,
          member,
          phone,
          offerMode,
          offerCode,
          appliedOfferCode,
          selectedGiftItems,
          orderType,
          serviceMode,
          serviceIdentifier,
          customerName: customerNameInput,
          customerPhone: customerPhoneInput,
          specialNote,
        },
      });

      setShiftWarning(r.shiftWarning?.message || null);
      nav("/pos/held", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || "Hold order failed");
    } finally {
      setCreating(false);
    }
  };

  const createOrder = async () => {
    setError(null);

    // VietQR gateway: order đã được tạo trước đó, chỉ cần đợi callback => PAID rồi "hoàn tất"
    if (gatewayOrderIdForVietqr) {
      if (vietqrPaymentStatus?.status !== "PAID") {
        return setError("Chưa thanh toán xong. Vui lòng đợi trạng thái PAID từ backend.");
      }

      const sLabel = SERVICE_MODE_OPTIONS.find((m) => m.id === serviceMode)?.label || "Số Bàn";
      setReceiptOrderData({
        orderId: gatewayOrderIdForVietqr,
        orderCode: vietqrOrderRef || `VQR-${Date.now()}`,
        createdAt: new Date().toLocaleString("vi-VN"),
        cashierName: user?.fullName || user?.username || "Thu ngân",
        serviceModeLabel: sLabel,
        serviceIdentifier: serviceIdentifier.trim() || undefined,
        customerName: (serviceMode === "customer_name" ? customerNameInput.trim() : member?.fullName) || undefined,
        customerPhone: (serviceMode === "customer_name" ? customerPhoneInput.trim() : phone.trim()) || undefined,
        items: cartItems.map((it) => ({
          name: it.productName,
          size: it.size || undefined,
          qty: it.qty,
          price: it.price,
          note: it.note,
        })),
        combos: comboItems.map((cb) => ({
          name: cb.name,
          qty: cb.qty,
          price: cb.comboPrice,
        })),
        giftItems: selectedGiftItems.map((g) => ({
          name: `Món quà #${g.productVariantId}`,
          qty: g.quantity,
        })),
        subtotal: total,
        discountAmount: quickDiscountAmount + (pricingPreview?.totalDiscountAmount || 0),
        discountReason: manualDiscountPercent > 0 ? `Giảm ${manualDiscountPercent}%` : undefined,
        finalAmount: payableTotal,
        paymentMethod: "transfer",
      });
      setReceiptModalOpen(true);
      return;
    }

    if (orderBlocked) {
      return setError(
        heldMeta
          ? "Chưa mở ca A/B, không thể thanh toán đơn giữ"
          : "Chưa mở ca A/B, không thể tạo đơn"
      );
    }

    if (!paymentChecked) {
      return setError("Cần xác nhận thông tin thanh toán trước");
    }

    if (pricingPreview?.giftSelection?.required) {
      setGiftPickerOpen(true);
      return setError("Cần chọn món tặng trước khi tạo đơn");
    }

    if (isSpecialOrderType(orderType) && !specialNote.trim()) {
      return setError("Đơn đặc biệt bắt buộc nhập lý do / ghi chú");
    }

    setCreating(true);
    try {
      const trimmedOfferCode = appliedOfferCode.trim() || undefined;

      const r = heldMeta
        ? await posPayHeldOrder(heldMeta.id, {
          orderType,
          serviceMode,
          specialNote: specialNote.trim() || undefined,
          payment: {
            method: isSpecialOrderType(orderType) ? "cash" : paymentMethod,
            amount: isSpecialOrderType(orderType) ? 0 : payableTotal,
            referenceCode:
              !isSpecialOrderType(orderType) && paymentMethod === "transfer"
                ? referenceCode.trim()
                : undefined,
          },
        })
        : await posCreateOrder({
          pickupNumber: serviceMode === "table_marker" ? Number(serviceIdentifier) || undefined : undefined,
          customerId: member?.id,
          voucherCode: offerMode === "voucher" ? trimmedOfferCode : undefined,
          promotionCode:
            offerMode === "promotion" ? trimmedOfferCode : undefined,
          orderType,
          serviceMode,
          serviceIdentifier: serviceIdentifier.trim() || undefined,
          customerName: (serviceMode === "customer_name" ? customerNameInput.trim() : member?.fullName) || undefined,
          customerPhone: (serviceMode === "customer_name" ? customerPhoneInput.trim() : phone.trim()) || undefined,
          discountReason: manualDiscountPercent > 0 ? `Giảm ${manualDiscountPercent}%` : undefined,
          discountAmount: quickDiscountAmount + (pricingPreview?.totalDiscountAmount || 0),
          specialNote: specialNote.trim() || undefined,
          selectedGiftItems,
          items: cartItems.map((x) => ({
            productVariantId: x.variantId,
            quantity: x.qty,
            note: x.note || undefined,
          })),
          combos: comboItems.map((x) => ({
            comboId: x.comboId,
            quantity: x.qty,
          })),
          appliedComboRules: selectedAppliedRules,
          payment: {
            method: isSpecialOrderType(orderType) ? "cash" : paymentMethod,
            amount: isSpecialOrderType(orderType) ? 0 : payableTotal,
            referenceCode:
              !isSpecialOrderType(orderType) && paymentMethod === "transfer"
                ? referenceCode.trim()
                : undefined,
          },
        });

      setShiftWarning(r.shiftWarning?.message || null);

      setCreated({
        id: r.order.id,
        orderCode: r.order.orderCode,
        status: r.order.status,
        pickupNumber: r.order.pickupNumber,
        finalAmount: r.order.finalAmount,
        earnedPoints: Number(r.earnedPoints || 0),
        paymentMethod: r.payment?.method || paymentMethod,
      });

      publishPosCustomerPreview({
        pickupNumber: r.order.pickupNumber,
        mode: "payment",
        memberName: member?.fullName || null,
        phone: phone.trim() || null,
        orderType,
        specialNote: specialNote.trim() || null,
        offerMode: appliedOfferCode.trim() ? offerMode : undefined,
        appliedOfferCode: appliedOfferCode.trim() || null,
        pricing: {
          subtotalAmount:
            r.pricing?.subtotalAmount ??
            heldMeta?.subtotalAmount ??
            pricingPreview?.subtotalAmount ??
            total,
          promotionDiscountAmount:
            r.pricing?.promotionDiscountAmount ??
            heldMeta?.promotionDiscountAmount ??
            pricingPreview?.promotionDiscountAmount ??
            0,
          voucherDiscountAmount:
            r.pricing?.voucherDiscountAmount ??
            heldMeta?.voucherDiscountAmount ??
            pricingPreview?.voucherDiscountAmount ??
            0,
          totalDiscountAmount:
            r.pricing?.totalDiscountAmount ??
            heldMeta?.totalDiscountAmount ??
            pricingPreview?.totalDiscountAmount ??
            0,
          finalAmount: r.order.finalAmount,
        },
        items: cartItems.map((item) => ({
          key: String(item.variantId),
          productName: item.productName,
          size: item.size || null,
          qty: item.qty,
          unitPrice: item.price,
          note: item.note || null,
          lineTotal: item.price * item.qty,
        })),
        combos: [
          ...comboItems.map((combo) => ({
            key: `fixed-${combo.comboId}`,
            name: combo.name,
            qty: combo.qty,
            comboPrice: combo.comboPrice,
            lineTotal: combo.comboPrice * combo.qty,
            items: combo.items.map((x) => ({
              productName: x.productName,
              size: x.size || null,
              quantity: x.quantity,
            })),
          })),
          ...(selectedAppliedRules
            .map((selected) => {
              const rule = eligibleRules.find(
                (x) => x.comboRuleId === selected.comboRuleId
              );
              if (!rule) return null;

              const app = rule.applications?.[0];
              return {
                key: `dynamic-${rule.comboRuleId}`,
                name: getComboDisplayNameFromRule(rule, cartItems),
                qty: 1,
                comboPrice: rule.comboPrice,
                lineTotal: rule.comboPrice,
                items: (app?.selectedItems || []).map((x) => ({
                  productName: x.productName,
                  size: x.size || null,
                  quantity: 1,
                })),
              };
            })
            .filter(Boolean) as PosCustomerPreviewSnapshot["combos"]),
        ],
        selectedGiftItems: selectedGiftItems.map((gift) => ({
          productVariantId: gift.productVariantId,
          quantity: gift.quantity,
          note: gift.note || null,
        })),
        payment: {
          method: paymentMethod,
          gatewayOrderId: gatewayOrderIdForVietqr,
          orderRef: vietqrOrderRef,
          qrImageUrl: vietqrQrImageUrl,
          expiresAt: vietqrExpiresAt,
          status:
            vietqrPaymentStatus?.status ??
            (gatewayOrderIdForVietqr ? "PENDING" : null),
        },
        created: {
          orderCode: r.order.orderCode,
          pickupNumber: r.order.pickupNumber,
          finalAmount: r.order.finalAmount,
          paymentMethod: r.payment?.method || paymentMethod,
          status: r.order.status,
        },
        shiftBlockedMessage,
        updatedAt: new Date().toISOString(),
      });

      // Mở Modal Hóa Đơn In Nhiệt Chuyên Nghiệp
      const serviceModeLabel = SERVICE_MODE_OPTIONS.find((m) => m.id === serviceMode)?.label || "Số Bàn";
      setReceiptOrderData({
        orderId: r.order.id,
        orderCode: r.order.orderCode,
        createdAt: new Date().toLocaleString("vi-VN"),
        cashierName: user?.fullName || user?.username || "Thu ngân",
        serviceModeLabel,
        serviceIdentifier: serviceIdentifier.trim() || undefined,
        customerName: (serviceMode === "customer_name" ? customerNameInput.trim() : member?.fullName) || undefined,
        customerPhone: (serviceMode === "customer_name" ? customerPhoneInput.trim() : phone.trim()) || undefined,
        items: cartItems.map((item) => ({
          name: item.productName,
          size: item.size || undefined,
          qty: item.qty,
          price: item.price,
          note: item.note,
        })),
        combos: comboItems.map((cb) => ({
          name: cb.name,
          qty: cb.qty,
          price: cb.comboPrice,
        })),
        giftItems: selectedGiftItems.map((g) => ({
          name: `Món quà #${g.productVariantId}`,
          qty: g.quantity,
        })),
        subtotal: total,
        discountAmount: quickDiscountAmount + (pricingPreview?.totalDiscountAmount || 0),
        discountReason: manualDiscountPercent > 0 ? `Giảm ${manualDiscountPercent}%` : undefined,
        finalAmount: r.order.finalAmount,
        paymentMethod: r.payment?.method || paymentMethod,
        cashReceived: paymentMethod === "cash" ? cashReceived : undefined,
        changeAmount: paymentMethod === "cash" ? cashChange : undefined,
      });
      setReceiptModalOpen(true);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
        e.message ||
        (heldMeta ? "Pay held order failed" : "Create order failed")
      );
    } finally {
      setCreating(false);
    }
  };

  const handleNewOrder = () => {
    setReceiptModalOpen(false);
    setReceiptOrderData(null);
    setHeldMeta(null);
    setCart({});
    setComboCart({});
    setEligibleRules([]);
    setSelectedAppliedRules([]);
    setSelectedGiftItems([]);
    setGiftPickerOpen(false);
    setGiftPickerQtyMap({});
    setGiftPickerNotes({});
    setReferenceCode("");
    setCashPreset("exact");
    setCustomCashInput("");
    setPaymentChecked(false);
    setOfferCode("");
    setAppliedOfferCode("");
    setPricingPreview(null);
    setMode("cart");
    setOrderType(specialModeHint ? "TEST" : "NORMAL");
    setSpecialNote("");
    setManualDiscountPercent(0);
    if (serviceMode !== "table") {
      setServiceIdentifier("");
    }
    setCustomerNameInput("");
    setCustomerPhoneInput("");
    setGatewayOrderIdForVietqr(null);
    setVietqrQrImageUrl(null);
    setVietqrOrderRef(null);
    setVietqrExpiresAt(null);
    setVietqrRemainingSec(0);
    setCreated(null);
  };

  const payWithVietqr = async () => {
    setError(null);
    if (orderBlocked) {
      return setError(heldMeta ? "Chưa mở ca, không thể thanh toán đơn giữ" : "Chưa mở ca, không thể tạo đơn");
    }
    if (heldMeta) {
      return setError("Thanh toán VietQR chỉ dùng cho đơn mới, không dùng đơn giữ. Hãy tạo đơn mới và chọn Chuyển khoản.");
    }
    if (!cartItems.length && !comboItems.length) {
      return setError("Chưa có món trong giỏ hàng");
    }
    if (pricingPreview?.giftSelection?.required) {
      setGiftPickerOpen(true);
      return setError("Cần chọn món tặng trước khi thanh toán");
    }
    if (isSpecialOrderType(orderType) && !specialNote.trim()) {
      return setError("Đơn đặc biệt bắt buộc nhập lý do / ghi chú");
    }
    setCreating(true);
    try {
      const trimmedOfferCode = appliedOfferCode.trim() || undefined;
      const gatewayResult = await posCreateOrderForGateway({
        pickupNumber: effectivePickupNumber,
        customerId: member?.id,
        voucherCode: offerMode === "voucher" ? trimmedOfferCode : undefined,
        promotionCode: offerMode === "promotion" ? trimmedOfferCode : undefined,
        orderType,
        serviceMode,
        specialNote: specialNote.trim() || undefined,
        selectedGiftItems,
        items: cartItems.map((x) => ({
          productVariantId: x.variantId,
          quantity: x.qty,
          note: x.note || undefined,
        })),
        combos: comboItems.map((x) => ({ comboId: x.comboId, quantity: x.qty })),
        appliedComboRules: selectedAppliedRules,
      });
      const gatewayOrderId = gatewayResult.order.id;

      const paymentInit = await initVietqrPayment(gatewayOrderId);

      setGatewayOrderIdForVietqr(gatewayOrderId);
      setVietqrQrImageUrl(paymentInit.qrImageUrl);
      setVietqrOrderRef(paymentInit.orderRef);
      setVietqrExpiresAt(paymentInit.expiresAt);
      setReferenceCode(paymentInit.content || "");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || "Lỗi khi tạo QR VietQR");
    } finally {
      setCreating(false);
    }
  };

  const regenerateVietqrQr = async () => {
    if (!gatewayOrderIdForVietqr) return;
    setError(null);
    setCreating(true);
    setPaymentChecked(false);
    try {
      const paymentInit = await initVietqrPayment(gatewayOrderIdForVietqr);

      setVietqrQrImageUrl(paymentInit.qrImageUrl);
      setVietqrOrderRef(paymentInit.orderRef);
      setVietqrExpiresAt(paymentInit.expiresAt);
      setReferenceCode(paymentInit.content || "");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || "Lỗi khi tạo QR VietQR mới");
    } finally {
      setCreating(false);
    }
  };

  const contentPaneHeight = "calc(100vh - 226px)";
  const isThreeColumnCartLayout = mode === "cart";

  const shellStyle = {
    width: "calc(100vw - 12px)",
    maxWidth: "none",
    margin: "6px auto",
  };

  const pageGridStyle = {
    display: "grid",
    gridTemplateColumns: isThreeColumnCartLayout
      ? "360px minmax(0, 1fr) 320px"
      : "minmax(0, 1fr) 380px",
    gap: isThreeColumnCartLayout ? 12 : 14,
    alignItems: "stretch" as const,
  };

  const leftPanelStyle = {
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    height: contentPaneHeight,
    overflow: "hidden" as const,
    gridColumn: isThreeColumnCartLayout ? "2" : "auto",
  };

  const rightRailStyle = isThreeColumnCartLayout
    ? ({ display: "contents" as const } as const)
    : {
      position: "sticky" as const,
      top: 12,
      alignSelf: "start" as const,
      display: "grid",
      gridTemplateRows: "auto minmax(0, 1fr)",
      gap: 12,
      height: contentPaneHeight,
      minHeight: 0,
    };

  const railPanelStyle = {
    border: "1px solid #e6dfd5",
    borderRadius: 16,
    background: "#fff",
    padding: 14,
    minWidth: 0,
  };

  const railTopStyle = {
    ...railPanelStyle,
    display: "grid",
    gap: 12,
    ...(isThreeColumnCartLayout
      ? {
        gridColumn: "3",
        gridRow: "1",
        height: contentPaneHeight,
        minHeight: 0,
        overflowY: "auto" as const,
        alignContent: "start" as const,
      }
      : {}),
  };

  const railMetaGridStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
  };

  const railBottomStyle = {
    ...railPanelStyle,
    display: "grid",
    gridTemplateRows: isThreeColumnCartLayout
      ? "auto minmax(0, 1fr) auto"
      : "auto auto minmax(0, 1fr) auto auto",
    gap: 12,
    minHeight: 0,
    overflow: "hidden" as const,
    ...(isThreeColumnCartLayout
      ? {
        gridColumn: "1",
        gridRow: "1",
        height: contentPaneHeight,
      }
      : {}),
  };

  const railSectionTitleStyle = {
    fontWeight: 700,
    marginBottom: 8,
  };

  const railHelpTextStyle = {
    fontSize: 12,
    color: "#6b5b4d",
    lineHeight: 1.45,
  };

  const memberInputRowStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 74px 62px",
    gap: 8,
    alignItems: "stretch" as const,
  };

  const memberInputStyle = {
    width: "100%",
    minWidth: 0,
    height: 56,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid #ddd",
    fontSize: 14,
  };

  const pillStyle = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e6dfd5",
    background: "#faf8f5",
    fontSize: 12,
    fontWeight: 600,
  };

  const cartHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  };

  const cartScrollStyle = {
    display: "grid",
    gap: 10,
    minHeight: 0,
    overflowY: "auto" as const,
    overflowX: "hidden" as const,
    paddingRight: 6,
    alignContent: "start" as const,
  };

  const cartWorkspaceStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    minWidth: 0,
    flex: 1,
    minHeight: 0,
  };

  const promotionWorkspaceStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    minHeight: 0,
    height: "100%",
    overflow: "hidden" as const,
  };

  const promotionScrollStyle = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto" as const,
    overflowX: "hidden" as const,
    paddingRight: 6,
    display: "grid",
    gap: 10,
    alignContent: "start" as const,
  };

  const searchInputStyle = {
    width: "100%",
    height: 52,
    padding: "0 14px",
    border: "1px solid #d9d1c7",
    borderRadius: 12,
    outline: "none",
    fontSize: 14,
    background: "#fff",
  };

  const categoryRowStyle = {
    display: "flex",
    gap: 8,
    overflowX: "auto" as const,
    paddingBottom: 2,
  };

  const categoryButtonBaseStyle = {
    flex: "0 0 auto",
    border: "1px solid #ddd",
    padding: "8px 14px",
    borderRadius: 999,
    background: "#fff",
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
  };

  const menuViewportStyle = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto" as const,
    paddingRight: 6,
    paddingBottom: 4,
  };

  const productGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 12,
    alignContent: "start" as const,
  };

  const productCardStyle = {
    border: "1px solid #e6dfd5",
    borderRadius: 16,
    padding: 14,
    background: "#fff",
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    minHeight: 138,
  };

  const productTitleStyle = {
    fontWeight: 700,
    fontSize: 17,
    lineHeight: 1.32,
    minHeight: 42,
  };

  const variantGroupStyle = {
    display: "grid",
    gap: 8,
    marginTop: "auto",
  };

  const variantButtonStyle = {
    width: "100%",
    minHeight: 62,
    padding: "10px 8px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "#fff",
    fontWeight: 700,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    lineHeight: 1.15,
    gap: 4,
  };

  const actionBarStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 8,
    paddingTop: 12,
    borderTop: "1px solid #ece7df",
    flexShrink: 0,
  };

  const actionButtonStyle = {
    minHeight: 42,
    borderRadius: 10,
    padding: "0 8px",
    fontSize: 13,
    whiteSpace: "nowrap" as const,
  };

  const primaryActionButtonStyle = {
    ...actionButtonStyle,
    background: "#6f5846",
    color: "#fff",
    border: "1px solid #6f5846",
    fontWeight: 700,
  };

  const emptyStateStyle = {
    padding: 16,
    border: "1px dashed #d8cfc3",
    borderRadius: 12,
    background: "#faf8f5",
    color: "#6b5b4d",
  };

  return (
    <div className="pos-screen pos-ui pos-order-page">
      <div className="pos-shell pos-shell--wide" style={shellStyle}>
        <div className="pos-topbar">
          <div className="pos-topbar__main">
            <div className="pos-topbar__eyebrow">Cashier workstation</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => nav("/pos", { replace: true })}>
                Về Dashboard
              </button>
              {isOwnerOrAdmin(user) && (
                <button
                  onClick={() => nav("/office/dashboard")}
                  style={{
                    background: "#2B402D",
                    color: "#FAF6F3",
                    fontWeight: 700,
                    borderRadius: 8,
                    padding: "6px 12px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  🏢 Về Quản trị
                </button>
              )}
              <h2 className="pos-topbar__title" style={{ margin: 0 }}>
                POS - {heldMeta ? "Thanh toan don giu" : "Tao order"}
                {mode === "combo" ? " / Chon combo" : ""}
                {mode === "promotion" ? " / Chon promotion" : ""}
                {mode === "payment" ? " / Thanh toan" : ""}
              </h2>
            </div>
          </div>

          <div className="pos-meta-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 10,
                backgroundColor: "#EBF1EB",
                border: "1px solid #C4BDAC",
                fontSize: 13,
                fontWeight: 700,
                color: "#1E2C20",
              }}
            >
              <span>{SERVICE_MODE_OPTIONS.find((m) => m.id === serviceMode)?.icon || "🪑"}</span>
              <span>
                {SERVICE_MODE_OPTIONS.find((m) => m.id === serviceMode)?.label || "Số Bàn"}
                {serviceIdentifier ? `: ${serviceIdentifier}` : ""}
              </span>
            </div>
            {isSpecialOrderType(orderType) ? (
              <div className="pos-badge pos-badge--warning">
                {getOrderTypeLabel(orderType)}
              </div>
            ) : null}
          </div>
        </div>

        {loadingMenu ? <div className="pos-alert pos-alert--info">Dang tai menu...</div> : null}
        {loadingHeld ? <div className="pos-alert pos-alert--info">Dang tai don giu...</div> : null}
        {error ? <div className="pos-alert pos-alert--danger">{error}</div> : null}

        {shiftChecking ? (
          <div className="pos-alert pos-alert--info">Dang kiem tra ca hien tai...</div>
        ) : null}

        {shiftBlockedMessage ? (
          <div className="pos-alert pos-alert--danger">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {heldMeta ? "Khong the thanh toan don giu" : "Khong the tao order"}
            </div>
            <div>{shiftBlockedMessage}</div>
            <button
              onClick={() => nav("/pos/shift-reconciliation")}
              style={{ marginTop: 10 }}
            >
              Qua man hinh mo ca
            </button>
          </div>
        ) : null}

        {shiftWarning ? (
          <div className="pos-alert pos-alert--warning">
            <b>Canh bao ca:</b> {shiftWarning}
          </div>
        ) : null}

        {heldMeta ? (
          <div className="pos-alert pos-alert--info">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Dang mo don giu: {heldMeta.orderCode}
            </div>
            <div>
              Don giu chi de thanh toan tiep. De tranh lech du lieu, tam khoa thao
              tac sua gio hang.
            </div>
          </div>
        ) : null}

        <div
          className="pos-main-grid pos-main-grid--content"
          style={pageGridStyle}
        >
          <div
            className="pos-panel pos-panel--soft pos-order-workspace"
            style={leftPanelStyle}
          >
            {mode === "cart" ? (
              <div style={cartWorkspaceStyle}>
                <div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tim mon, size, sku..."
                    style={searchInputStyle}
                    disabled={orderBlocked || editingLocked}
                  />
                </div>

                <div style={categoryRowStyle}>
                  {cats.map((c) => {
                    const activeStyle =
                      c.key === activeCat
                        ? {
                          ...categoryButtonBaseStyle,
                          border: "1px solid #6f5846",
                          background: "#6f5846",
                          color: "#fff",
                          fontWeight: 700,
                        }
                        : categoryButtonBaseStyle;

                    return (
                      <button
                        key={c.key}
                        onClick={() => setActiveCat(c.key)}
                        disabled={orderBlocked || editingLocked}
                        style={activeStyle}
                      >
                        {c.name || CATEGORY_LABEL[c.key] || c.key}
                      </button>
                    );
                  })}
                </div>

                <div style={menuViewportStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    <h3 style={{ margin: 0 }}>
                      {allProductsFiltered
                        ? "Ket qua tim kiem"
                        : active?.name || CATEGORY_LABEL[activeCat] || activeCat}
                    </h3>

                    <div style={{ fontSize: 13, color: "#6b5b4d" }}>
                      {allProductsFiltered
                        ? `${allProductsFiltered.length} mon`
                        : `${active?.products?.length || 0} mon`}
                    </div>
                  </div>

                  {allProductsFiltered ? (
                    allProductsFiltered.length > 0 ? (
                      <div style={productGridStyle}>
                        {allProductsFiltered.map((p) => (
                          <div
                            key={`${p.categoryKey}-${p.productId}-${p.productName}`}
                            style={productCardStyle}
                          >
                            <div style={productTitleStyle}>{p.productName}</div>
                            <div
                              style={{
                                fontSize: 13,
                                color: "#6b5b4d",
                                marginTop: 4,
                              }}
                            >
                              {CATEGORY_LABEL[p.categoryKey] || p.categoryKey}
                            </div>

                            <div
                              style={{
                                ...variantGroupStyle,
                                gridTemplateColumns: getVariantGridColumns(
                                  p.variants.length
                                ),
                              }}
                            >
                              {p.variants.map((v) => (
                                <button
                                  key={v.id}
                                  onClick={() =>
                                    addVariant(
                                      cartCategoryKeyForProduct(
                                        p.categoryKey,
                                        p.productId
                                      ),
                                      p.productName,
                                      v
                                    )
                                  }
                                  style={variantButtonStyle}
                                  disabled={orderBlocked || editingLocked}
                                >
                                  <span style={{ fontSize: 15 }}>{v.size}</span>
                                  <span style={{ fontSize: 15 }}>
                                    {v.price.toLocaleString()}d
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={emptyStateStyle}>Khong tim thay mon phu hop.</div>
                    )
                  ) : !active ? (
                    <div style={emptyStateStyle}>Khong co du lieu</div>
                  ) : active.products.length === 0 ? (
                    <div style={emptyStateStyle}>Danh muc nay chua co mon.</div>
                  ) : (
                    <div style={productGridStyle}>
                      {active.products.map((p) => (
                        <div key={p.id || p.name} style={productCardStyle}>
                          <div style={productTitleStyle}>{p.name}</div>

                          <div
                            style={{
                              ...variantGroupStyle,
                              gridTemplateColumns: getVariantGridColumns(
                                p.variants.length
                              ),
                            }}
                          >
                            {p.variants.map((v) => (
                              <button
                                key={v.id}
                                onClick={() =>
                                  addVariant(
                                    cartCategoryKeyForProduct(activeCat, p.id),
                                    p.name,
                                    v
                                  )
                                }
                                style={variantButtonStyle}
                                disabled={orderBlocked || editingLocked}
                              >
                                <span style={{ fontSize: 15 }}>{v.size}</span>
                                <span style={{ fontSize: 15 }}>
                                  {v.price.toLocaleString()}d
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={actionBarStyle}>
                  <button
                    style={actionButtonStyle}
                    disabled={
                      orderBlocked ||
                      editingLocked ||
                      (!cartItems.length && !comboItems.length)
                    }
                    onClick={openComboStep}
                  >
                    Chon combo
                  </button>

                  <button
                    style={actionButtonStyle}
                    disabled={
                      orderBlocked ||
                      editingLocked ||
                      (!cartItems.length && !comboItems.length)
                    }
                    onClick={openPromotionStep}
                  >
                    Chon promotion
                  </button>

                  <button
                    style={primaryActionButtonStyle}
                    disabled={orderBlocked || (!cartItems.length && !comboItems.length)}
                    onClick={goToPaymentStep}
                  >
                    Chon thanh toan
                  </button>

                  <button
                    style={actionButtonStyle}
                    disabled={
                      orderBlocked ||
                      editingLocked ||
                      (!cartItems.length && !comboItems.length) ||
                      creating
                    }
                    onClick={holdCurrentOrder}
                  >
                    {creating ? "Dang giu..." : "Giu don"}
                  </button>

                  <button
                    style={actionButtonStyle}
                    onClick={() => nav("/pos/held-orders")}
                  >
                    Don dang giu
                  </button>

                  <button
                    style={actionButtonStyle}
                    disabled={orderBlocked || editingLocked}
                    onClick={() => {
                      setCart({});
                      setComboCart({});
                      setEligibleRules([]);
                      setSelectedAppliedRules([]);
                      setSelectedGiftItems([]);
                      setGiftPickerOpen(false);
                      setGiftPickerQtyMap({});
                      setGiftPickerNotes({});
                      setPaymentChecked(false);
                      setOfferCode("");
                      setAppliedOfferCode("");
                      setPricingPreview(null);
                      setAvailablePromotions([]);
                      setQuickCreateOpen(false);
                      setQuickCreateName("");
                      setQuickCreateMsg(null);
                      setError(null);
                      setOrderType(specialModeHint ? "TEST" : "NORMAL");
                      setSpecialNote("");
                      setServiceMode("IN_STORE");
                      setOrderTypePickerOpen(false);
                    }}
                  >
                    Xoa gio
                  </button>
                </div>
              </div>
            ) : null}

            {mode === "combo" ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>Chon combo</h3>
                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                      Moi don chi duoc chon 1 combo. Chon xong se tu quay lai menu.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={async () => {
                        setComboPreviewLoading(true);
                        try {
                          await fetchComboPreview();
                          setError(null);
                        } catch (e: any) {
                          setError(
                            e?.response?.data?.message ||
                            e.message ||
                            "Preview combo failed"
                          );
                        } finally {
                          setComboPreviewLoading(false);
                        }
                      }}
                      disabled={comboPreviewLoading || !cartItems.length || editingLocked}
                    >
                      {comboPreviewLoading ? "Dang tai..." : "Tai lai combo"}
                    </button>

                    <button onClick={() => setMode("cart")}>Quay lai menu</button>
                  </div>
                </div>

                {eligibleRules.length > 0 ? (
                  <div style={{ marginBottom: 18 }}>
                    <h4 style={{ margin: "0 0 10px 0" }}>Combo dong co the gop</h4>

                    <div style={{ display: "grid", gap: 10 }}>
                      {eligibleRules.map((rule) => {
                        const firstApp = rule.applications?.[0];
                        const original = firstApp
                          ? firstApp.selectedItems.reduce((s, x) => s + x.unitPrice, 0)
                          : 0;
                        const saving = original - rule.comboPrice;
                        const displayName = getComboDisplayNameFromRule(rule, cartItems);

                        return (
                          <div
                            key={rule.comboRuleId}
                            style={{
                              border: "1px solid #d1fae5",
                              background: "#f0fdf4",
                              borderRadius: 10,
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700 }}>{displayName}</div>
                                {rule.description ? (
                                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
                                    {rule.description}
                                  </div>
                                ) : null}
                                {firstApp ? (
                                  <div style={{ fontSize: 13, marginTop: 6 }}>
                                    {firstApp.selectedItems
                                      .map((x) =>
                                        `${x.productName}${x.size ? ` (${x.size})` : ""}`
                                      )
                                      .join(" + ")}
                                  </div>
                                ) : null}
                                <div style={{ fontSize: 13, marginTop: 6 }}>
                                  Gia le: {formatMoney(original)} • Gia combo:{" "}
                                  {formatMoney(rule.comboPrice)} • Tiet kiem:{" "}
                                  {formatMoney(saving)}
                                </div>
                              </div>

                              <div>
                                <button
                                  onClick={() => applyRuleFromPreview(rule)}
                                  disabled={editingLocked}
                                >
                                  Ap dung combo
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {suggestedRules.length > 0 ? (
                  <div style={{ marginBottom: 18 }}>
                    <h4 style={{ margin: "0 0 10px 0" }}>
                      Goi y them mon de thanh combo
                    </h4>

                    <div style={{ display: "grid", gap: 10 }}>
                      {suggestedRules.map((rule) => {
                        const allItems = [...rule.matchedItems, ...rule.missingItems];
                        const displayName =
                          allItems
                            .map((x) =>
                              `${x.productName}${x.size ? ` (${x.size})` : ""}`
                            )
                            .join(" + ") || rule.name;

                        const priceText = allItems
                          .map((x) => formatMoney(x.unitPrice))
                          .join(" + ");

                        return (
                          <div
                            key={`suggest-${rule.comboRuleId}`}
                            style={{
                              border: "1px solid #fde68a",
                              background: "#fffbeb",
                              borderRadius: 10,
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700 }}>{displayName}</div>
                                <div style={{ fontSize: 13, marginTop: 6 }}>
                                  Gia le: {priceText}
                                </div>
                                <div style={{ fontSize: 13, marginTop: 4 }}>
                                  Gia combo du kien: {formatMoney(rule.comboPrice)} • Tiet kiem:{" "}
                                  {formatMoney(rule.totalSaving)}
                                </div>
                              </div>

                              <div>
                                <button
                                  disabled={editingLocked}
                                  onClick={() => applySuggestedRule(rule)}
                                >
                                  Them va ap dung
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div>
                  <h4 style={{ margin: "0 0 10px 0" }}>Combo co dinh</h4>

                  <div style={{ display: "grid", gap: 10 }}>
                    {(suggestedCombos.length ? suggestedCombos : combos.slice(0, 8)).map(
                      (combo) => (
                        <div
                          key={combo.id}
                          style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 700 }}>{combo.name}</div>
                              {combo.description ? (
                                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
                                  {combo.description}
                                </div>
                              ) : null}
                              <div style={{ fontSize: 13, marginTop: 6 }}>
                                {combo.items
                                  .map((x) => `${x.quantity} x ${x.productName} (${x.size})`)
                                  .join(" + ")}
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700 }}>
                                {combo.comboPrice.toLocaleString()}d
                              </div>
                              <button
                                onClick={() => addCombo(combo)}
                                style={{ marginTop: 8 }}
                                disabled={editingLocked}
                              >
                                Áp dụng combo
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {mode === "promotion" ? (
              <div style={promotionWorkspaceStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 2,
                    flexWrap: "wrap",
                    flexShrink: 0,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>Chon promotion</h3>
                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                      Chon 1 promotion cho don. Chon xong se quay lai gio hang.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={openPromotionStep}
                      disabled={loadingPromotions || editingLocked}
                    >
                      {loadingPromotions ? "Dang tai..." : "Tai lai promotion"}
                    </button>

                    <button onClick={() => setMode("cart")}>Quay lai menu</button>
                  </div>
                </div>

                {appliedOfferCode && offerMode === "promotion" ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      Dang ap promotion: {appliedOfferCode}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      Chon promotion khac se ghi de promotion hien tai.
                    </div>
                  </div>
                ) : null}

                {loadingPromotions ? (
                  <div style={{ flexShrink: 0 }}>Dang tai danh sach promotion...</div>
                ) : null}

                {!loadingPromotions && availablePromotions.length === 0 ? (
                  <div style={{ flexShrink: 0 }}>Khong co promotion cong khai nao.</div>
                ) : null}

                <div style={promotionScrollStyle}>
                  {availablePromotions.map((promo) => {
                    const discountText =
                      promo.promotionType === "ORDER_FIXED"
                        ? formatMoney(Number(promo.discountAmount || 0))
                        : promo.promotionType === "ORDER_PERCENT"
                          ? promo.maxDiscountAmount != null
                            ? `${Number(promo.discountPercent || 0)}% (tối đa ${formatMoney(
                              Number(promo.maxDiscountAmount || 0)
                            )})`
                            : `${Number(promo.discountPercent || 0)}%`
                          : "Ưu đãi quà tặng";

                    const isApplied =
                      offerMode === "promotion" && appliedOfferCode === promo.code;

                    return (
                      <div
                        key={promo.id}
                        style={{
                          border: "1px solid #ddd",
                          borderRadius: 10,
                          padding: 12,
                          background: isApplied ? "#eff6ff" : "#fff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{promo.name}</div>
                            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                              Code: <b>{promo.code}</b>
                            </div>

                            {promo.description ? (
                              <div style={{ fontSize: 13, marginTop: 6 }}>
                                {promo.description}
                              </div>
                            ) : null}

                            <div style={{ display: "grid", gap: 4, fontSize: 13, marginTop: 8 }}>
                              <div>
                                <b>Loai:</b>{" "}
                                {promo.promotionType === "ORDER_FIXED"
                                  ? "Giam tien theo don"
                                  : promo.promotionType === "ORDER_PERCENT"
                                    ? "Giam % theo don"
                                    : "Qua tang"}
                              </div>
                              <div>
                                <b>Gia tri:</b> {discountText}
                              </div>
                              <div>
                                <b>Don toi thieu:</b> {formatMoney(promo.minOrderAmount)}
                              </div>
                              {promo.startAt ? (
                                <div>
                                  <b>Bat dau:</b>{" "}
                                  {new Date(promo.startAt).toLocaleString("vi-VN", {
                                    timeZone: "Asia/Ho_Chi_Minh",
                                  })}
                                </div>
                              ) : null}
                              {promo.endAt ? (
                                <div>
                                  <b>Ket thuc:</b>{" "}
                                  {new Date(promo.endAt).toLocaleString("vi-VN", {
                                    timeZone: "Asia/Ho_Chi_Minh",
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {isApplied ? (
                              <button
                                onClick={async () => {
                                  await clearOffer();
                                  setMode("cart");
                                }}
                                disabled={editingLocked}
                              >
                                Bo promotion
                              </button>
                            ) : (
                              <button
                                onClick={() => applyPromotionFromList(promo)}
                                disabled={editingLocked}
                              >
                                Ap dung
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {mode === "payment" ? (
              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 16,
                  background: "#fafafa",
                }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <b>So the:</b> {effectivePickupNumber}
                  </div>
                  <div>
                    <b>Tong bill:</b> {formatMoney(payableTotal)}
                  </div>
                  <div>
                    <b>Mon le:</b> {formatMoney(directItemsSubtotal)}
                  </div>
                  {fixedComboSubtotal > 0 ? (
                    <div>
                      <b>Combo co dinh:</b> {formatMoney(fixedComboSubtotal)}
                    </div>
                  ) : null}
                  {appliedRuleSavings > 0 ? (
                    <div>
                      <b>Giam do gop combo:</b> -{formatMoney(appliedRuleSavings)}
                    </div>
                  ) : null}
                  {(pricingPreview?.promotionDiscountAmount || 0) > 0 ? (
                    <div>
                      <b>Promotion:</b> -
                      {formatMoney(pricingPreview?.promotionDiscountAmount || 0)}
                    </div>
                  ) : null}
                  {(pricingPreview?.voucherDiscountAmount || 0) > 0 ? (
                    <div>
                      <b>Voucher:</b> -
                      {formatMoney(pricingPreview?.voucherDiscountAmount || 0)}
                    </div>
                  ) : null}
                  <div>
                    <b>So mon:</b> {cartItems.reduce((s, x) => s + x.qty, 0)}
                  </div>
                  {member ? (
                    <div>
                      <b>Member:</b> {member.fullName} ({member.points} diem)
                    </div>
                  ) : (
                    <div>
                      <b>Member:</b> Khach le
                    </div>
                  )}
                </div>

                {isSpecialOrderType(orderType) ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 8,
                      background: "#fff7ed",
                      border: "1px solid #fdba74",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      Don dac biet - khong thu tien khach
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Tong thanh toan se duoc dua ve 0đ.
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Loai don: <b>{orderType}</b>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Hinh thuc phuc vu: <b>{serviceMode === "IN_STORE" ? "Tai quan" : "Mang di"}</b>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      Ghi chu: {specialNote || "-"}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>
                        Phuong thuc thanh toan
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            setPaymentMethod("cash");
                            setPaymentChecked(false);
                            setGatewayOrderIdForVietqr(null);
                            setVietqrQrImageUrl(null);
                            setVietqrOrderRef(null);
                            setVietqrExpiresAt(null);
                            setVietqrRemainingSec(0);
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            background: paymentMethod === "cash" ? "#111827" : "#fff",
                            color: paymentMethod === "cash" ? "#fff" : "#111",
                          }}
                        >
                          Tien mat
                        </button>

                        <button
                          onClick={() => {
                            setPaymentMethod("transfer");
                            setPaymentChecked(false);
                            setGatewayOrderIdForVietqr(null);
                            setVietqrQrImageUrl(null);
                            setVietqrOrderRef(null);
                            setVietqrExpiresAt(null);
                            setVietqrRemainingSec(0);
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            background:
                              paymentMethod === "transfer" ? "#111827" : "#fff",
                            color: paymentMethod === "transfer" ? "#fff" : "#111",
                          }}
                        >
                          Chuyen khoan
                        </button>
                      </div>
                    </div>

                    {paymentMethod === "cash" ? (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>
                          So tien khach dua
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <CashChip
                            active={cashPreset === "exact"}
                            onClick={() => {
                              setCashPreset("exact");
                              setPaymentChecked(false);
                            }}
                            label={formatMoney(payableTotal)}
                          />

                          {smartCashSuggestions.map((x) => (
                            <CashChip
                              key={x}
                              active={cashPreset === String(x)}
                              onClick={() => {
                                setCashPreset(String(x));
                                setPaymentChecked(false);
                              }}
                              label={formatMoney(x)}
                            />
                          ))}

                          <CashChip
                            active={cashPreset === "custom"}
                            onClick={() => {
                              setCashPreset("custom");
                              setPaymentChecked(false);
                            }}
                            label="So khac"
                          />
                        </div>

                        {cashPreset === "custom" ? (
                          <div style={{ marginTop: 8 }}>
                            <input
                              value={customCashInput}
                              onChange={(e) => {
                                setCustomCashInput(e.target.value.replace(/[^\d]/g, ""));
                                setPaymentChecked(false);
                              }}
                              placeholder="Nhap so tien khach dua"
                              inputMode="numeric"
                              style={{ width: "100%", padding: 8 }}
                            />
                          </div>
                        ) : null}

                        <div
                          style={{
                            marginTop: 10,
                            padding: 12,
                            borderRadius: 8,
                            background: "#fff",
                            border: "1px solid #eee",
                          }}
                        >
                          <div>
                            <b>Phai thu:</b> {formatMoney(payableTotal)}
                          </div>
                          <div>
                            <b>Khach dua:</b> {formatMoney(cashReceived)}
                          </div>
                          <div>
                            <b>Tien thoi:</b> {formatMoney(cashChange)}
                          </div>
                          {cashShort > 0 ? (
                            <div style={{ color: "crimson", marginTop: 4 }}>
                              Con thieu: {formatMoney(cashShort)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>
                          Thanh toan VietQR tren man hinh khach
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            marginTop: 10,
                            padding: 12,
                            border: "1px solid #eee",
                            borderRadius: 8,
                            background: "#fff",
                          }}
                        >
                          <div>
                            <div>
                              <b>Phai thu:</b> {formatMoney(payableTotal)}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <b>Noi dung:</b> {vietqrOrderRef || "-"}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <b>Trang thai:</b>{" "}
                              {vietqrPaymentStatus?.status ||
                                (gatewayOrderIdForVietqr ? "PENDING" : "-")}
                            </div>
                            {gatewayOrderIdForVietqr &&
                              vietqrPaymentStatus?.status !== "PAID" &&
                              vietqrPaymentStatus?.status !== "EXPIRED" ? (
                              <div style={{ marginTop: 6, color: "#065f46", fontWeight: 700 }}>
                                Dang doi he thong tu xac nhan
                                {vietqrRemainingSec > 0
                                  ? ` - ${Math.floor(vietqrRemainingSec / 60)}:${String(
                                    vietqrRemainingSec % 60
                                  ).padStart(2, "0")}`
                                  : ""}
                              </div>
                            ) : null}
                            {vietqrPaymentStatus?.status === "EXPIRED" ? (
                              <div style={{ marginTop: 6, color: "crimson", fontWeight: 700 }}>
                                QR da het han. Tao QR moi tren man hinh khach.
                              </div>
                            ) : null}
                            {vietqrPaymentStatus?.status === "PAID" ? (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: 10,
                                  borderRadius: 8,
                                  border: "1px solid #a7f3d0",
                                  background: "#ecfdf5",
                                  fontWeight: 700,
                                }}
                              >
                                He thong da xac nhan thanh toan. Ban co the hoan tat.
                              </div>
                            ) : null}

                            <div style={{ marginTop: 10 }}>
                              {!gatewayOrderIdForVietqr ? (
                                <button
                                  type="button"
                                  onClick={payWithVietqr}
                                  disabled={creating || (!cartItems.length && !comboItems.length)}
                                  style={{
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    border: "1px solid #059669",
                                    background: "#059669",
                                    color: "#fff",
                                    fontWeight: 600,
                                    width: "100%",
                                  }}
                                >
                                  {creating
                                    ? "Dang tao QR tren man hinh khach..."
                                    : "Tao QR tren man hinh khach"}
                                </button>
                              ) : vietqrPaymentStatus?.status === "EXPIRED" ? (
                                <button
                                  type="button"
                                  onClick={regenerateVietqrQr}
                                  disabled={creating}
                                  style={{
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    border: "1px solid #b45309",
                                    background: "#d97706",
                                    color: "#fff",
                                    fontWeight: 600,
                                    width: "100%",
                                  }}
                                >
                                  {creating
                                    ? "Dang tao QR moi tren man hinh khach..."
                                    : "Tao QR moi tren man hinh khach"}
                                </button>
                              ) : null}
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </>
                )}

                {!member ? <LoyaltyStatusHint hasMember={false} /> : null}

                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  <button onClick={backToCartStep}>Quay lai gio hang</button>
                  <button onClick={confirmPaymentInfo}>Xac nhan thanh toan</button>
                  <button disabled={!paymentChecked || creating} onClick={createOrder}>
                    {creating
                      ? heldMeta
                        ? "Dang tao don dac biet..."
                        : "Dang tao don dac biet..."
                      : heldMeta
                        ? isSpecialOrderType(orderType)
                          ? "Xac nhan don dac biet"
                          : "Thanh toan don giu"
                        : isSpecialOrderType(orderType)
                          ? "Tao don dac biet"
                          : "Hoan tat thanh toan & Tao bill"}
                  </button>
                </div>

                {paymentChecked ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 8,
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                    }}
                  >
                    Da xac nhan thong tin thanh toan. Co the tao bill.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="pos-order-rail" style={rightRailStyle}>
            <div style={railTopStyle}>
              <div>
                <div style={railSectionTitleStyle}>Khach hang / member</div>
                <div style={memberInputRowStyle}>
                  <input
                    value={phone}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setPhone(v);
                    }}
                    placeholder="10 chu so (VD: 0901234567)"
                    maxLength={10}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    style={memberInputStyle}
                    disabled={mode === "payment" || editingLocked}
                  />
                  <button
                    disabled={findingMember || mode === "payment" || editingLocked}
                    onClick={findMember}
                  >
                    Tim
                  </button>
                  <button onClick={clearMember} disabled={mode === "payment" || editingLocked}>
                    Bo
                  </button>
                </div>

                {member ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div style={pillStyle}>Ten: {member.fullName || "(chua co ten)"}</div>
                    <div style={pillStyle}>Diem: {member.points}</div>
                  </div>
                ) : null}

                {memberErr ? (
                  <div style={{ color: "crimson", marginTop: 6 }}>{memberErr}</div>
                ) : null}

                {!member && phone.trim().length === 10 && memberErr === "Khong tim thay member" ? (
                  <div className="pos-summary-box" style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 8 }}>
                      Khach chua co tai khoan. Co the tao nhanh de gan vao don hien tai.
                    </div>

                    {!quickCreateOpen ? (
                      <button
                        onClick={() => {
                          setQuickCreateOpen(true);
                          setQuickCreateName("");
                          setQuickCreateMsg(null);
                        }}
                        disabled={mode === "payment" || editingLocked}
                      >
                        Tao member nhanh
                      </button>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        <input
                          value={quickCreateName}
                          onChange={(e) => setQuickCreateName(e.target.value)}
                          placeholder="Nhap ten khach"
                          style={{ padding: 8 }}
                          disabled={quickCreateLoading}
                        />

                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={quickCreateMember} disabled={quickCreateLoading}>
                            {quickCreateLoading ? "Dang tao..." : "Xac nhan tao"}
                          </button>
                          <button
                            onClick={() => {
                              setQuickCreateOpen(false);
                              setQuickCreateName("");
                            }}
                            disabled={quickCreateLoading}
                          >
                            Huy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {quickCreateMsg ? (
                  <div className="pos-alert pos-alert--success" style={{ marginTop: 8 }}>
                    {quickCreateMsg}
                  </div>
                ) : null}

                <LoyaltyStatusHint hasMember={!!member} />
              </div>

              <div style={railMetaGridStyle}>
                <div style={{ border: "1px solid #ece7df", borderRadius: 12, padding: 12 }}>
                  <div style={railSectionTitleStyle}>Loai don</div>
                  <button
                    type="button"
                    onClick={() => setOrderTypePickerOpen(true)}
                    disabled={mode === "payment" || editingLocked}
                    style={{
                      width: "100%",
                      minHeight: 56,
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #ddd",
                      background: isSpecialOrderType(orderType) ? "#fef3c7" : "#fff",
                      color: "#111",
                      fontWeight: 700,
                    }}
                  >
                    {getOrderTypeLabel(orderType)}
                    {specialNote.trim() ? " - Co ghi chu" : ""}
                  </button>

                  {isSpecialOrderType(orderType) ? (
                    <div style={{ ...railHelpTextStyle, marginTop: 8, color: "#92400e" }}>
                      Dang bat: {orderType}
                      {specialNote ? ` - ${specialNote}` : ""}
                    </div>
                  ) : null}
                </div>

                <div style={{ border: "1px solid #ece7df", borderRadius: 12, padding: 12 }}>
                  <div style={railSectionTitleStyle}>Chế độ nhận món & Định danh</div>
                  
                  {/* Selector các chế độ phục vụ */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {SERVICE_MODE_OPTIONS.filter((opt) => (posConfig.enabledServiceModes || []).includes(opt.id)).map((opt) => {
                      const activeMode = serviceMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setServiceMode(opt.id);
                            setPaymentChecked(false);
                          }}
                          disabled={mode === "payment" || !!gatewayOrderIdForVietqr}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: activeMode ? "1px solid #2D3E2F" : "1px solid #DFD9CE",
                            backgroundColor: activeMode ? "#2D3E2F" : "#FFFFFF",
                            color: activeMode ? "#FFFFFF" : "#1E2C20",
                            fontSize: 12,
                            fontWeight: activeMode ? 700 : 500,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Chi tiết theo từng chế độ */}
                  {serviceMode === "table" && (
                    <div>
                      <input
                        value={serviceIdentifier}
                        onChange={(e) => setServiceIdentifier(e.target.value)}
                        placeholder="Nhập số/tên bàn (VD: Bàn 01, VIP 2...)"
                        disabled={mode === "payment" || editingLocked}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #DFD9CE",
                          fontSize: 13,
                          marginBottom: 8,
                          boxSizing: "border-box",
                        }}
                      />
                      {/* Bàn nhanh */}
                      {posConfig.quickTables && posConfig.quickTables.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {posConfig.quickTables.map((t) => {
                            const isTSelected = serviceIdentifier === t;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setServiceIdentifier(t)}
                                disabled={mode === "payment" || editingLocked}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: isTSelected ? "1px solid #2D3E2F" : "1px solid #DFD9CE",
                                  backgroundColor: isTSelected ? "#EBF1EB" : "#FFFFFF",
                                  color: isTSelected ? "#2D3E2F" : "#555",
                                  fontSize: 11,
                                  fontWeight: isTSelected ? 700 : 500,
                                  cursor: "pointer",
                                }}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {serviceMode === "table_marker" && (
                    <input
                      value={serviceIdentifier}
                      onChange={(e) => setServiceIdentifier(e.target.value)}
                      placeholder="Nhập số thẻ để bàn (VD: 01, 12...)"
                      disabled={mode === "payment" || editingLocked}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #DFD9CE",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                  )}

                  {serviceMode === "queue_number" && (
                    <input
                      value={serviceIdentifier}
                      onChange={(e) => setServiceIdentifier(e.target.value)}
                      placeholder="Số thứ tự đơn (tự động in trên bill)"
                      disabled={mode === "payment" || editingLocked}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #DFD9CE",
                        fontSize: 13,
                        boxSizing: "border-box",
                      }}
                    />
                  )}

                  {serviceMode === "customer_name" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input
                        value={customerNameInput}
                        onChange={(e) => setCustomerNameInput(e.target.value)}
                        placeholder="Tên khách hàng"
                        disabled={mode === "payment" || editingLocked}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #DFD9CE",
                          fontSize: 12,
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        value={customerPhoneInput}
                        onChange={(e) => setCustomerPhoneInput(e.target.value)}
                        placeholder="Số ĐT nhận món"
                        disabled={mode === "payment" || editingLocked}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #DFD9CE",
                          fontSize: 12,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}

                  {serviceMode === "none" && (
                    <div style={{ fontSize: 12, color: "#667064", fontStyle: "italic" }}>
                      ⚡ Bán nhanh - Khách nhận đồ ngay tại quầy
                    </div>
                  )}
                </div>
              </div>            </div>

            <div style={railBottomStyle}>
              <div style={cartHeaderStyle}>
                <div>
                  <h3 style={{ margin: 0 }}>Gio hang</h3>
                  <div style={railHelpTextStyle}>
                    {displayCartRows.length > 0
                      ? `${displayCartRows.length} dong trong gio`
                      : "Chua co mon trong gio"}
                  </div>
                </div>
                <div style={pillStyle}>{formatMoney(payableTotal)}</div>
              </div>

              <div className="pos-scroll" style={cartScrollStyle}>
                {displayCartRows.length === 0 ? (
                  <div style={emptyStateStyle}>Chua co mon trong gio</div>
                ) : null}

                {displayCartRows.map((row) => {
                  if (row.type === "item") {
                    const it = row.item;
                    const key = String(it.variantId);
                    const isEditing = selectedNoteKey === key;

                    return (
                      <div
                        key={row.key}
                        style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}
                        onMouseEnter={() => setSelectedNoteKey(key)}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <b>{it.productName}</b> <small>({it.size})</small>
                            <div>
                              <small>{it.price.toLocaleString()}d</small>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <button
                              disabled={mode === "payment" || editingLocked}
                              onClick={() => dec(it.variantId)}
                              style={{ width: 34, height: 34, borderRadius: 10 }}
                            >
                              -
                            </button>
                            <span style={{ minWidth: 16, textAlign: "center" }}>{it.qty}</span>
                            <button
                              disabled={mode === "payment" || editingLocked}
                              onClick={() => inc(it.variantId)}
                              style={{ width: 34, height: 34, borderRadius: 10 }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {mode !== "payment" && !editingLocked && isEditing ? (
                          <div style={{ marginTop: 8 }}>
                            <input
                              value={it.note || ""}
                              onChange={(e) => setItemNote(it.variantId, e.target.value)}
                              placeholder="Ghi chu mon (vd: it duong, khong da...)"
                              style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid #ddd" }}
                            />
                          </div>
                        ) : it.note ? (
                          <div style={{ marginTop: 6 }}>
                            <small>Note: {it.note}</small>
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  const cb = row.combo;

                  return (
                    <div
                      key={row.key}
                      style={{
                        border: "1px solid #dbeafe",
                        borderRadius: 12,
                        padding: 10,
                        background: "#f8fbff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <b>{cb.name}</b>
                          <div>
                            <small>{cb.price.toLocaleString()}d / combo</small>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 13 }}>{cb.description}</div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <button
                            disabled={mode === "payment" || editingLocked}
                            onClick={() => removeDisplayCombo(cb)}
                            style={{ borderRadius: 10 }}
                          >
                            Xoa
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Giảm giá nhanh (% Quick Discounts) */}
              <div style={{ border: "1px solid #ece7df", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={railSectionTitleStyle}>Giảm giá nhanh (% Chiết khấu)</div>
                  {manualDiscountPercent > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#2E7D32" }}>
                      Giảm {manualDiscountPercent}% (-{formatMoney(quickDiscountAmount)})
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setManualDiscountPercent(0)}
                    disabled={mode === "payment" || editingLocked || isSpecialOrderType(orderType)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: manualDiscountPercent === 0 ? "1px solid #2D3E2F" : "1px solid #DFD9CE",
                      backgroundColor: manualDiscountPercent === 0 ? "#EBF1EB" : "#FFFFFF",
                      color: manualDiscountPercent === 0 ? "#2D3E2F" : "#555",
                      fontSize: 12,
                      fontWeight: manualDiscountPercent === 0 ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    0%
                  </button>
                  {(posConfig.quickDiscounts || [5, 10, 15, 20, 50, 100]).map((disc) => {
                    const isSelected = manualDiscountPercent === disc;
                    return (
                      <button
                        key={disc}
                        type="button"
                        onClick={() => setManualDiscountPercent(isSelected ? 0 : disc)}
                        disabled={mode === "payment" || editingLocked || isSpecialOrderType(orderType)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 8,
                          border: isSelected ? "1px solid #2D3E2F" : "1px solid #DFD9CE",
                          backgroundColor: isSelected ? "#2D3E2F" : "#FFFFFF",
                          color: isSelected ? "#FFFFFF" : "#1E2C20",
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        {disc === 100 ? "100% (Free)" : `${disc}%`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ border: "1px solid #ece7df", borderRadius: 12, padding: 12 }}>
                <div style={railSectionTitleStyle}>Voucher / Promotion</div>
                <div style={{ ...railHelpTextStyle, marginBottom: 8 }}>
                  Nhap ma voucher hoac promotion cho don hien tai.
                </div>

                {isSpecialOrderType(orderType) ? (
                  <div className="pos-alert pos-alert--warning" style={{ marginBottom: 8 }}>
                    Don dac biet khong duoc ap voucher/promotion.
                  </div>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setOfferMode("voucher");
                      setAppliedOfferCode("");
                      setSelectedGiftItems([]);
                      setGiftPickerOpen(false);
                      setGiftPickerQtyMap({});
                      setGiftPickerNotes({});
                      setPricingPreview(null);
                    }}
                    disabled={
                      mode === "payment" ||
                      pricingLoading ||
                      editingLocked ||
                      isSpecialOrderType(orderType)
                    }
                    style={{
                      minHeight: 42,
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: offerMode === "voucher" ? "#111827" : "#fff",
                      color: offerMode === "voucher" ? "#fff" : "#111",
                      fontWeight: 700,
                    }}
                  >
                    Voucher
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOfferMode("promotion");
                      setAppliedOfferCode("");
                      setSelectedGiftItems([]);
                      setGiftPickerOpen(false);
                      setGiftPickerQtyMap({});
                      setGiftPickerNotes({});
                      openPromotionStep();
                    }}
                    disabled={
                      mode === "payment" ||
                      pricingLoading ||
                      editingLocked ||
                      isSpecialOrderType(orderType)
                    }
                    style={{
                      minHeight: 42,
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: offerMode === "promotion" ? "#111827" : "#fff",
                      color: offerMode === "promotion" ? "#fff" : "#111",
                      fontWeight: 700,
                    }}
                  >
                    Promotion
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 58px 58px", gap: 8 }}>
                  <input
                    value={offerCode}
                    onChange={(e) => setOfferCode(e.target.value.trim())}
                    placeholder={
                      offerMode === "voucher"
                        ? "Nhap voucher code"
                        : "Nhap promotion code"
                    }
                    style={memberInputStyle}
                    disabled={
                      mode === "payment" ||
                      editingLocked ||
                      isSpecialOrderType(orderType)
                    }
                  />
                  <button
                    onClick={applyOffer}
                    disabled={
                      mode === "payment" ||
                      pricingLoading ||
                      editingLocked ||
                      isSpecialOrderType(orderType)
                    }
                  >
                    Ap
                  </button>
                  <button
                    onClick={clearOffer}
                    disabled={
                      mode === "payment" ||
                      pricingLoading ||
                      editingLocked ||
                      isSpecialOrderType(orderType)
                    }
                  >
                    Bo
                  </button>
                </div>

                {appliedOfferCode ? (
                  <div className="pos-alert pos-alert--success" style={{ marginTop: 8 }}>
                    <div>
                      <b>Dang ap {offerMode === "voucher" ? "voucher" : "promotion"}:</b>{" "}
                      {appliedOfferCode}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      Neu da dung uu dai thi khong duoc chon combo.
                    </div>
                    {pricingPreview?.appliedVoucher?.benefitType === "GIFT" ? (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        Voucher nay la qua tang, khong giam truc tiep vao tien.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {pricingPreview?.giftSelection ? (
                  <div className="pos-alert pos-alert--warning" style={{ marginTop: 8 }}>
                    <div>
                      <b>Uu dai qua tang:</b>{" "}
                      {pricingPreview.giftSelection.required
                        ? `Can chon ${pricingPreview.giftSelection.expectedQty} mon tang`
                        : `Da ap ${pricingPreview.giftSelection.expectedQty} mon tang`}
                    </div>

                    {pricingPreview.giftSelection.required ? (
                      <button
                        style={{ marginTop: 8 }}
                        onClick={() => setGiftPickerOpen(true)}
                        disabled={mode === "payment" || editingLocked}
                      >
                        Chon mon tang
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      {giftPickerOpen && pricingPreview?.giftSelection ? (
        <div className="pos-modal-backdrop">
          <div
            className="pos-modal-card pos-scroll"
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "85vh",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Chọn món tặng</h3>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                  Chọn đúng {pricingPreview.giftSelection.expectedQty} món
                </div>
              </div>

              <button onClick={() => setGiftPickerOpen(false)}>Đóng</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {pricingPreview.giftSelection.eligibleVariants.map((gift) => {
                const qty = giftPickerQtyMap[gift.productVariantId] || 0;
                const note = giftPickerNotes[gift.productVariantId] || "";

                return (
                  <div
                    key={gift.productVariantId}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {gift.productName} ({gift.size})
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                          Giá gốc: {formatMoney(gift.price)}
                        </div>
                        {gift.categoryName ? (
                          <div style={{ fontSize: 13, marginTop: 4 }}>
                            Nhóm: {gift.categoryName}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          onClick={() =>
                            setGiftPickerQtyMap((prev) => ({
                              ...prev,
                              [gift.productVariantId]: Math.max(
                                0,
                                (prev[gift.productVariantId] || 0) - 1
                              ),
                            }))
                          }
                        >
                          -
                        </button>

                        <span>{qty}</span>

                        <button
                          onClick={() =>
                            setGiftPickerQtyMap((prev) => ({
                              ...prev,
                              [gift.productVariantId]:
                                (prev[gift.productVariantId] || 0) + 1,
                            }))
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <input
                        value={note}
                        onChange={(e) =>
                          setGiftPickerNotes((prev) => ({
                            ...prev,
                            [gift.productVariantId]: e.target.value,
                          }))
                        }
                        placeholder="Ghi chú cho món tặng (nếu có)"
                        style={{ width: "100%", padding: 8 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 14 }}>
                Đã chọn:{" "}
                <b>
                  {Object.values(giftPickerQtyMap).reduce(
                    (s, x) => s + Number(x || 0),
                    0
                  )}
                </b>{" "}
                / {pricingPreview.giftSelection.expectedQty}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={clearGiftSelection}>Bỏ chọn quà</button>
                <button onClick={confirmGiftSelection}>Xác nhận quà tặng</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {orderTypePickerOpen ? (
        <div
          className="pos-modal-backdrop"
          onClick={() => setOrderTypePickerOpen(false)}
        >
          <div
            className="pos-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Chọn loại đơn</h3>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                  Đơn đặc biệt sẽ tách riêng trong báo cáo và không được áp
                  voucher/promotion.
                </div>
              </div>

              <button onClick={() => setOrderTypePickerOpen(false)}>Đóng</button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(
                ["NORMAL", "TEST", "FREE", "INTERNAL", "GUEST", "COMPENSATION"] as OrderType[]
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setOrderType(type);
                    if (type === "NORMAL") {
                      setSpecialNote("");
                    }
                    resetOfferStateForOrderTypeChange();
                  }}
                  className={
                    orderType === type
                      ? "pos-select-card is-active"
                      : "pos-select-card"
                  }
                  style={{ padding: "10px 14px" }}
                >
                  {type}
                </button>
              ))}
            </div>

            {isSpecialOrderType(orderType) ? (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={specialNote}
                  onChange={(e) => {
                    setSpecialNote(e.target.value);
                    setPaymentChecked(false);
                  }}
                  placeholder="Lý do / ghi chú đơn đặc biệt"
                  rows={4}
                  style={{ width: "100%" }}
                />
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                  Đơn đặc biệt vẫn trừ kho như order thường, nhưng sẽ được tách
                  riêng để báo cáo.
                </div>
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button onClick={() => setOrderTypePickerOpen(false)}>Xong</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal In Hóa Đơn Chuẩn K80/K58 */}
      <PosReceiptModal
        open={receiptModalOpen}
        order={receiptOrderData}
        config={posConfig}
        onClose={() => setReceiptModalOpen(false)}
        onNewOrder={handleNewOrder}
      />
    </div>
  );
}

function CashChip(props: {
  active?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={props.onClick}
      className={props.active ? "pos-chip-toggle is-active" : "pos-chip-toggle"}
    >
      {props.label}
    </button>
  );
}

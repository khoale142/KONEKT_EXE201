export type PosCustomerPreviewLineItem = {
  key: string;
  productName: string;
  size?: string | null;
  qty: number;
  unitPrice: number;
  note?: string | null;
  lineTotal: number;
};

export type PosCustomerPreviewComboChild = {
  productName: string;
  size?: string | null;
  quantity: number;
};

export type PosCustomerPreviewComboItem = {
  key: string;
  name: string;
  qty: number;
  comboPrice: number;
  lineTotal: number;
  items: PosCustomerPreviewComboChild[];
};

export type PosCustomerPreviewGiftItem = {
  productVariantId: number;
  quantity: number;
  note?: string | null;
};

export type PosCustomerPreviewSnapshot = {
  pickupNumber: number | null;
  mode: string;
  memberName?: string | null;
  phone?: string | null;
  orderType: string;
  specialNote?: string | null;
  offerMode?: "voucher" | "promotion";
  appliedOfferCode?: string | null;
  pricing: {
    subtotalAmount: number;
    promotionDiscountAmount: number;
    voucherDiscountAmount: number;
    totalDiscountAmount: number;
    finalAmount: number;
  };
  items: PosCustomerPreviewLineItem[];
  combos: PosCustomerPreviewComboItem[];
  selectedGiftItems: PosCustomerPreviewGiftItem[];
  payment?: {
    method: "cash" | "transfer";
    gatewayOrderId?: number | null;
    orderRef?: string | null;
    qrImageUrl?: string | null;
    expiresAt?: string | null;
    status?: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | null;
  } | null;
  created?: {
    orderCode: string;
    pickupNumber: number;
    finalAmount: number;
    paymentMethod: string;
    status: string;
  } | null;
  shiftBlockedMessage?: string | null;
  updatedAt: string;
};

export const POS_CUSTOMER_PREVIEW_STORAGE_KEY = "pos_customer_preview_v1";
const POS_CUSTOMER_PREVIEW_EVENT = "pos-customer-preview-updated";
const POS_CUSTOMER_PREVIEW_CHANNEL = "pos-customer-preview-channel";

let previewChannel: BroadcastChannel | null = null;

function getPreviewChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;

  if (!previewChannel) {
    previewChannel = new BroadcastChannel(POS_CUSTOMER_PREVIEW_CHANNEL);
  }

  return previewChannel;
}

export function readPosCustomerPreview(): PosCustomerPreviewSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(POS_CUSTOMER_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PosCustomerPreviewSnapshot;
  } catch {
    return null;
  }
}

export function publishPosCustomerPreview(snapshot: PosCustomerPreviewSnapshot) {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(snapshot);
  window.localStorage.setItem(POS_CUSTOMER_PREVIEW_STORAGE_KEY, raw);
  window.dispatchEvent(new CustomEvent(POS_CUSTOMER_PREVIEW_EVENT));
  getPreviewChannel()?.postMessage({ type: "updated" });
}

export function clearPosCustomerPreview() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(POS_CUSTOMER_PREVIEW_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(POS_CUSTOMER_PREVIEW_EVENT));
  getPreviewChannel()?.postMessage({ type: "cleared" });
}

export function subscribePosCustomerPreview(onChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === POS_CUSTOMER_PREVIEW_STORAGE_KEY) {
      onChange();
    }
  };

  const onLocal = () => onChange();
  const onMessage = () => onChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(
    POS_CUSTOMER_PREVIEW_EVENT,
    onLocal as EventListener,
  );

  const channel = getPreviewChannel();
  channel?.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(
      POS_CUSTOMER_PREVIEW_EVENT,
      onLocal as EventListener,
    );
    channel?.removeEventListener("message", onMessage);
  };
}

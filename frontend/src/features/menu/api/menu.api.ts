import api from "../../../lib/http/axios";

export type MenuVariant = { id: number; size: string; price: number };
export type MenuProduct = {
  id?: number;
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  variants: MenuVariant[];
  /** Hết món - không cho thêm vào giỏ */
  isSoldOut?: boolean;
  /** Món mới */
  isNew?: boolean;
  /** Best seller */
  isBestSeller?: boolean;
};
export type MenuCategory = { key: string; name: string; products: MenuProduct[] };
export type MenuComboItem = {
  productVariantId: number;
  productName: string;
  size: string;
  unitPrice: number;
  quantity: number;
};
export type MenuCombo = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  priority?: number;
  items: MenuComboItem[];
};

/** Lấy thực đơn (công khai, không cần đăng nhập) */
export async function getPublicMenu() {
  const r = await api.get("/menu");
  return r.data as { categories: MenuCategory[]; combos?: MenuCombo[] };
}

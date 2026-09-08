import api from "../../../lib/http/axios";

export type MenuVariant = {
  id: number;
  sku?: string;
  size: string;
  price: number;
};

export type MenuProduct = {
  id?: number;
  name: string;
  variants: MenuVariant[];
};

export type MenuCategory = {
  key: string;
  name: string;
  products: MenuProduct[];
};

export type MenuComboItem = {
  productVariantId: number;
  sku?: string;
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

export async function posGetMenu() {
  const r = await api.get("/pos/menu");
  return r.data as {
    categories: MenuCategory[];
    combos: MenuCombo[];
  };
}
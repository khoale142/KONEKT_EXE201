import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "../../../app/store/auth.store";

let _lastUserId: string | undefined;

export type CartItem = {
  productVariantId: number;
  productName: string;
  size: string;
  price: number;
  quantity: number;
  note?: string;
};

export type CartComboItem = {
  comboId: number;
  comboName: string;
  comboPrice: number;
  quantity: number;
  items: Array<{
    productVariantId: number;
    productName: string;
    size: string;
    unitPrice: number;
    quantity: number;
  }>;
};

type StoreCart = {
  storeName: string;
  items: CartItem[];
  combos: CartComboItem[];
};

/** Một giỏ / user; cửa hàng chỉ là nơi nhận (storeId), không tách giỏ theo quán */
export type UserCartSnapshot = {
  storeId: number | null;
  storeName: string | null;
  items: CartItem[];
  combos: CartComboItem[];
};

type LegacyUserCartSnapshot = {
  storeId: number | null;
  storeName: string | null;
  cartsByStore: Record<string, StoreCart>;
};

function mergeLegacyStoreCarts(cartsByStore: Record<string, StoreCart>): {
  items: CartItem[];
  combos: CartComboItem[];
} {
  const itemMap = new Map<number, CartItem>();
  const comboMap = new Map<number, CartComboItem>();
  for (const sc of Object.values(cartsByStore || {})) {
    for (const it of sc.items || []) {
      const ex = itemMap.get(it.productVariantId);
      if (ex) {
        itemMap.set(it.productVariantId, { ...ex, quantity: ex.quantity + it.quantity });
      } else {
        itemMap.set(it.productVariantId, { ...it });
      }
    }
    for (const c of sc.combos || []) {
      const ex = comboMap.get(c.comboId);
      if (ex) {
        comboMap.set(c.comboId, { ...ex, quantity: ex.quantity + c.quantity });
      } else {
        comboMap.set(c.comboId, { ...c });
      }
    }
  }
  return { items: Array.from(itemMap.values()), combos: Array.from(comboMap.values()) };
}

function normalizeUserSnapshot(raw: UserCartSnapshot | LegacyUserCartSnapshot | undefined): UserCartSnapshot {
  if (!raw) return { storeId: null, storeName: null, items: [], combos: [] };
  if ("items" in raw && Array.isArray(raw.items)) {
    return {
      storeId: raw.storeId ?? null,
      storeName: raw.storeName ?? null,
      items: raw.items,
      combos: raw.combos ?? [],
    };
  }
  if ("cartsByStore" in raw && raw.cartsByStore && typeof raw.cartsByStore === "object") {
    const merged = mergeLegacyStoreCarts(raw.cartsByStore);
    return {
      storeId: raw.storeId ?? null,
      storeName: raw.storeName ?? null,
      items: merged.items,
      combos: merged.combos,
    };
  }
  return { storeId: null, storeName: null, items: [], combos: [] };
}

function snapshotActive(s: {
  storeId: number | null;
  storeName: string | null;
  items: CartItem[];
  combos: CartComboItem[];
}): UserCartSnapshot {
  return {
    storeId: s.storeId,
    storeName: s.storeName,
    items: s.items,
    combos: s.combos,
  };
}

type CartSlice = {
  cartsByUser: Record<string, UserCartSnapshot>;
  storeId: number | null;
  storeName: string | null;
  items: CartItem[];
  combos: CartComboItem[];
};

function persistCustomerCart(slice: CartSlice): Pick<CartSlice, "cartsByUser"> {
  const user = useAuthStore.getState().user;
  if (user?.portal !== "CUSTOMER" || !user.sub) {
    return { cartsByUser: slice.cartsByUser };
  }
  return {
    cartsByUser: {
      ...slice.cartsByUser,
      [user.sub]: snapshotActive(slice),
    },
  };
}

type OnlineCartState = {
  storeId: number | null;
  storeName: string | null;
  items: CartItem[];
  combos: CartComboItem[];
  cartsByUser: Record<string, UserCartSnapshot>;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  addCombo: (combo: Omit<CartComboItem, "quantity"> & { quantity?: number }) => void;
  updateQuantity: (productVariantId: number, delta: number) => void;
  updateComboQuantity: (comboId: number, delta: number) => void;
  updateNote: (productVariantId: number, note: string) => void;
  removeItem: (productVariantId: number) => void;
  removeCombo: (comboId: number) => void;
  setStore: (storeId: number, storeName: string) => void;
  clearCart: () => void;
  switchToUserCart: (userId: string | null) => void;
  getTotalItems: () => number;
  getItemsForApi: () => Array<{ productVariantId: number; quantity: number; note?: string }>;
  getCombosForApi: () => Array<{ comboId: number; quantity: number }>;
};

export const useOnlineCartStore = create<OnlineCartState>()(
  persist(
    (set, get) => ({
      storeId: null,
      storeName: null,
      items: [],
      combos: [],
      cartsByUser: {},

      addItem: (item) => {
        set((state) => {
          if (!state.storeId) return state;
          const qty = item.quantity ?? 1;
          const existing = state.items.find((i) => i.productVariantId === item.productVariantId);
          const newItems = existing
            ? state.items.map((i) =>
                i.productVariantId === item.productVariantId ? { ...i, quantity: i.quantity + qty } : i
              )
            : [...state.items, { ...item, quantity: qty }];
          const slice: CartSlice = {
            ...state,
            items: newItems,
          };
          return { ...state, items: newItems, ...persistCustomerCart(slice) };
        });
      },

      addCombo: (combo) => {
        set((state) => {
          if (!state.storeId) return state;
          const qty = combo.quantity ?? 1;
          const existing = state.combos.find((c) => c.comboId === combo.comboId);
          const newCombos = existing
            ? state.combos.map((c) => (c.comboId === combo.comboId ? { ...c, quantity: c.quantity + qty } : c))
            : [...state.combos, { ...combo, quantity: qty }];
          const slice: CartSlice = { ...state, combos: newCombos };
          return { ...state, combos: newCombos, ...persistCustomerCart(slice) };
        });
      },

      updateQuantity: (productVariantId, delta) => {
        set((state) => {
          if (!state.storeId) return state;
          const newItems = state.items
            .map((i) =>
              i.productVariantId === productVariantId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
            )
            .filter((i) => i.quantity > 0);
          const slice: CartSlice = { ...state, items: newItems };
          return { ...state, items: newItems, ...persistCustomerCart(slice) };
        });
      },

      updateComboQuantity: (comboId, delta) => {
        set((state) => {
          if (!state.storeId) return state;
          const newCombos = state.combos
            .map((c) => (c.comboId === comboId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c))
            .filter((c) => c.quantity > 0);
          const slice: CartSlice = { ...state, combos: newCombos };
          return { ...state, combos: newCombos, ...persistCustomerCart(slice) };
        });
      },

      updateNote: (productVariantId, note) => {
        set((state) => {
          if (!state.storeId) return state;
          const newItems = state.items.map((i) =>
            i.productVariantId === productVariantId ? { ...i, note: note.length ? note : undefined } : i
          );
          const slice: CartSlice = { ...state, items: newItems };
          return { ...state, items: newItems, ...persistCustomerCart(slice) };
        });
      },

      removeItem: (productVariantId) => {
        set((state) => {
          if (!state.storeId) return state;
          const newItems = state.items.filter((i) => i.productVariantId !== productVariantId);
          const slice: CartSlice = { ...state, items: newItems };
          return { ...state, items: newItems, ...persistCustomerCart(slice) };
        });
      },

      removeCombo: (comboId) => {
        set((state) => {
          if (!state.storeId) return state;
          const newCombos = state.combos.filter((c) => c.comboId !== comboId);
          const slice: CartSlice = { ...state, combos: newCombos };
          return { ...state, combos: newCombos, ...persistCustomerCart(slice) };
        });
      },

      setStore: (storeId, storeName) => {
        set((state) => {
          const slice: CartSlice = { ...state, storeId, storeName };
          return { ...state, storeId, storeName, ...persistCustomerCart(slice) };
        });
      },

      clearCart: () => {
        set((state) => {
          const user = useAuthStore.getState().user;
          const userId = user?.portal === "CUSTOMER" ? user.sub : undefined;
          const empty: UserCartSnapshot = { storeId: null, storeName: null, items: [], combos: [] };
          const nextCarts = userId
            ? { ...state.cartsByUser, [userId]: empty }
            : state.cartsByUser;
          return {
            ...state,
            storeId: null,
            storeName: null,
            items: [],
            combos: [],
            cartsByUser: nextCarts,
          };
        });
      },

      switchToUserCart: (userId) => {
        const { storeId, storeName, items, combos, cartsByUser } = get();
        const authUser = useAuthStore.getState().user;
        let newCartsByUser = { ...cartsByUser };

        if (userId === null) {
          const outgoingSub =
            authUser?.portal === "CUSTOMER" && authUser.sub ? authUser.sub : _lastUserId;
          if (outgoingSub) {
            newCartsByUser[outgoingSub] = normalizeUserSnapshot({
              storeId,
              storeName,
              items,
              combos,
            });
          }
          _lastUserId = undefined;
          set({
            cartsByUser: newCartsByUser,
            storeId: null,
            storeName: null,
            items: [],
            combos: [],
          });
          return;
        }

        if (_lastUserId && _lastUserId !== userId) {
          newCartsByUser[_lastUserId] = normalizeUserSnapshot({
            storeId,
            storeName,
            items,
            combos,
          });
        }

        _lastUserId = userId;
        const saved = normalizeUserSnapshot(newCartsByUser[userId]);
        set({
          cartsByUser: newCartsByUser,
          storeId: saved.storeId,
          storeName: saved.storeName,
          items: saved.items,
          combos: saved.combos,
        });
      },

      getTotalItems: () => {
        const { items, combos } = get();
        return items.reduce((s, i) => s + i.quantity, 0) + combos.reduce((s, c) => s + c.quantity, 0);
      },

      getItemsForApi: () => {
        const { items } = get();
        return items.map((i) => ({
          productVariantId: i.productVariantId,
          quantity: i.quantity,
          note: i.note?.trim() ? i.note.trim() : undefined,
        }));
      },

      getCombosForApi: () => {
        const { combos } = get();
        return combos.map((c) => ({
          comboId: c.comboId,
          quantity: c.quantity,
        }));
      },
    }),
    {
      name: "member-online-cart",
      partialize: (s) => ({ cartsByUser: s.cartsByUser }),
      merge: (persistedState, currentState) => {
        const p = persistedState as Record<string, unknown> | undefined;
        const raw = (p?.cartsByUser as Record<string, UserCartSnapshot | LegacyUserCartSnapshot>) ?? {};
        const cartsByUser: Record<string, UserCartSnapshot> = {};
        for (const [k, v] of Object.entries(raw)) {
          cartsByUser[k] = normalizeUserSnapshot(v);
        }
        return {
          ...currentState,
          cartsByUser,
          storeId: null,
          storeName: null,
          items: [],
          combos: [],
        };
      },
    }
  )
);

/** Món trong giỏ (chung toàn hệ thống, không theo quán) */
export function useCurrentStoreItems(): CartItem[] {
  return useOnlineCartStore((s) => s.items);
}

export function useCurrentStoreCombos(): CartComboItem[] {
  return useOnlineCartStore((s) => s.combos);
}

/** Gọi sau khi đăng nhập / F5: đợi persist giỏ load xong rồi mới áp snapshot user (tránh cartsByUser rỗng). */
export function ensureCustomerCartForUser(userSub: string) {
  const apply = () => useOnlineCartStore.getState().switchToUserCart(userSub);
  if (useOnlineCartStore.persist.hasHydrated()) {
    apply();
    return;
  }
  const unsub = useOnlineCartStore.persist.onFinishHydration(() => {
    unsub();
    apply();
  });
}

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  unitPricePaise: number;
  quantity: number;
  imageUrl: string | null;
  /** Cap from the daily menu (qty_remaining); null = unlimited. */
  maxQty: number | null;
}

interface CartState {
  /** Cart is scoped to a kitchen; switching kitchens clears it. */
  kitchenId: string | null;
  lines: Record<string, CartLine>; // key = productId::variantId
  setKitchen: (kitchenId: string) => void;
  add: (line: Omit<CartLine, 'quantity'>, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const lineKey = (productId: string, variantId: string | null) =>
  `${productId}::${variantId ?? 'base'}`;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      kitchenId: null,
      lines: {},
      setKitchen: (kitchenId) => {
        if (get().kitchenId !== kitchenId) set({ kitchenId, lines: {} });
      },
      add: (line, qty = 1) =>
        set((state) => {
          const key = lineKey(line.productId, line.variantId);
          const existing = state.lines[key];
          const cap = line.maxQty ?? Infinity;
          const nextQty = Math.min((existing?.quantity ?? 0) + qty, cap);
          return {
            lines: { ...state.lines, [key]: { ...line, quantity: nextQty } },
          };
        }),
      setQty: (key, qty) =>
        set((state) => {
          const line = state.lines[key];
          if (!line) return state;
          if (qty <= 0) {
            const { [key]: _drop, ...rest } = state.lines;
            return { lines: rest };
          }
          const cap = line.maxQty ?? Infinity;
          return { lines: { ...state.lines, [key]: { ...line, quantity: Math.min(qty, cap) } } };
        }),
      remove: (key) =>
        set((state) => {
          const { [key]: _drop, ...rest } = state.lines;
          return { lines: rest };
        }),
      clear: () => set({ lines: {} }),
    }),
    { name: 'hkos-cart' },
  ),
);

export const cartLineKey = lineKey;

/** Derived selectors. */
export const selectCartCount = (s: CartState) =>
  Object.values(s.lines).reduce((n, l) => n + l.quantity, 0);

export const selectCartTotalPaise = (s: CartState) =>
  Object.values(s.lines).reduce((n, l) => n + l.quantity * l.unitPricePaise, 0);

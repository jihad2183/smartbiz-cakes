import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isValidQuantity, MAX_ORDER_QUANTITY } from "@/lib/order-quantity";

export const POUND_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

/** price is the per-pound price of the cake; line price = price × pounds × quantity */
export type CartItem = {
  cake_id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  pounds: number;
};
type NewItem = Omit<CartItem, "quantity" | "pounds"> & { pounds?: number };
type CartCtx = {
  items: CartItem[];
  add: (item: NewItem, qty?: number) => boolean;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  setPounds: (key: string, pounds: number) => boolean;
  clear: () => void;
  total: number;
  count: number;
};
const Ctx = createContext<CartCtx | null>(null);
const KEY = "smartcake-cart";

export const lineKey = (i: { cake_id: string; pounds: number }) => `${i.cake_id}:${i.pounds}`;
export const linePrice = (i: { price: number; pounds: number }) => i.price * i.pounds;
const clampPounds = (p: number | undefined) => (POUND_OPTIONS.includes(p as 1) ? (p as number) : 1);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as CartItem[];
      setItems(
        raw.flatMap((item) => {
          const quantity = Number(item.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) return [];
          return [
            {
              ...item,
              quantity: Math.min(MAX_ORDER_QUANTITY, Math.max(1, Math.round(quantity))),
              pounds: clampPounds(item.pounds),
            },
          ];
        }),
      );
    } catch (error) {
      console.error("Could not restore the saved cart.", error);
    }
  }, []);
  const save = (next: CartItem[]) => {
    setItems(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const value: CartCtx = {
    items,
    add: (item, qty = 1) => {
      if (!isValidQuantity(qty)) return false;
      const full = { ...item, pounds: clampPounds(item.pounds) };
      const k = lineKey(full);
      const found = items.find((i) => lineKey(i) === k);
      const nextQuantity = (found?.quantity ?? 0) + qty;
      if (!isValidQuantity(nextQuantity)) return false;
      save(
        found
          ? items.map((i) => (lineKey(i) === k ? { ...i, quantity: nextQuantity } : i))
          : [...items, { ...full, quantity: qty }],
      );
      return true;
    },
    setQty: (k, qty) => {
      if (!isValidQuantity(qty)) return;
      save(items.map((i) => (lineKey(i) === k ? { ...i, quantity: qty } : i)));
    },
    setPounds: (k, p) => {
      const cur = items.find((i) => lineKey(i) === k);
      if (!cur) return false;
      const moved = { ...cur, pounds: clampPounds(p) };
      const rest = items.filter((i) => lineKey(i) !== k);
      const dup = rest.find((i) => lineKey(i) === lineKey(moved));
      if (dup && !isValidQuantity(dup.quantity + moved.quantity)) return false;
      save(
        dup
          ? rest.map((i) => (i === dup ? { ...i, quantity: i.quantity + moved.quantity } : i))
          : [...rest, moved],
      );
      return true;
    },
    remove: (k) => save(items.filter((i) => lineKey(i) !== k)),
    clear: () => save([]),
    total: items.reduce((s, i) => s + linePrice(i) * i.quantity, 0),
    count: items.reduce((s, i) => s + i.quantity, 0),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("CartProvider missing");
  return c;
};

export const formatPrice = (n: number) => `৳${Number(n).toLocaleString("en-US")}`;

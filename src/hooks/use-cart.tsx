import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isValidQuantity, MAX_ORDER_QUANTITY } from "@/lib/order-quantity";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
const OWNER_KEY = "smartcake-cart-owner";

export const lineKey = (i: { cake_id: string; pounds: number }) => `${i.cake_id}:${i.pounds}`;
export const linePrice = (i: { price: number; pounds: number }) => i.price * i.pounds;
const clampPounds = (p: number | undefined) => (POUND_OPTIONS.includes(p as 1) ? (p as number) : 1);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [items, setItems] = useState<CartItem[]>([]);
  const [restored, setRestored] = useState(false);
  const [syncedUserId, setSyncedUserId] = useState<string | null>(null);
  const previousItems = useRef<CartItem[]>([]);
  const latestItems = useRef<CartItem[]>(items);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  latestItems.current = items;

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as CartItem[];
      const restoredItems = raw.flatMap((item) => {
        const quantity = Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) return [];
        return [
          {
            ...item,
            quantity: Math.min(MAX_ORDER_QUANTITY, Math.max(1, Math.round(quantity))),
            pounds: clampPounds(item.pounds),
          },
        ];
      });
      setItems(restoredItems);
      previousItems.current = restoredItems;
    } catch (error) {
      console.error("Could not restore the saved cart.", error);
    } finally {
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!restored || !userId) {
      setSyncedUserId(null);
      return;
    }

    let active = true;
    const restoreAccountCart = async () => {
      const { data, error } = await supabase.from("cart_items").select("*").eq("user_id", userId);
      if (error) throw error;
      if (!active) return;

      const remoteItems: CartItem[] = (data ?? []).map((item) => ({
        cake_id: item.cake_id,
        name: item.cake_name,
        price: Number(item.unit_price),
        image_url: item.image_url,
        quantity: item.quantity,
        pounds: item.pounds,
        updated_at: new Date().toISOString(),
      }));
      const localOwner = localStorage.getItem(OWNER_KEY);
      const accountItems =
        remoteItems.length > 0
          ? remoteItems
          : localOwner === null || localOwner === userId
            ? latestItems.current
            : [];
      previousItems.current = accountItems;
      if (active) {
        setItems(accountItems);
        localStorage.setItem(KEY, JSON.stringify(accountItems));
        localStorage.setItem(OWNER_KEY, userId);
        setSyncedUserId(userId);
      }

      if (remoteItems.length === 0 && accountItems.length > 0) {
        const { error: saveError } = await supabase.from("cart_items").upsert(
          accountItems.map((item) => ({
            user_id: userId,
            cake_id: item.cake_id,
            cake_name: item.name,
            unit_price: item.price,
            image_url: item.image_url,
            quantity: item.quantity,
            pounds: item.pounds,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,cake_id,pounds" },
        );
        if (saveError) throw saveError;
      }
    };

    void restoreAccountCart().catch((error: unknown) => {
      if (!active) return;
      console.error("Could not synchronize the saved cart.", error);
      toast.error("Your cart is saved on this device, but could not sync to your account.");
    });
    return () => {
      active = false;
    };
  }, [restored, userId]);

  useEffect(() => {
    if (!restored) return;
    localStorage.setItem(KEY, JSON.stringify(items));
    if (!userId || syncedUserId !== userId) return;

    const before = previousItems.current;
    previousItems.current = items;
    const itemKey = (item: CartItem) => `${item.cake_id}:${item.pounds}`;
    const removed = before.filter(
      (item) => !items.some((current) => itemKey(current) === itemKey(item)),
    );
    writeQueue.current = writeQueue.current
      .then(async () => {
        for (const item of removed) {
          const { error } = await supabase
            .from("cart_items")
            .delete()
            .eq("user_id", userId)
            .eq("cake_id", item.cake_id)
            .eq("pounds", item.pounds);
          if (error) throw error;
        }
        if (items.length > 0) {
          const { error } = await supabase.from("cart_items").upsert(
            items.map((item) => ({
              user_id: userId,
              cake_id: item.cake_id,
              cake_name: item.name,
              unit_price: item.price,
              image_url: item.image_url,
              quantity: item.quantity,
              pounds: item.pounds,
            })),
            { onConflict: "user_id,cake_id,pounds" },
          );
          if (error) throw error;
        }
      })
      .catch((error: unknown) => {
        console.error("Could not save the cart to your account.", error);
        toast.error("Could not sync your cart to your account. Please try again.");
      });
  }, [items, restored, syncedUserId, userId]);

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

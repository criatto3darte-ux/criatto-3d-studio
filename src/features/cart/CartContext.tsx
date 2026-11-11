import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CartItem } from "@/shared/types/cart";
import * as logic from "./cart.logic";

const STORAGE_KEY = "criatto3d:cart";

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartItem, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Demo cart lives in the browser only; read after hydration to avoid SSR mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setItems(parsed.filter(logic.isCartItem));
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const add = useCallback((item: Omit<CartItem, "key">) => setItems((s) => logic.addItem(s, item)), []);
  const setQty = useCallback((key: string, q: number) => setItems((s) => logic.setQuantity(s, key, q)), []);
  const remove = useCallback((key: string) => setItems((s) => logic.removeItem(s, key)), []);
  const clear = useCallback(() => setItems([]), []);
  const replace = useCallback((next: CartItem[]) => setItems(next), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: logic.countItems(items),
      subtotalCents: logic.subtotalCents(items),
      add,
      setQuantity: setQty,
      remove,
      clear,
      replace,
    }),
    [items, add, setQty, remove, clear, replace],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

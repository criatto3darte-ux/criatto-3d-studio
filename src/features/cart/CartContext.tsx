import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { CartItem } from "@/shared/types/cart";
import * as logic from "./cart.logic";

import { cartRepository } from "./cart.repository";
import { availableQuantity, validVariants } from "./cart.stock";
import { demoRepository } from "@/features/demo-data/repository";
import { effectivePriceCents, publicProducts } from "@/features/demo-data/rules";

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (item: Omit<CartItem, "key">) => boolean;
  persistenceError: boolean;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { items, persistenceError } = useSyncExternalStore(cartRepository.subscribe, () => cartRepository.get(), cartRepository.serverSnapshot);
  const add = useCallback((item: Omit<CartItem, "key">) => {
    let added = false;
    cartRepository.update((current) => {
      const product = publicProducts(demoRepository.get()).find((p) => p.id === item.productId);
      if (!product || !validVariants(product, item.variants) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return current;
      const key = logic.buildCartKey(item.productId, item.variants);
      const existing = current.find((line) => line.key === key)?.quantity ?? 0;
      if (item.quantity > Math.min(availableQuantity(current, product), logic.MAX_ITEM_QUANTITY - existing)) return current;
      added = true;
      return logic.addItem(current, { ...item, name: product.name, unitPriceCents: effectivePriceCents(product) });
    });
    return added;
  }, []);
  const setQty = useCallback((key: string, q: number) => cartRepository.update((current) => {
    if (!Number.isSafeInteger(q)) return current;
    if (q <= 0) return logic.removeItem(current, key);
    const item = current.find((line) => line.key === key);
    const product = publicProducts(demoRepository.get()).find((p) => p.id === item?.productId);
    if (!product) return current;
    return logic.setQuantity(current, key, Math.min(q, availableQuantity(current, product, key)));
  }), []);
  const remove = useCallback((key: string) => { cartRepository.update((current) => logic.removeItem(current, key)); }, []);
  const clear = useCallback(() => { cartRepository.update(() => []); }, []);
  const replace = useCallback((next: CartItem[]) => { cartRepository.update(() => next); }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      persistenceError,
      count: logic.countItems(items),
      subtotalCents: logic.subtotalCents(items),
      add,
      setQuantity: setQty,
      remove,
      clear,
      replace,
    }),
    [items, persistenceError, add, setQty, remove, clear, replace],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

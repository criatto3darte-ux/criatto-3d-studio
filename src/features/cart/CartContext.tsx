import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CartItem } from "@/shared/types/cart";
import * as logic from "./cart.logic";

import { cartRepository } from "./cart.repository";
import { availableQuantity, validVariants } from "./cart.stock";
import { effectivePriceCents } from "@/features/demo-data/rules";
import { useStoreCatalog } from "@/features/catalog/catalog.service";

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
  const { items, persistenceError } = useSyncExternalStore(
    cartRepository.subscribe,
    () => cartRepository.get(),
    cartRepository.serverSnapshot,
  );
  const { products, state: catalogState } = useStoreCatalog();
  const add = useCallback(
    (item: Omit<CartItem, "key">) => {
      if (catalogState !== "ready") return false;
      let added = false;
      cartRepository.update((current) => {
        const product = products.find((p) => p.id === item.productId);
        if (
          !product ||
          !validVariants(product, item.variants) ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1
        )
          return current;
        const key = logic.buildCartKey(item.productId, item.variants);
        const existing = current.find((line) => line.key === key)?.quantity ?? 0;
        if (
          item.quantity >
          Math.min(availableQuantity(current, product), logic.MAX_ITEM_QUANTITY - existing)
        )
          return current;
        added = true;
        return logic.addItem(current, {
          ...item,
          name: product.name,
          unitPriceCents: effectivePriceCents(product),
        });
      });
      return added;
    },
    [catalogState, products],
  );
  const setQty = useCallback(
    (key: string, q: number) =>
      cartRepository.update((current) => {
        if (catalogState !== "ready" || !Number.isSafeInteger(q)) return current;
        if (q <= 0) return logic.removeItem(current, key);
        const item = current.find((line) => line.key === key);
        const product = products.find((p) => p.id === item?.productId);
        if (!product) return current;
        return logic.setQuantity(
          current,
          key,
          Math.min(q, availableQuantity(current, product, key)),
        );
      }),
    [catalogState, products],
  );
  const remove = useCallback((key: string) => {
    cartRepository.update((current) => logic.removeItem(current, key));
  }, []);
  const clear = useCallback(() => {
    cartRepository.update(() => []);
  }, []);
  const replace = useCallback((next: CartItem[]) => {
    cartRepository.update(() => next);
  }, []);

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

// Keep the provider and its consumer hook colocated as the public cart context API.
// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

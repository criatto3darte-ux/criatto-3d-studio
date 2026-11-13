import { useMemo } from "react";
import { useCart } from "./CartContext";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { applyReconciliation, isBlocking, purchasableItems, reconcileCart } from "./cart.reconcile";
import { subtotalCents, countItems } from "./cart.logic";
import { cartRepository } from "./cart.repository";
import { demoRepository } from "@/features/demo-data/repository";
import { publicProducts } from "@/features/demo-data/rules";

/** Cart checked against the live demo catalog (same source the admin edits). */
export function useReconciledCart() {
  const cart = useCart();
  const { products } = useStoreCatalog();
  return useMemo(() => {
    const lines = reconcileCart(cart.items, products);
    const items = purchasableItems(lines);
    return {
      ...cart,
      lines,
      items,
      count: countItems(items),
      subtotalCents: subtotalCents(items),
      blocked: lines.some(isBlocking),
      stockExceeded: lines.some((l) => l.status === "stock-exceeded"),
      priceChanged: lines.some((l) => l.priceChanged),
      update: () => cartRepository.update((current) => applyReconciliation(reconcileCart(current, publicProducts(demoRepository.get())))),
      validateCurrent: () => {
        const latest = reconcileCart(cartRepository.latest().items, publicProducts(demoRepository.get()));
        return latest.length > 0 && !latest.some(isBlocking)
          && JSON.stringify(purchasableItems(latest)) === JSON.stringify(items);
      },
    };
  }, [cart, products]);
}

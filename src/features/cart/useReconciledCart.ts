import { useMemo } from "react";
import { useCart } from "./CartContext";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { applyReconciliation, isBlocking, purchasableItems, reconcileCart } from "./cart.reconcile";
import { subtotalCents, countItems } from "./cart.logic";
import { cartRepository } from "./cart.repository";

/** Cart checked against the live demo catalog (same source the admin edits). */
export function useReconciledCart() {
  const cart = useCart();
  const { products, state: catalogState } = useStoreCatalog();
  return useMemo(() => {
    const lines = catalogState === "ready" ? reconcileCart(cart.items, products) : [];
    const items = purchasableItems(lines);
    return {
      ...cart,
      catalogState,
      lines,
      items,
      count: countItems(items),
      subtotalCents: subtotalCents(items),
      blocked: lines.some(isBlocking),
      stockExceeded: lines.some((l) => l.status === "stock-exceeded"),
      priceChanged: lines.some((l) => l.priceChanged),
      update: () => {
        if (catalogState === "ready")
          cartRepository.update((current) => applyReconciliation(reconcileCart(current, products)));
      },
      validateCurrent: () => {
        if (catalogState !== "ready") return false;
        const latest = reconcileCart(cartRepository.latest().items, products);
        return (
          latest.length > 0 &&
          !latest.some(isBlocking) &&
          JSON.stringify(purchasableItems(latest)) === JSON.stringify(items)
        );
      },
    };
  }, [cart, products, catalogState]);
}

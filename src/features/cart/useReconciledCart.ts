import { useMemo } from "react";
import { useCart } from "./CartContext";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { applyReconciliation, isBlocking, purchasableItems, reconcileCart } from "./cart.reconcile";
import { subtotalCents, countItems } from "./cart.logic";

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
      priceChanged: lines.some((l) => l.status === "price-changed"),
      update: () => cart.replace(applyReconciliation(lines)),
    };
  }, [cart, products]);
}

import type { Product } from "@/shared/types/catalog";
import type { CartItem } from "@/shared/types/cart";
import { effectivePriceCents } from "@/features/demo-data/rules";
import { availableQuantity, productQuantityLimit, quantityForProduct, validVariants } from "./cart.stock";

/**
 * Política da sessão de compra (CR-005):
 * - preço alterado no painel → o checkout usa o preço atual e avisa o comprador;
 * - produto excluído, despublicado, indisponível ou variação removida → item bloqueia a finalização
 *   até o carrinho ser atualizado.
 * Valores calculados no navegador não são seguros para produção; validar no backend depois.
 */
export type LineStatus = "ok" | "price-changed" | "unavailable" | "removed" | "stock-exceeded";

export interface ReconciledLine {
  item: CartItem; // already carries the current price when still purchasable
  status: LineStatus;
  previousUnitCents: number;
  maxQuantity: number;
  adjustedQuantity: number;
  priceChanged: boolean;
}

/** `products` must be the PUBLIC list (publicProducts), with effective availability applied. */
export function reconcileCart(items: CartItem[], products: Product[]): ReconciledLine[] {
  const allocated: CartItem[] = [];
  return items.map((item) => {
    const p = products.find((x) => x.id === item.productId);
    const previousUnitCents = item.unitPriceCents;
    const unavailable = { item, previousUnitCents, maxQuantity: 0, adjustedQuantity: 0, priceChanged: false };
    if (!p) return { ...unavailable, status: "removed" };
    if (productQuantityLimit(p) === 0 || !validVariants(p, item.variants)) return { ...unavailable, status: "unavailable" };
    const current = effectivePriceCents(p);
    const updated = { ...item, name: p.name, unitPriceCents: current };
    const maxQuantity = availableQuantity(items, p, item.key);
    const adjustedQuantity = Math.min(item.quantity, availableQuantity(allocated, p));
    if (adjustedQuantity > 0) allocated.push({ ...updated, quantity: adjustedQuantity });
    const exceeded = p.availability !== "sob-demanda" && quantityForProduct(items, p.id) > productQuantityLimit(p);
    const priceChanged = current !== previousUnitCents;
    return { item: updated, status: exceeded ? "stock-exceeded" : priceChanged ? "price-changed" : "ok", previousUnitCents, maxQuantity, adjustedQuantity, priceChanged };
  });
}

export const isBlocking = (l: ReconciledLine) => l.status === "unavailable" || l.status === "removed" || l.status === "stock-exceeded";

/** Items that may go to checkout, at current prices. */
export function purchasableItems(lines: ReconciledLine[]): CartItem[] {
  return lines.filter((l) => !isBlocking(l)).map((l) => l.item);
}

/** "Atualizar carrinho": apply current prices and drop items that can no longer be bought. */
export function applyReconciliation(lines: ReconciledLine[]): CartItem[] {
  return lines.filter((line) => line.adjustedQuantity > 0).map((line) => ({ ...line.item, quantity: line.adjustedQuantity }));
}

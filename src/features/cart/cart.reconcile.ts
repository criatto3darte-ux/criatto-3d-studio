import type { Product } from "@/shared/types/catalog";
import type { CartItem } from "@/shared/types/cart";
import { effectivePriceCents } from "@/features/demo-data/rules";

/**
 * Política da sessão de compra (CR-005):
 * - preço alterado no painel → o checkout usa o preço atual e avisa o comprador;
 * - produto excluído, despublicado, indisponível ou variação removida → item bloqueia a finalização
 *   até o carrinho ser atualizado.
 * Valores calculados no navegador não são seguros para produção; validar no backend depois.
 */
export type LineStatus = "ok" | "price-changed" | "unavailable" | "removed";

export interface ReconciledLine {
  item: CartItem; // already carries the current price when still purchasable
  status: LineStatus;
  previousUnitCents: number;
}

/** `products` must be the PUBLIC list (publicProducts), with effective availability applied. */
export function reconcileCart(items: CartItem[], products: Product[]): ReconciledLine[] {
  return items.map((item) => {
    const p = products.find((x) => x.id === item.productId);
    const previousUnitCents = item.unitPriceCents;
    if (!p) return { item, status: "removed", previousUnitCents };
    const variantsOk = Object.entries(item.variants).every(([group, label]) =>
      p.variants.find((g) => g.name === group)?.options.some((o) => o.label === label),
    );
    if (p.availability === "indisponivel" || !variantsOk) return { item, status: "unavailable", previousUnitCents };
    const current = effectivePriceCents(p);
    const updated = { ...item, name: p.name, unitPriceCents: current };
    return { item: updated, status: current !== previousUnitCents ? "price-changed" : "ok", previousUnitCents };
  });
}

export const isBlocking = (l: ReconciledLine) => l.status === "unavailable" || l.status === "removed";

/** Items that may go to checkout, at current prices. */
export function purchasableItems(lines: ReconciledLine[]): CartItem[] {
  return lines.filter((l) => !isBlocking(l)).map((l) => l.item);
}

/** "Atualizar carrinho": apply current prices and drop items that can no longer be bought. */
export function applyReconciliation(lines: ReconciledLine[]): CartItem[] {
  return purchasableItems(lines);
}

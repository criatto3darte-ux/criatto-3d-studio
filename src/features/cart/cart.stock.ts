import type { Product } from "@/shared/types/catalog";
import type { CartItem } from "@/shared/types/cart";
import { effectiveAvailability } from "@/features/demo-data/rules";
import { MAX_ITEM_QUANTITY } from "./cart.logic";

/** All variations of a ready-stock product share its stock; made-to-order has only the line limit. */
export function productQuantityLimit(product: Product): number {
  if (effectiveAvailability(product) === "indisponivel" || !product.active) return 0;
  return product.availability === "sob-demanda" ? MAX_ITEM_QUANTITY : Math.max(0, product.stock);
}

export function quantityForProduct(items: CartItem[], productId: string, excludingKey?: string): number {
  return items.reduce((sum, item) => sum + (item.productId === productId && item.key !== excludingKey ? item.quantity : 0), 0);
}

export function availableQuantity(items: CartItem[], product: Product, excludingKey?: string): number {
  const limit = productQuantityLimit(product);
  return product.availability === "sob-demanda" ? limit : Math.min(MAX_ITEM_QUANTITY, Math.max(0, limit - quantityForProduct(items, product.id, excludingKey)));
}

export function validVariants(product: Product, variants: Record<string, string>): boolean {
  return Object.entries(variants).every(([group, label]) =>
    product.variants.find((g) => g.name === group)?.options.some((o) => o.label === label),
  ) && product.variants.every((g) => g.options.some((o) => o.label === variants[g.name]));
}
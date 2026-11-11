import type { CartItem } from "@/shared/types/cart";

export const MAX_ITEM_QUANTITY = 99;

export function buildCartKey(productId: string, variants: Record<string, string>): string {
  const parts = Object.keys(variants)
    .sort()
    .map((k) => `${k}:${variants[k]}`);
  return [productId, ...parts].join("|");
}

export function addItem(items: CartItem[], item: Omit<CartItem, "key">): CartItem[] {
  const key = buildCartKey(item.productId, item.variants);
  const existing = items.find((i) => i.key === key);
  if (existing) {
    return items.map((i) =>
      i.key === key ? { ...i, quantity: Math.min(MAX_ITEM_QUANTITY, i.quantity + item.quantity) } : i,
    );
  }
  return [...items, { ...item, key, quantity: Math.min(MAX_ITEM_QUANTITY, Math.max(1, item.quantity)) }];
}

export function setQuantity(items: CartItem[], key: string, quantity: number): CartItem[] {
  if (quantity <= 0) return items.filter((i) => i.key !== key);
  return items.map((i) => (i.key === key ? { ...i, quantity: Math.min(MAX_ITEM_QUANTITY, quantity) } : i));
}

export function removeItem(items: CartItem[], key: string): CartItem[] {
  return items.filter((i) => i.key !== key);
}

export function countItems(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

export function subtotalCents(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0);
}

/** Guards against corrupted LocalStorage entries. */
export function isCartItem(x: unknown): x is CartItem {
  if (!x || typeof x !== "object") return false;
  const i = x as Record<string, unknown>;
  return typeof i.key === "string" && typeof i.productId === "string" && typeof i.name === "string"
    && Number.isInteger(i.unitPriceCents) && Number.isInteger(i.quantity) && (i.quantity as number) > 0
    && !!i.variants && typeof i.variants === "object";
}

export interface CartItem {
  /** productId + selected variant ids, so the same product with other variants is a separate line. */
  key: string;
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  variants: Record<string, string>;
  image?: string;
}

import type { Product } from "@/shared/types/catalog";
import { formatBRL } from "@/shared/utils/format";
import { effectivePriceCents } from "@/features/demo-data/rules";

/** Shows the promotional price with the regular one struck through when a valid promo exists. */
export function PriceTag({ product, className }: { product: Pick<Product, "priceCents" | "promoPriceCents">; className?: string | undefined }) {
  const price = effectivePriceCents(product);
  if (price === product.priceCents) return <span className={className}>{formatBRL(price)}</span>;
  return (
    <span className={className}>
      <s style={{ color: "var(--color-text-muted)", fontSize: "0.7em", fontWeight: 500, marginRight: 6 }} aria-label={`De ${formatBRL(product.priceCents)}`}>{formatBRL(product.priceCents)}</s>
      <span aria-label={`Por ${formatBRL(price)}`}>{formatBRL(price)}</span>
    </span>
  );
}

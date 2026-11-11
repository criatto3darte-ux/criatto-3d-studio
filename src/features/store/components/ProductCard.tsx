import { Link } from "@tanstack/react-router";
import type { Product } from "@/shared/types/catalog";
import { Badge } from "@/shared/ui/Badge";
import { formatBRL } from "@/shared/utils/format";
import { getCategory } from "@/features/catalog/categories";
import { ProductMedia } from "./ProductMedia";
import { AvailabilityBadge } from "./AvailabilityBadge";
import styles from "./ProductCard.module.css";

const badgeTone = { "Mais Vendido": "yellow", Novo: "cyan", Destaque: "magenta" } as const;

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className={styles.card}>
      {product.badge && <Badge tone={badgeTone[product.badge]} className={styles.badge}>{product.badge}</Badge>}
      <ProductMedia product={product} className={styles.media} />
      <div className={styles.body}>
        <span className={styles.category}>{getCategory(product.category).name}</span>
        <h3 className={styles.name}>
          <Link to="/produto/$slug" params={{ slug: product.slug }}>{product.name}</Link>
        </h3>
        <div className={styles.footer}>
          <span className={styles.price}>{formatBRL(product.priceCents)}</span>
          <AvailabilityBadge product={product} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <ul className={styles.grid} role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {products.map((p) => <li key={p.id}><ProductCard product={p} /></li>)}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={styles.grid} aria-busy="true" aria-label="Carregando produtos">
      {Array.from({ length: count }, (_, i) => <div key={i} className={styles.skeleton} />)}
    </div>
  );
}

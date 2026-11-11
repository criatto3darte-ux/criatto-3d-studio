import type { Product } from "@/shared/types/catalog";
import { MediaImage } from "@/shared/ui/MediaImage";
import { categoryVisual } from "./categoryVisual";

export function ProductMedia({ product, index = 0, eager, showTag, className }: { product: Product; index?: number; eager?: boolean; showTag?: boolean; className?: string | undefined }) {
  const v = categoryVisual[product.category];
  const Icon = v.icon;
  return (
    <MediaImage
      src={product.images[index]}
      alt={product.name}
      accent={v.accent}
      fallbackIcon={<Icon strokeWidth={1.3} aria-hidden="true" />}
      {...(eager ? { eager } : {})}
      {...(showTag === undefined ? {} : { showTag })}
      className={className}
    />
  );
}

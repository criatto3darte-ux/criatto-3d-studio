import type { Product } from "@/shared/types/catalog";
import { Badge, type BadgeTone } from "@/shared/ui/Badge";
import { AVAILABILITY_LABEL } from "@/features/catalog/catalog.logic";

const tone: Record<Product["availability"], BadgeTone> = { "pronta-entrega": "success", "sob-demanda": "warning", indisponivel: "danger" };

export function AvailabilityBadge({ product }: { product: Product }) {
  return <Badge tone={tone[product.availability]}>{AVAILABILITY_LABEL[product.availability]}</Badge>;
}

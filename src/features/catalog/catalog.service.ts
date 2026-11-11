import type { Product } from "@/shared/types/catalog";
import { demoProducts } from "./products.mock";

/** Mock data source. Will be swapped for server functions when the backend arrives. */
export const catalogService = {
  list: (): Product[] => demoProducts,
  bySlug: (slug: string): Product | undefined => demoProducts.find((p) => p.slug === slug),
  featured: (): Product[] => demoProducts.filter((p) => p.featured),
  newest: (): Product[] => demoProducts.filter((p) => p.badge === "Novo"),
};

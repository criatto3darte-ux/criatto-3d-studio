import { useMemo } from "react";
import type { Category, Product } from "@/shared/types/catalog";
import { useStoreContent } from "@/features/catalog/store-content";
import { useRemoteCatalog } from "@/features/catalog/supabase-catalog";
import type { DemoBanner, StoreSettings } from "@/features/demo-data/model";

export interface StoreCatalog {
  products: Product[];
  categories: Category[];
  state: "loading" | "ready" | "error" | "unconfigured";
  error: string | null;
  bySlug(slug: string): Product | undefined;
  featured(): Product[];
  newest(): Product[];
  categoryName(slug: string): string;
}

/** Public catalog comes only from Supabase's narrow public projections. */
export function useStoreCatalog(): StoreCatalog {
  const snapshot = useRemoteCatalog();
  return useMemo(() => {
    const products = [...snapshot.products];
    const categories = [...snapshot.categories];
    return {
      products,
      categories,
      state: snapshot.state,
      error: snapshot.error,
      bySlug: (slug) => products.find((product) => product.slug === slug),
      featured: () => products.filter((product) => product.featured),
      newest: () => products.filter((product) => product.badge === "Novo"),
      categoryName: (slug) =>
        categories.find((category) => category.slug === slug)?.name ?? "Sem categoria",
    };
  }, [snapshot]);
}

/** Public settings from the shared store content (one request per page). */
export function useStoreSettings(): StoreSettings {
  return useStoreContent().settings;
}

/** Published hero banner; undefined when there is none (or still loading). */
export function useHeroBanner(): DemoBanner | undefined {
  return useStoreContent().banner;
}

import { useMemo } from "react";
import type { Category, Product } from "@/shared/types/catalog";
import { useDemoData } from "@/features/demo-data/repository";
import { activeBanner, publicCategories, publicProducts } from "@/features/demo-data/rules";
import type { DemoBanner, StoreSettings } from "@/features/demo-data/model";

export interface StoreCatalog {
  products: Product[];
  categories: Category[];
  bySlug(slug: string): Product | undefined;
  featured(): Product[];
  newest(): Product[];
  categoryName(slug: string): string;
}

/** Public catalog: only active products in active categories (shared with the admin data layer). */
export function useStoreCatalog(): StoreCatalog {
  const data = useDemoData();
  return useMemo(() => {
    const products = publicProducts(data);
    const categories = publicCategories(data);
    const allCats = data.categories;
    return {
      products,
      categories,
      bySlug: (slug) => products.find((p) => p.slug === slug),
      featured: () => products.filter((p) => p.featured),
      newest: () => products.filter((p) => p.badge === "Novo"),
      categoryName: (slug) => allCats.find((c) => c.slug === slug)?.name ?? "Sem categoria",
    };
  }, [data]);
}

export function useStoreSettings(): StoreSettings {
  return useDemoData().settings;
}

export function useHeroBanner(): DemoBanner | undefined {
  return activeBanner(useDemoData().banners);
}

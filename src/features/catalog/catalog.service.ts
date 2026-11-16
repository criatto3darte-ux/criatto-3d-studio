import { useEffect, useMemo, useState } from "react";
import { listPublishedBanners } from "@/features/catalog/banners.service";
import type { Category, Product } from "@/shared/types/catalog";
import { resolveContactSettings } from "@/config/contacts";
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

/** Contact fallback is official configuration, never LocalStorage/demo commerce data. */
export function useStoreSettings(): StoreSettings {
  return {
    name: "Criatto 3D",
    logo: "",
    deliveryInfo: "",
    ...resolveContactSettings(null),
  };
}

/** Read the public-only banner view; never show demo banners in live mode. */
export function useHeroBanner(): DemoBanner | undefined {
  const [banner, setBanner] = useState<DemoBanner | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void listPublishedBanners().then((items) => {
      if (active) setBanner(items[0]);
    }).catch(() => {
      if (active) setBanner(undefined);
    });
    return () => { active = false; };
  }, []);
  return banner;
}

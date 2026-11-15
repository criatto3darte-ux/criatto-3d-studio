import { useMemo } from "react";
import type { Category, Product } from "@/shared/types/catalog";
import { useDemoData } from "@/features/demo-data/repository";
import { activeBanner, publicCategories, publicProducts } from "@/features/demo-data/rules";
import type { DemoBanner, StoreSettings } from "@/features/demo-data/model";
import { resolveContactSettings } from "@/config/contacts";

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
  const data = useDemoData();
  // Aplica fallback para os canais oficiais: se o admin/demo não preencheu
  // WhatsApp/e-mail/redes, usamos a configuração oficial hardcoded.
  // Quando a loja estiver conectada ao Supabase, esta função continuará
  // funcionando porque o StoreSettings persistido terá precedência.
  const resolved = resolveContactSettings(data.settings);
  return {
    ...data.settings,
    whatsappNumber: resolved.whatsappNumber,
    email: resolved.email,
    instagram: resolved.instagram,
    tiktok: resolved.tiktok,
    address: resolved.address,
    serviceMessage: resolved.serviceMessage,
    offersNationalShipping: resolved.offersNationalShipping,
  };
}

export function useHeroBanner(): DemoBanner | undefined {
  return activeBanner(useDemoData().banners);
}

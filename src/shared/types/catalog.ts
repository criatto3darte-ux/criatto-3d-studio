/** Stable category identifier (lowercase, digits and hyphens). Categories are editable in the admin. */
export type CategorySlug = string;

export interface Category {
  /** Supabase UUID when loaded from the persisted catalog; demo-only categories omit it. */
  id?: string;
  /** Optimistic concurrency token for persisted categories. */
  version?: number;
  slug: CategorySlug;
  name: string;
  description: string;
  /** Optional photo path (public/images/categorias). Empty = placeholder. */
  image?: string;
  /** Hidden from the public store when false. */
  active: boolean;
  /** Display order (ascending). */
  order: number;
}

export type ProductAvailability = "pronta-entrega" | "sob-demanda" | "indisponivel";

export interface ProductVariantOption {
  id: string;
  label: string;
}

export interface ProductVariantGroup {
  id: string;
  name: string;
  required?: boolean;
  options: ProductVariantOption[];
}

export interface ProductVariantCombination {
  sku: string;
  selections: Record<string, string>;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  tags: string[];
  description: string;
  /** Price in cents (BRL) to avoid floating point errors. */
  priceCents: number;
  /** Optional promotional price in cents; must be lower than priceCents. */
  promoPriceCents?: number;
  images: string[];
  badge?: "Mais Vendido" | "Novo" | "Destaque" | "Promoção";
  availability: ProductAvailability;
  productionDays?: number;
  stock: number;
  featured: boolean;
  /** Published in the public store. */
  active: boolean;
  variants: ProductVariantGroup[];
  /** Persisted active SKU combinations; omitted only for demo/test-only fixtures. */
  variantCombinations?: ProductVariantCombination[];
}

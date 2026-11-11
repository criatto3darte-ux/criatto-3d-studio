/** Stable category identifier (lowercase, digits and hyphens). Categories are editable in the admin. */
export type CategorySlug = string;

export interface Category {
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
  name: "Cor" | "Tamanho" | "Acabamento";
  options: ProductVariantOption[];
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
  badge?: "Mais Vendido" | "Novo" | "Destaque";
  availability: ProductAvailability;
  productionDays?: number;
  stock: number;
  featured: boolean;
  /** Published in the public store. */
  active: boolean;
  variants: ProductVariantGroup[];
}

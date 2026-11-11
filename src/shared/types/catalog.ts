export type CategorySlug =
  | "decoracao"
  | "geek-nerd"
  | "casa-organizacao"
  | "vasos-jardinagem"
  | "presentes"
  | "utilitarios"
  | "personalizados";

export interface Category {
  slug: CategorySlug;
  name: string;
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
  images: string[];
  badge?: "Mais Vendido" | "Novo" | "Destaque";
  availability: ProductAvailability;
  productionDays?: number;
  stock: number;
  featured: boolean;
  variants: ProductVariantGroup[];
}

import type { CategorySlug, Product, ProductAvailability } from "@/shared/types/catalog";
import { isCategorySlug } from "./categories";
import { effectivePriceCents } from "@/features/demo-data/rules";

export const SORT_OPTIONS = [
  { value: "relevancia", label: "Relevância" },
  { value: "preco-asc", label: "Menor preço" },
  { value: "preco-desc", label: "Maior preço" },
  { value: "nome-asc", label: "Nome (A–Z)" },
  { value: "nome-desc", label: "Nome (Z–A)" },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const AVAILABILITY_LABEL: Record<ProductAvailability, string> = {
  "pronta-entrega": "Pronta entrega",
  "sob-demanda": "Sob encomenda",
  indisponivel: "Indisponível",
};

export const PAGE_SIZE = 9;

export interface CatalogSearch {
  q?: string;
  categoria?: CategorySlug;
  disponibilidade?: ProductAvailability;
  ordem?: SortKey;
}

const availabilities = Object.keys(AVAILABILITY_LABEL) as ProductAvailability[];
const sorts = SORT_OPTIONS.map((s) => s.value) as string[];

/** Parses untrusted URL search into a clean object (unknown/empty values are dropped). */
export function parseCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const out: CatalogSearch = {};
  if (typeof raw.q === "string" && raw.q.trim()) out.q = raw.q.trim().slice(0, 80);
  if (isCategorySlug(raw.categoria)) out.categoria = raw.categoria;
  if (typeof raw.disponibilidade === "string" && (availabilities as string[]).includes(raw.disponibilidade))
    out.disponibilidade = raw.disponibilidade as ProductAvailability;
  if (typeof raw.ordem === "string" && sorts.includes(raw.ordem) && raw.ordem !== "relevancia") out.ordem = raw.ordem as SortKey;
  return out;
}

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function filterProducts(products: Product[], s: CatalogSearch): Product[] {
  const terms = s.q ? normalize(s.q).split(/\s+/).filter(Boolean) : [];
  return products.filter((p) => {
    if (s.categoria && p.category !== s.categoria) return false;
    if (s.disponibilidade && p.availability !== s.disponibilidade) return false;
    if (terms.length) {
      const hay = normalize([p.name, p.description, ...p.tags].join(" "));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

const collator = new Intl.Collator("pt-BR");
const availabilityRank: Record<ProductAvailability, number> = { "pronta-entrega": 0, "sob-demanda": 1, indisponivel: 2 };

export function sortProducts(products: Product[], sort: SortKey = "relevancia"): Product[] {
  const list = [...products];
  switch (sort) {
    case "preco-asc": return list.sort((a, b) => effectivePriceCents(a) - effectivePriceCents(b));
    case "preco-desc": return list.sort((a, b) => effectivePriceCents(b) - effectivePriceCents(a));
    case "nome-asc": return list.sort((a, b) => collator.compare(a.name, b.name));
    case "nome-desc": return list.sort((a, b) => collator.compare(b.name, a.name));
    default:
      // Featured first, then purchasable items, keeping catalog order otherwise.
      return list.sort((a, b) => Number(b.featured) - Number(a.featured) || availabilityRank[a.availability] - availabilityRank[b.availability]);
  }
}

export function queryCatalog(products: Product[], s: CatalogSearch): Product[] {
  return sortProducts(filterProducts(products, s), s.ordem);
}

export function countByCategory(products: Product[], slug: CategorySlug): number {
  return products.filter((p) => p.category === slug).length;
}

export function relatedProducts(products: Product[], product: Product, limit = 4): Product[] {
  return products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, limit);
}

export function canPurchase(p: Product): boolean {
  return p.availability !== "indisponivel";
}

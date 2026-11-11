import type { Category, CategorySlug } from "@/shared/types/catalog";

export const categories: Category[] = [
  { slug: "decoracao", name: "Decoração", description: "Peças para dar personalidade aos ambientes.", active: true, order: 1 },
  { slug: "geek-nerd", name: "Geek e Nerd", description: "Itens para colecionadores e fãs de cultura pop.", active: true, order: 2 },
  { slug: "casa-organizacao", name: "Casa e Organização", description: "Soluções práticas para cada cantinho.", active: true, order: 3 },
  { slug: "vasos-jardinagem", name: "Vasos e Jardinagem", description: "Vasos e suportes para suas plantas.", active: true, order: 4 },
  { slug: "presentes", name: "Presentes", description: "Ideias criativas para presentear.", active: true, order: 5 },
  { slug: "utilitarios", name: "Utilitários", description: "Ferramentas e acessórios do dia a dia.", active: true, order: 6 },
  { slug: "personalizados", name: "Personalizados", description: "Peças feitas sob medida para você.", active: true, order: 7 },
];

export const categorySlugs = categories.map((c) => c.slug);

export function getCategory(slug: CategorySlug): Category {
  return categories.find((c) => c.slug === slug) ?? categories[0]!;
}

/** Format check only; categories are editable, so existence is checked against live data. */
export function isCategorySlug(v: unknown): v is CategorySlug {
  return typeof v === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 60;
}

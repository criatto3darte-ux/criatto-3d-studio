import type { Category, CategorySlug } from "@/shared/types/catalog";

export const categories: Category[] = [
  { slug: "decoracao", name: "Decoração", description: "Peças para dar personalidade aos ambientes." },
  { slug: "geek-nerd", name: "Geek e Nerd", description: "Itens para colecionadores e fãs de cultura pop." },
  { slug: "casa-organizacao", name: "Casa e Organização", description: "Soluções práticas para cada cantinho." },
  { slug: "vasos-jardinagem", name: "Vasos e Jardinagem", description: "Vasos e suportes para suas plantas." },
  { slug: "presentes", name: "Presentes", description: "Ideias criativas para presentear." },
  { slug: "utilitarios", name: "Utilitários", description: "Ferramentas e acessórios do dia a dia." },
  { slug: "personalizados", name: "Personalizados", description: "Peças feitas sob medida para você." },
];

export const categorySlugs = categories.map((c) => c.slug);

export function getCategory(slug: CategorySlug): Category {
  return categories.find((c) => c.slug === slug) ?? categories[0]!;
}

export function isCategorySlug(v: unknown): v is CategorySlug {
  return typeof v === "string" && (categorySlugs as string[]).includes(v);
}

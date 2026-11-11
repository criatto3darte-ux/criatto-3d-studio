import { createFileRoute } from "@tanstack/react-router";
import { parseCatalogSearch, type CatalogSearch } from "@/features/catalog/catalog.logic";
import { CatalogPage } from "@/features/store/pages/CatalogPage";

export const Route = createFileRoute("/_store/produtos")({
  validateSearch: (search: Record<string, unknown>): CatalogSearch => parseCatalogSearch(search),
  head: () => ({
    meta: [
      { title: "Produtos — Criatto 3D" },
      { name: "description", content: "Catálogo de produtos impressos em 3D: pesquise, filtre por categoria e disponibilidade e ordene por preço ou nome." },
      { property: "og:title", content: "Produtos — Criatto 3D" },
      { property: "og:description", content: "Catálogo de produtos impressos em 3D da Criatto 3D." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogPage,
});

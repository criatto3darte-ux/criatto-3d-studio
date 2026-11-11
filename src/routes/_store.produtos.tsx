import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/_store/produtos")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" && search.q ? { q: search.q } : {},
  head: () => ({
    meta: [
      { title: "Produtos — Criatto 3D" },
      { name: "description", content: "Catálogo com pesquisa, filtros por categoria e faixa de preço, ordenação e paginação." },
      { property: "og:title", content: "Produtos — Criatto 3D" },
      { property: "og:description", content: "Catálogo com pesquisa, filtros por categoria e faixa de preço, ordenação e paginação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container">
      <StagePlaceholder title="Produtos" description="Catálogo com pesquisa, filtros por categoria e faixa de preço, ordenação e paginação." stage="CR-002" />
    </div>
  );
}

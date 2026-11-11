import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/features/admin/pages/ProductsPage";

export const Route = createFileRoute("/admin/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Admin Criatto 3D" },
      { name: "description", content: "Cadastro, edição, variações, estoque, destaque e prazo de fabricação." },
      { property: "og:title", content: "Produtos — Admin Criatto 3D" },
      { property: "og:description", content: "Cadastro, edição, variações, estoque, destaque e prazo de fabricação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ProductsPage />;
}

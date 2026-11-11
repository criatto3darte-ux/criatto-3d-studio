import { createFileRoute } from "@tanstack/react-router";
import { AdminCategoriesPage } from "@/features/admin/pages/CategoriesPage";

export const Route = createFileRoute("/admin/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Admin Criatto 3D" },
      { name: "description", content: "Gerenciamento das categorias da loja." },
      { property: "og:title", content: "Categorias — Admin Criatto 3D" },
      { property: "og:description", content: "Gerenciamento das categorias da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <AdminCategoriesPage />;
}

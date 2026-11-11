import { createFileRoute } from "@tanstack/react-router";
import { CategoriesPage } from "@/features/store/pages/CategoriesPage";

export const Route = createFileRoute("/_store/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — Criatto 3D" },
      { name: "description", content: "Decoração, Geek / Nerd, Casa e Organização, Vasos e Jardinagem, Presentes, Utilitários e Personalizados." },
      { property: "og:title", content: "Categorias — Criatto 3D" },
      { property: "og:description", content: "Decoração, Geek / Nerd, Casa e Organização, Vasos e Jardinagem, Presentes, Utilitários e Personalizados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoriesPage,
});

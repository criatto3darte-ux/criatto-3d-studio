import { createFileRoute } from "@tanstack/react-router";
import { CartPage } from "@/features/store/pages/CartPage";

export const Route = createFileRoute("/_store/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Criatto 3D" },
      { name: "description", content: "Revise os produtos escolhidos, quantidades, variações e o total estimado." },
      { property: "og:title", content: "Carrinho — Criatto 3D" },
      { property: "og:description", content: "Revise os produtos escolhidos, quantidades, variações e o total estimado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CartPage,
});

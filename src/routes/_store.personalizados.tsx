import { createFileRoute } from "@tanstack/react-router";
import { CustomRequestPage } from "@/features/store/pages/CustomRequestPage";

export const Route = createFileRoute("/_store/personalizados")({
  head: () => ({
    meta: [
      { title: "Produtos personalizados — Criatto 3D" },
      { name: "description", content: "Formulário para solicitar uma impressão 3D sob medida, com imagem de referência." },
      { property: "og:title", content: "Produtos personalizados — Criatto 3D" },
      { property: "og:description", content: "Formulário para solicitar uma impressão 3D sob medida, com imagem de referência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomRequestPage,
});

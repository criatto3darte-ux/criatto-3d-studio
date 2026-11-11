import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/_store/personalizados")({
  head: () => ({
    meta: [
      { title: "Produtos personalizados — Criatto 3D" },
      { name: "description", content: "Formulário para solicitar uma impressão 3D sob medida, com envio de imagem de referência." },
      { property: "og:title", content: "Produtos personalizados — Criatto 3D" },
      { property: "og:description", content: "Formulário para solicitar uma impressão 3D sob medida, com envio de imagem de referência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container">
      <StagePlaceholder title="Produtos personalizados" description="Formulário para solicitar uma impressão 3D sob medida, com envio de imagem de referência." stage="CR-005" />
    </div>
  );
}

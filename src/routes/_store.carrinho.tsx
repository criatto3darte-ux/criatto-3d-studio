import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/_store/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Criatto 3D" },
      { name: "description", content: "Itens escolhidos, quantidades, variações e total estimado." },
      { property: "og:title", content: "Carrinho — Criatto 3D" },
      { property: "og:description", content: "Itens escolhidos, quantidades, variações e total estimado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container">
      <StagePlaceholder title="Carrinho" description="Itens escolhidos, quantidades, variações e total estimado." stage="CR-003" />
    </div>
  );
}

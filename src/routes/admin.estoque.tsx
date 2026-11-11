import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/admin/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Admin Criatto 3D" },
      { name: "description", content: "Controle de quantidades de pronta entrega." },
      { property: "og:title", content: "Estoque — Admin Criatto 3D" },
      { property: "og:description", content: "Controle de quantidades de pronta entrega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <StagePlaceholder title="Estoque" description="Controle de quantidades de pronta entrega." stage="CR-004" />;
}

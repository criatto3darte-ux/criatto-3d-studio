import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/_store/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Criatto 3D" },
      { name: "description", content: "Canais de atendimento da Criatto 3D." },
      { property: "og:title", content: "Contato — Criatto 3D" },
      { property: "og:description", content: "Canais de atendimento da Criatto 3D." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container">
      <StagePlaceholder title="Contato" description="Canais de atendimento da Criatto 3D." stage="CR-002" />
    </div>
  );
}

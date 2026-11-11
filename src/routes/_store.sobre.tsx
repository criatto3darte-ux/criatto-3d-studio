import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/_store/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre a Criatto 3D — Criatto 3D" },
      { name: "description", content: "Nossa história, processo de fabricação e compromisso com qualidade." },
      { property: "og:title", content: "Sobre a Criatto 3D — Criatto 3D" },
      { property: "og:description", content: "Nossa história, processo de fabricação e compromisso com qualidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container">
      <StagePlaceholder title="Sobre a Criatto 3D" description="Nossa história, processo de fabricação e compromisso com qualidade." stage="CR-002" />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/admin/cupons")({
  head: () => ({
    meta: [
      { title: "Cupons e Promoções — Admin Criatto 3D" },
      { name: "description", content: "Criação de cupons e campanhas." },
      { property: "og:title", content: "Cupons e Promoções — Admin Criatto 3D" },
      { property: "og:description", content: "Criação de cupons e campanhas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <StagePlaceholder title="Cupons e Promoções" description="Criação de cupons e campanhas." stage="CR-005" />;
}

import { createFileRoute } from "@tanstack/react-router";
import { CustomRequestsPage } from "@/features/admin/pages/CustomRequestsPage";

export const Route = createFileRoute("/admin/personalizacoes")({
  head: () => ({
    meta: [
      { title: "Personalizações — Admin Criatto 3D" },
      { name: "description", content: "Análise das solicitações personalizadas e orçamento manual." },
      { property: "og:title", content: "Personalizações — Admin Criatto 3D" },
      { property: "og:description", content: "Análise das solicitações personalizadas e orçamento manual." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <CustomRequestsPage />;
}

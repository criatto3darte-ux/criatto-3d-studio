import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/features/admin/pages/ReportsPage";

export const Route = createFileRoute("/admin/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Admin Criatto 3D" },
      { name: "description", content: "Relatórios demonstrativos de pedidos e vendas confirmadas." },
      { property: "og:title", content: "Relatórios — Admin Criatto 3D" },
      { property: "og:description", content: "Relatórios demonstrativos de pedidos e vendas confirmadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ReportsPage />;
}

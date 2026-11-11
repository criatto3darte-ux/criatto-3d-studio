import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/admin/pages/DashboardPage";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Painel Administrativo — Admin Criatto 3D" },
      { name: "description", content: "Cards de pedidos, gráficos de pedidos e vendas confirmadas, últimos pedidos e atalhos." },
      { property: "og:title", content: "Painel Administrativo — Admin Criatto 3D" },
      { property: "og:description", content: "Cards de pedidos, gráficos de pedidos e vendas confirmadas, últimos pedidos e atalhos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <DashboardPage />;
}

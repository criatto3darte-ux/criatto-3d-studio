import { createFileRoute } from "@tanstack/react-router";
import { StockPage } from "@/features/admin/pages/StockPage";

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
  return <StockPage />;
}

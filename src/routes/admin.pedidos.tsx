import { createFileRoute } from "@tanstack/react-router";
import { OrdersPage } from "@/features/admin/pages/OrdersPage";

export const Route = createFileRoute("/admin/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos — Admin Criatto 3D" },
      { name: "description", content: "Lista de pedidos com status, origem, valor estimado e conversa no WhatsApp." },
      { property: "og:title", content: "Pedidos — Admin Criatto 3D" },
      { property: "og:description", content: "Lista de pedidos com status, origem, valor estimado e conversa no WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <OrdersPage />;
}

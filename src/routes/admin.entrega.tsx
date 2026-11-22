import { createFileRoute } from "@tanstack/react-router";
import { ShippingPage } from "@/features/admin/pages/ShippingPage";

export const Route = createFileRoute("/admin/entrega")({
  head: () => ({
    meta: [
      { title: "Entrega — Admin Criatto 3D" },
      { name: "description", content: "CEP de origem, retirada, entrega local e tamanhos de embalagem." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ShippingPage />;
}

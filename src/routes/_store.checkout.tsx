import { createFileRoute } from "@tanstack/react-router";
import { CheckoutPage } from "@/features/store/pages/CheckoutPage";

export const Route = createFileRoute("/_store/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar pelo WhatsApp — Criatto 3D" },
      { name: "description", content: "Finalize seu pedido sem cadastro: informe nome e WhatsApp e conclua a compra conversando com a Criatto 3D." },
      { property: "og:title", content: "Finalizar pelo WhatsApp — Criatto 3D" },
      { property: "og:description", content: "Checkout sem cadastro, finalizado pelo WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/_store/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar pelo WhatsApp — Criatto 3D" },
      { name: "description", content: "Checkout sem cadastro: nome, WhatsApp e observações, com envio da mensagem pelo WhatsApp." },
      { property: "og:title", content: "Finalizar pelo WhatsApp — Criatto 3D" },
      { property: "og:description", content: "Checkout sem cadastro: nome, WhatsApp e observações, com envio da mensagem pelo WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container">
      <StagePlaceholder title="Finalizar pelo WhatsApp" description="Checkout sem cadastro: nome, WhatsApp e observações, com envio da mensagem pelo WhatsApp." stage="CR-003" />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/admin/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Admin Criatto 3D" },
      { name: "description", content: "Nome da loja, logo, WhatsApp comercial, redes sociais e entrega." },
      { property: "og:title", content: "Configurações — Admin Criatto 3D" },
      { property: "og:description", content: "Nome da loja, logo, WhatsApp comercial, redes sociais e entrega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <StagePlaceholder title="Configurações" description="Nome da loja, logo, WhatsApp comercial, redes sociais e entrega." stage="CR-005" />;
}

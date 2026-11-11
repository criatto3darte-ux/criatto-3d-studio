import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "@/features/store/pages/ContactPage";

export const Route = createFileRoute("/_store/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Criatto 3D" },
      { name: "description", content: "Canais de atendimento da Criatto 3D." },
      { property: "og:title", content: "Contato — Criatto 3D" },
      { property: "og:description", content: "Canais de atendimento da Criatto 3D." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

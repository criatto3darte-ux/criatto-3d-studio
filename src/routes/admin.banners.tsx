import { createFileRoute } from "@tanstack/react-router";
import { StagePlaceholder } from "@/shared/ui/StagePlaceholder";

export const Route = createFileRoute("/admin/banners")({
  head: () => ({
    meta: [
      { title: "Banners — Admin Criatto 3D" },
      { name: "description", content: "Gerenciamento dos banners da página inicial." },
      { property: "og:title", content: "Banners — Admin Criatto 3D" },
      { property: "og:description", content: "Gerenciamento dos banners da página inicial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <StagePlaceholder title="Banners" description="Gerenciamento dos banners da página inicial." stage="CR-005" />;
}

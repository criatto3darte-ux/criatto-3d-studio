import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/features/admin/pages/CustomersPage";

export const Route = createFileRoute("/admin/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Admin Criatto 3D" },
      { name: "description", content: "Clientes registrados internamente, com WhatsApp mascarado e histórico." },
      { property: "og:title", content: "Clientes — Admin Criatto 3D" },
      { property: "og:description", content: "Clientes registrados internamente, com WhatsApp mascarado e histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return <CustomersPage />;
}

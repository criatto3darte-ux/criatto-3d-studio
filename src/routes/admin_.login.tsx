import { createFileRoute, Link } from "@tanstack/react-router";
import { SystemPage } from "@/shared/ui/SystemPage";
import { buttonClass } from "@/shared/ui/Button";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Acesso administrativo — Criatto 3D" },
      { name: "description", content: "Acesso ao painel administrativo da Criatto 3D." },
      { property: "og:title", content: "Acesso administrativo — Criatto 3D" },
      { property: "og:description", content: "Acesso ao painel administrativo da Criatto 3D." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  return (
    <SystemPage
      title="Acesso administrativo"
      text="O login real será ativado quando o servidor for conectado. Por enquanto o painel funciona em modo demonstração, sem proteção de acesso."
      actions={
        <>
          <Link to="/admin" className={buttonClass("primary")}>Abrir painel demonstrativo</Link>
          <Link to="/" className={buttonClass("secondary")}>Voltar à loja</Link>
        </>
      }
    />
  );
}

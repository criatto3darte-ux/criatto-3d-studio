import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { SystemPage } from "@/shared/ui/SystemPage";
import { buttonClass } from "@/shared/ui/Button";
import { isSupabaseConfigured } from "@/lib/supabase/client";

async function adminLoginBeforeLoad() {
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured()) {
    throw redirect({ to: "/", replace: true, search: { adminDisabled: "1" } });
  }
}

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Acesso administrativo — Criatto 3D" },
      { name: "description", content: "Acesso ao painel administrativo da Criatto 3D." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  beforeLoad: adminLoginBeforeLoad,
  component: AdminLogin,
});

function AdminLogin() {
  return (
    <SystemPage
      title="Acesso administrativo"
      text="O login real será ativado quando o servidor for conectado."
      actions={
        <>
          <Link to="/admin" className={buttonClass("primary")}>Abrir painel</Link>
          <Link to="/" className={buttonClass("secondary")}>Voltar à loja</Link>
        </>
      }
    />
  );
}

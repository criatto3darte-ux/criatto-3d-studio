import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminLayout } from "@/features/admin/layout/AdminLayout";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";
import { isAdminAuthorized, sessionAal, sessionRoles } from "@/features/auth/lib/guards";

async function adminBeforeLoad() {
  // Guard client-only: em SSR não temos sessão.
  if (typeof window === "undefined") return;

  // Publicação pública SEM Supabase configurado: bloqueia o painel admin.
  // A área administrativa ainda está em homologação e não é disponibilizada
  // ao público. Redireciona para a loja.
  if (!isSupabaseConfigured()) {
    throw redirect({ to: "/", replace: true, search: { adminDisabled: "1" } });
  }

  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: "/admin/login", search: { mode: "login" as const }, replace: true });
  }
  // Sessão existe mas AAL1 ou sem roles:
  //  - AAL1 (sem TOTP verificado) → vai para /auth/mfa?next=/admin.
  //  - AAL2 mas sem role admin → volta ao login com erro genérico.
  if (!isAdminAuthorized(data.session)) {
    const aal = sessionAal(data.session);
    if (aal === "aal1" && sessionRoles(data.session).length > 0) {
      // Desafio MFA — fator já existe, só falta verificar.
      throw redirect({ to: "/auth/mfa", search: { next: "/admin" }, replace: true });
    }
    // Sem autorização efetiva: volta ao login e encerra a sessão parcial.
    await supabase.auth.signOut();
    throw redirect({ to: "/admin/login", search: { mode: "login" as const }, replace: true });
  }
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: adminBeforeLoad,
  component: () => (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  ),
});

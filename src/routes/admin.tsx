import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminLayout } from "@/features/admin/layout/AdminLayout";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";
import { isAdminAuthorized } from "@/features/auth/lib/guards";

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
  if (!data.session || !isAdminAuthorized(data.session)) {
    throw redirect({ to: "/auth/login", replace: true });
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

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminLayout } from "@/features/admin/layout/AdminLayout";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase/client";
import { isAdminAuthorized } from "@/features/auth/lib/guards";

async function adminBeforeLoad() {
  // Guard client-only: em SSR não temos a sessão do Supabase (ela vive no
  // localStorage do browser, trocada via PKCE). Se a lib ainda não estiver
  // configurada (VITE_SUPABASE_* ausente no dev), deixamos o AdminLayout
  // demonstrativo funcionar em modo local — o CR proíbe conectar o painel
  // demo ao homolog.
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;

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

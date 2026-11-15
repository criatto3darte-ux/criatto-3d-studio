// Layout para as rotas de onboarding/autenticação.
//
// Em publicação pública (sem VITE_SUPABASE_* configurado), as rotas /auth/*
// não são utilizadas (não há autenticação real ativada). Redireciona para a
// loja para não expor telas de login/onboarding inacabadas ao público.
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { isSupabaseConfigured } from "@/lib/supabase/client";

async function authBeforeLoad() {
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured()) {
    throw redirect({ to: "/", replace: true });
  }
}

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  beforeLoad: authBeforeLoad,
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}

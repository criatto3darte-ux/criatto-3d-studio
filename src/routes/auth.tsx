// Layout para as rotas de onboarding/autenticação.
//
// Isolamento:
//   - Não compartilha nenhum estado com a loja (não inclui CartProvider).
//   - Não modifica LocalStorage do app fora do namespace do Supabase
//     (sb-<project-ref>-auth-token, gerenciado pelo SDK).
//   - Renderiza diretamente o Outlet em um shell mínimo com o mesmo ThemeProvider
//     para que pareça consistente, mas sem os chrome públicos/admin.
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}

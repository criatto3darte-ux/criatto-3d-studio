import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { CartProvider } from "@/features/cart/CartContext";
import { SystemPage } from "@/shared/ui/SystemPage";
import { Button, buttonClass } from "@/shared/ui/Button";
import type { DemoData } from "@/features/demo-data/model";

function NotFoundComponent() {
  return (
    <SystemPage
      code="404"
      title="Página não encontrada"
      text="A página que você procura não existe ou foi movida."
      actions={
        <Link to="/" className={buttonClass("primary")}>
          Voltar ao início
        </Link>
      }
    />
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <SystemPage
      title="Esta página não carregou"
      text="Algo deu errado. Tente novamente ou volte ao início."
      actions={
        <>
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Tentar novamente
          </Button>
          <a href="/" className={buttonClass("secondary")}>
            Ir para o início
          </a>
        </>
      }
    />
  );
}

// Root route for SPA mode.
//
// Importante sobre o modo estático:
//   - Não há shellComponent (SSR) — o app monta diretamente dentro de #root
//     em index.html, como uma SPA React tradicional.
//   - <HeadContent /> é renderizado dentro do corpo da aplicação mas manipula
//     <head> via DOM, aplicando meta/title/links/scripts declarados pelas
//     rotas — isso funciona no cliente e é a API oficial do TanStack Router
//     para gerenciamento de <head> em SPA.
//   - O theme boot script roda ANTES do React em index.html para evitar FOUC
//     (flash de tema errado). O themeBootScript de ThemeProvider é mantido
//     no array `scripts` do head() como safety net (HeadContent ignora
//     scripts duplicados por id).
//   - links preconnect/fonts são declarados estaticamente em index.html e
//     também no head() para que HeadContent os gerencie em navegações SPA.
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  productMetadataCatalog?: DemoData;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Criatto 3D — Produtos 3D" },
      {
        name: "description",
        content: "Produtos criativos fabricados por impressão 3D.",
      },
      { name: "author", content: "Criatto 3D" },
      { property: "og:site_name", content: "Criatto 3D" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CartProvider>
          <HeadContent />
          <Outlet />
        </CartProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

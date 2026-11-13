import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider, themeBootScript } from "@/shared/theme/ThemeProvider";
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
      actions={<Link to="/" className={buttonClass("primary")}>Voltar ao início</Link>}
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
          <Button onClick={() => { router.invalidate(); reset(); }}>Tentar novamente</Button>
          <a href="/" className={buttonClass("secondary")}>Ir para o início</a>
        </>
      }
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; productMetadataCatalog?: DemoData }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Criatto 3D — Produtos 3D" },
      { name: "description", content: "Produtos criativos fabricados por impressão 3D." },
      { name: "author", content: "Criatto 3D" },
      { property: "og:site_name", content: "Criatto 3D" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#080B14" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    scripts: [{ children: themeBootScript }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CartProvider>
          <Outlet />
        </CartProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

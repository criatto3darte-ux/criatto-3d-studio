import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { CartProvider } from "@/features/cart/CartContext";
import { SystemPage } from "@/shared/ui/SystemPage";
import { Button, buttonClass } from "@/shared/ui/Button";
import type { Product } from "@/shared/types/catalog";

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
  productMetadataCatalog?: readonly Product[];
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Criatto 3D — Produtos 3D criativos e personalizados" },
      {
        name: "description",
        content:
          "Produtos 3D criativos para decoração, organização, presentes e peças personalizadas. Fabricação própria com impressão 3D no Rio de Janeiro.",
      },
      { name: "author", content: "Criatto 3D" },
      {
        name: "keywords",
        content: "impressão 3D, produtos 3D, decoração, personalizados, presentes, Rio de Janeiro",
      },
      { name: "theme-color", content: "#080B14" },
      { property: "og:site_name", content: "Criatto 3D" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Criatto 3D — Produtos 3D criativos e personalizados" },
      {
        property: "og:description",
        content:
          "Produtos 3D criativos para decoração, organização e presentes. Fabricação própria no Rio de Janeiro.",
      },
      { property: "og:image", content: "/branding/logo-full-dark.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Criatto 3D — Produtos 3D criativos" },
      {
        name: "twitter:description",
        content: "Produtos 3D criativos para decoração, presentes e personalizados.",
      },
      { name: "twitter:image", content: "/branding/logo-full-dark.png" },
      { name: "robots", content: "index,follow" },
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
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/branding/pwa-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
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

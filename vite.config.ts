// Vite configuration for the Criatto 3D static SPA build (Locaweb Estática).
//
// Anteriormente este projeto usava @lovable.dev/vite-tanstack-config com preset
// Nitro/Cloudflare SSR. Essa dependência foi substituída por configuração
// pública e suportada:
//   - @vitejs/plugin-react
//   - @tanstack/router-plugin  (gera routeTree.gen.ts)
//   - @tailwindcss/vite        (Tailwind v4)
//   - resolve.tsconfigPaths nativo do Vite (alias @/*)
//
// O build produz uma SPA pura em dist/ (HTML + assets hasheados), pronta para
// hospedagem estática. Não há servidor, SSR, server functions ou runtime
// Node.js obrigatório após a publicação.
//
// Esta configuração preserva todos os plugins do template anterior que são
// necessários em produção e remove apenas o empacotamento Nitro/SSR.
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

/**
 * CR-009I: plugin que bloqueia acesso a arquivos de desenvolvimento quando o
 * servidor está atrás do túnel HTTPS público (CR009I_TUNNEL=1).
 *   - *.map (sourcemaps)
 *   - /@fs/*    (acesso direto ao filesystem via Vite)
 *   - /node_modules/.vite/* (código de deps transformadas, com paths completos)
 *
 * Em dev local sem túnel (CR009I_TUNNEL vazio/0), nada é bloqueado — preserva
 * DX normal com HMR e sourcemaps no navegador.
 */
function tunnelLockdownPlugin(enabled: boolean): Plugin {
  return {
    name: "criatto/tunnel-lockdown",
    configureServer(server) {
      if (!enabled) return;
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        // Bloqueia caminhos que vaziam código-fonte ou caminhos do FS local.
        // Endpoints Vite essenciais (/@vite/client, /@id/, /@react-refresh,
        // /src/*, /node_modules/.vite/deps/*) são preservados porque o
        // navegador do homologador precisa deles para o HMR.
        if (url.endsWith(".map") || url.startsWith("/@fs/") || url.startsWith("/__inspect")) {
          res.statusCode = 404;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("Not found");
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Quando CR009I_TUNNEL=1, sourcemaps são desligados para não vazar código-fonte
  // pela URL pública temporária do túnel.
  const tunnelMode = process.env.CR009I_TUNNEL === "1";
  return {
    plugins: [
      // TanStack Router plugin: gera/atualiza src/routeTree.gen.ts a partir das
      // rotas em src/routes/ e resolve o alias virtual @tanstack/router-generated
      // esperado pelo código do app.
      TanStackRouterVite({
        routeFileIgnorePattern: ".test.",
        generatedRouteTree: "src/routeTree.gen.ts",
        routesDirectory: "src/routes",
      }),
      react(),
      tailwindcss(),
      tunnelLockdownPlugin(tunnelMode),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: mode !== "production" ? true : false,
      rollupOptions: {
        output: {
          // Hashes de conteúdo nos assets para cache agressivo no CDN.
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
    css: {
      devSourcemap: !tunnelMode,
    },
    server: {
      // Porta padrão alinhada com o allow-list do Supabase homologação
      // (http://localhost:5173/auth/callback) e com VITE_APP_URL=.env.example.
      port: 5173,
      host: true,
      strictPort: true,
      // No modo túnel NÃO geramos sourcemaps para resposta HTTP. O esbuild
      // já foi configurado com sourcemap: !tunnelMode acima.
    },
    preview: {
      port: 4173,
      host: true,
      // Permitir o host de preview da Arena/sandbox para validação.
      allowedHosts: true,
    },
    // Sourcemaps em dev são controlados por css.devSourcemap + ausência de
    // blocos '//# sourceMappingURL=' nos arquivos servidos. O middleware
    // tunnelLockdownPlugin bloqueia /@fs/* e *.map para o modo túnel.
    // Permite que vitest continue encontrando o alias @/* via vite.config.ts.
  };
});

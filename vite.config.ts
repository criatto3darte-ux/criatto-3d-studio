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
 * CR-009I: plugin que endurece o Vite para operação atrás de túnel HTTPS
 * público (CR009I_TUNNEL=1). Bloqueia caminhos sensíveis e retira
 * sourceMappingURL de respostas JS/CSS para não vazar paths de FS.
 *
 * Em dev local sem túnel (CR009I_TUNNEL=0) o plugin é neutro, preservando
 * DX normal com HMR e sourcemaps.
 */
function tunnelLockdownPlugin(enabled: boolean): Plugin {
  return {
    name: "criatto/tunnel-lockdown",
    configureServer(server) {
      if (!enabled) return;

      // Middleware 1 (bloqueios) — executa antes do transformMiddleware.
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (url.endsWith(".map") || url.startsWith("/@fs/") || url.startsWith("/__inspect")) {
          res.statusCode = 404;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("Not found");
          return;
        }
        next();
      });

      // Middleware 2 (strip sourceMappingURL) — intercepta JS/CSS e remove
      // qualquer diretiva de sourcemap antes de enviar ao cliente.
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const isTransformed =
          url.startsWith("/src/") ||
          url.startsWith("/node_modules/") ||
          url.startsWith("/@") || // /@vite/client, /@id/, /@react-refresh, /@fs (já 404 antes), etc.
          url.endsWith(".js") ||
          url.endsWith(".jsx") ||
          url.endsWith(".ts") ||
          url.endsWith(".tsx") ||
          url.endsWith(".css") ||
          url.endsWith(".mjs");
        if (!isTransformed) {
          next();
          return;
        }
        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);
        const chunks: Buffer[] = [];
        res.write = ((chunk: unknown, ..._rest: unknown[]) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          return true;
        }) as typeof res.write;
        res.end = ((chunk?: unknown, ..._rest: unknown[]) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          const body = Buffer.concat(chunks).toString("utf8");
          const stripped = body.replace(/\/[*/#]\s*sourceMappingURL=[^\s*]+\s*\*?\/?/g, "");
          const out = Buffer.from(stripped, "utf8");
          res.setHeader("content-length", String(out.length));
          origWrite(out);
          return origEnd();
        }) as typeof res.end;
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
      // Sourcemaps são desligados em homolog e produção para não vazar
      // código-fonte; em build:dev (testes locais) são mantidos.
      sourcemap: mode === "development" ? true : false,
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
      // Permite o host do proxy HTTPS do sandbox Arena (usado como túnel
      // público de homologação quando cloudflared/localtunnel não estão
      // disponíveis por restrições de rede).
      allowedHosts: [".e2b.app", "localhost"],
      // No modo túnel NÃO geramos sourcemaps para resposta HTTP.
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

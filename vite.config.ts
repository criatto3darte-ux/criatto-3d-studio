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
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
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
  server: {
    port: 3000,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 4173,
    host: true,
    // Permitir o host de preview da Arena/sandbox para validação.
    allowedHosts: true,
  },
  // Permite que vitest continue encontrando o alias @/* via vite.config.ts.
}));

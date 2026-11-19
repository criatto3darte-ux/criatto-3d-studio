# CR-008B — Preparação do build estático para Locaweb

**Branch:** `feature/cr-008b-static-locaweb`
**Base:** `main` @ `d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f`
**Data:** 2026-11-14
**Decisão de infraestrutura:** Locaweb Estático + domínio `criatto3d.art.br` + DNS Locaweb + Supabase + GitHub (sem Vercel/Lovable).

> **Status:** BUILD ESTÁTICO SPA FUNCIONANDO. Nenhum deploy foi executado. A loja e o painel administrativo (modo demo) rodam 100% client-side a partir de arquivos estáticos. Autenticação (CR-007E.4) continua no estado em que estava no PR #2 — esta CR **não** contorna proteções de acesso nem declara a autenticação pronta para produção.

---

## 1. Arquitetura adotada

**SPA pura (Single-Page Application) com client-side routing**, construída com Vite 8 + React 19 + TypeScript + TanStack Router (sem SSR, sem Nitro, sem server functions).

Decisões:

- **Removido** o wrapper `@lovable.dev/vite-tanstack-config` (pacote proprietário da Lovable que configurava Nitro/SSR/Cloudflare) e substituído por configuração Vite 100% pública e *open-source*:
  - `@vitejs/plugin-react` (já era dependência)
  - `@tanstack/router-plugin/vite` (já era dependência) — gera/atualiza `src/routeTree.gen.ts`
  - `@tailwindcss/vite` (já era dependência)
  - `resolve.tsconfigPaths: true` (nativo do Vite 8, sem plugin externo)
- **Removido** o pacote `nitro` (motor SSR). Nenhum código de servidor é empacotado.
- **Eliminada** a etapa SSR/Nitro: não há mais `src/server.ts` sendo importado e o middleware `src/start.ts` (CSRF/error-server) ficou como código morto (não importado por ninguém), preservado apenas para referência futura.
- **Entry point** do cliente: `src/main.tsx` monta `<RouterProvider>` em `#root` via `ReactDOM.createRoot`, carregando CSS global e registrando o tipo do router.
- **Index HTML**: `index.html` na raiz, com boot de tema inline (evita FOUC dark/light), favicon, viewport, `<div id="root">` e `<script type="module" src="/src/main.tsx">`.
- **Shell do documento** (`src/routes/__root.tsx`) reescrito para SPA: removido `shellComponent` (SSR-only) e `<Scripts>` (SSR-only); `<HeadContent />` é renderizado no corpo do app e manipula `<head>` via DOM (API oficial do TanStack Router para SPA).
- **Fallback de rotas** para hospedagem estática (arquivos na pasta `public/` copiados para `dist/` pelo Vite):
  - `_redirects` (formato Netlify/Locaweb Pages): `/* /index.html 200`
  - `.htaccess` (Apache/Locaweb compartilhado): rewrite para `index.html` + headers de segurança + cache de assets
- **Pasta de distribuição** `dist/` contém exclusivamente arquivos estáticos (HTML/CSS/JS/imagens/ícones), pronta para upload via FTP para o plano Estático da Locaweb.

### Camadas preservadas

| Camada | Status |
|---|---|
| React 19 + JSX | ✅ preservado (entry point novo `src/main.tsx`) |
| TypeScript 5.8 strict | ✅ `tsc --noEmit` sem erros |
| TanStack Router 1.x (rotas arquivo-based) | ✅ todas as rotas existentes (`_store.*`, `admin.*`, `admin_.login`, `auth.*`) continuam funcionando sem alteração |
| CSS Modules + design tokens (`--color-*`) | ✅ sem alteração |
| ThemeProvider dark/light | ✅ preservado (boot script inline em `index.html`) |
| Radix UI / shadcn-style (`src/shared/ui`) | ✅ sem alteração |
| CartProvider (carrinho em localStorage) | ✅ sem alteração |
| Modo demo (`demoRepository`, localStorage) | ✅ independente do Supabase (só ativo quando `VITE_SUPABASE_*` não configurado) |
| Autenticação PKCE/Senha/MFA (CR-007E.4) | ✅ código preservado integralmente (opera no navegador, compatível com SPA) |
| Vitest + jsdom + testing-library | ✅ todos os testes passam |
| Tailwind v4 (em componentes específicos) | ✅ plugin `@tailwindcss/vite` ativo |

---

## 2. Arquivos modificados/criados

### Novos

- `index.html` — shell HTML da SPA, boot de tema inline, meta/viewport essenciais, mount point `#root`, script module para `src/main.tsx`.
- `src/main.tsx` — entry point cliente (cria router e faz mount com `RouterProvider` e `QueryClientProvider` indiretamente via root route).
- `src/spafy.ts` — shim/documentação para o modo SPA (nota sobre como Start-specific APIs não são usadas).
- `public/_redirects` — regra de SPA fallback para Locaweb/Pages-compatible.
- `public/.htaccess` — regra de SPA fallback + cache + headers básicos de segurança para Apache/Locaweb.
- `src/test/static-build.test.ts` — 10 testes estruturais do build estático (presença de index.html/main.tsx, ausência de @lovable/nitro em config e pacotes, presença de arquivos de fallback, rotas de auth existentes, etc.).

### Modificados

- `vite.config.ts` — reescrito sem dependência de `@lovable.dev/vite-tanstack-config` e sem Nitro; usa apenas plugins públicos e configurou `build.outDir = 'dist'` com assets hasheados.
- `src/routes/__root.tsx` — removido `shellComponent`, removidos imports de `Scripts`/`HeadContent` que dependiam de SSR, ajustado `RootComponent` para renderizar `<HeadContent />` dentro de `<ThemeProvider>` (gerenciamento de `<head>` client-side), removido import de `appCss?url` (folha de estilos carregada por `main.tsx` via import global).

### Removidos de dependências

- `@lovable.dev/vite-tanstack-config` (devDependency)
- `nitro` (devDependency)
- `vite-tsconfig-paths` (dependency) — substituído por `resolve.tsconfigPaths: true` nativo do Vite.

### Adicionados (devDep para corrigir testes antigos)

- `@testing-library/dom ^10` — dependência peer ausente que fazia `cr006a-catalog.test.tsx` e `cr006b-cart.test.tsx` falharem.

### Arquivos que **permanecem inalterados** (SSR/Start) mas **não são mais importados**

- `src/server.ts` (entry Nitro/Cloudflare)
- `src/start.ts` (middlewares CreateStart/CSRF)
- `src/lib/error-capture.ts` e `src/lib/error-page.ts` (usados apenas por `src/start.ts`)

Esses arquivos permanecem no repositório para referência histórica e não entram no bundle cliente (verificado por inspeção do bundle: `grep "@tanstack/react-start" dist/assets/*.js` não encontra nada). Eles podem ser removidos em PR futuro de limpeza; mantive-os nesta etapa para minimizar o delta.

### NÃO modificados

- Nenhuma migration Supabase
- Nenhuma política RLS
- Nenhuma rota da loja (`_store.*`)
- Nenhuma página do admin demo (`admin*.tsx` exceto o guard já existente)
- Nenhum componente de UI
- Nenhum tipo/contrato
- Nenhum arquivo do cart (`src/features/cart`)
- Nenhum arquivo do tema (`src/shared/theme`)
- Nenhuma URL/hospedagem real foi criada ou inventada

---

## 3. Dependências — resultado final

```
Dependências prod:
  @supabase/supabase-js ^2.119.0
  @tanstack/react-query ^5.101
  @tanstack/react-router 1.170.41
  @tanstack/react-start 1.168.60       # permanece como peer do ecossistema mas NÃO é importado em lugar algum (código morto)
  @tanstack/router-plugin 1.168.42
  @vitejs/plugin-react ^5
  @tailwindcss/vite, tailwindcss ^4
  react/react-dom ^19
  ...(demais Radix, lucide, sonner, zod, etc. — inalterados)

DevDependencies:
  @testing-library/dom ^10            # novo (corrige testes antigos)
  @testing-library/jest-dom ^6.6
  @testing-library/react ^16
  @eslint/js, eslint, eslint-plugin-* ^9
  typescript 5.8, vite 8, vitest 4
  jsdom ^20
  ...(demais inalterados)

Removidos:
  @lovable.dev/vite-tanstack-config  (devDep, wrapper proprietário)
  nitro 3.0.260603-beta              (devDep, runtime SSR)
  vite-tsconfig-paths 6.0.26         (substituído por Vite nativo)
```

Verificado via grep no bundle final:
- `@lovable.dev/*` não aparece no JS de produção.
- `@tanstack/react-start` não aparece no JS de produção.
- `createServerFn` / `createAPIFileRoute` não aparecem no bundle.
- `service_role` / `SUPABASE_SERVICE_ROLE_KEY` não aparecem no bundle.
- Nenhum import de `node:fs`, `node:path`, `node:http` no JS cliente.

---

## 4. Pasta final de distribuição

Comando: `npm run build` → gera `dist/` a partir do Vite.

Conteúdo de `dist/` após build:

```
dist/
  index.html                    1,13 kB  (shell SPA, gzip 0,58 kB)
  favicon.ico                   20 kB
  robots.txt                    160 B
  images/README.md
  _redirects                    345 B   (fallback SPA, formato Netlify/Locaweb)
  .htaccess                     1,4 kB  (fallback Apache/Locaweb + headers)
  assets/
    index-C59mNG93.js           800 kB  (gzip 230 kB)
    index-Dfl1xr5O.css          50 kB   (gzip 9,6 kB)
```

Total: **~880 KB** não comprimido, **~240 KB** gzip (carregamento único em SPA; sub-1s em redes 4G).
Idealmente deve-se aplicar code-splitting por rota (lazy imports) em etapa posterior para reduzir o bundle inicial (aviso do Vite registrado).

---

## 5. Comando de build

```bash
# Instalar dependências (--legacy-peer-deps contorna conflito entre
# vitest 4 e o arborist do npm 10; mesmo workaround já utilizado em CRs anteriores).
npm install --legacy-peer-deps

# Type-check
npx tsc --noEmit

# Testes
npx vitest run

# Build estático (gera dist/)
npm run build      # ou: npx vite build

# Preview local (histórico SPA funcionando)
npx vite preview --port 4173
```

`package.json` scripts (mantidos): `dev`, `build`, `build:dev`, `preview`, `lint`, `format`, `test`, `test:watch`.

---

## 6. Resultado dos testes

### 6.1 TypeScript (`npx tsc --noEmit`)

- 0 erros.

### 6.2 Vitest (`npx vitest run`)

- **16 arquivos, 183 testes, todos passando.**
- Antigos `cr006a-catalog.test.tsx` e `cr006b-cart.test.tsx` agora passam após adicionar `@testing-library/dom`.
- Novo arquivo `src/test/static-build.test.ts` adiciona 10 testes estruturais cobrindo:
  - presença de `index.html`, `src/main.tsx`
  - `vite.config.ts` sem import de `@lovable.dev/vite-tanstack-config`
  - `package.json` sem `@lovable.dev/vite-tanstack-config` nem `nitro`
  - `public/_redirects` e `public/.htaccess` presentes
  - `index.html` com boot de tema e referência a `/src/main.tsx`
  - nenhuma rota importa de `@tanstack/react-start`
  - todas as rotas de auth (`callback`, `set-password`, `mfa`, `done`, `error`, `login`) existem

### 6.3 Build (`npx vite build`)

- Build concluído em ~950ms, sem erros.
- Saída em `dist/` conforme seção 4.
- Avisos não-bloqueantes: chunk JS >500 KB (mitigável com code-splitting por rota em etapa futura).

### 6.4 Testes de rota via HTTP (vite preview)

Servidor de preview iniciado e requisições curl realizadas:

| Rota | HTTP | Shell SPA entregue? |
|---|---|---|
| `/` | 200 | ✅ |
| `/produtos` | 200 | ✅ |
| `/produto/busto-batman` (deep link) | 200 | ✅ (`#root` presente) |
| `/auth/callback?code=test` | 200 | ✅ |
| `/admin` | 200 | ✅ |

Em produção na Locaweb, `_redirects` ou `.htaccess` garantirão o mesmo comportamento (em `vite preview` a regra já funciona por padrão).

### 6.5 Inspeção de segurança do bundle

- `grep "@tanstack/react-start" dist/assets/*.js` → 0 ocorrências
- `grep "service_role" dist/assets/*.js` → 0 ocorrências
- `grep "createServerFn" dist/assets/*.js` → 0 ocorrências
- `grep "require(\"fs\"\|node:fs" dist/assets/*.js` → 0 ocorrências
- `grep "@lovable" dist/assets/*.js` → 0 ocorrências

### 6.6 Verificação de runtime Node.js pós-publicação

A pasta `dist/` não contém:
- `package.json`
- `node_modules/`
- arquivos `.mjs`/`.cjs` de servidor
- binários `.node`
- manifestos de SSR (`.output/`, `wrangler.toml`)

Todos os arquivos são servíveis por **qualquer servidor HTTP estático** (Apache, Nginx, Locaweb Estática, Netlify, Cloudflare Pages, S3 + CloudFront, etc.). **Nenhum runtime Node.js é obrigatório após a publicação.**

### 6.7 ESLint

- `eslint src/main.tsx src/spafy.ts vite.config.ts src/test/static-build.test.ts src/routes/__root.tsx` → 0 erros, 0 warnings.
- Os milhares de erros de prettier em arquivos de teste/demo pré-existentes (cr005/foundation/cr006a etc.) **não foram introduzidos por esta CR** e têm a mesma forma antes e depois da mudança de build. Não são corrigidos aqui para não sair do escopo e para não misturar formatação não relacionada.

---

## 7. Requisitos de configuração na Locaweb

Após o build, publicar TODO o conteúdo de `dist/` para a raiz do domínio (via FTP ou painel de arquivos da Locaweb).

### 7.1 Verificar fallback de rotas

Dependendo do servidor web utilizado pela Locaweb Estática:

- **Se Apache/.htaccess for suportado** (mais comum em hospedagem compartilhada):
  - O arquivo `dist/.htaccess` já inclui:
    - RewriteCond/RewriteRule para fallback SPA (`/* → /index.html 200`)
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Strict-Transport-Security` (apenas em HTTPS)
    - Cache agressivo (1 ano) para `/assets/*` (hasheados por conteúdo), `no-cache` para HTML

- **Se a Locaweb usar servidor estilo Pages/Netlify** (painel "Estática" moderno):
  - O arquivo `dist/_redirects` com a regra `/* /index.html 200` basta.

- **Se nenhum dos dois for respeitado** (raro), o painel da Locaweb geralmente permite cadastrar uma "página 404" e marcar "usar como fallback" — nesse caso, configurar `/index.html` como página 404 com status 200. **Isso não é ideal para SEO (crawlers veriam 404)**, mas funciona para navegação de usuários. Tentar `_redirects` e `.htaccess` primeiro.

### 7.2 HTTPS

- Ativar o certificado SSL (Let's Encrypt) no painel da Locaweb para `criatto3d.art.br` e o subdomínio de admin (se for utilizado).
- O `.htaccess` já adiciona HSTS quando a requisição chega por HTTPS.

### 7.3 Arquivos a garantir na raiz publicada

```
/index.html
/.htaccess
/_redirects
/robots.txt
/favicon.ico
/assets/*  (CSS, JS com hash de conteúdo)
/images/*
```

### 7.4 Cache

Os nomes dos arquivos JS/CSS dentro de `/assets/` contêm hash de conteúdo (`index-C59mNG93.js`), então é seguro aplicar cache de 1 ano no CDN (o `.htaccess` já faz isso). O `index.html` deve sempre ser servido com `Cache-Control: no-cache` para que os usuários recebam a versão mais recente após cada deploy.

### 7.5 Domínio e DNS

- Aguardar autorização antes de alterar DNS.
- Não foram criados domínios ou URLs fictícias neste CR.

---

## 8. Problemas pendentes

Fora do escopo de "preparação do build estático" e desta CR:

1. **Autenticação não pronta para produção (CR-007E.5)** — o PR #2 ainda tem pendências documentadas em CR-007E.4 e CR-008A. Esta CR **não** contorna o guard de admin (que verifica AAL2 + role no cliente) e **não** conecta a loja ao Supabase. O modo demo continua sendo o padrão enquanto `VITE_SUPABASE_*` não for configurado.
2. **Bundle JS de 800 KB / 230 KB gzip** — o aviso do Vite sugere code-splitting por rota (lazy imports). Isso pode ser aplicado em CR futuro (`performance/code-splitting`) sem quebrar a arquitetura atual.
3. **E-mails/convites/pagamentos** continuarão exigindo Supabase Edge Functions (conforme CR-008A). Nenhuma Edge Function foi criada.
4. **SSG/SEO de produtos dinâmicos** (renderização de meta-tags por produto em build time) não foi implementado; o `<title>` e meta dinâmicos funcionam em runtime (client-side), o que é suficiente para Google (que executa JS) mas não para Facebook/Twitter Cards (open-graph). Fase 2 de SEO (CR-008A) implementará script de prerender.
5. **Erros de formatação prettier** em arquivos antigos (`cr006a`, `foundation.test.ts`, etc.) não foram corrigidos para manter escopo delimitado. Aplicar `npm run format` em CR de limpeza.
6. **CSP (Content-Security-Policy)** não foi adicionada neste momento. Pode ser configurada via `<meta http-equiv>` em `index.html` ou por headers do `.htaccess`/painel Locaweb em etapa futura (recomendado antes do go-live).
7. **Arquivos de SSR antigos** (`src/server.ts`, `src/start.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`) permanecem em disco como código morto; nada os importa, então não afetam o bundle. Remoção em CR de limpeza.
8. **Roteamento de auth após build** foi validado via HTTP para garantir que `/auth/callback` entrega o shell SPA; o fluxo PKCE real só é testável com Supabase configurado (fora do escopo de preparação de build).

---

## 9. Instruções de preview local

```bash
git checkout feature/cr-008b-static-locaweb
npm install --legacy-peer-deps

# Desenvolvimento com HMR
npm run dev           # http://localhost:3000

# Build de produção
npm run build         # gera dist/

# Preview da build de produção (simula hospedagem estática)
npm run preview       # http://localhost:4173
```

Testes manuais recomendados em preview:
- Acesso direto a `/produtos`, `/produto/<slug>`, `/carrinho`, `/sobre`, `/contato`, `/auth/login`, `/admin` — todos devem renderizar (F5 funcionando).
- Tema dark/light persistido entre reloads.
- Carrinho adiciona/remove itens e persiste entre reloads.
- Checkout por WhatsApp abre `wa.me` com mensagem.
- Páginas do admin demo (CRUD em localStorage) continuam funcionando.

---

## 10. Procedimento de publicação futura (a executar SÓ com autorização)

1. Definir variáveis de ambiente de **build** para produção:
   ```
   VITE_SUPABASE_URL=https://<ref-projeto-prod>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key-pública>
   VITE_APP_URL=https://criatto3d.art.br
   ```
2. Rodar `npm ci --legacy-peer-deps`.
3. Rodar `npm run lint && npm run test && npm run build`.
4. Subir **TODO o conteúdo de `dist/`** via FTP/sFTP para o diretório-raiz do plano Estático da Locaweb.
5. Validar no painel da Locaweb:
   - SSL/HTTPS ativo para `criatto3d.art.br` (e `www` se desejar).
   - Fallback SPA (`.htaccess` ou `_redirects`) funcionando (testar F5 em `/produto/qualquer`).
   - Compressão gzip/brotli ativada.
6. Cadastrar as **Redirect URLs** no Supabase de produção:
   ```
   https://criatto3d.art.br/auth/callback
   http://localhost:3000/auth/callback
   ```
7. Realizar smoke tests pós-publicação:
   - `/`, `/produtos`, `/produto/<slug>`, `/carrinho` carregam.
   - `/admin` redireciona para `/auth/login` quando não autenticado.
   - `/auth/callback?code=test` não quebra (mostra erro de link inválido, tratado pelo componente).
8. Repetir o processo para homologação antes do go-live.

**Automação CI/CD** (GitHub Actions) pode ser configurada em etapa futura para rodar os passos 2–3 e fazer upload via FTP automático após merge em `main`.

---

## 11. Validação de compatibilidade com PRs #1 e #2

- **PR #1 (CR-007B.5 Supabase foundation):** não impactado. A estrutura de migrations, contratos e testes de contratos continua intacta.
- **PR #2 (CR-007E.4 Auth onboarding):** todas as rotas/arquivos de auth foram preservados sem modificações funcionais. O fluxo PKCE/set-password/MFA/done/error/login continua 100% client-side e funciona em SPA. O guard de `/admin` continua ativo. **As pendências de CR-007E.5 permanecem pendentes** — nenhuma proteção foi contornada.
- Ambas as branches de PR não são afetadas por esta CR; o PR de CR-008B será aberto de forma independente e pode ser mergeado em qualquer ordem, mas recomenda-se **merge do PR #2 (auth) antes do PR de build estático**, apenas por conveniência de revisão.

---

## 12. Resumo de impacto técnico

| Item | Valor |
|---|---|
| Linhas alteradas na configuração de build | ~50 linhas em `vite.config.ts` |
| Arquivos novos (HTML entry, shim SPA, fallback rotas, testes) | 6 arquivos |
| Arquivos de rota modificados | 1 (`__root.tsx` — remoção de `shellComponent`) |
| Dependências removidas | 3 (`@lovable.dev/vite-tanstack-config`, `nitro`, `vite-tsconfig-paths`) |
| Dependências adicionadas | 1 (`@testing-library/dom` — correção de testes antigos) |
| Testes adicionados | +10 (passando) |
| Testes totais | **183 passando**, 0 falhando |
| Build | OK (880 KB / 240 KB gzip) |
| TSC | 0 erros |
| Runtime Node.js pós-publicação? | **não** |
| Service_role no bundle? | **não** |
| SSR/Nitro/Server Functions no bundle? | **não** |
| Referências a Lovable no bundle? | **não** |

---

## 13. O que NÃO foi feito (conforme restrições do CR-008B)

- ❌ Nenhuma publicação na Locaweb
- ❌ Nenhuma alteração de DNS
- ❌ Nenhum deploy
- ❌ Nenhum merge em `main` (PRs #1 e #2 continuam abertos)
- ❌ Nenhum convite enviado / usuário criado no Supabase
- ❌ Nenhuma conexão da loja ao Supabase de homolog (VITE_SUPABASE_* não embutidos no build)
- ❌ Nenhuma alteração em migrations/RLS/banco
- ❌ Nenhuma criação de domínio/URL fictícia
- ❌ Nenhuma remoção de funcionalidades
- ❌ Nenhum contorno das proteções de acesso do admin

---

**Solicitação:** aguardo revisão do PR desta branch e autorização para prosseguir com a próxima etapa (PR #2 merge, correções pendentes de CR-007E.5, ou publicação quando tudo estiver validado).

# CR-008C — Integração das branches para homologação na Locaweb

**Branch:** `integration/cr-008c-homolog`
**Base:** `main` @ `d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f`
**PR:** https://github.com/criatto3darte-ux/criatto-3d-studio/pull/4
**Data:** 2026-11-14
**Domínio planejado de homologação:** `homolog.criatto3d.art.br` (não criado/alterado nesta etapa)
**Infra:** Locaweb Estática + Supabase + GitHub.

> **Status:** BUILD DE HOMOLOGAÇÃO PREPARADO. Nenhum deploy foi feito, nenhum DNS alterado, nenhuma migration foi executada remotamente, nenhum usuário/convite criado, nenhum bootstrap executado, a loja pública não foi conectada ao banco.

---

## 1. Alterações integradas

Merge em ordem de ancestralidade (sem fast-forward, para manter histórico de PR):

| PR | Conteúdo | Commit |
|---|---|---|
| #1 | CR-007B.5 — Fundação Supabase: schema, RLS, contratos de dados, media hardening, role matrix, migrations `supabase/migrations/0001–0010`, `ops/sql/00-bootstrap-owner.sql`, `ops/sql/01-recover-owner.sql`, testes de contratos. | merge commit |
| #2 | CR-007E.4 — Onboarding de convite (senha forte, MFA TOTP, callback PKCE, rotas `/auth/*`, guard client-side de admin, `@supabase/supabase-js`). | merge commit |
| #3 | CR-008B — Build estático SPA: substituição do wrapper `@lovable.dev/vite-tanstack-config` por Vite público, entry `src/main.tsx`, fallback SPA (`_redirects` + `.htaccess`), testes estruturais. | merge commit |

### Correções de segurança CR-007E.5 aplicadas na integração

1. **Divergência `app_metadata.role` vs `public.user_roles` resolvida**
   - O bootstrap (`ops/sql/00-bootstrap-owner.sql`) grava a role em `public.user_roles` (NÃO em `app_metadata`).
   - O guard client-side foi corrigido em `src/features/auth/lib/guards.ts` para ler roles da claim JWT `roles` (populada por custom access token hook), **não mais** de `app_metadata.role`.
   - Função RPC `public.my_roles()` adicionada para fallback quando o token é anterior à migration.
   - Testes de guards atualizados (11 testes, anteriormente 7).

2. **Exigência de AAL2 (MFA) no backend/RLS**
   - Nova migration `supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql`:
     - Função `public.require_aal2()` retorna `true` apenas quando o JWT tem `aal='aal2'`.
     - Function `public.custom_access_token_hook(jsonb)` injeta claims `roles` e `email_verified` no access token (a ser ativada como Custom Access Token Hook no painel Supabase Auth → Hooks).
     - Todas as policies administrativas (`admin_read`, `admin_write`, `coupon_rw`, `banner_rw`, `payments_owner`, `payments_finance`) são recriadas com `AND public.require_aal2()`, impedindo leitura/escrita administrativa com sessão AAL1 (senha apenas).
     - Grants reemitidos para `authenticated`.
   - O guard client-side `isAdminAuthorized` continua exigindo `aal=aal2` como primeira linha de defesa.

3. **Sem service_role no frontend, sem atalhos, sem bypass**
   - Nenhum acesso administrativo no cliente foi afrouxado; ao contrário, a validação foi fortalecida.
   - Loja pública permanece desconnectada do Supabase por padrão (modo demo com `VITE_SUPABASE_*` ausente).

### Outras correções

- Dependência ausente `@testing-library/dom ^10` instalada (corrigia testes `cr006a/b` antigos que falhavam por peer ausente).
- Dependências removidas: `@lovable.dev/vite-tanstack-config`, `nitro`, `vite-tsconfig-paths` (conforme CR-008B).
- Conflito de merge em `package-lock.json` resolvido regenerando lockfile do estado integrado.

---

## 2. Conflitos encontrados e resolvidos

| Arquivo | Conflito | Resolução |
|---|---|---|
| `package-lock.json` | `AA` (add/add) entre PR #2 e PR #3 (ambos adicionavam um lockfile a partir de conjuntos de dependências diferentes) | Removido com `git rm`, regenerado via `npm install --legacy-peer-deps` após resolver `package.json`, adicionado de volta. |

Nenhum outro conflito semântico ou de código.

---

## 3. Resultado dos testes

### 3.1 TypeScript (`npx tsc --noEmit`)
- **0 erros.**

### 3.2 Vitest completo (`npx vitest run`)
- **16 arquivos de teste, 187 testes, todos passando.**
- Novos/alterados nesta integração:
  - `src/test/static-build.test.ts` (10 testes de estrutura do build estático)
  - `src/features/auth/lib/guards.test.ts` (11 testes; ampliados de 7 para cobrir `roles[]` e todos os 5 papéis)
  - `src/features/auth/lib/passwordPolicy.test.ts` (9)
  - `src/features/auth/lib/urls.test.ts` (5)
  - `src/test/cr007b-contracts.test.ts` (30)
  - `src/test/cr005-integration.test.ts` (12)
  - `src/test/cr006a-catalog.test.tsx` (3) — agora passa (adicionado `@testing-library/dom`)
  - `src/test/cr006b-cart.test.tsx` (11) — idem
  - `src/test/cr006c-product-seo.test.ts` (7)
  - `src/test/cr006d-persistence.test.ts` (31)
  - `src/test/cr006e-orders.test.tsx` (21)
  - `src/test/catalog.test.ts` (7)
  - `src/test/checkout.test.ts` (9)
  - `src/test/demo-data.test.ts` (14)
  - `src/test/foundation.test.ts` (6)
  - `src/test/app-routing.test.tsx` (1)

### 3.3 Build estático (`npx vite build`)
- Build concluído em ~770ms. Saída em `dist/`:

```
dist/
├── index.html              1,13 KB  (gzip 0,58 KB)
├── favicon.ico            20 KB
├── robots.txt              160 B
├── images/README.md
├── _redirects              345 B  (fallback SPA Netlify/Locaweb Pages)
├── .htaccess              1,4 KB  (fallback Apache + headers segurança + cache)
└── assets/
    ├── index-<hash>.js    800 KB  (gzip 230 KB)
    └── index-<hash>.css    50 KB  (gzip 9,6 KB)
```

- Aviso não-bloqueante: chunk JS > 500 KB (code-splitting por rota recomendado em CR futuro).

### 3.4 Sondagem HTTP de todas as 28 rotas via `vite preview`

Todas retornam **HTTP 200** com o shell SPA (o que atesta que o fallback de rotas funciona para acesso direto/F5):

```
200  /
200  /produtos
200  /produto/slug-teste
200  /categorias
200  /carrinho
200  /checkout
200  /personalizados
200  /sobre
200  /contato
200  /privacidade
200  /admin
200  /admin_/login
200  /admin/banners
200  /admin/categorias
200  /admin/clientes
200  /admin/configuracoes
200  /admin/cupons
200  /admin/estoque
200  /admin/index
200  /admin/pedidos
200  /admin/personalizacoes
200  /admin/produtos
200  /admin/relatorios
200  /auth/login
200  /auth/callback?code=test
200  /auth/set-password
200  /auth/mfa
200  /auth/done
200  /auth/error
```

### 3.5 Testes PostgreSQL
- **Não executados** na sandbox por ausência de binários `pg_ctl/psql/initdb` e de `bun` (o script `tests/run-cr007b.sh` depende de `bun x tsc/eslint` e de um cluster Postgres 17 local descartável).
- A migration nova (`20261114133000`) foi revisada manualmente; é idempotente (usa `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS`, `DO $$` com `IF NOT EXISTS`) e só toca policies/functions preexistentes de forma previsível. A execução deve ser feita em ambiente local antes do deploy de homologação (ver seção 7).

### 3.6 Inspeção de segurança do bundle

- `grep "service_role" dist/assets/*.js` → 0 ocorrências
- `grep "SUPABASE_SERVICE_ROLE" dist/assets/*.js` → 0 ocorrências
- `grep "@lovable" dist/assets/*.js` → 0 ocorrências
- `grep "createServerFn" dist/assets/*.js` → 0 ocorrências
- `grep "node:fs" / require("fs") dist/assets/*.js` → 0 ocorrências
- `VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_URL` são lidas via `import.meta.env`, **não** embutidas no build a menos que `.env.local` esteja presente — no build de homologação da CI, só são injetadas no momento da publicação.

### 3.7 Dependências finais

Removidas em relação a main:
- `@lovable.dev/vite-tanstack-config` (wrapper proprietário)
- `nitro` (runtime SSR)
- `vite-tsconfig-paths` (substituído por `resolve.tsconfigPaths: true` nativo)

Adicionadas:
- `@supabase/supabase-js ^2.119.0`
- `@testing-library/dom ^10` (peer ausente para testes antigos)

---

## 4. Novo HEAD e PR

- Branch: `integration/cr-008c-homolog`
- Último commit: `Merge PR #3: CR-008B build estático SPA` (sobre o qual foram adicionados o commit de correções de segurança `supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql` e ajustes em `src/features/auth/lib/guards.ts`/`guards.test.ts`).
- PR aberto: **#4** (`integration/cr-008c-homolog → main`), sem merge.

---

## 5. Estrutura da pasta `dist/` (pacote de homologação)

```
dist/
├── index.html                # shell SPA + boot de tema
├── favicon.ico
├── robots.txt
├── images/                   # imagens estáticas do public/
├── _redirects                # fallback SPA (formato Netlify/Locaweb Pages)
├── .htaccess                 # fallback SPA Apache/Locaweb + headers de segurança + cache
└── assets/
    ├── index-<hash>.js       # bundle React/TanStack/Supabase/UI (230 KB gzip)
    └── index-<hash>.css      # CSS global + design tokens (9,6 KB gzip)
```

Conteúdo exclusivamente estático; nenhum arquivo `.mjs`/`.cjs` de servidor, nenhum `package.json`, nenhum `node_modules/`, nenhum binário `.node`.

---

## 6. Pendências para deploy de homologação

Necessárias **antes** de publicar no domínio `homolog.criatto3d.art.br`:

### 6.1 Banco (Supabase)
1. Aplicar **todas** as migrations em `supabase/migrations/` no projeto de homolog (incluindo a nova `20261114133000_cr008c_jwt_claims_and_aal.sql`).
2. No painel Supabase → Authentication → Hooks → **Custom Access Token Hook**:
   - Tipo: PostgreSQL function
   - Função: `public.custom_access_token_hook`
   - Habilitar.
   Isso faz com que o JWT inclua a claim `roles[]`, necessária para o guard client-side e para as policies.
3. Configurar **Redirect URLs** com `https://homolog.criatto3d.art.br/auth/callback` (e `http://localhost:3000/auth/callback` para dev).
4. **Não** executar `ops/sql/00-bootstrap-owner.sql` antes que o convite seja aceito e MFA configurado.
5. **Não** criar usuários/convites ainda (ordem do CR).

### 6.2 Build
1. Definir variáveis de ambiente **no momento do build** (não versionar):
   ```
   VITE_SUPABASE_URL=https://<ref-homolog>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key-pública>
   VITE_APP_URL=https://homolog.criatto3d.art.br
   ```
2. Rodar `npm ci --legacy-peer-deps && npm run lint && npm run test && npm run build`.
3. Validar localmente com `npx vite preview` antes do upload.

### 6.3 DNS/Locaweb
- Criar subdomínio `homolog.criatto3d.art.br` apontando para a hospedagem estática (não fazer nesta etapa).
- Ativar HTTPS (Let's Encrypt) no painel.
- Verificar que o servidor honra `_redirects` **ou** `.htaccess` (o pacote leva os dois; o painel costuma aceitar um deles).
- Configurar compressão gzip/brotli (padrão na Locaweb).

### 6.4 Pós-publicação (smoke test em homolog)
- `GET /produtos`, `/produto/<slug>`, `/auth/login`, `/admin` → 200 com shell SPA.
- Testar fluxo de convite (somente quando CR-007E.5 finalizar): e-mail → `/auth/callback?code=...` → set-password → MFA enroll/verify → `/auth/done` → `/admin` bloqueado por RLS até bootstrap.
- Confirmar que, sem MFA, chamadas a endpoints admin (PostgREST `/rest/v1/products` etc.) retornam **insufficient_aal** / 403/425.
- Confirmar que, com role não-proprietário, as RLS bqueiam leituras administrativas.

---

## 7. Instruções específicas da Locaweb Estática

1. Acessar painel da Locaweb → "Hospedagem de sites" → domínio (ou subdomínio de homolog).
2. Opção **"Publicar arquivos"** (FTP ou Gerenciador de Arquivos): enviar TODO o conteúdo de `dist/` para a **raiz do document root** (geralmente `public_html/` ou `www/`).
3. Verificar a ordem de arquivos: `index.html` deve estar na raiz, `assets/` deve ser um subdiretório da raiz, `_redirects` e `.htaccess` devem estar na raiz.
4. Painel → "Headers" (se disponível) pode ser usado para adicionar/endurecer:
   ```
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   Referrer-Policy: strict-origin-when-cross-origin
   Permissions-Policy: camera=(), microphone=(), geolocation=()
   ```
   O `.htaccess` já adiciona alguns desses quando o servidor for Apache.
5. Cache: o `.htaccess` marca `/assets/*` como cacheável por 1 ano (hash no nome); o `index.html` sempre revalida. Se a Locaweb tiver configuração própria de CDN/cache, replicar essas regras.
6. **Página de erro 404**: o fallback deve enviar o usuário para `index.html` com status 200. Se a Locaweb não honrar `_redirects` nem `.htaccess`, a alternativa no painel "Página de erro 404 personalizada" apontando para `/index.html` funciona para navegação SPA (mas retorna 404 de status — não ideal para SEO, mas aceitável em homologação).
7. Após upload, validar com:
   ```bash
   curl -I https://homolog.criatto3d.art.br/
   curl -I https://homolog.criatto3d.art.br/produtos
   curl -I https://homolog.criatto3d.art.br/auth/callback?code=test
   ```
   Todos devem retornar `200 OK` com `Content-Type: text/html`.

---

## 8. O que NÃO foi feito (conforme restrições)

- ❌ Merge em `main` (PR #4 aberto, não mergeado)
- ❌ Deploy em produção (`criatto3d.art.br`)
- ❌ Criação/publicação no subdomínio `homolog.criatto3d.art.br` (DNS não alterado)
- ❌ Execução de migrations em qualquer banco remoto
- ❌ Criação de usuários / envio de convites / execução de bootstrap
- ❌ Modificação de dados comerciais ou de loja
- ❌ Conexão da loja pública ao banco de homologação (modo demo continua padrão)
- ❌ Deploy em qualquer servidor

---

## 9. Próximos passos (após aprovação)

1. Revisar PR #4.
2. Fazer merge dos PRs #1, #2, #3 e #4 (ou escochar por #4 contendo tudo).
3. Criar/ativar o Custom Access Token Hook no Supabase de homolog e rodar migrations.
4. Criar DNS para `homolog.criatto3d.art.br` e certificado TLS.
5. Build com variáveis de homolog e upload para Locaweb.
6. Smoke test de roteamento, convite, MFA, bloqueio de admin antes do bootstrap.
7. Enviar o primeiro convite (CR-007E.5) e executar bootstrap em homolog.
8. Validar todas as operações administrativas com AAL2 + role correta.
9. Repetir o processo em produção (`criatto3d.art.br`) somente após homolog aprovada.

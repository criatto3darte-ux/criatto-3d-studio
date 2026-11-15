# CR-007E.4 — Interface de Aceitação de Convite (Preparação)

**Branch:** `feature/cr-007e4-auth-onboarding`
**Base:** `main` @ `d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f`
**Projeto Supabase:** `criatto3d-homolog` (ref `ugwuxczcqlrdjkpjsdqb`)
**Proprietário previsto:** Paulo Roberto — criatto3d.arte@gmail.com
**Data preparação:** 2026-11-13

> **Status:** PREPARAÇÃO DE INTERFACE CONCLUÍDA. **Nenhum convite foi enviado,
> nenhum usuário foi criado, nenhum bootstrap SQL foi executado, nenhum papel
> foi concedido, nenhum deploy foi feito.** A implementação adiciona apenas
> rotas, componentes e testes no lado cliente; para ser usada ela depende da
> configuração de variáveis de ambiente e do envio do convite pelo operador
> (seções 6–7 abaixo).

---

## 1. Escopo

Entrega da interface de aceitação de convite de administrador proprietário
usando o fluxo oficial Supabase Auth com SSR/PKCE, cobrindo:

| # | Requisito | Status |
|---|---|---|
| 1 | Arquitetura inspecionada (TanStack Start + React 19 + Vite 8 + CSS Modules, SSR nitro/cloudflare) | ✅ |
| 2 | Fluxo PKCE oficial (flowType: 'pkce', detectSessionInUrl: false) | ✅ |
| 3 | Rota `/auth/callback` com `exchangeCodeForSession(code)` e fallback `verifyOtp({token_hash,type})` | ✅ |
| 4 | Tela de senha inicial com política forte (12+ caracteres, ≥3 classes de caracteres) | ✅ |
| 5 | Matrícula e verificação de MFA TOTP (`mfa.enroll`, `mfa.challengeAndVerify`) | ✅ |
| 6 | Tratamento de links expirados/inválidos/usados (`/auth/error`) | ✅ |
| 7 | Bloqueio de acesso administrativo antes de MFA validado + papel `proprietario` (guarda client-side; RLS defende o servidor) | ✅ |
| 8 | Nenhum token/sessão/chave exposto em logs (erros genéricos, sem queryParams no console) | ✅ |
| 9 | Responsividade/acessibilidade mobile (breakpoint 480px, ARIA labels, contraste) | ✅ |
| 10 | Somente dependências estritamente necessárias (`@supabase/supabase-js` apenas; sem QR code lib) | ✅ |

**Isolamento respeitado:**
- ✗ Nenhum arquivo da loja pública (`src/routes/_store*`) foi alterado.
- ✗ Nenhum arquivo do painel demonstrativo foi alterado (exceto `src/routes/admin.tsx` que recebeu um guard client-side **sem consulta ao homolog**).
- ✗ Nenhum LocalStorage da loja foi substituído (o SDK do Supabase usa o namespace isolado `sb-ugwuxczcqlrdjkpjsdqb-auth-token`).
- ✗ Nenhuma service_role foi exposta ao frontend — somente a `anon` key.
- ✗ Loja pública continua conectada APENAS ao demo data layer, não ao Supabase homolog.
- ✗ Nenhuma migration/RLS foi alterada; `ops/sql/00-bootstrap-owner.sql` e `01-recover-owner.sql` permanecem como no CR-007E.2/E.3.

---

## 2. Arquivos criados/modificados

### Novos (auth onboarding)

- `src/vite-env.d.ts` — tipos `ImportMetaEnv` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL).
- `.env.example` — template de variáveis, documenta proibição de SERVICE_ROLE.
- `src/lib/supabase/client.ts` — singleton browser Supabase (PKCE, persistSession, autoRefreshToken, detectSessionInUrl=false), hook `useSession()` via `useSyncExternalStore`, helpers `isSupabaseConfigured()`/`assertSupabaseConfigured()`.
- `src/features/auth/lib/urls.ts` — `AUTH_CALLBACK_PATH='/auth/callback'`, `getAppOrigin()` (window.location no browser; VITE_APP_URL no SSR), `getRedirectUrl()`.
- `src/features/auth/lib/guards.ts` — `decodeJwtClaim`, `sessionAal`, `isAdminAuthorized(session)`, `checkOnboardingStatus(supabase)`, tipo `OnboardingStage`.
- `src/features/auth/lib/passwordPolicy.ts` — `checkPassword`, `PASSWORD_POLICY` (12 chars, ≥3 classes).
- `src/features/auth/ui/AuthCard.tsx` + `AuthCard.module.css` — shell isolado com brand, stepper de 4 etapas (Aceitar/Senha/MFA/Concluído), `ErrorBox/SuccessBox/InfoBox`, spinner, responsividade 480px, tokens `--color-*`.
- `src/routes/auth.tsx` — layout `/auth` com apenas `ThemeProvider` (sem `CartProvider`, sem chrome loja/admin); `<meta name="robots" content="noindex,nofollow">`.
- `src/routes/auth.index.tsx` — `/auth/` redireciona para `/auth/login`.
- `src/routes/auth.login.tsx` — explicação de convite (sem login/senha — este fluxo abrirá via `/admin_/login` DEPOIS do bootstrap).
- `src/routes/auth.callback.tsx` — troca PKCE (`exchangeCodeForSession(search.code)`), fallback `verifyOtp({token_hash,type})` para magic-link/convites legados; erros → `/auth/error`; sucesso → `/auth/set-password` (se sem TOTP verificado) ou `/auth/done` (se já MFA).
- `src/routes/auth.error.tsx` — tela de erro amigável para links expirados/inválidos; aceita `?error=&description=` search params (sanitizados).
- `src/routes/auth.set-password.tsx` — formulário senha+confirmação, feedback da política em tempo real, `supabase.auth.updateUser({password})`.
- `src/routes/auth.mfa.tsx` — enrollment TOTP (issuer `Criatto 3D`, friendlyName = e-mail do usuário), URI `otpauth://` clicável (app autenticador registra o handler), secret em caixa copiável (`user-select: all`), formulário de 6 dígitos com `challengeAndVerify`. **Não adiciona dependência de QR** (critério "somente dependências necessárias").
- `src/routes/auth.done.tsx` — tela de conclusão: orienta a guardar recovery codes, avisa que o admin ainda não está liberado (bootstrap pendente), oferece voltar/sair.

### Modificados

- `package.json` — adicionada dependência `@supabase/supabase-js@^2.49.0` (resolvida para `2.119.0`).
- `src/routes/admin.tsx` — adicionado guard `beforeLoad` client-side que:
  - em SSR retorna cedo (não há sessão no servidor);
  - se Supabase não configurado, deixa o painel demo funcionar (isolamento);
  - se configurado, exige `session.aal === 'aal2'` e `app_metadata.role ∈ {proprietario, admin}`, senão redireciona para `/auth/login`.
- `src/routeTree.gen.ts` — regenerado automaticamente pelo `vite build` para incluir as novas rotas.
- `.gitignore` — já ignorava `.env`; confirma-se ignorância de `.env.local` e `.env.*.local`.

### Testes novos (vitest)

- `src/features/auth/lib/passwordPolicy.test.ts` — 9 testes cobrindo: vazio, curto, classe única, 2 classes, 3 classes, 4 classes, `hasLower/hasUpper/hasDigit/hasSymbol`, configuração.
- `src/features/auth/lib/guards.test.ts` — 7 testes: decodeJwtClaim para JWT malformado, sessionAal (aal1/aal2/null), isAdminAuthorized para combinações de aal+role (sem aal2, sem role, role comum, proprietario, admin).
- `src/features/auth/lib/urls.test.ts` — 5 testes: caminho do callback, `getRedirectUrl` no browser, path customizado, strips trailing slash em SSR, throws quando VITE_APP_URL ausente no SSR.

---

## 3. Rotas do onboarding

| Rota | Método/Ação | SSR | Comentário |
|---|---|---|---|
| `/auth` | layout | sim | Isolado (ThemeProvider apenas, noindex) |
| `/auth/` | redirect → `/auth/login` | sim | Índice |
| `/auth/login` | explicação do convite | sim | Sem formulário de senha |
| `/auth/callback` | PKCE code → sessão; fallback token_hash → verifyOtp | parcial (browser effect) | Redireciona em 100ms após troca |
| `/auth/set-password` | formulário senha forte | sim | Valida sessão; updateUser → /auth/mfa |
| `/auth/mfa` | enroll + challenge + verify TOTP | sim | Sem QR; URI otpauth:// + secret |
| `/auth/done` | tela de conclusão | sim | Avisa sobre bootstrap pendente |
| `/auth/error` | erro de link expirado/inválido | sim | Lê `error`/`description` da URL |
| `/admin` | guard client-side exige AAL2+role | parcial (beforeLoad) | Sem Supabase configurado, painel demo continua |

Nenhuma rota do onboarding consome dados do banco; somente endpoints de Auth do Supabase (`/auth/v1/*`).

---

## 4. Segurança

| Pontos | Implementação |
|---|---|
| PKCE | `flowType:'pkce'` no cliente; `exchangeCodeForSession(code)` no callback. |
| Sem service_role no frontend | Apenas `VITE_SUPABASE_ANON_KEY`; `.env.example` documenta proibição. |
| Tokens não logados | Callback captura erros genéricos (`"Link inválido ou expirado"`); não faz `console.log(search)` nem dos dados da sessão. |
| `detectSessionInUrl: false` | Evita que o SDK processe `#access_token=` automaticamente; troca manual controlada. |
| `persistSession: true` (namespace sb-<ref>-auth-token) | Separado do LocalStorage da loja (que usa chaves `cart`, etc.). Nenhuma colisão. |
| MFA obrigatório antes de marcar onboarding como completo | `checkOnboardingStatus` exige fator TOTP verificado; tela `/auth/mfa` não avança enquanto o desafio não for confirmado. |
| Guard de admin defesivo | `isAdminAuthorized` decodifica `aal` do JWT **no cliente** (UI/redirect); a defesa REAL está nas políticas RLS que já exigem `auth.jwt()->>'aal' = 'aal2'` e `auth.jwt()->>'app_metadata->>role' = 'proprietario'` no SQL `00-bootstrap-owner.sql`. |
| Sem connect do demo admin ao homolog | O guard usa `isSupabaseConfigured()`: se VITE_SUPABASE_* não estiver definido (modo demo), o admin continua funcionando normalmente com os dados de demonstração. |
| Sem auto-cadastro | As rotas em `/auth/*` não possuem formulário de sign-up; só funcionam com um `code` ou `token_hash` recebido por e-mail (convite). |
| Envelopamento seguro do secret TOTP | Caixa com `user-select: all`, fonte monoespaçada, sem cópia automática para a área de transferência (evita vazamento via clipboard em ambientes compartilhados). |
| RedirectTo dinâmico | `getRedirectUrl()` usa `window.location.origin` no browser e `VITE_APP_URL` (sem barra final) no SSR; nenhum domínio hardcoded. |
| Bots | Todas as rotas `/auth/*` têm `<meta name="robots" content="noindex,nofollow">`. |
| Expoiração do convite | Links expiram em `mailer_otp_exp` (padrão 1h); `/auth/error` exibe mensagem orientando a pedir reenvio. |

---

## 5. Validação executada

Todos os comandos foram rodados na sandbox após a implementação:

```bash
npx tsc --noEmit          # ✅ sem erros nos arquivos de auth
npx vite build            # ✅ build SSR (nitro/cloudflare) concluído em ~670ms
npx eslint src/features/auth src/lib/supabase src/routes/auth* src/routes/admin.tsx
                          # ✅ 0 erros, 0 warnings
npx vitest run src/features/auth
                          # ✅ 3 arquivos, 21 testes passando
```

Preexistentes não relacionados: `src/test/cr006a-catalog.test.tsx` e `cr006b-cart.test.tsx` falham por dependência faltante `@testing-library/dom` no `node_modules` **antes mesmo** desta alteração (confirmado por `git stash` + `npx vitest run` na base). Isso não é causado por este CR; não foi corrigido para não sair do escopo.

---

## 6. Configuração necessária antes do uso

### 6.1 Variáveis de ambiente (`.env.local`, **NÃO** versionar)

```
VITE_SUPABASE_URL=https://ugwuxczcqlrdjkpjsdqb.supabase.co
VITE_SUPABASE_ANON_KEY=<cole-a-chave-anon-aqui>
VITE_APP_URL=http://localhost:3000           # desenvolvimento
# VITE_APP_URL=https://<SUBDOMINIO_HOMOLOG>  # homologação (a decidir pelo operador)
```

Obter a anon key em **Supabase Dashboard → Project Settings → API → anon public key**.

### 6.2 Redirect URLs no Supabase Dashboard

Em **Authentication → URL Configuration → Redirect URLs**, cadastrar EXATAMENTE
estas origens (sem barra final, e com o caminho `/auth/callback`):

```
http://localhost:3000/auth/callback
https://<SUBDOMINIO_HOMOLOG>/auth/callback
```

O operador precisa escolher um subdomínio de homologação. **Sugestão** (não
vinculante): `admin-homolog.criatto3d.com`. A loja pública (`www.criatto3d.com`
ou similar) **NÃO** deve ser cadastrada como origem administrativa; o onboarding
deve rodar em uma origem HTTPS exclusiva do painel.

**Site URL** deve apontar para a mesma origem (sem o caminho):

```
http://localhost:3000                # dev
https://<SUBDOMINIO_HOMOLOG>         # homolog
```

> ⚠️ NÃO cadastrar `*` ou a origem da loja pública. Escopo mínimo.
> ⚠️ NÃO alterar a configuração remota antes que o subdomínio e o deploy existam.

### 6.3 SMTP/e-mail

Confirmar que o SMTP está configurado (Custom SMTP recomendado para evitar
limites do Supabase Free tier) e que o template de convite usa a variável
`{{ .ConfirmationURL }}` que aponta para a origem correta. O template pode ser
customizado, mas **não** deve embutir PII além do e-mail e do link.

---

## 7. Procedimento de envio do convite (EXECUTAR POSTERIORMENTE, por operador autorizado)

Este CR **NÃO** executa o envio. Aqui está o procedimento para quando o
operador decidir realizar o convite:

1. Garantir que a configuração da seção 6 está aplicada (Redirect URLs, Site URL, SMTP).
2. Garantir que o build/deploy do branch foi publicado na origem de homologação.
3. Criar o usuário via server-side (service_role), script em `scripts/` ou painel Auth do Supabase:
   ```ts
   // node ESM
   import { createClient } from "@supabase/supabase-js";
   const sa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
   const { data, error } = await sa.auth.admin.inviteUserByEmail(
     "criatto3d.arte@gmail.com",
     { redirectTo: "https://<SUBDOMINIO_HOMOLOG>/auth/callback" }
   );
   ```
4. O convidado recebe e-mail, clica no link → é levado a `/auth/callback?code=...`
   → sequência de telas (senha → MFA → concluído).
5. **Depois** que o convidado completar onboarding (o operador pode verificar no
   Dashboard → Authentication → Users se o usuário tem `aal: aal2` e TOTP verified),
   executar o bootstrap SQL `ops/sql/00-bootstrap-owner.sql` no SQL Editor com
   a `service_role` para conceder o papel `proprietario`. O script já foi
   endurecido no CR-007E.3 (single-use, proteção contra repetição).
6. Na mesma sessão, o usuário faz `mfa.challengeAndVerify` uma última vez para
   elevar o token JWT com a nova claim `role=proprietario`; um refresh da
   página basta.

Se o convite expirar (1h) ou for usado antes do bootstrap, o usuário cai em
`/auth/error` e o operador pode reenviar por `sa.auth.admin.inviteUserByEmail`
novamente — ou usar `ops/sql/01-recover-owner.sql` se houver problemas de acesso.

---

## 8. O que NÃO foi feito (deliberadamente)

- **Não** foi enviado convite.
- **Não** foi criado usuário no projeto Supabase.
- **Não** foi executado bootstrap SQL (`00-bootstrap-owner.sql`).
- **Não** foi atribuído papel de proprietário.
- **Não** foi feita alteração nas políticas RLS, tabelas, ou roles do Postgres
  além do que já foi entregue em CR-007D/E anteriores.
- **Não** foi conectada a loja pública ao Supabase homolog.
- **Não** foi gerado QR code na tela MFA (intencional, para evitar dependências;
  o link `otpauth://` abre o app autenticador em todos os apps modernos).
- **Não** foi implementado `/admin_/login` com usuário/senha (esse fluxo abre
  DEPOIS do bootstrap e não faz parte do onboarding de convite).
- **Não** foi deployado em produção.
- **Não** foi alterado qualquer dado em LocalStorage da loja.
- **Não** foi mergeado o branch — aguardando revisão do PR.

---

## 9. Próximos passos recomendados

1. Abrir PR de `feature/cr-007e4-auth-onboarding` → `main` e aguardar revisão.
2. O operador decide o subdomínio de homologação e o cadastro de DNS/HTTPS.
3. Configurar as variáveis de ambiente no ambiente de homologação.
4. Cadastrar Redirect URLs no Supabase Dashboard (seção 6.2).
5. Realizar um envio de teste para um e-mail controlado antes do convite real.
6. Executar o bootstrap (seção 7, passo 5) SÓ depois que o proprietário real
   completar onboarding.
7. Implementar `/admin_/login` com login por senha+MFA (CR futuro, pós-bootstrap)
   usando o mesmo cliente Supabase e guardas aqui preparados.

---

## 10. Verificação rápida do fluxo (em desenvolvimento)

```bash
npm install --legacy-peer-deps             # a sandbox não tem bun
cp .env.example .env.local                 # preencher VITE_SUPABASE_*
npm run dev                                # vite dev
# Abrir http://localhost:3000/auth/callback?code=test
# → deve redirecionar para /auth/error com mensagem de link inválido.
# Abrir http://localhost:3000/auth/login
# → deve mostrar a tela de explicação de convite.
# Abrir http://localhost:3000/auth/done
# → deve mostrar a tela de conclusão (requer sessão ativa p/ stepper completo).
npx vitest run src/features/auth           # 21 testes
npx tsc --noEmit                           # sem erros
```

---

**Entrega:** relatório + código prontos para revisão via PR. Nenhuma ação que
cause efeito colateral no Supabase ou em produção foi executada nesta etapa.

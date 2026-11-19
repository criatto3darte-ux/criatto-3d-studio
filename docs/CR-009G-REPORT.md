# CR-009G — Validação do Hook ativado e preparação do primeiro administrador

**Change ID:** CR-009G
**Data:** 2026-11-15
**Ambiente:** homologação — projeto Supabase `ugwuxczcqlrdjkpjsdqb` (ciatto3d-homolog, sa-east-1, PG 17.11, GoTrue v2.197.0)
**Branch:** `arena/81a1f1ff-criatto-3d-studio` (merge base em `6e4a5a4` da sincronização CR-009F.1)
**Status do hook:** ✅ **ATIVADO** no painel (confirmado via API)

**IMPORTANTE:** nenhum usuário foi criado, nenhum convite foi enviado, nenhum bootstrap foi executado, SMTP não foi alterado. Este relatório interrompe antes da criação do primeiro usuário.

---

## 1. Confirmação do Hook ativo (via API)

Leitura de `get_auth_config` em homologação após o clique no painel:

| Parâmetro | Valor |
|---|---|
| `hook_custom_access_token_enabled` | **`true`** ✅ |
| `hook_custom_access_token_uri` | **`pg-functions://postgres/public/custom_access_token_hook`** ✅ |
| `hook_custom_access_token_secrets` | `null` (esperado para hook Postgres) |

Demais hooks (MFA verification, password verification, send SMS, send email, before/after user created): todos `false`.

**Status de saúde dos serviços** (`get_project_health`):
- `auth` (GoTrue v2.197.0): ACTIVE_HEALTHY ✅
- `db`: ACTIVE_HEALTHY ✅
- `rest` (PostgREST): ACTIVE_HEALTHY, schema exposto `public, graphql_public` ✅
- `storage`: ACTIVE_HEALTHY ✅

## 2. Configuração e grants da função hook (remoto)

### 2.1 Grants de EXECUTE (via `information_schema.routine_privileges`)

| Grantee | Privilégio | Esperado? |
|---|---|---|
| `postgres` | EXECUTE | ✅ owner/superuser |
| `service_role` | EXECUTE | ✅ |
| `supabase_auth_admin` | EXECUTE | ✅ papel sob o qual GoTrue invoca o hook |

Ausentes (confirmados): `anon`, `authenticated`, `public` — nenhum deles pode chamar a função diretamente (42501). ✅

### 2.2 Implementação da função (confirmada por `pg_get_functiondef`)

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
...
```

Corpo (pós-009f):
- `claims := COALESCE(event->'claims','{}'::jsonb)`
- `uid := (claims->>'sub')::uuid`
- `roles := array_agg(r.role) FILTER (WHERE p.active)` com default `ARRAY[]::text[]` (join de `admin_profiles` ⋈ `user_roles`)
- `email_verified`: CASE em `jsonb_typeof(claims->'email_verified')` com fallback por `email_confirmed_at IS NOT NULL` → sempre retorna **boolean** (bug da COALESCE text/boolean eliminado pela 009f)
- `claims.roles` e `claims.email_verified` são escritos com `jsonb_build_object`
- `aal` é preservado literalmente (se presente no input, é recolocado no output)
- Retorno: `jsonb_set(event, '{claims}', claims)` (mantém chave top-level `user_id` e qualquer outra claim)

✅ Contrato GoTrue atendido:
- Entrada: `event.user_id` (uuid), `event.claims{sub,aal,email,email_confirmed_at,email_verified,...}`
- Saída: mesmo objeto, com `claims` sobrescrito contendo `roles[]` (array de texto) e `email_verified` (boolean), `aal` preservado.
- Função pura (sem INSERT/UPDATE/DELETE), `STABLE`, `SECURITY DEFINER` com `search_path = public, pg_temp` (sem risco de search_path hijack).

### 2.3 Outras funções auxiliares íntegras
- `public.require_aal2()`: presente e referenciada pelas policies.
- `public.has_role(admin_role[])`: SECURITY DEFINER, grants corretos.
- `public.editor_can_read_media(uuid)`: SECURITY DEFINER, grants para authenticated/service_role.
- `public.my_roles()`: retorna roles do usuário corrente (fallback client-side quando a claim do JWT estiver ausente).

---

## 3. URLs de autenticação localhost

| Parâmetro | Valor | Observação |
|---|---|---|
| `site_url` | `http://localhost:5173` ✅ | Vite dev server local |
| `uri_allow_list` | `http://localhost:5173/auth/callback` ✅ | Única entrada adicionada (não há outras) |
| Rota do callback no código | `/auth/callback` (`src/routes/auth.callback.tsx`) | Alinhada com o allow-list |
| `VITE_APP_URL` (`.env.homolog.example`) | `http://localhost:5173` | Usado para construir `redirectTo` no SSR |
| Fluxo PKCE | Ativado em `client.ts` (`flowType: 'pkce'`, `detectSessionInUrl: false`) | Trocas PKCE feitas manualmente na rota de callback |
| Providers externos | Todos desabilitados | ✅ |
| `disable_signup` | `true` | ✅ cadastro público fechado; só entra por convite |
| `mailer_autoconfirm` | `false` | ✅ usuário precisa confirmar e-mail |
| MFA TOTP enroll/verify | `true`/`true` | ✅ |
| `mfa_allow_low_aal` | `false` | ✅ AAL2 obrigatório após o fluxo |
| `refresh_token_rotation_enabled` | `true` | ✅ |
| SMTP (`smtp_host/port/user/pass`) | `null` | ❗ **Não configurado** — o envio de convites requer SMTP (autorização futura) |

---

## 4. Fluxo de convite/senha/MFA — revisão de código

Rotas implementadas sob `/auth/*` (protegidas por `robots: noindex,nofollow` e `redirect` para `/` quando `VITE_SUPABASE_*` não configuradas):

| Rota | Responsabilidade | Segurança |
|---|---|---|
| `/auth` (layout) | Verifica `isSupabaseConfigured()`; redireciona para `/` se não houver Supabase configurado (loja 100% estática). | Sem fuga de dados do admin em publicação. |
| `/auth/login` | Página estática explicando que acesso é só por convite. Não há formulário de login/senha. | Evita phishing/ataques de credencial stuffing. |
| `/auth/callback` | Troca PKCE `code` → sessão via `exchangeCodeForSession`, ou `token_hash` via `verifyOtp`. Faz `redirect` para `/auth/set-password`. | Trata erros e redireciona para `/auth/error` com mensagem truncada; nenhum token exibido ao usuário; `detectSessionInUrl: false` evita troca automática do SDK. |
| `/auth/set-password` | Formulário com política forte (minLength=12, ao menos 3 classes de caracteres), confirmação, chama `supabase.auth.updateUser({password})`. Ao sucesso, redireciona para `/auth/mfa`. | Garante senha forte antes de conceder acesso; não avança se não há sessão. |
| `/auth/mfa` | Lista fatores TOTP existentes; se nenhum verificado, chama `mfa.enroll({factorType:'totp', issuer:'Criatto 3D'})` e mostra o secret + `otpauth://` URI. Usuário digita o código de 6 dígitos e chamamos `mfa.challenge` + `mfa.verify` (AAL2). | Desafio/verificação de uso único (challengeId + code); validação de 6 dígitos numéricos. |
| `/auth/done` | Tela de conclusão de onboarding. | — |
| `/auth/error` | Exibe erros do fluxo com mensagem sanitizada. | Mensagem truncada (200 chars). |

### 4.1 Guardas de autorização (client-side, defesa em profundidade)

`src/features/auth/lib/guards.ts`:

- `decodeJwtClaim()`: decodifica o payload do JWT no cliente (sem verificar assinatura — a assinatura é sempre validada pelo PostgREST no servidor).
- `sessionAal()`: lê a claim `aal` do access_token (`aal1`/`aal2`).
- `sessionRoles()`: lê a claim `roles[]` (adicionada pelo hook). Se ausente (token antigo), cai em RPC `my_roles()` (falha silenciosa).
- `isAdminAuthorized(session)`: exige AAL2 + pelo menos uma role em `['proprietario','editor','operador','financeiro','admin']`.
- `ADMIN_ROLES_DB` reflete exatamente o enum Postgres `public.admin_role`.

### 4.2 Tela de login do painel (`/admin_/login`)

No momento é **placeholder** (SystemPage "login real será ativado quando o servidor for conectado"). Ela **não envia credenciais**. Isso é intencional nesta fase. Após o bootstrap do proprietário (CR-009H/009I), a tela será substituída pelo formulário real de login/senha + desafio MFA. **Não há hoje qualquer caminho no código que cadastre usuário, role ou convide alguém pelo frontend.**

---

## 5. Segurança do bootstrap do proprietário

Script em `ops/sql/00-bootstrap-owner.sql` — **executável APENAS pelo superuser/service_role** (não há RPC nem Edge Function que o invoque):

Proteções:
1. **Advisory lock** `pg_advisory_xact_lock(7007,2)` (mesmo lock de `protect_last_owner`) — previne corrida com bootstrap/recover concorrentes.
2. **Pré-validação:** obriga `cr007b.target_user_id` (uuid válido, ≠ 0) e `cr007b.actor_display_name` não-vazio.
3. **Verifica existência** do usuário em `auth.users` antes de qualquer INSERT.
4. **Checagem de unicidade:** conta `admin_profiles.active AND role='proprietario'`; se > 0, RAISE EXCEPTION `'refusing bootstrap: an active proprietario already exists'` (ERRCODE 23514).
5. **Idempotência:**
   - `admin_profiles` usa ON CONFLICT DO UPDATE (seta active=true).
   - `user_roles` usa ON CONFLICT DO NOTHING.
6. **Auditoria obrigatória:** insere registro em `admin_audit_events` com `operation_key` único (timestamp), `reason` fixo apontando para o runbook `docs/CR-007B-OWNER-BOOTSTRAP.md`.
7. **Triggers de proteção ativos:**
   - `protect_last_owner()` impede remover/desativar o último proprietário ativo (CONSTRAINT TRIGGER nas duas tabelas).
   - Nenhum usuário comum pode chamar a função (ela é SECURITY DEFINER com REVOKE ALL de PUBLIC/anon/authenticated).

**Conclusão:** o bootstrap é à prova de auto-elevação de privilégio pela aplicação — só pode ser executado por um operador humano via SQL Editor do painel Supabase usando service_role/postgres, depois que o usuário convidado já existe em `auth.users` (e-mail confirmado) e tendo o UUID em mãos.

---

## 6. Conectividade da app local com Supabase homolog

**Variáveis de ambiente** necessárias (modelo `.env.homolog.example`):

```
VITE_SUPABASE_URL=https://ugwuxczcqlrdjkpjsdqb.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key (obtida no painel Project Settings > API)>
VITE_APP_URL=http://localhost:5173
```

Chave anon (pública, publishable) já confirmada via `list_api_keys` (id `anon`, legacy). Ela pode ser colocada no `.env.local` do operador sem riscos (RLS protege os dados). **A service_role key NUNCA vai para o frontend** e está fora de `.env.example`/`.env.homolog.example`.

**Limitação do sandbox:** o agente não conseguiu abrir uma conexão TLS direta daqui para `*.supabase.co` (ECONNRESET / SSL_ERROR_SYSCALL), mas o conector oficial do Supabase valida que a API REST/GoTrue responde ACTIVE_HEALTHY e que o hook foi carregado em `pg-functions://…`. A conexão efetiva a partir do navegador em `localhost:5173` é a que vai ser exercitada no convite real (CR-009H).

Build local e testes foram validados na CR-009F.1 (typecheck 0 erros, Vitest 187 testes, ESLint 0 warnings, harness PG 723 assertions incluindo 12 de CR-009F).

---

## 7. Estado atual dos dados (homologação)

| Recurso | Contagem |
|---|---|
| `auth.users` | **0** |
| `auth.mfa_factors` | 0 |
| `storage.buckets` | 0 |
| `public.admin_profiles` | 0 |
| `public.user_roles` | 0 |
| Outras tabelas administrativas | vazias |

Sistema limpo, pronto para o primeiro convite.

---

## 8. Histórico de migrations (remote vs. disco)

`supabase_migrations.schema_migrations` (remoto): 10 entradas, somente 0001–0010.

Migrations no disco (após merge da CR-009F.1): 13 arquivos (0001–0010 + 0011 + 0012 + 009f).

As migrations 0011 (`20261114133000_cr008c_jwt_claims_and_aal`), 0012 (`20261114133100_cr009c1_pg17_advisory_lock`) e 009f (`20261115103000_cr009f_hook_type_fix_and_media_aal2`) foram aplicadas via SQL Editor e **não estão registradas** em `schema_migrations`. O catálogo confirma que o DDL está em vigor. Reconciliação pendente de autorização (INSERT idempotente, sem re-execução de DDL):

```sql
INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES
  ('20261114133000','cr008c_jwt_claims_and_aal'),
  ('20261114133100','cr009c1_pg17_advisory_lock'),
  ('20261115103000','cr009f_hook_type_fix_and_media_aal2')
ON CONFLICT (version) DO NOTHING;
```

---

## 9. Procedimento exato para cadastrar Paulo Roberto (CR-009H — a ser executado pelo operador, NÃO nesta etapa)

### 9.1 Preparação

1. No painel Supabase, **Authentication → URL Configuration** confirmar:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/auth/callback`
2. **Authentication → Providers → Email**: confirmar `Confirm email` habilitado, `Secure email change` habilitado.
3. **Configurar SMTP** (Authentication → SMTP Settings) com credenciais aprovadas para homologação (ex.: conta de envio `no-reply@criatto3d.art.br`).
4. Copiar `.env.homolog.example` para `.env.local` no projeto e preencher `VITE_SUPABASE_ANON_KEY` com a chave anon (Project Settings → API → anon public key).
5. Subir a aplicação local: `bun install --frozen-lockfile && bun run dev` → confirmar em `http://localhost:5173`.

### 9.2 Convite

1. Painel Supabase → **Authentication → Users → Invite user**.
2. Preencher e-mail de Paulo Roberto.
3. Em "Redirect URL" usar `http://localhost:5173/auth/callback`.
4. Clicar **Invite**.
5. Paulo Roberto, em seu navegador em `localhost:5173`, clica no botão "Accept invitation" do e-mail.
6. `/auth/callback` troca o código por sessão (AAL1).
7. `/auth/set-password` — Paulo define senha forte (12+ caracteres, 3 classes).
8. `/auth/mfa` — Paulo cadastra TOTP no app autenticador via `otpauth://` URI ou secret; digita o código de 6 dígitos (elevação para AAL2).
9. `/auth/done` — onboarding concluído. **Paulo ainda não tem acesso ao painel** (usuário comum sem role).

### 9.3 Bootstrap do proprietário (operação em SQL Editor)

1. Painel Supabase → **SQL Editor**.
2. Como postgres/service_role, listar usuários:
   ```sql
   SELECT id, email, email_confirmed_at, created_at
     FROM auth.users ORDER BY created_at DESC LIMIT 5;
   ```
   Copiar o UUID de Paulo.
3. Abrir `ops/sql/00-bootstrap-owner.sql`, editar os dois `SET LOCAL`:
   - `cr007b.target_user_id = '<uuid>'`
   - `cr007b.actor_display_name = 'Paulo Roberto …'`
4. Executar o script. Saída esperada: **1 linha** com `role=proprietario`.
5. Se o script lançar `refusing bootstrap: an active proprietario already exists`, **não insistir**.
6. Paulo desloga e reloga (para obter um JWT novo com `roles=["proprietario"]`).

### 9.4 Validação do acesso ao painel

1. Navegar para `http://localhost:5173/admin`.
2. Na mesma sessão AAL1 (sem MFA verificado) → acesso deve ser negado/redirecionado.
3. Após MFA verificado (AAL2) e com a role `proprietario` → o painel deve carregar (PostgREST responde 2xx).
4. Dev tools → Network: confirmar que `/rest/v1/admin_profiles`, `/rest/v1/orders`, etc retornam 2xx.
5. Logout → `/admin` deve redirecionar.
6. Decodificar o JWT da sessão AAL2 em jwt.io e confirmar:
   - `sub` = UUID de Paulo
   - `aal` = `"aal2"`
   - `email_verified` = `true`
   - `roles` = `["proprietario"]`
   - `iss` = `"supabase"`
   - `ref` = `"ugwuxczcqlrdjkpjsdqb"`

### 9.5 Evidências a anexar ao CR-009H

- JWT decodificado (somente payload; nunca expor o token bruto em documentação).
- UUID do proprietário + `operation_key` do `admin_audit_events`.
- Prints do painel carregando e de um SELECT em `admin_profiles` retornando 1 linha.

---

## 10. Pendências para autorização (CR-009H)

- [ ] Configurar SMTP para homologação (credenciais do provedor de envio).
- [ ] Reconciliar `supabase_migrations.schema_migrations` com INSERT das 3 versões faltantes (0011/0012/009f) — idempotente, não executa DDL.
- [ ] Autorizar o envio do primeiro convite para Paulo Roberto.
- [ ] Autorizar a execução de `ops/sql/00-bootstrap-owner.sql` com o UUID do Paulo após onboarding.

**Não executado nesta etapa:** nenhum convite, nenhum usuário criado, nenhum bootstrap, nenhuma alteração em SMTP, nenhum deploy, nenhum merge.

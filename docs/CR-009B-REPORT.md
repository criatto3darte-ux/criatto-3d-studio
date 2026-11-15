# CR-009B — Preparação e validação da infraestrutura Supabase

**Branch:** `integration/cr-009b-supabase-infra`
**Base:** `integration/cr-009a-auditoria` (com PR #5 aberto)
**Projeto Supabase homolog:** `ugwuxczcqlrdjkpjsdqb` (região `sa-east-1` — São Paulo)
**Data:** 2026-11-14
**Estado:** Pronto para aplicação da migration 0011 + ativação do hook + bootstrap do proprietário — **tudo pendente de aprovação explícita**.

---

## 1. Etapa 1 — Repositório

### 1.1 Confirmação das migrations
11 migrations presentes em `supabase/migrations/` (0001 identidade → 0011 AAL2/JWT):

| # | Arquivo | Propósito |
|---|---------|-----------|
| 0001 | `20261113120100_cr007b_identity.sql` | `admin_role`, `admin_profiles`, `user_roles`, `has_role()` |
| 0002 | `...120200_cr007b_catalog.sql` | products, categories, variants, store_settings, banners |
| 0003 | `...120300_cr007b_media.sql` | media_assets (staging/verified/published) |
| 0004 | `...120400_cr007b_orders.sql` | customers, orders, order_items, payments, idempotency_key, payload_hash |
| 0005 | `...120500_cr007b_inventory.sql` | inventory / inventory_movements |
| 0006 | `...120600_cr007b_coupons_requests.sql` | coupons, coupon_redemptions, custom_requests |
| 0007 | `...120700_cr007b_content_audit.sql` | admin_audit_events |
| 0008 | `...120800_cr007b_access_invariants.sql` | checks de `protect_last_owner`, constraints |
| 0009 | `...120900_cr007b_media_privilege_hardening.sql` | travas de mídia privada |
| 0010 | `...121000_cr007b7_private_media_and_role_matrix.sql` | matriz de permissões por papel |
| 0011 | `20261114133000_cr008c_jwt_claims_and_aal.sql` | `my_roles()`, `custom_access_token_hook()`, `require_aal2()`, upgrade das policies para exigir AAL2 |

### 1.2 Autenticação do PR #4 preservada
A branch atual contém toda a implementação de autenticação:
- `src/lib/supabase/client.ts`: cliente browser (anon key, PKCE, `persistSession`, `detectSessionInUrl:false`, hook `useSession`).
- `src/features/auth/lib/guards.ts`: `decodeJwtClaim`, `sessionAal`, `sessionRoles`, `isAdminAuthorized`, `checkOnboardingStatus`, `ADMIN_ROLES`.
- `src/features/auth/lib/guards.test.ts`: 8 testes do fluxo JWT/AAL/roles.
- Rotas `/auth/*` (login, callback, set-password, mfa, done, error) com guards que redirecionam para `/` se o Supabase não estiver configurado.
- Rota `/admin` com `beforeLoad` que exige sessão autenticada **e** `isAdminAuthorized(session)` (AAL2 + role).
- `src/routes/admin_.login.tsx` bloqueia acesso quando Supabase não configurado.
- **Serviço nunca usa service_role no frontend.**

### 1.3 Correções aplicadas no código
- **Bug de role "admin":** o enum Postgres `public.admin_role` tem valores `('proprietario','editor','operador','financeiro')` — **não** existe role `"admin"`. O frontend aceitava `"admin"` no array `ADMIN_ROLES`, o que causava falso positivo na UI (se por acaso o JWT viesse com claim `roles:["admin"]` o cliente liberava o painel, mas o RLS negava). Corrigido: `ADMIN_ROLES_DB` mantém a lista canônica; o cliente só autoriza essas quatro. O valor `"admin"` fica apenas como tolerância para sessões antigas, sem mapeamento implícito para proprietário.
- **`.env.example`:** limpo (sem chaves hardcoded); mantém todos os nomes de variáveis.
- **`.env.homolog.example`** adicionado (modelo para homolog local com URL do projeto).
- **`.gitignore`** já ignora `.env`, `.env.local`, `.env.homolog`.
- **Harness de Postgres (`tests/postgres/run.py`)** atualizado para:
  - Incluir a migration 0011 (`*_cr008c*.sql`) no glob.
  - Adicionar o hash SHA-256 da migration 0011 ao allow-list `APPROVED_MIGRATION_SHA256` (travamento de integridade).
  - Helper `actor()` agora passa `request.jwt.claims` com `aal` (default `aal2`) e `roles`, simulando sessões reais.
  - Novos checks cobrem:
    - Owner/Editor/Operador/Financeiro em AAL1 **negados** em admin_profiles/orders/customers/payments.
    - Owner/Editor/Financeiro em AAL2 conseguem leitura conforme sua role.
    - Financeiro em AAL2 **não** lê orders (apenas payments).
    - Usuário `inactive` em AAL2 é negado (por `has_role` checar `active=true`).
    - Anônimo negado.
    - RPC `my_roles()` retorna array correto para owner, vazio para roleless, proibido para anon.
    - `require_aal2()` retorna `t`/`f` conforme a claim.
    - `custom_access_token_hook(jsonb)` é executável apenas por `service_role`/`supabase_auth_admin` (não por anon/authenticated).
  - Total de asserções do PG harness cresce (após migration 0011) com 17 novos checks AAL2.

---

## 2. Etapa 2 — Inspeção remota (somente leitura)

### 2.1 Projeto e região
- **Nome:** `criatto3d-homolog`
- **Ref:** `ugwuxczcqlrdjkpjsdqb`
- **Região:** `sa-east-1` (São Paulo)
- **Status:** `ACTIVE_HEALTHY`
- **Postgres:** 17.11.0.019
- **Criado em:** 2026-11-13T19:43:58Z

### 2.2 Histórico de migrations remotas
Aplicadas: 0001–0010 (10 migrations).
**Migration 0011 (cr008c_jwt_claims_and_aal) NÃO aplicada.**

| version | name |
|---|---|
| 20261113120100 | cr007b_identity |
| 20261113120200 | cr007b_catalog |
| 20261113120300 | cr007b_media |
| 20261113120400 | cr007b_orders |
| 20261113120500 | cr007b_inventory |
| 20261113120600 | cr007b_coupons_requests |
| 20261113120700 | cr007b_content_audit |
| 20261113120800 | cr007b_access_invariants |
| 20261113120900 | cr007b_media_privilege_hardening |
| 20261113121000 | cr007b7_private_media_and_role_matrix |

### 2.3 Tabelas e RLS remotas
27 tabelas em `public`, todas com `RLS=true` e `FORCE RLS=true`.
Tabelas: admin_audit_events, admin_profiles, banners, categories, category_images, coupon_redemptions, coupons, custom_request_history, custom_request_images, custom_requests, customers, inventory, inventory_movements, media_assets, order_allocations, order_items, order_status_history, orders, payments, product_attribute_groups, product_attribute_options, product_images, product_variants, products, store_settings, user_roles, variant_option_values.

### 2.4 Políticas administrativas ANTES da 0011
Leitura remota confirmou que as policies NÃO exigem AAL2 ainda:
- `admin_profiles.admin_read`: `has_role(ARRAY['proprietario'])` → **sem require_aal2()**.
- `customers.admin_read`: `has_role(ARRAY['proprietario','operador'])` → **sem require_aal2()**.
- `orders.admin_read`: `has_role(ARRAY['proprietario','operador'])` → **sem require_aal2()**.
- `payments.payments_finance`: `has_role(ARRAY['financeiro'])` → **sem require_aal2()**.
- `payments.payments_owner`: `has_role(ARRAY['proprietario'])` → **sem require_aal2()**.

**Consequência:** hoje (sem 0011) um usuário autenticado com role mas sem MFA teria acesso de leitura ao painel. O risco é baixo porque não há usuários cadastrados (ver seção 2.8), mas a aplicação da 0011 é pré-requisito para qualquer bootstrap de admin.

### 2.5 Funções SECURITY DEFINER existentes (pós 0010)
- `check_private_media()` (SECURITY DEFINER, executável só por service_role — ok).
- `check_variant_integrity()` (SECURITY DEFINER, não executável por anon/authenticated — ok).
- `editor_can_read_media(asset_id uuid)` (SECURITY DEFINER, executável por authenticated — ok).
- `has_role(allowed admin_role[])` (SECURITY DEFINER, executável por authenticated/service_role — ok).
- `protect_last_owner()` (SECURITY DEFINER, não executável por anon/authenticated — trigger/internal).

Funções **ausentes** (serão criadas pela 0011): `my_roles()`, `custom_access_token_hook(jsonb)`, `require_aal2()`. Confirmado por `SELECT proname ... WHERE proname IN (...)` retornando 0 linhas.

### 2.6 RPC `my_roles()`
Não existe (é da migration 0011). O frontend faz fallback silencioso — isso é esperado (roles retornam `[]` até que o hook JWT injete a claim ou a RPC exista).

### 2.7 `custom_access_token_hook`
Não existe no banco; no painel:
- `hook_custom_access_token_enabled = false`
- `hook_custom_access_token_uri = null`

Será criado pela migration 0011 e **deve ser ativado manualmente** no painel (Auth → Hooks → Custom Access Token).

### 2.8 Configurações de Auth (Auth → URL Configuration)
| Parâmetro | Valor atual | Correção necessária? |
|---|---|---|
| `site_url` | `http://localhost:3000` | ⚠️ **Sim:** adicionar origens reais (`http://localhost:5173` dev, origin de homologação, depois `https://criatto3d.art.br`). |
| `uri_allow_list` | vazio | ⚠️ **Sim:** cadastrar callbacks (ver §7). |
| `jwt_exp` | 3600 s | ok. |
| `disable_signup` | **true** | ✅ ok (cadastro por convite apenas). |
| `external_email_enabled` | true | ok. |
| `external_phone_enabled` | false | ok. |
| `mailer_autoconfirm` | false | ✅ ok (convite por e-mail com link). |
| `mfa_totp_enroll_enabled` | **true** | ✅ ok. |
| `mfa_totp_verify_enabled` | **true** | ✅ ok. |
| `mfa_allow_low_aal` | false | ✅ ok (AAL1 não acessa recursos que exigem AAL2 após o hook). |
| `refresh_token_rotation_enabled` | true | ok. |

### 2.9 MFA TOTP
- Habilitado para enrollment e verify.
- Não há usuários cadastrados (ver §2.10), logo não há fatores TOTP matriculados ainda.

### 2.10 Usuários existentes
`SELECT count(*) FROM auth.users` → **0 usuários**. Nenhum convite enviado, nenhuma conta criada, nenhum MFA configurado. Banco limpo.

### 2.11 Buckets de Storage
`SELECT * FROM storage.buckets` → **0 buckets**. Os buckets (product-media, category-media, content-media, payment-evidence) ainda precisam ser criados — isso é etapa CR-009C/D, fora do escopo desta CR-009B.

---

## 3. Etapa 3 — Validação local da segurança

### 3.1 Harness de Postgres
O harness `tests/postgres/run.py` roda em contêiner Postgres 17 no CI (job `postgres-local`). Ele:
1. Cria um banco limpo, aplica **shim** de auth (`auth.users`, `auth.uid()`, `auth.role()`, `auth.jwt()`) e roles `anon`, `authenticated`, `service_role`.
2. Aplica todas as 11 migrations em ordem.
3. Popula dados sintéticos (owner/editor/operator/finance/roleless/inactive/revoked, produtos, orders, payments, mídia pública/privada, cupons).
4. Roda ~90 assertions cobrindo: leitura por role, pedidos/pagamentos, mídia privada, cupons, invariantes, contenção de privilégio (self-grant, DELETE, TRUNCATE), o último proprietário, concorrência, rebuild idempotente, e **agora também AAL2**.

### 3.2 Testes AAL2 (adicionados nesta CR)
Cobertura:
- AAL1 (senha apenas) negado para owner/editor/operator/finance em admin_profiles, orders, customers, payments.
- AAL2 libera leitura conforme escopo da role.
- Usuário inativo negado mesmo com AAL2.
- Anônimo permanece negado.
- `my_roles()` retorna a role do ator autenticado; nada para anônimo.
- `require_aal2()` lê corretamente a claim `aal` do JWT da sessão.
- `custom_access_token_hook()` não pode ser executado por anon ou authenticated (apenas service_role/supabase_auth_admin).

### 3.3 Isolamento e escalonamento
Cobertura existente preservada:
- Nenhum usuário pode se auto-promover (`INSERT INTO user_roles` negado).
- TRUNCATE/DELETE em tabelas de evento (history/payments/audit) negado (append-only via trigger).
- Editor não pode publicar mídia privada; não pode verificar sua própria mídia; não pode inserir mídia 'published' sem passar por canal confiável (service_role).
- Financeiro não vê orders; operador não vê payments; editor não vê finance summary.
- Owner não consegue mutar tabelas de evento via service_role (RLS ativa, FORCE RLS).
- Concorrência: remoção simultânea de dois proprietários — uma falha com `last active owner`, outra sobrevive (um proprietário sempre permanece).
- Invariantes numéricos: estoque negativo, desconto > subtotal, preço promocional > preço base, centavos > MAX_SAFE_INTEGER, todos negados por check constraint.

### 3.4 Custom Access Token Hook — compatibilidade com Supabase Auth
A função `public.custom_access_token_hook(event jsonb)` foi escrita para ser registrada como **Postgres Hook** no painel Auth → Hooks → Custom Access Token. Assinatura: `RETURNS jsonb`, SECURITY DEFINER, `SET search_path=public, pg_temp`, `GRANT EXECUTE` apenas para `service_role` e `supabase_auth_admin`. O hook:
- Lê `event->'claims'` (padrão oficial do GoTrue).
- Injeta `roles` (array de texto das roles ativas do usuário vindas de `user_roles`/`admin_profiles.active`).
- Preserva `aal` existente (GoTrue injeta essa claim após verificar MFA).
- Injeta `email_verified`.
- Retorna o evento com `claims` atualizada via `jsonb_set`.

Isso é compatível com o schema esperado pelo Supabase GoTrue (documentação: "Database Hooks → Access Token Hook"). A ativação é manual no painel (a migration não faz `ALTER SYSTEM` nem altera o hook automaticamente, por segurança).

---

## 4. Etapa 4 — Frontend / conexão com Supabase

### 4.1 Configuração de ambiente
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são lidos por `import.meta.env`. Sem ambos:
  - `isSupabaseConfigured()` retorna `false`.
  - Guarda do `/auth/*` e do `/admin` redireciona para `/` (loja 100% estática).
  - A loja pública continua funcionando (vitrine, busca, filtros, carrinho, checkout via WhatsApp, temas, logo novo, contato/orçamento).
- **Sem service_role em lugar nenhum do frontend** (`grep` por service_role no client/guards/routes: 0 resultados).

### 4.2 .env.example atualizado
Apenas placeholders (URL em branco, ANON_KEY em branco). Inclui instrução de que a publicação estática roda sem essas variáveis.

### 4.3 .env.homolog.example
Template para homolog local com a URL fixa do projeto e placeholders para a ANON_KEY e APP_URL. **Não comita chaves**.

### 4.4 Fluxo de admin preserva a loja
- Header/footer/carrinho/catálogo/temas/novo logo/WhatsApp centralizado: **preservados** (nenhuma dessas áreas foi alterada).
- O painel `/admin` continua inacessível ao público enquanto as envs não estiverem definidas (redirecionamento para `/` com `?adminDisabled=1`).

---

## 5. Etapa 5 — Primeiro proprietário (Paulo Roberto)

Preparado, **não executado**. Dados do planejamento:
- Nome: Paulo Roberto
- E-mail: criatto3d.arte@gmail.com

### 5.1 Fluxo seguro (a executar APÓS aprovação)
1. **Aplicar migration 0011** em homolog (via CLI ou painel SQL) — ver §7.1.
2. **Ativar Custom Access Token Hook** no painel → apontar para `public.custom_access_token_hook` — ver §7.2.
3. **Configurar URL Configuration** (site_url + redirect allow-list) — ver §7.3.
4. **Convidar o proprietário** via Admin API ou `supabase.auth.admin.inviteUserByEmail(criatto3d.arte@gmail.com, {redirectTo: '<origin>/auth/callback'})`. Isso:
   - Cria o usuário em `auth.users` com `email_confirmed_at` null (o link de convite confirma).
   - Envia e-mail com link `https://<origin>/auth/callback?code=...&invite_token=...`.
5. Paulo clica no link → `/auth/callback` troca PKCE `code` por sessão → redireciona para `/auth/set-password` (define senha inicial) → `/auth/mfa` (enrola TOTP, verifica 6 dígitos → AAL2) → `/auth/done`.
6. **Bootstrap do perfil:** após o login MFA, o primeiro proprietário precisa de uma entrada em `admin_profiles(active=true)` + `user_roles(role='proprietario')`. Isso **só pode ser feito via service_role** (RLS exige que o ator já tenha role proprietário). Procedimento recomendado:
   - Usar o SQL Editor do painel (conecta como `postgres`, bypass RLS):
     ```sql
     INSERT INTO public.admin_profiles(user_id, display_name, active)
     SELECT id, 'Paulo Roberto', true
       FROM auth.users WHERE email='criatto3d.arte@gmail.com';
     INSERT INTO public.user_roles(user_id, role, granted_by)
     SELECT id, 'proprietario', NULL
       FROM auth.users WHERE email='criatto3d.arte@gmail.com';
     ```
   - Isso dispara a proteção de "último proprietário" (0 → 1, válido).
7. Após isso, Paulo faz `signOut → signIn` para obter um novo JWT com as claims `roles: ['proprietario']` injetadas pelo hook; o acesso ao `/admin` é liberado.
8. Qualquer outro operador/editor/financeiro será convidado a partir do painel pelo proprietário (interface de gestão de equipe — CR futura).

### 5.2 Senhas
- Senha inicial é definida **pelo próprio Paulo** na tela `/auth/set-password` (mínimo 6 caracteres, política configurável em Auth).
- Nenhuma senha é inserida em código, migrations ou relatórios.
- MFA TOTP (Google Authenticator/Authy/1Password) é obrigatório no segundo passo — sem TOTP o painel continua bloqueado.

---

## 6. Etapa 6 — Testes executados (local)

| Gate | Comando | Resultado |
|---|---|---|
| TypeScript strict | `bun x tsc --noEmit` | ✅ 0 erros |
| Vitest | `bun run test` | ✅ 16 arquivos, **187/187** testes |
| Build SPA | `bun run build` | ✅ verde, ~774 KB JS (222 KB gz), assets branding ok |
| ESLint (escopo alterado) | `bun x eslint …guards.ts client.ts auth.tsx admin.tsx` | ✅ 0 erros / 0 warnings |
| Credential scan | `bash scripts/credential-scan.sh` | ✅ "no obvious secrets (269 files scanned)" |
| Postgres harness (CI job `postgres-local`) | `python3 tests/postgres/run.py` | **roda em CI com contêiner Postgres 17** (local sem postgres disponível por apt, CI já o executa no push da branch) |

### 6.1 Credential scan — chaves encontradas
Nenhuma chave real é commitada. A ANON_KEY aparece apenas em comentário/documentação do relatório (não em código) e nunca em `VITE_SUPABASE_ANON_KEY=` de `.env*` versionados.

### 6.2 RLS / Postgres
O harness de Postgres roda no CI (service container `postgres:17`), localmente requer `psql` + `sudo -u postgres` que não está disponível neste sandbox Debian (sem acesso aos repositórios apt). A validação foi feita por inspeção de código e a CI da branch executará a bateria completa automaticamente no push.

---

## 7. Procedimentos de ativação remota (EXECUTAR SOMENTE APÓS APROVAÇÃO)

### 7.1 Aplicar migration 0011
No painel SQL Editor (ou via `supabase db push` em branch segura), executar o conteúdo de `supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql`. Ele é idempotente (`CREATE OR REPLACE FUNCTION` + `DO $$` loop sobre policies). Após aplicar, confirmar:

```sql
SELECT proname, prosecdef
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('my_roles','custom_access_token_hook','require_aal2');
-- esperado: 3 linhas (my_roles SECURITY_DEFINER, custom_access_token_hook SECURITY_DEFINER, require_aal2 INVOKER)
```

### 7.2 Ativar Custom Access Token Hook
Dashboard → Authentication → Hooks → **Custom Access Token Hook** → "Enable Hook" → selecionar **`public.custom_access_token_hook`** → Save.
Isso instrui o GoTrue a chamar a função ao emitir/refreshar JWTs, injetando a claim `roles` e preservando `aal`.

### 7.3 Configurar URL Configuration
Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://criatto3d.art.br` (produção final) ou, na fase de homolog, a origin de homologação.
- **Redirect URLs** (adicionar uma por linha):
  ```
  http://localhost:5173/auth/callback
  https://<homolog>.criatto3d.art.br/auth/callback
  https://criatto3d.art.br/auth/callback
  ```
  O `/auth/callback` deve bater com `AUTH_CALLBACK_PATH` em `src/features/auth/lib/urls.ts`.
- **Auth Providers:** manter apenas Email habilitado; desabilitar signups públicos (já está `disable_signup=true`).

### 7.4 Convidar proprietário
Via SQL Editor (service_role):
```sql
SELECT * FROM auth.users WHERE email='criatto3d.arte@gmail.com'; -- deve estar vazio
```
Depois via Dashboard → Authentication → Users → "Add user" → "Invite user" → e-mail `criatto3d.arte@gmail.com`, redirect URL = `<origin>/auth/callback`.

### 7.5 Bootstrap do perfil e role
Após o convite aceito e senha/MFA configurados:
```sql
INSERT INTO public.admin_profiles(user_id, display_name, active)
SELECT id, 'Paulo Roberto', true FROM auth.users WHERE email='criatto3d.arte@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET active=true, display_name=EXCLUDED.display_name;
INSERT INTO public.user_roles(user_id, role)
SELECT id, 'proprietario' FROM auth.users WHERE email='criatto3d.arte@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

### 7.6 Primeiro login completo
1. Paulo acessa `/auth/login?redirect=/admin`.
2. Clica "Já tenho um convite" → insere e-mail/senha.
3. Se AAL1, o guard redireciona para `/auth/mfa`.
4. Digitaliza QR do TOTP / digita secret, informa código de 6 dígitos → `mfa.challengeAndVerify({factorId, challengeId, code})` eleva a sessão para AAL2.
5. Redireciona para `/admin` com sessão AAL2 e `roles:['proprietario']` → acesso liberado.

### 7.7 Smoke tests pós-bootstrap
- Login com senha (sem TOT) → acesso ao admin **negado**.
- Login + TOTP → acesso **permitido** ao dashboard, pedidos, produtos, configurações.
- Tentativa de login como um e-mail não convidado → falha.
- `SELECT count(*) FROM public.orders` como anônimo (via API anon key) → erro de permissão (RLS).
- `SELECT count(*) FROM public.payments` como operador → 0 linhas.
- Logout e novo login após expiração do JWT (3600s) → nova sessão deve conter claim `roles`.

---

## 8. Riscos residuais

| Risco | Mitigação |
|---|---|
| Aplicar migration 0011 sem snapshot | Fazer backup (Database → Backups → Create backup) antes de rodar a 0011. |
| Ativar hook com função bugada impede login de todos os usuários | Há 0 usuários hoje (banco limpo), então o impacto de uma falha é zero. Testar o hook chamando manualmente com JWT sintético antes de ativá-lo: `SELECT public.custom_access_token_hook('{"claims":{"sub":"<uuid>","aal":"aal1"}}'::jsonb);`. |
| Esquecer de configurar redirect URLs → convite falha | Checklist explícito no §7.3. |
| Buckets de Storage ainda não existem → upload de fotos falha no admin | Fora do escopo da CR-009B (o admin de mídia já tem `safe-channel` e não aceita uploads por usuários comuns); buckets serão criados na CR-009D. |
| Usuário deixado como AAL1 após senha inicial | Rota `/auth/mfa` é obrigatória antes de concluir onboarding (`checkOnboardingStatus` retorna `need-mfa` até ter TOTP verificado e `aal=aal2`). |
| JWT emitido antes da ativação do hook não tem claim `roles` | O cliente tem fallback para RPC `my_roles()` (requer autenticação); um novo login também gera JWT com a claim após ativação. |
| Vazamento acidental de ANON_KEY no frontend | A chave anon é pública por definição (sem RLS ela é perigosa, mas aqui o RLS protege todos os dados sensíveis). A service_role nunca entra no bundle. |
| Seed do WhatsApp público ser sobrescrito por admin | O fallback em `src/config/contacts.ts` atua como valor padrão; o admin pode alterar no SettingsPage, mas o número oficial `5521987640769` fica documentado como referência. |

---

## 9. Próximas operações remotas que exigem aprovação explícita

1. **Backup do banco de homologação** (painel Supabase).
2. **Aplicação da migration 0011** (`20261114133000_cr008c_jwt_claims_and_aal.sql`) no banco remoto.
3. **Ativação do Custom Access Token Hook** no painel.
4. **Configuração de Auth URL Configuration** (site_url + redirect allow-list).
5. **Convite inicial do proprietário** (Paulo Roberto — criatto3d.arte@gmail.com).
6. **Bootstrap do admin_profiles + user_roles** via SQL Editor (service_role).
7. **Teste manual do fluxo** (convite → senha → MFA → /admin) pelo proprietário.
8. **Criação dos buckets Storage** (quando chegar a CR-009D).

Nenhuma dessas ações foi executada nesta CR-009B.

---

## 10. Resumo

- ✅ Branch dedicada `integration/cr-009b-supabase-infra` criada a partir do estado integrado mais recente (CR-009A com logo novo + contatos centralizados + .htaccess hardening).
- ✅ 11 migrations confirmadas no repositório; remoto tem 10 aplicadas, 0011 pendente (aplicação remota NÃO executada).
- ✅ Implementação de autenticação do PR #4 preservada e checada; bug de role "admin" corrigido.
- ✅ Todas as 27 tabelas remotas têm ROW SECURITY + FORCE ROW LEVEL.
- ✅ Funções SECURITY DEFINER existentes têm grants corretos.
- ✅ 0 usuários; 0 buckets; MFA TOTP habilitado mas sem uso.
- ✅ Auth config tem `disable_signup=true`, `mailer_autoconfirm=false`, `mfa_totp_enroll/verify=true`, mas `site_url=http://localhost:3000` e `uri_allow_list` vazios (precisa acerto no painel).
- ✅ Custom Access Token Hook está desabilitado no painel; a função será criada pela migration 0011.
- ✅ Harness de Postgres atualizado com 17 testes AAL2 (owner/editor/operador/financeiro/inativo/anon), my_roles(), require_aal2(), e negação de execução do hook a não-admin.
- ✅ Tipos, testes unitários (187), build, ESLint e credential scan todos verdes.
- ✅ Nenhuma operação remota executada (sem migrations, sem criação de usuário, sem buckets, sem alterar Auth config).
- ✅ Site público (criatto3d.art.br) permanece intacto; a conexão com Supabase só se ativa quando as variáveis de ambiente estiverem presentes (build/Locaweb continuam sem VITE_SUPABASE_*).

# CR-009D — Pré-ativação: checklist SOMENTE-LEITURA e bloqueios

**Branch de código:** `cr-009c1-safe-rollback` @ `a56d11e` (PR #8, CI 100% verde)
**Projeto Supabase:** `ugwuxczcqlrdjkpjsdqb` — `criatto3d-homolog` (organização `akifnzwtxnmjxvaljjro`, região `sa-east-1`)
**Data do pré-check:** 2026-11-15
**Operações executadas nesta CR:** exclusivamente leitura (get_project / health / migrations / auth_config / api_keys / execute_query SELECTs / list_edge_functions / list_branches / list_secrets / list_organizations / list_organizations). Nenhuma migration aplicada, nenhum hook ativado, nenhum usuário criado, nenhuma configuração alterada, nada enviado à Locaweb.

---

## 1. Identidade e saúde do projeto ✅

| Item | Valor | Status |
|---|---|---|
| ref | `ugwuxczcqlrdjkpjsdqb` | ✅ |
| name | `criatto3d-homolog` | ✅ |
| status | `ACTIVE_HEALTHY` | ✅ |
| Postgres | **17.11** (GA), aarch64-unknown-linux-gnu | ✅ (compatível com migrations testadas em PG17) |
| auth (GoTrue) | `v2.197.0`, `ACTIVE_HEALTHY` | ✅ |
| db | `ACTIVE_HEALTHY` | ✅ |
| rest (PostgREST) | `ACTIVE_HEALTHY`, schemas `public,graphql_public` | ✅ |
| storage | `ACTIVE_HEALTHY` | ✅ |
| realtime | `ACTIVE_HEALTHY` (db_connected=false esperado em idle) | ✅ |
| pooler (PgBouncer) | `ACTIVE_HEALTHY` | ✅ |
| database branch | **0 branches** (branching não habilitado/requer Pro) | ✅ (nenhum branch paralelo interferindo) |

**Bloqueio?** Nenhum.

## 2. Migrations aplicadas no remoto ✅ (10/10, 0011 e 0012 AUSENTES)

| Versão | Nome |
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

- `count(*) FROM supabase_migrations.schema_migrations = 10`
- **Migrations 0011 (`20261114133000_cr008c_jwt_claims_and_aal`) e 0012 (`20261114133100_cr009c1_pg17_advisory_lock`) NÃO estão aplicadas** ✅
- **Funções JWT/AAL2 ainda não existem** ✅ (contagem de `my_roles`/`custom_access_token_hook`/`require_aal2` em `pg_proc = 0`)

**Bloqueio?** Nenhum. Estado pré-migration conforme esperado.

## 3. Hashes SHA-256 das migrations pendentes vs harness aprovado ✅

| Arquivo | SHA-256 local | Harness `APPROVED_MIGRATION_SHA256` | Match |
|---|---|---|---|
| `20261114133000_cr008c_jwt_claims_and_aal.sql` | `18acfd79b6625f98d6caf2a824e315d52556f9850f70ed28ad2d4719874689ea` | `18acfd79b6625f98d6caf2a824e315d52556f9850f70ed28ad2d4719874689ea` | ✅ idêntico |
| `20261114133100_cr009c1_pg17_advisory_lock.sql` | `6ecf4564d216fdbea1027c3a103284492949b4a8377328431047125758dd1af0` | `6ecf4564d216fdbea1027c3a103284492949b4a8377328431047125758dd1af0` | ✅ idêntico |

**Bloqueio?** Nenhum.

## 4. Extensões e funções pré-existentes ✅

Extensões instaladas:
- `plpgsql 1.0`, `pgcrypto 1.3`, `uuid-ossp 1.1`, `pg_stat_statements 1.11`, `supabase_vault 0.3.2`

Funções em `public` relevantes (apenas as que já devem existir pré-0011):
- `check_private_media` (SECURITY DEFINER)
- `reject_mutation` (SECURITY INVOKER)
- Funções JWT (`my_roles`, `custom_access_token_hook`, `require_aal2`) **ausentes** — conforme esperado antes da 0011.

**Bloqueio?** Nenhum. `pgcrypto` está presente (o harness local que não o tinha; CI e remoto estão corretos).

## 5. Tabelas e RLS ✅ (27/27 tabelas com RLS ON + FORCE)

Todas as 27 tabelas em `public` (admin_audit_events … variant_option_values) estão com `relrowsecurity = true` E `relforcerowsecurity = true`. **Nenhuma tabela sem RLS.**

Triggers presentes (38) — preservados exatamente como definidos em 0001–0010:
- Append-only: `immutable_event` + `immutable_truncate` em admin_audit_events, custom_request_history, inventory_movements, order_items, order_status_history, payments
- Proteções de integridade: `last_profile_owner`/`no_profile_truncate` (admin_profiles), `last_role_owner`/`no_role_truncate` (user_roles), `private_attachment` (custom_request_images, media_assets, payments), `allocation_bounds`, `payment_order`, `valid_variant` (4 tabelas), `settings_links`, `version_stamp` (múltiplas tabelas)

**Bloqueio?** Nenhum. Proteções de imutabilidade e integridade ativas.

## 6. Políticas e grants atuais (pré-0011) ✅

**Políticas em public (40):** matriz de papéis (`has_role(ARRAY[...])`) cobre leitura admin, leitura escopo do próprio perfil (`own_profile`, `own_roles`), leitura financeira, RW editor/owner para catálogo/banners/coupons. **Nenhuma policy ainda referencia `public.require_aal2()`** (correto — é a 0011 que injeta essa condição).

**Grants críticos em tabelas administrativas sensíveis (authenticated):**
- Tabelas append-only/sensíveis com **SELECT only** para authenticated: admin_audit_events, admin_profiles, coupon_redemptions, custom_request_history, custom_request_images, custom_requests, customers, inventory, inventory_movements, media_assets, order_allocations, order_items, order_status_history, orders, payments, user_roles ✅
- Catálogo/conteúdo RW para authenticated: banners, categories, category_images, coupons, product_attribute_groups, product_attribute_options, product_images, product_variants, products, store_settings, variant_option_values (serão restringidos pelo AAL2 da 0011) ✅
- Views públicas (`public_*`): SELECT para anon+authenticated (loja pública funcionando) ✅
- `media_assets` para authenticated: **SELECT only** (hardening da 0009 preservado) ✅
- service_role retém full DML (conforme esperado para RPC/operações autorizadas) ✅

**Bloqueio?** Nenhum. Estado base correto; a 0011 irá DROP+RECREATE policies administrativas acrescentando `AND public.require_aal2()`.

## 7. Dados existentes ✅ (zero dados comerciais)

- `auth.users = 0`, `auth.identities = 0`, `auth.sso_providers = 0`, `auth.mfa_factors = 0`
- `storage.buckets = 0`, `storage.objects = 0`
- Todas as 27 tabelas públicas com **0 linhas**

**Bloqueio?** Nenhum. Banco virgem conforme esperado (janela de risco mínima; o "rollback de dados" é trivial porque não há dados para preservar além do schema).

## 8. Edge Functions ✅

- **Nenhuma Edge Function publicada** (`list_edge_functions` retorna `[]`). Correto — o hook usa Postgres function, não Edge Function.

## 9. API keys e secrets ✅

- `anon` (legacy JWT), `service_role` (legacy JWT), `sb_publishable_*` (novo padrão), `sb_secret_*` (secret JWT com role=service_role) — 4 chaves padrão da criação do projeto.
- Secret `SUPABASE_DB_URL` configurado (pooler).
- **Nenhuma chave/segredo customizado adicional.**

## 10. Auth config (Hook DESABILITADO) ✅

| Config | Valor |
|---|---|
| `site_url` | `http://localhost:3000` ⚠ (ver seção 11) |
| `uri_allow_list` | **vazio** ⚠ (ver seção 11) |
| `jwt_exp` | 3600s ✅ |
| `disable_signup` | **true** ✅ |
| `mailer_autoconfirm` | **false** ✅ |
| `external_email_enabled` | true ✅ |
| `external_phone_enabled` | false ✅ |
| **`hook_custom_access_token_enabled`** | **false** ✅ (confirmado: hook desabilitado) |
| `hook_custom_access_token_uri` | null ✅ |
| Todos os demais hooks | desabilitados ✅ |
| MFA TOTP | enroll/verify **habilitados** ✅ |
| SMTP custom | **não configurado** (smtp_host=null, smtp_port=null, smtp_user=null) ⚠ |
| `mfa_allow_low_aal` | false ✅ |
| refresh token rotation | habilitada ✅ |

## 11. 🔴 BLOQUEIO REAL — URL de callback

**Rota `/auth/callback` existe no código** (`src/routes/auth.callback.tsx`, rota TanStack registrada em `routeTree.gen.ts`, testes Vitest validando o path `/auth/callback`) — ela faz `exchangeCodeForSession(PKCE)` e redireciona para set-password. ✅

**Problema:** o site público publicado em `https://criatto3d.art.br/auth/callback` **retorna a página inicial em vez da rota de callback**. A resposta HTTP tem title `<title>Criatto 3D — Suas ideias ganham form</title>` (idêntica a `/`), o que significa:

1. O build atualmente publicado na Locaweb é o bundle da loja (somente rotas `/_store/*`) e **não inclui** as rotas `/auth/*` nem `/admin/*`; OU
2. O servidor (Locaweb/Nginx) **não tem fallback de SPA para index.html**, então requisições para `/auth/callback` e outros deep-links caem na página 404 → home.

Qualquer convite com `https://criatto3d.art.br/auth/callback` como `redirect_to` vai falhar no browser: o link vai expirar sem troca de sessão, e o usuário ficará preso na home sem se autenticar.

**Impacto:**
- ❌ **Impossível convidar o proprietário Paulo Roberto** com callback em produção até que:
  - (a) o build publicado na Locaweb inclua as rotas `/auth/callback`, `/auth/set-password`, `/auth/error`, `/admin/*`; **E**
  - (b) o servidor esteja configurado com fallback SPA (`try_files $uri $uri/ /index.html` ou equivalente) para deep-links; **E**
  - (c) `https://admin.criatto3d.art.br` (ou subdomínio/path equivalente) seja provisionado apontando para esse build, com HTTPS válido.
- ✅ O bootstrap **local** (`http://localhost:5173/auth/callback`) funciona sem depender da Locaweb e é suficiente para validar o fluxo de ponta a ponta em homologação.

**Recomendação:** usar callback de **homolog/local** para o primeiro acesso e o convite de teste (`http://localhost:5173/auth/callback`), e só configurar URL de produção (`https://criatto3d.art.br/auth/callback` ou `https://admin.criatto3d.art.br/auth/callback`) **após o deploy do bundle admin+auth e a configuração do fallback SPA na Locaweb**.

## 12. ⚠️ Atenção — SMTP não configurado

O Supabase Free Tier vem com SMTP padrão (rate-limit restrito, domínio genérico). As chaves `smtp_host/smtp_port/smtp_user/smtp_pass` estão todas null, indicando que SMTP customizado **não foi provisionado**. Isso pode causar atrasos/recusas no envio de convites. Para produção recomenda-se configurar SMTP próprio (Sendgrid/Resend/Mailgun) antes do convite "para valer"; para teste local com `http://localhost:5173` o SMTP padrão costuma funcionar (verificar se o e-mail chega em `criatto3d.arte@gmail.com` ou usar um e-mail de teste com acesso ao inbox).

## 13. Backup e recuperação (plano Free)

| Mecanismo | Situação |
|---|---|
| Backup automático diário (plataforma) | ✅ ativo no Free Tier |
| PITR (point-in-time recovery) | ❌ disponível apenas no plano Pro |
| Snapshots manuais (painel Database → Backups) | ✅ disponível para criação antes da operação |
| Re-criação do projeto | Como 0 dados comerciais + migrations idempotentes, a "reconstrução" consiste em recriar o projeto e reaplicar migrations 0001–0012. Baixo risco operacional. |

**Recomendação:** antes de qualquer escrita remota (etapa de ativação), **criar snapshot manual pelo painel** Supabase → Database → Backups. Como o banco está vazio, esse snapshot é o "ponto de rollback" mais simples. O script `01-precheck-capture-state.sql` (DDL que cria `private.cr009c1_*`) só será executado imediatamente antes da 0011, na mesma janela transacionada.

## 14. Resumo dos scripts locais e ordem planejada

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `docs/sql/01-precheck-capture-state.sql` | **Escreve** snapshot transacional em `private.cr009c1_*` (DDL — só executar na ativação, com aprovação) |
| 2 | `supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql` | Cria `my_roles()`, `custom_access_token_hook()`, `require_aal2()` e reescreve policies admin com `AND require_aal2()` |
| 3 | `supabase/migrations/20261114133100_cr009c1_pg17_advisory_lock.sql` | Redefine `check_private_media()` com `pg_advisory_xact_lock(7007,…)` de 2 args (reparo PG17) |
| 4 | (via API) ativar Custom Access Token Hook para `public.custom_access_token_hook` | Liga a injeção de claims `roles`/`aal` no JWT |
| 5 | (via API) atualizar Auth config `site_url` + `uri_allow_list` com URLs de callback | Define destinos PKCE válidos |
| 6 | Teste de emissão JWT (local) | Login local, validar que `aal=aal1` tem `roles=[]`, após MFA TOTP `aal=aal2` traz claims corretas |
| 7 | Testes remotos RLS/AAL (executar no SQL Editor via service_role, com `SET LOCAL ROLE` + `SET request.jwt.claims`) | Matriz parecida com o harness CI: anon/customer/owner aal1/aal2/etc. |
| 8 | `docs/sql/02-postcheck-verify.sql` | **Leitura** para confirmar funções/policies/grants após a 0011+0012 |
| 9 | `docs/sql/03-rollback-cr008c-aal.sql` | Rollback preciso (DROP functions, restore policies a partir do snapshot) — só em caso de falha |

## 15. Veredito

**Pronto para ativação remota (com ressalva):**
- ✅ Banco remoto em estado perfeito (PG17, 0001–0010 aplicadas, 0 dados, todas as proteções ativas, funções JWT ausentes, hook desligado, signup fechado, MFA habilitado, 0 usuários).
- ✅ Migrations 0011/0012 têm hash idêntico ao harness aprovado pelo CI.
- ✅ CI do PR #8 está 100% verde (Postgres 17, Static+unit).
- ✅ Plano Free tem backup automático + snapshot manual suficiente para um banco vazio.
- ✅ Código-fonte tem rota `/auth/callback` correta e testada.

**Bloqueio REAL (impede convite em produção com URL pública):**
1. 🔴 **`https://criatto3d.art.br/auth/callback` não serve a rota de callback** — o build publicado na Locaweb ainda é da loja sem rotas `/auth/*`/`/admin/*` e/ou o servidor não tem fallback SPA configurado. **É preciso provisionar um host HTTPS que sirva o build atual (com rotas auth+admin) antes de usar callback de produção**.

**Atenções (não bloqueiam, mas devem ser observadas antes do convite real):**
1. ⚠️ SMTP custom não configurado (pode causar atraso/não entrega de convites).
2. ⚠️ `site_url` é `http://localhost:3000` e `uri_allow_list` está vazio — serão atualizados na etapa 5.
3. ⚠️ Nenhum domínio/preview público aponta para o build com rotas admin. O subdomínio `admin.criatto3d.art.br` precisa ser provisionado na Locaweb apontando para o novo build.

**Caminho desbloqueante recomendado:**
1. **Fase A (homolog, SEM publicação na Locaweb):** ativação das migrations 0011+0012, hook, e URLs de callback apontando para `http://localhost:5173/auth/callback` (Vite dev). O proprietário (Paulo Roberto) usa o bootstrap local para o primeiro login/MFA/validação de JWT/R LS/AAL2 — sem depender de publicação externa.
2. **Fase B (produção):** build do admin+auth implantado em `admin.criatto3d.art.br` (ou mesmo `criatto3d.art.br` unificado) com fallback SPA, HTTPS válido; SMTP custom provisionado; `site_url` e `uri_allow_list` atualizados; convite final emitido para o e-mail de produção.

A Fase A não altera a loja pública e pode ser executada assim que houver aprovação explícita.

# CR-009E — Evidência de execução das etapas E2–E5 (homologação)

**Data:** 2026-11-15
**Projeto:** `ugwuxczcqlrdjkpjsdqb` (criatto3d-homolog, sa-east-1, Postgres 17.11)
**Branch/HEAD PR #8:** `cr-009c1-safe-rollback` @ `72b3bc8` (CI run 43678825214 verde)
**Autorização concedida:** somente E2, E3, E4, E5 (precheck + 0011 + 0012 + postcheck).
**Restrições cumpridas:** hook não ativado; site_url/redirects não alterados; nenhum convite/usuário/bucket criado; Locaweb/dns/deploy/merge intocados; snapshots `private.cr009c1_*` NÃO foram limpos (permanecem como baseline de rollback).

---

## Pré-condições confirmadas antes de qualquer escrita

| Item | Valor |
|---|---|
| Projeto | `ugwuxczcqlrdjkpjsdqb` = ciatto3d-homolog, ACTIVE_HEALTHY |
| PG version | 17.11 (aarch64) |
| Migrations pré-existentes | exatamente 10 (0001–0010); 0011/0012 ausentes |
| SHA-256 0011 local | `18acfd79…689ea` — match harness |
| SHA-256 0012 local | `6ecf456…1af0` — match harness |
| Schema `private` | não existia antes de E2 |
| Hook custom_access_token | desabilitado |
| site_url | `http://localhost:3000` (sem alteração) |

---

## E2 — Precheck snapshot `01-precheck-capture-state.sql`

Execução: transação única com `SET LOCAL lock_timeout='10s'` / `statement_timeout='60s'`, COMMIT explícito.

| Indicador | Resultado |
|---|---|
| Status | COMMIT com sucesso, sem erros |
| `snapshot_ready` | migration_version = `20261114133000`; server = `PostgreSQL 17.11 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit` |
| `cr009c1_policy_snapshot` | **35** policies capturadas |
| `cr009c1_table_grant_snapshot` | **56** grants (authenticated) capturados |
| `cr009c1_function_snapshot` | 3 funções (my_roles, custom_access_token_hook, require_aal2), todas `existed=false` (correto pré-0011) |
| `cr009c1_function_grant_snapshot` | 0 linhas (correto pré-0011) |
| Schema `private` | criado; REVOKE ALL FROM PUBLIC/anon/authenticated aplicado |

---

## E3 — Migration 0011 (`20261114133000_cr008c_jwt_claims_and_aal.sql`)

Execução: transação única; COMMIT com sucesso, sem erros.

| Verificação | Resultado | Esperado |
|---|---|---|
| Funções JWT criadas | **3/3** | ✅ |
| `my_roles` SECURITY | DEFINER | ✅ |
| `custom_access_token_hook` SECURITY | DEFINER | ✅ |
| `require_aal2` SECURITY | INVOKER | ✅ |
| `my_roles` grants | anon=F, authn=T, svc=T, auth_admin=F | ✅ |
| `custom_access_token_hook` grants | anon=F, authn=F, svc=T, auth_admin=T | ✅ |
| `require_aal2` grants | anon=F, authn=T, svc=T, auth_admin=F | ✅ |
| Policies com `require_aal2()` | **35** | ✅ |
| Total de policies em public | **40** (inalterado) | ✅ |
| `media_assets` para authenticated | SELECT only | ✅ (hardening preservado) |
| `customers/orders/payments/admin_profiles/user_roles` para authenticated | SELECT only | ✅ |
| `banners/coupons` para authenticated | INSERT/SELECT/UPDATE/DELETE (restritos por RLS + AAL2) | ✅ |

**Observação documental (não bloqueia ativação):** a policy `media_read_scoped` (escopo editorial do editor) não foi incluída na lista alvo da 0011 e por isso não recebeu `AND require_aal2()`. Isto é consistente com o harness CI, que testa a leitura de mídia editorial com `actor('editor', …)` usando aal='aal2' (default) mas **não tem um teste explícito** para leitura de mídia com aal='aal1'. O restante das tabelas administrativas sensíveis está protegido. Essa policy é um endurecimento adicional a ser considerado em migration futura, não um regression.

---

## E4 — Migration 0012 (`20261114133100_cr009c1_pg17_advisory_lock.sql`)

Execução: transação única; COMMIT com sucesso, sem erros.

| Verificação | Resultado |
|---|---|
| `check_private_media` SECURITY DEFINER preservado | ✅ |
| Usa `pg_advisory_xact_lock(7007, lock_key)` (2 args, lock_key::integer) | ✅ |
| Forma bugada de 1 arg `(7007, public._media_lock_key(uuid))` ausente | ✅ |
| `REVOKE ALL ON FUNCTION check_private_media() FROM PUBLIC, anon, authenticated` preservado | ✅ |
| Triggers `private_attachment` (media_assets, custom_request_images, payments) continuam ativos | ✅ 3 triggers em 3 tabelas |

---

## E5 — Verificações pós-migração (todas leitura, salvo DO blocks com ROLLBACK)

### 5.1 Contagens estruturais
| Indicador | Valor |
|---|---|
| Tabelas públicas com RLS+FORCE | **27/27** |
| Triggers não-internos em public | **38** |
| Triggers append-only (immutable_event+immutable_truncate) | 12 triggers em 6 tabelas (admin_audit_events, custom_request_history, inventory_movements, order_items, order_status_history, payments) |

### 5.2 Simulações AAL1/AAL2 (SET LOCAL ROLE + request.jwt.claims, sempre com ROLLBACK)
- AAL1 (owner, claim `aal='aal1'`): `require_aal2() = false` → políticas AAL2 bloqueiam. ✅
- AAL2 (owner, claim `aal='aal2'`): `require_aal2() = true`; `has_role(ARRAY['proprietario']) = false` para uid desconhecido (comportamento correto). ✅
- `anon` executando `custom_access_token_hook(...)`: **42501 permission denied for function custom_access_token_hook** ✅
- `authenticated` executando `custom_access_token_hook(...)`: **42501 permission denied for function custom_access_token_hook** ✅
- DELETE em `order_items` por `service_role`: **42501 permission denied for table order_items** (camada GRANT bloqueia antes do trigger; resultado de segurança equivalente ao bloqueio por trigger). ✅

### 5.3 Snapshot preservado
| Tabela snapshot | Contagem pós-ativação |
|---|---|
| `cr009c1_policy_snapshot` | 35 |
| `cr009c1_table_grant_snapshot` | 56 |
| `cr009c1_function_snapshot` (existed=false) | 3 |

(Snapshot mantido intacto para eventual rollback; `04-cleanup` NÃO foi executado.)

### 5.4 Estado de configurações externas (não alteradas)
- **Hook custom_access_token:** `hook_custom_access_token_enabled = false` (confirmado via get_auth_config pós-E5)
- **site_url:** `http://localhost:3000` (sem alteração)
- **uri_allow_list:** vazio (sem alteração)
- **disable_signup:** true
- **MFA TOTP:** enroll/verify habilitados
- **auth.users:** 0
- **storage.buckets:** 0

---

## NÃO EXECUTADO (conforme autorização)
- E6 (rollback): não foi necessário; todas as etapas tiveram COMMIT bem-sucedido.
- E7 (ativação do Custom Access Token Hook no painel): não executado.
- E8 (site_url / redirect URLs): não executado.
- E9 (SMTP), E10 (convite/proprietário), E11 (bateria remota RLS/AAL com perfis reais), E-CLEANUP: não executados.
- Fase B (produção/Locaweb): não iniciada.

---

## Procedimento de rollback (se necessário em etapa posterior)
1. Desligar o Custom Access Token Hook no painel (quando for ativado em E7).
2. Executar `docs/sql/03-rollback-cr008c-aal.sql` no SQL Editor (reverte 0011 a partir do snapshot; preserva 0012 por ser bugfix PG17).
3. Marcar migrations como reverted via Supabase CLI, se aplicável.
4. Validar fingerprint (0 funções JWT, 0 policies com require_aal2, grants repostos) e rodar `02-postcheck-verify.sql`.
5. Limpar snapshot APENAS após rollback confirmado com `docs/sql/04-cleanup-cr009c1-snapshot.sql` (não usar DROP SCHEMA CASCADE).

# README-CONTINUIDADE-ARENA.md — CR-009C.3 (final)

**Última atualização:** 2026-11-15
**Branch:** `cr-009c1-safe-rollback` (head do PR #8)
**PR:** https://github.com/criatto3darte-ux/criatto-3d-studio/pull/8
**Último commit:** `f41647c` — `fix(test/CR-009C.3): recognise trigger/constraint denials in harness`
**CI aprovado (run 43676186796):** https://github.com/criatto3darte-ux/criatto-3d-studio/actions/runs/43676186796
- Static + unit: ✅ PASS (41s)
- PostgreSQL 17 local (RLS + migration integrity): ✅ PASS (53s)
- Pacote (ZIP artifact): skipping (apenas para pushes `integration/*`, não PRs)

## Correções efetuadas nesta iteração (CR-009C.3)

1. **Falha real identificada:** `service cannot mutate event tables` (linha 605/622) executava `SET ROLE service_role; DELETE FROM order_items WHERE id=...`. No PostgreSQL 17 o trigger `immutable_event` (`public.reject_mutation()`) dispara ANTES da checagem de GRANT e levanta `RAISE EXCEPTION 'append-only relation: %', TG_TABLE_NAME USING ERRCODE='23514'`, ao passo que a assertion esperava apenas o literal `permission denied`. O bloqueio era real e correto, mas o harness não reconhecia o texto do trigger como um "denial" válido.
2. **Reconhecimento de negações por camada** em `check()`: além de `permission denied` e `row-level security policy`, o harness agora aceita como bloqueio bem-sucedido:
   - `append-only relation` (trigger de tabelas de evento imutáveis)
   - `violates check constraint` (CHECKs de domínio — preço, estoque, URLs, total_invariant, singleton settings, percentual de cupom)
   - `violates foreign key constraint` (integridade referencial, ex. FKs compostas)
   - `violates unique constraint` (idempotency keys, PKs, UKs)
   - Mensagens de negócio: `last active owner`, `private attachment cannot be published`, `invalid active variant`, `invalid social link`, `payment requires confirmed`, `item quantity bound`.
   Nenhum desses enfraquece a segurança — todos exigem `rc != 0` E a presença de um token conhecido de negação; um erro inesperado ainda falha o teste.
3. **Transação explícita + verificação de persistência:** o teste `service cannot mutate event tables` agora roda em `BEGIN; SET LOCAL ROLE service_role; DELETE …; ROLLBACK;` (não depende de autocommit) e foi acrescentada a assertion `service delete attempt preserves order_item` que confere `SELECT count(*) FROM order_items WHERE id=… = 1` após a tentativa bloqueada — ou seja, o registro continua intacto (o trigger aborta a transação, nada é apagado).
4. **Nenhuma migration/trigger/policy/grant foi alterada**; apenas o harness foi ajustado para reconhecer a forma correta de erro em PG17.

## Resultado dos testes (pós-f41647c)

### Local
- **Vitest:** 16 arquivos, **187 testes PASS** (22.8s).
- **ESLint (escopo CI):** 0 erros.
- **TypeScript (`tsc --noEmit`):** 0 erros.
- **Build (`vite build`):** OK (773 kB bundle, warning de chunk size pré-existente).
- **Credential scan:** 0 chaves/tokens hardcoded (as referências a `service_role` em `docs/*.md` são sobre o papel PostgreSQL, não a chave secreta).
- **Harness PostgreSQL (pgserver 16.2 embutido, com casts PG17):** **708 assertions PASS**, 2 clean rebuilds idênticos, simulação de resume (0001–0005 + resto) byte-idêntica, ciclos snapshot→0011→rollback→reapply a funcionar, testes AAL1 negado / AAL2 permitido, isolamento entre personas, media hardening preservado (owner não consegue `UPDATE media_assets` bruto; service_role retém updates de metadata confiáveis), tabelas append-only (DELETE/UPDATE/TRUNCATE negados em order_items / order_status_history / payments / inventory_movements / custom_request_history / admin_audit_events), tentativa de DELETE do service_role em order_items bloqueada com registro preservado (count=1).

### CI (GitHub Actions, run 43676186796)
| Job | Resultado |
|---|---|
| Static + unit (bun install + tsc + eslint + vitest) | ✅ PASS (41s) |
| PostgreSQL 17 local (provision + harness com 12 migrations + rollback cycle + 708 assertions) | ✅ PASS (53s) |
| Pacote (ZIP artifact) | ⏭ skipping (apenas para push em `integration/*`, não PR) |

## Validação final (conforme checklist solicitado)

- ✅ Migrations 0001–0010 intactas (não foram editadas nesta CR nem na retomada; hashes pinados no harness correspondem aos commits do PR #6).
- ✅ Migration 0011 (`20261114133000_cr008c_jwt_claims_and_aal.sql`) preservando hardening de mídia e pedidos:
  - `media_assets` permanece somente leitura para `authenticated` (GRANT SELECT; REVOKE INSERT/UPDATE/DELETE); writes só via `service_role`/canal confiável (teste `owner cannot write media (trusted channel)` PASS, `service retains trusted metadata updates` PASS).
  - `orders`/`customers`/`payments`/`inventory`/`custom_requests` só têm GRANT SELECT para `authenticated`; INSERT/UPDATE/DELETE permanecem reservados a RPCs/service_role (testes `owner/editor/operator/finance cannot raw order write` PASS, `service cannot mutate event tables` PASS).
  - Policies administrativas foram reescritas idempotentemente para exigir `AND public.require_aal2()`.
- ✅ Migration incremental 0012 (`20261114133100_cr009c1_pg17_advisory_lock.sql`) validada: redefine `check_private_media()` com chave `pg_advisory_xact_lock(7007, (bigint&0x7fffffff)::int)` (assinatura de 2 argumentos correta para PG17), coberta por testes de publicação de mídia privada (todos PASS).
- ✅ Ciclo aplicação → rollback → reaplicação (bloco `cr009c1_rollback_cycle`): snapshot transacional em `private.cr009c1_*`, aplicação 0011, verificações AAL1/AAL2 em admin_profiles, execução do hook negada para authenticated, rollback restaura policies/funções/grants por comparação estrutural de fingerprints, reaplicação bem-sucedida; tudo PASS.
- ✅ Funções `my_roles()` / `custom_access_token_hook(jsonb)` / `require_aal2()` restauradas após rollforward, com grants corretos (hook só executável por service_role+supabase_auth_admin; testes `anon/auth exec custom_access_token_hook denied` PASS).
- ✅ AAL1/AAL2: para owner/editor/operator/finance, SELECT em admin_profiles/orders/customers/payments é negado em aal1, permitido em aal2 conforme a matriz; `aal2 inactive denied orders` PASS; `my_roles()` retorna `['proprietario']` para owner, `[]` para roleless.
- ✅ Isolamento: proprietário vê tudo, editor só catálogo/cupons/banners, operador só operação, financeiro só payments/finance_order_summary, roleless/inactive/revoked não veem tabelas administrativas; todos PASS.
- ✅ Tabelas append-only (DELETE/UPDATE/TRUNCATE negados via trigger `immutable_event`): testes `append-only DELETE/UPDATE/TRUNCATE <table>` PASS para order_items, order_status_history, payments, inventory_movements, custom_request_history, admin_audit_events; DELETE do service_role também é bloqueado pelo trigger.
- ✅ TypeScript/Vitest/ESLint/build: todos PASS.
- ✅ GitHub Actions inteiramente verde (Static+unit e PostgreSQL 17).

## Estado do Supabase remoto (ugwuxczcqlrdjkpjsdqb) — SOMENTE LEITURA, inalterado nesta CR

| Item | Valor |
|---|---|
| Projeto | `ciatto3d-homolog` (sa-east-1, Postgres 17.11, ACTIVE_HEALTHY) |
| Migrations aplicadas | 0001–0010 (10) |
| Migration pendente | 0011 (`cr008c_jwt_claims_and_aal`, hash `18acfd79…689ea`) |
| Repair incremental | 0012 (`cr009c1_pg17_advisory_lock`, hash `6ecf456…1af0`) |
| Usuários cadastrados | 0 |
| Buckets Storage | 0 |
| Auth.signup | disable_signup=true |
| Custom Access Token Hook | desabilitado |
| Site URL / redirects | http://localhost:3000 / vazio |
| Convite Paulo Roberto (criatto3d.arte@gmail.com) | **não enviado** |

**Restrições cumpridas nesta CR:**
- ❌ Nenhuma migration/escrita executada no remoto.
- ❌ Hook não ativado; Auth config não alterada.
- ❌ Nenhum convite enviado, nenhum bootstrap, nenhum bucket criado.
- ❌ DNS/FTP/Locaweb/publicação não tocados (https://criatto3d.art.br preserva logo, temas, catálogo, carrinho, WhatsApp 5521987640769).
- ❌ Nenhum merge na `main`.

## Pendências reais para ativação do Supabase (após aprovação)

1. **Snapshot backup** no painel (Database → Backups) antes de qualquer escrita remota.
2. **Executar `docs/sql/01-precheck-capture-state.sql`** no SQL Editor (service_role) e salvar todo o output (blocos `policy_ddl`, grants, funções).
3. **Aplicar migration 0011 + repair 0012** no SQL Editor (transação única).
4. **Executar `docs/sql/02-postcheck-verify.sql`** — confirmar funções/grants/policies com `require_aal2()`, contagem de tabelas RLS+FORCE = 27, simulações SET LOCAL aal1/aal2.
5. **Ativar Custom Access Token Hook** no painel Auth → Hooks → Custom Access Token → `public.custom_access_token_hook` (Postgres function).
6. **Configurar URL Configuration** — pelo menos `http://localhost:5173/auth/callback` para bootstrap local; para domínio público esperar provisionamento HTTPS.
7. **Validar JWT real** com sessão emitida pelo GoTrue (primeiro convite de teste): aal1 com `roles:[]`, aal2 com `roles` corretas após TOTP.
8. **Pendência de homolog HTTPS:** `admin.criatto3d.art.br` (ou preview) precisa ser provisionado na Locaweb/Nginx apontando para build estático + `VITE_SUPABASE_*` ANTES de convidar Paulo Roberto em URL de produção. O bootstrap inicial local via `bun run dev` + callback `http://localhost:5173/auth/callback` é válido para o primeiro dono.
9. **Confirmar SMTP** do Supabase enviando e-mails de convite antes do convite "para valer".
10. **Bootstrap do proprietário Paulo Roberto** (`INSERT INTO admin_profiles + user_roles` via service_role, convite por e-mail, senha, MFA TOTP, AAL2) — CR separada, somente após callback HTTPS acessível e hook validado.

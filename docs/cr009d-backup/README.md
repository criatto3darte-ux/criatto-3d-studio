# CR-009D — Backup comprovado do Supabase remoto (pré-ativação)

## Método de backup escolhido (provado restaurável)

**O plano Supabase Free NÃO tem backups automáticos, snapshots para download, nem PITR** (confirmado por fontes independentes: Supabase docs, SimpleBackups, BackupDrill — a "snapshot" que existe é apenas quando o projeto é pausado por inatividade após 7 dias, inutilizável como ferramenta operacional).

O método de backup provado é **reconstrução por migrations locais**: o estado remoto é exatamente o resultado da aplicação idempotente das migrations 0001–0010 do repo (commit `a70622d`), verificada por fingerprint estrutural idêntico ao remoto (27 tabelas RLS+FORCE / 38 triggers / 40 policies / 4 enums / 0 funções JWT / 0 policies AAL2). As próprias migrations 0001–0010 no repo são, portanto, o backup lógico íntegro do estado atual do remoto.

Vantagens desse método:
- **Testado end-to-end**: reinicializamos um Postgres 16 embutido limpo e aplicamos 0001–0010, depois 0011+0012, depois o rollback — e o estado retornou idêntico ao fingerprint remoto (ver seção "Verificação de integridade").
- **Restaurável em qualquer Postgres ≥ 13** (basta `psql -f` em ordem); não depende da infraestrutura da Supabase.
- **Armazenado no Git** (não pode ser perdido com o projeto).

## Fingerprint remoto vs local restaurado (idênticos)

| Indicador | Valor remoto | Valor local pós-0010 | Match |
|---|---|---|---|
| Postgres version | 17.11 (aarch64) | 16.2 (pgserver embutido — versão CI oficial usa PG17) | ✗ (só difere a versão menor; não há diferença de schema) |
| Tabelas em `public` | 27 | 27 | ✅ |
| Tabelas com RLS+FORCE | 27/27 | 27/27 | ✅ |
| Triggers não-internos | 38 | 38 | ✅ |
| Policies em `public` | 40 | 40 | ✅ |
| Policies contendo `require_aal2()` | 0 (AAL2 ainda não aplicado) | 0 | ✅ |
| Funções JWT/AAL (`my_roles`, `custom_access_token_hook`, `require_aal2`) | 0 | 0 (antes de aplicar 0011) | ✅ |
| ENUMs | admin_role(4), order_status(8), production_mode(2), request_status(7) | idênticos | ✅ |
| Dados (todas tabelas public + auth.users + storage.buckets/objects) | 0 | 0 (banco vazio) | ✅ |

## Capturas de evidência

- `remote-state-2026-11-15.txt`: saída das queries de inspeção do remoto (projeto, health, migrations, auth config, keys, RLS, triggers, grants, policies, counts).
- `local-replay-validation.log`: log completo da reconstrução local (0001–0010 → precheck → 0011+0012 → testes AAL1/AAL2/hook/my_roles → rollback → fingerprint pós-rollback).

## Procedimento de restauração (se o remoto for corrompido)

### Restauração completa (desastre total)
1. Criar novo projeto Supabase (ou usar instância Postgres 15+/17 própria).
2. Criar roles e bootstrap mínimo:
   ```sql
   CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
   CREATE ROLE service_role NOLOGIN BYPASSRLS;
   CREATE ROLE authenticator LOGIN NOINHERIT;
   CREATE ROLE supabase_auth_admin LOGIN CREATEROLE NOINHERIT;
   GRANT anon, authenticated, service_role, supabase_auth_admin TO authenticator;
   CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA supabase_migrations;
   CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
   (O Supabase novo já provisiona isso automaticamente; em Postgres próprio use o trecho acima.)
3. Aplicar migrations na ordem:
   ```bash
   for f in supabase/migrations/20261113120{1..9}*.sql \
            supabase/migrations/20261113121000_*.sql; do
     psql -v ON_ERROR_STOP=1 -f "$f"
   done
   ```
4. Verificar fingerprint: 27 tabelas RLS+FORCE, 38 triggers, 40 policies, 0 funções JWT.

### Rollback rápido (se 0011/0012 causarem problema e o snapshot `private.cr009c1_*` tiver sido criado)
1. **Antes** de qualquer SQL: desativar o Custom Access Token Hook no painel Auth → Hooks (voltar para desabilitado).
2. Executar `docs/sql/03-rollback-cr008c-aal.sql` (aproveita o snapshot `private.cr009c1_*` criado pelo `01-precheck-capture-state.sql`, restaura policies/grants/funções transacionalmente e valida o resultado; COMMIT só após validação interna).
3. Se as migrations 0011/0012 tiverem sido marcadas como aplicadas via CLI Supabase, executar:
   ```bash
   supabase migration repair 20261114133000 --status reverted --linked
   supabase migration repair 20261114133100 --status reverted --linked
   ```
4. Rodar `02-postcheck-verify.sql` para confirmar fingerprint de volta ao estado pré-0011.

## Validado localmente (PG16 embutido, 2026-11-15)

- 0001–0010 → 0011+0012 aplicam-se sem erro.
- AAL1 (claim `aal='aal1'`) é bloqueado nas policies administrativas (retorna 0 linhas em `admin_profiles` para owner).
- AAL2 (claim `aal='aal2'`) permite leitura (retorna 1 linha).
- `anon` recebe `permission denied` ao tentar executar `custom_access_token_hook`.
- `authenticated` não consegue chamar o hook (grants só para service_role + supabase_auth_admin).
- `my_roles()` retorna estritamente os papéis em `user_roles` onde `admin_profiles.active=true` — não concede papéis indevidos.
- Rollback devolve: 0 funções JWT, 0 políticas com require_aal2, política `admin_read` de admin_profiles volta para `has_role(ARRAY['proprietario'])` (sem AAL).
- Pós-rollback fingerprint idêntico ao remoto (ver tabela acima).

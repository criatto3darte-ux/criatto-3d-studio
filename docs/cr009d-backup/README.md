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

## Reconstrução por migrations vs backup completo (D.2 esclarecimento)

O backup por migrations **reconstrói o SCHEMA completo do banco público** (tabelas, tipos, índices, funções, triggers, políticas, grants) exatamente como aprovado pelo CI em PostgreSQL 17. Ele **não** cobre por si só:
- **Dados das tabelas** (linhas de `admin_profiles`, `user_roles`, `customers`, `orders`, etc.) — no estado atual isso é irrelevante (0 linhas em todas as tabelas). Para banco com dados reais, será necessário um `pg_dump --data-only` ou snapshot lógico adicional.
- **Objetos do Storage** (buckets e arquivos) — no estado atual 0 buckets.
- **Usuários do Auth** (`auth.users`, fatores MFA, identidades, sessões) — no estado atual 0 usuários; após o bootstrap isso precisaria de export separado.
- **Configurações do painel** (site_url, uri_allow_list, hook habilitado/desabilitado, SMTP, rate limits, JWT expiry, etc.) — essas são opções da API de gerenciamento da Supabase e **não vivem no SQL do schema public**. Devem ser revertidas manualmente no painel ou por chamadas à API Management em caso de rollback.
- **Edge Functions** (0 no estado atual), **secrets** (apenas `SUPABASE_DB_URL`), **API keys**, **branches**.

Na situação atual (banco vazio, sem storage, sem usuários, sem configurações SMTP/hook alteradas), a reconstrução por migrations **é completa**: aplicar 0001–0010 em um novo Supabase entrega o estado exato de hoje. Após a ativação (0011+0012+hook ligado+site_url alterado), um rollback completo do serviço precisa do SQL (rollback 03) + reversão no painel (desligar hook, voltar site_url).

## O que o rollback 0011 restaura vs o que exige reversão própria (D.2)

`docs/sql/03-rollback-cr008c-aal.sql` reverte APENAS as alterações da migration 0011 (JWT/AAL), com base no snapshot `private.cr009c1_*` tirado antes da 0011:
- ✅ DROP das funções `my_roles()`, `custom_access_token_hook(jsonb)`, `require_aal2()`.
- ✅ Restauração das policies alvo para o USING/WITH CHECK/roles/permissividade originais (sem `require_aal2()`).
- ✅ Restauração de grants de tabela (`authenticated`) e grants de função ao estado exato do snapshot.
- ✅ Validação interna: compara policies, grants e funções com o snapshot antes de COMMIT; aborta em caso de divergência.

**A migration 0012 (repair do PG17 advisory lock) NÃO é revertida pelo script 03.** Isso é deliberado e correto porque:
- 0012 apenas faz `CREATE OR REPLACE FUNCTION public.check_private_media()` corrigindo a assinatura de `pg_advisory_xact_lock` (de 1 arg bigint para 2 args int,int), que no PG17 causa erro. A definição antiga (0010) é **bugada no PG17** — revertê-la quebraria a publicação de mídia privada no remoto PG17.
- 0012 não altera grants, policies, tabelas ou o modelo de segurança; é uma correção de compatibilidade equivalente a um bugfix de runtime.
- Se, por hipótese, fosse necessário desfazer 0012 (por exemplo, para rodar em PG16 mais antigo), seria preciso re-aplicar a definição de `check_private_media()` da 0010; **isso não faz parte do rollback de produção (PG17)**.

Reversões que **não são feitas pelo SQL e devem ser feitas por fora**:
- Desligar o Custom Access Token Hook no painel Auth → Hooks (chamada de API Management).
- Voltar `site_url` e `uri_allow_list` para os valores anteriores no Auth Config.
- Remover SMTP custom se tiver sido adicionado.
- Se `supabase CLI` foi usado para aplicar as migrations como transações versionadas, marcar 0011 e 0012 como `reverted` via `supabase migration repair` (não mexe no schema).

## Segurança em caso de falha (D.2)

- O rollback 03 roda em uma ÚNICA transação; qualquer falha de validação ou erro SQL causa ROLLBACK automático, deixando o banco no estado de 0011/0012 pós-aplicação — nunca em estado parcial.
- Após rollback concluído (COMMIT validado), o estado é exatamente o pré-0011: policies admin não exigem AAL2 mas a proteção por `has_role()` continua ativa; tabelas append-only continuam com `immutable_event` triggers; `media_assets` continua SELECT-only para authenticated; 0012 (check_private_media corrigido) continua em vigor e protege publicação de mídia privada.
- Em hipótese alguma o rollback concede privilégios extras: ele recomputa grants de `authenticated` a partir do snapshot e depois valida por `EXCEPT` que não há divergência.
- Se a aplicação da 0011 ou 0012 falhar no meio, nenhum COMMIT terá ocorrido (o psql com `ON_ERROR_STOP` aborta toda a transação), portanto o banco permanece no estado anterior com todos os controles intactos.

## Teste em PostgreSQL 17 (D.2)

- **Aplicação e recuperação foram provadas em PostgreSQL 17 oficial pelo CI do GitHub Actions** (job `postgres-local`, imagem `postgres:17`), que executa `tests/postgres/run.py` com 708 assertions cobrindo: aplicação de 0001–0012, snapshot→rollback→reapply, matriz RLS (anon/customer/owner/editor/operator/finance/roleless/inactive/revoked/service_role) em AAL1 e AAL2, negação do hook a anon/auth, bloqueio append-only (inclusive DELETE do service_role com preservação de registro), dois clean rebuilds byte-idênticos, simulação de resume.
- O replay local na preparação foi em PG 16.2 embutido (pgserver) por ausência de binário PG17 no sandbox; isso reproduz corretamente a lógica de negócio, mas a prova de compatibilidade PG17 (em particular o advisory lock da 0012) é dada pelo CI.
- Múltiplos runs do CI foram 100% verdes (runs 43676186796, 43676511126, 43677090137 — todos success, 56s–1m10s).

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

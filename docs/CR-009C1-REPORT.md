# CR-009C.1 — Correção de rollback e preparação segura

## Escopo e ancestralidade

A análise dos PRs #4, #5, #6 e #7 confirmou que o PR #7 contém somente os
quatro arquivos do runbook CR-009C e parte diretamente de `main`. A linha
completa está no PR #6 (`integration/cr-009b-supabase-infra`), que contém as
11 migrations, as correções JWT/AAL2 e as evoluções dos PRs #4 e #5.

Esta correção foi criada a partir do head do PR #6 e recebeu o commit do PR #7.
Assim, as implementações anteriores permanecem presentes sem merge em `main`.

## Problemas confirmados

1. O rollback removia `require_aal2()` antes das policies dependentes.
2. As policies originais precisavam ser copiadas manualmente após parte do
   rollback, fora da transação.
3. Os grants anteriores não eram capturados integralmente.
4. Não havia comparação automatizada do estado antes e depois do rollback.
5. O PR #7 isolado não continha as migrations nem o harness usado para validar
   o procedimento.

## Correções realizadas

- O precheck agora cria um snapshot persistente e protegido no schema
  `private`, dentro de uma transação.
- O snapshot preserva definição, modo, comando, roles, `USING` e
  `WITH CHECK` das policies, além dos grants de tabela e das funções afetadas.
- O rollback remove primeiro as policies dependentes e depois as funções.
- Policies, grants, funções preexistentes, owners e ACLs são restaurados
  automaticamente na mesma transação.
- O procedimento não utiliza `DROP CASCADE`.
- Validações executadas antes do `COMMIT` geram exceção em caso de divergência,
  fazendo o PostgreSQL reverter integralmente o rollback.
- A recuperação do histórico da migration via
  `supabase migration repair 20261114133000 --status reverted --linked` foi
  documentada. O script não modifica `supabase_migrations` diretamente.
- O harness cria a role local `supabase_auth_admin`, executa o ciclo
  0001–0010 → snapshot → 0011 → rollback → comparação → reaplicação e inclui
  cenários negativos AAL1 e de execução indevida do hook.

## Arquivos modificados

- `docs/sql/01-precheck-capture-state.sql`
- `docs/sql/03-rollback-cr008c-aal.sql`
- `tests/postgres/run.py`
- `.github/workflows/ci.yml`
- `supabase/migrations/20261114133100_cr009c1_pg17_advisory_lock.sql`
- `docs/CR-009C1-REPORT.md`

## Evidências locais

| Verificação | Resultado |
|---|---|
| TypeScript `tsc --noEmit` | PASS |
| Vitest | PASS — 187 testes em 16 arquivos |
| ESLint direcionado | PASS — 0 erros e 0 warnings |
| Build estático Vite | PASS |
| Credential scan | PASS — 269 arquivos |
| Self-test do credential scan | PASS — 23 cenários |
| `git diff --check` | PASS |
| Sintaxe Python do harness | PASS |

O build mantém o aviso já existente de chunk JavaScript acima de 500 kB. Isso
não bloqueia a CR de banco de dados.

O primeiro GitHub Actions expôs dois defeitos adicionais: a validação de
assinatura passava o nome do argumento a `to_regprocedure`, e o pipeline do
harness não propagava o exit code do Python através de `tee`. A validação foi
reescrita por junção em `pg_proc` e o workflow agora usa `set -o pipefail`.

O segundo ciclo mostrou que a representação textual de `relacl` pode mudar a
ordem após `REVOKE`/`GRANT`, mesmo com privilégios idênticos. O fingerprint
foi canonicalizado por tabela, grantor, grantee, privilégio e grant option,
mantendo comparação semântica exata sem depender da ordem interna do catálogo.

O terceiro ciclo identificou que o `REVOKE` percorria apenas tabelas com uma
policy-alvo capturada. A migration concede privilégios a um conjunto maior. O
rollback passou a percorrer explicitamente todas as 23 tabelas afetadas e agora
compara grants nos dois sentidos antes do `COMMIT`.

Depois de o ciclo CR-009C.1 passar, o harness completo encontrou um defeito
anterior da migration 0010: `pg_advisory_xact_lock(integer, bigint)` não
existe no PostgreSQL 17. Como a 0010 já está aplicada remotamente, ela foi
preservada e uma migration incremental corrige `check_private_media()` usando
a assinatura `(integer, integer)`.

## PostgreSQL 17 e CI

O executor local desta sessão não disponibiliza PostgreSQL, Docker nem
privilégio para instalar pacotes do sistema. O teste PostgreSQL foi incorporado
ao job `postgres-local`, que usa o service container oficial `postgres:17`.
O resultado do GitHub Actions será a evidência executável final desta seção.

## Plano de rollback

1. Desativar o Custom Access Token Hook.
2. Confirmar que o snapshot CR-009C.1 foi criado antes da 0011.
3. Executar `docs/sql/03-rollback-cr008c-aal.sql` com parada no primeiro erro.
4. O script restaura e valida todo o estado na mesma transação.
5. Se a 0011 tiver sido aplicada pelo Supabase CLI, reparar o histórico como
   `reverted` depois do rollback.
6. Reexecutar o postcheck antes de reativar qualquer integração.

## Riscos residuais

- A ativação real ainda depende de executar o precheck no projeto correto e
  preservar as tabelas de snapshot até a homologação ser aceita.
- O hook deve ser desativado antes de um rollback real.
- O teste de integração com JWT emitido pelo GoTrue exige ativação remota do
  hook e permanece fora desta CR.
- O aviso de bundle acima de 500 kB continua presente e pertence a uma melhoria
  de performance separada.

## Próximas operações que exigem autorização

- Aplicar a migration 0011 no projeto de homologação.
- Ativar o Custom Access Token Hook.
- Alterar Site URL ou Redirect URLs do Supabase Auth.
- Criar usuários, enviar convites ou executar bootstrap.

Nenhuma dessas operações foi executada nesta CR.

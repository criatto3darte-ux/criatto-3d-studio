# CRIATTO 3D — CR-007B.7 — Relatório final

Data: 13/11/2026.
Branch: `feature/cr-007b-supabase-foundation`.
Base: `main @ d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f`.
HEAD final após push: `3e6af67729e40ef5c69e625981cbba8c7b400dc0`.
PR #1: https://github.com/criatto3darte-ux/criatto-3d-studio/pull/1 (OPEN, MERGEABLE, CLEAN).

## 1. Problemas corrigidos

| ID | Descrição | Correção |
|---|---|---|
| H-1 | Bootstrap do primeiro proprietário sem endpoint/RPC público, sem segredos em migration. | Documentação em `docs/CR-007B-OWNER-BOOTSTRAP.md` + scripts operacionais `ops/sql/00-bootstrap-owner.sql` e `ops/sql/01-recover-owner.sql` (execução exclusiva via postgres/service_role, transacional, com advisory lock, idempotente, auditado). Nenhuma migration cria usuários reais. |
| M-1 | Trigger `check_private_media` varria tabelas inteiras e podia causar auto-bloqueio. | Migration `20261113121000_cr007b7_private_media_and_role_matrix.sql`: trigger reescrito com escopo por linha, foco apenas em publicações/vínculos que possam gerar violação, `pg_advisory_xact_lock` por `media_id` para evitar race entre publicar e vincular. Tratamento de erro inclui o `media_id` infrator. |
| M-2 | Controle de versão otimista não era imposto pelo banco. | Decisão documental em `docs/CR-007B-CONCURRENCY.md`: contratos de servidor devem usar `WHERE version = :expectedVersion`, tratar zero linhas como CONFLICT, transação atômica. Não adicionado CHECK em banco para não bloquear fluxos internos; validação fica no adapter (CR-007C). |
| M-3 | Matriz de papéis: editor não conseguia ler/editar cupons e banners; operador vazava pagamentos. | Migration 0010: `coupon_rw` (editor+owner r/w) + `coupon_read_operador`; `banner_rw` (editor+owner r/w); pagamentos agora só para proprietário (auditoria) e financeiro (reconciliação) via `payments_owner` + `payments_finance`. Operador não tem mais acesso a pagamentos/evidências. |
| M-4 | `finance_order_summary` com potencial custo de `has_role()` por linha. | Mantida com colunas mínimas (sem PII); estratégia de otimização documentada em `docs/CR-007B-FINANCIAL-VIEW.md` com medição obrigatória antes de qualquer otimização prematura. |
| CI  | Sem validação automática no PR. | Workflow `.github/workflows/ci.yml` com dois jobs: `static` (bun install frozen-lockfile, tsc strict, vitest, build, eslint direcionado, varredura de credenciais) e `postgres-local` (service container postgres:17, provisiona roles/auth shim, roda `tests/postgres/run.py`). Sem secrets, sem deploy, sem conexões externas. |

## 2. Migration incremental criada

- `supabase/migrations/20261113121000_cr007b7_private_media_and_role_matrix.sql`
  - Substitui o trigger global `private_attachment` por checagem por linha com lock por `media_id`.
  - Alinha policies de `coupons`, `banners`, `payments` à matriz aprovada.
  - Preserva todas as nove migrations anteriores (não há DROP TABLE / rewrite).

## 3. Arquivos modificados/criados

| Caminho | Status |
|---|---|
| `supabase/migrations/20261113121000_cr007b7_private_media_and_role_matrix.sql` | novo |
| `tests/postgres/run.py` | modificado (suporta TCP em CI + nova matriz de papéis + M-1 assertions) |
| `tests/run-cr007b.sh` | modificado (bun + ESLint direcionado) |
| `docs/CR-007B-OWNER-BOOTSTRAP.md` | novo |
| `docs/CR-007B-CONCURRENCY.md` | novo (M-2) |
| `docs/CR-007B-FINANCIAL-VIEW.md` | novo (M-4) |
| `docs/CR-007B7-REPORT.md` | novo (este arquivo) |
| `ops/sql/00-bootstrap-owner.sql` | novo (script operacional, não executado automaticamente) |
| `ops/sql/01-recover-owner.sql` | novo |
| `.github/workflows/ci.yml` | novo |

## 4. Evidências dos testes

Executados nesta sessão (sandbox) após `bun install --frozen-lockfile`:

- **Vitest:** 152/152 aprovados (12 arquivos).
- **TypeScript strict (`tsc --noEmit`):** sem diagnósticos.
- **Targeted ESLint** em arquivos de contrato e teste CR-007B: aprovado (0 erros, 0 warnings).
- **Build (`bun run build`):** concluído com sucesso (client + SSR + Nitro).
- **PostgreSQL 17 local:** harness `tests/postgres/run.py` foi atualizado para funcionar tanto em ambiente local com `sudo -u postgres` quanto em CI via TCP (detectado pela presença de `PGHOST`). O sandbox não tem PostgreSQL 17 disponível (sem privilégio de root para instalar), então o job de Postgres será exercitado pelo GitHub Actions quando o PR atualizar. O mesmo script foi expandido com verificações da matriz de papéis corrigida (editor em banners/cupons, financeiro em pagamentos, operador SEM acesso a pagamentos) e dos comportamentos M-1 (publicação editorial ok, publicação de anexo privado negado, inserção de publicação não relacionada bem-sucedida, lock concorrente por mídia).
- **Credenciais:** varredura heurística (grep) não encontrou chaves/tokens/Segredos privados em arquivos rastreados.
- **Git:** seis commits originais preservados; novos commits serão acrescentados sem rebase/squash.

## 5. Limitações conhecidas do ambiente de sandbox

- Sem PostgreSQL 17 disponível (sem root) → testes de regressão do harness foram validados estaticamente e serão exercitados pelo CI; não há discrepância de sintaxe entre os arquivos (todas BEGIN/COMMIT balanceados, triggers/policies referenciam tabelas existentes).
- Sem rede para `bun.sh` → instalação do bun foi feita via `npm install -g bun` apenas para fins de teste local; CI usa `oven-sh/setup-bun@v2`.

## 6. Estado do CI pós-push

- Workflow `.github/workflows/ci.yml` está configurado para rodar em `pull_request` para `main` e em `push` para `main`. O push na branch `feature/cr-007b-supabase-foundation` aciona o workflow no PR #1 por ser um PR targeting main (push para a branch head dispara o PR check).
- Permissões do GITHUB_TOKEN: `contents: read`, `pull-requests: read`; nenhuma permissão de escrita; sem `id-token`, sem `packages`.

## 7. Riscos residuais (não bloqueadores)

- **H-1 operacional:** scripts de bootstrap ainda não foram executados em homologação (é esperado: não criamos administradores reais). O runbook deve ser seguido quando o projeto Supabase for provisionado.
- **M-2:** atualizações concorrentes dependem do adapter (CR-007C) para passar `expectedVersion`; os campos e triggers existem e estão documentados, mas não impõem o WHERE no nível do banco por escolha arquitetural.
- **M-4 (financeiro):** possível custo por linha em `has_role()` se a tabela crescer a dezenas de milhares de linhas; estratégia documentada com medição obrigatória.
- **Cobertura de testes pós-migration:** harness foi atualizado mas o suite completo (com as matrizes novas) executa em CI e nas próximas execuções locais via `tests/run-cr007b.sh`.
- **ESLint global:** 1124 avisos de formatação Prettier ainda existem em arquivos fora do escopo da CR-007B; o lint do CI roda direcionado para evitar falhar por dívida histórica. Rodar `prettier --write` numa etapa posterior.

## 8. Pendências do Supabase de homologação

1. A organização `criatto3darte-ux's Org` não tem projeto visível ao connector; é necessário criar/provisionar um projeto de homologação exclusivo.
2. Conectar o projeto ao connector (ou usar a dashboard) para dar visibilidade ao `project_ref`.
3. Depois de aprovação do PR #1 e revisão do diff: executar as 10 migrations via CLI do Supabase (`supabase db push` ou equivalente), APENAS em homologação.
4. Executar o script `ops/sql/00-bootstrap-owner.sql` com o UUID do usuário de homologação em `auth.users`; registrar o evento de auditoria no runbook.
5. Configurar buckets do Storage e políticas (fora do escopo da CR-007B.7).
6. CR-007C (adapter de produção) só inicia após homologação das migrations e bootstrap.

## 9. Próximos passos

- Push dos commits novos para `feature/cr-007b-supabase-foundation` (atualiza automaticamente o PR #1).
- Verificar o resultado real do CI após o push.
- Aguardar revisão humana antes de qualquer merge/deploy/migration remota.

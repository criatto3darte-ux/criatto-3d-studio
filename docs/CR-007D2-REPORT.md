# CR-007D.2 — Correção do processo de migrations e preparação da reconciliação

**Projeto:** criatto3d-homolog (`ugwuxczcqlrdjkpjsdqb`, sa-east-1, PG 17.11, free, healthy)
**Branch:** `feature/cr-007b-supabase-foundation`
**Base aprovada:** `b53ac36cfa07c116582442b01f0c772f9fd29902`
**Novo HEAD (deste CR):** `8cb245cbbcc6370482c711418406137618a61136`
**Data:** 2026-11-13 (UTC)

---

## 1. Causa-raiz confirmada

Na CR-007D, a aplicação remota da migration 0006 falhou com
`ERROR: 42704: type "public.discount_kind" does not exist`.

Após a auditoria integral da CR-007D.1 e a confirmação física dos arquivos
neste CR, a causa-raiz é inequívoca:

- A migration commitada em 0006 (`20261113120600_cr007b_coupons_requests.sql`)
  **não usa** `public.discount_kind` nem qualquer outro ENUM novo. O campo
  `coupons.kind` é `varchar(20) CHECK(kind IN ('percentual','fixo'))`.
- As tabelas `contact_requests`/`whatsapp_delivery_log` e seus ENUMs
  associados **não existem** no conjunto 0001–0010.
- O corpo SQL enviado ao Supabase foi **reconstruído manualmente pelo
  executor** (com base num rascunho incorreto de modelagem) em vez de ser
  lido e enviado verbatim do arquivo versionado. Os ENUMs que geraram o
  erro (`discount_kind`, `coupon_status`, `contact_request_status`,
  `whatsapp_delivery_status`) e as tabelas inventadas (`contact_requests`,
  `whatsapp_delivery_log`) apareceram apenas naquele corpo reconstituído.

A falha, portanto, foi **operacional do executor**, não um defeito do
schema. As migrations 0001–0010 estão corretas e aplicam-se em PG17 limpo
sem alterações.

## 2. Correções implementadas

### 2.1 Migration espúria removida

A migration `20261113120550_cr007d_missing_enum_types.sql` criada na
CR-007D.1 foi **removida** (sua única finalidade seria validar/criar ENUMs
que o schema efetivamente não usa). As 10 migrations originais
permanecem **byte-idênticas** ao commit base `b53ac36` (ver §3.1).

### 2.2 Harness seguro de aplicação (`scripts/apply_migrations_safe.py`)

Novo harness local que implementa o contrato obrigatório para qualquer
aplicação de migrations (local, CI ou — por extensão — remoto):

1. **Leitura verbatim**: cada migration é lida como bytes com
   `path.read_bytes()` e enviada ao Postgres sem reescrever, interpolar
   ou resumir. Nenhum SQL é "montado" manualmente.
2. **Trava de SHA-256 aprovado**: antes de conectar em qualquer banco,
   cada arquivo é confrontado com o hash Git do commit aprovado
   (`b53ac36…`). Uma divergência aborta **antes** de qualquer execução.
3. **Aplicação sequencial** em ordem lexicográfica por timestamp.
4. **Falha no primeiro erro** (psycopg lança; o script sai com código 1
   sem continuar para a próxima migration).
5. **Fingerprint estrutural** (tabelas, colunas, constraints, índices,
   policies, triggers, views, funções, grants) serializado em JSON para
   comparação determinística.
6. **Cenários**:
   - *clean-rebuild* (0001–0010 do zero, 2 iterações com fingerprint
     comparado para provar idempotência).
   - *resume* (pré-aplica 0001–0005, depois 0006–0010) espelhando o
     estado real do homolog.
7. **Saída de evidência** em `docs/evidence/cr007d2-local-pg.json`.

### 2.3 Reforço no CI de PostgreSQL 17 (`tests/postgres/run.py`)

O job `postgres-local` já aplicava migrations reais contra `postgres:17`,
mas faltavam duas travas que teriam evitado a recidiva do erro da CR-007D:

1. **Trava de SHA-256** (`APPROVED_MIGRATION_SHA256`) com verificação
   obrigatória antes de qualquer `psql`. Um arquivo alterado, um stub
   acidental ou uma reconstrução manual geram `MIGRATION TAMPERED` com
   `exit 3` imediato, sem tocar o banco.
2. **Glob ampliado** de `*_cr007b_*.sql` para `*_cr007*.sql`, preparando
   o terreno para migrations incrementais futuras (cr007d/cr007e/…).
3. **Cenário de retomada** no próprio CI (pré-aplica 0001–0005, aplica
   0006–0010, compara o fingerprint estrutural com o rebuild limpo).
4. **Verificação de idempotência**: dois rebuilds limpos devem produzir
   o mesmo fingerprint — qualquer não-determinismo (por ex. função VOLATILE
   indevida) falha o pipeline.

### 2.4 Preservação das 10 migrations originais

Nenhum byte dos arquivos 0001–0010 foi alterado. Hashes SHA-256 confirmados
contra o commit base (ver §3.1).

## 3. Testes em PostgreSQL real

### 3.1 Verificação de integridade das migrations (local)

```
HASH 20261113120100_cr007b_identity.sql        6185d0f3… (2870 B)  (matches approved)
HASH 20261113120200_cr007b_catalog.sql         d9cb3123… (9003 B)  (matches approved)
HASH 20261113120300_cr007b_media.sql           a644c6a3… (4078 B)  (matches approved)
HASH 20261113120400_cr007b_orders.sql          9583c1c1… (7406 B)  (matches approved)
HASH 20261113120500_cr007b_inventory.sql       979fe4ba… (3794 B)  (matches approved)
HASH 20261113120600_cr007b_coupons_requests.sql d6ec0dd8… (6496 B) (matches approved)
HASH 20261113120700_cr007b_content_audit.sql   741093f9… (4988 B)  (matches approved)
HASH 20261113120800_cr007b_access_invariants.sql de9f7e5e… (12690 B)(matches approved)
HASH 20261113120900_cr007b_media_privilege_hardening.sql 683ffe93… (1699 B) (matches approved)
HASH 20261113121000_cr007b7_private_media_and_role_matrix.sql e22fdd13… (8019 B) (matches approved)
```

Teste de violação proposital (adicionada linha `-- tampered` em 0006):

```
SHA-256 MISMATCH for 20261113120600_cr007b_coupons_requests.sql:
local=7d1355ad… approved=d6ec0dd8…
Refusing to apply; aborting before any database work.
```

→ A trava dispara **antes** de qualquer conexão ao banco.

### 3.2 Rebuild limpo (Postgres embutido via pgserver — PG16; CI usa PG17)

```
OK 20261113120100_cr007b_identity.sql
OK 20261113120200_cr007b_catalog.sql
OK 20261113120300_cr007b_media.sql
OK 20261113120400_cr007b_orders.sql
OK 20261113120500_cr007b_inventory.sql
OK 20261113120600_cr007b_coupons_requests.sql
OK 20261113120700_cr007b_content_audit.sql
OK 20261113120800_cr007b_access_invariants.sql
OK 20261113120900_cr007b_media_privilege_hardening.sql
OK 20261113121000_cr007b7_private_media_and_role_matrix.sql
```

Shape final após as 10 migrations (idêntico em 2 rebuilds consecutivos):

| Objeto | Quantidade |
|---|---|
| Tabelas base (`relkind=r`) | **27** |
| Views públicas (`public_*` + `finance_order_summary`) | **12** |
| Sequências (`orders_number_seq`) | 1 |
| ENUMs | 4 (`admin_role`, `order_status`, `production_mode`, `request_status`) |
| Funções | 12 (5 `SECURITY DEFINER`, todas com `search_path=public, pg_temp`) |
| Policies RLS | 40 |
| Triggers | 51 (incluindo `immutable_event`, `version_stamp`, `valid_variant`, `last_*_owner`, `private_attachment`, `payment_order`, `allocation_bounds`, `settings_links`) |
| Constraints (pk/fk/unique/check) | 184 (19 PK + 19 UNIQUE + 31 FK + 115 CHECK) |
| Índices | 99 |
| RLS + FORCE ROW LEVEL SECURITY | **ON** em todas as 27 tabelas |
| Grants para `anon` em tabelas base | **0** (anon só lê views `public_*`) |

### 3.3 Cenário de retomada (espelhando homolog com 0001–0005 aplicados)

```
pre-applied 0001..0005 (19 tables)
OK 0006..0010 applied in order
→ fingerprint == clean-rebuild fingerprint
```

Comparação do fingerprint (colunas + constraints + índices + policies +
triggers + views): **byte-idêntico** ao rebuild limpo. Isto prova que a
sequência 0006–0010 pode ser aplicada de forma segura sobre um banco em
que 0001–0005 já foram fisicamente aplicadas.

### 3.4 Cobertura esperada em PG17 (CI)

O job `postgres-local` do CI corre contra `postgres:17` e, além de todas
as asserções já existentes (~150 testes de RLS, matriz de papéis,
invariantes, mídia privada, concorrência de último proprietário, URLs
seguras, etc.), agora executa também o cenário de retomada descrito em
§3.3. **Resultado do CI** será registrado após o push (§5).

## 4. Auditoria remota (somente leitura) vs. banco descartável

O estado do banco homolog foi consultado apenas via queries `SELECT`. Nenhuma
migration foi aplicada nem nenhum registro foi alterado.

### 4.1 Histórico de migrations

- `supabase.list_migrations(ugwuxczcqlrdjkpjsdqb)` → `{"items": []}`.
- Motivo: a aplicação direta via `execute_query` (CR-007D) não registra
  entradas em `supabase_migrations.schema_migrations`; isso exige
  reconciliação antes de `supabase db push` (ver §6.1).

### 4.2 Inventário estrutural após 0001–0005 (remoto)

| Indicador | Remoto (homolog) | Local (pgserver, 0001–0005) | Equiv? |
|---|---|---|---|
| ENUMs `public.*` | 4 (`admin_role`, `order_status`, `production_mode`, `request_status`) | 4 (mesmos valores) | ✅ |
| Tabelas base | **19** | **19** | ✅ |
| Colunas por tabela | Concatenando `table_name:column_name:data_type`, mesma lista em ambos | mesmo conjunto | ✅ |
| Funções `public.*` | 1 (`has_role`, SECURITY DEFINER, `search_path=public, pg_temp`) | 1 (`has_role`, idêntica) | ✅ |
| Policies | **29** (1 por tabela + `finance_read` em `payments`) | 29 | ✅ |
| `FORCE ROW LEVEL SECURITY` em todas as tabelas | **true** (19/19) | true | ✅ |
| Índices | **71** | 71 | ✅ |
| Constraints | 127 (58 CHECK + 31 FK + 19 PK + 19 UNIQUE) | 127 (mesma distribuição) | ✅ |
| Triggers (não-internos) | **0** (triggers de 0008 ainda não foram aplicados) | 0 | ✅ |
| Grants do papel `anon` em tabelas base | **0** | 0 | ✅ |
| Funções SECURITY DEFINER com `search_path` seguro | 1/1 (`has_role`) | 1/1 | ✅ |
| Execução de funções SECURITY DEFINER por `anon` | 0 | 0 (assert do CI) | ✅ |

### 4.3 Schemas padrão do Supabase — diferenças esperadas

Os objetos padrão do Supabase (schemas `auth`, `storage`, `extensions`,
`graphql_public`, `realtime`, etc.; roles `authenticator`,
`supabase_auth_admin`, `supabase_storage_admin`, etc.; extensões
`pgcrypto`, `pg_stat_statements`, `uuid-ossp` etc.; functions de auth/RLS
em `auth.*` e `supabase_functions.*`) existem apenas no projeto remoto.
Eles **não são criados** pelas nossas migrations e o harness local não
tenta reproduzi-los (é suficiente que o bootstrap local exponha
`auth.users(id)` e o role `anon`/`authenticated`/`service_role` como
destino de FK e REVOKE/GRANT, como já acontece). Toda divergência entre
banco local e remoto em schemas diferentes de `public` está dentro desse
conjunto esperado e não requer correção.

### 4.4 Conclusão da auditoria

O schema `public` do homolog **é exatamente** o que as 5 migrations
0001–0005 produzem num banco limpo. Não há objetos "órfãos", faltantes ou
modificados. A equivalência estrutural está comprovada, autorizando o
`migration repair` descrito no §6.1 (que só deve ser executado com sua
autorização explícita na próxima etapa).

## 5. GitHub / PR #1

Alterações commitadas/pushed para a branch `feature/cr-007b-supabase-foundation`
(um único commit em cima de `b53ac36`):

- `scripts/apply_migrations_safe.py` (novo)
- `scripts/supabase-bootstrap.sql` (novo)
- `tests/postgres/run.py` (adiciona hash-lock, cenário de retomada, glob `*_cr007*`)
- `.gitignore` (ignora `.pgdata-*/`, `.venv*/`, `.tools/`)
- `docs/CR-007D2-REPORT.md` (este documento)
- `docs/evidence/cr007d2-local-pg.json` (evidência do harness local)

Migrations 0001–0010 **sem alterações**.

### 5.1 Resultado do CI

Após o push do commit `ec3387d`, o PR #1 reporta **2/2 checks passando**:

| Job | Status | Duração | Log |
|---|---|---|---|
| `static` (bun install --frozen-lockfile / tsc --noEmit / vitest / vite build / ESLint direcionado / credential scan) | ✅ **pass** | 20s | [runs/43537574486/job/132270186436](https://github.com/criatto3darte-ux/criatto-3d-studio/actions/runs/43537574486/job/132270186436) |
| `postgres-local` (postgres:17, hash-lock, 2 rebuilds limpos + cenário de retomada + ~155 asserts de RLS/privilégios/mídia privada/matriz de papéis) | ✅ **pass** | 28s | [runs/43537574486/job/132270186810](https://github.com/criatto3darte-ux/criatto-3d-studio/actions/runs/43537574486/job/132270186810) |

Novo HEAD: `8cb245cbbcc6370482c711418406137618a61136`.

## 6. Plano de retomada (PREPARADO, NÃO EXECUTADO)

Todas as ações abaixo são descritas como procedimento; **nenhuma** foi
executada contra o Supabase remoto neste CR.

### 6.1 Reconciliação de histórico (executar SOMENTE após sua autorização)

Pré-condição: equivalência estrutural de 0001–0005 já comprovada (§4).

```bash
supabase link --project-ref ugwuxczcqlrdjkpjsdqb
# Marca 0001..0005 como aplicadas no histórico do Supabase.
# Isto é reconciliação (divergência comprovada), não alteração de schema.
for v in 20261113120100 20261113120200 20261113120300 \
         20261113120400 20261113120500; do
  supabase migration repair --status applied "$v"
done
supabase migration list   # deve mostrar 5 linhas
```

### 6.2 Dry-run / Aplicação de 0006–0010

- **Não** usar `--include-all` (isso tentaria reaplicar 0001–0005 e
  falharia com "relation already exists").
- Aplicar estritamente na ordem lexicográfica, usando o contrato de
  §2.2 (ler bytes → verificar SHA-256 → enviar bytes → checar erro):

  ```bash
  supabase db push    # CLI respeita o histórico e só aplica 0006..0010
  ```

  Alternativa driver-direta (usada na CR-007D mas com as novas travas):
  para cada arquivo em 0006..0010:
  1. `sha256sum` vs `APPROVED_MIGRATION_SHA256`; aborta se divergir.
  2. Envia o conteúdo lido do disco **verbatim** via
     `supabase.execute_query`.
  3. Para na primeira falha e não executa rollback automático
     (a migration já tem seu próprio BEGIN/COMMIT e faz rollback no
     erro).

### 6.3 Interrupção no primeiro erro

- Se qualquer migration retornar erro, interromper imediatamente.
- Coletar: SQLSTATE, mensagem, contexto, nome da migration.
- Não recriar projeto, não editar migrations já aplicadas, não rodar
  `migration repair` adicional, não continuar para a próxima migration.
- Apresentar diagnóstico e aguardar decisão do usuário.

### 6.4 Checklist pós-aplicação (somente leitura)

Executar após o sucesso de 0006–0010:

1. `supabase migration list` → 10 entradas (0001..0010, em ordem).
2. Contagens no `public`:
   - 27 tabelas base, 12 views, 1 sequência.
   - RLS + FORCE ROW LEVEL SECURITY em todas as tabelas.
   - 0 grants de `anon` em tabelas base.
3. Funções SECURITY DEFINER: 5 (a partir de 0008–0010), todas com
   `search_path=public, pg_temp`; 0 grants de execução para `anon`.
4. Triggers: `immutable_event` (+truncate) em 6 tabelas append-only;
   `version_stamp` em 12 tabelas mutáveis; `valid_variant` (DEFERRABLE)
   em catálogo; `last_profile_owner`/`last_role_owner`;
   `private_attachment` (per-row, AFTER); `settings_links`;
   `payment_order`; `allocation_bounds`; `no_profile_truncate`/
   `no_role_truncate`.
5. Policies: 40, cobrindo a matriz de papéis (proprietário/editor/
   operador/financeiro) e o fechamento de mídia privada.
6. Views `public_*` e `finance_order_summary` acessíveis por anon/
   authenticated conforme projetado.
7. Comparação do fingerprint remoto com o fingerprint local de
   `docs/evidence/cr007d2-local-pg.json` (chaves `tables`, `constraints`,
   `indexes`, `policies`, `triggers`) — divergências só esperadas nos
   schemas padrão do Supabase.

Se tudo passar, a CR-007D conclui com relatório final; aguardar
autorização antes dos testes de autenticação/owner bootstrap/criação de
buckets (que continuam proibidos nesta etapa).

## 7. Proibições respeitadas em CR-007D.2

- ✅ SQL mutante remoto **não** executado (só queries SELECT de inventário).
- ✅ `migration repair` **não** executado no remoto (apenas descrito no §6).
- ✅ 0006–0010 **não** aplicados no remoto.
- ✅ Usuários admin **não** criados.
- ✅ Buckets **não** criados.
- ✅ `main` intacta; todo trabalho em `feature/cr-007b-supabase-foundation`.
- ✅ PR #1 não foi mergeado.
- ✅ Loja não conectada, não publicada, CR-007C não iniciada.
- ✅ Nenhuma migration 0001–0010 foi editada.

---

*Próximo passo (requer autorização): execututar o §6.1–§6.3 para concluir
a CR-007D no homolog, então voltar com o relatório final e o estado do CI.*

# CR-009C — Preparação da ativação segura do Supabase (runbook de operação)

**Branch:** `integration/cr-009b-supabase-infra` (PR #6 já aberto)
**Projeto:** `ugwuxczcqlrdjkpjsdqb` — `criatto3d-homolog` (sa-east-1, Postgres 17.11)
**Data:** 2026-11-15
**Estado:** Runbook PRONTO. Aguardando APROVAÇÃO EXPLÍCITA antes de qualquer operação de escrita remota.
**Restrições nesta CR:** nenhuma operação de escrita foi executada no remoto (sem aplicar migration, sem ativar hook, sem configurar Auth, sem convidar proprietário, sem bootstrap).

---

## 1. Confirmação de identidade e pré-condições

| Item | Valor confirmado |
|---|---|
| Projeto Ref | `ugwuxczcqlrdjkpjsdqb` |
| Nome | `criatto3d-homolog` |
| Região | `sa-east-1` (São Paulo) |
| Status | `ACTIVE_HEALTHY` |
| Host DB | `db.ugwuxczcqlrdjkpjsdqb.supabase.co` |
| Postgres | 17.11.0.019 (GA) |
| Organização | `akifnzwtxnmjxvaljjro` |
| Migrations aplicadas | 0001–0010 (10 migrations) |
| Migration pendente | **0011** — `20261114133000_cr008c_jwt_claims_and_aal.sql` |
| Usuários cadastrados | **0** |
| Buckets Storage | **0** |
| Auth.signup | `disable_signup = true` ✅ |
| Auth.mailer_autoconfirm | `false` ✅ |
| Auth.MFA TOTP | enroll/verify habilitados ✅ |
| Custom Access Token Hook | **desabilitado** (como esperado antes da ativação) |

### 1.1 SHA-256 da migration 0011 (comparação)
- SHA-256 local: `d6809d7011b8fa973d6322520e68343011dd54943a75b389ba168d35df1a9cbe`
- Hash no `APPROVED_MIGRATION_SHA256` do harness CI: **idêntico** (mesmo valor).
- Tamanho: 227 linhas / ~7 KB.
- **A migration NÃO contém DROP TABLE, DELETE/UPDATE de dados, TRUNCATE, DROP EXTENSION, DROP TYPE, DROP ROLE ou DROP DATABASE.** Análise estática (grep): 0 hits para esses padrões destrutivos.

### 1.2 Backup recuperável
O Supabase Free Tier faz backup automático diário (`pg_dump` gerenciado pela plataforma) com retenção curta; PITR (point-in-time recovery) está disponível apenas no plano Pro. Antes da ativação:
1. **Ponto de recuperação automática:** como o projeto tem 0 usuários e 0 dados comerciais, o "backup" mais limpo é o próprio estado atual (só migrations 0001–0010 + schema + 0 dados). Se algo der errado a janela de risco é mínima.
2. **Backup lógico manual (recomendado antes de aplicar a 0011):** em Database → Backups, tomar um snapshot manual ("Create a new backup"). Se o plano não tiver snapshots manuais, fazer um dump lógico via SQL Editor (service_role) guardando os DDLs principais.
3. **Snapshot capturado pelo precheck:** `docs/sql/01-precheck-capture-state.sql` captura todas as policies administrativas antes da alteração — esse resultado é o insumo para rollback preciso.

---

## 2. Migration exata a ser executada

**Arquivo:** `supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql`
**Conteúdo (alto nível):**
1. `CREATE OR REPLACE FUNCTION public.my_roles() RETURNS text[] SECURITY DEFINER` — RPC que retorna as roles ativas do usuário autenticado.
2. `CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb SECURITY DEFINER` — injeta `roles`, `email_verified` no JWT emitido pelo GoTrue, preservando a claim `aal`.
3. `CREATE OR REPLACE FUNCTION public.require_aal2() RETURNS boolean SECURITY INVOKER` — helper que retorna `(aal claims == 'aal2')`.
4. Laço `DO $$` que faz DROP/RECREATE das policies administrativas selecionadas adicionando `AND public.require_aal2()` no USING/WITH CHECK.
5. Re-emite grants de SELECT/INSERT/UPDATE/DELETE a `authenticated` nas tabelas administrativas (idempotente).

### 2.1 Funções afetadas (criadas/substituídas)
| Função | Tipo | Executável por |
|---|---|---|
| `public.my_roles()` | SECURITY DEFINER | authenticated, service_role |
| `public.custom_access_token_hook(jsonb)` | SECURITY DEFINER | **service_role, supabase_auth_admin** (negado a anon/authenticated) |
| `public.require_aal2()` | SECURITY INVOKER | authenticated, service_role |

### 2.2 Policies afetadas
A migration DROPa e RECRIA as policies: `admin_read`, `admin_write`, `coupon_rw`, `coupon_read_operador`, `coupon_editor`, `banner_rw`, `banner_editor`, `payments_owner`, `payments_finance`, `finance_read`, `settings_owner`, `own_profile`, `own_roles` — quando existirem — em 23 tabelas administrativas. Após recriação, todas exigem `AND public.require_aal2()`.

**Policies PÚBLICAS (catálogo)** não são tocadas — `public_read` de `products`, `categories`, `banners`, `public_product_images`, `public_availability`, etc., permanecem como estão.

### 2.3 O que a migration NÃO faz
- ❌ Não apaga nenhuma tabela, coluna, dado comercial, pedido, produto ou mídia.
- ❌ Não cria usuários.
- ❌ Não cria buckets.
- ❌ Não altera `site_url`, `redirect URLs`, JWT expiry ou configurações de Auth.
- ❌ Não ativa o hook (ativação é manual no painel).
- ❌ Não modifica a chave anon ou service_role.

---

## 3. Checklist PRÉ-aplicação (executar na ordem)

Todos os passos a seguir são **leitura/preparação**.

- [ ] Confirmar que está logado no painel do projeto correto: `criatto3d-homolog` (`ugwuxczcqlrdjkpjsdqb`), não o de produção (que ainda não existe).
- [ ] Criar backup snapshot em Database → Backups → "Create new backup" (se disponível no plano) **antes** de qualquer operação de escrita.
- [ ] Abrir o SQL Editor em uma janela limpa.
- [ ] Executar `docs/sql/01-precheck-capture-state.sql` (SOMENTE LEITURA) e **salvar todo o output** (bloco de "policy_ddl") em um arquivo local (`precheck-policies-YYYYMMDD.sql`).
- [ ] No output, confirmar:
  - [ ] Migrations 0001–0010 aparecem; 0011 NÃO aparece.
  - [ ] Funções existentes: `has_role`, `check_private_media`, `check_variant_integrity`, `editor_can_read_media`, `protect_last_owner`; funções `my_roles`, `custom_access_token_hook`, `require_aal2` NÃO existem ainda.
  - [ ] Role `supabase_auth_admin` existe (criada pelo Supabase Auth).
  - [ ] O campo de Auth.config retorna uma linha (irá mostrar `site_url=http://localhost:3000`, `uri_allow_list=""`).
- [ ] Abrir um segundo editor/aba com o conteúdo da migration 0011 (`supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql`) para aplicar em seguida.
- [ ] Manter o runbook de rollback (`docs/sql/03-rollback-cr008c-aal.sql`) acessível em outra aba para usar se necessário.
- [ ] **Haver pelo menos 30 minutos disponíveis** para aplicar, verificar e, se necessário, rollar back (sem interrupção).

---

## 4. Procedimento de execução (requer APROVAÇÃO)

A sequência completa é:

### Passo 1 — Aplicar a migration
No SQL Editor (service_role, conexão ao banco postgres):
1. Colar o conteúdo de `supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql`.
2. Clicar **Run**.
3. Confirmar que não houve erros.

### Passo 2 — Verificar pós-migration (02-postcheck)
1. Executar `docs/sql/02-postcheck-verify.sql`.
2. Validar os resultados esperados (comentados no script):
   - **Funções:** `my_roles` e `custom_access_token_hook` têm `prosecdef=true`; `require_aal2` tem `prosecdef=false`; grants conforme §2.1.
   - **Policies:** todas as policies administrativas contêm `require_aal2()` em `qual`.
   - **Contagem de tabelas RLS/FORCE:** 27 (não foi apagada nenhuma).
   - **Teste SET LOCAL:** `require_aal2()` retorna `false` com claim `aal=aal1`, `true` com `aal=aal2`.

### Passo 3 — Garantir grants para `supabase_auth_admin`
Já estão embutidos na migration (`GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO service_role, supabase_auth_admin`). O postcheck confere; se por acaso `auth_admin_exec` estiver `false`, rodar:
```sql
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
```

### Passo 4 — Ativar o Custom Access Token Hook no painel
1. Ir para Authentication → Hooks → **Custom Access Token Hook**.
2. Clicar **Enable Hook**.
3. Em "Hook type" selecionar **Postgres (database function)** (ou "Database function" conforme versão do painel).
4. Selecionar a função `public.custom_access_token_hook`.
5. Salvar.
6. Teste: chamar manualmente a função com um evento sintético para garantir que não gera erro:
   ```sql
   SELECT public.custom_access_token_hook('{"claims":{"sub":"00000000-0000-0000-0000-000000000001","aal":"aal1","email":"x@y.z","email_confirmed_at":"2026-01-01"}}'::jsonb);
   ```
   Deve retornar um jsonb com `claims.roles = []` e `claims.aal = 'aal1'`.

### Passo 5 — Configurar Auth URL Configuration
No painel Authentication → URL Configuration:
- **Site URL (produção/homolog):** como ainda NÃO há host HTTPS próprio para homolog neste momento (a Locaweb só serve a loja estática em `criatto3d.art.br`, que não tem back-end), ajustar temporariamente para:
  - `http://localhost:5173` (desenvolvimento local), OU
  - um host de homolog HTTPS (ex.: `https://homolog.criatto3d.art.br`) **quando estiver provisionado**.
- **Redirect URLs** (uma por linha), INCLUINDO `/auth/callback`:
  ```
  http://localhost:5173/auth/callback
  https://criatto3d.art.br/auth/callback
  ```
  Adicionar `https://homolog.criatto3d.art.br/auth/callback` quando existir.
- **Exponential retry / rate limits** manter padrão.
- Salvar.

> ⚠️ Pendência HTTPS: o callback precisa de uma origem HTTPS acessível para que o convite por e-mail funcione em produção. Para homologação/desenvolvimento local o `http://localhost:5173/auth/callback` é suficiente (o Supabase aceita `http://localhost` em redirects). O convite para Paulo Roberto só deve ser enviado **após** a origem de produção/homolog HTTPS estar cadastrada (ver seção 7).

### Passo 6 — Validar JWT real emitido pelo GoTrue
A validação real de JWT só é possível depois de criar um usuário de teste (ou o primeiro proprietário). Após o convite de teste, obter um access_token e decodificar:
1. Login via email+senha (AAL1): decodificar o JWT — deve ter `aal: 'aal1'` e `roles: []` (sem MFA).
2. Após `mfa.challengeAndVerify` com TOTP: novo JWT deve ter `aal: 'aal2'` e `roles: ['proprietario']` (ou role do usuário).
3. Se `roles` estiver ausente, o hook não está sendo invocado ou há erro na função. Verificar Auth → Logs e a mensagem de erro retornada.

### Passo 7 — Testes remotos AAL1/AAL2 (após bootstrap do proprietário)
Depois do primeiro login (fora do escopo desta CR, será CR-009D1 — convite do proprietário):
- [ ] Login com e-mail+senha (AAL1) → tentativa de `SELECT * FROM orders` via authenticated → **negado** (RLS bloqueia).
- [ ] Após MFA TOTP (AAL2) → `SELECT * FROM orders` retorna linhas do sistema (0 no início, sem erro de permissão).
- [ ] Editor (quando criado) consegue ver produtos/cupons/banners mas NÃO payments.
- [ ] Financeiro consegue ver payments mas NÃO orders.
- [ ] Operador consegue ver orders/customers mas NÃO payments/coupons.
- [ ] Usuário anônimo (anon key) não consegue SELECT de tabelas administrativas.

---

## 5. Plano de recuperação (rollback)

Se a aplicação da migration causar erro em cascata (ex. GoTrue passa a falhar em todos os logins, retorno 500 em queries administrativas, etc.):

1. **NÃO ENTRE EM PÂNICO.** Como há 0 usuários e 0 dados comerciais, o impacto operacional é zero.
2. **Desative imediatamente o Custom Access Token Hook** no painel (se já tiver sido ativado): Auth → Hooks → Custom Access Token → Disable. Isso faz com que o GoTrue volte a emitir JWTs sem a chamada para a função.
3. Execute o script `docs/sql/03-rollback-cr008c-aal.sql` até a seção 4. Isso:
   - Dropa as 3 funções da 0011.
   - Revoga os INSERT/UPDATE/DELETE extra de `authenticated` (SELECT permanece como antes).
   - Dropa todas as policies que contêm `require_aal2()`.
4. Depois do DROP das policies, cole **uma por uma** os statements `CREATE POLICY` originais que você salvou no Passo 4 do precheck (coluna `policy_ddl` do output). Restaura o estado exato pré-0011.
5. COMMIT.
6. Verifique com a query final do rollback: as policies listadas NÃO devem mais conter `require_aal2`.
7. Se o erro persistir (e.g. login não funciona mesmo após rollback), crie um ticket com o suporte do Supabase e informe a hora da alteração para recuperar do backup diário.

O tempo estimado de rollback é < 10 minutos, contando colagem das policies originais.

---

## 6. Critérios de sucesso (pós-ativação)

- [ ] Migration 0011 aplica sem erros.
- [ ] `my_roles()`, `custom_access_token_hook()`, `require_aal2()` existem com os grants corretos.
- [ ] Todas as 27 tabelas ainda têm RLS+FORCE RLS.
- [ ] Policies administrativas contêm `require_aal2()`.
- [ ] Função `custom_access_token_hook(jsonb)` executada manualmente retorna JSON válido com `claims.roles` e `claims.aal`.
- [ ] Hook ativado no painel (Auth → Hooks mostra "Enabled").
- [ ] Auth URL Configuration tem pelo menos `http://localhost:5173/auth/callback` (desenvolvimento) + origem HTTPS de homologação.
- [ ] Loja pública (`https://criatto3d.art.br`) continua funcionando normalmente (vitrine, busca, carrinho, WhatsApp, temas — ela não usa Supabase em runtime).

### Testes com o proprietário (a fazer APÓS convite — CR futura)
- [ ] Convite por e-mail chega e link `/auth/callback?code=...` troca por sessão.
- [ ] Definição de senha funciona.
- [ ] Matrícula TOTP (QR + código de 6 dígitos) eleva para AAL2.
- [ ] `/admin` é liberado com AAL2+role.
- [ ] Logout + novo login mantém roles no JWT.

---

## 7. Pendências de HTTPS/redirects (bloqueia o convite ao proprietário)

| Item | Status | Bloqueia? |
|---|---|---|
| `http://localhost:5173/auth/callback` para desenvolvimento | Disponível imediatamente (após `bun run dev`). | Não, para dev local. |
| Origem HTTPS para homologação/admin | **NÃO EXISTE AINDA** (`criatto3d.art.br` serve apenas a loja estática; o admin não é servido por lá). | **Bloqueia** o convite para produção/homolog. Opções: (a) deploy do painel em subdomínio `admin.criatto3d.art.br` na Locaweb com HTTPS; (b) usar um preview/Vercel temporário; (c) usar `http://localhost` temporariamente para o primeiro bootstrap via `bun run dev` com ANON_KEY configurada. |
| `https://criatto3d.art.br/auth/callback` | Pode ser cadastrado para quando o build com Supabase ativado for publicado. | Não bloqueia bootstrap local. |

**Recomendação imediata para CR-009C (bootstrap inicial):** usar `http://localhost:5173/auth/callback` para o primeiro convite, executando o frontend localmente com `cp .env.homolog.example .env.local` + preencher a ANON_KEY. Paulo Roberto receberia o convite com link `http://localhost:5173/auth/callback?code=...` e clicaria a partir da máquina onde o dev server está rodando. Isso é válido para teste inicial; o domínio de produção HTTPS deve ser configurado antes de qualquer convite "para valer".

---

## 8. Ponto de APROVAÇÃO

**Estou pronto para executar, mas NÃO executarei nenhuma das ações abaixo sem sua aprovação explícita por mensagem.**

Quando você disser **"APROVO CR-009C — pode aplicar a migration e ativar o hook"**, eu executarei nesta ordem:
1. Tomar snapshot de backup (se disponível).
2. Rodar o precheck e salvar output.
3. Aplicar a migration 0011 via SQL Editor.
4. Rodar o postcheck e verificar funções/grants/policies.
5. Ativar o Custom Access Token Hook no painel.
6. Configurar Auth URLs para `http://localhost:5173` + callback correspondente (bootstrap local).
7. Validar a função do hook com chamada sintética.
8. **NÃO** enviarei convite ao proprietário ainda — isso fica para uma próxima mensagem de aprovação explícita (e requer decisão sobre HTTPS).

Enquanto você não aprovar explicitamente, **tudo permanece como está**:
- Migrations remoto: 0001–0010.
- Hook: desabilitado.
- Auth config: `site_url=http://localhost:3000`, `uri_allow_list` vazio.
- 0 usuários, 0 convites.
- Loja pública inalterada.

---

## 9. Arquivos de apoio criados nesta CR

- `docs/sql/01-precheck-capture-state.sql` (86 linhas) — captura identidade, migrations, funções, roles, DDL das policies existentes, configuração Auth.
- `docs/sql/02-postcheck-verify.sql` (70 linhas) — verifica funções, grants, policies, simulações SET LOCAL e contagem de tabelas.
- `docs/sql/03-rollback-cr008c-aal.sql` (112 linhas) — drop de funções, revogação de grants extra, DROP de policies, instruções para recriar policies originais a partir do snapshot do precheck.
- `docs/CR-009C-REPORT.md` (este documento).

---

## Resumo rápido

- ✅ Identidade do projeto confirmada (`ugwuxczcqlrdjkpjsdqb`, sa-east-1, 0 usuários, 0 buckets).
- ✅ 10 migrations aplicadas; 0011 pendente.
- ✅ SHA-256 da 0011 confere com o pin do CI.
- ✅ Análise estática da migration confirmou ausência de comandos destrutivos de dados/tabelas.
- ✅ Scripts de precheck, postcheck e rollback prontos e revisados.
- ✅ Checklist de pré-aplicação, execução, rollback e critérios de sucesso detalhados.
- ✅ Pendência HTTPS documentada (bloqueia convite por domínio público, mas NÃO bloqueia bootstrap local via `http://localhost:5173`).
- 🛑 **Aguardando aprovação explícita** para aplicar migration 0011 + ativar hook + configurar URLs de homolog. Nenhuma ação de escrita remota executada nesta CR.

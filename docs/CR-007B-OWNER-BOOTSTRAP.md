# CRIATTO 3D — CR-007B.7 — Bootstrap do primeiro proprietário

Data: 13/11/2026. **Nenhum administrador real foi criado. Nenhuma migration foi aplicada remotamente.**

## 1. Princípios (H-1)

- **Nenhum endpoint público de bootstrap.** Não há RPC executável por `anon` ou `authenticated` que conceda papel de proprietário.
- **Nenhum segredo em migrations.** A migration 0010 (e todas as anteriores) não contém UuIDs, tokens, senhas ou emails de bootstrap.
- **Identidade pré-existente.** O usuário a ser promovido já deve existir em `auth.users` (criado pelo painel do Supabase ou por convite por email) e ter seu email verificado.
- **Execução administrativa exclusiva.** A concessão inicial roda com a role `postgres`/`service_role` via CLI do Supabase (`supabase db execute` ou SQL Editor autenticado da dashboard), nunca pela aplicação.
- **Idempotente e auditável.** A operação verifica que não existe nenhum proprietário ativo antes de prosseguir; cria perfil + papel em uma única transação; grava um evento em `admin_audit_events`; falha se houver corrida com outro bootstrap.
- **Recuperação de acesso.** Um segundo procedimento (`recover-owner`) permite repromover um usuário caso o último proprietário seja perdido, também executado apenas por `postgres`, com auditoria.

## 2. Pré-requisitos antes da execução

1. Projeto Supabase de homologação **exclusivo** provisionado.
2. Todas as migrations 0001–0010 aplicadas no banco de homologação (não produção).
3. Usuário inicial criado via Supabase Auth (email/senha ou magic link) com email verificado.
4. O executor tem acesso ao SQL Editor da dashboard ou ao `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` para usar a CLI com role `postgres`/`service_role`.
5. Operação executada em horário de janela; a conexão é TLS; nenhum log de terminal é compartilhado em canais públicos.

## 3. Script operacional

Arquivo: `ops/sql/00-bootstrap-owner.sql` (não aplicado automaticamente — executar sob demanda).

O script:

- Exige uma variável de sessão `cr007b.target_user_id` (UUID de `auth.users`).
- Exige `cr007b.actor_display_name` (nome humano do bootstrapper para auditoria).
- Dentro de uma transação com `pg_advisory_xact_lock(7007,2)` (mesmo lock de `protect_last_owner`) garante unicidade mesmo em execução concorrente.
- Falha (`raise_exception`) se já existir qualquer proprietário ativo.
- Insere em `admin_profiles` (ativo) e em `user_roles` (role=`proprietario`) em um único `INSERT ... WITH` para evitar estado intermediário.
- Registra `admin_audit_events` com `action='bootstrap.owner'` contendo o `target_user_id` mas sem credenciais.
- Retorna o ID do perfil criado e um carimbo de data/hora.

### Recuperação (perda do último proprietário)

Arquivo: `ops/sql/01-recover-owner.sql`. Similar ao bootstrap, mas:

- Exige `cr007b.reason` não vazio.
- Falha se o usuário alvo estiver inativo.
- Registra `action='recover.owner'` e grava `reason` no evento.
- Também usa o mesmo advisory lock e é transacional.

## 4. Como executar (leitura, não execute nesta etapa)

### Opção A — SQL Editor da dashboard (recomendado para homologação)

1. Autenticar como proprietário da organização Supabase.
2. Abrir SQL Editor → nova query.
3. Colar o conteúdo de `ops/sql/00-bootstrap-owner.sql`.
4. Substituir os valores de `cr007b.target_user_id` e `cr007b.actor_display_name` no bloco `SET LOCAL` (ou rodar via `SET` de sessão antes do bloco transacional).
5. Executar uma única vez.
6. Guardar o `id` e o horário do evento; copiar o retorno para o runbook.
7. Sair e autenticar com o email promovido; confirmar que `/admin` carrega o perfil.

### Opção B — CLI do Supabase

```bash
supabase db execute --db-url "$SUPABASE_DB_URL" \
  --file ops/sql/00-bootstrap-owner.sql
```

Isso roda como o usuário proprietário do banco (mesmos privilégios de migração). **Não armazenar** `$SUPABASE_DB_URL` em `.env` versionado nem em logs de CI.

## 5. Proibições

- ❌ Nunca criar mais de um proprietário no bootstrap.
- ❌ Nunca colocar UIDs fixos em migrations ou em arquivos rastreados pelo Git além dos scripts operacionais documentados (que não rodam automaticamente).
- ❌ Nunca executar o bootstrap por Edge Function/RPC.
- ❌ Nunca executar em produção sem aprovação explícita e sem o projeto estar em exclusividade homologada.

## 6. Evidências e pós-execução

Após execução, o evento `admin_audit_events` com `action='bootstrap.owner'` é a evidência oficial. O script emite um resultado com `profile_id`, `role`, e `created_at`. Guardar isso no runbook da homologação. Não há necessidade de guardar senhas ou tokens.

## 7. Retomada de acesso

Se o último proprietário for desativado ou perder acesso, `ops/sql/01-recover-owner.sql` é o único caminho. Exige que o usuário alvo exista em `auth.users`, com email verificado, e a execução fica registrada com `reason` em auditoria. Não existe "porta dos fundos" via anon.

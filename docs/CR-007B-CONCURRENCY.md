# CRIATTO 3D — CR-007B.7 — Contrato de concorrência otimista (M-2)

Data: 13/11/2026.

## Decisão

Não vamos, nesta migration, adicionar uma restrição CHECK em cada tabela para impor `version = OLD.version + 1`. Fazer isso é arriscado: triggers existentes (`touch_version`) já incrementam `version`, e um CHECK exigiria que o UPDATE trouxesse `version = OLD.version + 1` na cláusula SET, o que pode ser confundido com passagem de `expectedVersion` do cliente e não cobre todos os caminhos de escrita interna.

Em vez disso, os **comandos de servidor futuros (CR-007C)** são obrigados a cumprir o contrato abaixo. Qualquer adapter de produção (Supabase client server-side ou Edge Function) que viole esse contrato deve falhar em revisão.

## Contrato para qualquer comando mutante (update / status change / inventory adjust / coupon save / settings save / etc)

1. **Lê a versão atual** do recurso sob `SELECT … FOR UPDATE` quando o comando participa de fluxo transacional multi-comando (ex. checkout, confirmação de pagamento). Leitura simples é aceitável para comandos de única linha quando o risco de colisão é baixo e o comando pode ser reexecutado.
2. **Valida o contexto** (`expectedVersion` é obrigatório no `CommandContext` do cliente e é repassado ao servidor).
3. **Executa o UPDATE com WHERE version = :expectedVersion**. Se zero linhas forem afetadas, retorna `{ ok: false, error: { code: 'CONFLICT', messageKey: 'error.concurrent_modification', retryable: true, … } }` (tipo já previsto em `foundation.ts` `ErrorCode`), sem alterar estado.
4. **Triggers de versionamento** (`touch_version`) executam e incrementam `version` em 1 — o servidor NUNCA seta `version` manualmente.
5. **Atomicidade:** todo comando que toca mais de uma tabela (alocação de estoque, mudança de status, registro de pagamento) executa em uma única transação SQL, com locks explícitos (`SELECT … FOR UPDATE`) nas linhas-pai para evitar deadlocks e races entre operadores concorrentes.
6. **Idempotência:** comandos que podem ser repetidos por retry do cliente (create order, webhook) usam `idempotency_key` ou `operation_key` UNIQUE no banco e respondem `replayed: true` sem reexecutar efeitos colaterais.
7. **Log de auditoria:** cada mutação grava um `admin_audit_events` (ou o evento específico da tabela: `order_status_history`, `inventory_movements`, `custom_request_history`) na mesma transação, com `operation_key`.
8. **Erros tipados:** o cliente reconhece `CONFLICT` e `IDEMPOTENCY_CONFLICT` como distintos. `CONFLICT` pede para recarregar o recurso; `IDEMPOTENCY_CONFLICT` pede revisão de payload (hash diferente).

## Exemplo de pseudocódigo (CR-007C)

```sql
BEGIN;
-- lock pai
SELECT * FROM public.orders WHERE id = $1 FOR UPDATE;
-- mutação com condição de versão
UPDATE public.orders
   SET status = $2, updated_at = clock_timestamp()  -- version bump via trigger
 WHERE id = $1 AND version = $3;   -- $3 = expectedVersion
-- se ROW_COUNT = 0 => ROLLBACK e retorna CONFLICT
INSERT INTO public.order_status_history (order_id,from_status,to_status,actor_id,occurred_at,note,operation_key)
SELECT id, status, $2, $4, clock_timestamp(), $5, $6 FROM public.orders WHERE id = $1;
COMMIT;
```

## O que o banco já garante (sem codificação adicional)

- Triggers `touch_version` incrementam `version` em cada UPDATE (sem depender do chamador).
- `UNIQUE (operation_key)` em tabelas de evento impede dupla gravação.
- `UNIQUE (idempotency_key)` em `orders` e `custom_requests` impede replays com payload divergente.
- Triggers imutáveis (`reject_mutation`) proíbem UPDATE/DELETE/TRUNCATE em tabelas de evento.

## O que é responsabilidade do servidor/adapter

- Passar `expectedVersion` ao banco no WHERE do UPDATE.
- Tratar zero-affected-rows como `CONFLICT`.
- Envelopar em transação comandos multi-tabela.
- Usar advisory locks apenas quando necessário (bootstrap, publicação de mídia); já existem para (7007,2) (proteção último proprietário) e por media_id (private_media).
- Vedar mutações através de PostgREST direto: todos os comandos de escrita devem rodar como `service_role` através de Edge Function/RPC com validação Zod, NUNCA com chave anon/authenticated no cliente.

## Verificação de implementação

A CR-007C deve adicionar testes de concorrência em `tests/postgres/` (duas transações simultâneas tentando o mesmo UPDATE com a mesma `expectedVersion` — uma tem que falhar com CONFLICT). Enquanto esses comandos não existem, a modelagem atual preserva os campos necessários para implementar o contrato sem novas migrations.

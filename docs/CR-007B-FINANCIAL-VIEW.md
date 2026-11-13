# CRIATTO 3D — CR-007B.7 — Visão financeira e estratégia de performance (M-4)

Data: 13/11/2026.

## Estado atual

`public.finance_order_summary` é uma `security_barrier` view definida como:

```sql
SELECT id, number, status, subtotal_cents, discount_cents,
       shipping_cents, total_cents, currency, confirmed_at
FROM public.orders
WHERE public.has_role(ARRAY['proprietario','financeiro']::public.admin_role[]);
```

Grant: SELECT para `authenticated` (coberto pela policy que chama `has_role`).

A view **não** retorna `customer_id`, `customer_name_snapshot`, `customer_phone_snapshot`, `notes`, `privacy_notice_version` — ou seja, não há PII, minimizando exposição ao papel financeiro (conforme matriz aprovada: "relatórios financeiros sem exposição desnecessária de dados pessoais").

## Análise de custo de `has_role()`

- `has_role()` é uma função SQL STABLE SECURITY DEFINER que faz um JOIN entre `admin_profiles` e `user_roles` com filtros por `auth.uid()`, `active=true`, e `role=ANY(allowed)`. Índices `user_roles(role,user_id)` e PK de `admin_profiles(user_id)` existem.
- Dentro de uma sessão autenticada pelo PostgREST, `auth.uid()` é STABLE; o planejador pode avaliar `has_role()` uma vez por transação (função STABLE com argumento constante para a sessão), mas em `security_barrier` views ele é chamado por linha devido à ordem de avaliação de segurança.
- Na prática: custo de um JOIN por linha de `orders`. Com milhares de pedidos, isso não é um problema em homologação, mas pode começar a consumir CPU quando o volume chegar a dezenas de milhares de linhas em uma única consulta paginada.

## Decisão para CR-007B.7

**Manter a view como está, sem otimização prematura.** Justificativa:

- Nenhum dado real de pedidos existe ainda.
- A interface financeira usará paginação (PageRequest até 100 itens) do `FinanceRepository`; o custo por página é desprezível.
- Otimizar com base em suposição pode introduzir regressão de segurança (ex: mover a checagem de papel para fora da security_barrier).

## Estratégia de otimização (para CR-007D/7E, SE houver evidência de gargalo)

1. **Medição primeiro.** Antes de qualquer otimização, coletar:
   - `EXPLAIN (ANALYZE, BUFFERS)` da consulta real do adapter.
   - pg_stat_statements apontando a view entre queries com maior tempo total.
   - Latência p95 do endpoint em homologação com volume de dados representativo.
2. **Otimizações possíveis, em ordem de segurança:**
   - Trocar a chamada de função por uma subconsulta correlata com `EXISTS` sobre um índice cobridor em `user_roles(role, user_id)`; mantém a checagem dentro da `security_barrier`.
   - Adicionar uma política RLS na própria tabela `orders` para `financeiro`, em vez de view, quando a visão precisar de joins (ex.: agregações por período); nesse caso as colunas sensíveis devem ser protegidas por column-level grants (REVOKE SELECT em customer_phone/notes para financeiro).
   - Materializar a visão agregada de relatório em uma view materializada atualizada por trigger, SOMENTE para paineis analíticos (não para leitura transacional de pedidos).
3. **Nunca:** remover `security_barrier`, tornar a view `security_invoker`, ou incluir PII em colunas da visão financeira.

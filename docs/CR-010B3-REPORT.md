# CR-010B.3 — ativação controlada da migration comercial

**Data:** 2026-11-15 UTC  
**Estado:** **BLOQUEADA antes de qualquer escrita remota. Migration NÃO aplicada.**  
**Projeto alvo:** `ugwuxczcqlrdjkpjsdqb`  
**Branch:** `arena/1f32d4fc-criatto-3d-studio`; HEAD consultado `2cd2c668b63d437c945d64b7338494ad3d0a61cf`; PR #9 draft.  

## Decisão de segurança

A instrução exigiu interromper se qualquer pré-condição não pudesse ser confirmada. A identidade, as migrations, o hash e a ausência dos novos objetos foram confirmados. **Não foi possível confirmar backup lógico recuperável nem configurar/confirmar timeout limitado de lock/execução pelo conector disponível.** Portanto, não executei `create_migration`, `execute_query` com DDL, a migration, nem inserção no histórico. Nenhum dado comercial foi criado e não houve alteração no Supabase.

## Pré-condições verificadas

| Verificação | Evidência/resultado |
|---|---|
| Identidade do projeto | `list_projects` e `get_project`: `criatto3d-homolog`, ref `ugwuxczcqlrdjkpjsdqb`, `sa-east-1`, PG `17.11.0.019`, estado `ACTIVE_HEALTHY`; DB e REST healthy. |
| Histórico | `list_migrations`: exatamente 13 versões, da `20261113120100_cr007b_identity` até `20261115103000_cr009f_hook_type_fix_and_media_aal2`, sem a CR-010B.1. |
| SHA-256 da migration | Local calculado nesta execução: `a31f001bdbbe024ac4ed994a814237f2bd81dbca3367e66e28ea56fc057b2c92`; igual ao hash aprovado no relatório CR-010B.1/2 e no harness PG17. |
| Objetos novos | `inventory.minimum_on_hand` ausente; zero funções remotas entre `swap_category_order`, `replace_product_variants`, `adjust_inventory`, `set_inventory_minimum`. Sem colisão de assinatura. |
| RLS/grants atuais | Policies existentes de `inventory` e `inventory_movements` exigem `has_role(proprietario/operador) AND require_aal2()`. `authenticated` mantém apenas SELECT nessas tabelas; não há grant de escrita direta novo. Triggers existentes `version_stamp` e `valid_variant` estão habilitados. |
| Backup lógico e recuperação | **Não confirmado.** A conexão Supabase disponível não expõe artefato de backup, horário, retenção ou teste de restore; health `ACTIVE_HEALTHY` não prova backup restaurável. Não foi iniciado nem presumido backup. Pré-condição falhou. |
| Timeout + erro | A migration contém `BEGIN`/`COMMIT`; DDL falha/aborta a transação. O executor de migration Supabase disponível promete rollback em falha, mas não oferece neste fluxo parâmetro verificável de `lock_timeout`/`statement_timeout`. A migration exata aprovada não declara esses limites. Assim, não foi possível confirmar a execução com timeouts exigidos; pré-condição falhou. |

## Conteúdo exato autorizado (não executado)

`supabase/migrations/20261115120000_cr010b1_catalog_stock_commands.sql` — SHA-256 acima.

O diff aprovado adiciona uma coluna em `public.inventory` e cria quatro funções. Não cria tabela, bucket, trigger ou policy; não altera grants de tabela nem Auth. O script declara uma transação explícita.

| Função | Security | ACL declarada no arquivo | Checagem de autorização |
|---|---|---|---|
| `swap_category_order(uuid,integer,uuid,integer)` | `SECURITY INVOKER` | `REVOKE ALL ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated` | `require_aal2()` e papel proprietário/editor |
| `replace_product_variants(uuid,jsonb,jsonb)` | `SECURITY INVOKER` | `REVOKE ALL ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated` | `require_aal2()` e papel proprietário/editor |
| `adjust_inventory(uuid,integer,text,text,integer)` | `SECURITY DEFINER`, search_path fixo `public, pg_temp` | `REVOKE ALL ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated` | `require_aal2()` e papel proprietário/operador |
| `set_inventory_minimum(uuid,integer,integer)` | `SECURITY DEFINER`, search_path fixo `public, pg_temp` | `REVOKE ALL ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated` | `require_aal2()` e papel proprietário/operador |

Os grants são verificados estaticamente no arquivo; as assinaturas remotas estão ausentes. A migration **não foi executada**, portanto não há ACLs de função pós-aplicação a consultar. Os checks CI de aplicação/RLS/AAL1/AAL2 foram em PostgreSQL 17 descartável, não contra Auth ou sessões do projeto remoto.

## Execução e estado posterior

- Migration aplicada: **não**.
- Linha registrada em `supabase_migrations.schema_migrations`: **não**; o histórico segue com 13 migrations.
- `minimum_on_hand`: **ausente**.
- Quatro funções comerciais: **ausentes**.
- RLS, policies, grants, Auth e Storage: **sem alteração nesta execução**.
- Testes remotos AAL1/AAL2: **não executados**; não há sessão real autorizada fornecida e não se criaram usuários. O teste local PG17 da CR-010B.2 não substitui o teste remoto.
- Erro técnico de DDL: nenhum; nenhuma tentativa de DDL foi feita. Bloqueios são a ausência de prova de backup/restore e a indisponibilidade de timeout configurável/verificável neste executor.

## Próximas condições para retomar

1. Responsável confirma, fora do conector, um backup lógico recente e restaurável, registrando timestamp/escopo e teste de recuperação; ou disponibiliza um mecanismo aprovado que o faça sem expor credenciais no chat.
2. Disponibilizar mecanismo de migration que execute o **conteúdo exato** com limites explícitos de `lock_timeout` e `statement_timeout`, pare em erro, faça rollback e registre a versão Supabase sem reaplicar DDL. Se isso exigir alterar a migration aprovada, pedir nova revisão/hash e autorização específica antes.
3. Repetir as verificações read-only imediatamente antes da execução. Se a migration ou qualquer assinatura aparecer, parar e investigar.
4. Após todas as pré-condições serem satisfeitas, solicitar confirmação operacional para retomar a aplicação controlada. Até lá, este relatório registra a interrupção segura.

Após eventual aplicação autorizada, validar somente schema, função/ACL, ausência de alteração nas policies/grants e chamadas sem escrita persistente; os casos AAL1/AAL2 devem usar um usuário de teste já autorizado e sessão legítima. Não criar usuário, convidar, bootstrap, inserir produto ou executar rollback automaticamente.

## Pendências não abrangidas pela autorização

- Sem buckets, policies de Storage ou canal seguro de upload; fotos/galeria continuam indisponíveis.
- CRUD de produtos/categorias ainda requer smoke test com operador AAL2 real.
- Checkout, pedidos e reserva server-side de estoque pertencem a CR-010C; a loja não deve ser declarada pronta para venda até essa etapa.
- PR #9 permanece draft; nenhum merge/deploy, alteração à Locaweb ou escrita na loja oficial foi realizado.

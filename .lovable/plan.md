# CR-007B — Diagnóstico e plano de migrations

## Diagnóstico

- Arquitetura escolhida: TanStack Start/hospedagem Lovable + Supabase próprio; uma loja, sem multi-tenant.
- O projeto não possui conexão de banco disponível: a consulta de metadados retornou `failed_precondition` por ausência de backend no ambiente solicitado.
- Não foi possível confirmar existência/exclusividade da homologação, ausência de dados de outros sistemas ou estado do banco. **Nenhuma migration pode ser aplicada neste estado.**
- Documentos CR-007A e sete contratos assíncronos existentes foram comparados; os contratos ainda dependem de modelos demo e precisam futuramente de DTOs público/admin, paginação, IDs estáveis e comandos idempotentes.
- 122 testes existentes aprovados em 11 arquivos. `src/App.tsx` e `executeAttachedConfig` não existem; erro citado não reproduzido.

## Próximo passo autorizado por esta revisão

1. O responsável identifica e conecta, pelo editor, o Supabase próprio exclusivamente de homologação; não enviar credenciais no chat.
2. Confirmar finalidade/exclusividade com o responsável e inventariar o banco **somente por leitura**: schemas, tabelas/contagens agregadas, grants/RLS, funções/triggers, extensões, usuários/buckets e migrations existentes, sem expor dados pessoais.
3. Comparar o inventário com o plano abaixo, verificar recuperação disponível e apresentar divergências.
4. **Solicitar autorização separada antes de criar/aplicar SQL. Aprovar este plano não autoriza execução de migrations.**

## Migrations previstas — detalhes técnicos

Nomes lógicos em ordem; timestamps finais serão definidos após conferir histórico remoto. Nenhum destes arquivos SQL foi criado.

| Arquivo | Tabelas e finalidade |
|---|---|
| `0001_cr007b_identity.sql` | enums, `admin_profiles`, `user_roles`, verificador de papel/perfil ativo sem recursão; sem usuários reais |
| `0002_cr007b_catalog.sql` | `categories`, `products`, `product_attribute_groups`, `product_attribute_options`, `product_variants`, `variant_option_values`; IDs/FKs/centavos/preço efetivo/índices |
| `0003_cr007b_media.sql` | `media_assets`, `product_images`, `category_images`; apenas metadados, sem buckets |
| `0004_cr007b_orders.sql` | `customers`, `orders`, `order_items`, `order_status_history`, `payments`; snapshots/idempotência/referência sequencial; sem checkout habilitado |
| `0005_cr007b_inventory.sql` | `inventory`, `inventory_movements`, `order_allocations`; integridade saldo/item/produto, sem decidir marco de baixa |
| `0006_cr007b_coupons_requests.sql` | `coupons`, `coupon_redemptions`, `custom_requests`, `custom_request_images`, `custom_request_history` |
| `0007_cr007b_content_audit.sql` | `banners`, `store_settings`, `admin_audit_events`; singleton e histórico, sem seed |
| `0008_cr007b_access_invariants.sql` | projeções públicas estreitas, acesso administrativo aos inativos, policies finais e proteções append-only; sem RPC comercial pública |

Cada CREATE TABLE público inclui no mesmo arquivo GRANT mínimo → RLS → policies; não adiar a segurança para o último arquivo. Anon não lê dados pessoais ou financeiros. Autenticado sem papel não escreve administrativamente. Papéis e regras comerciais ainda pendentes não serão habilitados por presunção.

## Validação futura, após autorização específica

- FKs, CHECK/UNIQUE, índices, tipos/DTOs e integridade de variantes/snapshots.
- RLS/grants/EXECUTE direto para anon, autenticado sem papel, papéis autorizados, revogados/inativos, usando identidades fictícias isoladas.
- Banco descartável reconstruído e reexecução controlada pelo histórico do runner; fixtures fora das migrations de schema.
- Preservar os 122 testes e a demonstração; não importar LocalStorage, alterar rotas/visual/carrinho/checkout, criar administradores reais ou publicar.

Relatório da preparação: `docs/CR-007B-REPORT.md`. CR-007C permanece fora do escopo.
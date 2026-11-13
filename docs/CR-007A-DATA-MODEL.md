# CR-007A — Modelagem preliminar de dados

13/11/2026. **Proposta para aprovação; sem SQL executado, tabelas criadas ou migration.** Uma única loja, sem tenant_id nem complexidade multi-tenant.

## Convenções e regras comuns

- PK UUID gerado no servidor, timestamps `timestamptz`, strings limitadas, moeda BRL e valores inteiros em centavos `bigint` com teto compatível com `Number.MAX_SAFE_INTEGER` nos DTOs. Quantidade `integer` positiva; texto livre com comprimento máximo; `jsonb` somente para snapshots/atributos auditáveis, não para o banco inteiro.
- `created_at`, `updated_at` e `version integer` nos agregados editáveis. Audit/eventos append-only com timestamp do banco e ator; IDs de admins vêm de `auth.users`, nunca do payload.
- FKs com RESTRICT por padrão; archive/soft-delete para registros usados em pedidos. Exclusão de relações puramente editoriais pode usar cascade; pedido/eventos financeiros não devem desaparecer ao excluir produto/cliente. Anonimização de dados pessoais com trilha controlada e retenção aprovada.
- Índices das FKs relevantes são explícitos (PostgreSQL não os cria todos automaticamente). Paginação `(created_at,id)` ou `(effective_price_cents,id)`, desempate estável. Estado/publicação têm CHECK/enum definido; constraints locais não substituem invariantes transacionais entre tabelas.
- Perfis de acesso: **P** leitura pública estreita somente ativos e pais ativos; **E** editor de catálogo; **O** operador de pedidos/clientes; **F** financeiro; **A** administrador proprietário; **S** comando autorizado do servidor. Papéis propostos, aprovação pendente. “Autenticado” sozinho não concede acesso administrativo.
- Colunas privadas não entram em projeções P. RLS filtra linhas, **não oculta colunas automaticamente**: grants de coluna ou projeção/view security-invoker/DTO limitado, verificada com chamada direta Data API.

## Entidades, chaves, índices e acesso

### Identidade e permissões

| Entidade | Campos essenciais / tipos | Chaves, restrições, índices | Acesso / relações |
|---|---|---|---|
| `admin_profiles` | `user_id uuid`, `display_name varchar(100)`, `active boolean`, timestamps | PK/FK user_id → auth.users; nenhum papel neste perfil | Próprio usuário lê perfil; A administra ativação; desativar não apaga eventos |
| `user_roles` | `id uuid`, `user_id uuid`, `role enum`, created_at, `granted_by uuid?` | PK id; FK user_id/granted_by → auth.users; UNIQUE(user_id,role), índice role,user_id | A concede/revoga por comando; autenticado consulta apenas papel próprio/função autorizada; sem escrita self-service |

Permissões pequenas no servidor mapeiam os papéis a comandos; não criar um mecanismo genérico de permissões editável pelo cliente. Último administrador ativo não pode ser removido sem transferência validada. `has_role` deve ter execução autorizada, search_path fixo e não recursivo.

### Catálogo, atributos e imagens

| Entidade | Campos essenciais / tipos | Chaves, restrições, índices | Acesso / relações |
|---|---|---|---|
| `categories` | id, slug varchar(60), name varchar(100), description text, active bool, display_order int, version | PK id; UNIQUE(slug), CHECK slug/ordem; índice(active,display_order,id) | P ativos; E/A CRUD; produto FK estável por ID, não slug |
| `products` | id, category_id uuid, slug varchar(60), name varchar(100), description text, tags text[], regular_price_cents bigint, promo_price_cents bigint?, production_mode enum, active bool, featured bool, badge enum?, production_days int?, archived_at? | PK id; FK categoria RESTRICT; UNIQUE(slug); preço>0, 0<promo<regular; prazo>0 sob-demanda; índices categoria/active, preço efetivo/id; busca GIN/normalizada só após definir semântica equivalente aos filtros atuais | P produto e categoria ativos; E/A edição; estoque fora da linha de produto; preço efetivo calculado/gerado, não fornecido pelo cliente |
| `product_attribute_groups` | id, product_id uuid, code varchar(60), label varchar(100), position int, required bool | PK; FK produto; UNIQUE(product_id,code); índice produto/position | P junto do produto; E/A; códigos estáveis para Cor/Tamanho/Acabamento |
| `product_attribute_options` | id, group_id uuid, code varchar(60), label varchar(100), active bool, position int | PK; FK grupo; UNIQUE(group_id,code); índice grupo/active/position | P se produto/pais ativos; E/A; desativar opção não altera snapshot |
| `product_variants` | id, product_id uuid, sku varchar(100), active bool, selection_key text | PK; FK produto; UNIQUE(sku), UNIQUE(product_id,selection_key), índice produto/active | P variantes válidas; E/A. Combinação vendável de IDs, sem estoque independente na fase inicial |
| `variant_option_values` | variant_id uuid, group_id uuid, option_id uuid | PK(variant_id,group_id); FKs variante, grupo, opção; índice option_id; comando/constraints compostas garantem opção do grupo e grupo do mesmo produto | P via variante publicada; E/A; exatamente uma opção por grupo requerido |
| `media_assets` | id, bucket text, object_key text, mime text, byte_size bigint, width/height int, checksum text, alt varchar(200), state enum(staging,verified,published,delete-pending), created_by uuid?, derivatives jsonb, timestamps | PK; UNIQUE(bucket,object_key); bytes/dimensões>0; índice state/created_at; chave e MIME gerados/verificados, não confiados ao browser | E/A metadata pública só quando ligado a conteúdo publicado; S processamento; anexos privados sem P |
| `product_images` | product_id uuid, media_id uuid, position int, is_primary bool | PK(product_id,media_id), FKs; UNIQUE(product_id,position), unique parcial primary por produto; índice media_id | P somente imagem verificada de produto público; E/A reordena; arquivo não apagado por cascade |
| `category_images` | category_id uuid, media_id uuid | PK category_id; FKs categoria/media; índice media_id | P categoria ativa; E/A; opcional |

O modelo atual (`shared/types/catalog.ts`) compartilha estoque e preço entre variações. A proposta conserva isso: variantes identificam combinação, não criam preços/estoque por SKU sem aprovação. A migração gera combinações atuais de grupos sem inventar opções; produto sem atributos recebe variante base. Categorias continuam uma por produto. Redirecionamentos de slug podem ser uma relação pequena `product_slug_redirects(old_slug UNIQUE, product_id FK)` futura se URLs reais já tiverem sido indexadas.

### Estoque e concorrência

| Entidade | Campos essenciais / tipos | Chaves, restrições, índices | Acesso / relações |
|---|---|---|---|
| `inventory` | product_id uuid, on_hand int, allocated int, version int, updated_at | PK/FK produto; CHECK on_hand>=0, allocated>=0, allocated<=on_hand | P somente disponibilidade sanitizada/projeção; O consulta, A/operador autorizado ajusta via S; sem update bruto público |
| `inventory_movements` | id, product_id uuid, order_id uuid?, kind enum(adjust,allocate,release,consume,return), quantity int, delta_on_hand int, delta_allocated int, reason text, actor_id uuid?, operation_key text, created_at | PK/FKs; quantity>0; UNIQUE(operation_key,product_id,kind); índices produto/created_at, order_id | O/A consulta, S append-only; alterações ledger + saldo atômicas; nenhuma exclusão comum |
| `order_allocations` | id, order_item_id uuid, product_id uuid, quantity int, state enum(active,released,consumed), timestamps | PK/FKs; UNIQUE(order_item_id); quantity>0; índices produto/state e state/updated_at | O/A consulta; S comandos atômicos; não existe para sob-demanda |

**Regra proposta, não aprovada:** solicitação pendente não reserva e não baixa estoque; confirmação administrativa revalida e aloca; envio/entrega consome estoque físico e libera alocação; cancelamento antes do consumo libera; depois do consumo não repõe automaticamente (retorno físico explícito). Se o cliente escolher baixa na confirmação ou reserva temporária, adaptar CR-007E **antes** de habilitar comandos, com expiração/retry definidos. Sob-demanda segue prazo/capacidade aprovada, sem estoque físico negativo.

Transação de confirmação: autorizar ator → bloquear pedido e inventários em ordem estável de ID → conferir versão/status/quantidades e saldo `on_hand-allocated` → confirmar + alocar + append histórico/movimentos/auditoria → commit. Dois compradores ou administradores concorrentes não podem confirmar a mesma unidade. Retry de deadlock/serialização limitado usa mesma operation key; rejeição por saldo vira conflito compreensível. Não usar cinco chamadas REST para tentar reproduzir uma transação.

### Clientes, pedidos e financeiro

| Entidade | Campos essenciais / tipos | Chaves, restrições, índices | Acesso / relações |
|---|---|---|---|
| `customers` | id, name varchar(100), phone_e164 varchar(16), notes text, created_at, updated_at, anonymized_at? | PK; telefone normalizado/validado; índice telefone não necessariamente UNIQUE (telefone não é identidade comprovada), created_at/id | O/A dados mínimos; nenhum P. Sem FK obrigatória para auth.users; cliente não precisa conta |
| `orders` | id, number bigint, customer_id uuid?, customer_name_snapshot varchar(100), customer_phone_snapshot varchar(16), status enum atual, subtotal_cents bigint, discount_cents bigint, shipping_cents bigint?, total_cents bigint?, notes varchar(500), currency char(3), version int, idempotency_key uuid, payload_hash text, created_at, confirmed_at?, privacy_notice_version text | PK; UNIQUE(number), UNIQUE(idempotency_key); FK cliente; centavos>=0, discount<=subtotal; total consistente quando frete definido; índices(status,created_at,id), customer/created_at, confirmed_at | O/A lê; S cria pendente sem cadastro; não há anon SELECT/UPDATE; F financeiro restrito. Snapshot independente de cadastro editável |
| `order_items` | id, order_id uuid, product_id uuid?, variant_id uuid?, product_name_snapshot varchar(100), sku_snapshot text, attributes_snapshot jsonb, unit_price_cents bigint, quantity int, line_discount_cents bigint | PK/FKs; quantity>0, unit_price>0; desconto<=linha; índice order_id e product_id; bloquear edição após criação, salvo revisão formal versionada de pedido | O/A/F conforme necessidade; S criação/revisão. Archive de produto preserva referências; SET NULL só em exclusão excepcional mantendo snapshots |
| `order_status_history` | id, order_id uuid, from_status enum?, to_status enum, actor_id uuid?, occurred_at, note varchar(500), operation_key text | PK/FKs; UNIQUE(order_id,operation_key); índice(order_id,occurred_at,id); transição e append-only verificadas no comando | O/A lê; S acrescenta; cliente não envia ator/timestamp |
| `payments` | id, order_id uuid, amount_cents bigint, kind enum(receipt,refund,correction), method enum/manual text, reference text?, evidence_media_id uuid?, confirmed_by uuid, confirmed_at, operation_key uuid, related_payment_id uuid? | PK/FKs; amount>0; UNIQUE(operation_key); índice order/time; recibo/estorno não ultrapassa limites financeiros aprovados; evidência privada | F/A registra via S somente pedido confirmado; O vê resumo permitido; eventos não apagáveis; nada de dados de cartão |

`number` é referência sequencial única emitida pelo banco (gaps aceitáveis), não hash do carrinho e não senha de leitura. Pedido sem frete combinado tem `shipping_cents=NULL` e total final ainda aberto: a UI mostra estimativa, não confunde “a combinar” com gratuito. Para registrar recebimento integral, total/frete têm de estar definidos; pagamentos parciais, estornos e revisões exigem decisão explícita. Histórico financeiro substitui `paymentReceived`, preservando regra de métricas: pendência ≠ venda, confirmado ≠ recebido; receita líquida deriva de eventos, cancelados/estornos têm relatório próprio.

**Idempotência:** payload de criação contém apenas IDs/quantidades, cliente, notas, código de cupom e chave aleatória; preço nunca confiado. Mesma chave+payload retorna o mesmo resultado persistido; chave+payload diferente retorna conflito. Não deduplicar por telefone ou hash de carrinho: compras repetidas legítimas existem. Não armazenar PII em hash/log para debug. Se necessário recuperar resposta anônima, usar recibo opaco separado, com hash no banco, escopo único e expiração — número sequencial sozinho não permite leitura. Transação grava pedido/itens/histórico/consumo ou reserva de cupom em conjunto.

### Cupons, personalizados, conteúdo e auditoria

| Entidade | Campos essenciais / tipos | Chaves, restrições, índices | Acesso / relações |
|---|---|---|---|
| `coupons` | id, code varchar(20), kind enum(percentual,fixo), value int/bigint, starts_at/ends_at timestamptz, active bool, usage_limit int?, min_subtotal_cents bigint?, version | PK; UNIQUE(code normalizado); percentual 1–100, fixo>0, fim>=início, limite>0; índice code/active/vigência | E/A CRUD conforme papel aprovado; público só consulta resultado elegível de código, sem listar campanhas/contadores |
| `coupon_redemptions` | id, coupon_id uuid, order_id uuid, discount_cents bigint, state enum(held,consumed,released), expires_at?, created_at | PK/FKs; UNIQUE(coupon_id,order_id); desconto>=0; índices coupon/state, state/expiry | S valida limite com lock/contador transacional; O/A consulta. Momento de consumo/expiração/release pendente de aprovação |
| `custom_requests` | id, customer_id uuid?, customer_name/phone_snapshot, description varchar(1000), dimensions jsonb?, colors varchar(120), quantity int, notes varchar(500), status enum atual, quote_cents bigint?, quote_version int, idempotency_key uuid, payload_hash text, created_at | PK/FK; UNIQUE(idempotency_key); quantity 1–999 proposto conforme UI; orçamento>0 quando definido; índice status/created_at/id | Criação pública por S se aprovada; O/A orçamento manual, sem preço automático; privado |
| `custom_request_images` | request_id uuid, media_id uuid, position int | PK(request_id,media_id); FKs e índice media_id; mídia privada | O/A/S; URL assinada curta, nunca sitemap/OG |
| `custom_request_history` | id, request_id uuid, from/to status enum, quote_cents bigint?, actor_id uuid?, occurred_at, note text, operation_key text | PK/FKs; UNIQUE(request_id,operation_key); índice request/time | O/A lê, S append-only; transições/orçamentos formalizados antes de implementar |
| `banners` | id, title varchar(80), highlight varchar(80), subtitle varchar(160), media_id uuid?, button_text varchar(100), button_url text, display_order int, active bool, version | PK/FK media; title+highlight<=80, ordem>=0; URL segura; índice active/order/id | P ativos/verificados; E/A CRUD; primeiro ativo por ordem conserva comportamento atual |
| `store_settings` | id smallint, name varchar(100), logo_media_id uuid?, whatsapp_number text, public_email text?, social_links jsonb, address text?, delivery_info varchar(500), offers_national_shipping bool, service_message varchar(500), canonical_origin text?, privacy_notice_version text, timezone text, version | PK e CHECK id=1; FK logo; validação links/telefone/origem HTTPS; defaults reais aprovados, nunca contato fictício | P só campos comerciais; A altera; secrets e permissões fora desta tabela |
| `admin_audit_events` | id, actor_id uuid?, action text, entity_type text, entity_id uuid?, request_id uuid, operation_key text?, occurred_at, safe_before/after jsonb, reason text | PK/FK ator; índices entity/type/time, actor/time, request_id; append-only; eventos omitindo secrets/PII desnecessária | A lê, S escreve atomicamente com operação; sem P nem alteração pelo administrador comum |

## Relações resumidas

```text
Auth user -> admin profile + roles -> audit/history/payment actors
Category -> Products -> Groups -> Options
Product -> Variants -> VariantOptionValues -> Options
Product -> Inventory -> Movements
Product -> ProductImages -> MediaAssets <- CategoryImages/Banners/Settings
Customer -> Orders -> Items -> immutable product/variant/attribute/price snapshots
Order -> StatusHistory + Payments + CouponRedemptions + ItemAllocations
Coupon -> Redemptions
Customer -> CustomRequests -> Images/History
```

## Questões a aprovar antes de CR-007B/007E

Papéis e quem pode ajustar estoque/receber pagamentos; alocação/baixa/cancelamento; variante compartilha estoque como hoje ou SKU independente; frete e total definitivo; pagamentos parciais/estornos; consumo/expiração de cupom, arredondamento, cumulatividade e limite por cliente sem identidade comprovada; retenção/LGPD; limites de fotos; origem canonical; personalizados via banco ou somente WhatsApp. Nenhuma proposta aqui muda os valores/limites atuais automaticamente.

# CR-009A — Auditoria para transição da loja publicada para operação comercial real

**Branch:** `integration/cr-009a-auditoria` (base: `main`)
**Data da auditoria:** 2026-11-13
**Status:** Relatório + ajustes de configuração centralizada de contato. Sem deploy, sem migrations remotas, sem merge na main. Aguardar aprovação para implementação das próximas fases.
**Site no ar (inalterado nesta CR):** https://criatto3d.art.br (upload Locaweb já realizado)

---

## 1. Dado comercial informado pelo cliente

| Canal | Valor oficial | Status |
|---|---|---|
| WhatsApp | `+55 21 98764-0769` → formato internacional `5521987640769` → URL `https://wa.me/5521987640769` | **Recebido e embutido como fallback oficial** |
| E-mail | — | **Não fornecido** → manter vazio, não exibir link |
| Instagram | — | Não fornecido → manter vazio |
| TikTok | — | Não fornecido → manter vazio |
| Endereço físico | — | Não fornecido → manter vazio |
| Mensagem de atendimento/horário | — | Não fornecido → manter vazio |

A única fonte de verdade do número oficial passou a ser `src/config/contacts.ts`. O resto da aplicação consome essa configuração via hook `useStoreSettings()`, que faz o merge entre o `StoreSettings` (persistido em demo-data ou, futuramente, no Supabase) e o fallback oficial.

---

## 2. Objetivo desta CR-009A (planejamento, não implantação)

Planejar a passagem de "vitrine demonstrativa" para "loja em operação real", **sem interromper o site já publicado** e **sem aplicar migrations remotas** nesta etapa. A CR entrega:

1. Configuração centralizada do WhatsApp oficial (**já aplicada em código, pois é um ajuste zero-risco** — ver seção 3).
2. Inventário completo dos dados demonstrativos que precisam ser substituídos.
3. Estado real das migrations do Supabase e do Custom Access Token Hook.
4. Plano de migração de catálogo/mídia/pedidos para o Supabase.
5. Auditoria de segurança do fluxo de checkout (manipulação de preços, pedidos duplicados, confirmação indevida de pagamento).
6. Plano de testes (responsividade, a11y, perf, mobile).
7. Sequência de implementação por fases e critérios de liberação.

---

## 3. O que foi alterado em código nesta CR (zero-risco, não impacta site no ar)

### 3.1 Novo módulo `src/config/contacts.ts` — fonte única de verdade dos canais comerciais

Exporta:
- `OFFICIAL_WHATSAPP = "5521987640769"` (string literal, validada pelo regex `^55[1-9]{2}9?\d{8}$`).
- `OFFICIAL_WHATSAPP_DISPLAY = "+55 21 98764-0769"`.
- `OFFICIAL_WHATSAPP_URL = "https://wa.me/5521987640769"`.
- `OFFICIAL_EMAIL`, `OFFICIAL_INSTAGRAM`, `OFFICIAL_TIKTOK`, `OFFICIAL_ADDRESS`, `OFFICIAL_SERVICE_MESSAGE`: vazios (serão preenchidos quando o cliente fornecer).
- `resolveContactSettings(persisted)`: helper que aplica o fallback oficial sobre o `StoreSettings` (vindo do seed/demo ou do backend), com precedência para valores válidos persistidos — ou seja, um admin ainda pode sobrescrever o número para homologação/teste se necessário.

### 3.2 Hook `useStoreSettings()` atualizado (`src/features/catalog/catalog.service.ts`)

Agora passa `settings` por `resolveContactSettings()` antes de retornar. Resultado prático:
- **Footer** (`StoreFooter`): passa a exibir link do WhatsApp mesmo com `seed.ts` vazio.
- **Página de contato** (`/contato`): exibe o WhatsApp como canal configurado.
- **Botões de finalização e orçamento** (`WhatsAppAction`, CheckoutPage, CustomRequestPage): passam a ficar **ativos** (antes estavam desabilitados porque `seed.whatsappNumber === ""`).
- E-mail/Instagram/TikTok continuam ocultos (fallback vazio → não validados → não renderizados).
- Total de hardcodes de WhatsApp/wa.me **fora de** `src/config/contacts.ts`, `checkout.logic.ts` (builder de URL) e `WhatsAppAction.tsx`: **nenhum** além das URLs construídas a partir de `settings.whatsappNumber`.

### 3.3 Build validado

```
✓ 2043 modules transformed.
dist/index.html                   1.39 kB │ gzip:   0.66 kB
dist/assets/index-*.css           51.13 kB │ gzip:   9.90 kB
dist/assets/index-*.js           773.73 kB │ gzip: 222.29 kB
✓ built in 1.61s
```

Build de produção verde. Testes unitários existentes não regrediram.

### 3.4 O que **não** foi alterado

- `src/features/demo-data/seed.ts`: `whatsappNumber` continua `""` — o fallback oficial cobre esse caso; quando o backend estiver conectado, o número será carregado do banco e o fallback deixa de importar.
- Nenhuma migration.
- Nenhum usuário/convite/DNS/FTP.
- Nenhum deploy para Locaweb — o site no ar continua sendo o upload atual; o novo código só vai ao ar quando o cliente autorizar novo upload.
- Nenhum arquivo de imagem ou catálogo (eliminar placeholders só quando houver conteúdo substituto real — item #10 do objetivo).

---

## 4. Inventário de dados demonstrativos que precisam ser substituídos

### 4.1 Catálogo (18 produtos fictícios em `src/features/catalog/products.mock.ts`)

| ID | Slug | Nome | Categoria | Preço | Badge | Disponibilidade | Estoque | Variações |
|----|------|------|-----------|-------|-------|-----------------|---------|-----------|
| p01 | luminaria-lua | Luminária Lua | decoração | R$ 129,90 | Mais Vendido | pronta-entrega | 8 | tamanho P/M/G |
| p02 | escultura-onda | Escultura Onda | decoração | R$ 79,90 | Novo | sob-demanda (5d) | 0 | cor Branco/Preto/Ciano |
| p03 | porta-retrato-hexagonal | Porta-retrato Hexagonal | decoração | R$ 49,90 | — | pronta-entrega | 15 | cor Branco/Preto/Roxo |
| p04 | dragao-articulado | Dragão Articulado | geek-nerd | R$ 89,90 | Mais Vendido | pronta-entrega | 12 | cor + tamanho M/G |
| p05 | suporte-headset | Suporte para Headset | geek-nerd | R$ 69,90 | Destaque | pronta-entrega | 6 | cor Preto/Branco |
| p06 | suporte-controle | Suporte para Controle | geek-nerd | R$ 39,90 | Novo | pronta-entrega | 20 | cor Preto/Branco/Roxo |
| p07 | organizador-mesa-modular | Organizador de Mesa Modular | casa-organização | R$ 59,90 | Destaque | pronta-entrega | 10 | cor Branco/Preto/Ciano |
| p08 | organizador-cabos | Organizador de Cabos (kit 6) | casa-organização | R$ 24,90 | — | indisponível | 0 | cor Preto/Branco |
| p09 | gancho-parede | Gancho de Parede Minimalista | casa-organização | R$ 19,90 | — | pronta-entrega | 30 | cor Branco/Preto |
| p10 | vaso-geometrico | Vaso Geométrico Low Poly | vasos-jardinagem | R$ 54,90 | Mais Vendido | pronta-entrega | 9 | cor + tamanho P/M/G |
| p11 | vaso-autoirrigavel | Vaso Autoirrigável | vasos-jardinagem | R$ 64,90 | Novo | sob-demanda (4d) | 0 | cor + tamanho M/G |
| p12 | cachepo-facetado | Cachepô Facetado | vasos-jardinagem | R$ 39,90 | — | pronta-entrega | 4 | cor Branco/Roxo |
| p13 | caixa-presente-coracao | Caixa Presente Coração | presentes | R$ 34,90 | Novo | pronta-entrega | 14 | cor Roxo/Laranja/Branco |
| p14 | porta-copos-hexagonal | Porta-copos Hexagonal (kit 4) | presentes | R$ 44,90 | — | pronta-entrega | 11 | cor Preto/Ciano/Laranja |
| p15 | suporte-celular-dobravel | Suporte de Celular Dobrável | utilitários | R$ 29,90 | — | pronta-entrega | 25 | cor Preto/Branco/Ciano |
| p16 | porta-canetas-hexagonal | Porta-canetas Hexagonal | utilitários | R$ 27,90 | Novo | sob-demanda (3d) | 0 | cor Preto/Branco/Roxo |
| p17 | chaveiro-personalizado | Chaveiro Personalizado | personalizados | R$ 19,90 | Mais Vendido | sob-demanda (3d) | 0 | cor (4 opções) |
| p18 | placa-nome | Placa com Nome | personalizados | R$ 69,90 | — | sob-demanda (6d) | 0 | cor + tamanho P/M |

Todos os 18 produtos têm `images: []` — a UI mostra um espaço reservado com ícone da categoria (`ProductMedia` + `MediaImage` + `categoryVisualFor`). **Nenhuma foto real de produto existe no repositório.**

### 4.2 Categorias (7, em `src/features/catalog/categories.ts`)

decoração, geek-nerd, casa-organizacao, vasos-jardinagem, presentes, utilitários, personalizados. Também sem imagens reais.

### 4.3 Imagens públicas (`public/images/`)

Pasta vazia (apenas `README.md` explicando o uso). Estrutura prevista:
- `images/banner/` — foto do hero.
- `images/categorias/` — uma imagem por categoria.
- `images/produtos/` — fotos dos produtos.

Sem arquivos, os componentes mostram placeholder ilustrativo com ícone temático.

### 4.4 Banner / hero (`useHeroBanner()` / `src/features/demo-data/seed.ts`)

`banner` vazio → Hero usa copy padrão ("Suas ideias ganham forma." / "Produtos 3D criativos para transformar seu dia a dia.") e placeholder visual com logo.

### 4.5 Cupons demonstrativos (`seed.ts → coupons`)

- `DEMO10`: 10% OFF, com `endsAt` no passado (expirado, não deve ser aplicado — comportamento garantido por `validateCoupon` em `rules.ts`).

### 4.6 Configurações (`seed.ts → settings`)

Nome "Criatto 3D"; todos os canais e mensagens vazios; `offersNationalShipping: false`. Agora o fallback oficial preenche o WhatsApp; os outros campos permanecem vazios/disable até serem fornecidos.

---

## 5. Estado do Supabase

### 5.1 CLI / projeto linkado

⚠️ **Nenhum projeto Supabase está linkado a este repositório.** A pasta `supabase/` contém apenas `migrations/` (11 arquivos `.sql`); não há `config.toml`, `.branches/`, `seed.sql`, nem referência a `project_id`. É preciso, na próxima fase:

1. Instalar/configurar Supabase CLI.
2. `supabase init` + `supabase link --project-ref <ID_DO_PROJETO>` (ID a ser fornecido pelo cliente ou criado via dashboard).
3. Aplicar migrations **em ambiente de desenvolvimento/local** antes de qualquer execução em produção.

### 5.2 Migrations presentes (11, não aplicadas remotamente nesta CR)

| Arquivo | Propósito | Tabelas/objetos criados |
|---|---|---|
| `20261113120100_cr007b_identity.sql` | Identidade administrativa | tabela `admin_profiles`, enum `admin_role` (proprietário/operador/editor/financeiro), função `has_role()` |
| `20261113120200_cr007b_catalog.sql` | Catálogo | `products`, `product_variants`, `categories`, `public_store_settings`, `hero_banner`, RLS com leitura pública e escrita apenas admin |
| `20261113120300_cr007b_media.sql` | Mídia/metadados | tabela `media_assets` com bucket/object_key/mime/dimensões/checksum/state/staging/verified/published |
| `20261113120400_cr007b_orders.sql` | Pedidos (backoffice) | `customers`, `orders`, `order_items`, `order_status_history`, `payments`; numeração `orders.number bigint GENERATED ALWAYS AS IDENTITY UNIQUE`; campos `idempotency_key uuid UNIQUE` e `payload_hash`; `status` enum `aguardando-contato/confirmado/produzindo/enviado/entregue/cancelado`; RLS: leitura por roles proprietário/operador/financeiro; escrita somente via `service_role` |
| `20261113120500_cr007b_inventory.sql` | Estoque | `inventory`, `inventory_movements`, RLS admin-only |
| `20261113120600_cr007b_coupons_requests.sql` | Cupons e solicitações | `coupons`, `coupon_usages`, `custom_requests`; RLS admin-read |
| `20261113120700_cr007b_content_audit.sql` | Trilha de auditoria | `audit_events` com actor/action/entity/safeBefore/safeAfter/operationKey |
| `20261113120800_cr007b_access_invariants.sql` | Invariantes de permissão | checks/plpgsql que garantem consistência das roles (ex. sempre existe ao menos 1 proprietário) |
| `20261113120900_cr007b_media_privilege_hardening.sql` | Endurecimento de mídia | políticas RLS adicionais sobre media; trava `authenticated` de inserir em `storage.objects` diretamente (upload via service_role/backend) |
| `20261113121000_cr007b7_private_media_and_role_matrix.sql` | Matriz de permissões e mídia privada | ajustes finos de RLS; coupons/payments com RLS por papel; grants explícitos |
| `20261114133000_cr008c_jwt_claims_and_aal.sql` | JWT claims + MFA AAL2 | função `public.custom_access_token_hook(event jsonb)`, função `public.require_aal2()`, rotina que recria policies administrativas com `AND public.require_aal2()`; sessões aal1 (senha) **não** podem acessar tabelas administrativas |

### 5.3 Buckets do Storage

A migration `20261113120300_cr007b_media.sql` define **metadados** de mídia (tabela `media_assets`), mas a criação física dos buckets e as policies de `storage.objects` são tratadas em migrations subsequentes (20261113120900, 20261113121000). Na implementação será necessário:
- Criar buckets: `product-media`, `category-media`, `content-media`, `payment-evidence` (ou nomes equivalentes definidos no painel).
- Configurar `public access` apenas para o bucket de imagens públicas de catálogo; os demais (evidências de pagamento, mídia staging) devem ser privados, com acesso via signed URL.
- Revogar `INSERT`/`UPDATE`/`DELETE` em `storage.objects` para `anon` e `authenticated` — uploads devem passar por endpoint server-side (Edge Function ou API) com validação de tipo/tamanho/dimensões, para evitar abuso.

### 5.4 Custom Access Token Hook

Presente como função plpgsql `public.custom_access_token_hook(event jsonb)` em `20261114133000_cr008c_jwt_claims_and_aal.sql`. A migration:
- Cria a função com `SECURITY DEFINER` (ou equivalente) injetando claims `roles` e garantindo `aal`.
- Faz `REVOKE ALL` de PUBLIC/anon/authenticated e `GRANT EXECUTE` para `service_role` e `supabase_auth_admin`.
- Cria `public.require_aal2()` e a aplica às policies administrativas.

⚠️ **Atenção:** a ativação do hook não é feita pela migration — é preciso habilitá-lo manualmente no painel **Supabase → Authentication → Hooks → Custom Access Token Hook** e selecionar a função `public.custom_access_token_hook`. Sem isso, as policies administrativas com `require_aal2()` não vão funcionar como esperado e os admins aal1 (sem MFA) podem ser bloqueados. **Validar em homologação antes de ativar em produção.**

### 5.5 MFA AAL2 e permissões administrativas

A rotina de upgrade de policies adiciona `AND public.require_aal2()` em TODAS as policies administrativas SELECT/INSERT/UPDATE/DELETE. Resultado:
- Tabelas públicas (products/categories) permanecem com `public_read` sem exigir aal2.
- Tabelas de backoffice (orders/payments/customers/media/inventory/coupons/audit) exigem sessão autenticada COM papel administrativo **e** MFA completada (aal2).
- Isso atende o objetivo #8.

---

## 6. Auditoria do fluxo de checkout (objetivo #9)

### 6.1 Situação atual (demo, 100% cliente)

- Pedido **não é persistido** em nenhum backend. O botão "Finalizar pelo WhatsApp" abre `https://wa.me/5521...?text=...` com mensagem formatada contendo produtos, variações, quantidades, preços e total (em `buildOrderMessage`).
- Não existe confirmação de pagamento no site — a confirmação se dá na conversa do WhatsApp. **Isso atende o requisito "abrir wa.me não é pagamento confirmado" e "não registrar pedidos fictícios como vendas reais"** por padrão, pois nenhum registro é criado.

### 6.2 Reconciliação de preços no carrinho (`src/features/cart/cart.reconcile.ts`)

A função `reconcileCart` roda antes do checkout:
- Busca o preço atual do produto via `effectivePriceCents(p)` (produtos públicos, com disponibilidade aplicada).
- Se o preço mudou, retorna `status: "price-changed"` e o carrinho avisa o usuário.
- Se produto foi removido/despublicado/indisponível → `status: "removed"/"unavailable"`, bloqueia a finalização.
- Se variação deixou de existir → bloqueia.
- Se a quantidade excede o estoque (para produtos pronta-entrega) → `status: "stock-exceeded"`, ajusta a quantidade para o máximo disponível.
- **Os preços usados no resumo/mensagem são SEMPRE os preços atuais vindos da lista pública**, nunca o que estava salvo no `localStorage`.

Isso protege contra manipulação client-side enquanto persistimos o carrinho em `localStorage`. No backend, a reconciliação deve ser refeita no servidor antes de criar um pedido.

### 6.3 Riscos quando o backend for conectado (fase CR-009C)

| Risco | Proteção atual | Proteção necessária no backend |
|---|---|---|
| Manipulação de preço no payload | Preço do localStorage não é confiado no checkout atual | Endpoint de criação de pedido deve recalcular `unit_price_cents` a partir do catálogo; qualquer divergência deve ser rejeitada (HTTP 409) com o preço atual. |
| Pedido duplicado (clique duplo) | Sem backend ainda | Coluna `idempotency_key uuid UNIQUE` já existe na tabela `orders` — o cliente deve gerar um UUID por tentativa e reenviá-lo; backend deve usar `INSERT ... ON CONFLICT (idempotency_key)` para idempotência real. |
| Quantidade manipulada (> estoque) | `cart.reconcile.ts` faz ajuste local | Backend deve rechecar estoque dentro de transação e bloquear excesso. |
| Pagamento indevido / falso | Nenhum pagamento online — confirmação via WhatsApp | Na tabela `payments`, `confirmed_by` é `uuid NOT NULL REFERENCES auth.users(id)` (admin), então nenhum cliente anônimo pode marcar um pedido como pago; toda baixa de pagamento é auditada. |
| Cupom forjado | `validateCoupon` rejeita cupons expirados/inativos/inválidos | Backend deve recalcular o desconto com base no cupom validado no servidor; não aceitar valor do cliente. |
| Número de WhatsApp forjado na URL | `isValidBusinessNumber` valida o número contra regex e `buildWhatsAppUrl` só monta URL se o número da loja for válido | Na versão conectada ao Supabase, o número virá de `public_store_settings`, que tem RLS pública-leitura/admin-escrita — cliente não pode alterar. |

### 6.4 Outros pontos importantes

- Os dados do cliente (nome, telefone, observações) **nunca são persistidos** em `localStorage` ou logs — vivem apenas no estado do componente `CheckoutPage`.
- `payload_hash` na tabela `orders` (sha256 do conteúdo relevante do pedido) permite detectar alterações indevidas no fluxo.
- `privacy_notice_version` é obrigatória, permitindo rastrear qual versão da política foi aceita.

---

## 7. Estado das features (presentes/ausentes)

| Feature | Status atual | Próximos passos |
|---|---|---|
| Vitrine pública (grade, busca, filtros, detalhe) | ✅ Funcionando (dados mock) | Trocar fonte para Supabase quando conectado. |
| Carrinho (persistência localStorage, reconciliação) | ✅ Funcionando | Sincronizar com backend (opcional). |
| Finalização por WhatsApp | ✅ Funcionando — agora aponta para o número oficial (graças ao fallback em `src/config/contacts.ts`) | Quando backend conectado, criar pedido em `aguardando-contato` antes do redirecionamento (via idempotency_key), para rastrear no painel **sem** contar como venda confirmada. |
| Orçamento personalizado (/personalizados) | ✅ Funcionando, usando WhatsApp oficial | Mesma estratégia: pode criar um `custom_request` no backend com status `rascunho` quando o usuário clica (sem anexar imagem — o aviso já diz que a imagem não é enviada automaticamente). |
| Página de contato (/contato) | ✅ Renderização condicional por canal válido; já exibe WhatsApp oficial | Exibir e-mail/Instagram/TikTok quando fornecidos. |
| Footer | ✅ Exibe WhatsApp condicionalmente | Idem. |
| Botão flutuante de WhatsApp | ❌ Inexistente | Adicionar como melhoria opcional (ver seção 11). |
| Configurações admin (SettingsPage) | ✅ Formulário com os 4 canais e validações | Continuar usando; quando conectado, persistir no Supabase (`public_store_settings`) e remover o fallback hardcoded (ou mantê-lo como redundância segura). |
| Tema claro/escuro | ✅ Funcionando | — |
| Autenticação admin (MFA) | ⚠️ Código e migrations prontos, mas **não implantados** (projeto Supabase não linkado/hook não ativado) | Fase CR-009B. |
| Painel administrativo (rotas /admin/*) | ✅ Existem rotas/páginas | Proteger por autenticação+AAL2 quando conectado. |
| Pedidos persistidos | ❌ Ainda não estão conectados ao backend | Fase CR-009C. |
| Upload de mídia | ❌ Sem integração com Supabase Storage | Fase CR-009B (infra) e CR-009D (cadastro de produtos reais com fotos). |
| SEO/meta tags por produto/categoria | ✅ Funcionando (verificado em CR-008F) | — |

---

## 8. Testes existentes

Cobertura atual em `src/test/`:

- `app-routing.test.tsx` — rotas
- `catalog.test.ts` — catálogo
- `checkout.test.ts` — mensagens e URL do WhatsApp
- `cr005-integration.test.ts` — integração carrinho/reconciliação
- `cr006a-catalog.test.tsx`, `cr006b-cart.test.tsx`, `cr006c-product-seo.test.ts`, `cr006d-persistence.test.ts`, `cr006e-orders.test.tsx`
- `cr007b-contracts.test.ts`, `demo-data.test.ts`, `foundation.test.ts`, `static-build.test.ts`

Todos devem continuar passando após as próximas fases (adicionar testes específicos para a configuração centralizada de contatos na implementação).

---

## 9. Riscos identificados

| Risco | Severidade | Mitigação |
|---|---|---|
| **R1 — Aplicar migrations direto em produção sem backup** | Alta | Nunca aplicar sem snapshot e sem homologação local; na implementação, usar ambiente Supabase de staging antes de produção. |
| **R2 — Hook Custom Access Token não ativado no painel** | Alta | Checklist obrigatório de ativação e validação em homologação; sem ativação, não exigir aal2 em produção (ou aceitar que admins aal1 podem ser bloqueados). |
| **R3 — Bucket público de mídia aceitar uploads anônimos** | Alta | Revogar INSERT/UPDATE/DELETE de storage.objects para anon/authenticated; uploads só via backend com validação MIME/tamanho/dimensões. |
| **R4 — Pedidos criados antes da confirmação serem contados como venda** | Média | Status inicial `aguardando-contato`; dashboard deve separar claramente "carrinhos/orçamentos" de "vendas confirmadas"; `payments` só é registrado por admin com evidence. |
| **R5 — Número de WhatsApp incorreto ficar hardcoded em componentes** | Média | Auditoria feita (sem hardcodes além da configuração oficial); todo novo código deve usar `useStoreSettings()` ou `src/config/contacts.ts`. |
| **R6 — Quebrar o site no ar (criatto3d.art.br) durante o desenvolvimento** | Alta | Manter site no ar como está; novas implantações só por upload FTP após aprovação e teste local (artifact ZIP gerado pelo CI). |
| **R7 — Registro de clientes/telefones em logs** | Média | Configurar o backend para NÃO logar payloads com `phone_e164` em texto claro; política de privacidade já existe e é linkada no checkout. |
| **R8 — Cupons/fretes/valores manipulados** | Média | Backend sempre recalcula a partir de dados persistidos (produto, cupons, política de frete); valores do cliente são apenas referência. |

---

## 10. Sequência de implementação recomendada (fases futuras — esta CR NÃO as executa)

### Fase CR-009B — Infra e autenticação (sem tocar no catálogo público)
1. Linkar o repositório ao projeto Supabase (criar projeto se cliente ainda não tiver).
2. `supabase start` local; aplicar as 11 migrations em ambiente local; corrigir erros de ordenação/dependência se houver.
3. Criar os buckets Storage (`product-media`, `category-media`, `content-media`, `payment-evidence`) e policies.
4. Ativar o Custom Access Token Hook no painel do Supabase (função `public.custom_access_token_hook`).
5. Criar o primeiro usuário admin, configurar MFA (AAL2), validar acesso ao painel `/admin`.
6. Testes manuais: sem MFA bloqueia acesso; com MFA permite; leitura pública de produtos funciona anônima.
7. **Não aplicar nada em produção ainda.**

### Fase CR-009C — Pedidos persistidos (sem pagamento online)
1. Criar endpoint (Edge Function ou rota server-side) `POST /api/orders` com `idempotency_key`, recalculando preços/estoque/descontos.
2. Status inicial fixo `aguardando-contato`.
3. Checkout: cliente clica em "Finalizar" → cria pedido no backend (idempotente) → redireciona para wa.me com o número do pedido na mensagem. **Abrir wa.me continua não sendo pagamento confirmado.**
4. Painel admin lista pedidos; operador move de status (contato → confirmado → produzindo → enviado → entregue).
5. Baixa de pagamento é sempre registrada por admin autenticado, com optional `evidence_media_id`.

### Fase CR-009D — Substituição do catálogo demonstrativo
1. Cliente fornece planilha de produtos reais (nome, descrição, preço, estoque, categoria, variações, prazos, tags, destaque).
2. Cliente fornece fotos em JPG/WebP 1:1 (1000–1600px, < 500KB recomendado) e imagem do banner 16:11.
3. Upload das imagens via painel admin (ou script administrativo autenticado) com redimensionamento/geração de derivativos.
4. Carga dos produtos reais no Supabase, substituindo o `products.mock.ts` (mantendo o mock apenas para ambiente de dev sem backend).
5. **Só então remover placeholders visuais.**
6. Validar em homologação; gerar novo ZIP de produção; upload para Locaweb só com autorização.

### Fase CR-009E — Melhorias de UX e testes
1. Botão flutuante de WhatsApp (quando visível: em páginas de produto/catálogo/contato, com aria-label, evitando sobreposição em telas < 360px).
2. Testes de responsividade (320px–2560px) com ferramenta do navegador.
3. Testes de acessibilidade (axe/Lighthouse: contraste, labels, foco, aria attributes).
4. Lighthouse (performance, SEO, PWA) — já há manifest e favicons configurados.
5. Testes em dispositivo físico (iPhone/Android) para fluxo completo: vitrine → adicionar ao carrinho → checkout → abre WhatsApp com mensagem correta.

---

## 11. Critérios de liberação (checklist antes do próximo deploy)

- [ ] Build de produção local verde (`bun run build`), sem erros TypeScript.
- [ ] Todos os testes unitários/integrados existentes passando (`bun test`).
- [ ] Pelo menos um teste cobrindo `resolveContactSettings` (fallback oficial + override por settings).
- [ ] Site homologado localmente em desktop (Chrome/Firefox/Edge/Safari) e mobile (iOS/Android) — vitrine, busca, filtros, carrinho, checkout, orçamento, contato, footer, temas.
- [ ] Fluxo "Finalizar pelo WhatsApp": abre `https://wa.me/5521987640769` com mensagem contendo itens, quantidades, variações e total estimado.
- [ ] Fluxo "Solicitar orçamento": abre o mesmo número com mensagem do formulário; aviso sobre imagem de referência está claro.
- [ ] Página `/contato` exibe WhatsApp; outros canais aparecem como "Ainda não configurado" (sem links quebrados).
- [ ] Footer exibe WhatsApp (apenas).
- [ ] E-mail/Instagram/TikTok não aparecem em lugar nenhum enquanto não forem fornecidos.
- [ ] Nenhum dado real de cliente é persistido em `localStorage` além do carrinho.
- [ ] Aviso claro (já existente) de que "abrir o WhatsApp não é confirmação de pagamento".
- [ ] CI verde; artifact `criatto3d-producao.zip` gerado com sucesso para download.
- [ ] Upload para Locaweb **só com autorização explícita** do cliente.

---

## 12. Itens pendentes de informação do cliente (aguardando para próxima fase)

1. E-mail comercial.
2. Perfis oficiais do Instagram e TikTok (URLs completas).
3. Endereço físico (se desejar exibir).
4. Horário de atendimento / mensagem de atendimento.
5. Lista de produtos reais (nome, descrição, preço, estoque, variações, prazos, tags, destaques).
6. Fotos dos produtos e do banner.
7. Confirmação se já existe um projeto Supabase ou se devemos criar um novo (e credenciais/accesso ao painel quando chegar a hora).
8. Política de envio/frete (oferece envio nacional? prazo? faixas de CEP?).

---

## 13. Resumo executivo

- ✅ **Contato centralizado:** WhatsApp oficial `5521987640769` embutido em uma única fonte (`src/config/contacts.ts`); `useStoreSettings()` faz fallback automático; todos os pontos da UI que consomem settings já passam a apontar para o número correto.
- ✅ **Build e testes existentes continuam íntegros** (build de produção verde).
- ✅ **Catálogo demonstrativo preservado** (nenhuma foto/placeholders removidos, conforme objetivo #10).
- ✅ **Sem deploy/sem migrations/sem usuários/sem DNS/FTP** (conforme restrições).
- ✅ **Loja no ar em https://criatto3d.art.br não foi mexida** (o novo código só é distribuído no próximo upload autorizado).
- 📋 **Plano para próximas fases** detalhado (CR-009B/C/D/E) com riscos e critérios de liberação.

A implementação das fases seguintes (B em diante) **só começa após a aprovação deste relatório** pelo cliente.

---

## 14. Verificação local de todos os gates (executada 2026-11-13)

| Gate | Comando | Resultado |
|---|---|---|
| TypeScript strict | `bun x tsc --noEmit` | ✅ sem erros |
| Vitest (todas as suítes) | `bun run test` | ✅ 16 arquivos, 187 testes passando |
| Build de produção | `bun run build` | ✅ 2043 módulos, ~774 KB JS (222 KB gz), .htaccess copiado para `dist/` |
| ESLint (escopo do CI) | `bun x eslint --max-warnings 0 src/features/data-contracts/*.ts src/test/cr007b-contracts.test.ts` | ✅ sem erros nem warnings |
| ESLint no código alterado (checkout, safe-url) | `bun x eslint` nas rotas/features/contatos | ✅ 0 erros (14 warnings preexistentes de `react-refresh/only-export-components` em arquivos legados, fora do escopo desta CR) |
| Credential scan | `bash scripts/credential-scan.sh` | ✅ "no obvious secrets (268 files scanned)" |
| Credential scan self-test (23 positivos/negativos) | `bash scripts/credential-scan.test.sh` | ✅ 23/23 passando |

### Verificações do pacote de publicação
- `dist/.htaccess` idêntico a `public/.htaccess` (fallback SPA Apache + cabeçalhos de segurança + cache agressivo de assets hasheados).
- `dist/_redirects` presente (fallback Netlify-style — redundância segura caso o servidor mude).
- Número `5521987640769` embutido no bundle de produção, resolvido por `useStoreSettings()` → footer, `/contato`, `/checkout` e `/personalizados` já apontam para o WhatsApp oficial.
- `dist/branding/`, `dist/favicon*`, `dist/manifest.webmanifest` presentes.
- **Não** há chaves/tokens/segredos no pacote (credential scan validou).

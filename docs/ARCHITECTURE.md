# Criatto 3D — Arquitetura (CR-001)

Aplicação única (TanStack Start + React 19 + Vite + TypeScript strict) com loja e painel
separados por layout e por pasta de features, compartilhando apenas o design system.

| Pasta | Conteúdo |
|---|---|
| `src/styles/` | `tokens.css` (tokens claro/escuro), `base.css` (reset) |
| `src/shared/ui/` | Componentes reutilizáveis (Button, Badge, Card, Input, Logo, ThemeToggle…) com CSS Modules |
| `src/shared/theme/` | ThemeProvider (Context + LocalStorage, script anti-flash) |
| `src/shared/config/` | Configuração comercial (WhatsApp, envio nacional) |
| `src/shared/types/`, `src/shared/utils/` | Tipos de domínio e utilitários puros |
| `src/features/cart/` | Regras do carrinho (puras, testadas) + CartContext |
| `src/features/store/` | Layout e telas da loja |
| `src/features/admin/` | Layout e telas do painel |
| `src/routes/` | Rotas: `_store.*` (loja, layout sem segmento), `admin.*` (painel), `admin_.login` |
| `docs/` | Documentação |

Decisões:
- Roteamento: TanStack Router (fixo na plataforma) no lugar do React Router; mesmas URLs amigáveis.
- Estilo: CSS Modules + variáveis CSS; sem Tailwind.
- Tema: atributo `data-theme` no `<html>`, padrão escuro, preferência salva.
- Painel em modo demonstração, sem autenticação falsa; `noindex` em todas as rotas `/admin`.
- Preços em centavos; regra "venda confirmada" centralizada em `isConfirmedSale`.
- Integração futura com Lovable Cloud: serviços mock serão trocados por funções de servidor.

## CR-002 — Loja virtual
| Pasta | Conteúdo |
|---|---|
| `src/features/catalog/` | Categorias, produtos de demonstração (`products.mock.ts`), regras puras de busca/filtro/ordenação (`catalog.logic.ts`) e `catalog.service.ts` (fonte de dados mock, trocada pelo servidor depois) |
| `src/features/store/components/` | ProductCard, CategoryCard, Section, mídia de produto |
| `src/features/store/pages/` | Telas: catálogo, produto, carrinho, personalizados, sobre, contato, categorias |
| `src/shared/ui/MediaImage`, `QuantityStepper` | Imagem com placeholder/lazy loading e seletor de quantidade |
| `public/images/{banner,categorias,produtos}` | Imagens reais (ver README da pasta) |

- Filtros do catálogo ficam na URL (`/produtos?q=&categoria=&disponibilidade=&ordem=`), validados por `parseCatalogSearch`.
- Página do produto: `/produto/$slug` (404 próprio para slug inexistente).
- Contatos e foto do banner vêm de `store.config.ts`; vazio = "Ainda não configurado"/placeholder.

## CR-003 — Checkout pelo WhatsApp
| Pasta/arquivo | Conteúdo |
|---|---|
| `src/features/checkout/checkout.logic.ts` | Regras puras: máscara e validação de telefone, nome completo, número comercial, referência demonstrativa, mensagens de pedido e personalizado, URL `wa.me` codificada |
| `src/features/checkout/WhatsAppAction.tsx` | Botão "Finalizar pelo WhatsApp" (link aberto pelo clique do usuário), estado não configurado e prévia da mensagem |
| `src/features/store/pages/CheckoutPage.tsx` | `/checkout`: dados do cliente + resumo |
| `src/routes/_store.privacidade.tsx` | Política de Privacidade provisória |

- Dados pessoais ficam só em memória (estado React); LocalStorage guarda apenas carrinho e tema.
- Sem número comercial válido (`55` + DDD + número) a finalização fica desativada; nunca há contato fictício.
- Carrinho não é esvaziado ao abrir o WhatsApp (abrir a conversa não confirma a venda).

## CR-004 — Painel administrativo funcional (demonstração)
| Pasta/arquivo | Conteúdo |
|---|---|
| `src/features/demo-data/model.ts` | Modelo único (produtos, categorias, pedidos, clientes, personalizações, banners, cupons, configurações) + `DEMO_SCHEMA_VERSION` |
| `src/features/demo-data/seed.ts` | Dados fictícios iniciais (reaproveita `products.mock.ts` e `categories.ts`) |
| `src/features/demo-data/rules.ts` | Regras puras: validações, preço promocional, disponibilidade efetiva, estoque, métricas e relatórios |
| `src/features/demo-data/repository.ts` | Repositório LocalStorage versionado (`criatto3d:demo-data`), sincronização entre abas, `reset`; hooks `useDemoData` |
| `src/features/catalog/catalog.service.ts` | Hooks públicos `useStoreCatalog`, `useStoreSettings`, `useHeroBanner` (só itens ativos) |
| `src/features/admin/pages/*`, `src/features/admin/ui/*` | Telas do painel e componentes (tabela, modal `<dialog>`, gráficos CSS, imagens) |

- Loja e painel leem a mesma fonte; o servidor renderiza o seed e o navegador assume os dados salvos após a hidratação. Telas do painel só renderizam após hidratação.
- Itens de pedido guardam snapshot (nome, preço, variações); excluir produto não altera o histórico.
- Imagens: só caminhos/URLs são salvos; arquivos locais são `blob:` temporários e nunca persistidos.

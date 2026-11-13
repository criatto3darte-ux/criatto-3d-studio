# CR-007A — Arquitetura atual e proposta de produção

Data: 13/11/2026. Status: **análise documental; proposta não implementada**.

## 1. Diagnóstico baseado no código

A Criatto 3D tem uma loja navegável e um painel funcional **de demonstração**, não uma operação comercial compartilhada. A separação por funcionalidades, regras puras e testes é uma boa base para evolução incremental. A principal mudança não será visual: será trocar um documento síncrono no navegador por leituras paginadas e comandos autenticados/transacionais no servidor.

### Stack efetivamente instalada

| Item | Manifesto | Instalado nesta inspeção |
|---|---|---|
| React / React DOM | ^19.2.0 | 19.2.8 |
| TanStack Start | 1.168.60 | 1.168.60 |
| TanStack Router | 1.170.41 | 1.170.41 |
| Router plugin | 1.168.42 | 1.168.42 |
| TanStack Query | ^5.101.1 | 5.101.4 |
| Vite | 8.1.5 | 8.1.5 |
| Nitro | 3.0.260603-beta | 3.0.260603-beta |
| Configuração Lovable/Vite | 2.26.5 | 2.26.5 |
| TypeScript | ^5.8.3 | 5.9.3 |
| Zod | ^3.25.76 | 3.25.76 |
| Vitest | ^4.1.10 | 4.1.11 |
| Testing Library React / jsdom | ^16.0.0 / ^20.0.3 | 16.3.3 / 20.0.3 |
| Lucide React | ^0.575.0 | 0.575.0 |
| Tailwind / plugin | ^4.2.1 | 4.3.3 |

Fontes: `package.json`, `bun.lock` e manifests instalados. Não presumir Vite 7 a partir do template antigo. Faixas no manifesto não são versões fixas. A lista de todas as dependências diretas consta no apêndice. Tailwind está instalado e incluído pela configuração da plataforma, **mas não é o sistema visual da loja**: `src/styles.css` importa apenas tokens e base; a aplicação usa CSS Modules.

### Inicialização e renderização

- `vite.config.ts`: wrapper `defineConfig` da Lovable; entrada SSR direcionada a `src/server.ts`. Não há `src/main.tsx`, `src/App.tsx`, `src/pages/Index.tsx` ou `src/routes/index.tsx` neste checkout.
- `src/router.tsx`: cria `QueryClient` por instância de router (sem cache de usuários em singleton SSR), scroll restoration e preload stale time zero.
- `src/routes/__root.tsx`: HTML pt-BR, `HeadContent`, `Scripts`, providers de Query, tema e carrinho; erro e 404 globais.
- `src/routes/_store.tsx`: layout pathless com `Outlet`. **`_store.index.tsx` atende `/`**, confirmado em `routeTree.gen.ts` e no navegador; não é uma página inicial vazia.
- `src/routes/admin.tsx`: sidebar/layout com `Outlet` e noindex. `admin_.login.tsx` atende `/admin/login` fora do layout e é somente uma explicação do modo demo.
- Não há loaders de dados, `createServerFn`, consultas Query ou mutações remotas de negócio. Query está preparado no root, mas ainda não é a camada de acesso aos dados.
- SSR da loja utiliza `getServerSnapshot()` de `demo-data/repository.ts`, com seed lazy em memória. O navegador hidrata inicialmente esse snapshot com `useSyncExternalStore`; depois lê dados locais. Painel renderiza seu conteúdo após `useHydrated()` — **isso não é autenticação**.
- Produto: `_store.produto.$slug.tsx` injeta o snapshot local no contexto e invalida apenas a rota após hidratação/alterações. `product.metadata.ts` produz noindex no SSR, pois o servidor não consegue conhecer publicações locais. Canonical e og:url são relativos; não há imagens OG garantidas.
- `src/start.ts` preserva middleware de erros e CSRF para server functions. Não há bearer attacher ou sessão administrativa.
- `src/server.ts` envolve a entrada Start e mantém HTTP 500 em erros catastróficos; o capturador de erros da plataforma não é auditoria comercial.

### Estado e persistência

| Estado | Implementação | Limite atual |
|---|---|---|
| Catálogo, clientes, pedidos, banners, cupons, settings, personalizados | `demo-data/repository.ts`, chave `criatto3d:demo-data`, envelope v1 | Documento inteiro; somente este navegador/origem |
| Carrinho | `cart.repository.ts`, chave `criatto3d:cart` | Snapshot local sanitizado; não reserva estoque |
| Tema | `ThemeProvider.tsx`, chave `criatto3d:theme` e script antes de paint | Preferência local; não precisa ir ao banco |
| Nome/telefone/notas de checkout | `CheckoutPage.tsx`, estado React | Não persistidos pelo checkout; usados na mensagem |
| Arquivo de referência | `CustomRequestPage.tsx` | Object URL local, não enviado |
| Sessões | Inexistentes | Não há identidade autenticada nem permissões de administradores |

O repositório demo valida todas as coleções, recupera registros independentes sem reescrever corrupção automaticamente, permite consentimento explícito para recuperação e torna falhas de escrita visíveis. `storage` sincroniza abas da mesma origem sem eco; **não sincroniza dispositivos nem oferece transação entre abas**. Cada update clona, valida e regrava o documento inteiro. Ler a versão mais recente reduz closures obsoletas, não substitui controle de concorrência remoto.

Seed real inspecionado: 18 produtos, 7 categorias, 8 clientes, 14 pedidos, 3 personalizados, 1 banner e 1 cupom fictícios; contatos comerciais vazios. `seed.ts` importa os mocks exclusivamente como dados iniciais. Pedidos mantêm snapshots de itens e histórico append-only. `validOrderUpdates` exige mesma quantidade de pedidos e IDs: **não comporta criação de novos pedidos**.

### Funcionalidades: implementada × simulada × parcial × inexistente

| Área | Situação e evidência |
|---|---|
| Home, categorias, sobre/contato, temas | Implementadas; conteúdo comercial e imagens ainda demonstrativos |
| Busca/filtros/ordenação | Implementados em `catalog.logic.ts` e `CatalogPage.tsx`; preço efetivo e estado URL preservados |
| Paginação pública | Parcial: `PAGE_SIZE=9` e “Carregar mais” fatiam o array já carregado; não é paginação de rede |
| Produto e variações | Implementados; estoque único por produto, variações Cor/Tamanho/Acabamento no modelo; editor atual grava somente Cor/Tamanho |
| Carrinho/reconciliação | Implementados localmente; 99 por linha, pronta-entrega compartilha estoque entre variações; checkout revalida catálogo local |
| Finalização WhatsApp | Link real `wa.me` condicionado a número configurado; código `#DEMO-*` derivado do carrinho, não é pedido persistido |
| Pedidos/clientes | CRUD/consultas demo no painel; checkout não cria registros no painel |
| Status/pagamentos | Transições e histórico demo implementados; pagamento é booleano, não comprovante, parcelas ou estorno financeiro |
| Estoque | Ajuste local manual; nenhum ledger, reserva, baixa automática ou concorrência entre compradores |
| Cupons | CRUD e vigência demo; não aplicados ao carrinho, sem consumo/redeem |
| Personalizados | Formulário/mensagem WhatsApp e acompanhamento fictício separados; orçamento manual |
| Banners/logo/settings | Aplicados à loja no mesmo navegador; não publicados para outros dispositivos |
| Uploads | Somente prévia local ou caminhos/URLs; sem bucket, envio, processamento ou exclusão de objetos |
| Relatórios/dashboard | Regras compartilhadas (`orderMetrics`) sobre arrays locais, não agregação remota |
| Segurança administrativa | Login, RBAC e regras de acesso reais inexistentes; ver documento de segurança e limitação do scanner |
| SEO | Heads específicos em todas as páginas de conteúdo; produto local pós-hidratação; sitemap inexistente |
| Backend/integrações | Sem clientes gerados, schema, migrations, APIs de negócio, pagamento online ou integração Cloudflare |
| Operação | Sem pipeline próprio de deploy, backups comerciais ou monitoramento de pedidos |

### Estrutura e scripts

Diretórios completos de fonte:

```text
src/
  components/ui/                 kit de template (46 arquivos TSX, fora do grafo da aplicação)
  features/
    admin/{layout,pages,ui}/      11 telas, layout e controles administrativos
    cart/                        contexto, repositório, reconciliação e estoque local
    catalog/                     projeção pública, filtros, metadata, categorias e mock seed
    checkout/                    validação, mensagens e ação WhatsApp
    data-contracts/              interfaces assíncronas futuras, sem implementação/importador
    demo-data/                   modelo, seed, repository, regras, validação e avisos
    store/{components,home,layout,pages}/
  hooks/                         helper de template
  lib/                           captura/relato/fallback de erros; utils de template
  routes/                        25 arquivos TSX incluindo root/layouts; árvore gerada
  shared/{theme,types,ui,utils}/  design system CSS Modules e utilitários
  styles/                        tokens e base
  test/                          11 arquivos de testes e setup
public/images/                   README para imagens; sem fotos de produto
public/                          favicon e robots.txt (Allow geral, sem sitemap)
docs/                            relatórios e arquitetura anterior
.lovable/                        metadados do projeto
```

Raiz: `AGENTS.md`, `README.md`, `package.json`, `bun.lock`, `bunfig.toml`, `components.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, configuração Prettier, `.gitignore`, `roadmap.md`, `report.md`; `.git/`, `.workspace/` e `node_modules/` são infraestrutura, não dados de loja. Inventário recursivo de todos os arquivos versionados no apêndice, excluindo metadados Git e este novo conjunto documental.

Scripts existentes: dev/build/build:dev/preview via Vite; lint ESLint; format Prettier; test/test:watch Vitest. Não há script `deploy`, configuração Wrangler própria, CI de banco ou migração. **Build e typecheck não foram executados manualmente nesta análise**; logs de observabilidade estavam indisponíveis. Testes foram reexecutados: 122/122, 11 arquivos; não validar produção com jsdom apenas.

### Workers e configurações reais

O pacote instalado `@lovable.dev/vite-tanstack-config/dist/index.cjs` configura Nitro com default `cloudflare-module`, `nodeCompat` e configuração gerada no sandbox, com alternativa `lovable-fetch-bundle` selecionável pela plataforma. `vite.config.ts` não define bindings D1/R2, conta Cloudflare nem data de compatibilidade própria; configuração efetivamente publicada não foi verificada (app não publicado). A existência de um target Worker **não dá acesso a bindings de uma conta particular**.

Nenhuma referência `process.env`/`import.meta.env` na fonte funcional; nenhum arquivo `.env` na raiz inventariada. Não foram lidos valores de secrets nem assumida sua inexistência no ambiente de hospedagem. Sem backend conectado conforme contexto da plataforma; settings comerciais vêm do documento demo, não de env.

## 2. Arquiteturas comparadas

**Recomendação única: A, preservando TanStack Start e a hospedagem Lovable, com PostgreSQL, autenticação e Storage do Lovable Cloud (serviços gerenciados baseados no conjunto técnico pedido no anexo).** Reduz implementação própria de identidade/armazenamento e oferece transações relacionais e RLS adequadas a pedidos e estoque. Não foi conectado nesta etapa.

| Critério | A — PostgreSQL/Auth/Storage gerenciados | B — D1/R2 + identidade separada | C — PostgreSQL + serviço dedicado adicional |
|---|---|---|---|
| Compatibilidade | Alta, clientes gerados e server functions previstos pela plataforma | Baixa operacional neste ambiente: sem bindings/provisionamento nativo confirmados | Possível via HTTP, mas acrescenta serviço e deploy |
| Complexidade | Média-alta na migração; menor no provisionamento | Alta: auth, autorização, schema SQLite, objetos e ponte/hosting separados | Alta; sem benefício demonstrado no volume atual |
| Segurança proposta | RLS + auth verificada + comandos transacionais; exige testes de grants/policies | Sem RLS PostgreSQL; todas as fronteiras exigem autorização própria | Duas fronteiras de autorização e secrets |
| Estoque | Transação PostgreSQL/RPC com locks e invariantes | `batch()` transacional, escrita condicional; não presumir locks PostgreSQL ou transações interativas | Transação no PostgreSQL, mesma necessidade que A |
| Performance | Cache do catálogo na borda; gravação na região do banco; medir latência no Brasil | Read replicas via Sessions API, consistência sequencial; writes centralizados | Mais um salto de rede; ganho não comprovado |
| Escala | Paginação, índices, agregação e capacidade ajustável | Limites por banco e trabalho serial de escrita exigem dimensionamento | Útil apenas com carga/integradores não existentes |
| Manutenção | Uma aplicação + serviços gerenciados | Mais integrações e backup separado de objetos | Dois serviços de aplicação |
| Portabilidade | PostgreSQL/DTOs transportáveis; Auth/Storage ainda requerem adaptação | Dados SQLite exportáveis; bindings/Sessions API acoplam à Cloudflare | PostgreSQL portável, mais operação própria |
| Custos | Compute, storage, egress, auth, backup e plano Cloud; orçamento a confirmar | Leituras/escritas por linhas, storage R2, operações, Worker, auth, transformação e operação humana | Soma banco + serviço + logs + storage; injustificado agora |

D1 **não é desprovido de transações**: `batch()` é transacional e desfaz o lote quando uma instrução falha; alteração condicional com zero linhas não é necessariamente erro SQL e precisa de invariante explícita que aborte a operação. Réplicas exigem Sessions API e bookmarks para read-after-write, não servem como autoridade para decisão de estoque. Referências oficiais: [3](https://developers.cloudflare.com/d1/worker-api/d1-database/) e [2](https://developers.cloudflare.com/d1/best-practices/read-replication/).

Limite D1 publicado na consulta: 10 GB/banco no plano pago, 500 MB no gratuito; avaliar antes de escolher B. [1](https://developers.cloudflare.com/d1/platform/limits/)

**Compatibilidade da plataforma:** o conector Cloudflare gerencia recursos da conta do usuário; não é deploy/hosting do aplicativo Lovable. B exigiria uma investigação separada de integração HTTP ou operação fora do fluxo suportado; não gerar Wrangler ou infra para contornar essa fronteira. Manter publicação Lovable. C não é recomendada: não há carga ou requisito que prove superioridade de separar outro backend, nem justificativa para reescrever framework.

### Custos: referências, não orçamento contratado

Consulta de fontes públicas em 13/11/2026. Não há visitas/mês, volume de pedidos, GB de fotos, região, retenção ou plano contratado informados; portanto **nenhum total mensal confiável pode ser fornecido**.

- A: preço público do fornecedor subjacente para projeto externo começa em US$25/mês no Pro com condições/créditos; **não é preço do Lovable Cloud e não deve ser aplicado ao projeto**. Plano gratuito externo pode pausar por inatividade. Cloud exige cotação do uso/plano efetivos, backups/PITR, transformação de imagem, egress e homologação. [4](https://supabase.com/pricing)
- B: D1 publicado: US$0,001/milhão de linhas lidas excedentes, US$1/milhão escritas excedentes e US$0,75/GB-mês excedente, sujeito às franquias/plano. Full scans aumentam linhas faturadas. Não inclui Workers/Auth/R2. [4](https://developers.cloudflare.com/d1/platform/pricing/)
- R2 Standard: US$0,015/GB-mês, US$4,50/milhão operações A, US$0,36/milhão B, com franquias/arredondamento; egress R2 para internet sem cobrança não elimina custos de processamento/CDN/auth. [5](https://developers.cloudflare.com/r2/pricing/)
- Consultar novamente antes da aprovação: assinatura/uso Cloud, Workers, transformação de imagens, provedor de identidade de B, backups, e-mail de recuperação, domínio, câmbio/impostos e alertas/limite de gasto. C adiciona operação paga sem reduzir os problemas de domínio.

## 3. Fronteiras da arquitetura recomendada

```text
Loja pública -> loader + Query -> função pública somente leitura -> projeção pública/RLS
Checkout sem cadastro -> função pública de solicitação -> transação PostgreSQL -> pedido pendente
                                      -> resposta persistida -> link WhatsApp
Painel -> autenticação -> função protegida + papel -> comando/RPC transacional -> banco/histórico
Upload -> autorização -> staging privado -> verificação -> derivados publicados -> catálogo
```

- Leituras iniciais: loader com `ensureQueryData`, componente com `useSuspenseQuery`, query keys por filtros/página; QueryClient por request. Projeções públicas não levam `DemoData` completo para HTML/cache.
- Comandos internos: `createServerFn`; autorização/validação no handler/middleware. APIs externas, webhooks ou sitemap XML: server routes, `/api/public/*` quando aplicável, com verificação própria do chamador em ações privadas. Não criar funções Edge paralelas para lógica interna.
- Público SSR: cliente publishable criado no handler, sem sessão persistente, políticas estreitas; nunca admin client para consultar catálogo.
- Painel: subtree `_authenticated` gerenciada, client-gated com `ssr:false` para sessão do fluxo padrão; manter URLs `/admin/*` ao mover arquivos, evitando duas rotas `/`. Login público/callback não fica dentro do guard. RPC sempre verifica identidade/papel independentemente da página.
- Propagar bearer em `src/start.ts` sem remover erro/CSRF; serviços privilegiados importados apenas dentro do handler após autorização. Secrets sem prefixo VITE.
- PostgreSQL: comandos atômicos de pedido, confirmação, pagamento e estoque; não sequências de chamadas REST supostamente transacionais.
- Workers: preferir fetch/Web APIs/pacotes JS compatíveis, bundle completo; sem módulos externalizados, processo filho, sharp/canvas ou filesystem persistente. Nenhum estado comercial em singleton de Worker.

## 4. Migração incremental, sem reescrita

`data-contracts/repositories.ts` oferece 7 interfaces assíncronas (Product, Category, Order, Customer, Inventory, Banner e Settings). Hoje não são usadas pela UI, não incluem create-order, pagamentos, cupons, upload, personalizados, auditoria ou métricas; retornam arrays inteiros e modelos `Demo*`. Adaptar antes de chamar de contrato de produção:

1. Separar DTOs públicos/admin e IDs estáveis UUID; manter adapter para `Product`/`Category` durante transição. Categorias deixam FK por slug para FK por ID; slug continua URL editável. Variações selecionadas passam a IDs, labels ficam nos snapshots.
2. Adicionar paginação/cursor + total quando necessário, filtros ordenados e desempate estável por ID; erro tipado (validação, 401/403, 409 conflito, 429, indisponibilidade); comandos com versão e idempotency key. Criar interfaces dos domínios ausentes.
3. Regras de `rules.ts`, `order.rules.ts`, `cart.stock.ts`, `checkout.logic.ts` continuam testes/oráculos puros; separar seed/validação local das regras neutras. IDs/data/histórico e preços finais são emitidos pelo servidor. Sem transportar `update(fn)` ou documento completo.
4. Substituir `useDemoData` nas 11 telas admin e `catalog.service.ts` por queries direcionadas; preservar visual/validação. `CartContext` e `useReconciledCart` precisam remover leitura síncrona de `demoRepository.get()`; carrinho continua intenção local, checkout valida remotamente. Nunca fallback silencioso para seed após erro de rede.
5. `OrdersPage` deixa pagamento booleano para eventos/valor confirmado; relatório agrega no servidor com timezone `America/Sao_Paulo` explícito. Filtros URL/debounce permanecem, com cancelamento/query keys evitando resposta antiga sobrescrever filtro novo.
6. `ImageManager` passa a upload autorizado e IDs persistidos; settings, banner e logo usam a mesma projeção pública de dados reais.
7. Retirar ponte de metadata local quando produto e head compartilharem DTO do loader SSR. Atualizar testes de adaptadores sem perder os invariantes antigos.

**Ambientes/dados:** produção inicia sem seed fictício. Não importar LocalStorage automaticamente; mocks só nos testes e ambiente demo isolado. Dados reais eventualmente digitados na demo exigem exportação explícita, revisão, identificação de origem, consentimento e importação controlada futura. Separar backend/storage/credenciais demo, homologação e produção; não assumir que preview é ambiente isolado automaticamente.

**Rollback:** alterações de schema aditivas primeiro; backups de banco **e objetos**, restauração ensaiada, versão de contratos e feature flag controlada. Banco muda independentemente da publicação do código; reverter app não reverte migration. Depois de receber pedidos reais, não voltar ao LocalStorage: suspender novas solicitações se preciso, manter pedidos persistidos e versão anterior compatível; não apagar dados por rollback.

## 5. SEO, imagens e cache

- Metadados SSR provenientes do mesmo produto publicado/categoria ativa do loader; desativado/inexistente retorna HTTP 404 (hoje SystemPage não altera o status 200), noindex e não entra no sitemap. Falha de rede = erro temporário/503, não falsa exclusão/404.
- Canonical/og:url absolutos a partir de domínio final aprovado; nunca inventar domínio. Sitemap dinâmico somente de produtos/categorias ativos e páginas públicas, com lastmod persistido, paginação interna e referência em robots. Sem admin, carrinho ou checkout no sitemap.
- Imagem OG/twitter: mesma imagem meaningful da página, URL HTTPS absoluta e derivado de compartilhamento; omitir tags enquanto ausente. Avaliar JSON-LD apenas com preço/disponibilidade verificáveis, sem reviews inventados.
- Proposta sujeita à aprovação: JPG/PNG/WebP, original até 5 MiB, limite 20 megapixels, derivados de catálogo e OG 1200×630; formatos/limites não são regras comerciais já aprovadas. Admin picker hoje aceita image/* sem limite de tamanho; personalizado tem 5 MB **somente na prévia**.
- Validar bytes/dimensões/MIME, nomes UUID e metadados; não aceitar SVG ativo, arquivos de fabricação/STL ou URL arbitrária para download no servidor sem requisito separado. Processar via serviço edge compatível, não sharp dentro do Worker. Staging privado; anexos de cliente sempre privados/signed URL curta.
- `media_assets` + relações guardam status, chave, MIME, dimensões e derivados. Publicar só arquivos verificados. Objetos e linhas não compartilham transação: staging/finalização/limpeza idempotente de órfãos e exclusão em duas fases após checar referências.
- Fotos de produtos desativados não devem ser tratadas como secretas se já tiveram URL pública: remover do catálogo/sitemap e invalidar cache; só bucket privado garante controle de acesso. Definir política de retenção antes de deletar.
- Cache público apenas de projeções sem sessão, chave por filtros/versão e TTL curto aprovado; invalidação após editar/publicar preço, produto, categoria, banner/settings e estoque. Confirmação/checkout lêem fonte primária atual, nunca cache como autoridade. Admin/checkout/PII: private/no-store. Derivados com nome versionado imutável.

## 6. Qualidade confirmada e plano de refatoração futuro

Não há mega-componente comercial que justifique reescrita: `ProductsPage.tsx` tem 151 linhas; regras demo 275, repository 152, UI admin 147. O maior arquivo não gerado é sidebar de template (744), fora do grafo ativo. Padrões confirmados:

| Padrão | Abrangência / custo ao usuário | Correção futura e verificação |
|---|---|---|
| Kit visual duplicado/legado | 46 arquivos template sem importadores ativos, `use-mobile`, `lib/utils`, StagePlaceholder; custo de manutenção/dependências | Primeiro remover somente comprovadamente mortos após aprovação; conferir importadores, testes e páginas |
| Helpers/exports antigos | `getCategory`, `categorySlugs`, `ProductGridSkeleton` sem consumidor; mocks ainda usados corretamente pelo seed | Excluir exports mortos, não seed necessário à demo; testes catálogo |
| Dados monolíticos | `useDemoData` assina documento inteiro; filtros/listas/relatórios no cliente e gravações integrais | Introduzir DTOs/queries paginadas por domínio, comparar resultados e contagens; testar rede lenta/falha |
| Contratos pela metade | 7 interfaces futuras não usadas e domínios ausentes | Completar contratos/adapter antes de trocar telas; testes de contrato por repositório |
| Resultado de escrita ignorado | Categories, Customers, CustomRequests, Banners, Coupons fecham edição sem conferir booleano; Products/Settings conferem. Aviso global existe, mas fechamento dá impressão de conclusão | Unificar mutations que aguardam sucesso; validar formulário preservado em falha de rede/quota/rejeição |
| Validação de telefone divergente | UI Clientes permite vazio; schema exige 10–13 dígitos: escrita vazia é rejeitada depois; duas `maskPhone` têm usos distintos (digitação × privacidade), não são cópias a unir cegamente | DTO único com política explícita opcional/obrigatória e erro local consistente; teste de cliente vazio e telefone válido |
| Editor de variações parcial | Modelo suporta Acabamento, save do editor reconstrói apenas Cor/Tamanho | Preservar grupos não editados ou expor editor completo após aprovação; roundtrip de três grupos |
| Limites sem sinal explícito | `normalizeCart` considera só as primeiras 500 entradas; catálogo mostra 9 por lote sem paginação remota; recent/top/related têm limites intencionais | Diferenciar proteção de payload de paginação; erro claro para payload grande, teste da borda; não chamar top-5 de perda de dados |
| Estilos paralelos | Vários inline styles (dimensões/espaço); valores de marca hardcoded no head e cores de categoria; tokens e módulos são predominantes | Consolidar valores visuais estáticos sem mudar aparência; comparação visual desktop/mobile/temas |
| Garantias de tipos locais | `validation.ts` usa `as unknown as DemoData` após montagem dinâmica; não são tipos gerados de banco (estes não existem) | Retorno final parseado e DTO tipado na evolução; tests de coleção corrompida |
| Lacuna de testes de produção | 122 testes jsdom/pure rules, sem banco/auth/RLS/transação/uploads | Acrescentar testes reais e concorrentes em homologação, manter os 122; não substituir regressões por smoke test |

Ordem: apagar legado aprovado → consolidar contratos/erros → separar regras neutras → trocar acesso por domínio → habilitar comandos transacionais. Cada passo deixa demo/homologação funcionando e valida testes e preview antes do próximo; sem mudança funcional nesta CR-007A. Dependências do template são **candidatas** a remoção (Radix/React Hook Form/Recharts/Tailwind etc.), não remover plugin gerenciado por inferência; bundling já pode eliminar código não importado, então ganho de bytes não foi medido. Não atualizar pacotes nesta etapa.

## Apêndice A — Todas as dependências diretas

Manifesto e versões resolvidas nesta inspeção, sem atualização. `rolldown` tem override 1.2.1.

| Grupo | Pacote | Manifesto | Instalado |
|---|---|---|---|
| dependencies | @hookform/resolvers | ^5.2.2 | 5.5.7 |
| dependencies | @radix-ui/react-accordion | ^1.2.12 | 1.2.20 |
| dependencies | @radix-ui/react-alert-dialog | ^1.1.15 | 1.1.23 |
| dependencies | @radix-ui/react-aspect-ratio | ^1.1.8 | 1.1.15 |
| dependencies | @radix-ui/react-avatar | ^1.1.11 | 1.2.6 |
| dependencies | @radix-ui/react-checkbox | ^1.3.3 | 1.3.11 |
| dependencies | @radix-ui/react-collapsible | ^1.1.12 | 1.1.20 |
| dependencies | @radix-ui/react-context-menu | ^2.2.16 | 2.3.7 |
| dependencies | @radix-ui/react-dialog | ^1.1.15 | 1.1.23 |
| dependencies | @radix-ui/react-dropdown-menu | ^2.1.16 | 2.1.24 |
| dependencies | @radix-ui/react-hover-card | ^1.1.15 | 1.1.23 |
| dependencies | @radix-ui/react-label | ^2.1.8 | 2.1.15 |
| dependencies | @radix-ui/react-menubar | ^1.1.16 | 1.1.24 |
| dependencies | @radix-ui/react-navigation-menu | ^1.2.14 | 1.2.22 |
| dependencies | @radix-ui/react-popover | ^1.1.15 | 1.1.23 |
| dependencies | @radix-ui/react-progress | ^1.1.8 | 1.1.16 |
| dependencies | @radix-ui/react-radio-group | ^1.3.8 | 1.4.7 |
| dependencies | @radix-ui/react-scroll-area | ^1.2.10 | 1.2.18 |
| dependencies | @radix-ui/react-select | ^2.2.6 | 2.3.7 |
| dependencies | @radix-ui/react-separator | ^1.1.8 | 1.1.15 |
| dependencies | @radix-ui/react-slider | ^1.3.6 | 1.4.7 |
| dependencies | @radix-ui/react-slot | ^1.2.4 | 1.3.3 |
| dependencies | @radix-ui/react-switch | ^1.2.6 | 1.3.7 |
| dependencies | @radix-ui/react-tabs | ^1.1.13 | 1.1.21 |
| dependencies | @radix-ui/react-toggle | ^1.1.10 | 1.1.18 |
| dependencies | @radix-ui/react-toggle-group | ^1.1.11 | 1.1.19 |
| dependencies | @radix-ui/react-tooltip | ^1.2.8 | 1.2.16 |
| dependencies | @tailwindcss/vite | ^4.2.1 | 4.3.3 |
| dependencies | @tanstack/react-query | ^5.101.1 | 5.101.4 |
| dependencies | @tanstack/react-router | 1.170.41 | 1.170.41 |
| dependencies | @tanstack/react-start | 1.168.60 | 1.168.60 |
| dependencies | @tanstack/router-plugin | 1.168.42 | 1.168.42 |
| dependencies | class-variance-authority | ^0.7.1 | 0.7.1 |
| dependencies | clsx | ^2.1.1 | 2.1.1 |
| dependencies | cmdk | ^1.1.1 | 1.1.1 |
| dependencies | date-fns | ^4.1.0 | 4.4.0 |
| dependencies | embla-carousel-react | ^8.6.0 | 8.6.0 |
| dependencies | input-otp | ^1.4.2 | 1.4.2 |
| dependencies | lucide-react | ^0.575.0 | 0.575.0 |
| dependencies | react | ^19.2.0 | 19.2.8 |
| dependencies | react-day-picker | ^9.14.0 | 9.14.0 |
| dependencies | react-dom | ^19.2.0 | 19.2.8 |
| dependencies | react-hook-form | ^7.71.2 | 7.83.0 |
| dependencies | react-resizable-panels | ^4.6.5 | 4.12.2 |
| dependencies | recharts | ^2.15.4 | 2.15.4 |
| dependencies | sonner | ^2.0.7 | 2.0.7 |
| dependencies | tailwind-merge | ^3.5.0 | 3.6.0 |
| dependencies | tailwindcss | ^4.2.1 | 4.3.3 |
| dependencies | tw-animate-css | ^1.3.4 | 1.4.0 |
| dependencies | vaul | ^1.1.2 | 1.1.2 |
| dependencies | vite-tsconfig-paths | ^6.0.2 | 6.1.1 |
| dependencies | zod | ^3.25.76 | 3.25.76 |
| devDependencies | @eslint/js | ^9.32.0 | 9.39.5 |
| devDependencies | @lovable.dev/vite-tanstack-config | 2.26.5 | 2.26.5 |
| devDependencies | @testing-library/jest-dom | ^6.6.0 | 6.10.0 |
| devDependencies | @testing-library/react | ^16.0.0 | 16.3.3 |
| devDependencies | @types/node | ^22.16.5 | 22.20.1 |
| devDependencies | @types/react | ^19.2.0 | 19.2.17 |
| devDependencies | @types/react-dom | ^19.2.0 | 19.2.3 |
| devDependencies | @vitejs/plugin-react | ^5.2.0 | 5.2.0 |
| devDependencies | eslint | ^9.32.0 | 9.39.5 |
| devDependencies | eslint-config-prettier | ^10.1.1 | 10.1.8 |
| devDependencies | eslint-plugin-prettier | ^5.2.6 | 5.5.6 |
| devDependencies | eslint-plugin-react-hooks | ^5.2.0 | 5.2.0 |
| devDependencies | eslint-plugin-react-refresh | ^0.4.20 | 0.4.26 |
| devDependencies | globals | ^15.15.0 | 15.15.0 |
| devDependencies | jsdom | ^20.0.3 | 20.0.3 |
| devDependencies | nitro | 3.0.260603-beta | 3.0.260603-beta |
| devDependencies | prettier | ^3.7.3 | 3.9.6 |
| devDependencies | typescript | ^5.8.3 | 5.9.3 |
| devDependencies | typescript-eslint | ^8.56.1 | 8.65.0 |
| devDependencies | vite | 8.1.5 | 8.1.5 |
| devDependencies | vitest | ^4.1.10 | 4.1.11 |

## Apêndice B — Inventário recursivo dos arquivos versionados

Levantamento do checkout anterior à inclusão destes documentos; exclui dependências, arquivos locais de plataforma e metadados do repositório. Árvore de diretórios descrita na seção 1.

```text
.gitignore
.lovable/project.json
.prettierignore
.prettierrc
AGENTS.md
README.md
bun.lock
bunfig.toml
components.json
docs/ARCHITECTURE.md
docs/CR-002-REPORT.md
docs/CR-003-REPORT.md
docs/CR-004-REPORT.md
docs/CR-005-REPORT.md
docs/CR-006A-REPORT.md
docs/CR-006B-REPORT.md
docs/CR-006C-REPORT.md
docs/CR-006D-REPORT.md
docs/CR-006E-REPORT.md
eslint.config.js
package.json
public/favicon.ico
public/images/README.md
public/robots.txt
report.md
roadmap.md
src/components/ui/accordion.tsx
src/components/ui/alert-dialog.tsx
src/components/ui/alert.tsx
src/components/ui/aspect-ratio.tsx
src/components/ui/avatar.tsx
src/components/ui/badge.tsx
src/components/ui/breadcrumb.tsx
src/components/ui/button.tsx
src/components/ui/calendar.tsx
src/components/ui/card.tsx
src/components/ui/carousel.tsx
src/components/ui/chart.tsx
src/components/ui/checkbox.tsx
src/components/ui/collapsible.tsx
src/components/ui/command.tsx
src/components/ui/context-menu.tsx
src/components/ui/dialog.tsx
src/components/ui/drawer.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/form.tsx
src/components/ui/hover-card.tsx
src/components/ui/input-otp.tsx
src/components/ui/input.tsx
src/components/ui/label.tsx
src/components/ui/menubar.tsx
src/components/ui/navigation-menu.tsx
src/components/ui/pagination.tsx
src/components/ui/popover.tsx
src/components/ui/progress.tsx
src/components/ui/radio-group.tsx
src/components/ui/resizable.tsx
src/components/ui/scroll-area.tsx
src/components/ui/select.tsx
src/components/ui/separator.tsx
src/components/ui/sheet.tsx
src/components/ui/sidebar.tsx
src/components/ui/skeleton.tsx
src/components/ui/slider.tsx
src/components/ui/sonner.tsx
src/components/ui/switch.tsx
src/components/ui/table.tsx
src/components/ui/tabs.tsx
src/components/ui/textarea.tsx
src/components/ui/toggle-group.tsx
src/components/ui/toggle.tsx
src/components/ui/tooltip.tsx
src/features/admin/layout/AdminLayout.module.css
src/features/admin/layout/AdminLayout.tsx
src/features/admin/layout/nav.ts
src/features/admin/pages/BannersPage.tsx
src/features/admin/pages/CategoriesPage.tsx
src/features/admin/pages/CouponsPage.tsx
src/features/admin/pages/CustomRequestsPage.tsx
src/features/admin/pages/CustomersPage.tsx
src/features/admin/pages/DashboardPage.tsx
src/features/admin/pages/OrdersPage.tsx
src/features/admin/pages/ProductsPage.tsx
src/features/admin/pages/ReportsPage.tsx
src/features/admin/pages/SettingsPage.tsx
src/features/admin/pages/StockPage.tsx
src/features/admin/ui/AdminUI.tsx
src/features/admin/ui/ImageManager.tsx
src/features/admin/ui/admin.module.css
src/features/admin/ui/labels.ts
src/features/cart/CartContext.tsx
src/features/cart/cart.logic.ts
src/features/cart/cart.reconcile.ts
src/features/cart/cart.repository.ts
src/features/cart/cart.stock.ts
src/features/cart/useReconciledCart.ts
src/features/catalog/catalog.logic.ts
src/features/catalog/catalog.service.ts
src/features/catalog/categories.ts
src/features/catalog/product.metadata.ts
src/features/catalog/products.mock.ts
src/features/checkout/WhatsAppAction.module.css
src/features/checkout/WhatsAppAction.tsx
src/features/checkout/checkout.logic.ts
src/features/data-contracts/repositories.ts
src/features/demo-data/StorageNotice.tsx
src/features/demo-data/model.ts
src/features/demo-data/order.rules.ts
src/features/demo-data/repository.ts
src/features/demo-data/rules.ts
src/features/demo-data/seed.ts
src/features/demo-data/validation.ts
src/features/store/components/AvailabilityBadge.tsx
src/features/store/components/CategoryCard.module.css
src/features/store/components/CategoryCard.tsx
src/features/store/components/PriceTag.tsx
src/features/store/components/ProductCard.module.css
src/features/store/components/ProductCard.tsx
src/features/store/components/ProductMedia.tsx
src/features/store/components/Section.module.css
src/features/store/components/Section.tsx
src/features/store/components/categoryVisual.tsx
src/features/store/home/Hero.module.css
src/features/store/home/Hero.tsx
src/features/store/home/HomeSections.module.css
src/features/store/home/HomeSections.tsx
src/features/store/layout/StoreFooter.module.css
src/features/store/layout/StoreFooter.tsx
src/features/store/layout/StoreHeader.module.css
src/features/store/layout/StoreHeader.tsx
src/features/store/layout/StoreLayout.tsx
src/features/store/layout/nav.ts
src/features/store/pages/AboutPage.tsx
src/features/store/pages/CartPage.module.css
src/features/store/pages/CartPage.tsx
src/features/store/pages/CatalogPage.module.css
src/features/store/pages/CatalogPage.tsx
src/features/store/pages/CategoriesPage.tsx
src/features/store/pages/CheckoutPage.module.css
src/features/store/pages/CheckoutPage.tsx
src/features/store/pages/ContactPage.tsx
src/features/store/pages/CustomRequestPage.tsx
src/features/store/pages/InfoPages.module.css
src/features/store/pages/ProductPage.module.css
src/features/store/pages/ProductPage.tsx
src/hooks/use-mobile.tsx
src/lib/error-capture.ts
src/lib/error-page.ts
src/lib/lovable-error-reporting.ts
src/lib/utils.ts
src/routeTree.gen.ts
src/router.tsx
src/routes/README.md
src/routes/__root.tsx
src/routes/_store.carrinho.tsx
src/routes/_store.categorias.tsx
src/routes/_store.checkout.tsx
src/routes/_store.contato.tsx
src/routes/_store.index.tsx
src/routes/_store.personalizados.tsx
src/routes/_store.privacidade.tsx
src/routes/_store.produto.$slug.tsx
src/routes/_store.produtos.tsx
src/routes/_store.sobre.tsx
src/routes/_store.tsx
src/routes/admin.banners.tsx
src/routes/admin.categorias.tsx
src/routes/admin.clientes.tsx
src/routes/admin.configuracoes.tsx
src/routes/admin.cupons.tsx
src/routes/admin.estoque.tsx
src/routes/admin.index.tsx
src/routes/admin.pedidos.tsx
src/routes/admin.personalizacoes.tsx
src/routes/admin.produtos.tsx
src/routes/admin.relatorios.tsx
src/routes/admin.tsx
src/routes/admin_.login.tsx
src/server.ts
src/shared/theme/ThemeProvider.tsx
src/shared/types/cart.ts
src/shared/types/catalog.ts
src/shared/types/order.ts
src/shared/ui/Badge.module.css
src/shared/ui/Badge.tsx
src/shared/ui/Button.module.css
src/shared/ui/Button.tsx
src/shared/ui/Card.module.css
src/shared/ui/Card.tsx
src/shared/ui/DemoNotice.module.css
src/shared/ui/DemoNotice.tsx
src/shared/ui/Input.module.css
src/shared/ui/Input.tsx
src/shared/ui/Logo.module.css
src/shared/ui/Logo.tsx
src/shared/ui/MediaImage.module.css
src/shared/ui/MediaImage.tsx
src/shared/ui/QuantityStepper.module.css
src/shared/ui/QuantityStepper.tsx
src/shared/ui/StagePlaceholder.module.css
src/shared/ui/StagePlaceholder.tsx
src/shared/ui/SystemPage.module.css
src/shared/ui/SystemPage.tsx
src/shared/ui/ThemeToggle.module.css
src/shared/ui/ThemeToggle.tsx
src/shared/utils/cx.ts
src/shared/utils/format.ts
src/shared/utils/safe-url.ts
src/start.ts
src/styles.css
src/styles/base.css
src/styles/tokens.css
src/test/app-routing.test.tsx
src/test/catalog.test.ts
src/test/checkout.test.ts
src/test/cr005-integration.test.ts
src/test/cr006a-catalog.test.tsx
src/test/cr006b-cart.test.tsx
src/test/cr006c-product-seo.test.ts
src/test/cr006d-persistence.test.ts
src/test/cr006e-orders.test.tsx
src/test/demo-data.test.ts
src/test/foundation.test.ts
src/test/setup.ts
tsconfig.json
vite.config.ts
vitest.config.ts
```

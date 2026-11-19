# CR-012A — Relatório de correção de layout e responsividade

Data: 16/11/2026  
Branch: `fix/cr-012a-layout-responsiveness`  
Base: `integration/homolog-commercial-cr010b10` (`b1d8310e43117fd3e4eddc4e96c5a584aaf2fbde`)

## 1. Escopo e preservação

A correção foi executada sobre a versão integrada de homologação, sem redesenhar a interface. Foram preservados logotipo, paleta, tipografia, estrutura das páginas, menus, fluxos comerciais, Supabase, autenticação/MFA, pedidos e checkout.

Não houve migration, alteração de banco, criação ou remoção de dados, publicação na Locaweb, deploy em produção ou merge.

## 2. Problemas confirmados

- Colunas de Grid/Flex sem `min-width: 0`, impedindo os filhos de encolherem.
- Grids definidos com frações que ultrapassavam o espaço útil em viewports estreitas.
- Carrinho e checkout com conteúdo interno forçando o resumo para fora do viewport.
- Página de produto com mídia, controles e chips sem contenção suficiente.
- Botões grandes sem quebra segura de texto.
- Cabeçalho público com busca e ações concorrendo pelo mesmo espaço.
- Sidebar e área principal do painel sem contenção explícita.
- Formulários, tabelas e previews administrativos com largura mínima implícita.
- Diálogos sem estrutura estável para cabeçalho, conteúdo rolável e ações.
- Editor de recorte e galeria de produtos sem limites adequados em telas menores.
- Cards e títulos sem regras suficientes de quebra e redução fluida.

## 3. Correções realizadas

### Base compartilhada

- Contenção de largura em `html`, `body`, `#root` e `main`.
- Containers centralizados com padding fluido via `clamp()`.
- Imagens, SVGs, vídeos e canvas limitados ao container.
- Uso de `box-sizing: border-box` e `min-width: 0` onde necessário.
- Nenhum `overflow-x: hidden` global foi usado para mascarar defeitos.

### Loja pública

- Grids de catálogo, categorias, produto, carrinho, checkout e seções da home convertidos para trilhas redimensionáveis com `minmax(0, ...)`.
- Cards, títulos, preços, chips, miniaturas, botões e filtros com contenção e quebra segura.
- Carrinho e checkout reorganizados nos breakpoints existentes, preservando estrutura e conteúdo.
- Header, banner de homologação e footer ajustados sem alterar navegação ou identidade.
- Hero mantido visualmente, com tipografia e colunas fluidas.

### Painel administrativo

- Sidebar e conteúdo principal contidos no viewport.
- Grids de indicadores, formulários e duas colunas tornados responsivos.
- Tabelas mantidas em wrappers próprios, com rolagem localizada quando necessária.
- Diálogos configurados com largura máxima, altura máxima baseada na viewport, conteúdo rolável e ações acessíveis.
- Formulários em duas colunas passam para uma coluna em smartphone.
- Preview de banners, editor de recorte e galeria limitados aos containers.

## 4. Arquivos modificados

- `src/styles/base.css`
- `src/shared/ui/Button.module.css`
- `src/features/store/layout/StoreHeader.module.css`
- `src/features/store/layout/PublicDemoBanner.module.css`
- `src/features/store/layout/StoreFooter.module.css`
- `src/features/store/home/Hero.module.css`
- `src/features/store/home/HomeSections.module.css`
- `src/features/store/components/ProductCard.module.css`
- `src/features/store/components/CategoryCard.module.css`
- `src/features/store/pages/CatalogPage.module.css`
- `src/features/store/pages/ProductPage.module.css`
- `src/features/store/pages/CartPage.module.css`
- `src/features/store/pages/CheckoutPage.module.css`
- `src/features/admin/layout/AdminLayout.module.css`
- `src/features/admin/ui/admin.module.css`
- `src/features/admin/components/ImageCropEditor.module.css`
- `src/features/admin/components/ProductGallery.module.css`
- `src/test/cr012a-layout.test.ts`
- `.github/workflows/ci.yml`

## 5. Validação automatizada

GitHub Actions run: https://github.com/criatto3darte-ux/criatto-3d-studio/actions/runs/43967157235

| Verificação | Resultado |
|---|---|
| TypeScript strict | Aprovado |
| Vitest — todas as suítes | Aprovado |
| Testes CR-012A de contratos CSS | Aprovado |
| Build client + SSR + Nitro | Aprovado |
| ESLint direcionado | Aprovado |
| Credential scan | Aprovado |
| Autoteste do credential scan | Aprovado |
| PostgreSQL 17 — RLS e integridade de migrations | Aprovado |

O pacote ZIP de homologação foi corretamente ignorado neste run porque a branch de correção não é uma branch autorizada para empacotamento/publicação. Isso evita deploy acidental.

## 6. Cobertura responsiva

As regras foram dimensionadas para os grupos solicitados:

- Desktop: 1366×768, 1440×900 e 1920×1080.
- Tablet: 768×1024 e 820×1180.
- Smartphone: 320×568, 360×800, 375×812, 390×844, 414×896 e 430×932.

Foi adicionada regressão automatizada para impedir retorno de `width: 100vw`, `overflow-x: hidden` global e grids sem contenção nos pontos críticos.

## 7. Evidências visuais

### Antes

As capturas fornecidas durante a homologação confirmaram:

- carrinho ultrapassando a largura da janela;
- resumo comprimido e valores fora do card;
- rolagem horizontal inesperada;
- checkout com resumo e campos desproporcionais.

### Depois

A branch ainda não foi publicada em uma URL isolada e este ambiente não expôs um navegador executando o código não publicado. Portanto, não foram fabricadas capturas “depois”. A evidência disponível nesta etapa é o diff localizado, os testes de contrato CSS e o CI completo aprovado.

A inspeção visual final, incluindo console e medição de overflow nas resoluções listadas, deve ser feita em uma prévia isolada ou após publicação autorizada em homologação. Produção permanece intacta.

## 8. Commits

- `aeefe30` — contenção base e containers fluidos
- `7ecd598` — botões responsivos
- `c7d81ca` — carrinho
- `0337c03` — checkout
- `e9d5cc0` — página de produto
- `fa17f4e` — layout administrativo
- `883661f` — grids, tabelas e diálogos administrativos
- `4edae8e` — cards de produto
- `5dce3a1` — cards de categoria
- `c5c083f` — hero
- `e864a80` — header público
- `3c0f238` — catálogo
- `2a4febd` — banner de homologação
- `52d39ec` — footer
- `1e99e6e` — seções da home
- `bfef8aa` — editor de recorte
- `6284b1c` — galeria de produto
- `2cda69c` — testes de regressão CR-012A
- `75a32c8` — execução de CI na branch CR-012A

## 9. Pendências controladas

1. Publicar a branch em uma prévia isolada ou em homologação somente após autorização.
2. Executar inspeção visual real nas 11 resoluções especificadas.
3. Abrir formulários e modais longos, menu mobile e editor de imagens durante a inspeção.
4. Registrar capturas “depois” e anexá-las ao PR.
5. Corrigir apenas eventuais diferenças visuais observadas nessa inspeção, mantendo o mesmo escopo.
6. Não fazer merge antes da aprovação visual.

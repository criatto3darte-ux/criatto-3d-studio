# CRIATTO 3D — CR-010B.1

**Data:** 2026-11-15 (UTC)
**Estado:** implementação local em revisão; não liberar para operação comercial nem aplicar migration remota.
**Branch ativo/fixo:** `arena/1f32d4fc-criatto-3d-studio`.
**PR #7:** https://github.com/criatto3darte-ux/criatto-3d-studio/pull/7
**PR de integração dependente:** será aberto do branch ativo para `arena/81a1f1ff-criatto-3d-studio`; não altera nem substitui o PR #7.

## 1. Reconciliação de branches

- HEAD desta sessão antes das alterações CR-010B.1: `5e42fb0feb627f1ffe72d9fa5031485a58e97ffe` (`docs(CR-010B): clarify session branch and push status`). O commit de implementação desta etapa é `c4910e9` (`feat(CR-010B.1): add transactional variants and inventory commands`).
- A branch remota `arena/1f32d4fc-criatto-3d-studio` apontava para o mesmo commit.
- A branch do PR #7, `arena/81a1f1ff-criatto-3d-studio`, e `origin/pr/7` apontavam para `bdf895be12d110761c35d6a77faa92fdaeedc7bb`. PR #7 continua aberto, direcionado a `main`, mergeable/CLEAN no momento da consulta; seus checks verdes são do HEAD anterior.
- `bdf895b` é o merge-base exato das branches. O branch 81 não tinha commits exclusivos além desse ancestral; o branch ativo tinha os commits CR-010B `43ddb43`, `84457bf`, `0a8d7ab`, `5e42fb0`. A implementação anterior já estava toda presente no branch ativo; não foi encontrado trabalho divergente a sobrescrever.
- A sessão está vinculada ao branch `arena/1f32d4fc-criatto-3d-studio`; não troquei branch, não fiz force-push e não alterei `main` ou `arena/81a1f1ff-criatto-3d-studio`. Para preservar a separação e executar CI, a integração será proposta como PR dependente com base no head do PR #7. Isso não significa que o PR #7 já foi atualizado.

## 2. Implementação CR-010B.1

### Produtos e variantes

- Produto continua com CRUD direto na sessão Supabase para campos existentes no schema: slug, nome, categoria, descrição, tags, preço normal/promocional, modo/prazo, destaque e publicação. Atualizações usam versão otimista; remoção continua como arquivamento para preservar referências.
- Administração agora carrega e grava grupos, opções e combinações SKU através de `replace_product_variants`, um comando transacional aditivo. O formulário aceita JSON de grupos/opções e combinações; combinações ativas são verificadas pelos triggers diferidos de integridade existentes. SKU duplicado é rejeitado. O comando recusa substituir variantes referenciadas por itens históricos de pedido.
- A projeção pública já usa `public_variants` e `public_variant_options`: somente opções presentes em combinações ativas chegam à loja, o SKU associado à seleção é mapeado, e carrinho rejeita combinações inexistentes. Produto com grupos sem SKU ativo não é marcado comprável.
- Não há RPC remota existente para estas gravações: consulta às migrations e catálogo de funções não encontrou um comando equivalente. Foi acrescentada migration local e um hash pinned no harness PostgreSQL; a migration não foi aplicada remotamente.

### Categorias

- CRUD/ativação/exclusão segura já existente foi mantido.
- Reordenação usa agora `swap_category_order`, que bloqueia as duas linhas, valida ambas as versões e troca a ordem em uma transação; uma falha não deixa gravação parcial. FK e validação de vínculo continuam protegendo exclusão.
- Alterações administrativas invalidam o catálogo público para a vitrine buscar o estado atualizado.

### Estoque

- A tela continua lendo saldo e ledger pelas permissões atuais. Proprietário consulta produtos administrativos; operador consulta o projeto público estreito, pois o papel operador não tem leitura direta em `products` no schema atual.
- A migration aditiva local acrescenta `inventory.minimum_on_hand` e comandos `adjust_inventory` / `set_inventory_minimum`. Ajuste de saldo escreve a movimentação append-only e o saldo/version sob lock, usa `expected_version`, não permite saldo abaixo do alocado, exige motivo e idempotência por `operation_key`, e valida sessão AAL2 + papel proprietário/operador. Produtos sob encomenda não oferecem ajuste de saldo nessa tela.
- O botão e os RPCs novos funcionarão apenas depois da revisão e aplicação aprovada da migration. Hoje não estão disponíveis no Supabase remoto.

### Imagens e galeria

- Upload, galeria e imagem principal continuam **não concluídos**. A consulta remota de homologação registrada no relatório CR-010B encontrou zero buckets. A migration de hardening existente revoga gravação browser em `media_assets`, reservando cadastro/verificação de metadados a um canal confiável; não há Edge Function/backend de upload nem política de Storage que permita implementar isso com segurança sem configuração adicional.
- Não foi criada migration de Storage, bucket, policy, upload de navegador ou URL pública improvisada. Limpeza de objetos órfãos também permanece pendente.

## 3. O que está e não está persistido remotamente

**Persistência pelo schema remoto existente (código habilitado, sem exercício remoto nesta etapa):** CRUD dos campos principais de produtos e categorias pela sessão Supabase com as policies existentes; publicar/despublicar e destaque; arquivamento seguro. Não houve sessão administrativa real AAL2 ou mutação remota para provar operação.

**Somente persistirá depois da migration CR-010B.1 ser aprovada e aplicada:** gravação transacional de variantes/SKU; troca transacional de ordem de categorias; ajuste de saldo + ledger com concorrência/idempotência; estoque mínimo. A migration local é `supabase/migrations/20261115120000_cr010b1_catalog_stock_commands.sql`.

**Não persistido/indisponível:** imagens/Storage/galeria, usuários, produtos/categorias de teste, movimentos remotos. Checkout, pedidos e pagamentos continuam desabilitados e pertencem à CR-010C.

Nenhuma escrita Supabase, alteração Auth, policy, bucket, migration remota, usuário/convite/bootstrap, deploy Locaweb, troca da loja oficial ou operação de pagamento foi realizada.

## 4. Testes e limites

- TypeScript: `npx tsc --noEmit` — passou após correção localizada de tipagem.
- Vitest: `npm test -- --reporter=dot` — **197/197**, 18 arquivos. Inclui mapeamento de SKU/combinações e rejeição local de combinação inválida; não prova CRUD comercial remoto.
- ESLint direcionado, `--max-warnings 0`, para todos os arquivos TypeScript alterados — passou. Não houve formatação global; a dívida de lint global anterior permanece fora do escopo.
- Build: `npm run build` — passou; chunk JS 824.51 kB, com warning acima do limite padrão 500 kB.
- Credential scan + autotestes: scanner sem achados aparentes; positivos/negativos **23/23**.
- `git diff --check`, parser PostgreSQL da migration e `python3 -m py_compile tests/postgres/run.py` passaram.
- Testes PostgreSQL 17 foram adicionados ao harness `tests/postgres/run.py`: persistência em commit, AAL1 negado, roles, swap concorrente/versionado, combinações cor/tamanho, SKU único, histórico de pedido, RLS público, movimento append-only, retry idempotente, mínimo e rejeição abaixo do alocado. **Ainda não executados**: esta sandbox não tem `psql`, servidor PostgreSQL nem Docker/Podman. Precisam rodar no GitHub Actions PostgreSQL 17 antes de aceitar a migration.
- Não há execução de GitHub Actions para estes novos commits até abrir o PR dependente. O workflow foi ajustado para executar no PR dirigido ao branch de integração do PR #7.

## 5. Arquivos principais alterados

- `supabase/migrations/20261115120000_cr010b1_catalog_stock_commands.sql` — migration local aditiva; não aplicada remotamente.
- `tests/postgres/run.py` — registra a migration por hash e testa comandos e integridade no PG17.
- `.github/workflows/ci.yml` — CI também dispara em PR com base no branch de integração do PR #7.
- `src/features/catalog/supabase-catalog.ts` — carga pública de combinações, edição atômica de variantes, categoria swap e comandos de estoque.
- `src/features/admin/pages/ProductsPage.tsx`, `CategoriesPage.tsx`, `StockPage.tsx` — administração.
- `src/shared/types/catalog.ts`, `src/features/cart/cart.stock.ts`, `src/features/store/pages/ProductPage.tsx` — variantes/SKU da loja e validação do carrinho.
- `src/test/cr010b-catalog.test.ts` — testes novos de projeção e combinação.
- `docs/README-CONTINUIDADE-ARENA.md` — runbook de estado atualizado.

## 6. Gates restantes e próximo passo

1. Abrir e acompanhar PR dependente da branch ativa para `arena/81a1f1ff-criatto-3d-studio`; não fingir que isso atualiza o head do PR #7. Esperar CI (inclusive PG17), corrigir falhas e registrar o SHA final. Nenhum merge será feito por esta etapa.
2. Revisar o comando e a migration aditiva; obter autorização explícita antes de aplicar a migration em homologação. Nenhuma migração remota é necessária para continuar apenas os testes locais.
3. Definir e autorizar bucket privado/publicação, política e canal confiável de verificação/upload antes de implementar galeria. Não reutilizar Storage sem pré-checagem.
4. Para CR-010C, só iniciar depois de aprovar o contrato de pedido e a integração de catálogo/estoque: implementar criação idempotente/revalidação server-side e testes de concorrência/permissions. Não ativar pagamentos nesta etapa; não criar pedidos nem usuários reais agora.

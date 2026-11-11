# CR-005 — Integração simulada, auditoria e homologação (relatório)

## 1. Resumo executivo
Loja e painel já liam a mesma fonte (`demoRepository`). A principal divergência encontrada foi o **carrinho**: guardava o preço do momento da inclusão e não reagia a produtos despublicados, excluídos, sem estoque ou com variação removida. Isso foi corrigido com uma política única de sessão de compra. Foram adicionados contratos TypeScript para a futura integração com backend (sem instalar nada) e 12 novos testes.

## 2. Arquitetura auditada
- Rotas TanStack: `src/routes/_store.*` (loja) e `src/routes/admin.*` (painel). Não existem `src/App.tsx` nem `src/pages` — os erros TS2339 relatados (`runAttachedTask`, etc.) não correspondem a nenhum arquivo do projeto.
- Dados: `src/features/demo-data/{model,seed,rules,repository}.ts` (LocalStorage versionado, `useSyncExternalStore`, evento `storage` entre abas).
- Carrinho: `CartContext` (LocalStorage `criatto3d:cart`), lógica pura em `cart.logic.ts`.
- Tokens/temas: `src/styles/tokens.css`, `data-theme` em `<html>`.

## 3. Problemas identificados
1. Carrinho usava preço antigo após alteração no painel.
2. Produto despublicado/excluído/esgotado continuava finalizável.
3. Variação removida no painel continuava no carrinho.
4. Carrinho corrompido no LocalStorage podia gerar itens inválidos.

## 4. Correções aplicadas
- `cart.reconcile.ts`: compara cada item com o catálogo público atual. Preço alterado → usa o preço atual e avisa ("Preço atualizado (antes R$ X)"). Indisponível/removido/variação inexistente → bloqueia finalização até "Atualizar carrinho" (que remove esses itens).
- Carrinho e checkout usam `useReconciledCart`; subtotal, total e mensagem do WhatsApp usam só itens válidos a preço atual.
- `isCartItem` descarta entradas corrompidas do carrinho.
- `src/features/data-contracts/repositories.ts`: interfaces Product/Category/Order/Customer/Inventory/Banner/StoreSettings Repository (assíncronas). Implementação atual continua simulada.

## 5. Arquivos modificados
`src/features/cart/{cart.logic.ts,CartContext.tsx,cart.reconcile.ts,useReconciledCart.ts}`, `src/features/store/pages/{CartPage,CheckoutPage}.tsx`, `src/features/data-contracts/repositories.ts`, `src/test/cr005-integration.test.ts`, este relatório.

## 6–7. Testes executados e resultados
- Vitest: **49/49 passando** (37 anteriores + 12 novos: preço atualizado, produto desativado, estoque zerado, sob encomenda com estoque zero, variação removida, carrinho corrompido, mensagem WhatsApp com preço atual, edição do painel visível na loja e persistida, configurações compartilhadas, dados corrompidos/restauração, ausência de dados pessoais, snapshots de pedidos após exclusão e pendentes fora do faturamento).
- TypeScript (`tsgo --noEmit`): sem erros.
- Lint: apenas avisos de formatação Prettier já existentes em todo o projeto (mesma contagem antes e depois); nenhum erro de lógica.
- Navegador (1280px): preço alterado no painel → aviso e novo total no carrinho; produto despublicado → item bloqueado, botão de finalizar desativado; "Atualizar carrinho" → carrinho limpo do item. Sem erros no console.
- Não reexecutado nesta etapa: varredura completa de responsividade em 7 larguras e de todos os módulos do painel (validados na CR-004 em 320/375/430px). Build de produção é verificado automaticamente pela plataforma.

## 8. Pendências
WhatsApp comercial oficial, textos finais da política de privacidade, fotos reais, aplicação de cupons no checkout.

## 9. Limitações da demonstração
Dados só neste navegador; preços calculados no frontend (não seguros para produção); pedidos do checkout não entram no painel; fotos locais são apenas pré-visualização; login do painel é simulado.

## 10. Recomendações para o backend
Implementar os contratos de `data-contracts` com funções de servidor; recalcular preços e disponibilidade no servidor ao registrar o pedido; autenticação real e papéis em tabela separada para o painel; RLS por tabela; manter snapshots de itens nos pedidos.

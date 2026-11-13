# Criatto 3D — CR-006A: correção do catálogo

Data: 13/11/2026 (UTC). Escopo exclusivo: busca, filtros e ordenação. CR-006B–E não iniciadas.

## Diagnóstico reproduzido

Ao digitar `luminaria` em `/produtos`, a URL passava para `?q=luminaria`, mas a tela permanecia em “Carregando…”, mesmo após 1,4 segundo, sem erro no console.

O efeito dependia de `key` e `lastKey`: mudava `lastKey`, ativava o carregamento e criava um temporizador; a renderização causada pela própria mudança de `lastKey` executava a limpeza, cancelando o temporizador que deveria encerrar o carregamento. Como o repositório demonstrativo é síncrono, o carregamento artificial foi removido, sem modificar o visual, a fonte de dados ou as rotas.

O debounce também capturava filtros antigos. Agora as alterações mesclam os parâmetros mais recentes através da função de atualização da navegação, e o efeito cancela/reprograma a busca quando a consulta externa muda.

## Correções e arquivos

| Arquivo | Alteração |
|---|---|
| `src/features/store/pages/CatalogPage.tsx` | Retira carregamento artificial; atualiza parâmetros a partir do estado atual; dependências completas do debounce; mantém paginação com reinício ao mudar filtros. |
| `src/features/catalog/catalog.logic.ts` | Ordena preço ascendente/descendente com `effectivePriceCents`, a mesma regra de preço promocional existente. |
| `src/test/cr006a-catalog.test.tsx` | Três testes de regressão com roteador real em memória: preço efetivo, mudanças rápidas combinadas, cancelamento e consulta externa. Só dados e cartões são isolados. |
| `AGENTS.md` | Registra a decisão de catálogo síncrono e mesclagem dos parâmetros atuais. |
| `roadmap.md` | Registra a entrega autorizada e as etapas que dependem de aprovação. |
| `docs/CR-006A-REPORT.md` | Este relatório. |

## Validação automática

- `bunx vitest run`: **52 testes passaram, em 7 arquivos**, incluindo os 49 anteriores.
- Teste concreto de promoção: preço normal 10.000 centavos, promocional 1.000 centavos, outro produto 2.000 centavos; promoção primeiro em crescente e último em decrescente, sem mutação da lista original.
- Mudanças rápidas: `va/vas/vaso`, categoria Vasos e Jardinagem, Sob encomenda e ordenação; URL final preserva os parâmetros e retorna Vaso Autoirrigável.
- Limpar filtros cancela consulta pendente; navegação externa com `LUMINARIA` sincroniza o campo e retorna Luminária Lua.
- Verificação automática da plataforma: último registro `build OK` em 13/11/2026 às 00:50:44 UTC, após corrigir um nome incorreto de fixture no novo teste. Nenhum erro pendente de TypeScript.
- Build/typecheck não foram executados manualmente, conforme as regras do ambiente. Não foi validado um artefato de produção publicado; a aplicação permanece não publicada.

## Validação no navegador

Chromium, sessões isoladas, sem modificar os dados do navegador do cliente:

| Largura × altura | Fluxos | Resultado |
|---|---|---|
| 1280 × 1800 | Busca digitada, filtros rápidos, ordenação, limpar busca pendente, nenhum resultado, carregar mais, tema claro/escuro | Passou; sem erro no console ou rolagem lateral. |
| 768 × 1024 | Mesmos fluxos, painel de filtros móvel | Passou; sem erro no console ou rolagem lateral. |
| 375 × 812 | Mesmos fluxos, painel de filtros móvel | Passou; sem erro no console ou rolagem lateral. |
| 320 × 740 | Mesmos fluxos, painel de filtros móvel | Passou; sem erro no console ou rolagem lateral. |

Paginação: 9 itens inicialmente, 18 após “Carregar mais”, retorno a 9 ao limpar filtros. Busca ignora acentos e maiúsculas (`LUMINÁRIA`).

Integração demonstrativa real pela interface: editar Luminária Lua no painel, salvar promoção fictícia de R$ 10,00, abrir catálogo em menor preço e conferir primeira posição e preço exibido; selecionar maior preço, carregar todos e conferir última posição; recarregar preserva ordenação. Alteração restrita à sessão de teste, descartada ao fechar o navegador.

Capturas antes/depois foram inspecionadas: travamento original, resultado no tema escuro, promoção em primeira posição e consulta no celular claro. O CSS não foi alterado.

## Erro informado e pendências

`src/App.tsx` não existe nesta aplicação TanStack Start, e `applyAttachedRequirements` não aparece no código. Não foi criada propriedade fictícia em `Window` nem suprimido erro de tipos: o trabalho seguiu a instrução concreta do anexo.

- CR-006B (estoque/carrinho), CR-006C (SEO), CR-006D (persistência/URLs) e CR-006E (pedidos/painel) aguardam autorização e continuam pendentes.
- Nenhuma integração com banco, autenticação, publicação comercial ou alteração do checkout.
- A revisão das declarações de metadados das rotas não alterou o escopo de SEO; a divergência dos produtos criados localmente fica para CR-006C.
- Não foram executados Lighthouse ou testes com leitor de tela nesta subetapa.

**Próxima etapa:** somente após aprovação, CR-006B.
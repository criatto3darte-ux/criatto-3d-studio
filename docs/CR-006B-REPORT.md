# Criatto 3D — CR-006B: carrinho e estoque

Data: 13/11/2026 UTC. Escopo exclusivo CR-006B. Sem banco, autenticação, publicação, mudanças de SEO ou módulos administrativos.

## Diagnóstico

Reproduzido no navegador: estoque de Luminária Lua reduzido para **1** pelo painel; a página permitia selecionar **5**, adicionar e abrir o carrinho com **5** unidades. A regra anterior limitava somente a 99 por linha, não o estoque nem a soma das variações.

A persistência anterior lia uma vez na montagem, gravava em efeito sem capturar erros e não recebia eventos de outras abas. Dados antigos tinham validação incompleta e chaves de linha eram confiadas diretamente.

O erro informado (`src/App.tsx`, `applyAttachedRequirements`) não foi localizado: este projeto não contém esse arquivo ou propriedade. Não foi adicionada declaração fictícia em Window; foi executado o escopo do anexo.

## Correções

- Regra reutilizável de estoque físico compartilhado entre todas as variações. Produtos sob encomenda não usam estoque físico; permanece o limite existente de 99 por linha.
- Página de produto limita o seletor ao saldo do carrinho e desativa adicionar quando esgotado. A ação revalida o catálogo atual e rejeita uma quantidade acima do saldo, mesmo que chamada diretamente.
- Carrinho e checkout recalculam disponibilidade, variações, preço e quantidades pelo catálogo público atual.
- Redução de estoque gera aviso e bloqueio de checkout. “Atualizar carrinho” mantém as primeiras variações na ordem do carrinho, reduz as seguintes ao saldo restante e remove as que ficarem com zero, sem ajuste silencioso. Os controles também permitem reduzir manualmente.
- Promoções, nome, opções, subtotal, prazo e informações de frete continuam vindo das regras existentes. Uma linha bloqueada não é incluída no subtotal elegível para checkout.
- Novo repositório de carrinho compatível com o formato antigo: descarta entradas inválidas, reconstrói chaves, junta duplicatas, limita quantidades e ignora imagens persistidas (as telas já usam a mídia do catálogo).
- Sincronização nos dois sentidos com eventos `storage`, sem gravação de eco. Cada alteração lê o snapshot compartilhado mais recente; o clique de WhatsApp faz nova leitura e comparação com o resumo exibido.
- Falha de salvamento não quebra a tela: carrinho fica em memória e aviso explícito substitui a indicação de que foi salvo.
- Checkout continua pelo WhatsApp, sem criar pedido confirmado, reservar, esvaziar ou baixar estoque.

## Arquivos alterados/criados

| Arquivo | Responsabilidade |
|---|---|
| `src/features/cart/cart.stock.ts` | Limites, soma por produto, saldo por linha e validação de variações. |
| `src/features/cart/cart.repository.ts` | Persistência, normalização, snapshot estável, eventos e tratamento de falhas. |
| `src/features/cart/cart.logic.ts` | Validação estrutural e normalização do formato legado. |
| `src/features/cart/CartContext.tsx` | Consumo do repositório e revalidação de adição/quantidade. |
| `src/features/cart/cart.reconcile.ts` | Bloqueio por excesso e ajuste explícito por saldo compartilhado. |
| `src/features/cart/useReconciledCart.ts` | Avisos, atualização baseada no estado atual e validação final. |
| `src/features/store/pages/ProductPage.tsx` | Quantidade máxima, botão e avisos. |
| `src/features/store/pages/CartPage.tsx` | Controles, aviso de estoque e falha de persistência. |
| `src/features/store/pages/CheckoutPage.tsx` | Bloqueio e validação no clique de WhatsApp. |
| `src/test/cr006b-cart.test.tsx` | 11 testes novos. |
| `src/test/cr005-integration.test.ts` | Fixture agora seleciona opções válidas do produto em vez de omiti-las. As expectativas anteriores foram preservadas. |
| `AGENTS.md`, `roadmap.md`, este relatório | Decisões técnicas e entrega. |

CSS, estrutura de rotas e módulos administrativos não foram alterados.

## Testes automáticos

`bunx vitest run`: **63 testes passaram em 8 arquivos**, incluindo todos os testes anteriores.

Novas verificações concretas:

1. Estoque 1 rejeita adição de 5; aceita 1; rejeita adicionar mais 1.
2. Estoque 10 aceita 6 + 4 entre variações e impede exceder na adição ou edição.
3. Estoque reduzido para 3 bloqueia 2 + 4 e ajusta para 2 + 1, preservando variações e promoção de 1.000 centavos (subtotal 3.000).
4. Indisponível fica bloqueado e só sai no ajuste explícito.
5. Sob encomenda com estoque zero permite 5 + 10 entre variações.
6. Mensagem usa promoção atual; mudanças posteriores de estoque/disponibilidade bloqueiam.
7. Entradas inválidas são descartadas; chaves são refeitas; duplicatas somam; campos de imagem não são confiados.
8. JSON corrompido não quebra a montagem nem causa gravação automática na hidratação.
9. Leitura de outra aba antes de alteração, evento sem eco e remoção do armazenamento.
10. Falha de quota mantém memória e informa erro.
11. Snapshot final lê alteração de outra aba mesmo antes da chegada do evento.

Verificação automática da plataforma: `build OK` em 13/11/2026 às **01:07:00 UTC** após a última alteração de lógica. Nenhum erro pendente observado. A plataforma executa as verificações do projeto; não foi executado manualmente TypeScript/build, conforme as regras do ambiente. Não foi inspecionado um artefato independente de produção nem realizado deploy.

## Navegador e evidências

Chromium, sessões isoladas com alterações fictícias exclusivamente no navegador de teste.

| Tamanho | Fluxos completos | Resultado |
|---|---|---|
| 1280 × 1800 | Estoque 1, 6 + 4 com estoque 10, duas abas, redução em checkout, ajuste, promoção, indisponível e encomenda | Passou, sem erro de console. |
| 768 × 1024 | Mesmos fluxos | Passou, sem erro de console. |
| 375 × 812 | Mesmos fluxos | Passou, sem erro de console. |

- Duas abas: 6 + 4 → 5 + 4 → 5 + 3, com leitura da alteração na outra aba nos dois sentidos. Ajuste para 3 propagou para a segunda aba.
- Administrador reduz estoque enquanto checkout está aberto: aviso e ausência de botão de envio; comprador retorna e atualiza para 3.
- Promoção fictícia R$ 10,00: resumo e prévia usam R$ 30,00 e Tamanho P.
- Produto indisponível: bloqueio, atualização e carrinho vazio.
- Sob encomenda com estoque zero: 5 unidades permanecem após recarregar.
- JSON/entradas corrompidas: tela vazia sem falha; quota simulada: aviso e item mantido em memória.
- WhatsApp: configuração e campos exclusivamente de teste; abertura interceptada localmente antes de qualquer acesso externo, mensagem codificada e carrinho mantido com 1 unidade depois. Nenhuma mensagem enviada.
- Capturas inspecionadas de bloqueio, ajuste no tema escuro, falha de salvamento e tema claro em desktop/celular. Tema claro também verificado por cores computadas após recarregar em todos os tamanhos. Sem rolagem lateral observada.

Algumas execuções longas do roteiro foram interrompidas pelo limite de tempo; as partes restantes foram executadas separadamente e concluídas. A primeira captura logo após alternar tema mostrou estado transitório inconsistente; a validação foi repetida após recarregar, sem alterar estilos, e confirmou o tema claro legível.

## Limites e pendências

- LocalStorage não fornece transação atômica entre abas: gravações exatamente simultâneas ainda podem usar a política de última gravação. A sincronização sequencial e a leitura atualizada foram verificadas; concorrência comercial segura depende de servidor futuro.
- Sem reserva ou baixa de estoque, como solicitado. Limites no navegador não substituem validação confiável em servidor.
- Não foram executados Lighthouse, leitor de tela, teste com dispositivos físicos, envio real de WhatsApp ou build de produção independente.
- CR-006C (SEO), CR-006D (demais dados persistidos/URLs) e CR-006E (pedidos/painel) não iniciadas e aguardam aprovação.

**CR-006B concluída; aguardar aprovação antes de avançar.**
# CR-006E — Integridade dos pedidos e painel administrativo

Data: 13/11/2026. Escopo: demonstração local, sem banco, autenticação, publicação ou pedidos reais.

## Diagnóstico

- `src/main.tsx` não existe e `executeAttachedConfig` não aparece em `src`. O TS2339 informado não foi reproduzido. Não foi criada declaração artificial de Window nem arquivo de entrada incompatível com TanStack.
- Auditoria: AGENTS.md, roadmap e relatórios CR-004/005/006A–D; regras, repositório, validação, pedidos, Dashboard, Relatórios, estoque, configurações e identidade pública.
- Pedidos aceitavam qualquer mudança de status, inclusive reabertura de cancelados; pagamento podia ser marcado antes da confirmação e sem histórico.
- O repositório validava a estrutura, mas não protegia snapshots e histórico contra alterações programáticas contraditórias.
- Dashboard contava produtos ativos em categorias desativadas. Relatórios incluía confirmados na estimativa, enquanto Dashboard considerava somente pendentes. Receita recebida aceitava pagamento indevido em pedido pendente.
- Logo era salva, mas não aplicada; nome da loja também não alterava a identidade no cabeçalho/rodapé. Falhas de configurações já eram comunicadas na CR-006D; a etapa acrescenta validação de limites e regressão de falha/tentativa posterior.
- Encomendas exibiam controles de estoque físico sem efeito na disponibilidade. Prazo aparecia também para pronta entrega.
- Teste real identificou pedidos fictícios de hoje com horários futuros, impedindo uma confirmação cronologicamente válida antes desse horário. Os dados iniciais agora usam meia-noite quando o horário fictício ainda não chegou, de forma estável entre leituras.

## Regras implementadas

### Estados e transições

| Origem | Destinos permitidos |
| --- | --- |
| Aguardando contato | Em atendimento, Confirmado, Cancelado |
| Em atendimento | Confirmado, Cancelado |
| Confirmado | Em produção, Pronto para entrega, Enviado, Concluído, Cancelado |
| Em produção | Pronto para entrega, Cancelado |
| Pronto para entrega | Enviado, Concluído, Cancelado |
| Enviado | Concluído, Cancelado |
| Concluído / Cancelado | Nenhum |

- Confirmação direta e atendimento de pronta entrega não exigem produção. Retornos e saltos de pendente para execução não são permitidos. Repetir o mesmo estado é operação sem alteração.
- Pagamento só pode ser marcado/corrigido em estados confirmados. Toda alteração registra evento no histórico, preservando os valores e itens.
- Cancelamento mantém evidência de pagamento anterior e histórico; o valor não entra na receita ativa. Cancelados não permitem alteração do pagamento; a tela explica que estorno não é controlado nesta demonstração.
- Datas não podem preceder o último evento. Históricos antigos válidos podem omitir passos intermediários alcançáveis, mas não podem reabrir estados terminais.
- Repositório rejeita criação/exclusão de pedidos, alterações de número/data/cliente/itens/frete, remoção ou reescrita de histórico e mudanças diretas de estado/pagamento sem eventos válidos. Restauração explícita continua sendo a operação separada aprovada anteriormente.

### Indicadores

- Pendentes: aguardando contato e em atendimento. Estimativa pendente soma somente estes pedidos.
- Confirmados: confirmado, em produção, pronto para entrega, enviado e concluído. Vendas confirmadas somam seus snapshots, incluindo frete registrado.
- Receita recebida: pedidos confirmados com pagamento recebido; não equivale a estimativa nem inclui cancelados ou solicitações personalizadas.
- Dashboard, Relatórios e gráfico diário usam a mesma função de métricas. Período de relatórios permanece baseado na criação do pedido, não na data do pagamento.
- Produtos ativos correspondem à projeção pública: produto publicado em categoria ativa, inclusive produto visível sem estoque.
- Dashboard distingue pendentes, confirmados, concluídos, cancelados, receita recebida e estimativa.

### Estoque, configurações e logo

- Sob encomenda não oferece ajuste físico na tela Estoque; cadastro exibe prazo somente para encomendas e estoque somente nos outros modos. Quantidade física antiga é preservada para eventual troca de modo, sem afetar disponibilidade da encomenda.
- Ajustes de estoque são inteiros de 0 a 99999; a regra também rejeita ajustes programáticos em encomendas.
- Salvar configurações limpa o sucesso anterior e só mostra confirmação após persistência. Limites de nome/endereço/entrega/atendimento são validados. Produto mantém o formulário aberto se não foi persistido.
- Logo e nome salvos aparecem no cabeçalho/rodapé; URL passa pela proteção CR-006D. Imagem inválida ou indisponível usa a marca existente; dimensões estáveis e nome longo podem quebrar linha.
- Contatos, endereço, entrega, atendimento e envio nacional mantêm seus efeitos existentes; nenhum contato real foi inventado.

## Arquivos

- Novo: `src/features/demo-data/order.rules.ts`, `src/test/cr006e-orders.test.tsx`.
- Dados: `model.ts`, `rules.ts`, `validation.ts`, `repository.ts`, `seed.ts` em `src/features/demo-data`.
- Painel: `OrdersPage`, `DashboardPage`, `ReportsPage`, `StockPage`, `ProductsPage`, `SettingsPage`.
- Identidade pública: `src/shared/ui/Logo.tsx`, `Logo.module.css`, `StoreHeader.tsx`, `StoreFooter.tsx`.
- Documentação: `AGENTS.md`, `roadmap.md`, este relatório e `report.md`.

## Testes e evidências

- Vitest: **122/122**, 11 arquivos; 21 regressões novas. Matriz completa de transições, cancelamento, terminais, pagamento/correção, datas, snapshots, histórico, rejeição de criação/exclusão, recuperação, validade dos 14 pedidos demonstrativos, categorias inativas, métricas, encomendas, falha/tentativa de configurações e logo segura.
- Suites CR-006A/B/C/D, checkout, integração, catálogo e fundação preservadas.
- TypeScript/build: processo automático da plataforma, registro mais recente `build OK` em 13/11/2026 às 02:21:20 UTC. Nenhum build/typecheck manual duplicado foi executado.
- Chromium: pedido DEMO-4594 confirmado, pagamento marcado e cancelamento confirmado; terminal sem opção de reabrir e evidência relida após reload.
- Logo salva pela tela Configurações e carregada no cabeçalho/rodapé, inclusive após reload/troca de nome. Imagem de teste interceptada apenas no navegador, sem acrescentar imagem fictícia ao projeto.
- Falha de quota: aviso visível, nenhuma mensagem de sucesso; armazenamento restabelecido, nova gravação e nome relido após reload.
- Estoque: encomendas sem controles físicos. Dashboard e Relatórios após cancelamento mostram 14 pedidos, 2 pendentes, 9 confirmados, 4 concluídos e 3 cancelados; vendas R$ 1.340,40, recebido R$ 804,00, estimativa R$ 334,20.
- Regressão pela UI: promoção da Luminária Lua para R$ 10 e estoque 1 no painel; busca no catálogo atualiza URL; título do produto atual; incremento bloqueado no produto/carrinho; checkout usa R$ 10, coleta dados de teste somente em memória e mantém envio desativado sem número oficial. Os 14 pedidos permanecem e nenhum dado pessoal do formulário foi gravado.
- Layout: 1280, 768, 375 e 320 px; claro/escuro; loja, pedidos, relatórios, estoque e configurações já carregados, 40 combinações sem overflow da página. Tabelas preservam rolagem interna. Capturas revisadas de pedido cancelado, configurações 320, relatório claro 375 e checkout.
- Sem erros de execução capturados no fluxo principal. Capturas/scripts temporários em `/tmp/browser/cr006e`; não são artefatos permanentes.
- Todas as páginas de conteúdo mantêm título/descrição próprios e metadados sociais existentes, inclusive `_store.index.tsx`, que é a página inicial da arquitetura aprovada. SEO público conservador CR-006C mantido; nenhuma URL de imagem social inventada.

## Limitações e pendências

- Demonstração local não autentica operadores, não é multiusuário seguro e não garante integridade contra edição direta do LocalStorage. Validação recupera registros seguros sem regravar o original até consentimento.
- Pedidos antigos já salvos com horários futuros permanecem preservados; eventos anteriores ao seu histórico são recusados. Restaurar dados fictícios mediante confirmação aplica as novas datas iniciais.
- Cancelamento pago preserva evidência, mas não realiza estorno, liquidação financeira, pagamento parcial ou conciliação. Não há reserva/baixa automática de estoque.
- Datas e períodos seguem o navegador; receita recebida é a soma dos pedidos ativos marcados, não um livro-caixa por data de recebimento.
- Serviços futuros devem aplicar estas regras em transações no servidor, com autenticação/autorização, trilha de auditoria imutável, pagamentos/estornos e controle concorrente de estoque. Checkout WhatsApp continua sem criar pedido administrativo.
- Logo/fotos oficiais, WhatsApp comercial e política de privacidade definitiva permanecem pendentes do responsável pela loja. HTTPS seguro não garante disponibilidade da imagem.
- CR-006E concluída para aprovação; nenhuma etapa posterior iniciada e loja não publicada.
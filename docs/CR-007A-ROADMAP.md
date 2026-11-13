# CR-007A — Roadmap proposto de produção

13/11/2026. **Nada autorizado para execução.** A CR-007A encerra com documentos; cada nova etapa exige autorização expressa. Não foi alterado AGENTS.md.

## Ordem mais segura

**CR-007B → CR-007C → CR-007D → CR-007E → CR-007F**, mantendo os nomes pedidos, com subgates para resolver dependências:

1. Antes de B: aprovar arquitetura A, papéis, política de estoque/pagamentos/cupons, orçamento, ambientes, limites de mídia e dados reais iniciais.
2. B em homologação: schema/grants/RLS e contratos; políticas default-deny podem existir antes da tela de login. Não liberar CRUD público nem checkout; teste de autorização usa identidades controladas somente quando Auth for disponibilizada em C.
3. C: ativar autenticação e papéis e então validar integralmente políticas B com sessões reais; leituras públicas SSR de catálogo/settings/banners e adapters entram aqui após fronteiras protegidas estarem prontas. Se B incluir provisionamento de Auth, ainda não liberar painel até C.
4. D depende de identidade C para uploads; inclui CRUD protegido de catálogo/categorias/banners/settings, garantindo que conteúdo real e imagens possam ser usados antes de vendas.
5. E depende de preços/variações/imagens reais D e de políticas testadas B/C; comandos comerciais nunca entram antes dessas garantias.
6. F valida tudo em homologação e prepara publicação; publicar continua uma aprovação separada, não consequência automática de testes.

A lacuna do roadmap original (nenhuma etapa explicitamente troca catálogo/relatórios/settings locais) é resolvida distribuindo adapters e leitura pública em C, CRUD/mídia em D, métricas/clientes/pedidos/cupons/personalizados em E e SEO/cache final em F. Não jogar toda migração assíncrona para o último dia.

## CR-007B — Banco, contratos e regras de acesso

**Dependências:** autorização B, arquitetura escolhida e acesso ao Cloud aprovado em etapa própria; ambientes separados reais, definições comerciais e retenção. Esta análise não conectou serviço.

**Escopo futuro:** schema da modelagem, índices, grants+RLS, funções autorizadas estreitas, DTOs públicos/privados, paginação e erros; migrations aditivas e rollback documentado; fixtures fictícias apenas em homologação/migrations desse ambiente. Sem dados fictícios de produção e sem endpoint de criação de pedido habilitado.

**Aceite:** todas FKs/constraints/índices relevantes e políticas versionadas; nenhum anon acesso privado; public catalog sem colunas internas; testes de schema/constraints/policies e execução direta de comandos; contrato para frete indefinido, snapshot/ID estável; produção sem seed; backup e restauração especificados. Políticas que dependem de identidade têm aceite final bloqueado até sessão real C. Testes existentes continuam verdes; preview demo ainda funciona isolado.

## CR-007C — Autenticação administrativa e primeira integração de dados

**Dependências:** B pronto, papéis/invites/MFA aprovados, opções de login/recuperação habilitadas e verificadas no serviço.

**Escopo futuro:** login/logout/recuperação; subtree autenticada preservando URLs; bearer attacher sem perder CSRF/erros; verificação ativa de usuário e papel em cada função; bootstrap proprietário, revogação/cache; adapters de leitura pública e loader Query com SSR real, settings e banner; leitura protegida de rascunhos/catálogo admin.

**Aceite:** login, hard refresh, expiração, logout, revogação e cada papel testados com sessão real; anon/autenticado sem papel negados em funções/RPC/Data API; sem dados privados no SSR/cache; produto e metadata recebem mesmo DTO; duas sessões/dispositivos leem mudança compartilhada; rede lenta/falha mostra estado real sem seed; 122 testes e testes novos passam. Sem venda real até E.

## CR-007D — Imagens e CRUD de conteúdo

**Dependências:** C/RLS validados, limites de tamanho/formato/retensão e custo de transformação aprovados.

**Escopo futuro:** buckets pela API de Storage e policies de objetos; staging, verificação, derivados, upload/reordenação/exclusão, cleanup de órfãos; imagens de produto/categoria/banner/logo e anexos privados; CRUD público/admin consistente de catálogo/categorias/banners/settings; variantes preservadas e IDs convertidos sem perder opções.

**Aceite:** admin envia imagem real e a loja lê em outro dispositivo após recarregar; bytes/MIME/dimensões/limites validados; não-admin não envia/apaga; anexos privados não entram em cache/OG; upload interrompido/retry/órfão não corrompe dados; arquivo removido não é apagado enquanto referenciado; publicação/despublicação invalida dados e metadata; regressões de temas/mobile/formulários aprovadas.

## CR-007E — Pedidos, financeiro, cupons, estoque e WhatsApp

**Dependências:** regras comerciais aprovadas; B/C/D prontos, WhatsApp oficial, política atualizada, estratégia de abuso/rate limiting validada e ambiente de homologação.

**Escopo futuro:** pedidos anônimos transacionais com idempotência; reprecificação/variações/disponibilidade na primária; snapshots; atendimento/confirmação e alocação/baixa conforme decisão; eventos de pagamento/estorno; cupons vigentes/limite/consumo atômico; cadastros mínimos clientes, personalizados manuais e métricas no servidor; carrinho apenas intenção local.

**Aceite:** cliente cria pendência com dados controlados, recebe referência única persistida, abre WhatsApp e admin lê pedido; não conta como venda antes de confirmar, nem como receita sem recebimento; mesma chave não duplica, chave distinta permite compra repetida legítima; preço enviado pelo browser ignorado; última unidade concorrente não vende duas vezes; cupom no último uso concorrente não excede limite; status/pagamento/ledger/audit atômicos; timeout após commit permite recuperar resultado; sem backend/WhatsApp configurado não há falsa conclusão; carrinho preservado como hoje salvo decisão explícita; frete indefinido não exibido como gratuito. Testar resultado relido na UI com admin autenticado, não só teste de função isolada.

## CR-007F — Homologação, segurança, SEO e preparação de publicação

**Dependências:** E aprovado, fotos/conteúdo oficiais, canonical/domínio, responsável LGPD e contatos, budget/alertas e retenção/RPO/RTO aprovados.

**Escopo futuro:** SSR produto/404, sitemap/robots/canonical/OG absolutos, imagens otimizadas; cache/invalidação; paginar/admin/relatórios sob carga; métricas/logs redigidos; scan pela aba Security; backup banco+objetos e restauração; documentação operacional e rollback. Sem infra de deploy Cloudflare particular; publicação Lovable somente autorizada separadamente.

**Aceite:** 122 regressões mantidas (ou substituição equivalente documentada quando contrato demo deixa produção), testes de contrato/banco/RLS/auth/storage/conflitos/concorrência e fluxo completo comprador→admin→pagamento→estoque; viewport 1280/768/375/320, dois temas; metadados corretos em HTML inicial sem hidratação duplicada; sitemap exclui inativos/admin, HTTP 404 real; carga/durabilidade/custos medidos; scan recente com decisão sobre cada achado; restore testado; rollback compatível com pedidos reais; política real e sem fictícios. Publicação preparada, não executada sem autorização.

## Fluxo comercial de aceite

1. Cliente vê catálogo publicado por SSR e seleciona IDs válidos de produto/variante.
2. Carrinho armazena somente intenção (IDs/quantidade; valores locais são estimativa).
3. Informa nome, telefone, notas e recebe aviso atualizado de persistência/WhatsApp, sem signup.
4. Servidor valida payload/abuso/idempotência, preço, publicação, variações e estoque atual; em divergência retorna reconfirmação.
5. Transação gera pedido `aguardando-contato`, snapshots e histórico; não baixa definitivamente estoque nem registra recebimento.
6. Somente após confirmação de persistência, UI fornece número/resumo e ação WhatsApp. Como criação é assíncrona, link deve estar pronto para clique real; não presumir que abrir popup após await nunca será bloqueado. Erro de rede mantém formulário/carrinho e mesma chave para retry.
7. Abrir WhatsApp não comprova envio de mensagem nem venda. Se usuário fechar antes, pedido permanece pendente recuperável no painel e segue retenção/cancelamento aprovado.
8. Admin autenticado negocia e confirma: transação revalida saldo, status/version e regras aprovadas, registrando histórico/audit; conflito exige revisão, não estoque negativo.
9. Financeiro autorizado confirma recebimento real com evento e valor; não toggle anônimo. Parciais/estornos só conforme aprovação.
10. Ledger de estoque atualiza no marco comercial aprovado; cancelamento/retorno e métricas derivam dos mesmos eventos. Auditoria não depende de logs de erro.

## Matriz de riscos de produção (não achados do scanner)

| Nível | Risco / evidência atual | Mitigação / gate |
|---|---|---|
| Bloqueante | Admin demo aberto, sem auth/RBAC (`admin.tsx`, login) | C, políticas B, testes de identidade/ação direta antes de dados reais |
| Bloqueante | Não existe registro remoto de pedidos; repositório recusa alterar quantidade da coleção | Comando novo E, não reutilizar `update(fn)` |
| Bloqueante | Checkout/estoque só locais, sem concorrência ou transação | E com banco primário, locks/versões/ledger e regras aprovadas |
| Bloqueante | WhatsApp oficial/política de persistência/controlador/origem canonical não aprovados | Pendências comerciais antes de E/F |
| Alto | Duplicação ou resultado desconhecido após commit/timeout | Idempotência durável e readback controlado E |
| Alto | PII em projeção, cache, logs ou anexos públicos | DTOs mínimos/no-store/redação/RLS/privacidade B–F; scan pendente |
| Alto | Perda de dados na troca LocalStorage→banco ou rollback | Não importar seed, backup banco+objetos, contratos aditivos e freeze de writes |
| Alto | Functions/SSR funcionar só em dev Node, falhar em Worker | bundle/pacotes edge, ensaiar runtime em homologação F |
| Alto | Regressões das 122 verificações não cobrirem nova autorização/transações | Preservar baseline + testes reais por etapa |
| Médio | Falha de rede interpretada como lista vazia/sucesso ou formulário fechado | Erros tipados/mutations confirmadas; não fallback demo; tests retry/offline |
| Médio | SSR seed/metadata/canonical relativo/200 na ausência | Loader público real, head único e 404/sitemap/cache C/F |
| Médio | Custos sem volume/planos confirmados | Medição + cotação/alertas/limite de gasto antes de provisionar/publicar |
| Médio | Cupom/financeiro propostos mas sem política de consumo/estorno | Aprovar arredondamento, limites e estados antes de E |
| Médio | Whole table/cliente agregando relatórios | Paginação, consultas agregadas/timezone São Paulo, índices e carga |
| Baixo | Kit template/exports mortos e styles inline | Limpeza aprovada incremental; não bloqueia desenho de B |

## Complexidade qualitativa e aprovações

Total **média-alta**, sem estimativa de dias inventada. B/C: média-alta (políticas/contratos/auth); D: média (upload/processamento/ciclo de vida); E: alta (concorrência/financeiro/estoque/idempotência); F: média-alta (homologação/restauração/scan/SEO/custos). Nenhuma evidência de necessidade de reescrita/multi-tenant/microserviços.

Aprovar: arquitetura e custo/ambientes; quem administra e método de entrada/MFA; alocação/baixa/cancelamento/retorno; preços/estoque por variação ou compartilhados; frete/total definitivo e pagamentos; cupons/limites/expiração; limites e retenção de arquivos; LGPD/controlador/canais; origem canonical; escolha de dados reais a cadastrar; antiautomação/rate limiting; RPO/RTO. **Próxima etapa aguarda autorização expressa para CR-007B.**

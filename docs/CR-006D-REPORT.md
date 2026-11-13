# CR-006D — Persistência, validação e segurança de URLs

Data: 13/11/2026. Escopo exclusivo: demonstração no navegador.

## Diagnóstico inicial

- `src/App.tsx` não existe e `runAttachedTask` não aparece no código. O erro informado não foi reproduzido; nenhuma propriedade artificial foi adicionada a `Window`.
- Armazenamento encontrado: repositório central de dados demonstrativos (`criatto3d:demo-data`), carrinho (`criatto3d:cart`) e tema (`criatto3d:theme`). Não há SessionStorage. Carrinho mantém a validação e os limites aprovados na CR-006B; tema aceita apenas light/dark e já trata indisponibilidade sem interromper a tela.
- O validador demonstrativo verificava apenas algumas propriedades de produtos. Pedidos, clientes, categorias, banners, cupons e configurações podiam conter estruturas inválidas.
- Falhas de gravação eram ignoradas; Configurações exibia sucesso mesmo sem persistência. As expressões de URLs permitiam caminhos `//...`; imagens de produtos e prévias tinham verificações insuficientes.

## Entrega

- Validação estrutural de todas as coleções, campos obrigatórios, tipos, enumerações, variantes, históricos, datas, inteiros seguros, promoções, duplicidades e referências entre produtos/categorias e pedidos/clientes. Os snapshots históricos continuam válidos após excluir produtos.
- Validação aplicada também em alterações programáticas, não somente em formulários. As funções de alteração recebem uma cópia isolada; mutações inválidas não modificam os dados ativos.
- Recuperação independente dos registros seguros, preservando campos válidos de configurações. Coleções ausentes não são repovoadas silenciosamente. Registros inválidos e referências inconsistentes ficam fora da projeção segura.
- JSON/envelope/versão inválidos geram aviso explícito e preservam o conteúdo original. O modo temporário usa o último estado seguro ou dados fictícios iniciais, sem gravá-los automaticamente.
- Dados parcialmente recuperados também não são regravados automaticamente. O painel exige revisão e confirmação explícita antes de permitir substituição no próximo salvamento. A restauração existente continua exigindo confirmação.
- Falhas de leitura preservam o estado em memória; falhas de gravação mantêm rascunhos com aviso, sem falso sucesso. Uma nova gravação pode tentar persistir o rascunho. Alterações de outra aba durante falha de gravação exigem confirmação antes de substituir o conteúdo compartilhado.
- Sincronização sem gravações de eco; alterações leem o estado compartilhado mais recente quando seguro.
- URLs persistidas autorizam somente HTTPS válido, sem credenciais, ou caminho iniciado por uma única barra. Rejeitam javascript, data, blob, HTTP, FTP, caminhos `//`, barras invertidas, controles, espaços e escapes ambíguos/nested. Perfis sociais continuam restritos aos domínios Instagram/TikTok; mailto só é composto a partir de e-mail validado, WhatsApp de número validado.
- Proteção antes de salvar e antes de renderizar banners, imagens de produtos/categorias, prévias e contatos. Blob é permitido somente na prévia da imagem criada pelo próprio seletor local; não pode ser salvo. Nenhuma nova permissão externa foi introduzida.
- Sem alterações de design, CSS, temas, regras de estoque/carrinho ou arquitetura de rotas.

## Arquivos alterados

- Novos: `src/shared/utils/safe-url.ts`, `src/features/demo-data/validation.ts`, `src/features/demo-data/StorageNotice.tsx`, `src/test/cr006d-persistence.test.ts`.
- Dados: `src/features/demo-data/repository.ts`, `rules.ts`.
- Painel: `layout/AdminLayout.tsx`, `pages/SettingsPage.tsx`, `pages/BannersPage.tsx`, `ui/ImageManager.tsx`.
- Loja: `home/Hero.tsx`, `layout/StoreLayout.tsx`, `layout/StoreFooter.tsx`, `pages/ContactPage.tsx`, `src/shared/ui/MediaImage.tsx`.
- Documentação: `AGENTS.md`, `roadmap.md`, este relatório.

## Validação e evidências

- Suite Vitest: 101 testes (31 novos da CR-006D), incluindo todas as regressões das CR-006A/B/C. Casos cobrem registros válidos, campos ausentes, tipos incompatíveis, estruturas aninhadas, JSON inválido, protocolos proibidos, caminhos externos disfarçados, recuperação parcial, falhas de leitura/gravação, rejeição programática, sincronização e conflito entre abas.
- Verificação TypeScript e build pelo processo automático da plataforma: estado mais recente `build OK`; a incompatibilidade inicial de campos opcionais foi corrigida sem relaxar as opções strict.
- Navegador Chromium, sessões isoladas: configurações salvas e relidas após recarregar; e-mail refletido em outra aba da loja; banner com `//evil.invalid` recusado e imagem javascript não renderizada; recuperação parcial mantém produto e nome válidos; gravação bloqueada antes do consentimento; consentimento e salvamento relidos após reload; JSON inválido preservado; restauração confirmada; quota falha sem mensagem de sucesso e tentativa posterior funciona; leitura indisponível mostra aviso.
- Regressões no navegador: busca atualiza URL e encontra produto; estoque 1 bloqueia aumento na página e carrinho; preço promocional R$ 10 é usado na finalização; título acompanha produto atualizado do repositório. Sem envio externo pelo WhatsApp.
- Desktop 1280, tablet 768, celulares 375/320: início, catálogo, configurações e produtos administrativos em temas claro/escuro. Sem overflow horizontal da página; tabelas administrativas mantêm rolagem interna existente.
- Sem erros de execução capturados nos fluxos finais. Capturas temporárias em `/tmp/browser/cr006d/`: unsafe-banner, corrupt-json, quota, read-failure, regression-checkout e layout por largura/tema; são evidências locais, não arquivos persistentes de entrega.
- Todas as páginas de conteúdo mantêm os metadados próprios existentes, inclusive a página inicial em `_store.index.tsx`; não há `src/routes/index.tsx` nesta arquitetura já aprovada. Metadados conservadores da CR-006C preservados.

## Limitações e próximos passos

- Demonstração não é armazenamento seguro ou multiusuário: LocalStorage pode ser editado por quem usa o navegador. Validação protege a aplicação, não autentica a origem dos dados.
- Recuperação não reconstrói registros inválidos nem restaura JSON irrecuperável. O original permanece salvo até confirmação de substituição/restauração; não foi criado backup/exportador fora do escopo.
- HTTPS não garante disponibilidade, conteúdo confiável ou ausência de redirecionamentos. Não foi adicionado proxy, upload, análise de conteúdo remoto ou nova lista de hosts.
- Falhas permanentes de armazenamento deixam alterações somente em memória; a recuperação exige navegador com armazenamento disponível. Aba fechada não preserva rascunhos não salvos.
- Dados fictícios podem ter telefones não alcançáveis; não foram convertidos em contatos reais. WhatsApp oficial permanece não configurado.
- Não houve banco, autenticação, publicação ou início da CR-006E. Aguarda aprovação da CR-006D.
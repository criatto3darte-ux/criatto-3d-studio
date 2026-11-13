# CR-007A — Plano de segurança e privacidade

13/11/2026. **Documento de arquitetura e controles propostos, não laudo de vulnerabilidades nem certificação.**

## Evidências disponíveis e limite da auditoria

A ferramenta `security.get_scan_results` respondeu: **nenhum resultado de scan disponível para este projeto**. Não houve deep scan recente para resumir; não foi disparado scan novo nesta etapa de somente leitura. Antes de homologar, executar uma análise pela aba **Security** e revisar seus resultados. Não chamar o app “seguro”, nem interpretar 122 testes aprovados como avaliação de segurança. Não executar revisão de vulnerabilidades própria em substituição ao scanner.

Fatos funcionais confirmados, não achados classificados pelo scanner:

- `/admin/login` declara que o painel não tem proteção real; `admin.tsx` tem apenas noindex e layout. No navegador, `/admin/pedidos` abriu sem login. O modo atual é explicitamente demo, com dados locais, não um acesso a banco de produção.
- `useHydrated()`, sidebar, ocultar links, robots/noindex e login da plataforma de preview **não são autorização administrativa do app**.
- Nenhum cliente de banco, auth middleware/attacher, RLS ou segredo de negócio é implementado na fonte; CSRF para server functions já é configurado em `src/start.ts`. Preservá-lo na integração.
- `safe-url.ts`, validação Zod e regras de histórico são controles úteis no navegador, não substituem validação/autoridade do servidor.
- Dados de checkout ficam em memória; clientes/pedidos fictícios e entradas feitas no painel podem estar no LocalStorage. A declaração de privacidade atual descreve checkout demo, não o armazenamento comercial futuro.
- Captura de erros em `src/lib/error-capture.ts` e `lovable-error-reporting.ts` pode serializar mensagens/objetos; na produção os DTOs/erros enviados a logs devem ser redigidos e correlacionados por request ID, não carregar PII/tokens.

## 1. Identidade administrativa e sessões (proposta)

- Contas administrativas individuais por convite do proprietário, sem cadastro administrativo público ou senha compartilhada. Aprovar método de entrada e MFA; controlar bootstrap do primeiro proprietário fora de payload público.
- Auth gerenciada; papéis em `user_roles` separados de perfil; checagem de papel e perfil ativo no servidor, nunca LocalStorage ou credencial hardcoded.
- Fluxo padrão da plataforma: sessão no cliente, subtree `_authenticated` gerenciada com `ssr:false`, guard antes de loaders; bearer attacher no `src/start.ts`. O guard controla experiência, o middleware de função revalida bearer/identidade e comando verifica papel. Se sessões HttpOnly/SSR admin forem requisito, investigar compatibilidade separadamente, não misturar cookie e bearer sem contrato.
- Não guardar dados pessoais de negócio junto da sessão. Tokens ficam no armazenamento previsto pela auth gerenciada; não copiar para logs, URLs, modelos ou settings. MFA, expiração, revogação e recuperação dependem de confirmação das opções reais do serviço, ainda não provisionado.
- Logout limpa cache privado e estado sensível, cancela requests pendentes e impede leitura de resultado do usuário anterior; troca de identidade invalida queries privadas. Refresh de token não deve invalidar toda aplicação a cada evento.
- Login/callback público retorna ao caminho interno sanitizado; preservar `/admin/*` ao mover rotas, não criar gate em rota SSR pública com sessão LocalStorage inexistente no servidor.

## 2. Matriz preliminar de autorização

| Operação | Anônimo | Editor | Operador | Financeiro | Proprietário |
|---|---|---|---|---|---|
| Ler catálogo/banners/settings públicos | Sim, campos estreitos | Sim | Sim | Sim | Sim |
| Criar solicitação de pedido | Comando limitado | Mesma função pública | Mesma função pública | Mesma função pública | Mesma função pública |
| Ler pedidos/clientes privados | Não | Não | Sim, necessário ao atendimento | Apenas financeiro necessário | Sim |
| Editar/publicar produtos/banners/imagens | Não | Sim | Não | Não | Sim |
| Confirmar/cancelar pedido | Não | Não | Sim conforme regra | Não por padrão | Sim |
| Ajustar estoque | Não | Não por padrão | Só concessão aprovada | Não | Sim |
| Recebimentos/estornos | Não | Não | Resumo, sem escrita | Sim | Sim |
| Alterar papéis/settings/auditoria | Não | Não | Não | Não | Sim |

Papéis são **propostos**; não implementados nem aprovados. “Qualquer usuário autenticado” não equivale a operador. Clientes não precisam Auth, não ganham listagem/consulta de todos os pedidos.

## 3. Banco, RLS e funções

- Toda tabela exposta: criação → grants mínimos → RLS → policies, no mesmo artefato futuro; conferir privilégios SQL **e** filtros de linha. Tabelas privadas sem anon grants. Publicação exige produto e categoria ativos; admin autorizado tem caminho separado para rascunhos/inativos.
- Perfil sem papéis; `has_role` separada, search_path fixo, execução restrita, sem RLS recursiva ou possibilidade de conceder papel próprio. Testar com identidade autenticada que não é admin.
- Public reads usam cliente publishable no handler, sem persistência de sessão e sem credenciais privilegiadas. Colunas públicas projetadas explicitamente; RLS não redige campos.
- Função pública de pedido valida entrada e chama comando transacional estreito. Anon **não** recebe CRUD direto em pedidos/itens/clientes/pagamentos/estoque.
- Papel autorizado deve ser verificado antes de import dinâmico de cliente privilegiado. Operações comuns usam contexto autenticado sujeito a RLS. Quando necessária execução privilegiada (checkout sem conta, upload-finalize), código mínimo, escopo e validação completos; service role bypassa RLS e não decide papel do chamador.
- RPC transacional exige autorização também em execução direta, grants EXECUTE adequados e search_path fixo; não confiar apenas no wrapper web. Tirar escrita bruta de estoque/status/pagamentos quando invariantes exigirem comando, para que Data API não os contorne.
- Validar Zod no servidor: IDs existentes, publicação, opções do produto, quantidade inteira, preço efetivo recalculado, notas/nome/telefone limitados, cupom vigente e saldo. Modelo demo com números DDD 00 nunca deve validar telefone real de produção.
- Histórico, saldo, itens e audit têm invariantes de banco; timestamp e ator do servidor. Preço enviado pelo browser é ignorado; diferença exige reconfirmação, não falsa conclusão pelo valor antigo.

## 4. Pedidos públicos, concorrência e abuso

- Idempotency key aleatória + hash do payload + unique no banco; retry retorna o mesmo pedido, payload diferente gera conflito. Botão duplo e falha de rede não podem duplicar. Um número de pedido não autoriza consulta de PII.
- Solicitação não confirma venda; confirmação disputa estoque na primária dentro de transação, independente de abas/dispositivos/cache; operações atômicas e versions evitam atualização perdida por dois admins.
- CSRF existente é preservado. Endpoints de HTTP externos/callbacks precisam verificar assinatura/origem/credencial conforme chamador, limites de payload e repetição; prefixo `/api/public` não garante proteção.
- Rate limiting é necessário para checkout/login/upload públicos. **A plataforma não oferece primitiva padrão de rate limiting de negócio para apps gerados.** Aprovar alternativa compatível (proteção disponível no serviço, desafio antiautomação ou mecanismo persistente atômico) e trade-off antes de implementar. Não contador global em memória do Worker; não presumir WAF/Turnstile ou binding KV disponível.
- Proposta de limites numéricos será dimensionada em homologação; não inventar uma franquia comercial. Respostas 429 com retry-after, contenção de custo, limite de body/linhas/tempo, alerta de abuso e indisponibilidade. IP sozinho é insuficiente e retenção deve ser mínima.

## 5. Credenciais, execução e logs

- Secrets gerenciados pela plataforma; somente handlers server-side, nunca VITE_, LocalStorage, seed ou HTML/loader data. Clientes gerados após conexão; hoje eles não existem.
- Bundle completo Worker; sem `ssr.external`, native binaries, subprocesso, sharp/canvas ou armazenamento durável em filesystem/singleton. Identidade e estoques duram no banco, não no isolate.
- Log com request ID, comando, código de erro e duração; remover nome/telefone/observações/tokens/URLs assinadas. Histórico administrativo tem ator e contexto mínimo e é separado dos logs técnicos.
- Cache público somente de dados públicos; admin, checkout e respostas contendo PII private/no-store. Nunca retornar credencial interna ou conteúdo de storage privado em cache compartilhado.

## 6. Arquivos enviados

Staging privado, upload autorizado ou ticket curto limitado ao pedido, tamanho/tipo/dimensões verificados no servidor e quota; derivados só após validação de bytes e exclusão de metadados. JPG/PNG/WebP propostos; rejeitar SVG/HTML e formato incompatível, nomear por UUID, impedir path traversal e sobrescrita; não confiar no `accept=image/*` ou MIME do navegador. Arquivos de cliente ficam privados; signed URL curta para operador autorizado, não pública nem indexável. Processamento compatible com edge ou serviço dedicado aprovado; não instalar scanner/native image library no Worker por suposição. Concluir vínculo após arquivo verificado, limpar órfãos com retry idempotente; deletar após retenção/referências verificadas. Conteúdo público já distribuído pode continuar em caches após desativação.

## 7. LGPD e responsabilidade comercial

- Finalidade: atendimento e processamento do pedido; base legal, prazos fiscais/comerciais e identificação do controlador exigem aprovação jurídica/comercial; não presumir consentimento obrigatório para execução de contrato.
- Coletar só nome, telefone e notas; endereço apenas se frete/entrega aprovados; sem CPF obrigatório ou signup. Campos de checkout/política deverão informar **persistência no servidor** antes de pedido real.
- Inventário de operadores/suboperadores (Cloud, hospedagem, WhatsApp, storage), região, transferências internacionais e termos; canal real para direitos do titular, sem contato inventado.
- Retenção/anonymização de pedidos, clientes, anexos, audit e logs definida pelo proprietário; preservar obrigação de histórico sem reter PII indefinidamente. Backups e objetos têm ciclo de vida separado.
- Nome/telefone dentro de mensagem `wa.me` seguem ao WhatsApp por ação do usuário; manter ciência de terceiros, evitar registrar URL com texto sensível em analytics/logs/referrer. Não prometer que abrir WhatsApp enviou mensagem ou confirmou venda.
- Exportação/retificação/exclusão segura de PII é operação administrativa autorizada; controle de identidade do solicitante sem publicar dados no número do pedido.

## 8. Evidências de aceite futuras

Scan da aba Security com achados resolvidos/aceitos por responsável; testes de acesso anônimo, autenticado sem papel, cada papel e papel revogado; chamada direta a funções/Data API/RPC/storage; payload com preço manipulado; pedido repetido/conflitante; última unidade concorrente; arquivo inválido/grande; cache e logout sem dados de outro usuário; restauração banco+objetos ensaiada; política de privacidade validada. Não basta esconder telas, testar noindex ou testar apenas usuário deslogado.

Fundamentação oficial de RLS e grants: [1](https://supabase.com/docs/guides/database/postgres/row-level-security). Backups do banco não incluem os próprios objetos Storage; verificar modalidade/plano real no Cloud, não assumir retenções do fornecedor externo: [3](https://supabase.com/docs/guides/platform/backups).

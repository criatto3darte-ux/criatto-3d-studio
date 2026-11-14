# CR-007B — Implementação da fundação de dados

> **Atualização CR-007B.5:** este documento registra a entrega histórica de oito migrations/592 asserções. A revisão posterior encontrou e corrigiu excesso de privilégio de mídia, com nona migration incremental e 614 asserções. Consulte `CR-007B-GITHUB-INTEGRATION.md`; para integração use o bundle CR-007B5, não o bundle original isoladamente. Nenhum remoto foi escrito.

Data: 13/11/2026. Escopo: loja única, implementação local, sem implantação.
Base: `d922aeffe0f3bb7d7629ff3e8c3f76203a5b129f`.
Branch: `feature/cr-007b-supabase-foundation`.

## Decisão e limites

O cliente autorizou explicitamente migrations locais em `supabase/migrations/`, substituindo para esta entrega a orientação genérica do AGENTS.md de delegar o banco ao Lovable. Nenhum serviço remoto foi escrito. Não houve criação de projeto, bucket, cliente real, administrador real, checkout, pagamento ou deploy. Os registros presentes nos testes são fixtures sintéticas em bancos descartáveis, não seeds de migrations.

A entrega é a **fundação SQL + contratos**, não um backend operacional. Nenhum repositório remoto foi instanciado. Nenhuma chamada Supabase foi adicionada à loja. Não há endpoint público de criação ou leitura de pedidos. O LocalStorage, as regras do demo, carrinho, checkout, componentes, estilos e dependências permanecem intactos.

## Estrutura

- `supabase/migrations/`: oito migrations transacionais ordenadas, 27 tabelas; sem tenant_id.
- `src/features/data-contracts/foundation.ts`: IDs branded via Zod, centavos seguros, DTOs públicos/admin/financeiros, entradas, resultados, erros, paginação e idempotência.
- `src/features/data-contracts/backend-repositories.ts`: interfaces assíncronas segregadas por domínio e privilégio, incluindo identidade, mídia, auditoria, cupons e personalizados.
- `repositories.ts`: todos os contratos legados preservados; reexports somente de tipos adicionados. Alteração de formatação limitada a esse arquivo modificado.
- `tests/postgres/run.py`: PostgreSQL 17 real, socket local explícito, dois bancos exclusivos e descartáveis, com limpeza em `finally`.
- `tests/run-cr007b.sh`: gates reproduzíveis. Não conecta a serviço remoto.
- `src/test/cr007b-contracts.test.ts`: 30 casos novos de runtime e contratos de tipo.
- `docs/evidence/`: saídas efetivamente obtidas, incluindo o débito de lint da base.

## Estratégia de segurança

Cada migration cria suas tabelas, revoga grants amplos, concede privilégios mínimos, habilita RLS/FORCE e cria políticas na mesma transação. Não há janela de tabelas expostas entre arquivos. Anon não possui privilégios de tabela-base. Authenticated sem papel ativo lê apenas seu próprio perfil/atribuições e as projeções públicas.

`has_role` consulta o perfil ativo e os papéis persistidos a cada transação. Revogação/desativação não depende de expiração de JWT de papel administrativo. Helpers SECURITY DEFINER têm `search_path = public, pg_temp`, owner de migrations com bypass de RLS e EXECUTE revogado de PUBLIC/anon; o helper de autorização é executável por authenticated, sem permitir consultar papéis de outros usuários.

As views públicas são **owner-executed, security_barrier**, deliberadamente, porque anon não pode consultar nenhuma tabela-base. Elas não usam SELECT *, não retornam paths de storage, contatos de clientes, notas internas, permissões, custos ou auditoria. Os filtros de publicação e de ancestrais estão nas próprias projeções. Não mudar para security_invoker isoladamente: isso exigiria redesenhar grants e políticas de coluna. Ownership deve continuar com o owner de migrations, nunca com um papel de aplicação. Resolver mídia por ID e produzir URLs verificadas é trabalho posterior do adaptador de mídia, não um bucket público criado nesta etapa.

Operador e proprietário leem os dados operacionais. Financeiro recebe pagamentos e uma view sanitizada de pedidos, não PII de clientes nem a tabela completa de pedidos. Editor edita catálogo, mídia, banners e cupons. Configurações comerciais e auditoria ficam com proprietário. Identidade, pedidos, estoque, pagamentos, personalizados e auditoria não permitem escrita bruta de authenticated; aguardam comandos autorizados de servidor. `service_role` neste SQL é **nome de papel PostgreSQL**, não uma chave ou segredo.

## Invariantes implementadas

- UUID, FK RESTRICT, PK/UNIQUE/CHECK, índices das FKs, centavos bigint com teto seguro de JS; preço efetivo gerado, promoção positiva inferior ao regular e prazo obrigatório sob demanda.
- Variantes ligam produto/grupo/opção por FKs compostas. Trigger diferido exige grupos obrigatórios e opções ativas para variantes ativas; chave de seleção canônica ordenada por UUID, `base` para seleção vazia. Edição completa ocorre em uma transação. Não se gera catálogo ou variantes de demonstração.
- Itens de pedido e eventos de histórico/pagamento/movimento/auditoria são imutáveis por triggers de UPDATE/DELETE/TRUNCATE; grants também negam essas mutações.
- Estoque não negativo e alocado limitado ao físico; deltas de movimentos compatíveis com seu tipo. Alocação pertence ao mesmo produto do item, não ultrapassa quantidade e não se aplica a sob demanda.
- Pagamento exige pedido confirmado e total final definido; referência a pagamento relacionado pertence ao mesmo pedido. Não se implementou política comercial de parcial/estorno/correção.
- Mídia vinculada a evidências/personalizados não pode ter estado published. Somente mídia published aparece nas projeções comerciais, inclusive logo.
- Perfil/role removidos na mesma transação não contornam proteção do último proprietário ativo. Lock consultivo serializa a checagem diferida; cenário concorrente em READ COMMITTED executado. REPEATABLE READ é recusado para essas remoções; comandos futuros devem usar READ COMMITTED ou SERIALIZABLE. SERIALIZABLE ainda exige retry seguro e teste específico antes de produção.
- Singleton de configurações; telefone BR e links seguros. URLs adotam validação conservadora: HTTPS sem credenciais ou caminho local inequívoco; percent-encoding é recusado até existir normalização específica aprovada. Links sociais têm host próprio permitido.
- Numeração sequencial de pedido gerada pelo banco (lacunas aceitáveis); chaves únicas de idempotência e hashes de payload.

## Responsabilidades deliberadamente futuras

Contratos não são implementações transacionais. Locks de estoque, reserva/baixa, soma de itens versus subtotal, cálculo de preços/cupons, replay persistente de respostas, transições atômicas com histórico/auditoria, limites financeiros acumulados, hash canônico seguro, rate limiting, autorização HTTP, upload/verificação de arquivo, retenção/anonimização e notificações precisam de comandos reais antes de liberar writes. Não são simulados como concluídos. Não existe endpoint autorizado a operar essas funções aqui.

A proteção de imutabilidade não restringe o superusuário contra DDL (`DISABLE TRIGGER`, drop de tabelas). RLS não protege de um segredo de servidor comprometido. Manter as credenciais fora do navegador, auditar comandos e limitar acesso operacional são pré-requisitos, não resultados dos testes locais.

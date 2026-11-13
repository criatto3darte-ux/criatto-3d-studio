# CR-007B — Etapa 1: preparação e diagnóstico

13/11/2026. **Somente preparação documental. SQL não criado nem aplicado. Etapas 2–5 não iniciadas.**

## 1. Ambiente e bloqueio de execução

- Arquitetura escolhida no anexo: TanStack Start/hospedagem Lovable + Supabase próprio, futuro Auth/Storage, loja única. Essa decisão substitui a preferência por Cloud dos documentos CR-007A, sem reescrever esses documentos históricos.
- `lovable supabase info --json` retornou `failed_precondition`: este projeto não possui backend Supabase/Lovable Cloud no ambiente solicitado. O contexto da plataforma também informa ausência de conexão. Não habilitar Cloud como substituto da escolha do cliente.
- Não existe `src/integrations/supabase`, cliente de banco ou migrations no inventário atual. A demonstração continua usando `demoRepository` e LocalStorage.
- **Projeto externo exclusivo de homologação: não confirmado.** O resultado da ferramenta não prova que o cliente não tenha um projeto em sua conta; apenas que ele não está acessível por esta conexão.
- **Ausência de dados de outros sistemas e estado do banco: não verificáveis sem acesso de leitura.** Não há inventário remoto de schemas/tabelas, extensões, policies, grants, triggers, funções, usuários, buckets ou histórico de migrations. Não chamar o banco de vazio.
- Gate: identificar o projeto externo e confirmar sua finalidade pelo proprietário; obter acesso por conexão externa do editor, somente após escolha explícita do projeto correto. Em seguida executar inventário somente leitura, incluindo objetos além de `public`, contagens agregadas sem dados pessoais e histórico de migrations. Schema Supabase padrão não significa banco de outra aplicação. A exclusividade exige também declaração do responsável; contagens zeradas não bastam.
- Antes de escrever: verificar plano/região, recuperação e backup disponíveis, permissões do executor, ausência de dados comerciais e separação de produção. O projeto da prévia não garante banco isolado.

## 2. Documentos e contratos comparados

Lidos todos os cinco documentos CR-007A: ARCHITECTURE, DATA-MODEL, SECURITY, ROADMAP e REPORT. Comparados `data-contracts/repositories.ts`, `shared/types/catalog.ts`, `shared/types/order.ts` e `demo-data/model.ts`.

| Contrato atual | Divergência da modelagem aprovada / preparação futura |
|---|---|
| ProductRepository / CategoryRepository | `category` e remoção por slug → FK UUID; separar DTO público/admin; preço efetivo calculado, imagens por mídia e variante vendável por IDs; manter adaptação explícita ao modelo demo |
| Product.availability / stock | `indisponivel` não deve virar modo de produção; distinguir publicação, pronta-entrega/sob-demanda e disponibilidade derivada; estoque compartilhado por produto permanece |
| OrderRepository / DemoOrder | Falta criação idempotente; número string → referência sequencial serializada sem perda; snapshots completos; frete/total anuláveis; pagamento booleano → eventos; comando com versão e chave de operação |
| CustomerRepository | Telefone demo sem identidade verificada → normalização E.164 de produção; cliente continua sem conta obrigatória |
| InventoryRepository.setStock | Substituir comando absoluto sem versão por ajuste autorizado/transacional com motivo, versão e ledger; não implementar nesta preparação |
| BannerRepository / StoreSettingsRepository | Caminhos/URLs diretos → referências de mídia verificada; settings singleton com projeção pública e versão; secrets nunca entram em settings |
| Interfaces ausentes | Cupons/resgates, mídia, variantes, personalizados/histórico, pagamentos, auditoria e métricas |
| Listagens/erros | Arrays inteiros → paginação/cursor e ordenação estável; erros tipados; dinheiro bigint convertido com teto seguro e referência sequencial como string quando necessário |

Os sete contratos existentes são assíncronos, mas ainda usam modelos demo, sem adapters de produção. **Nenhum contrato ou consumidor foi alterado nesta Etapa 1.**

## 3. Lista exata de migrations propostas

Os nomes abaixo são o plano de arquivos futuros, em ordem; não existem arquivos SQL criados. Prefixos sequenciais são provisórios e serão substituídos por timestamps únicos no momento autorizado, depois de comparar o histórico remoto.

1. `0001_cr007b_identity.sql`: enums de papéis e domínios; `admin_profiles`, `user_roles`; verificação de perfil ativo/papel não recursiva com search_path fixo; sem usuários ou concessões reais.
2. `0002_cr007b_catalog.sql`: `categories`, `products`, `product_attribute_groups`, `product_attribute_options`, `product_variants`, `variant_option_values`; FKs estáveis, combinações coerentes, centavos e preço efetivo; índices de publicação/ordem/preço. Busca avançada depende de equivalência definida, não adicionar extensão por presunção.
3. `0003_cr007b_media.sql`: `media_assets`, `product_images`, `category_images`; unicidade de chave/posição/imagem principal, dimensões/tamanhos e estados. Apenas metadados: sem buckets ou uploads.
4. `0004_cr007b_orders.sql`: `customers`, `orders`, `order_items`, `order_status_history`, `payments`; enum dos oito status existentes, snapshots, referência sequencial, idempotência, centavos, índices e FKs de ator/mídia. Sem função pública de checkout ou integração de pagamentos.
5. `0005_cr007b_inventory.sql`: `inventory`, `inventory_movements`, `order_allocations`; saldo não negativo, allocated <= on_hand, FKs de pedido/item/produto e chave de operação; consistência produto/item. Sem decidir ou habilitar marco de alocação/baixa.
6. `0006_cr007b_coupons_requests.sql`: `coupons`, `coupon_redemptions`, `custom_requests`, `custom_request_images`, `custom_request_history`; vigência, integridade, índices e orçamento manual. Sem consumo público de cupom ou envio público de solicitação.
7. `0007_cr007b_content_audit.sql`: `banners`, `store_settings`, `admin_audit_events`; singleton, URLs seguras, metadados e índices de auditoria; sem contatos/defaults comerciais inventados e sem seed demo.
8. `0008_cr007b_access_invariants.sql`: projeções públicas estreitas security-invoker/grants de coluna conforme desenho final; policies de pais publicados e caminhos administrativos para inativos; proteções append-only e consistência entre relações/snapshots. Nenhuma RPC comercial deve ser executável por anon. Funções auxiliares explicitamente sem EXECUTE padrão para PUBLIC.

**27 tabelas propostas.** Em cada arquivo que cria tabela pública: CREATE TABLE → GRANT mínimo → ENABLE RLS → policies daquele arquivo. Não adiar grants/RLS para 0008; as tabelas já nascem default-deny. 0008 completa acessos estreitos sem abrir janela de exposição. Se algum campo/regra não puder ser definido com segurança, a aplicação dessa migration aguarda decisão em vez de inserir um default arbitrário.

## 4. Segurança e testes previstos, não executados

- Sem anon grants em clientes/pedidos/itens/históricos/pagamentos/cupons/resgates/personalizados/perfis/papéis/auditoria. Catálogo público apenas publicado e com pais ativos; coluna privada não é protegida apenas por RLS.
- Autenticado sem papel não ganha poderes administrativos. Papéis propostos editor/operador/financeiro/proprietário precisam de aprovação final; perfil ativo e role são verificados no banco/servidor. Escritas de estoque/status/financeiro ficam negadas diretamente e aguardam comandos estreitos autorizados.
- Testes posteriores em ambiente descartável: FKs simples e compostas, UNIQUE/CHECK e índices; preço promocional e teto monetário; isolamento público/privado inclusive acesso direto Data API; anon, autenticado sem papel, cada papel e revogado/inativo; tentativa de autoatribuir role; EXECUTE direto de funções; tentativa de alterar histórico/snapshot/auditoria.
- Identidades exclusivamente fictícias em instância isolada; não inserir fixtures em migrations de schema. Preparação do teste Auth não significa criar administradores reais ou liberar o painel nesta etapa.
- Reprodutibilidade: aplicar todas migrations em banco novo, conferir histórico, segunda execução pelo runner sem reaplicar arquivos concluídos; reconstruir uma segunda instância e comparar schema. Não fingir que executar CREATE TABLE novamente manualmente é idempotência.
- SQL, policies e testes de banco ainda **não implementados nem validados**. Os 122 testes locais não validam PostgreSQL ou RLS.

## 5. Evidências atuais e arquivos

- Busca `executeAttachedConfig` em `src` sem resultado; `src/App.tsx` ausente. TS2339 citado não reproduzido; nenhuma declaração Window artificial.
- `bunx vitest run`: **122 testes aprovados / 11 arquivos**, 13/11/2026, início 03:02:34 UTC; testes existentes sem modificações.
- Código funcional, dependências, rotas, visual, carrinho, checkout e repositório demonstrativo não alterados. Não houve teste de banco, produção ou fluxo autenticado; nenhuma alegação dessas validações.
- Logs de observabilidade consultados inicialmente sem conteúdo disponível. Não executar build/typecheck manual nesta preparação documental.
- Arquivos de projeto modificados: este relatório, `.lovable/plan.md` (plano para revisão, arquivado após aprovação), `roadmap.md` e regra arquitetural em `AGENTS.md` para registrar a escolha expressa de infraestrutura. Memória registra apenas a restrição de loja única e o gate de homologação.
- Migrations criadas: **0**. Migrations aplicadas: **0**. Recursos conectados/provisionados/publicados: **0**.

## 6. Pendências e próxima ação

Bloqueios: identificação/conexão de Supabase exclusivamente de homologação, declaração de exclusividade, inventário remoto e autorização posterior à revisão deste plano. Decisões de papéis, ajustes de estoque, pagamentos/cupons, retenção e limites ainda não devem ser convertidas em regras comerciais habilitadas.

O responsável pode selecionar o projeto correto em Settings → General → External Supabase → Connect; não conectar produção nem enviar credenciais no chat. Após conexão, a próxima ação é **somente inventário de leitura**, não aplicação automática deste plano. Revisar as diferenças encontradas e pedir autorização de execução.

CR-007B permanece na Etapa 1; CR-007C não iniciada.
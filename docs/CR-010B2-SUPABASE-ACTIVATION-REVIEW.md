# CR-010B.2 — preparação da ativação comercial no Supabase

**Data:** 2026-11-15 UTC  
**Projeto lido:** `ugwuxczcqlrdjkpjsdqb` (`criatto3d-homolog`, PostgreSQL 17.11, `sa-east-1`)  
**Branch/PR:** `arena/1f32d4fc-criatto-3d-studio`, PR #9 draft; nenhuma migration, bucket ou policy foi escrita remotamente nesta revisão.

## Resumo de decisão

A CR-010B.1 é **compatível em estrutura com o schema remoto observado** e o fluxo de aplicação foi transacionalmente testado em PG17 pelo CI da CR-010B.1. Nesta CR-010B.2 foi adicionado um rollback específico e um teste PG17 de ciclo apply/rollback, incluindo proteção contra descarte de limites de estoque configurados. O teste novo precisa passar no CI desta alteração antes de marcar o rollback como validado.

Ainda não é seguro declarar a loja comercial pronta: não existe bucket nem canal confiável para publicar/verificar mídia; não foi feito CRUD remoto com sessão Auth+AAL2; o checkout não persiste pedidos; quantidades públicas de estoque são booleanas e o modelo atual as projeta para saldo `0/1` no cliente.

## 1. Verificação do Supabase remoto (somente leitura)

A conexão retornou exatamente o projeto `ugwuxczcqlrdjkpjsdqb`, ativo/saudável, PG `17.11`. A API de histórico lista **13 migrations**, todas correspondentes às 13 migrations locais anteriores à CR-010B.1, da `20261113120100_cr007b_identity` até `20261115103000_cr009f_hook_type_fix_and_media_aal2`.

As consultas de introspecção confirmaram:

- `public.inventory` existe com `product_id`, `on_hand`, `allocated`, `updated_at`, `version`; **não tem** `minimum_on_hand`.
- As tabelas de categoria/produto/atributos/opções/variantes/valores e as relações de mídia têm as colunas esperadas pelas migrations locais fundacionais.
- Os quatro nomes/signatures da CR-010B.1 (`swap_category_order`, `replace_product_variants`, `adjust_inventory`, `set_inventory_minimum`) **não existem** no remoto. Não há colisão de função.
- As policies administrativas existentes para categorias, produtos, variantes e inventário permanecem baseadas em `has_role(...) AND require_aal2()`. Os triggers existentes `version_stamp` e `valid_variant` estão habilitados. A CR-010B.1 não substitui esses triggers.
- Não há buckets em `storage.buckets` nem policies em `storage.objects`.

A comparação é com os objetos e migrations citados, não um dump byte-a-byte de todo o banco. O nome/ordem das 13 migrations bate com a base local e os objetos necessários foram confirmados. Nenhuma alteração foi aplicada para “corrigir” qualquer divergência.

## 2. Migration comercial exata e DDL

Aplicação proposta — **somente após autorização e revisão operacional**:

`supabase/migrations/20261115120000_cr010b1_catalog_stock_commands.sql`  
SHA-256: `a31f001bdbbe024ac4ed994a814237f2bd81dbca3367e66e28ea56fc057b2c92`

A migration faz `BEGIN`/`COMMIT` e altera somente:

1. Adiciona `inventory.minimum_on_hand integer NOT NULL DEFAULT 0 CHECK (minimum_on_hand >= 0)`.
2. Cria quatro funções: `swap_category_order(uuid,integer,uuid,integer)`, `replace_product_variants(uuid,jsonb,jsonb)`, `adjust_inventory(uuid,integer,text,text,integer)` e `set_inventory_minimum(uuid,integer,integer)`.
3. Revoga `PUBLIC` e `anon` nas quatro funções e concede `EXECUTE` somente a `authenticated`.
4. Não cria tabelas, índices, triggers, views ou policies; não altera grants de tabelas existentes.

`swap_category_order` e `replace_product_variants` são `SECURITY INVOKER` e dependem das policies/grants existentes, além de exigir AAL2 e papel proprietário/editor. `adjust_inventory` e `set_inventory_minimum` são `SECURITY DEFINER`, com `search_path = public, pg_temp`, mas validam AAL2 + proprietário/operador explicitamente e só são executáveis por `authenticated`; essa exceção de privilégio é intencional para o ledger/inventory e deve ser mantida sob revisão. Nenhuma função é disponibilizada a anon.

O `ALTER TABLE ... ADD COLUMN` obtém lock de tabela; em tabela grande deve ser aplicado em janela de baixa atividade. O default constante e `CHECK` tornam o DDL compatível com o estado atual; `CREATE FUNCTION` não é idempotente, então executar exclusivamente pelo histórico do Supabase, nunca repetir SQL manualmente após sucesso.

## 3. Estoque e concorrência

- `adjust_inventory`: lock da linha em `inventory` com `FOR UPDATE`; valida versão esperada; escreve movimento append-only e saldo dentro da mesma chamada/transação; `operation_key` permite replay sem duplicar; não deixa saldo cair abaixo de alocado. O trigger preexistente `version_stamp` incrementa `version` no update.
- `set_inventory_minimum`: mesma linha bloqueada, versão otimista e mesmo trigger de versão.
- `swap_category_order`: advisory lock global do comando e lock das linhas, versões de ambas as categorias verificadas, troca na mesma transação.
- `replace_product_variants`: advisory lock por produto, produto bloqueado, substitui o grafo dentro da chamada. Os constraint triggers diferidos existentes validam integridade no commit, incluindo grupo obrigatório e opção ativa.

São operações transacionais e concorrentes protegidas para os escopos descritos. Não são substituto de reserva de estoque no pedido: checkout/pedido ainda não está implementado, então não há reserva concorrente de unidades no carrinho. Risco residual a avaliar em revisão: ajuste de inventário verifica se produto não está arquivado, mas essa leitura não bloqueia o produto contra arquivamento concorrente; teste de corrida arquivamento/ajuste deve ser incluído antes de ativação se o arquivamento concorrente for cenário operacional possível.

## 4. Rollback específico

Arquivo criado nesta etapa:

`supabase/rollback/20261115120000_cr010b1_catalog_stock_commands.sql`  
SHA-256: `731f645065f602c3f6100eab4a9e9b3b970d57c30575a35fa699271ee2636246`

O rollback também é transacional. Primeiro exige que a coluna exista e **recusa** execução se qualquer produto tiver `minimum_on_hand <> 0`; se aprovado, remove as quatro funções exatas e a coluna adicionada. Não altera tabelas/policies preexistentes. Se mínimos forem configurados, não apagar os dados para forçar rollback: é necessário exportar/decidir como preservar esses valores e preparar rollback revisado.

O harness PG17 foi ampliado para aplicar as 13 migrations fundacionais + migration comercial em banco descartável, confirmar coluna/funções, testar a recusa com mínimo `5`, verificar que a recusa não removeu objetos e, após retornar o valor sintético a zero, executar o rollback e comparar fingerprint de colunas, constraints, índices, policies, triggers, views, grants de tabela e expressões de policy contra o estado pré-migration. O novo teste ainda aguarda o CI deste commit; não alegar aprovação até o job terminar verde.

## 5. Storage: modelo preparado, sem criação

O banco já possui `media_assets`, `product_images`, `category_images`, `custom_request_images`, views públicas e trigger que impede publicar mídia ligada a pedidos personalizados ou comprovantes. O remoto não tem buckets/policies; metadados de `media_assets` foram endurecidos para escrita confiável. Não habilitar escrita direta do navegador nessas tabelas.

Proposta para uma etapa autorizada separada:

| Bucket lógico | Visibilidade | Uso | Escrita/leitura proposta |
|---|---|---|---|
| `catalog-images` | público, somente para derivados já aprovados/publicados | Fotos finais de produto/categoria | Leitura pública é inerente ao bucket público. Sem policy de `INSERT/UPDATE/DELETE` para anon/authenticated. Upload, validação, criação de `media_assets`/associações e remoção somente por Edge Function/backend confiável. Nunca colocar anexos privados neste bucket. |
| `private-attachments` | privado | Imagens de solicitações personalizadas e comprovantes | Sem policy para anon; sem acesso direto por usuário ao objeto. Edge Function verifica JWT, AAL2, papel e vínculo da solicitação/pagamento antes de upload ou URL assinada curta; nenhuma URL pública. |

Proposta inicial de limite: formatos raster aceitos já pelo schema (`image/jpeg`, `image/png`, `image/webp`, `image/avif`); limite de tamanho, dimensões, retenção, expiração de URL e varredura precisam decisão do responsável antes de criar configuração/policies. Caminhos aleatórios não devem conter nome, telefone ou ID de pagamento. A Edge Function validaria conteúdo real (não apenas MIME), dimensões/tamanho, reencodaria derivados e usaria `service_role` **somente em segredo de servidor**. O endpoint precisa validar MFA AAL2 e papéis independentemente, pois `service_role` ignora RLS; nunca fornecer essa chave ao bundle/browser.

Bucket público permite que URL de objeto publicado continue acessível fora da vitrine até remoção/cache expirar. Se a exigência for revogar imediatamente no despublicar, os derivados também devem ficar em bucket privado e a vitrine precisa obter URLs assinadas curtas de um serviço confiável — decisão de produto antes da implementação. Nenhuma dessas policies/buckets foi criada.

## 6. Frontend e pendências reais

- **Produtos/categorias:** as telas `ProductsPage` e `CategoriesPage` leem e escrevem as tabelas Supabase existentes via PostgREST com sessão do usuário e RLS. Não são CRUD demonstrativos. Não foram testadas com conta real AAL2 (o projeto remoto não tem usuário admin provisionado e isso não será feito nesta tarefa).
- **Variantes/SKU:** reads de admin usam tabelas protegidas existentes; writes chamam `replace_product_variants`, ainda inexistente no remoto até aplicar migration. O fluxo público usa views Supabase. Não é funcional em homolog antes da migration.
- **Estoque:** leituras usam `inventory`/`inventory_movements` e políticas existentes; ajuste/mínimo chamam duas funções ainda inexistentes no remoto. Painel não pode completar operação comercial até a migration.
- **Fotos:** `loadCatalog` atualmente preenche `images: []`; `ProductMedia` apresenta fallback visual, não fotos remotas. Não há tela de galeria/upload funcional. Views públicas `public_product_images`/`public_category_images` existem no banco, mas o client não as consulta.
- **Vitrine:** catálogo/categorias usam hook Supabase e views públicas; sem fallback comercial de seed quando Supabase falta (mostra indisponível/erro). Comentário em `CatalogPage` sobre catálogo demo está obsoleto; não significa que os dados atuais venham do seed.
- **Carrinho/checkout:** linhas do carrinho são guardadas em `localStorage` como estado transitório de navegador, não como estoque/pedido oficial. A disponibilidade pública é boolean (`public_availability`); o client transforma em limite 0/1, portanto quantidade comercial real não é suportada. Checkout informa que não cria pedidos; persistência, revalidação server-side, reserva de saldo e idempotência ficam para CR-010C.
- **Mock administrativo fora do escopo catálogo/estoque:** `BannersPage`, `CouponsPage`, `CustomRequestsPage`, `CustomersPage`, `DashboardPage`, `OrdersPage`, `ReportsPage` e `SettingsPage` ainda usam `demoRepository`/seed. Não assumir que estes módulos estão operacionais ou trocar suas origens como parte desta ativação de catálogo.
- **Credenciais frontend:** `src/lib/supabase/client.ts` usa chave anon/publishable e comenta explicitamente que não usa service_role. O checkout/pagamentos não foram ativados.

## 7. Teste, sequência operacional e autorização

1. Aguardar CI PG17 do novo teste de rollback e corrigir eventuais falhas. Revisar o diff do rollback junto da migration.
2. Revisar/aprovar o PR #9 e integrá-lo à branch de integração conforme processo do mantenedor; não fazer merge na `main` por esta tarefa.
3. Antes da aplicação remota: confirmar snapshot/backup e janela; verificar novamente histórico (13 + nenhuma concorrência de migration), checksum e zero mínimo configurado; aplicar **apenas** a migration exata via mecanismo de migration versionado; não executar o rollback preventivamente.
4. Com operador autorizado e sessão AAL2 existente, executar smoke test manual de produto/categoria/variante/estoque, verificar view pública e rollback somente em ambiente isolado. Não criar usuários, convites ou dados remotos sem autorização específica.
5. Decidir canal Edge Function + política de publicação e limites para os dois buckets; implementar e validar em outro change antes de fotos reais.
6. CR-010C: corrigir limite real de unidades via contrato server-side e implementar pedidos/reservas idempotentes antes de chamar a loja de pronta para vendas.

**Autorização necessária agora:** aprovação explícita para (a) aplicar a migration CR-010B.1 em homologação após CI/PR e backup e (b) decidir/autorizar desenho e implementação do serviço confiável de mídia e seus limites. Esta CR-010B.2 não executou nenhuma dessas operações.

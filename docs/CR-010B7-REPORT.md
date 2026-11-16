# CR-010B.7 — execução direta pelo ChatGPT (parcial)

**Projeto:** `ugwuxczcqlrdjkpjsdqb` · **Branch:** `arena/1f32d4fc-criatto-3d-studio` · **PR:** #9 (draft).

## Ações efetivamente executadas

1. Confirmado no Supabase o histórico de **14 migrations**; a migration comercial `cr010b1_catalog_stock_commands` foi aplicada anteriormente e registrada sob a versão **`20261116014216`**, e **não** `20261115120000`.
2. Conciliado o nome **local** do arquivo SQL para `supabase/migrations/20261116014216_cr010b1_catalog_stock_commands.sql`, mantendo seu texto integral sem alteração. Isso impede que o deploy de migrations trate a versão antiga como pendente. O rollback correspondente foi renomeado para `supabase/rollback/20261116014216_cr010b1_catalog_stock_commands.sql`.
3. Atualizadas as quatro referências a esses nomes no harness `tests/postgres/run.py`; o hash SHA-256 **do conteúdo SQL** permanece `a31f001bdbbe024ac4ed994a814237f2bd81dbca3367e66e28ea56fc057b2c92`. Hash do rollback preservado. Relatórios anteriores são registros históricos e podem mencionar os nomes anteriores.
4. Corrigido `src/features/admin/pages/StockPage.tsx` para manter a mesma `operationKey` durante tentativas de reenvio do mesmo ajuste após falha de conexão. Antes, cada clique criava nova chave, podendo duplicar uma movimentação caso a primeira operação tivesse sido confirmada no servidor sem a resposta chegar ao navegador.
5. Corrigido `src/features/catalog/supabase-catalog.ts`: `listAdminProducts()` agora consulta SKUs ativos e vínculos de opções no Supabase, fornecendo combinações reais à projeção de produtos do painel. Esta mudança ainda requer CI e sessão MFA AAL2 para homologação.
6. Inspecionado o código de produtos, categorias, variações, catálogo público e estoque. Já existem consultas reais via Supabase nas telas; **não** declarar CRUD homologado sem testar sessão real MFA AAL2.
7. Verificado que `toPublicProduct()` ainda define `images: []` de forma intencional: o Storage e o serviço de publicação de imagens **não estão prontos**. Por segurança, nenhum URL privado ou de demo foi liberado como substituto.

## Mudanças remotas e restrições

- **GitHub:** somente commits de código/documentação na branch do PR #9.
- **Supabase nesta etapa:** apenas inspeções de leitura, sem DDL, Auth, novos usuários, produtos, pedidos ou Storage.
- **Locaweb, domínio oficial, deploy e merge:** intocados.
- Nenhum arquivo da sessão local da Arena foi sobrescrito; alterações feitas diretamente na branch remota, razão pela qual a Arena deverá sincronizar sem apagar seus arquivos locais.

## Verificação e pendências

- Validação estrutural: SQL de migration existente e referências de arquivo ajustadas; versão remota confirmada.
- **Pendente nesta execução:** executar CI no novo HEAD; testes TypeScript/build/Vitest/PG17 ainda não comprovados para estes commits. Os checks antigos não substituem os novos.
- **Pendente:** disponibilizar bucket público exclusivo para derivados de catálogo e bucket privado para anexos, com acesso autenticado e autorização AAL2; serviço seguro de upload/processamento/associação/publicação de imagens; transições e limpeza de mídia; testes de vazamento entre dados públicos/privados. **Nenhum bucket criado sem aprovação explícita.**
- **Pendente:** sessão real de proprietário para testes CRUD, MFA AAL2, categorias, variantes e movimentações de estoque.
- **Pendente:** finalizar pedidos reais/checkout WhatsApp na etapa CR-010C.

## Próximo passo recomendado

Ajustar as referências de CI se necessário, confirmar os novos checks do PR #9, implementar serviço de mídia com política de autorização no backend **sem deploy remoto**, e depois ativar o Storage com autorização específica. Não executar novamente a migration de estoque.

# CRIATTO 3D — Continuidade de engenharia

**Atualizado:** 2026-11-15 (UTC) · **Etapa:** CR-010B.1, implementação local em revisão
**Branch ativo/fixo:** `arena/1f32d4fc-criatto-3d-studio`
**PR #7:** https://github.com/criatto3darte-ux/criatto-3d-studio/pull/7

## Estado das branches e integração

- Antes da retomada CR-010B.1, HEAD ativo e `origin/arena/1f32d4fc-criatto-3d-studio` eram `5e42fb0feb627f1ffe72d9fa5031485a58e97ffe` (`docs(CR-010B): clarify session branch and push status`).
- A branch do PR #7 (`arena/81a1f1ff-criatto-3d-studio`) e `origin/pr/7` apontavam para `bdf895be12d110761c35d6a77faa92fdaeedc7bb`; era o merge-base. Não havia commits exclusivos na branch 81. O trabalho CR-010B recente já estava no branch ativo e não havia arquivos divergentes da outra branch a sobrescrever.
- Commits de CR-010B no ativo: `43ddb43`, `84457bf`, `0a8d7ab`, `5e42fb0`. Detalhe de CR-010B.1: `docs/CR-010B1-REPORT.md`.
- PR #7 permanece aberto contra `main`, head antigo `bdf895b`, mergeable/CLEAN no momento da consulta. Seus checks verdes pertencem àquele HEAD, não às mudanças novas.
- A sessão exige permanecer no branch ativo fixo; não trocar de branch, não fazer force-push, não tocar `main` nem enviar commits à branch 81. A integração é proposta como PR dependente com base na branch do PR #7; isso **não atualiza automaticamente o head do PR #7** e exige aprovação do mantenedor para integrar.

## Supabase remoto — limites mantidos

Projeto de homologação `ugwuxczcqlrdjkpjsdqb` (`criatto3d-homolog`), `sa-east-1`, Postgres 17.11. Última leitura remota registrada na etapa anterior: 13 migrations até `20261115103000_cr009f_hook_type_fix_and_media_aal2`, signup desabilitado, TOTP habilitado, custom access-token hook habilitado; zero usuários Auth, categorias, produtos, inventário, assets e buckets. Nenhuma consulta de escrita ou alteração remota foi feita nesta etapa CR-010B.1.

- Nenhum usuário, convite, bootstrap, produto/categoria/movimento de teste, bucket, objeto, configuração Auth, policy ou migration foi criado/aplicado remotamente.
- Sem `service_role` no navegador. Checkout, pedidos e pagamentos continuam desabilitados; nenhuma loja oficial foi substituída e nenhum deploy/FTP/Locaweb foi executado.
- Alterações administrativas só podem ser usadas por sessão Auth + MFA AAL2 e políticas existentes. Testes remotos CRUD não foram executados porque não há usuário admin, conforme restrições.

## Implementação local atual

- Vitrine, detalhe, carrinho e categorias lêem as projeções Supabase públicas sem fallback comercial de seed/LocalStorage; loading/erro/vazio são explícitos. Seleções públicas são reconciliadas com combinações de SKU publicadas; combinação inexistente não é aceita. Imagens continuam vazias até Storage seguro.
- Administração de produto persiste campos que já existem (`products`): CRUD, publicação, preço/promoção, destaque e arquivamento seguro. Categorias: CRUD/ativação/exclusão com FK e atualização da vitrine.
- Reordenação de categoria usa agora comando transacional com versões esperadas; não são mais dois updates independentes.
- Administração de variantes/SKU carrega grupos/opções/combinações e as grava via comando atômico em migration local. Editor usa JSON avançado, valida SKU único e bloqueia alterações que removam variante referenciada por pedido.
- Estoque segue leitura do saldo/histórico pela RLS. Foi acrescentado no código um ajuste por movimento append-only com lock, versão otimista, chave idempotente, validação de saldo/alocação, motivo, AAL2 e papel. Estoque mínimo é por produto. **Essas operações ainda não existem no remoto**: dependem da migration local aditiva.
- Imagens/upload/galeria ainda não estão implementados: homolog não tem bucket e `media_assets` reserva criação/verificação de metadados a canal confiável; não criar upload direto no navegador nem abrir policy para contornar isso.

## Migration local CR-010B.1

`supabase/migrations/20261115120000_cr010b1_catalog_stock_commands.sql`, sem aplicação remota. Após verificar as migrations/funções existentes (nenhuma RPC equivalente de catálogo/estoque), esta proposta local acrescenta apenas coluna em `inventory` e comandos de swap de categoria, substituição transacional do grafo de variantes, ajuste de saldo/ledger e estoque mínimo. Não acrescenta tabela, bucket ou policy, nem reabre grants de escrita direta em inventário/media. Hash fixado no harness PG17.

## Validação desta etapa

- `npx tsc --noEmit`: passou.
- Vitest: 197/197 passaram (18 arquivos). Inclui mapeamento e validação de combinação, mas não comprova CRUD comercial, armazenamento remoto ou sessão AAL2 real.
- ESLint com `--max-warnings 0` nos arquivos TypeScript alterados: passou; não houve formatação global. A dívida do lint global do repositório permanece separada.
- `npm run build`: passou com warning de chunk JS (824.46 kB > 500 kB).
- Credential scan passou; autotestes 23/23; `git diff --check`, parser de SQL e compilação de sintaxe Python passaram.
- Harness PostgreSQL 17 foi ampliado para testar migration, persistência commitada, RLS/AAL2, SKU/variantes, publicação em view, categoria, concorrência/idempotência de estoque e mínimo. **Ainda precisa executar em GitHub Actions**; sandbox sem `psql`, servidor PG17, Docker/Podman.
- CI do PR #7 consultado é antigo. O workflow foi ampliado para aceitar PR com base na branch de integração do #7; estado do novo CI deverá ser registrado após abrir PR dependente.
- `npm run lint` global tinha dívida preexistente ampla (860 problemas, majoritariamente Prettier); não formatar o repo inteiro para limpar esse baseline.

## Gates pendentes e próxima etapa

1. Commitar/publicar apenas no branch ativo; abrir PR dependente do ativo para `arena/81a1f1ff-criatto-3d-studio` e acompanhar CI PG17. Não chamar PR #7 de atualizado enquanto o head dele continuar `bdf895b`.
2. Corrigir falhas dos testes PG17 antes de aprovar a migration. Depois obter autorização explícita para aplicá-la em homologação; nenhum comando local aplica automaticamente ao remoto.
3. Para mídia, obter autorização/decisão de bucket, visibilidade, tamanho/MIME, validação, policies e canal confiável de upload/registro/limpeza órfã. A ausência de Storage impede concluir CR-010B comercialmente.
4. CR-010C só depois da decisão de catálogo/estoque e contrato do pedido: implementar criação de pedidos idempotente e validação server-side, com testes de concorrência/permissões. Não iniciar pagamento nem criar pedido nesta etapa.

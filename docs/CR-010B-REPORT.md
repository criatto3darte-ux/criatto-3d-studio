# CRIATTO 3D — CR-010B (relatório inicial, histórico)

> **Situação atual:** este relatório descreve a primeira implementação CR-010B e foi supersedido pelos acréscimos CR-010B.1. Para estado atual, funcionalidades, migration local, testes, branches e integração, consulte [`docs/CR-010B1-REPORT.md`](./CR-010B1-REPORT.md) e [`docs/README-CONTINUIDADE-ARENA.md`](./README-CONTINUIDADE-ARENA.md). Não use as pendências ou resultados abaixo como estado final atual.

**Data do levantamento inicial:** 2026-11-15 (UTC)
**Branch:** `arena/1f32d4fc-criatto-3d-studio`
**PR #7:** https://github.com/criatto3darte-ux/criatto-3d-studio/pull/7

## Estado inicial recuperado

- O checkout começou em `d922aef`, limpo e sem stash. A branch fixa da sessão foi avançada por fast-forward ao HEAD `bdf895be12d110761c35d6a77faa92fdaeedc7bb`, mesmo HEAD observado no PR #7; o trabalho parcial descrito em sessão anterior não existia naquela árvore.
- O branch CR-010B desta sessão (`arena/1f32d4fc-criatto-3d-studio`) não era a branch head do PR #7 (`arena/81a1f1ff-criatto-3d-studio`). Essa diferença de branches persiste e deve ser tratada conforme o relatório CR-010B.1; não foi feita troca de branch.
- A leitura remota inicial de homologação confirmou projeto saudável, Postgres 17.11, 13 migrations até `20261115103000`, zero usuários Auth/categorias/produtos/inventário/assets/buckets, MFA TOTP e hook habilitados. Nenhuma escrita remota foi feita.

## Entregas da etapa inicial

- Vitrine, categorias, detalhe e carrinho passaram a usar projeções públicas Supabase, com estados de carregamento/erro/vazio e sem fallback para produtos comerciais de seed/LocalStorage.
- Administração passou a usar a sessão Supabase existente para os campos existentes de produto/categoria; publicação, promoções, destaque e arquivamento seguro foram ligados à persistência. Estoque era somente leitura e variantes/SKU ainda não eram graváveis nesse estágio.
- Checkout/pedidos/pagamentos foram mantidos indisponíveis. Imagens não foram inventadas nem expostas sem Storage.
- Commits iniciais do branch ativo: `43ddb43` implementação; `84457bf`, `0a8d7ab`, `5e42fb0` documentação/status.

## Verificações históricas da etapa inicial

- TypeScript passou; Vitest 196/196 (18 arquivos); build passou com warning de chunk acima de 500 kB; ESLint focado passou; credential scan/autotestes passaram (23/23).
- `npm run lint` global reportou 860 problemas, predominantemente dívida Prettier preexistente.
- PostgreSQL 17 não foi executado localmente por falta de `psql`, servidor ou Docker/Podman. Os checks verdes então visíveis eram do HEAD anterior do PR #7.
- Não houve teste CRUD com sessão AAL2 real nem mutação remota.

## Restrição permanente

Nenhuma aplicação de migration, criação de bucket, alteração de policy/Auth, criação de usuário/convite/bootstrap, cadastro de produto, escrita de estoque, deploy ou substituição da loja oficial pode ser considerada autorizada por este relatório. O plano atualizado e os gates pendentes ficam no relatório CR-010B.1.

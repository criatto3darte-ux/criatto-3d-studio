# CRIATTO 3D — Continuidade de engenharia

**Atualizado:** 2026-11-15 (UTC) · **Etapa:** retomada CR-010B, implementação parcial/local

## Estado real do checkout e recuperação

- Ao abrir esta sessão, o checkout estava limpo em `d922aef` (`main`), sem arquivos não rastreados e sem stash. Nenhum trabalho parcial de CR-010B existia nessa árvore.
- O PR #7 estava aberto e seu HEAD remoto era `bdf895be12d110761c35d6a77faa92fdaeedc7bb` (`docs(CR-010A): relatório de preparação da loja para produção`). As páginas administrativas continuavam usando `demoRepository`/LocalStorage; não havia camada Supabase de catálogo executável. Portanto, o avanço parcial citado na retomada anterior **não foi recuperado**.
- O HEAD remoto do PR foi recuperado por fast-forward, mantendo o branch fixo desta sessão: `arena/1f32d4fc-criatto-3d-studio`. A branch citada no histórico do PR/na solicitação é `arena/81a1f1ff-criatto-3d-studio`; não foi feito checkout nem push para ela.
- PR #7: https://github.com/criatto3darte-ux/criatto-3d-studio/pull/7 — permanece aberto, HEAD remoto consultado `bdf895b`. Checks daquele HEAD estavam verdes (Static + unit, PostgreSQL 17 local, pacote de homologação). Esses checks **não** validam as alterações locais desta retomada.
- Relatório da etapa anterior: `docs/CR-010A-REPORT.md`. Relatório desta retomada: `docs/CR-010B-REPORT.md`.

## Supabase de homologação (somente leitura nesta retomada)

Projeto confirmado: `ugwuxczcqlrdjkpjsdqb` (`criatto3d-homolog`), região `sa-east-1`, PostgreSQL `17.11`, serviços DB/REST/Storage/Auth saudáveis.

- 13 migrations registradas, até `20261115103000` (`cr009f_hook_type_fix_and_media_aal2`). Nenhuma migration foi criada/aplicada nesta retomada.
- Custom Access Token Hook habilitado para `public.custom_access_token_hook`; Auth com signup desabilitado e MFA TOTP habilitado.
- URL Auth atual ainda é `http://localhost:5173`; allow-list inclui callback local, preview de Arena e `https://homolog.criatto3d.art.br/auth/callback`. Nenhuma configuração foi alterada.
- Contagens lidas: 0 usuários Auth, 0 categorias, 0 produtos, 0 saldos de inventário, 0 registros `media_assets` e 0 buckets Storage.
- As projeções públicas `public_categories`, `public_products`, `public_attribute_groups`, `public_attribute_options`, `public_variants`, `public_variant_options`, `public_product_images` e `public_availability` existem. A busca remota de funções não encontrou comandos RPC de catálogo/estoque; as funções encontradas nessa busca eram auxiliares de mídia.
- Nenhum usuário, convite, produto, categoria, movimento de estoque, bucket ou objeto Storage foi criado. Nenhuma escrita, migration, policy, Auth, deploy, FTP ou domínio foi alterado.

## O que mudou localmente em CR-010B

- Loja pública agora obtém categorias/produtos exclusivamente das projeções Supabase estreitas. Estados de carregamento, erro e catálogo vazio são explícitos; não há fallback silencioso para `products.mock.ts`/seed no serviço da vitrine.
- O detalhe de produto e o carrinho conferem o catálogo remoto. Metadados não promovem registros do seed a páginas indexáveis. Checkout permanece bloqueado até CR-010C.
- Administração de produtos/categorias deixou `useDemoData()` e usa PostgREST direto com a sessão do Supabase; as policies/RLS e `require_aal2()` do banco continuam autoritativas. Categoria suporta criar/editar/ordenar/ativar e exclusão condicionada a ausência de vínculos. Produto suporta criar/editar campos principais, publicar/despublicar e arquivar (em vez de apagar referências históricas), com `version` em atualizações.
- Estoque lê saldo e últimas movimentações sob a policy administrativa existente. Escritas estão deliberadamente bloqueadas na UI: não existe RPC transacional autorizada no remoto; não se contorna a política com escrita direta/LocalStorage.
- Variantes são lidas das relações públicas, mas edição de combinações/SKUs ainda não está habilitada. Imagens e galeria não são gravadas nem servidas como se fossem reais.
- Avisos comerciais foram atualizados para não chamar produtos/preços reais de fictícios e para não prometer checkout ativo. O resumo do carrinho não cria pedidos.

## Pendências e limites — CR-010B não está concluída

1. **Operações de estoque:** falta comando transacional aditivo para saldo + ledger + versão + chave idempotente e autorização de `proprietario`/`operador` em AAL2. Implementar migration local e testes PostgreSQL 17; aplicar no remoto somente após autorização expressa.
2. **Variantes/SKU:** falta comando transacional para grupos, opções, variantes e valores compostos, mantendo os invariantes diferidos do banco. Não foi introduzido RPC sem contrato e teste.
3. **Storage/imagens:** o projeto não tem bucket. É necessária decisão/autorizações para bucket, classificação pública/privada, limites, formatos, validação, policies e fluxo de metadados; não criar bucket nem enfraquecer as policies atuais sem consentimento.
4. **Teste administrativo end-to-end:** não há usuário admin real (e não foi criado, conforme instrução); logo, CRUD com sessão AAL2 não foi exercitado remotamente. Validar em ambiente aprovado depois que a etapa de proprietário permitir.
5. **Vitrine:** projeções remotas foram inspecionadas e contagens confirmadas vazias, mas não houve teste HTTP do bundle com as variáveis públicas do projeto. A configuração local não tem `.env`.
6. **PostgreSQL local:** esta sandbox não tem `psql`, servidor PostgreSQL 17 ou Docker/Podman. O harness PG17 não foi executado nesta retomada. CI verde consultado refere-se ao HEAD remoto anterior.
7. **Branch/PR:** a sessão está vinculada ao branch `arena/1f32d4fc-criatto-3d-studio`, não ao branch do PR #7 (`arena/81a1f1ff-criatto-3d-studio`). Não é permitido trocar de branch; por isso não é possível afirmar que o PR #7 foi atualizado pelos commits locais. Não houve merge.

## Verificações desta retomada

Resultados detalhados em `docs/CR-010B-REPORT.md`. Verificação final: TypeScript passou; Vitest 196/196; build Vite passou com warning de chunk JS acima de 500 kB; ESLint focado nos arquivos alterados passou sem warnings; credential scan e autotestes passaram (23/23). `npm run lint` global acusa dívida de formatação Prettier espalhada em arquivos legados não alterados. O npm foi usado só localmente sem gerar `package-lock.json`; o projeto/CI continua com Bun e `bun.lock`.

## Próximo passo exato

Revisar `docs/CR-010B-REPORT.md`; completar comandos transacionais e testes PG17 **em arquivos locais**, sem alterar migrations históricas. Antes de publicar qualquer migration ou criar Storage remoto, obter autorização explícita. Para validar a administração real, aguardar também o fluxo aprovado de primeiro proprietário/MFA; não criar usuário nem enviar convite nesta etapa.

# CR-010B — Integração inicial do catálogo com Supabase

**Data:** 2026-11-15 (UTC)  
**Status:** parcial; a etapa não está pronta para operação comercial.  
**Branch ativo da sessão:** `arena/1f32d4fc-criatto-3d-studio`.  
**PR principal:** #7, https://github.com/criatto3darte-ux/criatto-3d-studio/pull/7 (HEAD consultado `bdf895b`; continua aberto).

## 1. Diagnóstico da retomada

- A árvore inicial estava limpa no commit `d922aef`, sem arquivos não rastreados e sem stash. Não havia código parcial de CR-010B no checkout.
- O HEAD mais recente do PR #7 foi `bdf895be12d110761c35d6a77faa92fdaeedc7bb`, relatório CR-010A. Nesse HEAD, `ProductsPage`, `CategoriesPage`, `StockPage` e `catalog.service.ts` ainda dependiam de `useDemoData()`/`demoRepository`. Não havia hooks ou camada CRUD Supabase da CR-010B.
- A recuperação foi feita com fast-forward do HEAD remoto do PR para o branch fixo da sessão, sem trocar de branch e sem perder arquivos locais (não havia alterações locais).
- A branch descrita no histórico do PR (`arena/81a1f1ff-criatto-3d-studio`) não é o branch ativo fixo fornecido para esta sessão (`arena/1f32d4fc-criatto-3d-studio`). Por isso, este trabalho local não pode ser apresentado como atualização do head PR #7.

## 2. Verificação remota somente leitura

Projeto `ugwuxczcqlrdjkpjsdqb` confirmado via conector Supabase como `criatto3d-homolog`, `sa-east-1`, PostgreSQL `17.11`, DB/REST/Storage/Auth saudáveis.

| Verificação | Resultado observado |
|---|---|
| Migrations | 13, da `20261113120100` até `20261115103000` |
| Custom Access Token Hook | habilitado para `public.custom_access_token_hook` |
| MFA | TOTP habilitado; signup desabilitado |
| Site URL Auth | `http://localhost:5173`; sem alteração nesta etapa |
| Usuários Auth | 0 |
| Categorias / produtos / inventário | 0 / 0 / 0 |
| `media_assets` / Storage buckets | 0 / 0 |
| Projeções públicas | Views `public_categories`, `public_products`, atributos, variantes, imagens e disponibilidade existentes |
| RPC de catálogo/estoque | busca no catálogo de funções não encontrou comando de escrita correspondente |

Não foi inserido dado de teste remoto. Não foram alterados Auth, policies, migrations remotas, buckets, arquivos, DNS, FTP ou hospedagem. Não foram criados usuários/convites/produtos.

## 3. Entregas locais

### 3.1 Catálogo público

- `src/features/catalog/supabase-catalog.ts`: leitura Supabase das views públicas para categorias, produtos publicados, grupos/opções de variação e disponibilidade; converte os DTOs para os tipos da loja sem usar seed/demo como fallback. Trata ausência de configuração, loading e erro; invalida após mudanças administrativas.
- `src/features/catalog/catalog.service.ts`: `useStoreCatalog()` agora usa a camada remota. Contatos usam apenas o fallback oficial já existente, não `StoreSettings` de LocalStorage.
- Categorias, home, catálogo e detalhe agora mostram loading/erro/estado vazio apropriados. O produto só aparece quando vem da projeção pública e sua categoria ativa existe.
- Disponibilidade pública continua binária conforme a view do banco; quantidade exata não é exposta. URLs de imagem não são inventadas: a projeção não fornece chave de objeto e ainda não há bucket.
- Metadata do produto não usa mais o snapshot fictício de demonstração. O SSR estático não consegue consultar o catálogo sem uma integração server-side; até o catálogo real carregar, o detalhe não anuncia um produto demo como indexável.

### 3.2 Administração

- `ProductsPage`: lista produtos do Supabase; cadastro/edição de campos principais, preço normal/promocional, categoria, tipo/prazo, tags e destaque; publicar/despublicar; arquivar em vez de apagar o registro referenciado. Atualizações usam `version` otimista.
- `CategoriesPage`: lista real; cadastro, edição, ativação, ordenação e remoção apenas quando não há referências de produto. A chave de relação permanece UUID; renomear slug não solta produtos.
- `StockPage`: consulta saldo real e últimas movimentações sob RLS. A escrita de estoque não é feita diretamente e a UI a deixa indisponível até existir um comando transacional aprovado.
- Todas as chamadas de escrita usam a sessão Supabase existente, sem `service_role`; os guardas admin existentes e as políticas do banco continuam obrigatórios. Erros de permissão não são tratados como sucesso.
- `CartContext`/`useReconciledCart` agora conferem o catálogo remoto, não a lista LocalStorage/seed. Checkout permanece bloqueado nesta etapa porque criação persistida de pedidos e revalidação no servidor pertencem à CR-010C.

### 3.3 Segurança e integridade

- Nenhuma migration histórica foi editada; nenhuma migration nova foi aplicada ou necessária para as operações CRUD de tabela já permitidas pelas policies existentes.
- Exclusão de produto tornou-se arquivamento para preservar referências e snapshots. Exclusão de categoria checa vínculos e a FK ainda protege contra corrida entre a checagem e a exclusão.
- Escrita de saldo não contorna a falta de RPC por `UPDATE inventory`; não há mutação de ledger sem transação.
- Sem upload, publicação de mídia ou exposição de mídia privada enquanto bucket/policies e fluxo de verificação não estiverem autorizados.

## 4. Limitações explícitas — não declarar CR-010B concluída

1. Formulário de produto ainda não grava grupos/opções/combinações SKU; o modelo de UI atual não expressa SKU por variante e o schema verifica combinações em triggers diferidos. É necessário um comando atômico bem definido, com testes.
2. Imagem principal/galeria/upload ainda não funcionam. Homolog tem zero buckets. É necessário aprovar bucket(s), acesso público/privado, limite/tipos, verificação do objeto e mapping com `media_assets`/`product_images`; nada disso foi criado.
3. Ajustes de estoque, mínimo e ledger ainda não são graváveis pela administração. A estrutura remota só expõe leitura para papéis autorizados, e nenhuma RPC de ajuste foi encontrada. O próximo passo técnico local é propor uma migration aditiva de comando transacional, incluindo `require_aal2()`, papéis `proprietario`/`operador`, lock, saldo não negativo, `expected_version`, `operation_key`, ator e movimento append-only, e testes PG17. Aplicação remota requer autorização explícita.
4. Não existe proprietário/administrador real no projeto; admin CRUD não foi exercitado com sessão AAL2. Não criar usuário nem convidar nesta etapa.
5. Não foi feito teste de rede da aplicação com o anon key/ambiente de homolog; o catálogo Supabase foi inspecionado por SQL de leitura, não por um usuário real no browser.
6. Vitrine local não tem variáveis `.env`; o estado remoto permanece sem dados. A UI vazia é intencional e não comprova publicação de produto comercial.

## 5. Arquivos desta entrega

- `src/features/catalog/supabase-catalog.ts` — camada de consulta/mapeamento e CRUD de catálogo autorizado pelas policies existentes.
- `src/features/catalog/catalog.service.ts` — serviço/hook remoto da vitrine.
- `src/features/admin/pages/ProductsPage.tsx`
- `src/features/admin/pages/CategoriesPage.tsx`
- `src/features/admin/pages/StockPage.tsx`
- `src/features/cart/CartContext.tsx`, `src/features/cart/useReconciledCart.ts`
- Componentes/páginas da vitrine e rotas de produto para origem remota e estados não comerciais.
- `src/test/cr010b-catalog.test.ts` — testes de mapeamento público.
- Ajustes das suítes antigas de catálogo/carrinho para injetar dados somente nos testes unitários.
- `docs/README-CONTINUIDADE-ARENA.md` — atualizado para refletir este estado.

## 6. Testes e CI

- TypeScript `tsc --noEmit`: **PASS**, sem erros.
- Vitest: **196/196 passaram** (18 arquivos), incluindo 4 testes de mapeamento Supabase; os testes antigos de regras usam fixtures explicitamente em teste.
- Vite build: **PASS**; warning de bundle JavaScript 815.98 kB acima do limite de 500 kB.
- Credential scan: 279 arquivos, sem segredo aparente; autoteste positivo/negativo: **23/23**.
- ESLint direcionado a todos os arquivos alterados: **PASS** com `--max-warnings 0`. ESLint global (`npm run lint`): não passa no baseline amplo — 860 problemas reportados (846 errors, 14 warnings), principalmente regra Prettier espalhada em arquivos legados não alterados. O escopo direcionado de CI existente é menor e cobre contratos CR-007B.
- PostgreSQL 17 local: **não executado nesta sandbox**, pois não há `psql`, servidor local ou Docker/Podman. Não se deve citar o CI do HEAD anterior como teste das alterações novas.
- Instalação local usou `npm install --no-package-lock --ignore-scripts --legacy-peer-deps` porque `bun` não está instalado. Não foi gerado `package-lock.json`; o lock oficial `bun.lock` não foi alterado.
- Nenhum teste de CRUD remoto foi executado e não há dados fictícios remotos.

## 7. Commits, PR e próximo passo

- Commit desta etapa: a registrar após conferência final.
- PR #7 permanece aberto no HEAD remoto `bdf895b`; CI consultado antes destas alterações estava verde, sem executar novo CI sobre elas.
- Nenhum merge, deploy ou alteração na loja oficial.
- Próximo passo técnico: fechar teste de integração dos PostgREST operations com mocks/controlos de RLS; criar e testar em PostgreSQL 17 uma migration estritamente aditiva para variantes/estoque, sem tocar nas 13 aplicadas. Depois revisar e pedir autorização antes de aplicá-la a homologação.
- Próximo gate de mídia: autorização explícita de Storage e definição de buckets/permissões. Próximo gate de integração administrativa real: fluxo aprovado de identidade/owner e sessão AAL2; não faz parte deste commit.

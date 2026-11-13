# CR-006C — Correção de SEO dos Produtos

Data: 13/11/2026. Escopo exclusivo: metadados de produtos. Não foram iniciadas CR-006D ou CR-006E.

## Diagnóstico

O arquivo `src/pages/Index.tsx` e a propriedade `implementAttachedRequirements` informados na mensagem não existem neste projeto. Não foi criada uma declaração fictícia de Window para mascarar o erro.

A divergência real estava em `src/routes/_store.produto.$slug.tsx`: o loader consultava diretamente `products.mock.ts`, enquanto a página consultava `useStoreCatalog()`. Produtos novos, edições de nome/descrição e mudanças de publicação não alcançavam os metadados. O filtro de categorias ativas também não era aplicado ao SEO.

## Correção implementada

- Removidos o loader estático e o import direto de `products.mock.ts` na rota.
- Renderização e metadados usam a mesma projeção `publicProducts` do repositório central, com produtos e categorias ativos.
- `head()` continua sendo o único mecanismo de metadados. Um snapshot hidratado é passado pelo contexto do router; após hidratação ou alterações no repositório, somente a rota de produto é invalidada.
- Nome/descrição atualizados no painel refletem-se em title, description e Open Graph, inclusive por sincronização entre abas, sem precisar recarregar.
- Produtos inexistentes, desativados ou em categorias desativadas apresentam a página já existente de produto não encontrado e `noindex, follow`. Reativação restaura os metadados públicos no navegador.
- Falta de estoque não equivale a despublicação: um produto ativo ainda exibido na loja não é ocultado pelo SEO.
- Canonical e og:url apontam para a própria URL, com caminho relativo porque ainda não há domínio público. URLs/slugs existentes foram preservados.
- Não foram adicionadas imagens sociais sem uma versão absoluta, válida e dimensionada para compartilhamento; os produtos testados usam as ilustrações já existentes.

### Hidratação e duplicação

Um teste inicial revelou que consultar LocalStorage no primeiro `head()` do cliente fazia o React 19 preservar tags do HTML inicial e acrescentar novas tags. O título mudava, mas duas descrições e duas políticas de indexação coexistiam.

A versão final mantém o snapshot de servidor durante a primeira hidratação. Só depois do efeito de montagem passa o snapshot local pelo contexto e reavalia `head()`. Confirmada uma única tag para cada título, descrição, propriedade Open Graph, robots e canonical. Sair da página remove as tags específicas e voltar recupera o produto atual.

## Limitações da demonstração — não é SEO de produção

O servidor não recebe o LocalStorage do visitante. Portanto:

| Situação | HTML inicial sem JavaScript | Navegador após hidratação |
| --- | --- | --- |
| Produto original ativo | Nome/descrição do snapshot inicial; noindex | Dados do repositório local; index se público |
| Produto criado no painel local | Produto não encontrado; noindex | Produto criado, nome/descrição atuais; index se público |
| Produto original editado | Nome/descrição originais; noindex | Nome/descrição editados |
| Produto desativado localmente | Pode existir no snapshot original; noindex | Não encontrado; noindex |
| Categoria desativada localmente | Pode estar ativa no snapshot original; noindex | Produtos ocultos; noindex |
| Produto inexistente | Não encontrado; noindex | Não encontrado; noindex |

O `noindex` inicial em **todos os produtos de demonstração** é uma escolha conservadora: o servidor não pode certificar se a publicação foi removida no navegador. O `index` após hidratação indica o estado público local, não garante indexação por buscadores. Crawlers que observam o noindex inicial podem não executar JavaScript; previews sociais normalmente recebem só o snapshot inicial. Não foi prometida correção de indexação no servidor para dados locais.

A página de ausência continua apresentando o estado visual 404 existente; não foi introduzido um status HTTP 404 para produtos existentes somente no navegador, pois o servidor não pode distinguir ausência real de ausência no snapshot.

## Arquivos alterados

- `src/features/catalog/product.metadata.ts`: geração pura e consistente dos metadados.
- `src/routes/_store.produto.$slug.tsx`: cabeça de rota ligada ao catálogo público e atualização após hidratação.
- `src/features/demo-data/repository.ts`: exportação do snapshot de servidor já existente, sem alterar persistência.
- `src/routes/__root.tsx`: tipagem opcional do contexto para snapshot de metadados; sem alteração visual.
- `src/test/cr006c-product-seo.test.ts`: sete testes de publicação/indexação e limites do servidor.
- `AGENTS.md`, `roadmap.md` e este relatório.

## Validação

### Automatizada

`bunx vitest run`: **70/70 testes aprovados**, nove arquivos, incluindo os 63 testes anteriores. Novos testes cobrem produto ativo, produto criado, produto inativo, categoria inativa, inexistência, política inicial de servidor e indisponibilidade de estoque sem despublicação.

TypeScript e build foram verificados pelo processo automático do ambiente: a última entrada após a correção apresenta **build OK**. Não foi executado build ou typecheck manual, conforme as regras do ambiente. Um erro intermediário de tipagem de metadados foi corrigido usando os atributos React aceitos pelo `head()`.

### Navegador e HTML

Sessão isolada de Playwright, sem alterar dados do navegador do cliente:

- Cadastro real no painel de `Produto SEO Criatto`, descrição e preço/estoque de teste; leitura de volta na página de produto.
- Edição real no painel em outra aba para `Produto SEO Editado` e descrição nova: título visível, title e Open Graph atualizados sem reload.
- Recarregamento de produto novo/oculto, reativação e categoria desativada/reativada.
- Navegação interna produto → catálogo → produto; remoção das tags antigas e ausência de tags duplicadas.
- Produto original ativo e slug inexistente.
- Inspeção do HTML bruto por HTTP para produto original e novo, confirmando o noindex inicial e a limitação do snapshot.
- Desktop 1280px e celulares 375px/320px, temas claro e escuro após reload: metadados corretos, sem rolagem horizontal ou erros de runtime. Capturas de desktop/celular revisadas visualmente; layout preservado.
- Inspeção das demais rotas de conteúdo: suas cabeças específicas existentes foram preservadas. A página inicial é `_store.index.tsx` neste projeto, sem placeholder.

## Recomendações para integração futura

1. Substituir o snapshot local por leitura pública persistente, acessível no servidor, pelos contratos de dados já previstos.
2. Uma leitura validada do produto e categoria deve alimentar renderização e head da rota, com atualização de cache após mudanças administrativas.
3. Somente após publicação certificada no servidor remover o noindex conservador dos produtos públicos; retornar ausência HTTP apropriada para slugs realmente inexistentes/inativos.
4. Com domínio público definido, usar URLs absolutas próprias, sitemap e rendições de imagem social dimensionadas; nenhum domínio ou sitemap fictício foi criado nesta etapa.

## Entrega e aprovação

CR-006C concluída no escopo demonstrativo. Sem alteração de carrinho, checkout, estoque, CSS ou layout; sem banco, autenticação, bibliotecas adicionais ou publicação. Aguardando aprovação do cliente antes de CR-006D; CR-006E também não iniciada.
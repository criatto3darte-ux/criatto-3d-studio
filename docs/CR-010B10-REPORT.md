# CR-010B.10 — Ativação de catálogo e mídia em homologação

**Data:** 2026-11-16  
**Repositório:** criatto3darte-ux/criatto-3d-studio  
**PR de desenvolvimento:** #9 (draft; **não mesclado**)  
**Branch de publicação isolada:** `integration/homolog-commercial-cr010b10`  
**Supabase de homologação:** `ugwuxczcqlrdjkpjsdqb`  
**Hospedagem de homologação:** `https://homolog.criatto3d.art.br` (Locaweb `/public_html/homolog/`)

## Resultado da etapa

1. CRUD real de produtos, categorias, variantes e estoque existente no PR #9 incorporado à branch de homologação. A migration de estoque (`20261116014216_cr010b1_catalog_stock_commands.sql`) **já tinha sido aplicada**; não foi executada novamente.
2. Galeria de produtos: envio local (PNG/JPEG/WebP), WebP otimizado, texto alternativo, imagem principal, remoção, importação por URL HTTPS/CORS, associação a `product_images` e `media_assets`.
3. Banners: substituída a tela demonstrativa por CRUD Supabase, prévia responsiva, criação/edição/ativação/exclusão, upload local, importação de URL e limpeza da mídia vinculada.
4. Arquivamento de produto: remove da vitrine, chama serviço administrativo para desvincular as fotos e excluí-las do Storage e banco. Remoção pode ficar **pendente** em caso de falha parcial, pois Storage e PostgreSQL não compartilham uma transação ACID.
5. Vitrine pública: produtos e banners são projetados a partir das views limitadas `public_catalog_images` e `public_site_banners`; nenhum conteúdo de demonstração deve ser reutilizado no modo comercial.
6. Autenticação: hotfix de MFA inicial do login incorporado à branch comercial, preservando a autenticação de proprietário já validada.
7. Checkout comercial no PR #9 continua **desativado intencionalmente** até implantação dos pedidos reais CR-010C, para evitar mensagens fictícias sem pedido no banco.

## Escritas realmente executadas no Supabase

- Migration `cr010b7_public_catalog_media` aplicada como **`20261116034611`**.
- Migration `cr010b10_public_site_banners` aplicada como **`20261116034643`**.
- Migration history passou para **16** entradas. Arquivos SQL foram renomeados no GitHub para essas mesmas versões, mantendo seu conteúdo; o harness PG17 foi atualizado.
- Bucket público **`catalog-images`** criado com `file_size_limit=5242880` bytes e `allowed_mime_types=['image/webp']`.
- Edge Functions **`catalog-media`** e **`banner-media`** implantadas e ativas, ambas com `verify_jwt=true`. Dentro das funções, operações administrativas validam JWT via GoTrue, AAL2 e perfil/role ativa; service-role fica restrita ao ambiente servidor.
- Verificação de SQL read-only com `SET LOCAL ROLE anon`: SELECT nas views públicas permitido e retorna zero linhas, sem privilégios editoriais expostos.
- Nenhum produto, banner, pedido ou imagem de teste criado ou apagado.

## CI e código

- PR #9: GitHub CI **43800250443** com **Static + unit** e **PostgreSQL 17** aprovados para a conciliação de migrations.
- Nova branch `integration/homolog-commercial-cr010b10`: contém o mesmo catálogo comercial, hotfix MFA, fluxo de banners, galeria e workflow de geração do pacote `criatto3d-homolog-commercial` (build comercial exclusivo de homologação).
- O ZIP é produzido pelo job `Pacote homologação (ZIP artifact)` em push para `integration/*`. **Confirmar que o run mais recente e o artifact existem e foram aprovados antes de usar.**
- A branch de integração não está mesclada com main e não foi enviada à Locaweb neste procedimento.

## Limitações e homologação obrigatória

1. A importação de URL ocorre no navegador com CORS, sem um proxy que faça fetch remoto. Servidores que não autorizam CORS exigirão o download manual da imagem seguido de upload local.
2. Validação real de upload/download/exclusão por conta autenticada AAL2 **pendente**, incluindo rejeição de acessos AAL1/anônimos e testes de fotos de produtos não publicados.
3. Confirmar funcionamento da limpeza após arquivamento e exclusão. Em caso de indisponibilidade de Storage, ocorre tentativa imediata e estado `delete-pending`; ainda falta um job periódico de reconciliação para garantir limpeza eventual sem intervenção.
4. O painel e a loja da homologação **só serão atualizados após o upload manual do novo ZIP no FileZilla**; não declarar deploy realizado.
5. Checkout, cupons, relatórios reais e pedidos pelo WhatsApp **ainda não homologados**. CR-010C deve gravar o pedido no banco antes de emitir link WhatsApp.

## Publicação controlada

1. Abrir GitHub Actions e filtrar `integration/homolog-commercial-cr010b10`.
2. Verificar `Static + unit`, `PostgreSQL 17` e `Pacote homologação (ZIP artifact)` aprovados.
3. Baixar o artifact da execução mais recente e extrair o ZIP interno do site.
4. Fazer backup dos arquivos atuais em `/public_html/homolog/`.
5. Enviar **somente o conteúdo do ZIP do build de homologação** para `/public_html/homolog/`. Nunca modificar `/public_html/` na raiz.
6. Limpar cache com Ctrl+F5, fazer login MFA e testar cadastro de categoria, produto, upload local, importação URL, imagem principal, banners e exclusão.
7. Preservar a publicação antiga se algum teste falhar. Não ativar checkout real antes de CR-010C.

# CR-010B.11 — UX de imagens, estoque inicial e contatos reais

**Branch de desenvolvimento:** `arena/1f32d4fc-criatto-3d-studio` · PR #9  
**Branch de homologação:** `integration/homolog-commercial-cr010b10`  
**Data:** 2026-11-16

## Implementado no código
- Componente reutilizável `ImageCropEditor.tsx` e CSS Module: editor 1200×1200 para fotos de produtos e 1600×900 para banners, arraste para reposicionamento, quatro direções, zoom 100–300%, redefinição e exportação WebP de até 5 MB sem dependência nova.
- Galeria de produtos: ajustes antes de enviar e reenquadramento de imagens já salvas; a substituição envia a nova imagem antes de solicitar a exclusão da anterior, preservando imagem principal.
- Banners: enquadramento para imagem local, URL pública importável e banner existente; após editar, é necessário clicar em **Salvar**.
- Cadastro de produto: quantidade inicial de pronta entrega entre 0 e 99.999, registrada em movimentação auditável `adjust_inventory` com operation key; zero mantém produto indisponível; produtos sob encomenda preservam seu modo de disponibilidade.
- Campo slug renomeado para **Endereço do produto (URL)**, com orientação e autogeração pelo nome. JSON de SKUs fica oculto sob **Configuração avançada** opcional para não confundir o lojista.
- Configurações: formulário de WhatsApp, Instagram, TikTok, e-mail e informações públicas conectado a `store_settings` com RLS proprietário AAL2, sem uso do repositório fictício. Loja passa a carregar `public_store_settings` como projeção pública, com fallback seguro de contatos oficiais.

## Confirmações
- CI da branch do PR #9: **43857062412** aprovado em Static + unit e PostgreSQL 17.
- Supabase: permissões de `anon` na view `public_store_settings`, e de `authenticated` para INSERT/UPDATE em `store_settings`, verificadas somente por leitura.
- Nenhum produto, mídia, estoque, login, senha ou contato comercial do Supabase foi editado nesta etapa.
- Nenhum deploy na Locaweb realizado, nenhum merge e nenhuma alteração na loja oficial.

## Limitações ainda a validar em navegador
- Upload e recorte com ponteiro/mouse e toque, inclusive edição de fotos existentes e substituição física no Storage.
- Atualização de Instagram pela primeira vez e leitura após recarregar o site. A view ainda não continha uma linha de configuração antes dos testes reais.
- Saldo inicial de produto com stock 0 e >0, replay idempotente e atualização na vitrine.
- A versão exibida no domínio de homologação continuará antiga até publicar ZIP da branch `integration/homolog-commercial-cr010b10`. Confirmar CI e artifact dessa branch antes de upload.
- O fluxo de variante com JSON continua avançado; um editor totalmente visual de cores/tamanhos ainda não foi desenvolvido.
- A edição transforma a imagem em novo arquivo WebP; a remoção física de versões anteriores precisa de teste ponta a ponta e reconciliação para falhas parciais de Storage.

## Publicação
Usar o artifact `criatto3d-homolog-commercial` gerado pelo workflow `ci` na branch `integration/homolog-commercial-cr010b10`, após confirmar todos os jobs verdes. Enviar apenas o conteúdo do ZIP para `/public_html/homolog/`; não tocar `/public_html/` raiz. Preservar cópia anterior antes da substituição.

# CR-004 — Painel Administrativo Funcional (demonstração)

Status: **pronto para homologação** (não é um sistema pronto para operação comercial).

## Arquivos criados
- `src/features/demo-data/{model,seed,rules,repository}.ts`
- `src/features/admin/ui/{AdminUI.tsx,ImageManager.tsx,labels.ts,admin.module.css}`
- `src/features/admin/pages/{Dashboard,Products,Categories,Stock,Orders,Customers,CustomRequests,Banners,Coupons,Reports,Settings}Page.tsx`
- `src/features/store/components/PriceTag.tsx`, `src/test/demo-data.test.ts`, este relatório

## Arquivos alterados
- Tipos: `CategorySlug` passou a `string`; `Category` ganhou `active`/`order`; `Product` ganhou `active`/`promoPriceCents`.
- Loja: Home, Hero (textos/botão/imagem do banner ativo, mesmo design), catálogo, categorias, produto (lê catálogo vivo; preço promocional), carrinho, checkout, contato, rodapé e botão do WhatsApp agora leem o repositório.
- `src/shared/config/store.config.ts` removido (substituído pelas Configurações do painel).
- Rotas `admin.*` deixaram de ser placeholders; `AdminLayout` aguarda hidratação.
- `Input` aceita `undefined` explícito em `label/hint/error`.

## Arquitetura do repositório de demonstração
Envelope `{ schemaVersion, savedAt, data }` em `localStorage["criatto3d:demo-data"]`. Versão diferente ou dado inválido → volta ao seed. Cada alteração passa por validação estrutural antes de gravar; outras abas recebem o evento `storage` e atualizam. Contrato `DemoRepository` (`get/update/reset/subscribe`) será trocado por funções de servidor.

## Funcionalidades
Dashboard (8 indicadores, 3 gráficos, pedidos recentes; pendentes não contam como receita) · Produtos (CRUD, publicar, destacar, busca e filtros, cores/tamanhos, imagens com reordenação/principal/remoção) · Categorias (CRUD, ordem, ativação, contagem, transferência obrigatória antes de excluir) · Estoque (ajuste, esgotado/baixo, sob encomenda separado) · Pedidos (status com histórico, cancelamento com confirmação, observações, pagamento recebido, WhatsApp só com telefone de teste válido) · Clientes fictícios (telefone mascarado, histórico, sem CPF/login) · Personalizações (status e orçamento manual) · Banners (CRUD, prévia desktop/mobile, reflete na Home) · Cupons (validação de valores e datas; **não aplicados** no checkout) · Relatórios (período, status, estimado × confirmado × recebido, estoque baixo) · Configurações (compartilhadas com a loja; WhatsApp validado e vazio por padrão; restaurar dados fictícios).

## Testes executados
- Vitest: 37 testes (14 novos: promo, slug, prazo, publicação, estoque, categorias, histórico, receita, snapshots, cupons, WhatsApp, valores, persistência/versão).
- TypeScript estrito sem erros.
- Navegador: cadastro com erro de promoção e correção; produto aparece na loja em outra aba; desativação some da loja ao vivo; cancelamento pede confirmação; banner altera a Home; WhatsApp inválido bloqueado; restauração volta ao seed; sem overflow em 320/375/430 px no painel e na loja; nenhum erro de console.

## Problemas encontrados e correções
- `CategorySlug` fixo impedia categorias novas → virou string com validação de formato.
- Página de produto validava slug no servidor (dados iniciais) → passou a usar o catálogo vivo no navegador.
- Rótulos dos gráficos se sobrepunham → exibição espaçada.

## Limitações sem backend
Dados só neste navegador; pedidos do checkout real não entram no painel; imagens locais são temporárias; sem autenticação real (painel aberto em modo demonstração); cupons não aplicados; nenhuma baixa de estoque ao abrir o WhatsApp.

## Pendências para integração futura (Lovable Cloud)
Tabelas e permissões de administrador; troca do `DemoRepository` por funções de servidor; armazenamento de imagens; registro de pedidos e baixa de estoque na confirmação; cálculo de cupons no carrinho; login administrativo.

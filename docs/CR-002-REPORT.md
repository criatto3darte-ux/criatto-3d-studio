# CR-002 — Loja virtual: relatório

## Entregue
Página inicial (banner, categorias, destaques, novidades, personalizados, benefícios, contato, rodapé completo), categorias, catálogo (busca sem acento, filtros por categoria e disponibilidade, ordenação por preço/nome, estado vazio, carregamento demonstrativo, "Carregar mais"), página do produto (galeria, variações, disponibilidade, prazo, quantidade, adicionar ao carrinho, relacionados), carrinho (adicionar, remover, alterar quantidade, subtotal, total estimado, LocalStorage), Personalizados (formulário demonstrativo com pré-visualização local da imagem), Sobre e Contato configurável.

## Arquivos
Novos: `src/features/catalog/*`, `src/features/store/components/*`, `src/features/store/pages/*`, `src/features/store/home/HomeSections.*`, `src/shared/ui/MediaImage.*`, `src/shared/ui/QuantityStepper.*`, `src/routes/_store.produto.$slug.tsx`, `src/test/catalog.test.ts`, `public/images/README.md`.
Alterados: rotas `_store.{index,produtos,categorias,carrinho,personalizados,sobre,contato}.tsx`, `Hero.*`, `StoreFooter.*`, `store.config.ts`, `shared/types/catalog.ts`, `docs/ARCHITECTURE.md`.

## Testes realizados
- TypeScript estrito sem erros; 14 testes automáticos aprovados (7 novos de catálogo).
- Navegador: todas as rotas públicas em desktop (1280px) e celular (390px), sem rolagem horizontal; busca "vaso" = 3 resultados; Geek + menor preço ordenado; estado vazio; produto → carrinho com variação e quantidade, alteração de quantidade e persistência após recarregar; tema claro e escuro; painel /admin abre normalmente.

## Ainda simulado / pendências
- Produtos, preços, estoques e prazos são fictícios; sem fotos reais (placeholders "Imagem ilustrativa").
- Botão "Finalizar pelo WhatsApp" desativado até a CR-003.
- Formulário de personalizados não envia nada.
- WhatsApp, e-mail, Instagram, TikTok e foto do banner aguardam dados do cliente.
- Painel (CR-001, não alterado): no celular há ~8px de rolagem horizontal em /admin — corrigir com aprovação.

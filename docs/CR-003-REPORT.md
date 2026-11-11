# CR-003 — Checkout pelo WhatsApp: relatório

## Arquivos criados
`src/features/checkout/checkout.logic.ts`, `WhatsAppAction.tsx`, `WhatsAppAction.module.css`, `src/features/store/pages/CheckoutPage.tsx`, `CheckoutPage.module.css`, `src/routes/_store.privacidade.tsx`, `src/test/checkout.test.ts`.

## Arquivos modificados
`src/routes/_store.checkout.tsx`, `CartPage.tsx/.module.css` (botão leva ao checkout), `CustomRequestPage.tsx` (envio pelo WhatsApp), `StoreFooter.tsx` (link de privacidade), `InfoPages.module.css`, `CatalogPage.module.css`, `StoreHeader.module.css`, `shared/ui/Input.module.css` (larguras em telas pequenas), `features/admin/layout/AdminLayout.tsx/.module.css` (overflow mobile), `docs/ARCHITECTURE.md`.

## Funcionalidades
- Checkout sem cadastro: nome completo e WhatsApp com DDD (obrigatórios, com máscara e validação), observações opcionais; aviso de privacidade com link para a política; sem caixa de consentimento.
- Resumo com imagem, nome, variações, quantidade, preço unitário, subtotal, frete "A combinar" e total estimado, tudo calculado do carrinho e formatado com Intl.NumberFormat.
- Mensagem no formato pedido, com referência `#DEMO-XXXXXX` derivada do conteúdo do carrinho (sem Math.random/Date.now; não é número oficial).
- Link oficial `https://wa.me/NUMERO?text=...` com `encodeURIComponent`, aberto pelo clique do usuário (nova aba, sem bloqueio de pop-up). Texto pós-clique não afirma envio automático.
- Número não configurado: botão desativado, aviso explicativo, botão "Verificar dados e ver prévia".
- Personalizados: descrição, quantidade, tamanho, cores e observações na mensagem; imagem só como prévia local e orientação para enviá-la na conversa.
- Painel mobile: causa real era o cabeçalho (título sem encolher + botão "Ver Loja" com texto). Título agora encolhe com reticências e "Ver Loja" vira ícone abaixo de 480px; popover limitado à largura da tela. Sem `overflow-x: hidden`.

## Testes executados (resultados)
- TypeScript estrito: sem erros. Testes automáticos: 23 aprovados (9 novos de checkout: máscara, telefone, nome, mensagem, observações, referência DEMO, número inválido, codificação da URL, personalizado).
- Navegador (Playwright), número **não configurado**: checkout vazio; carrinho com 2 produtos (com variação e sob encomenda); alteração de quantidade; nome vazio/incompleto e telefone inválido mostram erros e focam o campo; máscara "(21) 99999-9999"; botão desativado + aviso; prévia correta (total R$ 129,70); LocalStorage contém só `criatto3d:cart`; carrinho mantido; remoção até carrinho vazio; navegação por teclado (Tab percorre cabeçalho e campos); temas claro e escuro.
- Navegador com número **de teste temporário** (5521999999999, removido após o teste): dados inválidos bloqueiam a abertura; dados válidos abrem nova aba do WhatsApp; texto decodificado confere (incluindo "&" e "#").
- Sem rolagem horizontal: painel em 320/375/390/430/768/1280px; loja em 320px (início, produtos, produto, carrinho, checkout, personalizados, contato, privacidade) e 390px no checkout.

## Não testado
- Envio real da mensagem dentro do aplicativo WhatsApp (depende do número oficial e de um aparelho).
- Leitores de tela reais (apenas atributos de acessibilidade verificados no código).

## Pendências
- Número de WhatsApp comercial, e-mail e redes sociais.
- Texto definitivo da Política de Privacidade e contato do responsável pelos dados.
- Fotos reais dos produtos e do banner.

# Criatto 3D — Arquitetura (CR-001)

Aplicação única (TanStack Start + React 19 + Vite + TypeScript strict) com loja e painel
separados por layout e por pasta de features, compartilhando apenas o design system.

| Pasta | Conteúdo |
|---|---|
| `src/styles/` | `tokens.css` (tokens claro/escuro), `base.css` (reset) |
| `src/shared/ui/` | Componentes reutilizáveis (Button, Badge, Card, Input, Logo, ThemeToggle…) com CSS Modules |
| `src/shared/theme/` | ThemeProvider (Context + LocalStorage, script anti-flash) |
| `src/shared/config/` | Configuração comercial (WhatsApp, envio nacional) |
| `src/shared/types/`, `src/shared/utils/` | Tipos de domínio e utilitários puros |
| `src/features/cart/` | Regras do carrinho (puras, testadas) + CartContext |
| `src/features/store/` | Layout e telas da loja |
| `src/features/admin/` | Layout e telas do painel |
| `src/routes/` | Rotas: `_store.*` (loja, layout sem segmento), `admin.*` (painel), `admin_.login` |
| `docs/` | Documentação |

Decisões:
- Roteamento: TanStack Router (fixo na plataforma) no lugar do React Router; mesmas URLs amigáveis.
- Estilo: CSS Modules + variáveis CSS; sem Tailwind.
- Tema: atributo `data-theme` no `<html>`, padrão escuro, preferência salva.
- Painel em modo demonstração, sem autenticação falsa; `noindex` em todas as rotas `/admin`.
- Preços em centavos; regra "venda confirmada" centralizada em `isConfirmedSale`.
- Integração futura com Lovable Cloud: serviços mock serão trocados por funções de servidor.

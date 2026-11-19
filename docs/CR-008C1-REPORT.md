# CR-008C.1 — Integração do logotipo oficial da Criatto 3D

**Branch:** `integration/cr-008c-homolog` (atualizada, commit `a33b668`)
**PR base:** #4 (`integration/cr-008c-homolog → main`) — **NÃO mergeado, SEM deploy**
**Status:** ✅ Concluído em homologação local/preview

## 1. Objetivo

Substituir os logotipos provisórios (SVG isométrico + texto HTML e o gradiente em CSS da tela de auth) pelo logotipo oficial fornecido (`criatto3d-logo-oficial.png`, 1536×1024 RGBA, fundo preto com glow neon), preservando exatamente cores, gradientes, tipografia e proporções.

## 2. Regras observadas

| Regra | Cumprimento |
|---|---|
| Usar exatamente o logo fornecido | ✅ Todos os assets raster são recortes/redimensionamentos do PNG oficial, nenhum símbolo redesenhado |
| Não modificar cores/proporções/tipografia/gradientes | ✅ Nenhum filtro/saturação/colorização aplicado; proporções preservadas (`object-fit: contain`) |
| Não distorcer/esticar/sombrear o símbolo | ✅ Sem `transform`, `filter`, `drop-shadow`; o glow neon do PNG original é mantido intacto pelo fundo preto |
| Transparência só se preservar glows | ✅ Recorte com transparência **descartado** após inspeção: os halos neon do símbolo e da tipografia (amarelo→rosa→roxo→azul-ciano) vazam para fora das letras e do cubo. Um recorte em alpha iria aparar esses halos. Mantive o fundo preto nativo do PNG em todas as variantes e adicionei um backdrop preto sutil no container `.logo` para que o brilho não fique "cortado" em temas claros |
| Não usar o PNG 1536×1024 bruto na navegação | ✅ Variantes otimizadas (abaixo) — a maior entregue ao navegador tem 512px de largura (full, webp ~15 KB) |
| Variantes para header (desktop/mobile), sidebar admin, auth, footer, favicon, PWA | ✅ Todos os pontos de uso atualizados |
| Tema claro e escuro | ✅ As duas variantes usam o mesmo asset (preto oficial) com backdrop `#080b14`; funciona em qualquer superfície |
| Componente reutilizável com CSS Modules + design tokens | ✅ `src/shared/ui/Logo.tsx` + `Logo.module.css`, usa `--radius-md` |
| Acessibilidade (alt, contraste) | ✅ `alt` padrão descritivo + `aria-hidden` onde é decorativo; texto em preto sobre fundo claro não aplicável (logo é sempre renderizado sobre backdrop escuro) |
| CLS: dimensões explícitas, `width/height` | ✅ `<img>` com `width`/`height` explícitos por variante |
| Otimização: WebP + PNG fallback, `loading="eager"` no header | ✅ Seleção WebP/PNG detectada no cliente (SSR seguro); `loading="eager"` no Logo do header (LCP); `decoding="async"` |
| Não alterar checkout/catálogo/DB/migrations/usuários | ✅ Nenhum arquivo em `supabase/`, `src/features/cart`, `src/features/checkout`, `src/features/catalog`, `src/features/auth/lib/*guards*` foi modificado |
| Não mergear em main, não deploy, não alterar DNS | ✅ Apenas push da branch de integração; PR #4 segue aberto |

## 3. Assets gerados (pipeline sharp)

Fonte: `/tmp/arena-coding-uploads/criatto3d-logo-oficial.png` (1536×1024 RGBA, fundo preto).
Destino: `public/branding/` (logotipos) e `public/` (ícones raiz).

| Arquivo | Tamanho | Uso |
|---|---|---|
| `branding/logo-full-dark.png` | 512px wide | Fallback do logo completo (símbolo + "Criatto 3D" + "PRODUTOS 3D") para header desktop e footer |
| `branding/logo-full-dark.webp` | ~15 KB | Mesmo uso, servido quando o navegador suporta WebP |
| `branding/logo-mark-dark.png` | 192px, fundo preto | Símbolo isolado (header mobile, sidebar colapsada, marca do AuthCard) |
| `branding/logo-mark-dark.webp` | ~4.5 KB | Versão WebP do símbolo |
| `branding/favicon-512.png` | 512×512 quadrado | PWA / share image (fundo preto preenchido via `fit: contain`) |
| `branding/pwa-192.png` | 192×192 | `apple-touch-icon` + PWA |
| `favicon.ico` | 16+32 PNG empacotados em container ICO real | Ícone de aba legado |
| `favicon.svg` | wrapper de 32px | Ícone vetorial moderno |
| `favicon-16.png`, `favicon-32.png` | PNGs 16/32 | Ícones de tamanho explícito |
| `manifest.webmanifest` | JSON | Manifesto PWA (nome, theme_color, ícones 192/512) |

Pipeline de geração: `sharp(source).extract(bbox).resize().png({compressionLevel:9})|webp({quality:82})`.
O bbox de conteúdo útil do símbolo+tipografia foi determinado por varredura (threshold > 15 em qualquer canal, alpha > 5): `minX=277, minY=137, maxX=1261, maxY=808` → área útil 985×672; o recorte final usou margem de ~20px em cada lado (`left=257, top=117, width=1025, height=712`) para preservar os glows de borda.

## 4. Componente `Logo` (reescrito)

`src/shared/ui/Logo.tsx` + `src/shared/ui/Logo.module.css`

**Props:**
- `compact?: boolean` — reduz o tamanho (mobile/footer)
- `showText?: boolean` (default `true`) — mostra variante completa vs só símbolo
- `name?: string` — nome da loja (usado no `alt`)
- `logo?: string` — URL de logo customizado via store settings (substitui o asset oficial se presente)
- `variant?: "full" | "mark"` — sobrepõe a derivação automática
- `className?`, `alt?`

**Decisões de performance:**
- `loading="eager"` (é o LCP do header em todas as páginas)
- `width`/`height` explícitos por variante → evita CLS
- Detecção de suporte a WebP no cliente (com cache em módulo) com fallback seguro para PNG em SSR
- `decoding="async"`, `draggable=false`
- Alias `LogoMark` exportado para manter compatibilidade com o componente Hero da landing

**Estilo:**
- Container `.logo` com `background:#080b14` (backdrop escuro que preserva o glow em qualquer tema)
- Border-radius via `--radius-md` (design token)
- Hover com sombra neon sutil (respeita `prefers-reduced-motion`)
- Media query <480px reduz ligeiramente o tamanho em telas muito estreitas

## 5. Pontos de uso atualizados

| Local | Arquivo | Mudança |
|---|---|---|
| Header loja (desktop+mobile) | `src/features/store/layout/StoreHeader.tsx` | Já consumia `<Logo>`; sem mudança na call. Agora renderiza o logo oficial em vez do SVG provisório |
| Rodapé | `src/features/store/layout/StoreFooter.tsx` | `<Logo compact …/>` — usa a variante compacta oficial |
| Sidebar admin | `src/features/admin/layout/AdminLayout.tsx` | `<Logo showText={!collapsed}/>` — full quando expandida, mark quando colapsada |
| Auth onboarding | `src/features/auth/ui/AuthCard.tsx` + `.module.css` | Removido o placeholder em CSS (um "C" em gradiente); substituído por `<Logo variant="mark" compact/>` |
| Hero da landing | `src/features/store/home/Hero.tsx` | Continua usando `LogoMark` (alias preservado), agora com o símbolo oficial raster em vez do SVG |
| `<head>` do app | `src/routes/__root.tsx` + `index.html` | Adicionados `favicon.svg`, `favicon-32.png`, `apple-touch-icon`, `manifest.webmanifest`; mantido `favicon.ico` legado |

## 6. Verificações

```
tsc (--noEmit):              0 erros
vitest run:                  187/187 testes passando (16 arquivos)
eslint Logo/AuthCard:        0 erros / 0 warnings
vite build:                  ✓ built in 926ms (dist/index.html + CSS 50KB + JS 800KB)
sondagem HTTP (preview):     8/8 rotas/assets retornam 200:
                              /, /produtos, /admin, /auth/onboarding,
                              /branding/logo-full-dark.png,
                              /branding/logo-mark-dark.webp,
                              /favicon.ico, /manifest.webmanifest
```

## 7. Arquivos alterados (19 files changed, +837 / -45)

**Modificados (9):**
- `index.html` — novos links de ícones/manifest
- `package.json` / `package-lock.json` — adição de `sharp` como devDep
- `public/favicon.ico` — substituído por container ICO real (16+32 PNG)
- `src/routes/__root.tsx` — links de favicon/apple-touch/manifest
- `src/shared/ui/Logo.tsx` / `Logo.module.css` — reescritos para assets oficiais
- `src/features/auth/ui/AuthCard.tsx` / `AuthCard.module.css` — mark oficial no lugar do placeholder

**Novos (10):**
- `public/branding/{favicon-512,pwa-192,logo-full-dark,logo-mark-dark}.{png,webp}`
- `public/favicon-16.png`, `public/favicon-32.png`, `public/favicon.svg`, `public/manifest.webmanifest`
- `docs/CR-008C1-REPORT.md` (este documento)

**Intencionalmente não alterados:** migrations, guards, auth, checkout, catálogo, banco, rotas comerciais, dados demo.

## 8. Próximos passos (para operação/homologação humana)

1. Abrir o preview em tema claro e escuro e validar visualmente o logo no header, footer, sidebar admin e tela de auth.
2. Se aprovado, merge do PR #4 em `main` (não executado por este agente).
3. Deploy para hospedagem estática e atualização de DNS — **não executados** por este agente, seguindo restrições do CR-008C.

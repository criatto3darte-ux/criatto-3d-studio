# CR-008F — Preparação para Publicação Inicial (domínio principal criatto3d.art.br)

**Branch**: integração aprovada `integration/cr-008c-homolog` (HEAD `ec84b0e` + bloqueios de produção)
**Domínio**: `criatto3d.art.br` (produção)
**Diretório FTP**: `/home/criatto3d1/public_html/` (pasta vazia, conforme inspeção)
**Data**: 2026-11-14
**Status**: ✅ PACOTE PRONTO — aguardando autorização de upload.

---

## 1. Ajustes de segurança para publicação pública

### 1.1 Bloqueio de rotas administrativas

Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` configuradas (não serão embutidas no bundle):

- `/admin` e todas as rotas `/admin/*` são bloqueadas no `beforeLoad` → `throw redirect({ to: "/", search: { adminDisabled: "1" } })`.
- `/auth/login`, `/auth/callback`, `/auth/mfa`, `/auth/set-password`, `/auth/done`, `/auth/error` (rotas de autenticação/onboarding) são bloqueadas pelo layout `/auth` → redirecionam para `/`.
- `/admin_/login` (tela de login) também bloqueada.
- Todas essas rotas têm `<meta name="robots" content="noindex, nofollow">`.

### 1.2 Banner demonstrativo fixo (`PublicDemoBanner`)

Adicionado banner dourado/azul no topo de todas as páginas da loja com aviso claro:

> **Loja em versão demonstrativa.** Produtos, preços e imagens são fictícios. Nenhum pedido será cobrado ou processado; o checkout apenas simula o fluxo.

Quando o visitante chega via redirecionamento do /admin, um texto adicional é exibido: "A área administrativa será disponibilizada após a homologação." O banner pode ser fechado na sessão.

### 1.3 Identificação de funcionalidades demonstrativas

- `DemoNotice` já existente continua no topo do conteúdo (barra "Modo demonstração: os dados exibidos são simulados...").
- Componente `StorageNotice` informa se localStorage está indisponível.
- O AdminLayout não é acessível publicamente (ver item 1.1).
- Checkout (ver abaixo) não faz requisições HTTP.
- Página `/sobre` descreve o projeto (linkada pelo banner "Saiba mais →").

### 1.4 Checkout seguro

- Checkout não faz `fetch()`/chamadas a Supabase/API externa.
- Não cria pedidos em banco de dados.
- Não envia dados comerciais inadvertidamente — só monta uma string de mensagem e abre `https://wa.me/...` (WhatsApp) com o texto formatado. Se o número de WhatsApp empresarial não estiver configurado, o link não direciona para lugar nenhum.
- Pedidos recebem referência `#DEMO-XXXXXX` (hash local do carrinho, apenas para referência na mensagem).
- Validações de formulário (nome completo, WhatsApp DDD brasileiro) são executadas apenas no cliente.

### 1.5 Nenhuma credencial embutida

Verificação automatizada do pacote:

| Padrão | Ocorrências |
|--------|------------|
| `SUPABASE_SERVICE_ROLE_KEY` | 0 ✅ |
| `service_role` | 0 ✅ |
| URLs `https://*.supabase.co` hardcoded | 0 ✅ |
| Stripe live keys (`sk_live_`, `rk_live_`) | 0 ✅ |
| GitHub tokens (`ghp_`, `github_pat_`) | 0 ✅ |
| Chaves privadas PEM | 0 ✅ |
| FTP/senhas hardcoded | 0 ✅ |

Como `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` não têm `.env.production`, elas ficam `undefined` em runtime e `isSupabaseConfigured()` retorna `false`, acionando os bloqueios do item 1.1.

---

## 2. Identidade visual, catálogo, carrinho, temas

| Item | Status |
|------|--------|
| Logo oficial (dark, full + mark, PNG+WEBP) | ✅ em `/branding/` |
| Favicons (ICO/SVG/16/32/512), apple-touch, manifest PWA | ✅ |
| Tema escuro (padrão) | ✅ |
| Tema claro (toggle) | ✅ com persistência em localStorage e theme-boot sem FOUC |
| Catálogo demonstrativo (sementes em localStorage) | ✅ |
| Busca por nome/descrição | ✅ |
| Categorias | ✅ |
| Carrinho (adicionar/remover/quantidade) | ✅ |
| Checkout simulado (WhatsApp) | ✅ |
| Responsividade (desktop/tablet/mobile) | ✅ (Tailwind, validação DevTools) |
| SEO (title, description, OG, Twitter, robots, canonical) | ✅ meta tags completas no root route |

---

## 3. Build e Validação

| Comando | Resultado |
|---------|-----------|
| `bun x tsc --noEmit` | ✅ 0 erros |
| `bun run test` (vitest) | ✅ 187/187 testes |
| `bun run build` | ✅ sucesso (1.67s) |
| `bun x eslint` (direcionado) | ✅ 0 erros |
| `bash scripts/credential-scan.sh` | ✅ 278 arquivos, sem segredos |
| `bun x vite preview` (rotas) | ✅ /, /produtos, /carrinho, /produto/:slug, favicons, assets → 200 |

### Bundle gerado

```
dist/index.html                  1.39 KB  (0.66 KB gzip)
dist/assets/index-*.css         51.13 KB  (9.90 KB gzip)
dist/assets/index-*.js         772.85 KB  (222 KB gzip)
```

---

## 4. Pacote de publicação

| Item | Valor |
|------|-------|
| Caminho | `publish-production/` e `criatto3d-producao.zip` |
| ZIP | 977 KB (954 KiB) |
| SHA-256 | `8e6e64852eef12448b622eb194b79838c4683a38bcf2f78a7945ae2d7fcb241f` |
| Arquivos | 20 (incluindo .htaccess, _redirects, branding, favicons, assets) |
| Destino FTP | `/home/criatto3d1/public_html/` (raiz do domínio) |
| Tamanho descomprimido | ~1.5 MB |

### Conteúdo do ZIP

```
.htaccess                ← SPA fallback + security headers + cache
_redirects               ← redundância (formato Netlify/cPanel)
index.html               ← shell da SPA
manifest.webmanifest     ← PWA
robots.txt               ← indexação permitida
favicon.ico / .svg / -16.png / -32.png
branding/                ← logos oficiais Criatto 3D (PNG+WEBP) + favicon-512 + pwa-192
assets/index-*.js        ← bundle JS hasheado
assets/index-*.css       ← bundle CSS hasheado
images/README.md         ← placeholder de catálogo
UPLOAD-PRODUCAO.md       ← este guia (NÃO enviar para FTP)
criatto3d-producao.zip   ← cópia do zip (NÃO enviar para FTP)
verify-locaweb-publish.sh← script de verificação (NÃO enviar para FTP)
```

**Ao enviar**: enviar o conteúdo extraído (todos os arquivos listados acima, exceto UPLOAD-PRODUCAO.md, o próprio zip e o script .sh) para `/home/criatto3d1/public_html/`.

### .htaccess incluso

- Rewrite SPA (`!-f && !-d → /index.html [L]`) para F5 em rotas;
- Headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (quando HTTPS);
- Cache de assets hasheados por 1 ano; `index.html` sempre revalidado.

---

## 5. Instruções de upload e rollback

Procedimento detalhado em `publish-production/UPLOAD-PRODUCAO.md`. Resumo:

1. Fazer backup do que houver em `public_html/` (pasta está vazia, mas confirmar).
2. Extrair o ZIP e enviar **todo o conteúdo** (incluindo `.htaccess`) via FTP para `public_html/`.
3. Confirmar permissões (arquivos 644, pastas 755).
4. Validar F5 em rotas profundas (/produtos, /sobre).
5. Testar o bloqueio de /admin (deve redirecionar para / com banner).
6. Testar checkout (abrir WhatsApp com mensagem formatada).
7. Verificar HTTPS (Let's Encrypt via painel se não estiver ativo).

**Rollback**: apagar todos os arquivos enviados de `public_html/` para voltar ao estado vazio, ou restaurar backup anterior se houver.

---

## 6. Verificação pós-upload

```bash
bash publish-production/verify-locaweb-publish.sh https://criatto3d.art.br
```

O script verifica: rotas públicas (/, /produtos, /sobre, etc.), fallback F5, assets, logos, headers de segurança, HTTPS.

Checklist manual adicional em `UPLOAD-PRODUCAO.md` seção 4.

---

## 7. Restrições cumpridas

- ❌ **Não** foi feito merge na main;
- ❌ **Não** houve alteração DNS (assume ciatto3d.art.br já aponta para Locaweb);
- ❌ **Não** foram executadas migrations remotas;
- ❌ **Não** foi ativada autenticação real (sem VITE_SUPABASE_* no bundle);
- ❌ **Não** foram criados usuários/convites;
- ❌ **Não** foi realizado upload automático (pacote pronto, aguardando autorização);
- ❌ **Não** há credenciais de produção embutidas;
- ❌ **Não** o checkout não cria pedidos reais nem cobra.

## 8. Ações pendentes para produção completa (NÃO executadas nesta CR)

- Preencher número de WhatsApp empresarial no catálogo para checkout direcionar corretamente;
- Configurar VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY quando o Supabase estiver homologado (não nesta publicação);
- Popular produtos/categorias reais via painel admin (após autenticação real estar liberada);
- Configurar domínio de e-mail transacional, analytics e outras integrações de produção.

**Status: pacote pronto em `criatto3d-producao.zip`, aguardando autorização para upload manual via FTP.**

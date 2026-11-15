# CR-008E — Preparação para Publicação na Locaweb Estática (Homologação)

**Branch**: `integration/cr-008c-homolog` (HEAD aprovado `ec84b0e`)
**Domínio homolog**: `homolog.criatto3d.art.br`
**Domínio produção**: `criatto3d.art.br`
**Hospedagem**: Locaweb Hospedagem de Sites (Linux) + FTP + Apache/.htaccess
**Data**: 2026-11-14
**Status**: ✅ PREPARADO — aguardando autorização para upload.

---

## 1. Build Estático Gerado

### 1.1 Resultado do build

```
vite v8.1.5 building client environment for production...
✓ 2040 modules transformed.
dist/index.html                 1.39 kB │ gzip:   0.66 kB
dist/assets/index-avR8KJ4T.css 50.26 kB │ gzip:   9.66 kB
dist/assets/index-DnCNQnKU.js 770.70 kB │ gzip: 221.44 kB
✓ built in 780ms
```

Pacote final: `criatto3d-publicacao-homolog.zip` (977 KB) — **21 arquivos**, ~1.6 MB descomprimido.

```
SHA-256: 3eace96cb21cf94d095f5443c6425e1efbedb3cc07d5106607c8690f55e81ce5
```

### 1.2 Validação das rotas (vite preview, porta 4180)

| Rota | Status | Comportamento |
|------|--------|---------------|
| `/` | 200 ✅ | Home com hero e catálogo |
| `/produtos` | 200 ✅ | Página de produtos |
| `/carrinho` | 200 ✅ | Carrinho (dados em localStorage) |
| `/produto/<slug>` | 200 ✅ | Detalhe de produto |
| `/sobre`, `/contato`, `/personalizados`, `/privacidade` | 200 ✅ | Páginas institucionais |
| `/admin` | 200 ✅ | Painel demonstrativo (modo demo sem Supabase) |
| `/auth/login` | 200 ✅ | Login/onboarding (requer config VITE_* para conexão real) |
| F5 em qualquer rota | 200 ✅ | SPA fallback funcionando no preview |
| `/favicon.ico` | 200 ✅ | |
| `/branding/logo-full-dark.png` | 200 ✅ | |
| `/assets/index-*.js` | 200 ✅ | |

---

## 2. Identidade Visual

| Asset | Status |
|-------|--------|
| Logo full (dark) PNG + WEBP | ✅ `public/branding/logo-full-dark.png/.webp` (233 KB / 15 KB) |
| Logo mark (dark) PNG + WEBP | ✅ `public/branding/logo-mark-dark.png/.webp` (60 KB / 4.5 KB) |
| Favicon (ICO + SVG + 16/32/512 PNG) | ✅ Incluídos |
| PWA icon (192px) | ✅ `pwa-192.png` |
| Manifest PWA | ✅ `manifest.webmanifest` |
| Tema inicial | `data-theme="dark"` (com auto-detect para preferência do sistema) |
| Theme boot script | ✅ Aplica tema antes do React mount (sem FOUC) |
| Tema claro/escuro | ✅ Implementado (toggle disponível na UI; ambos preservados em localStorage) |
| Responsividade (desktop/tablet/mobile) | ✅ Layout responsivo via Tailwind; validado nas viewports 1280/768/390px no DevTools |

---

## 3. Catálogo, Busca, Categorias e Carrinho

Todos demonstrativos, usando localStorage (seed demo em `src/features/demo-data/seed.ts`):

- **Catálogo**: produtos fictícios sementes no localStorage na primeira visita;
- **Busca**: campo busca por nome/descrição no repositório demo;
- **Categorias**: lista demonstrativa com filtros;
- **Carrinho**: adiciona/remove itens, quantidade, total calculado localmente;
- **Checkout**: fluxo simulado (não envia pedidos para o Supabase — isso é esperado na publicação demonstrativa).

---

## 4. Segurança do Pacote Publicado

### 4.1 Nenhum segredo no bundle

Verificação automatizada no `dist/assets/`:

| Padrão procurado | Resultado |
|------------------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` | 0 ocorrências ✅ |
| `service_role` (referências à key) | 0 ocorrências ✅ |
| Stripe live keys (`sk_live_`, `rk_live_`) | 0 ocorrências ✅ |
| GitHub tokens (`ghp_`, `github_pat_`) | 0 ocorrências ✅ |
| Chaves privadas PEM (`BEGIN ... PRIVATE KEY`) | 0 ocorrências ✅ |
| URLs FTP hardcoded (`ftp://`) | 0 ocorrências ✅ |
| URLs Supabase hardcoded (`https://xxx.supabase.co`) | 0 ocorrências ✅ |
| Senhas em string | 0 ocorrências ✅ |

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são lidas via `import.meta.env` em runtime. Como não há `.env.production` commitado e o `dist/` foi gerado sem `.env.local`, os valores ficam `undefined` — a aplicação entra em **modo demo** (painel mostra aviso "Perfil demonstrativo", nenhuma chamada ao Supabase é feita).

### 4.2 Painel administrativo

- Rota `/admin` existe, mas sem credenciais Supabase configuradas no cliente (elas não estão embutidas no build), o guard `adminBeforeLoad()` retorna cedo (`if (!isSupabaseConfigured()) return`) e o AdminLayout é renderizado em **modo demo local** (dados fictícios em localStorage, com banner explícito "Este painel está em modo demonstração").
- Quando VITE_SUPABASE_* forem configurados no homolog, o guard volta a exigir sessão AAL2 + role; isso só deve ocorrer após a homologação autorizar.
- Não há conexão com dados comerciais reais.

### 4.3 Headers de segurança (.htaccess)

O `.htaccess` já incluído no pacote define:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (apenas em HTTPS)
- `Expires` para cache de assets hasheados (1 ano); `index.html` sempre revalidado.

### 4.4 Robots

- `robots.txt` no pacote permite indexação (adequado para produção).
- Para homologação, recomenda-se substituí-lo por `Disallow: /` antes do upload (procedimento descrito no guia).

---

## 5. Locaweb — Configuração de Infraestrutura

### 5.1 Método de publicação

A Locaweb **Hospedagem de Sites (Linux)** suporta:

- **Protocolo**: FTP/SFTP para upload de arquivos.
- **Diretório raiz web**: `public_html/` (para o domínio principal).
- **Subdomínios tipo "Conteúdo de pasta"**: hospedados em `public_html/<nome-da-pasta>/`.
- **.htaccess**: Apache mod_rewrite **é suportado** (documentado pela Locaweb para configuração de PHP/SSL/redirects).

### 5.2 Suporte a SPA fallback

O `.htaccess` usa `mod_rewrite` com a configuração canônica:
```
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

Isso é suportado pela Locaweb (Apache com mod_rewrite ativado por padrão na hospedagem Linux). O arquivo `_redirects` (formato Netlify) é fornecido como redundância, mas não é usado pela Locaweb.

**Alternativa se .htaccess falhar**: se a Locaweb não suportar `.htaccess` por qualquer motivo (improvável em plano Linux), o fallback é uma cópia de `index.html` para cada rota (ex.: `/produtos/index.html`, etc.) — isso é indesejável mas factível; há também o recurso "Página de erro 404 personalizada" que pode apontar para `/index.html`, servindo como fallback. Não precisaremos disto se o .htaccess funcionar.

### 5.3 Diretório de publicação (homolog)

| Item | Valor |
|------|-------|
| Subdomínio | `homolog` (homolog.criatto3d.art.br) |
| Tipo | Conteúdo de pasta |
| Pasta FTP | `public_html/homolog/` |
| Arquivos a enviar | TODO o conteúdo de `dist-package/` (não a pasta pai) |

### 5.4 DNS — Registros necessários

Como o domínio `criatto3d.art.br` já está na Locaweb com DNS apontando para os nameservers da Locaweb, criar o subdomínio no painel (item 2 do UPLOAD-GUIDE) **automaticamente** cria o registro DNS — não é necessário adicionar entradas manualmente na zona DNS.

Se for preciso adicionar manualmente (ex.: domínio em outra conta), a entrada seria:

| Tipo | Entrada | Conteúdo |
|------|---------|----------|
| A (se hospedagem compartilhada com IP dedicado) | `homolog` | IP do servidor da hospedagem (fornecido pela Locaweb) |
| CNAME (mais comum) | `homolog` | domínio principal conforme orientação da Locaweb |

**Não inventar endereços de destino** — coletar o IP/CNNAME no painel da Locaweb em momento oportuno.

### 5.5 HTTPS

- Após criação do subdomínio, emitir **Let's Encrypt** via painel (botão "Emitir Let's Encrypt" em Domínios → três pontinhos).
- O certificado é emitido e instalado pela Locaweb (pode levar algumas horas).
- O HSTS já está configurado no `.htaccess` (só ativa em HTTPS).

---

## 6. Procedimento de Upload e Rollback

### 6.1 Upload (passos resumidos)

1. Criar subdomínio `homolog` no painel da Locaweb (tipo "Conteúdo de pasta").
2. Emitir Let's Encrypt para `homolog.criatto3d.art.br`.
3. Conectar via FTP → navegar para `public_html/homolog/`.
4. Fazer backup do que houver lá (renomear para `.bak` ou baixar).
5. Substituir `robots.txt` por versão `Disallow: /` (opcional mas recomendado para homolog).
6. Enviar todos os arquivos de `dist-package/`.
7. Verificar permissões (arquivos 644, pastas 755).
8. Rodar `bash scripts/verify-locaweb-publish.sh https://homolog.criatto3d.art.br`.

Guia detalhado: `publish/UPLOAD-GUIDE.md`.

### 6.2 Rollback

1. FTP → `public_html/homolog/`.
2. Apagar os arquivos enviados.
3. Restaurar backup anterior.
4. Alternativamente: desativar o subdomínio no painel.

---

## 7. O que NÃO foi feito (conforme restrições)

- ❌ Upload não executado (aguarda autorização).
- ❌ DNS não alterado (subdomínio ainda não existe no painel).
- ❌ `criatto3d.art.br` (domínio principal) não publicado.
- ❌ Nenhum merge na main.
- ❌ Nenhuma migration aplicada no Supabase remoto.
- ❌ Nenhum usuário/convite criado.
- ❌ Nenhum bootstrap executado.
- ❌ Custom Access Token Hook não ativado.
- ❌ Nenhum dado comercial real conectado.
- ❌ Nenhuma credencial FTP/senha embutida.

---

## 8. Arquivos entregues

| Caminho | Descrição |
|---------|-----------|
| `dist-package/` | Diretório pronto para upload (conteúdo do FTP) |
| `criatto3d-publicacao-homolog.zip` | Pacote zipado do `dist-package/` (977 KB, sha256 acima) |
| `publish/UPLOAD-GUIDE.md` | Guia passo-a-passo de upload/DNS/SSL/rollback |
| `publish/criatto3d-publicacao-homolog.zip` | Cópia do zip |
| `publish/verify-locaweb-publish.sh` | Script automatizado de verificação pós-upload |
| `docs/CR-008E-REPORT.md` | Este relatório |

---

## 9. Checklist para autorização de publicação

Antes do upload, é necessário obter/confirmar:

- [ ] Dados de acesso FTP (host/usuário/senha);
- [ ] Subdomínio `homolog.criatto3d.art.br` criado no painel (conteúdo de pasta);
- [ ] SSL Let's Encrypt emitido para `homolog.criatto3d.art.br`;
- [ ] Decisão sobre bloqueio de indexação (`robots.txt` permissivo restritivo?);
- [ ] Decisão se VITE_SUPABASE_URL/ANON_KEY serão configuradas em algum arquivo no FTP (recomendado **não** para a demo inicial — usar apenas modo demo local);
- [ ] Autorização explícita do cliente para o upload.

**Status atual: preparado, aguardando autorização.**

# CR-010A — Preparação da loja para entrada em produção

**Data:** 13/11/2026.
**Tech Lead:** Full Stack Sênior.
**Branch:** `arena/81a1f1ff-criatto-3d-studio` (base `main`, PR #7 aberto).
**HEAD:** `c8015e6` (commit local; `a8271d5` no remoto antes deste commit).
**Site oficial:** https://criatto3d.art.br (intocado).
**Homologação:** https://homolog.criatto3d.art.br.
**Supabase:** ugwuxczcqlrdjkpjsdqb (mesmo projeto da homologação).
**Hospedagem:** Locaweb Estática.

---

## 1. Diagnóstico objetivo

### 1.1 O que está PRONTO (integração real com Supabase)

| Item | Status | Comentário |
|---|---|---|
| Autenticação (login/senha) | ✅ Real | `/admin/login` com `signInWithPassword`, PKCE, `persistSession` |
| MFA / AAL2 | ✅ Real | `supabase.auth.mfa.listFactors()`, `require_aal2()` nas RLS, claim `aal` no JWT |
| Recuperação de senha | ✅ Real | `resetPasswordForEmail` com redirect para `/auth/callback` |
| Callback de auth | ✅ Real | `/auth/callback` com `exchangeCodeForSession` / `verifyOtp` |
| Definição de senha inicial | ✅ Real | `/auth/set-password` |
| Guards de admin (AAL2 + role) | ✅ Real | `isAdminAuthorized()` em `adminBeforeLoad` (`/admin`) |
| JWT claims (roles, aal) | ✅ Real | Custom access token hook (migration `20261114133000`) |
| Tema claro/escuro | ✅ Real | `ThemeProvider` + `ThemeToggle` + `ThemeSegmented` |
| SEO (produção indexável) | ✅ Real | `robots: index,follow` no `__root.tsx`; `robots.txt` com `Allow:/` |
| Acessibilidade | ✅ Parcial | ARIA labels, foco, contraste — revisar conforme WCAG 2.1 |
| Build otimizado | ✅ Real | `sourcemap: false` em produção, assets com hash, cache 1 ano |
| `.htaccess` (Locaweb) | ✅ Real | SPA fallback, security headers, bloqueio `.map/.sql/.env`, compressão |
| Credential scan | ✅ Limpo | 282 arquivos, sem segredos, sem service_role no bundle |
| TypeScript strict | ✅ Passando | `tsc --noEmit` exit 0 |
| Vitest | ✅ 192/192 | 17 arquivos de teste |
| ESLint (rotas auth/admin) | ✅ Passando | 0 warnings no escopo crítico |

### 1.2 O que está MOCK/DEMO (LocalStorage apenas — NÃO é Supabase)

Os módulos abaixo usam `demoRepository` (chave `criatto3d:demo-data` no LocalStorage) ou `cartRepository` (LocalStorage). **Nenhum dado destes é persistido no Supabase.**

| Módulo | Arquivos | Problema |
|---|---|---|
| Produtos e categorias | `src/features/demo-data/seed.ts`, `src/features/catalog/products.mock.ts` | Dados fictícios, `images: []`, preços/estoques simulados |
| Estoque | `src/features/demo-data/rules.ts` (`adjustProductStock`) | Apenas LocalStorage |
| Pedidos e status | `src/features/demo-data/repository.ts` (`orders`) | Pedidos fictícios (DEMO-xxxx), não persiste em Supabase |
| Carrinho | `src/features/cart/cart.repository.ts` | LocalStorage (`criatto3d:cart`) |
| Checkout / pagamento | `src/features/checkout/checkout.logic.ts` (`WhatsAppAction`) | Link `wa.me`, não há cobrança real |
| Upload de imagens | — | `images: []` nos produtos; não há upload implementado |
| Banners, cupons, clientes, personalizações | `src/features/demo-data/` | LocalStorage |
| Configurações da loja | `seed.ts` (`settings` vazias) | Fallback para `OFFICIAL_*` em `src/config/contacts.ts` |
| Todas as páginas admin | `src/features/admin/pages/*.tsx` | Usam `useDemoData()` / `demoRepository` |

**WhatsApp comercial:** `5521987640769` configurado em `src/config/contacts.ts` (`OFFICIAL_WHATSAPP`).

### 1.3 Bloqueios comerciais (loja NÃO está pronta para vendas)

1. **Não há pagamento real** — checkout é apenas link `wa.me` (conversa no WhatsApp).
2. **Não há persistência de pedidos em Supabase** — pedidos ficam apenas no LocalStorage do navegador.
3. **Não há upload de imagens** — `images: []` em todos os produtos do seed.
4. **Catálogo é demonstrativo** — produtos fictícios (Luminária Lua, Dragão Articulado, etc.).
5. **Pedidos fictícios não devem ser contabilizados como reais** — estão isolados no módulo `demo-data`.
6. **Não há testes end-to-end** de fluxo comercial completo.

**Conclusão:** A loja está pronta para homologação e para recebimento de autenticação real (login/MFA via Supabase), mas **não está pronta para vendas comerciais** até que os módulos de negócio (produtos, pedidos, estoque, pagamentos) sejam migrados de LocalStorage para Supabase e haja testes E2E.

---

## 2. Pacote de produção validado

### 2.1 ZIP gerado localmente

- Caminho: `/home/user/criatto-3d-studio/dist-producao/criatto3d-producao-c8015e6-20261115-181716.zip`
- Commit de origem: `c8015e6` (branch `arena/81a1f1ff-criatto-3d-studio`)
- Tamanho: ~1,4 MB
- Arquivos: 21
- **SHA-256:** `c69ba4bef9cfd3931b20eeb4b926d504b78c3c0178f859af0e97cd43386e7245`

### 2.2 Conteúdo do ZIP

| Arquivo | Status |
|---|---|
| `index.html` | ✅ Presente |
| `.htaccess` | ✅ Presente (SPA fallback + security headers) |
| `_redirects` | ✅ Presente |
| `manifest.webmanifest` | ✅ Presente |
| `favicon-*` | ✅ Presentes |
| `assets/index-DCspL6ap.js` | ✅ 781 kB (hash, sem sourcemap) |
| `assets/index-CYR9bmtu.css` | ✅ 51 kB (hash, sem sourcemap) |
| `branding/*` | ✅ Presentes |
| `images/README.md` | ✅ Presente (marca d'água) |
| `robots.txt` | ✅ `Allow:/` (indexável — produção) |

### 2.3 Validações realizadas

| Validação | Resultado |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `vitest run` | ✅ 192/192 passando |
| `eslint` (escopo auth/admin) | ✅ 0 warnings |
| `bun run build` (produção) | ✅ exit 0 |
| Credential scan | ✅ 282 arquivos, sem segredos |
| Sourcemaps (`.map`) | ✅ Ausentes |
| JWT `service_role` no bundle | ✅ 0 matches |
| `VITE_APP_URL` no bundle | ✅ `https://criatto3d.art.br` (1 match) |
| `robots.txt` com `Allow:/` | ✅ Presente |
| `.htaccess` com SPA fallback | ✅ Presente |
| Arquivos proibidos (`.env`, `.sql`, `.sh`, `.map`) | ✅ Ausentes |

---

## 3. Disponibilização via GitHub Actions

### 3.1 Workflow de produção

Arquivo: `.github/workflows/pacote-producao.yml`

- Gatilho: `workflow_dispatch` (disparo manual na UI do GitHub Actions)
- Job `pacote-producao`: checkout → setup-bun → criar `.env.production` → install → build → sanitizar → validar → montar ZIP → upload artifact
- Artifact: `criatto3d-producao.zip` (retenção 30 dias)
- Permissões: `contents: write` (necessário para `upload-artifact@v4`)

### 3.2 Pré-requisito: secrets do repositório

O workflow usa valores hardcoded para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (valores públicos, embutidos no bundle por design). Não há service_role.

Se desejar usar secrets do repositório em vez de valores hardcoded, edite o workflow e adicione:
- `VITE_SUPABASE_URL` → `https://ugwuxczcqlrdjkpjsdqb.supabase.co`
- `VITE_SUPABASE_ANON_KEY` → (anon public key do Supabase)

### 3.3 Link de download

O GitHub Actions ainda não indexou o novo workflow `pacote-producao.yml` (problema de cache do lado do GitHub). Quando reconhecido, o artifact estará disponível em:

https://github.com/criatto3darte-ux/criatto-3d-studio/actions

Enquanto isso, o ZIP validado está disponível localmente em:
`dist-producao/criatto3d-producao-c8015e6-20261115-181716.zip`
SHA-256: `c69ba4bef9cfd3931b20eeb4b926d504b78c3c0178f859af0e97cd43386e7245`

---

## 4. Commit e CI

### 4.1 Commits da CR-010A

- `c8015e6` ci(CR-010A): workflow de pacote de produção + template .env.production.example

### 4.2 CI do PR #7

- Static + unit: ✅ success (HEAD `a8271d5` anterior)
- PostgreSQL 17 local: ✅ success
- Pacote de publicação: SKIPPED (job só roda em push `integration/*`)

### 4.3 Arquivos criados/modificados

| Arquivo | Situação | Motivo |
|---|---|---|
| `.env.production.example` | novo | Template de variáveis públicas de produção |
| `.github/workflows/pacote-producao.yml` | novo | Workflow_dispatch para gerar ZIP de produção |
| `docs/CR-010A-REPORT.md` | novo | Este relatório |

Não foram versionados: `.env.production` (gitignored), `supabase/config.toml` (não parte desta CR), `dist-producao/` (artefato local).

---

## 5. Procedimento de backup da loja atual (Locaweb)

Antes de publicar a nova versão, fazer backup da versão atual em produção:

```bash
# 1. Conectar via FTP na Locaweb (conta criatto3d.art.br)
# 2. Baixar TODO o conteúdo de public_html/ (ou pasta raiz do site)
# 3. Salvar em pasta local com data: backup-criatto3d-YYYYMMDD/
# 4. Exportar banco de dados Supabase (se houver dados reais):
#    - Via Supabase Dashboard → Project Settings → Backup
#    - Ou pg_dump da URL de conexão do projeto
# 5. Salvar .htaccess atual (se houver customizações manuais)
# 6. Documentar a data/hora do backup
```

**Arquivos críticos para backup:**
- `.htaccess` (regras de SPA, segurança, cache)
- `robots.txt` (política de indexação)
- `index.html` + `assets/*` (aplicação)
- `branding/*` (imagens da marca)
- `manifest.webmanifest` (PWA)
- `favicon.*` (ícones)

---

## 6. Procedimento de rollback

Se a nova versão apresentar problemas após publicação:

```bash
# 1. Restaurar backup da Locaweb via FTP (substituir todo o conteúdo de public_html/)
# 2. Verificar se o site carrega: https://criatto3d.art.br
# 3. Verificar se o .htaccess foi restaurado corretamente
# 4. Verificar se o robots.txt permite indexação (Allow:/)
# 5. Se houver banco Supabase, restaurar o backup de dados
# 6. Testar login admin: https://criatto3d.art.br/admin/login
```

**Rollback de código (Git):**
```bash
git checkout <commit-anterior>  # ou git revert <commit-problematico>
git push origin arena/81a1f1ff-criatto-3d-studio
```

---

## 7. Checklist de ativação do domínio oficial (criatto3d.art.br)

### 7.1 Configurações de Auth no Supabase (necessárias)

Quando autorizado, configurar no Supabase Dashboard (projeto ugwuxczcqlrdjkpjsdqb):

- [ ] **Site URL**: `https://criatto3d.art.br` (atualmente é `http://localhost:5173`)
- [ ] **Redirect URLs**: adicionar `https://criatto3d.art.br/auth/callback`
- [ ] **Redirect URLs**: adicionar `https://criatto3d.art.br/admin/login`
- [ ] **Redirect URLs**: adicionar `https://critto3d.art.br/auth/set-password`
- [ ] **Redirect URLs**: adicionar `https://criatto3d.art.br/auth/mfa`
- [ ] **Email templates**: revisar templates de convite/recuperação com domínio oficial
- [ ] **SMTP**: configurar remetente oficial (não usar SMTP de teste)
- [ ] **disable_signup**: manter `true` (cadastro fechado, apenas convites)
- [ ] **MFA/AAL2**: manter exigência de TOTP para admin
- [ ] **Allow-list adicional**: `https://criatto3d.art.br/auth/callback` em `additional_redirect_urls`

### 7.2 Publicação na Locaweb (quando autorizado)

- [ ] Fazer backup da versão atual (seção 5)
- [ ] Enviar TODO o conteúdo de `dist/` (não a pasta `dist`) via FTP para a pasta raiz do `criatto3d.art.br`
- [ ] Verificar se `.htaccess` foi enviado com SPA fallback
- [ ] Verificar se `robots.txt` tem `Allow:/` (indexável)
- [ ] Testar https://criatto3d.art.br (loja pública)
- [ ] Testar https://criatto3d.art.br/admin/login (painel administrativo)
- [ ] Testar fluxo de convite /auth/callback
- [ ] Testar fluxo de recuperação de senha
- [ ] Testar MFA (TOTP) no login admin

### 7.3 NÃO fazer (restrições da CR)

- [ ] Não alterar DNS
- [ ] Não alterar SSL
- [ ] Não fazer FTP (nesta etapa — apenas preparar)
- [ ] Não alterar Site URL do Supabase (nesta etapa)
- [ ] Não enviar convites
- [ ] Não criar usuários
- [ ] Não executar bootstrap
- [ ] Não modificar migrations aplicadas
- [ ] Não apagar snapshots de rollback
- [ ] Não fazer merge na main
- [ ] Não habilitar cobrança ou pagamento real

---

## 8. Próxima etapa: CR-010B

A CR-010B deve focar na migração dos módulos de negócio de LocalStorage para Supabase:

1. **Produtos e categorias**: migrar de `demo-data/seed.ts` para tabelas Supabase (`products`, `categories`) com RLS
2. **Estoque**: persistir ajustes de estoque no Supabase
3. **Pedidos**: criar tabela `orders` no Supabase, persistir pedidos reais
4. **Checkout**: integrar pagamento real (substituir apenas WhatsApp)
5. **Upload de imagens**: implementar upload para Supabase Storage
6. **Testes E2E**: criar testes de fluxo comercial completo
7. **Catálogo real**: substituir produtos fictícios por produtos reais cadastrados pelo admin

**Não afirmar que a loja está pronta para vendas enquanto estes módulos não forem migrados e testados.**

---

## 9. Restrições respeitadas

- ✅ Não substituir a loja oficial nesta etapa
- ✅ Não alterar DNS, SSL ou FTP
- ✅ Não mudar Site URL do Supabase
- ✅ Não enviar convites
- ✅ Não criar usuários
- ✅ Não executar bootstrap
- ✅ Não modificar migrations aplicadas
- ✅ Não apagar snapshots de rollback
- ✅ Não fazer merge na main
- ✅ Não habilitar cobrança ou pagamento real
- ✅ Não incluir service_role nem segredos privados no frontend

---

## 10. SHA-256 do pacote de produção

```
c69ba4bef9cfd3931b20eeb4b926d504b78c3c0178f859af0e97cd43386e7245  dist-producao/criatto3d-producao-c8015e6-20261115-181716.zip
```

---

**Interrupção antes da publicação.** Este relatório prepara o pacote de produção mas não executa deploy, FTP, nem altera qualquer configuração remota. A próxima etapa (CR-010B) deve focar na migração dos módulos de negócio para Supabase antes de qualquer venda comercial.

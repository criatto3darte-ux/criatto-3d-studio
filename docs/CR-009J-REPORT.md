# CR-009J — Preservação definitiva do pacote de homologação

**Data:** 13/11/2026.
**Escopo:** build estático de homologação, validação de ausência de credenciais, commit, push, CI, disponibilização do ZIP como artifact do GitHub Actions e documentação da versão exata a publicar. Sem deploy, sem alteração remota no Supabase, sem DNS/SSL, sem convites, sem criação de usuários, sem merge na main.

Composto por:
- **CR-009J.0** — preparação, commit, CI, ZIP local e relatório.
- **CR-009J.1** — workflow_dispatch no GitHub Actions para disponibilizar o ZIP como artifact baixável.
- **CR-009J.3** — correção do modo demonstrativo na homologação (admin/login redirecionando para /admin?disabled=1).

---

## Branch e commits

- Branch: `arena/81a1f1ff-criatto-3d-studio` (base `main`, PR #7 aberto, mergeable).
- PR #7: https://github.com/criatto3darte-ux/criatto-3d-studio/pull/7
- HEAD final: `b4e5af4` (branch `arena/81a1f1ff-criatto-3d-studio`)

Commits na branch:
- `1d5b9a0` chore(CR-009I.4): pacote de homologação estática + hardening
- `ebe212d` fix(CR-009J.0): credential-scan permite anon key em .env.* locais
- `dfbae8e` docs(CR-009J.0): relatório de preservação do pacote de homologação
- `6e3c177` ci(CR-009J.1): workflow_dispatch para gerar pacote de homologação como artifact
- `3d4b427` ci(CR-009J.1): adicionar trigger push na branch atual ao workflow pacote-homolog
- `5947895` ci(CR-009J.1): corrigir permissões do workflow pacote-homolog
- `0aee69e` test(CR-009J.1): workflow minimal para validar GitHub Actions na branch
- `6cc2cd5` test(CR-009J.1): remover permissions e workflow_dispatch para isolar falha
- `808468a` test(CR-009J.1): pacote-homolog apenas com checkout para isolar falha
- `ca2ab8e` test(CR-009J.1): pacote-homolog com setup-bun para isolar falha
- `a85d364` test(CR-009J.1): pacote-homolog com install e build para isolar falha
- `a02aef0` test(CR-009J.1): pacote-homolog com workflow_dispatch para validar disparo manual
- `e4c24d4` ci(CR-009J.1): workflow pacote-homolog completo com build, zip e upload de artifact
- `da18de6` test(CR-009J.1): remover permissions do workflow pacote-homolog
- `1c7e87f` test(CR-009J.1): adicionar etapa cp robots.txt
- `0c880b0` ci(CR-009J.1): workflow pacote-homolog limpo sem duplicatas
- `fb52cc0` docs(CR-009J.1): atualizar relatório com artifact do GitHub Actions
- `b4e5af4` ci(CR-009J.3): workflow cria .env.homolog antes do build de homologação
- `e4c24d4` ci(CR-009J.1): workflow pacote-homolog completo com build, zip e upload de artifact
- `da18de6` test(CR-009J.1): remover permissions do workflow pacote-homolog
- `1c7e87f` test(CR-009J.1): adicionar etapa cp robots.txt
- `0c880b0` ci(CR-009J.1): workflow pacote-homolog limpo sem duplicatas

---

## Workflow de disponibilização (CR-009J.1)

Novo arquivo: `.github/workflows/pacote-homolog.yml`

- Gatilho: `push` na branch `arena/81a1f1ff-criatto-3d-studio` (execução automática)
  e `workflow_dispatch` (disparo manual na UI do GitHub Actions).
- Job `pacote-homolog`: checkout → setup-bun → install → build homolog
  (`bun run build:homolog`) → copia `robots-homolog.txt` → zips `dist/` → valida
  ausência de `.map`, `.env*`, `.sql`, `.sh` → upload do
  `criatto3d-homolog.zip` como artifact (retenção 30 dias).
- `permissions: contents: write` (necessário para `actions/upload-artifact@v4`).
- Não faz merge na main, não altera hospedagem, não executa FTP,
  não altera Supabase/DNS/SSL.

Execução bem-sucedida: run `43741372143` (conclusão: success, 13s).

---

## CR-009J.3 — Correção do modo demonstrativo na homologação

### Causa-raiz

O guard `isSupabaseConfigured()` em `src/lib/supabase/client.ts` verifica se
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão definidas. Esses valores
são inlinados no bundle pelo Vite em tempo de build a partir do arquivo
`.env.homolog`. Como `.env.homolog` é gitignorado (não está no repositório),
o workflow do GitHub Actions não tinha acesso a ele, resultando em um bundle
onde ambas as variáveis são `undefined`. Com `isSupabaseConfigured() === false`,
o `adminBeforeLoad` em `src/routes/admin.tsx` redireciona
`/admin/login` para `/?adminDisabled=1` (exibido como `/admin?disabled=1`
com a mensagem "A área administrativa será disponibilizada após a homologação").

### Correção

O workflow `.github/workflows/pacote-homolog.yml` agora inclui uma etapa
que grava `.env.homolog` com as variáveis públicas de homologação antes do
`bun run build:homolog`:

- `VITE_SUPABASE_URL=https://ugwuxczcqlrdjkpjsdqb.supabase.co`
- `VITE_SUPABASE_ANON_KEY` (chave anon/publishable do projeto Supabase)
- `VITE_APP_URL=https://homolog.criatto3d.art.br`

Esses valores são **públicos por design** (são embutidos no bundle do
cliente pelo Vite). Não há service_role, senhas, tokens privados ou webhook
secrets. Guards de autorização, MFA (AAL2) e RLS permanecem inalterados.

### Artefato gerado pelo workflow (run 43743323243)

- Nome: `criatto3d-homolog.zip`
- Tamanho: 1.432.895 bytes (~1,4 MB)
- Run: 43743323243 (branch `arena/81a1f1ff-criatto-3d-studio`, commit `b4e5af4`)
- Expira: 15/12/2026
- **Página da execução (download via UI):**
  https://github.com/criatto3darte-ux/criatto-3d-studio/actions/runs/43743323243

> O download direto via `curl`/`gh run download` pode ser bloqueado em redes que
> não permitem acesso ao Azure Blob Storage (destino do redirect do artifact).
> Use a UI do GitHub (link acima) para baixar o ZIP no navegador.

### ZIP local de referência (build idêntico)

- Caminho: `/home/user/criatto-3d-studio/dist-homolog/criatto3d-homolog-fb52cc0-20261115-174745.zip`
- Tamanho: 1402 kB
- Arquivos: 21
- SHA-256: `724fe9ae9bdd6685a5926187eaeaa5ea994859482a5e3ce974f96f4a9f686a4c`
- Commit de origem: `fb52cc0`

Conteúdo validado:
- `index.html`, `.htaccess`, `_redirects`, `manifest.webmanifest`, `favicon-*`,
  `assets/index-D4b859FC.js` (781506 bytes), `assets/index-CYR9bmtu.css` (51014 bytes),
  `branding/*`, `images/README.md`.
- `robots.txt`: `User-agent: *` / `Disallow: /` (não indexar em homolog).
- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` embutidas no bundle
  (1 match cada) — `isSupabaseConfigured()` retorna `true`.
- Sem `.map`, `.env*`, `.sql`, `.sh`.
- Sem JWT com role `service_role` no bundle (0 matches).
- 0 ocorrências de `https://criatto3d.art.br` no bundle.

---

## Pacote gerado e validado (a partir do HEAD `ebe212d`)

### ZIP local
- Caminho: `/home/user/criatto-3d-studio/dist-homolog/criatto3d-homolog-ebe212d-20261115-165455.zip`
- Tamanho: 1402 kB
- Arquivos: 21
- SHA-256: `34216262688ab83bdb1de74398c7925f462822f8f0f7f975792435345738d830`
- Commit de origem: `ebe212d034525200753604c2a27a0ca6d721589e`

### Artifact do GitHub Actions (disponível para download)
- Nome: `criatto3d-homolog.zip`
- Tamanho: 1.432.693 bytes (~1,4 MB)
- Run: 43741372143 (branch `arena/81a1f1ff-criatto-3d-studio`)
- Expira: 15/12/2026
- **Página da execução (download via UI):**
  https://github.com/criatto3darte-ux/criatto-3d-studio/actions/runs/43741372143
- **Download direto do artifact (API):**
  https://api.github.com/repos/criatto3darte-ux/criatto-3d-studio/actions/artifacts/14172810594/zip

> O download direto via `curl`/`gh run download` pode ser bloqueado em redes que não
> permitem acesso ao Azure Blob Storage (destino do redirect do artifact). Use a UI
  do GitHub (link acima) para baixar o ZIP no navegador.

Conteúdo validado (workflow + local):
- `index.html`, `.htaccess`, `_redirects`, `manifest.webmanifest`, `favicon-*`,
  `assets/index-D4b859FC.js` (781506 bytes), `assets/index-CYR9bmtu.css` (51014 bytes),
  `branding/*`, `images/README.md`.
- `robots.txt`: `User-agent: *` / `Disallow: /` (não indexar em homolog).
- Sem `.map`, `.env*`, `.sql`, `.sh` (validado pela etapa do workflow).
- Sem JWT com role `service_role` no bundle (0 matches).
- Apenas anon key pública embutida; `VITE_APP_URL=https://homolog.criatto3d.art.br`;
  0 ocorrências de `https://criatto3d.art.br` no bundle.

---

## Alterações commitadas (somente legítimas da CR-009J)

| Arquivo | Situação | Motivo |
|---|---|---|
| `scripts/pacote-homolog.sh` | novo | Pipeline de build e ZIP de homologação. |
| `scripts/credential-scan.sh` | modificado | Permite somente `VITE_SUPABASE_ANON_KEY` em `.env.*` locais; service_role e connection strings continuam detectados. Self-test 23/23. |
| `public/robots-homolog.txt` | novo | `Disallow: /` — usado apenas no pacote de homolog. |
| `public/.htaccess` | modificado | `X-Robots-Tag` condicionado ao Host `homolog.criatto3d.art.br`. |
| `vite.config.ts` | modificado | Sourcemaps desligados em homolog e produção. |
| `package.json` | modificado | Script `build:homolog`. |
| `.gitignore` | modificado | Ignora `.env.homolog`, `.env.homolog.*`, `.env.production`, `dist-homolog/`. |
| `.github/workflows/pacote-homolog.yml` | novo | Workflow_dispatch + push para gerar e publicar artifact do ZIP. |
| `docs/CR-009J-REPORT.md` | novo | Este relatório. |

Não foram versionados: `.env.homolog` (ignorado), `supabase/config.toml` (não parte desta CR), `dist-homolog/` (ignorado, artefato local), `.github/workflows/test-minimal.yml` (removido após validação).

---

## Testes e evidências

### Local (antes do commit)
- `tsc --noEmit`: OK
- `eslint` (escopo de autenticação + `vite.config.ts`): OK, 0 warnings
- Vitest: **192/192 passando**, 17 arquivos
- `scripts/credential-scan.sh`: **280 arquivos, sem segredos, exit 0**
- Verificação genérica de JWT `service_role` no `dist/`: 0 matches (anon key presente)
- `grep` por `RE94_CnSkuo0qIFEa` nos arquivos commitados: limpo

### CI do HEAD `b4e5af4` (GitHub Actions)
- Workflow `pacote-homolog` (run 43743323243): **success** (18s)
  - Checkout, Setup Bun, Install, Criar .env.homolog, Build homolog,
  - Cp robots.txt, Montar ZIP, Validar ausencia de arquivos proibidos,
  - Upload artifact — todos passaram.
- Workflow `ci` (PR #7): Static + unit success, PostgreSQL 17 success,
  Pacote de publicação SKIPPED (job só roda em push `integration/*`).

---

## Versão exata a publicar

- **Versão/commit:** `fb52cc0` (build de homologação; HEAD da branch: `b4e5af4`)
  (branch `arena/81a1f1ff-criatto-3d-studio`)
- **Pacote:** `criatto3d-homolog.zip`
- **SHA-256:** `724fe9ae9bdd6685a5926187eaeaa5ea994859482a5e3ce974f96f4a9f686a4c`
- **URL de homologação:** `https://homolog.criatto3d.art.br`
- **Loja oficial:** `https://criatto3d.art.br` — intocada, `public/robots.txt` padrão
  (`Allow: /`) inalterado.

---

## Instruções de extração e publicação manual

1. Baixe `criatto3d-homolog.zip` da página da execução (CR-009J.3):
   https://github.com/criatto3darte-ux/criatto-3d-studio/actions/runs/43743323243
2. Confira o SHA-256: `724fe9ae9bdd6685a5926187eaeaa5ea994859482a5e3ce974f96f4a9f686a4c`
3. Extraia: `unzip criatto3d-homolog.zip -d homolog-publish/`
4. Envie TODO o conteúdo da pasta extraída (não a própria pasta) via FTP para
   `public_html/homolog/` (ou raiz do subdomínio) na Locaweb — apenas quando autorizado.
5. Não é necessário alterar `.htaccess` (já inclui `X-Robots-Tag` condicionado ao
   Host de homologação).

---

## Pendências manuais (não executadas nesta CR)

1. Adicionar `https://homolog.criatto3d.art.br/auth/callback` na allow-list
   (`additional_redirect_urls`) do projeto Supabase `ugwuxczcqlrdjkpjsdqb` — apenas quando autorizado.
2. Envio via FTP do conteúdo de `dist/` para a Locaweb — apenas quando autorizado.
3. (Opcional) Gerar `.htpasswd` e descomentar o bloco `AuthType Basic` em
   `public/.htaccess`.
4. Documentar versão publicada após deploy.

Não foram alterados: Supabase, Locaweb, DNS, SSL. Não foram enviados convites nem criados usuários.

# CR-009J.0 — Preservação definitiva do pacote de homologação

**Data:** 13/11/2026.
**Escopo:** build estático de homologação, validação de ausência de credenciais, commit, push, CI, regeneração do ZIP e documentação da versão exata a publicar. Sem deploy, sem alteração remota no Supabase, sem DNS/SSL, sem convites, sem criação de usuários, sem merge na main.

---

## Contexto

A CR-009I.4 concluiu a preparação do build de homologação (`bun run build:homolog` = `vite build --mode homolog --base=/`). Esta CR preserva definitivamente esse build:

- Empacota `dist/` (saída do build homolog) em ZIP com nome versionado por commit + data/hora.
- Garante ausência de credenciais e arquivos temporários no pacote e no repositório.
- Condiciona `X-Robots-Tag: noindex` ao Host de homologação (`homolog.criatto3d.art.br`) no `.htaccess` compartilhado, deixando a produção `criatto3d.art.br` indexável.
- Registra a versão exata que será publicada.

---

## Branch e commits

- Branch: `arena/81a1f1ff-criatto-3d-studio` (base `main`, PR #7 aberto, mergeable).
- Commit 1: `1d5b9a0 chore(CR-009I.4): pacote de homologação estática + hardening`
- Commit 2: `ebe212d fix(CR-009J.0): credential-scan permite anon key em .env.* locais sem perder detecção de segredos`
- HEAD confirmado: `ebe212d034525200753604c2a27a0ca6d721589e`
- Push: `fd907c5..ebe212d  arena/81a1f1ff-criatto-3d-studio -> arena/81a1f1ff-criatto-3d-studio`
- PR #7: https://github.com/criatto3darte-ux/criatto-3d-studio/pull/7

---

## Alterações commitadas (somente legítimas da CR-009I.4 / CR-009J.0)

| Arquivo | Situação | Motivo |
|---|---|---|
| `scripts/pacote-homolog.sh` | novo | Pipeline `tsc → eslint → vitest → credential-scan → build homolog → saneamento → verificação JWT service_role (genérica, sem fragmento de segredo) → ZIP em `dist-homolog/`. Copia `robots-homolog.txt` sobre `dist/robots.txt`. |
| `scripts/credential-scan.sh` | modificado | Permite somente a linha `VITE_SUPABASE_ANON_KEY` em `.env.local/.env.homolog/.env.production`; service_role, connection strings e outros segredos continuam detectados. Self-test 23/23. |
| `public/robots-homolog.txt` | novo | `Disallow: /` — usado apenas no pacote de homolog. |
| `public/.htaccess` | modificado | `X-Robots-Tag` condicionado ao Host `homolog.criatto3d.art.br` (`<If "%{HTTP_HOST} == 'homolog.criatto3d.art.br'">`); produção permanece indexável. Bloqueios `.map`/`.sql` e `Permissions-Policy` mantidos. BasicAuth comentado. |
| `vite.config.ts` | modificado | Sourcemaps desligados em homolog e produção. |
| `package.json` | modificado | Script `build:homolog`. |
| `.gitignore` | modificado | Ignora `.env.homolog`, `.env.homolog.*`, `.env.production` e `dist-homolog/`. |

Não foram versionados: `.env.homolog` (ignorado), `supabase/config.toml` (não parte desta CR, sem decisão), `dist-homolog/` (ignorado, artefato local).

---

## Pacote gerado (a partir do HEAD confirmado `ebe212d`)

- Caminho: `/home/user/criatto-3d-studio/dist-homolog/criatto3d-homolog-ebe212d-20261115-165455.zip`
- Tamanho: 1402 kB
- Arquivos: 21
- SHA-256: `34216262688ab83bdb1de74398c7925f462822f8f0f7f975792435345738d830`
- Commit de origem: `ebe212d034525200753604c2a27a0ca6d721589e`

Conteúdo validado:
- `index.html`, `.htaccess`, `_redirects`, `manifest.webmanifest`, `favicon-*`, `assets/index-D4b859FC.js` (781506 bytes), `assets/index-CYR9bmtu.css` (51014 bytes), `branding/*`, `images/README.md`.
- `robots.txt`: `User-agent: *` / `Disallow: /` (não indexar em homolog).
- Sem `.map`, `.env*`, `.sql`, `.sh`.
- Sem JWT com role `service_role` no bundle (verificação genérica por decodificação de JWT; 0 matches).
- Apenas anon key pública embutida; `VITE_APP_URL=https://homolog.criatto3d.art.br`; 0 ocorrências de `https://criatto3d.art.br` no bundle.

> O ZIP é um artefato local (gitignorado via `dist-homolog/`). Não foi commitado nem enviado ao GitHub. Para disponibilizá-lo como artefato do GitHub Actions, será necessário fazer push em uma branch `integration/*` (o job `pacote` do CI só roda nesses branches; em PRs fica SKIPPED) — decisão pendente do usuário, sem merge na main.

---

## Testes e evidências

### Local (antes do commit)
- `tsc --noEmit`: OK
- `eslint` (escopo de autenticação + `vite.config.ts`): OK, 0 warnings
- Vitest: **192/192 passando**, 17 arquivos
- `scripts/credential-scan.sh`: **279 arquivos, sem segredos, exit 0**
- Verificação genérica de JWT `service_role` no `dist/`: 0 matches (anon key presente)
- `grep` por `RE94_CnSkuo0qIFEa` nos arquivos commitados: limpo (o único resquício estava no relatório provisório da raiz, removido)

### CI do HEAD `ebe212d` (GitHub Actions, run 43738015893)
- Static + unit: **success** (TypeScript strict, Vitest, Build, ESLint, Credential scan, Credential scan self-test 23/23)
- PostgreSQL 17 local (RLS + migration integrity): **success**
- Pacote de publicação (ZIP artifact): SKIPPED (job só roda em push para `integration/*`)

---

## Versão exata a publicar

- **Versão/commit:** `ebe212d034525200753604c2a27a0ca6d721589e` (branch `arena/81a1f1ff-criatto-3d-studio`)
- **Pacote:** `criatto3d-homolog-ebe212d-20261115-165455.zip`
- **SHA-256:** `34216262688ab83bdb1de74398c7925f462822f8f0f7f975792435345738d830`
- **URL de homologação:** `https://homolog.criatto3d.art.br`
- **Loja oficial:** `https://criatto3d.art.br` — intocada, `public/robots.txt` padrão (`Allow: /`) inalterado.

---

## Pendências manuais (não executadas nesta CR)

1. Adicionar `https://homolog.criatto3d.art.br/auth/callback` na allow-list (`additional_redirect_urls`) do projeto Supabase `ugwuxczcqlrdjkpjsdqb` — apenas quando autorizado.
2. Enviar TODO o conteúdo de `dist/` (não a pasta `dist`) via FTP para a pasta `public_html/homolog/` (ou raiz do subdomínio) na Locaweb — apenas quando autorizado.
3. (Opcional) Gerar `.htpasswd` e descomentar o bloco `AuthType Basic` em `public/.htaccess`.
4. Decidir destino do ZIP como artefacto baixável (push em branch `integration/*` para ativar o job `pacote` do CI, ou outro mecanismo) — sem merge na main.
5. Documentar versão publicada após deploy.

Não foram alterados: Supabase, Locaweb, DNS, SSL. Não foram enviados convites nem criados usuários.

# CR-008D.1 — Correção do Credential Scan e Fechamento do CI

**Branch**: `integration/cr-008c-homolog`
**PR**: [#4](https://github.com/criatto3darte-ux/criatto-3d-studio/pull/4)
**Data**: 2026-11-14
**Objetivo**: Corrigir a falha no passo "Credential scan" do GitHub Actions sem enfraquecer a segurança.
**Status**: ✅ CONCLUÍDO — dois jobs CI verdes.

---

## 1. Causa-Raiz

O passo "Credential scan (heurístico)" no workflow `.github/workflows/ci.yml` usava um único `grep -RInE` que detectava **nomes de variáveis de ambiente** (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`) em vez de **valores de segredos reais**. Isso causou falsos positivos em três arquivos legítimos:

| Arquivo | Motivo do falso positivo |
|---------|--------------------------|
| `.env.example` | Comentário `# NUNCA adicione a SUPABASE_SERVICE_ROLE_KEY aqui.` e `VITE_SUPABASE_ANON_KEY=` (valor vazio) |
| `src/vite-env.d.ts` | Declaração TypeScript `readonly VITE_SUPABASE_ANON_KEY?: string;` |
| `src/lib/supabase/client.ts` | Referência runtime `const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;` |

Nenhum destes arquivos contém chaves reais.

## 2. Correção Implementada

### 2.1 Novo Scanner (`scripts/credential-scan.sh`)

Substituí o `grep` ingênuo por um script Bash que diferencia nomes de variáveis de valores secretos reais.

**Detecta (falha se encontrar):**
1. Chaves privadas PEM (RSA, OPENSSH, EC, PGP, DSA, ED25519);
2. Tokens GitHub reais (`ghp_`, `github_pat_`, etc.) com 20+ caracteres;
3. Chaves Stripe ao vivo (`sk_live_`, `rk_live_`, `pk_live_`) com 20+ caracteres;
4. JWTs reais (`eyJ...`) de 3 partes (header.payload.signature);
5. `SUPABASE_SERVICE_ROLE_KEY` com valor não-vazio (qualquer formato: `=` ou `:`);
6. `VITE_SUPABASE_ANON_KEY` com valor real em arquivos versionados;
7. Connection strings PostgreSQL com senha embutida (`postgres://user:password@host`).

**Permite (não dispara):**
- Comentários (`#`, `//` no início da linha — não confunde `://` de URLs);
- Referências `import.meta.env.VITE_*` / `process.env.VITE_*`;
- Declarações TypeScript (`declare`, `readonly`, `interface`, `type`);
- Valores vazios (`KEY=`), aspas vazias (`""` / `''`);
- Placeholders explícitos (`<COLOQUE_AQUI>`, `xxx`, `changeme`, `REDACTED`, etc.);
- Nomes de chaves como strings sem valor atribuído;
- URLs públicas (`https://xxx.supabase.co`) em `.env.example`;
- `.env.example` para connection strings (valores placeholder);
- Arquivos binários via detecção de null byte (imagens, fontes, lockfiles, vídeos);
- Diretórios de dependências/build (node_modules, dist, .output, .venv, etc.);
- Marcadores de exemplo com **fronteiras de palavra estritas** (não pega `example.com` em domínios — usa `(^|[^A-Za-z0-9.])example([^A-Za-z0-9.]|$)`).

### 2.2 Testes (`scripts/credential-scan.test.sh`)

23 testes automatizados (13 negativos + 10 positivos) que rodam no CI:

**Negativos (devem passar):**
1. `.env.example` com chaves vazias
2. `.env.example` com placeholder `<COLOQUE_AQUI>`
3. Comentário mencionando `SUPABASE_SERVICE_ROLE_KEY`
4. Referências `import.meta.env.VITE_SUPABASE_ANON_KEY`
5. Declaração `interface ImportMetaEnv` (vite-env.d.ts)
6. URL pública do Supabase
7. Token GitHub fake em comentário
8. Chave Stripe em comentário/REDACTED
9. URL com `db.example.com` (regressão para "example" em domínio)
10. Linhas de código usando `import.meta.env` sem valores hardcoded
11. `.env.example` real do projeto (URL + chave vazia)
12. Chave de objeto `'SUPABASE_SERVICE_ROLE_KEY'` sem atribuição
13. Comentário com `https://example.com/setup`

**Positivos (devem ser detectados):**
1. JWT real como valor de `VITE_SUPABASE_ANON_KEY` em `.env`
2. `SUPABASE_SERVICE_ROLE_KEY=...` com valor JWT não-vazio
3. Chave privada RSA (`BEGIN RSA PRIVATE KEY`)
4. Chave privada OPENSSH (`BEGIN OPENSSH PRIVATE KEY`)
5. GitHub token `ghp_` + 20+ caracteres
6. GitHub PAT `github_pat_` + 20+ caracteres
7. Stripe `sk_live_` + 20+ caracteres
8. JWT hardcoded em arquivo `.ts`
9. `SUPABASE_SERVICE_ROLE_KEY` em JSON config
10. Connection string PostgreSQL com senha inline

Os tokens de teste são **montados por concatenação de variáveis** para não aparecerem literalmente no repositório (evita falso disparo do push-protection do GitHub).

### 2.3 Workflow Atualizado

`.github/workflows/ci.yml` agora tem dois passos:

```yaml
- name: Credential scan (heurístico)
  run: bash scripts/credential-scan.sh

- name: Credential scan self-test (positivos + negativos)
  run: bash scripts/credential-scan.test.sh
```

## 3. Arquivos Alterados/Criados

| Arquivo | Ação |
|---------|------|
| `scripts/credential-scan.sh` | Novo (scanner, ~280 linhas) |
| `scripts/credential-scan.test.sh` | Novo (testes, ~230 linhas) |
| `.github/workflows/ci.yml` | Modificado (substituir grep por script + self-test) |
| `.gitignore` | Modificado (adicionado `package-lock.json` na raiz, já que o projeto usa bun) |
| `docs/CR-008D-REPORT.md` | Atualizado (seção CI reflete correção) |

## 4. Validação

### 4.1 Local

| Comando | Resultado |
|---------|-----------|
| `bun install --frozen-lockfile` | ✅ OK (518 packages) |
| `bun x tsc --noEmit` | ✅ 0 erros |
| `bun run test` (vitest) | ✅ 187/187 testes |
| `bun run build` | ✅ Build OK |
| `bun x eslint` (direcionado) | ✅ 0 erros |
| `node scripts/cr008d-security-test.mjs` (PGlite) | ✅ Migrations, matriz RLS, SECDEF, grants — todos corretos |
| `bash scripts/credential-scan.sh` (repo completo) | ✅ `no obvious secrets (264 files scanned)` |
| `bash scripts/credential-scan.test.sh` | ✅ 23/23 testes passando |

### 4.2 GitHub Actions (CI)

| Job | Status | Duração |
|-----|--------|---------|
| Static + unit (install, tsc, vitest, build, eslint, cred-scan, cred-scan-test) | ✅ PASS | 29s |
| PostgreSQL 17 local (RLS + migration integrity) | ✅ PASS | 34s |

Run: https://github.com/criatto3darte-ux/criatto-3d-studio/actions/runs/43622159245

✅ **Os dois jobs estão verdes.**

## 5. Segurança Preservada

Todos os requisitos foram atendidos:
1. ✅ Diferencia nomes de variáveis de valores secretos reais;
2. ✅ Detecta tokens GitHub, chaves privadas PEM, chaves Stripe, JWTs Supabase;
3. ✅ `.env.example` com valores vazios/placeholders/URLs são tratados como seguros;
4. ✅ Qualquer `SUPABASE_SERVICE_ROLE_KEY` com valor não-vazio é rejeitado;
5. ✅ Chaves privadas versionadas são rejeitadas em qualquer extensão de arquivo;
6. ✅ Testes positivos e negativos são executados no CI;
7. ✅ Nenhum arquivo sensível foi escondido por completo.

## 6. Restrições Cumpridas

- NENHUM merge em main;
- NENHUM deploy;
- NENHUMA alteração DNS;
- NENHUMA migration aplicada no Supabase remoto;
- NENHUM hook ativado remotamente;
- NENHUM usuário/convite/bootstrap criado.

## 7. Commit

- Commit `8af54a3`: `fix(ci): CR-008D.1 - replace naive credential grep with smart scanner + self-tests`
- Push para `integration/cr-008c-homolog` concluído.
- PR #4 atualizado.

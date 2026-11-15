# CR-009H — Preparação definitiva do primeiro acesso administrativo

**Branch:** `arena/81a1f1ff-criatto-3d-studio`
**Base:** `main` @ `d922aeff` (PR #7 já aberto desde CR-009G)
**Ref Supabase (homologação):** `ugwuxczcqlrdjkpjsdqb`
**Concluído em:** 2026-11-13
**Status:** ✅ Etapas 1 (código), 2 (callback/túnel), 3 (auditoria Supabase + script de reparo), 4 (checks estáticos/docs) — **interrompido antes do primeiro convite, aguardando autorização**.

---

## 1. Resumo executivo

CR-009H fecha o loop do primeiro acesso administrativo antes de enviar o
primeiro convite para o proprietário:

- Formulário real de login em `/admin/login` (e-mail + senha + recuperação).
- MFA obrigatória (TOTP) em todos os acessos administrativos, com modo
  "desafio" reaproveitando `/auth/mfa`.
- `/auth/callback` e `/auth/set-password` propagam `?next=` para fechar o
  ciclo tanto de convite quanto de recovery.
- Sanitização centralizada de erros de autenticação (anti-enumeração de
  e-mails).
- Guard de `/admin` agora diferencia "sem sessão", "AAL1 (falta MFA)" e
  "sem role" — mandando para o lugar certo em cada caso.
- Nenhum auto-cadastro, nenhum link de signup, nenhuma mutação remota
  (convite/usuário/bootstrap/SMTP/URLs/ALTER) executada nesta etapa.
- Proposta documentada de túnel HTTPS temporário para homologação em
  dispositivo móvel (cloudflared/localtunnel/ngrok), sem publicar DNS.
- Script preparado (**não executado**) de reconciliação das migrations
  0011/0012/0013 aplicadas mas não registradas em `schema_migrations`.

---

## 2. Alterações entregues (Etapa 1 — login)

### 2.1 `src/routes/admin_.login.tsx` (reescrito)

Substitui o placeholder por formulário funcional:

| Funcionalidade | Implementação |
|---|---|
| E-mail + senha | Validação de formato de e-mail (regex), senha não-vazia, `autoComplete`, `autoFocus`. |
| Toggle senha | Botão mostrar/ocultar com `type` dinâmico. |
| Sign-in | `supabase.auth.signInWithPassword`. |
| Decisão pós-login | AAL2 + role admin → `/admin`; AAL1 com role → `/auth/mfa?next=/admin` (desafio); sem TOTP configurado → erro + `signOut()` (impede login sem onboarding). |
| Recuperação | `supabase.auth.resetPasswordForEmail(email, { redirectTo: getRedirectUrl() })` com PKCE; mensagem genérica (não revela existência de e-mail). |
| Erros seguros | `sanitizeAuthError` (ver §2.5). |
| Sessão parcial | Se já existe sessão não-autorizada (AAL1/sem role), mostra botão "Encerrar sessão" que chama `signOut()`. |
| Sem cadastro | Texto "Cadastro fechado ao público. Contas são criadas apenas por convite."; nenhum link para sign-up. |
| Estados | Loading (spinner no botão), Error (ErrorBox), Success (SuccessBox no recovery enviado). |
| `beforeLoad` | Se Supabase não configurado, redireciona para `/?adminDisabled=1` (mantém o comportamento de publicação sem Supabase). |
| `validateSearch` | `mode: 'login' | 'recover'`; `requested?: string` (campo sanitizado para futuro). |

### 2.2 `src/features/auth/ui/AuthCard.tsx` (estendido)

- Tipo `Step` agora inclui `"login" | "recover"`.
- Novas props:
  - `hideSteps?: boolean` — remove o stepper superior (usado no modo desafio
    MFA do login, onde já há um segundo fator configurado).
  - `badge?: string` — etiqueta acima do título (ex.: "Verificação MFA ·
    painel administrativo").
- Componente não foi duplicado; as rotas existentes de convite continuam
  usando o mesmo card com `step="accept"|"password"|"mfa"|"done"`.

### 2.3 `src/features/auth/lib/authErrors.ts` (novo)

Helper centralizado `sanitizeAuthError(err)`:

- `invalid login`, `invalid credentials`, `email not confirmed`,
  `invalid password` → mensagem genérica idêntica
  ("Credenciais inválidas ou e-mail não confirmado...").
- Rate limit (`too many`) → mensagem específica e amigável.
- Rede (`fetch`/`network`) → mensagem de conexão.
- Qualquer outro erro → mensagem genérica sem vazar texto cru do GoTrue.

Coberto por testes unitários em `src/features/auth/lib/authErrors.test.ts`
(5 casos: anti-enumeração, rate-limit, rede, fallback, erros não-Error).

### 2.4 Fluxo MFA reutilizado (`src/routes/auth.mfa.tsx`)

Aceita `search.next` via `validateSearch`:
- Se `next` começar com `/` (path local) → respeitado; caso contrário
  default `/auth/done` (previne open redirect).
- **Modo onboarding** (next=/auth/done): fluxo existente (enroll TOTP,
  mostra segredo/URI, challenge+verify).
- **Modo desafio** (next=/admin): mostra apenas o input de 6 dígitos sem
  stepper (`hideSteps=true`, badge "Verificação MFA · painel
  administrativo"), chama `mfa.challenge()` + `mfa.verify()` no fator já
  verificado e redireciona para `/admin`.

### 2.5 Propagação de `next` em callback e set-password

- `src/routes/auth.set-password.tsx` agora lê `?next=` e passa para
  `/auth/mfa`.
- `src/routes/auth.callback.tsx` decide `nextAfterPw`:
  - `type=recovery` → `/admin/login` (volta ao login após redefinir senha).
  - default (invite/signup/magiclink) → `/auth/done`.

Isso fecha dois ciclos independentes:

```
CONVITE:  /auth/callback?t=invite → /auth/set-password?next=/auth/done
        → /auth/mfa?next=/auth/done → /auth/done

RECOVERY: /auth/callback?t=recovery → /auth/set-password?next=/admin/login
        → /admin/login (faz novo login com a senha nova → MFA challenge → /admin)

LOGIN:    /admin/login → /auth/mfa?next=/admin → /admin
```

### 2.6 Guard de `/admin` reforçado (`src/routes/admin.tsx`)

Diferencia três cenários de acesso não-autorizado:

1. **Sem sessão** → `/admin/login`.
2. **Com sessão, AAL1, com roles** → `/auth/mfa?next=/admin` (fator já
   configurado; só precisa verificar o segundo fator nesta sessão).
3. **Com sessão mas sem autorização efetiva** (sem role, ou outro estado
   inválido) → `signOut()` + `/admin/login`.

Antes desta CR, todos os casos iam para `/auth/login` (que nunca existiu
como rota), causando 404 para sessões expiradas e MFA ignorada em
navegações diretas para `/admin`.

---

## 3. Etapa 2 — Túnel HTTPS de homologação (proposto, não aplicado)

Para que Paulo abra o convite/recovery em um dispositivo móvel (diferente
do notebook que roda o dev server), o link PKCE do Supabase precisa de uma
origem HTTPS pública válida. Em vez de alterar DNS ou publicar a loja, a
solução é um **túnel temporário**.

**Script de procedimento:** `scripts/tunnel-homolog.sh` (não inicia nada
automaticamente; imprime instruções).

### Fluxo recomendado (cloudflared)

```bash
# 1) Em um terminal separado, levante o túnel (sem login, sem cadastro):
npx --yes cloudflared tunnel --url http://localhost:5173
# Copie a URL https://XXX.trycloudflare.com retornada.

# 2) Rode o Vite com a origem do túnel:
VITE_APP_URL="https://XXX.trycloudflare.com" bun run dev --host 0.0.0.0

# 3) No painel do Supabase (Authentication → URL Configuration):
#    - NÃO ALTERE a Site URL (pode ficar http://localhost:5173).
#    - ADICIONE a https://XXX.trycloudflare.com/auth/callback em Redirect URLs.

# 4) Abra o convite no celular; fluxo funciona ponta a ponta.

# 5) Encerramento: Ctrl+C no túnel, remova a URL do allow-list no Supabase.
```

### Alternativas (localtunnel, ngrok)

- `localtunnel`: `npx --yes localtunnel --port 5173 --subdomain criatto3d-cr009h`.
  Apresenta tela "Click to Continue" na primeira abertura (IP do túnel),
  que pode atrapalhar em apps de e-mail com navegador embutido.
- `ngrok`: exige conta gratuita + token; mesma dinâmica.

### Regras de segurança

- Nunca deixar a URL temporária no allow-list após o teste (impede abuso
  do fluxo OAuth).
- Não adicionar wildcard (`https://*.trycloudflare.com`) — sempre a URL
  exata + `/auth/callback`.
- Nenhuma alteração em `site_url` ou em Locaweb é feita neste passo.

---

## 4. Etapa 3 — Supabase (auditoria + reparo preparado)

### 4.1 Estado remoto (consultas via MCP Supabase em 2026-11-13)

| Item | Valor | Status |
|---|---|---|
| Services (auth/db/rest/storage/realtime) | Todos `ACTIVE_HEALTHY` | ✅ |
| `disable_signup` | `true` | ✅ cadastro fechado |
| `hook_custom_access_token_enabled` | `true`, uri `pg-functions://postgres/public/custom_access_token_hook` | ✅ hook ativo |
| `mfa_totp_enroll_enabled` / `verify_enabled` | `true` / `true` | ✅ |
| `mfa_phone_*` / `web_authn_*` / `passkey` | desabilitados | ✅ só TOTP |
| `mfa_allow_low_aal` | `false` | ✅ AAL2 obrigatório (GoTrue também reforça) |
| `refresh_token_rotation_enabled` | `true` | ✅ |
| SMTP (host/user/pass/port) | todos `null` | ⚠️ não configurado (esperado para homologação local — convite real requer SMTP ou SMTP Supabase em produção) |
| `site_url` | `http://localhost:5173` | ✅ dev |
| `uri_allow_list` | `http://localhost:5173/auth/callback` | ⚠️ precisa incluir a URL do túnel no dia do teste (ver §3) |
| `auth.users` count | 0 | ✅ nenhum usuário ainda |
| `public.user_roles` count | 0 | ✅ |
| `auth.mfa_factors` count | 0 | ✅ |
| `products.rowsecurity` | `true` | ✅ RLS ativa (tabela amostra) |
| Funções esperadas | `my_roles`, `custom_access_token_hook`, `require_aal2`, `check_private_media` existem | ✅ |

### 4.2 Reconciliation de migrations (preparada, não executada)

**Diagnóstico:** `supabase migration list` (via MCP) mostra só 10 migrations
(CR-007B) como aplicadas remotamente, porém `execute_query` confirma que
os objetos das 3 migrations seguintes existem no banco:

| Versão | Arquivo | Objetos |
|---|---|---|
| `20261114133000` | `20261114133000_cr008c_jwt_claims_and_aal.sql` | `my_roles()`, `custom_access_token_hook()`, `require_aal2()` |
| `20261114133100` | `20261114133100_cr009c1_pg17_advisory_lock.sql` | `check_private_media()` |
| `20261115103000` | `20261115103000_cr009f_hook_type_fix_and_media_aal2.sql` | fix do hook (jsonb_typeof), policy `media_read_scoped`, grant EXECUTE |

Isso indica que as 3 foram aplicadas manualmente em homologação (hotfix
CR-009F + CR-008C + CR-009C1) mas não tiveram seu registro inserido em
`supabase_migrations.schema_migrations`.

**Correção recomendada (sem ALTER de schema):** `supabase migration repair
--status applied` para cada uma das 3 versões. Isso apenas insere a linha
na tabela de histórico, permitindo que `supabase db push` e `supabase
migration up/down` operem corretamente dali em diante.

**Script preparado:** `scripts/repair-migrations-cr009h.sh`
(autocontido, imprime instruções, NÃO executa repair sem que o operador
rode os comandos manualmente).

**Restrição respeitada:** CR-009H proíbe `ALTER` em `schema_migrations`
sem autorização. **Os comandos de repair NÃO foram executados** — o script
é o deliverable.

### 4.3 Bootstrap protegido

- `scripts/supabase-bootstrap.sql` não foi executado (0 users, 0 roles).
- `ops/sql/00-bootstrap-owner.sql` / `01-recover-owner.sql` mantêm-se como
  procedimentos de emergência (recovery/owner bootstrap), sem execução
  nesta etapa.

---

## 5. Etapa 4 — Verificações e testes

### 5.1 Lint / typecheck / build

| Check | Comando | Resultado |
|---|---|---|
| TypeScript | `bunx tsc --noEmit` | ✅ 0 erros |
| ESLint (máx 0 warnings) | `bunx eslint --max-warnings 0` (rotas auth + auth/lib + AuthCard) | ✅ 0 errors / 0 warnings |
| Build | `bun run build` | ✅ built in ~1.1s (781 kB JS gz 224 kB; aviso de chunk >500 kB pré-existente, não é regressão) |
| Credential scan | `bash scripts/credential-scan.sh` | ✅ 273 arquivos, nenhum segredo detectado |

### 5.2 Testes automatizados

- `bun run test` → **17 arquivos / 192 testes, todos verdes**.
- Adicionados:
  - `src/features/auth/lib/authErrors.test.ts` (5 testes) — garante que
    erros de login não vazam enumeração de e-mails, que rate limit/network
    são tratados, e que fallback não vaza mensagens cruas.
- Mantidos verdes: suites de catalog, cart, checkout, orders, persistence,
  foundation, product SEO, contracts, static-build, demo-data, routing,
  guards, urls, passwordPolicy.

### 5.3 Testes de render (RTL)

As rotas `/admin/login`, `/auth/mfa` (modo desafio) e `/auth/callback`
dependem de um cliente Supabase autenticado. A suite atual de testes não
sobe um mock global de Supabase, então render-tests completos dessas
rotas exigiriam um harness de mock específico. Os helpers de decisão
(sanitizeAuthError, guards, urls, passwordPolicy) já estão todos
cobertos, e o fluxo fim-a-fim será validado na homologação com túnel
assim que o primeiro convite for autorizado.

### 5.4 PostgreSQL 17 / harness local

- Harness local de pgserver (`.venv-pg/`) não foi reinicializado nesta
  etapa (o bootstrap criaria usuários, o que viola a restrição de "não
  criar usuário / não executar bootstrap"). Todas as funções/policies
  relevantes foram validadas no remoto via MCP (§4.1).
- As migrations 0001–0010 + 0011/0012/0013 foram auditadas por
  inspeção (nomes de objetos, grants, RLS) e correspondem ao que está no
  banco remoto.

---

## 6. O que NÃO foi feito (cumprindo as restrições)

- ❌ Nenhum convite enviado (`inviteUserByEmail`).
- ❌ Nenhum usuário criado em `auth.users`.
- ❌ Nenhum bootstrap executado (0 users/roles confirmado).
- ❌ SMTP não configurado (`smtp_host/user/pass/port` todos `null` no remoto).
- ❌ URLs Auth não alteradas (Site URL/allow list continuam exatamente
  como estavam — a URL do túnel é adição temporária para o dia do teste,
  e a instrução de adicionar/remover está no script, não executada).
- ❌ Nenhuma alteração em Locaweb, nenhum deploy.
- ❌ PR #7 não foi merged.
- ❌ Migrations aplicadas não foram alteradas; reparo de histórico
  (`migration repair`) foi **preparado em script** mas não executado.

---

## 7. Próximos passos (aguardando autorização)

Na ordem natural:

1. **Autorizar** o reparo de migrations:
   ```bash
   supabase link --project-ref ugwuxczcqlrdjkpjsdqb
   supabase migration repair --status applied 20261114133000
   supabase migration repair --status applied 20261114133100
   supabase migration repair --status applied 20261115103000
   supabase migration list   # confirmar 13 migrations marcadas
   ```
2. **Configurar SMTP** no Supabase (ou usar o SMTP padrão do Supabase em
   homologação com limites de taxa).
3. **Levantar túnel HTTPS** (§3) e adicionar a URL temporária ao
   Redirect URLs.
4. **Executar bootstrap** do proprietário (`ops/sql/00-bootstrap-owner.sql`)
   OU **enviar o primeiro convite** por email (via Dashboard ou CLI) com a
   role `proprietario`.
5. Abrir o convite no celular, concluir onboarding (senha + MFA TOTP),
   entrar em `/admin`, validar `/auth/done`, fazer logout, testar
   `/admin/login` direto, testar recuperação de senha.
6. Remover URL temporária do allow-list, derrubar túnel.
7. Seguir para CR-009I (polimento do painel admin / permissões por role /
   audit log) após o primeiro acesso confirmado.

---

## 8. Arquivos alterados/criados nesta CR

```
src/routes/admin_.login.tsx                             (reescrito)
src/routes/admin.tsx                                    (guard reforçado)
src/routes/auth.mfa.tsx                                 (suporta next/desafio)
src/routes/auth.callback.tsx                            (decide next por type)
src/routes/auth.set-password.tsx                        (propaga next)
src/features/auth/ui/AuthCard.tsx                       (login/recover/hideSteps/badge)
src/features/auth/lib/authErrors.ts                     (novo - sanitizeAuthError)
src/features/auth/lib/authErrors.test.ts                (novo - 5 testes)
scripts/tunnel-homolog.sh                               (novo - procedimento)
scripts/repair-migrations-cr009h.sh                     (novo - preparado, não exec.)
docs/CR-009H-REPORT.md                                  (este arquivo)
```

---

## 9. Anexos / comandos úteis

- Abrir o login admin (dev): http://localhost:5173/admin/login
- Página de MFA (modo desafio): http://localhost:5173/auth/mfa?next=/admin
- Verificar saúde remota: MCP `get_project_health(ugwuxczcqlrdjkpjsdqb)`.
- Verificar histórico de migrations: MCP `list_migrations(ugwuxczcqlrdjkpjsdqb)`.
- Verificar contagem de usuários:
  ```sql
  select (select count(*) from auth.users) as users,
         (select count(*) from public.user_roles) as roles,
         (select count(*) from auth.mfa_factors) as mfa;
  ```

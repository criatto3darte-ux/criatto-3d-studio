# CR-009I — Preparação do primeiro teste real de autenticação

**Branch:** `arena/81a1f1ff-criatto-3d-studio`
**Base:** `main` @ `d922aeff` (PR #7 aberto)
**HEAD desta CR:** `893a6b8` → (commits desta CR)
**Supabase homologação:** `ugwuxczcqlrdjkpjsdqb`
**Data:** 2026-11-13
**Status:** ✅ preparação concluída. **Aguardando autorização para executar convite real.**

---

## 1. Etapa 1 — Migrations (revalidação)

### 1.1 Estado local

13 migrations em `supabase/migrations/`:

```
20261113120100..20261113121000  (CR-007B, 10 migrations)
20261114133000  cr008c_jwt_claims_and_aal
20261114133100  cr009c1_pg17_advisory_lock
20261115103000  cr009f_hook_type_fix_and_media_aal2
```

### 1.2 Estado remoto (`supabase_migrations.schema_migrations`)

Via MCP `list_migrations`: apenas as 10 migrations da CR-007B aparecem
como aplicadas. **0011, 0012 e 0013 não estão registradas.**

### 1.3 Evidência de que 0011/0012/0013 já foram aplicadas

Via `execute_query`:

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname in ('my_roles','custom_access_token_hook','require_aal2','check_private_media')
 order by p.proname;
```

Retorno: `check_private_media`, `custom_access_token_hook`, `my_roles`,
`require_aal2` — todos presentes. A policy `media_read_scoped` com
`require_aal2()` (0013) também foi confirmada em auditorias anteriores
(CR-009F.1).

### 1.4 Compatibilidade do `migration repair`

Validado via `npx supabase migration repair --help` (CLI v3.1.0):

- Suporta `--remote=<project_ref>` (sem `supabase link` obrigatório).
- Flag `--status applied|reverted`.
- Requer escopo `database_write` no token.
- **Não emite DDL** — apenas insere linhas em
  `supabase_migrations.schema_migrations`.

Comando preparado (**não executado**), ver §5.

---

## 2. Etapa 2 — Homologação HTTPS

### 2.1 Vite

- Porta corrigida de `3000` → `5173` para alinhar com
  `site_url=http://localhost:5173` e `uri_allow_list=http://localhost:5173/auth/callback`
  do Supabase e com `VITE_APP_URL` dos `.env.*.example`.
- Novo npm script **`dev:tunnel`** que liga `CR009I_TUNNEL=1` e
  `--host 0.0.0.0`.
- Novo plugin `tunnelLockdownPlugin` em `vite.config.ts` que, quando
  `CR009I_TUNNEL=1`, **bloqueia**:
  - `*.map` (sourcemaps)
  - `/@fs/*` (acesso Vite ao filesystem absoluto)
  - `/__inspect` (debug)
  - CSS sourcemaps desligados (`css.devSourcemap: false`)
- Rotas `/admin/login`, `/auth/callback`, `/auth/mfa`,
  `/auth/set-password`, `/auth/done`, `/auth/login`, `/auth/error`
  **todas retornam 200** no Vite em modo túnel (verificado via `curl`
  após subir o servidor com `CR009I_TUNNEL=1`).
- `/.env.local` de teste não foi persistido (removido após validação).

### 2.2 Túnel

`scripts/tunnel-homolog.sh` reescrito com subcomandos:

```bash
bash scripts/tunnel-homolog.sh vite          # Vite em modo túnel (terminal A)
bash scripts/tunnel-homolog.sh cloudflared   # túnel (terminal B)
```

**cloudflared** é a recomendação principal:
- `npx --yes cloudflared tunnel --url http://localhost:5173 --no-autoupdate`
- Sem login, sem cadastro, HTTPS válido, sem wildcard necessário.
- URL muda a cada execução (volátil) — isso é aceitável para um teste de
  homologação de ~30 min. Para URL fixa seria necessário `cloudflared tunnel create` com conta Cloudflare.
- Alternativa: `bash scripts/tunnel-homolog.sh lt` (localtunnel com
  subdomínio `criatto3d-cr009i`).

### 2.3 Estabilidade da URL

Durante a sessão de teste:
- **Não reiniciar o processo cloudflared** (a URL mudaria).
- O Vite pode ser reiniciado à vontade (HMR); o túnel continua apontando
  para `localhost:5173`.
- Se o túnel cair, fecha-se o convite (ou usa-se a URL nova),
  **nunca** se adiciona wildcard ao allow-list.

### 2.4 Exposição mínima

- Vite responde em `0.0.0.0:5173` somente com `dev:tunnel`.
- O plugin de lockdown bloqueia sourcemaps e `/@fs`.
- Não há arquivos de credenciais em `dist/` ou servidos (credential-scan
  0 incidências).
- Sourcemaps de produção já eram desligados (`mode==='production'`).

### 2.5 Allow-list temporário (operação pendente)

Executar **apenas no momento do teste**, com a URL do túnel em mãos:

- Ir em Supabase → Authentication → URL Configuration → Redirect URLs.
- **Adicionar** `<URL_DO_TUNEL>/auth/callback` (ex.: `https://xxxx.trycloudflare.com/auth/callback`).
- **Não remover** `http://localhost:5173/auth/callback`.
- **Não alterar** `site_url` (pode ficar em `http://localhost:5173`;
  `redirectTo` PKCE usa `getAppOrigin()` = `window.location.origin`,
  que já será a URL do túnel quando o usuário abrir o convite no
  celular).
- **Ao final do teste, remover** a URL do túnel.

### 2.6 Verificações de roteamento (já executadas em localhost)

```
/admin/login       → 200
/auth/callback     → 200
/auth/mfa          → 200
/auth/set-password → 200
/auth/done         → 200
/auth/login        → 200 (informativa de convite)
/auth/error        → 200
/@fs/etc/passwd    → 404 (bloqueio túnel)
*.map              → 404 (bloqueio túnel)
```

Verificações em computador e celular serão repetidas no dia do teste
depois do túnel levantado (passo 3 do checklist §6).

---

## 3. Etapa 3 — SMTP

Estado atual (via `get_auth_config`):

- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_admin_email`,
  `smtp_sender_name` — **todos `null`**.
- `hook_send_email_enabled: false` (usa o mailer padrão do GoTrue).
- `mailer_autoconfirm: false` (e-mails precisam ser confirmados — o convite
  já lida com isso).
- `rate_limit_email_sent: 2` (máx 2 e-mails por destinatário por hora).

**O SMTP padrão do Supabase (resend/SendGrid gerenciado pela plataforma)**
funciona para Free/Pro plan, mas com limitações:
- Remetente genérico (`no-reply@mail.app.supabase.co` em muitas regiões).
- Baixa reputação em algumas caixas (cair em spam é comum para o primeiro
  envio para um novo domínio).
- Baixa cota: adequada para 1 convite de homologação, **inadequada** para
  produção com vários operadores.

**Para homologação do primeiro convite: o SMTP padrão basta** — só vamos
enviar 1 e-mail para `criatto3d.arte@gmail.com` (convite) e talvez um
recovery.

**Para produção futura (não configurar agora)**, opções apropriadas:

| Opção | Domínio | Auth | TLS/STARTTLS | SPF/DKIM |
|---|---|---|---|---|
| Gmail (workspace ou SMTP com app password — **não recomendado para produção**; requer 2FA do Google + app password de 16 chars) | `smtp.gmail.com:587` | `smtp_user`/`smtp_pass` | STARTTLS obrigatório | DKIM/SPF próprios do Gmail, FROM precisa ser o mesmo usuário ou alias autorizado |
| Brevo (Sendinblue) / Mailgun / Postmark / SendGrid (recomendados) | `smtp-relay.brevo.com:587` etc. | API key como senha | STARTTLS | SPF/DKIM/DMARC no domínio `criatto3d.art.br` ou `criatto3d.art` |
| Resend (parceiro Supabase) | `smtp.resend.com:465`/587 | `re_*` senha | TLS/STARTTLS | SPF/DKIM/DMARC no domínio |

Requisitos mínimos para SMTP customizado (produção):
- Domínio próprio (`criatto3d.art.br` ou semelhante) com DNS editável.
- Registro SPF autorizando o provedor.
- Chave DKIM publicada em DNS.
- DMARC `p=quarantine` no início, evoluindo para `p=reject`.
- `smtp_admin_email` e `smtp_sender_name` com o mesmo domínio.
- Porta 587 (STARTTLS) ou 465 (SMTPS).

Nenhuma credencial SMTP foi inserida ou alterada nesta CR.

---

## 4. Etapa 4 — Plano do primeiro usuário

Fluxo para `criatto3d.arte@gmail.com`:

```
[A. Convite]
  1. Supabase Auth → Users → Invite user:
       - Email: criatto3d.arte@gmail.com
       - Role (deixar vazio por enquanto — a role vem do bootstrap)
       - (Opcional) Redirect URL: https://<túnel>/auth/callback
  2. O usuário recebe "You've been invited".

[B. Onboarding do convite — no celular, com túnel ativo]
  3. Usuário clica em "Accept invitation".
  4. Cai em https://<túnel>/auth/callback?code=...&type=invite
     - callback troca code por sessão PKCE → /auth/set-password?next=/auth/done
  5. Cria senha forte (12+ chars, 3+ classes) → /auth/mfa?next=/auth/done
  6. Escaneia QR code com Google Authenticator/Authy/1Password →
     salva segredo e recovery codes (se o app os mostrar) →
     digita o código de 6 dígitos.
  7. Vai para /auth/done: vê aviso "acesso ainda não liberado, aguarde
     o operador". Faz logout ou volta à loja.

[C. Bootstrap do proprietário (operador, via SQL Editor com service_role)]
  8. Copia o UUID do usuário recém-criado (Auth → Users).
  9. Edita ops/sql/00-bootstrap-owner.sql:
       SET LOCAL cr007b.target_user_id     = '<UUID>';
       SET LOCAL cr007b.actor_display_name = 'Paulo Roberto (bootstrap homolog)';
  10. Executa no SQL Editor com connection string service_role
      (ou `supabase db execute --db-url`). O script:
       - adquire advisory lock (7007,2);
       - verifica que o usuário existe;
       - verifica que NÃO há outro proprietário ativo;
       - insere admin_profiles(active=true) e user_roles(role='proprietario');
       - registra evento em admin_audit_events;
       - retorna profile_id / role_id / role / display_name.

[D. Novo login administrativo]
  11. Paulo abre https://<túnel>/admin/login (ou no desktop:
      http://localhost:5173/admin/login).
  12. Entra com e-mail+senha → sinalização "segundofator obrigatório" →
      /auth/mfa?next=/admin → digita código TOTP → /admin.
  13. Dentro do painel: verifica menu, carregamento de dados (deve
      retornar listas vazias com 0 produtos/categorias/pedidos, sem erro
      403).

[E. Validação do JWT]
  14. Abre DevTools → Application → Local Storage → chave do supabase.
      Decodifica o access_token (em jwt.io ou no console):
       - aal: "aal2"
       - roles: ["proprietario"]
       - email: "criatto3d.arte@gmail.com"
       - email_verified: true (boolean, não string)
       - sub: <UUID>
  15. Tenta acessar /admin sem cookie (aba anônima) → deve ir para
      /admin/login.
  16. Tenta acessar /admin após signOut → /admin/login.

[F. Testes RLS]
  17. Tenta via SQL Editor com usuário autenticado AAL1: SELECT em
      tabelas admin (products/pending etc.) deve falhar com 42501
      (checagem via require_aal2()).
  18. Testa RPC my_roles() via Supabase client (AAL2) → retorna
      ["proprietario"].

[G. Logout e recuperação]
  19. Faz logout.
  20. /admin/login → "Esqueci minha senha" → digita
      criatto3d.arte@gmail.com → recebe e-mail.
  21. Clica no link no e-mail → /auth/callback?type=recovery →
      /auth/set-password?next=/admin/login → nova senha → volta a
      /admin/login → entra → MFA → /admin.
  22. Testa também que um e-mail inexistente mostra a mesma mensagem
      genérica (anti-enumeração).
```

### 4.1 Fluxo "usuário sem role durante o onboarding"

É o caso normal entre os passos B e C:

- Após B, o usuário tem sessão em AAL2 mas **não tem role**.
- `/auth/done` já foi escrito para esse caso (mostra "acesso ainda não
  liberado" e não tenta redirecionar para `/admin`).
- Se ele tentar navegar para `/admin`, o guard (alterado na CR-009H):
  - detecta AAL2 mas sem role → `signOut()` + `/admin/login` (não entra
    em loop MFA).
- Se ele tentar `/admin/login` com e-mail+senha ANTES do bootstrap, a
  rota verifica `mfa.listFactors()` e, apesar de ter TOTP verificado,
  chamará `/admin` — onde o guard falhará por falta de role e mandará de
  volta ao `/admin/login` com sessão encerrada.
  - Para evitar confusão nessa janela de tempo, recomenda-se fazer o
    bootstrap (C) logo após o onboarding (B) na mesma sessão de
    homologação antes de pedir novo login.
- As policies RLS não foram relaxadas: sem role, qualquer SELECT
  editorial em tabelas admin retorna vazio ou 42501 (comportamento
  correto).

---

## 5. Comandos que requerem autorização (checklist curto)

Executar **nesta ordem**, cada um após confirmação do passo anterior.

### 5.1 Repair de migrations (N-1, remoto)

Antes do convite, no terminal do operador:

```bash
npx --yes supabase migration repair \
  --remote=ugwuxczcqlrdjkpjsdqb \
  --status applied \
  20261114133000 20261114133100 20261115103000

npx --yes supabase migration list --remote=ugwuxczcqlrdjkpjsdqb
# Esperado: 13 migrations marcadas Applied remotamente.
```

### 5.2 Subir túnel HTTPS (terminal A e B)

```bash
cp .env.homolog.example .env.local
# editar .env.local:
#   VITE_SUPABASE_ANON_KEY=<pegar no painel Supabase → Project Settings → API → anon public key>
#   VITE_APP_URL=<URL do túnel que aparecer no passo seguinte>

# Terminal A:
bash scripts/tunnel-homolog.sh vite

# Terminal B:
bash scripts/tunnel-homolog.sh cloudflared
# Copia a URL https://xxxx.trycloudflare.com
```

### 5.3 Allow-list do Supabase (operação manual no painel)

> **Esta alteração de Auth precisa de autorização explícita porque é
> mutação em configuração remota.**

- Adicionar `https://xxxx.trycloudflare.com/auth/callback` em Redirect URLs.
- **Não** alterar Site URL.
- Após o teste, remover.

### 5.4 Reiniciar Vite com VITE_APP_URL correto

Ajustar `VITE_APP_URL` em `.env.local` para `https://xxxx.trycloudflare.com`
e reiniciar o Vite do terminal A (Ctrl+C + subir de novo).

### 5.5 Enviar convite para criatto3d.arte@gmail.com

> **Requer autorização explícita (é a primeira mutação em users).**

No painel Supabase → Authentication → Users → **Invite user**:
- Email: `criatto3d.arte@gmail.com`
- Não preencher role.
- (Opcional) Redirect URL: `https://xxxx.trycloudflare.com/auth/callback`.

### 5.6 Onboarding do usuário (no celular)

Abrir o e-mail, seguir o fluxo do §4 B (senha → MFA → /auth/done).
Copiar o UUID do usuário no painel.

### 5.7 Bootstrap do proprietário (SQL Editor)

> **Requer autorização explícita.**

Colar `ops/sql/00-bootstrap-owner.sql` no SQL Editor (connection string de
service_role/método postgres), ajustar os dois `SET LOCAL` e executar.
Verificar retorno: 1 linha com `role=proprietario`.

### 5.8 Login administrativo completo (Paulo)

`/admin/login` → senha → TOTP → `/admin`. Validar §4 D/E/F/G.

### 5.9 Encerramento

- Remover a URL temporária do allow-list.
- Ctrl+C no Vite (A) e no cloudflared (B).
- Remover `.env.local` com chaves de homologação.
- Atualizar relatório CR-009J com os resultados.

---

## 6. O que NÃO foi feito (cumprindo restrições)

- ❌ Nenhum usuário criado em `auth.users` (0 users confirmado por MCP).
- ❌ Nenhum convite enviado.
- ❌ Bootstrap de proprietário não executado.
- ❌ SMTP não alterado (continua null — usando mailer padrão do Supabase
  para o primeiro envio).
- ❌ Auth config não alterada (allow-list e site_url continuam exatamente
  como estavam).
- ❌ Migrations não foram reaplicadas.
- ❌ Nenhuma alteração em Locaweb / DNS.
- ❌ Sem deploy, sem merge (PR #7 continua aberto).
- ❌ Repair de migrations **preparado em script** mas não executado.

---

## 7. Alterações de código desta CR

```
vite.config.ts                      porta 5173, plugin tunnelLockdown, dev:tunnel suporte
package.json                        script "dev:tunnel"
.env.homolog.example                instruções atualizadas para túnel CR-009I
.env.example                        comentário sobre VITE_APP_URL de túnel
scripts/tunnel-homolog.sh           reescrito (vite/cloudflared/lt subcommandos)
scripts/repair-migrations-cr009h.sh comando CLI v3 exato (--remote=ref)
docs/CR-009I-REPORT.md              este arquivo
```

### Verificações

- `bunx tsc --noEmit` → 0 erros.
- `bunx eslint --max-warnings 0 vite.config.ts` → limpo.
- `bun run test` → 17 arquivos / 192 testes verdes.
- Vite em modo túnel testado via curl: rotas 200, `/@fs/*` e `*.map` → 404,
  nenhum `sourceMappingURL` servido.
- Servidor de teste desligado; `.env.local` de teste removido.

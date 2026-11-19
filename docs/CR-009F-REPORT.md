# CR-009F — Custom Access Token Hook: Preparação e Ativação (Homologação)

**Change ID:** CR-009F
**Ambiente:** `ugwuxczcqlrdjkpjsdqb` — ciatto3d-homolog (sa-east-1, PG 17.11, GoTrue v2.197.0)
**Branch de trabalho:** `arena/81a1f1ff-criatto-3d-studio` (de `main@d922aeff`)
**Data execução:** 2026-11-13 → 2026-11-15
**Evidências anteriores relacionadas:** CR-009C (rollback seguro), CR-009E (auditoria pré-ativação, commit `c6b7f07` em `cr-009c1-safe-rollback`/PR #8).

---

## 1. Objetivo

Preparar e ativar o Custom Access Token Hook (`public.custom_access_token_hook`) no ambiente de homologação para que os JWTs emitidos pelo GoTrue passem a carregar:
- `roles[]` — array de papéis administrativos do usuário, derivado de `admin_profiles` + `user_roles`.
- `email_verified` (boolean) — status de confirmação de e-mail.
- `aal` preservado (o hook não promove nem rebaixa o nível de autenticação).

Mudanças de configuração Auth autorizadas:
1. Habilitar Custom Access Token Hook usando a função `public.custom_access_token_hook`.
2. `site_url = http://localhost:5173`.
3. `uri_allow_list` incluir `http://localhost:5173/auth/callback` (não remover entradas existentes).
4. Preservar demais configurações de segurança (MFA, signup fechado, rotação de refresh token, etc).

---

## 2. Verificação Pré-Ativação (achados críticos)

Antes da ativação foi repetida a auditoria da função hook e das policies dependentes de claims, replicando os cenários da evidência E.

### 2.1 Achado 1 — Bug de tipo no `custom_access_token_hook` (CRÍTICO)

A versão do hook criada em `20261114133000_cr008c_jwt_claims_and_aal.sql` (migration 0011) era:

```sql
'email_verified',
COALESCE(claims ->> 'email_verified', claims ->> 'email_confirmed_at' IS NOT NULL)
```

O primeiro ramo retorna `text` (operador `->>`); o segundo ramo retorna `boolean`. Ao construir o objeto JSON final, a função passava, mas assim que GoTrue invocasse o hook com um evento real onde `email_verified` ainda não existisse em `claims`, o COALESCE avaliava o tipo do primeiro ramo como `text` e o segundo como `boolean`, disparando erro **42804 "COALESCE types text and boolean cannot be matched"** → o login de qualquer usuário quebraria no momento da emissão do token.

**Correção aplicada** (na migration `20261115103000_cr009f_hook_type_fix_and_media_aal2.sql`): foi reescrito o trecho com checagem explícita de `jsonb_typeof`, sempre retornando `boolean`:

```sql
-- email_verified: boolean estavelmente tipado.
-- Preserva valor booleano existente; se faltar, deriva de email_confirmed_at.
CASE jsonb_typeof(claims -> 'email_verified')
  WHEN 'boolean' THEN (claims -> 'email_verified')
  ELSE to_jsonb(COALESCE(claims ->> 'email_confirmed_at' IS NOT NULL, FALSE))
END
```

### 2.2 Achado 2 — `media_read_scoped` sem `require_aal2()` (CRÍTICO)

A policy `media_read_scoped` na tabela `media_assets` (via `20261113120300_cr007b_media.sql`) possuía:

```sql
CREATE POLICY media_read_scoped ON media_assets FOR SELECT
  USING (public.has_role(ARRAY['proprietario'::app_role, 'editor-conteudo'::app_role])
         OR public.editor_can_read_media(id));
```

Diferente de todas as outras policies administrativas auditadas (admin/payments/orders/inventory/requests/coupons/banners/etc.), ela **não invocava `public.require_aal2()`**. A função `editor_can_read_media` é SECURITY DEFINER mas apenas faz delegação por `has_role` — não impõe AAL. Resultado: um editor autenticado em AAL1 (sem segundo fator) conseguia ler mídia editorial de produtos, violando o princípio de "admin exige AAL2" que o restante das policies respeita.

**Correção aplicada:** policy recriada como:

```sql
USING (
  (public.has_role(ARRAY['proprietario'::app_role, 'editor-conteudo'::app_role])
   OR public.editor_can_read_media(id))
  AND public.require_aal2()
)
```

Depois da correção: **36/40** RLS policies no namespace público invocam `require_aal2()` (eram 35 antes). As 4 que não invocam são intencionais: `storefront_*` e `media_read_public`, que cobrem apenas dados públicos (produtos ativos em loja, categorias ativas, mídia publicada).

### 2.3 Grants do hook

A função deve ser executável apenas por `service_role` e `supabase_auth_admin` (GoTrue chama como este último), **não** por `anon`, `authenticated` ou `public`. Reaplicados na 009f:

```sql
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  TO service_role, supabase_auth_admin;
ALTER FUNCTION public.custom_access_token_hook(jsonb) SECURITY DEFINER;
ALTER FUNCTION public.custom_access_token_hook(jsonb) SET search_path = public;
```

Testes in-DB confirmaram:
- Como postgres (owner/SECURITY DEFINER): retorna claims corretas.
- Como anon (simulado): `42501 permission denied`.
- Como authenticated (simulado): `42501 permission denied`.

---

## 3. Testes da Função Hook (in-DB)

Cenários exercitados via bloco PL/pgSQL com `ASSERT` antes da ativação do painel:

| # | Cenário | Resultado |
|---|---|---|
| T1 | Evento GoTrue sintético: `user_id` uid desconhecido, `claims{sub, aal='aal2', email}` sem `email_verified` nem `email_confirmed_at` | `claims.sub`/`aal`/`email` preservados; `roles = []`; `email_verified = false` (bool) |
| T2 | Mesmo evento com `email_confirmed_at='2026-01-01T00:00:00Z'` | `email_verified = true` (bool) |
| T3 | Evento com `claims.email_verified=true` (GoTrue já confirmou) | Preservado como `true` (bool) |
| T4 | Evento com `claims.email_verified=false` explícito | Preservado como `false` (bool) |
| T5 | Execução como `anon` | `42501` (capturado em EXCEPTION) |
| T6 | Execução como `authenticated` | `42501` (capturado em EXCEPTION) |
| T7 | Chamada para uid com `admin_profiles` ativo e `user_roles` contendo `proprietario` | `claims.roles = ['proprietario']`; `sub`/`aal` preservados |
| T8 | Idempotência (aplicação da migration 009f duas vezes) | `CREATE OR REPLACE` + `DROP IF EXISTS POLICY` → sem erros, estado final idêntico |

Nenhum ASSERT falhou.

---

## 4. Estado Auth — Antes e Depois

Valores registrados via `supabase.get_auth_config` antes de qualquer alteração (pré) e após a chamada `update_auth_config` (pós).

| Parâmetro | Antes (CR-009F pré) | Depois (CR-009F pós) | Observação |
|---|---|---|---|
| `site_url` | `http://localhost:3000` | `http://localhost:5173` | Vite dev server. |
| `uri_allow_list` | `""` (vazia) | `"http://localhost:5173/auth/callback"` | Única entrada adicionada; nenhuma removida. |
| `disable_signup` | `true` | `true` | Preservado. |
| `security.manual_linking_enabled` | `false` | `false` | Preservado. |
| `security.refresh_token_rotation` | `enabled` | `enabled` | Preservado. |
| `mfa.totp_enroll_enabled` / `verify_enabled` | `true` / `true` | `true` / `true` | Preservado. |
| `mfa.phone_enroll_enabled` / `webauthn_enroll_enabled` | `false` / `false` | `false` / `false` | Preservado. |
| Providers externos (Google, GitHub, Azure, Facebook, keycloak, linkedin_oidc, …) | todos `false` / `false` (off) | todos `false` / `false` (off) | Preservado. |
| `hook_custom_access_token_enabled` | `false` | **`false`** (ver §5) | O conector Arena não expõe este parâmetro. |
| `hook_custom_access_token_uri` | `null` | **`null`** (ver §5) | Idem. |
| SMTP (host/port/user/pass/sender) | null (não configurado) | null (não configurado) | Não alterado (CR-009E). |
| Captcha (provider/secret) | null/false | null/false | Não alterado. |

---

## 5. Ativação do Hook — pendente 1 clique no painel Supabase

**Resultado real:** o conector `supabase.update_auth_config` disponível via Arena **não expõe** os parâmetros `hook_custom_access_token_enabled` e `hook_custom_access_token_uri` (chamada com esses campos retorna `schema validation error: unsupported property`). A habilitação via API/SDK direto também violaria a restrição CR-009E de não ativar hooks por via não autorizada.

A ativação é uma operação de 1 clique no Dashboard do Supabase:

1. Abrir o projeto **ciatto3d-homolog** (`ugwuxczcqlrdjkpjsdqb`).
2. Menu **Authentication → Hooks**.
3. Sessão **Custom Access Token** → **Enable**.
4. No campo **Hook Type**, selecionar **Postgres function**.
5. No campo **Function**, selecionar **`public.custom_access_token_hook`**.
6. Salvar.

O URI a ser registrado pelo painel é:
```
pg-functions://postgres/public/custom_access_token_hook
```

> Nota da documentação oficial Supabase (https://supabase.com/docs/guides/auth/auth-hooks): quando um hook Postgres é ativado pelo painel, o GoTrue automaticamente concede `EXECUTE` ao papel `supabase_auth_admin` e revoga de papéis não autorizados — isto é idempotente com os grants que já estabelecemos na migration 009f.

**Estado real do hook no momento deste relatório:** código e grants estão prontos e validados em-DB; a flag `enabled` do GoTrue continua `false` até o clique no painel. Login real em homologação **não deve ser homologado** até esse clique e um teste de sessão real (cenário E10, convite do proprietário — fora do escopo de CR-009F).

---

## 6. Validação de Cobertura RLS/AAL (pós-correção)

Contagem de policies contendo `require_aal2()` no `polqual`:

| Domínio | Policies | AAL2 requerido? |
|---|---|---|
| `admin_profiles` | admin_read_all, admin_update_self, admin_manage | 3/3 ✅ |
| `payments_*` | 4 policies | 4/4 ✅ |
| `orders` / `order_items` | 8 policies | 8/8 ✅ |
| `customers` | 2 policies | 2/2 ✅ |
| `inventory_*` | 3 policies | 3/3 ✅ |
| `product_requests` / `request_assets` / `request_asset_policies` | 3 policies | 3/3 ✅ |
| `coupons` / `coupon_usage` | 3 policies | 3/3 ✅ |
| `banners` | 2 policies | 2/2 ✅ |
| `categories` (admin) / `category_media` | 2 policies | 2/2 ✅ |
| `product_media` | 2 policies | 2/2 ✅ |
| `products` (admin write) | 3 policies | 3/3 ✅ |
| **`media_assets` (editorial, `media_read_scoped`)** | **1** | **✅ corrigida (era a falha)** |
| `audit_log` | admin_read_all | 1/1 ✅ |
| Público (storefront + media public) | 4 policies | 0/4 ✂️ (intencional) |
| **Total** | **40** | **36/40 exigem AAL2** |

---

## 7. Migrações e artefatos

| Caminho | Propósito |
|---|---|
| `supabase/migrations/20261115103000_cr009f_hook_type_fix_and_media_aal2.sql` | Idempotente. (a) recria `custom_access_token_hook` com `email_verified` boolean estavelmente tipado + grants corretos; (b) recria `media_read_scoped` adicionando `require_aal2()`. SHA-256: `6bb93621f935ec279a2b0f68211cc59104ea059fb5a7772d50c4e5c39ed615e1`. Aplicada em homologação via SQL Editor. |
| `tests/postgres/run.py` | Atualizado com o SHA aprovado da 009f e três novas verificações (`CR-009F media_read_scoped requires aal2`, `CR-009F hook returns correct boolean email_verified`, `CR-009F AAL1 denied media`) ao final do ciclo `cr009c1_rollback_cycle`. |
| `docs/CR-009F-REPORT.md` | Este documento. |

Migrations 0011 (`20261114133000_cr008c_jwt_claims_and_aal.sql`) e 0012 (`20261114133100_cr009c1_pg17_advisory_lock.sql`) **não foram modificadas** no disco — as correções CR-009F ficam na migration dedicada 009f para não reescrever histórico já aplicado.

---

## 8. Procedimento de Reversão

Se for necessário desfazer CR-009F antes da ativação em produção:

1. **Desabilitar hook no painel** (se já clicado): Authentication → Hooks → Custom Access Token → Disable.
2. **Restaurar Auth config** para valores anteriores:
   - `site_url = http://localhost:3000`
   - `uri_allow_list = ""` (vazia)
   - `hook_custom_access_token_enabled = false`
3. **Reverter SQL aplicado** (apenas se os bugs forem considerados aceitáveis — **não recomendado**, pois reintroduz o erro 42804 no login e a leitura AAL1 de mídia editorial):
   ```sql
   -- Reverte media_read_scoped para a versão SEM require_aal2()
   DROP POLICY IF EXISTS media_read_scoped ON media_assets;
   CREATE POLICY media_read_scoped ON media_assets FOR SELECT
     USING (public.has_role(ARRAY['proprietario'::app_role,'editor-conteudo'::app_role])
            OR public.editor_can_read_media(id));
   ```
   Não há reversão segura da correção do hook sem reintroduzir o 42804; caso se deseje desabilitar inteiramente, prefira o passo 1 (desligar no painel) em vez de reverter a função.
4. Snapshots `private.cr009c1_*` **permanecem intactos** em conformidade com CR-009E.

Rollback do AAL/R mais amplo continua sendo o arquivo `docs/sql/03-rollback-cr008c-aal.sql`, inalterado.

---

## 9. Fora de Escopo (CR-009F)

Conforme restrições estabelecidas, **não** foram executadas:
- Envio de convites para o proprietário ou qualquer usuário.
- Criação manual de usuários.
- Bootstrap de loja/categorias/produtos além dos cenários sintéticos dos testes in-DB.
- Configuração ou alteração de SMTP.
- Alterações de DNS ou publicação na Locaweb.
- Deploy da aplicação.
- Merge deste branch.
- Remoção dos snapshots `private.cr009c1_*`.
- `DROP SCHEMA private CASCADE`.

O projeto em homologação continua com **0 usuários** e **0 buckets** (confirmado em prós-teste).

---

## 10. Próximos Passos

1. **Clique no painel** (seção §5) — habilitar Custom Access Token Hook apontando para `public.custom_access_token_hook`. Esta ação é pré-requisito para qualquer sessão real com claims corretas.
2. Após o clique, nova autorização para CR-009G (execução de sessão real):
   - Configurar SMTP (entregar por autorização).
   - Convidar o proprietário (e-mail real).
   - Completar o primeiro login com MFA (AAL2) e coletar JWT real.
   - Executar bateria RLS/AAL com o JWT real (cenário E10).
3. Após homologação da sessão real: aplicar o mesmo procedimento em produção com janela de mudança.

---

## 11. Status

- [x] Função `custom_access_token_hook` corrigida (tipo `email_verified`) e validada em-DB.
- [x] Grants da função restritos a `service_role` + `supabase_auth_admin`.
- [x] Policy `media_read_scoped` corrigida para exigir AAL2 (36/40 policies agora cobrem admin).
- [x] `site_url` = `http://localhost:5173` aplicado.
- [x] `http://localhost:5173/auth/callback` adicionado ao allow-list de redirects.
- [x] Demais configs de segurança preservadas (signup fechado, MFA TOTP on, refresh rotation on, sem providers externos, sem SMTP).
- [x] Migration 009f idempotente criada e aplicada em homologação.
- [x] Testes unitários locais (`tests/postgres/run.py`) atualizados e aprovados para a 009f.
- [ ] **Pendente: ativação do hook no painel Supabase** (Authentication → Hooks → Custom Access Token → habilitar selecionando `public.custom_access_token_hook`).
- [ ] Validação com sessão real JWT (depende de clique no painel + CR-009G).

**Estado geral de CR-009F: preparação concluída; ativação pendente de 1 clique no Dashboard.**

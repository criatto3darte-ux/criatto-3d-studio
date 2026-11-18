# CR-015 — Separação de produção e preparação da publicação

**Data:** 18/11/2026. **PR:** #13 (`release/producao` → `main`).

## 1. Ambientes

| Ambiente | Supabase | Site |
|---|---|---|
| Produção | `criatto3d-producao` (`tdawygjcqmclwlrermpl`, sa-east-1, plano Free) | https://criatto3d.art.br |
| Homologação | `criatto3d-homolog` (`ugwuxczcqlrdjkpjsdqb`, sa-east-1, plano Free) | https://homolog.criatto3d.art.br |

A homologação é exclusivamente de teste; seus dados de teste foram removidos em 18/11/2026.

## 2. Produção — estado em 18/11/2026

- **Banco:** as 19 migrations (CR-007B → CR-014) aplicadas. Policies, grants, triggers e views
  comparados por hash com a homologação: idênticos.
- **Storage:** bucket `catalog-images` (público, somente `image/webp`, até 5 MB).
- **Configuração da loja:** `store_settings` id=1 (Criatto 3D, WhatsApp 5521987640769,
  `canonical_origin` https://criatto3d.art.br).
- **Edge Functions:** `checkout-order` (verify_jwt=false), `catalog-media` e `banner-media`
  (verify_jwt=true). O `ezbr_sha256` de cada uma é igual ao da homologação.
- **Secrets das funções:** `CHECKOUT_ALLOWED_ORIGINS` e `CATALOG_MEDIA_ALLOWED_ORIGINS` =
  `https://criatto3d.art.br,https://www.criatto3d.art.br` (digest conferido);
  `CHECKOUT_RATE_PEPPER` definido pelo proprietário.
- **Auth:** cadastro público desligado; login anônimo desligado; confirmação de e-mail ligada;
  Custom Access Token hook → `public.custom_access_token_hook`; Site URL
  `https://criatto3d.art.br`; Redirect URL `https://criatto3d.art.br/auth/callback`.
- **Proprietário:** um usuário promovido pelo procedimento de `CR-007B-OWNER-BOOTSTRAP.md`
  (evento `bootstrap.owner` em `admin_audit_events`). O MFA é cadastrado no primeiro login.

## 3. Código (PR #13)

- Consolida na `main` todo o trabalho homologado (CR-008 → CR-013) e o CR-012A.
- `pacote-producao.yml` passa a usar o Supabase de produção (publishable key) e liga o
  checkout real (`VITE_ENABLE_LIVE_CHECKOUT=true`).
- Remove os vínculos com o Lovable (relatório de erros, `.lovable/`, instruções e exceções).
- Versiona a CR-014 (`finance_order_summary` exige AAL2), com o SHA-256 fixado no harness PG17.
- CI do PR: Static + unit OK; PostgreSQL 17 com 820 asserções OK.

## 4. Publicação (passo a passo)

1. Desconectar o repositório no Lovable (Settings → GitHub) e integrar o PR #13 na `main`.
2. Primeiro login em `/admin` no domínio oficial, já cadastrando o MFA (app autenticador).
3. Cadastrar categorias, produtos, estoque e fotos reais pelo painel.
4. GitHub → Actions → `pacote-producao` → Run workflow (branch `main`) → baixar o ZIP.
5. Fazer backup do site atual na Locaweb e enviar o conteúdo do ZIP.
6. Teste final: catálogo, pedido real até o WhatsApp, mudança de status no painel.
7. Opcional: se o site também atender em `www`, incluir
   `https://www.criatto3d.art.br/auth/callback` em Auth → URL Configuration.

## 5. Pendências conhecidas

- **Chaves legadas do Supabase:** as Edge Functions usam `SUPABASE_SERVICE_ROLE_KEY` e
  `SUPABASE_ANON_KEY`, que o Supabase anuncia funcionar só até o fim de 2026. Migrar para
  `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS` (testando primeiro na homologação)
  antes dessa data. O frontend de produção já usa a publishable key.
- **Plano Free:** sem backup baixável e com pausa do projeto após ~7 dias sem atividade.
  Fazer backup manual periódico do banco.
- **Repositório público:** tornar privado em Settings → Danger Zone.
- **Proteção contra senhas vazadas:** só no plano Pro; mitigada por MFA obrigatório e por haver
  apenas contas administrativas.

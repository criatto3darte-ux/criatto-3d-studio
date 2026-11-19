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
  (verify_jwt=true), na versão do PR #14 (lêem `SUPABASE_SECRET_KEYS` /
  `SUPABASE_PUBLISHABLE_KEYS`, com fallback para as chaves legadas). O `ezbr_sha256` de cada uma
  é igual ao da homologação: `e458963c…`, `fa1bcce7…` e `29db990e…`.
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
- Integra o PR #14 (chaves novas nas Edge Functions); `pacote-homolog.yml` passa a usar a
  publishable key; o CI também valida PRs contra `release/**`.
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

- **Chaves legadas do Supabase:** frontend (produção e homologação) e Edge Functions já usam as
  chaves novas. Só revogar as chaves legadas depois de conferir, nos logs, que nenhuma função
  usou o fallback legado e que não há outros consumidores.
- **Upload de imagens (CR-013A) — resolvido em `35a474b`:** o frontend confiava em `file.type`
  e recusava imagens informadas pelo sistema como `""`/`application/octet-stream`, com uma
  mensagem que citava o limite de 12 MB. Agora o formato é detectado pelos bytes iniciais e as
  mensagens de vazio/tamanho/formato são distintas. Aprovado na homologação em 19/11/2026 com
  sessão AAL2: upload de 2 fotos de produto e 1 de banner (POST 200 com arquivo), troca da foto
  principal, remoção da secundária (Storage, `media_assets` e `product_images` limpos; nenhum
  `delete-pending`), foto e banner exibidos na loja. Limitação: o Safari não gera WebP no
  navegador; o painel orienta usar Chrome, Edge ou Firefox.
- **Homologação:** os pedidos de QA #1 e #2 e os movimentos de estoque ficam preservados por
  auditoria. Registros de QA "35a474b" (categoria, produto, banner e 2 imagens) aguardam
  autorização para limpeza.
- **Plano Free:** sem backup baixável e com pausa do projeto após ~7 dias sem atividade.
  Fazer backup manual periódico do banco.
- **Repositório público:** tornar privado em Settings → Danger Zone.
- **Proteção contra senhas vazadas:** só no plano Pro; mitigada por MFA obrigatório e por haver
  apenas contas administrativas.

# CR-017 — Homologação automática e publicação controlada

Toda atualização é testada na homologação antes de chegar à loja real. O cliente
não precisa testar cada versão.

## Fluxo

1. **PR** → CI (`ci.yml`): testes unitários e 820+ verificações do banco (PostgreSQL 17).
2. **Integração na `main`** → `deploy-homolog.yml`:
   - gera o site de homologação, valida o pacote (`scripts/validar-pacote.sh`) e
     publica por FTP em https://homolog.criatto3d.art.br;
   - espera o site responder a versão nova (`/version.txt` = SHA do commit);
   - roda os testes de ponta a ponta (`e2e/`) no site publicado:
     - loja no desktop (tema claro) e no celular (tema escuro);
     - compra completa até a mensagem do WhatsApp;
     - painel com login e MFA: atender e cancelar o pedido;
     - foto do produto: enviar, ver na loja e remover;
     - banner: enviar e remover imagem.
3. **Produção** → `deploy-producao.yml` (manual: Actions → deploy-producao → Run
   workflow, branch `main`, digitar `PUBLICAR`):
   - recusa o commit se o `deploy-homolog` dele não tiver passado;
   - gera e valida o pacote de produção e publica por FTP em https://criatto3d.art.br;
   - roda só os testes `@somente-leitura` (não cria pedidos nem altera dados).

Os workflows `pacote-homolog` e `pacote-producao` continuam disponíveis para
publicação manual por ZIP, como plano B.

## Configuração (uma vez)

### Secrets do GitHub (Settings → Secrets and variables → Actions)

| Secret | Valor |
|---|---|
| `HOMOLOG_FTP_SERVER` | servidor FTP da homologação na Locaweb |
| `HOMOLOG_FTP_USERNAME` / `HOMOLOG_FTP_PASSWORD` | usuário e senha FTP |
| `HOMOLOG_FTP_DIR` | pasta do site, terminando em `/` (ex.: `/public_html/homolog/`) |
| `PRODUCAO_FTP_SERVER` / `PRODUCAO_FTP_USERNAME` / `PRODUCAO_FTP_PASSWORD` | FTP da produção |
| `PRODUCAO_FTP_DIR` | pasta do site, terminando em `/` (ex.: `/public_html/`) |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | usuário de testes da **homologação** |
| `E2E_ADMIN_TOTP_SECRET` | chave do autenticador desse usuário (texto mostrado no cadastro do MFA) |

O deploy usa FTPS. Na primeira publicação automática todos os arquivos são
enviados e o servidor passa a guardar `.ftp-deploy-sync-state.json` (bloqueado
para acesso público no `.htaccess`); nas seguintes, só o que mudou.

### Usuário de testes (homologação)

1. Supabase → **criatto3d-homolog** → Authentication → Users → Add user (e-mail
   dedicado, senha forte, "Auto confirm user").
2. Papéis `editor` + `operador` no banco da homologação (sem `proprietario`).
3. Entrar uma vez em `homolog.criatto3d.art.br/admin` com esse usuário, copiar a
   **chave** mostrada na tela do autenticador para o Secret `E2E_ADMIN_TOTP_SECRET`
   e concluir o cadastro com o código do app.

### Base de testes (homologação)

Criada em 20/11/2026 e usada pelos testes; não apagar:

- categoria `QA Automação` (`qa-automacao`);
- produto `Produto QA E2E` (`produto-qa-e2e`), pronta entrega, 1.000 unidades;
- banner `Banner QA E2E` (inativo, não aparece na loja).

Cada execução cria um pedido de teste e o cancela (o estoque volta). Os pedidos
ficam no histórico como cancelados, como exige a auditoria.

## Rodar localmente

```bash
E2E_BASE_URL=https://homolog.criatto3d.art.br npx playwright test -c e2e/playwright.config.ts
```

Somente leitura (seguro na produção): acrescente `--grep @somente-leitura`.

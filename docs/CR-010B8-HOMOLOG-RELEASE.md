# CR-010B.8 — Hotfix isolado do formulário de login em homologação

- **Branch:** `integration/homolog-login-session-fix` (fork do HEAD do PR #7, `bdf895be12d110761c35d6a77faa92fdaeedc7bb`).
- **Escopo:** apenas correção do hook `useSession` em `src/lib/supabase/client.ts` e fluxo de empacotamento específico de homologação. Não mesclar os recursos comerciais ainda pendentes do PR #9.
- **Alvo:** `https://homolog.criatto3d.art.br/admin/login?mode=login`.
- **Destino Locaweb:** `/public_html/homolog/`, **nunca** `/public_html/` na raiz.
- **Login:** formulário original preservado, AAL2/TOTP e RLS intactos.
- **Conexão do frontend:** build de homologação com `VITE_SUPABASE_URL`, publishable key pública, e `VITE_APP_URL` de homologação. Nunca embutir service_role.
- **Commit do reparo:** `38cf4fe076e6b3da29f3788877f5e684faaeda8d`.
- **Commit de empacotamento:** `f44c18e0bdb92813caafae2c9216758e31d9f291`.

## Publicação operacional (manual; ainda não executada neste chat)

1. Abrir GitHub Actions → workflow `ci` → executar ou consultar o run da branch `integration/homolog-login-session-fix`.
2. Verificar resultado **success** em `Static + unit` e `Pacote homologação (ZIP artifact)`. Caso não haja sucesso, **não publicar**.
3. Baixar o artifact **`criatto3d-homolog-login-fix`**; extrair o ZIP externo do GitHub Actions e identificar o arquivo interno `criatto3d-homolog-login-fix.zip`.
4. No Gerenciador de Arquivos Locaweb, fazer uma cópia de segurança da pasta `/public_html/homolog/` (não alterar produção).
5. Extrair **o conteúdo** do ZIP interno diretamente em `/public_html/homolog/`, sobrescrevendo arquivos de homologação existentes; preservar qualquer configuração do servidor que não faça parte do ZIP. Não apagar indiscriminadamente arquivos externos ao build.
6. Verificar que `/public_html/homolog/index.html` está presente, e que a árvore `assets/` corresponde ao novo build. Não colocar um segundo diretório `dist` ou `_pkg` no destino.
7. Reabrir `https://homolog.criatto3d.art.br/admin/login?mode=login` em janela InPrivate, com `Ctrl+F5`; digitar uma letra e depois o e-mail completo. A página não deve cair no error boundary.
8. Conferir Console em caso de falha, incluindo mensagens redigidas sem credenciais/senhas. Confirmar requisições ao Supabase somente quando o login for enviado.
9. Se houver problema, restaurar a cópia de `/public_html/homolog/`; registrar o erro e horário. Não mudar o banco por causa do frontend.

## Limitações

Os commits foram feitos por integração GitHub. Este chat **não tem acesso Locaweb/FTP para upload** nem consegue verificar, apenas por Actions, o resultado do usuário digitando no navegador. **A publicação no domínio não deve ser declarada concluída antes do upload e teste.**

A branch do PR #9 permanece separada, com sua correção e trabalho do catálogo preservados.

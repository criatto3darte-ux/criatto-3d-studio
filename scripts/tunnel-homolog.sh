#!/usr/bin/env bash
# CR-009H: Procedimento para abrir um TÚNEL HTTPS temporário de homologação.
#
# POR QUE:
#   Para testar o convite administrativo em um dispositivo móvel diferente do
#   notebook de desenvolvimento, o link do Supabase (PKCE) precisa apontar
#   para uma origem HTTPS pública válida durante o fluxo. Um túnel evita
#   publicar DNS, alterar a loja pública ou configurar domínios próprios.
#
# COMO USAR:
#   1. Garanta que Vite está rodando em localhost:5173 (ou a porta configurada).
#   2. Rode um dos comandos abaixo (cloudflared é a opção recomendada, sem login).
#   3. Copie a URL HTTPS retornada (ex.: https://xxx-yyy.trycloudflare.com).
#   4. Adicione ESSA URL + /auth/callback ao allow-list do Supabase
#      (Authentication → URL Configuration → Redirect URLs).
#   5. Inicie o Vite com VITE_APP_URL=<URL> para que getRedirectUrl() SSR-safe
#      e PKCE redirectTo apontem para o túnel.
#   6. Abra o convite no celular; fluxo funciona de ponta a ponta.
#   7. Ao finalizar o teste, REMOVA a URL do allow-list e pare o túnel.
#
# REGRAS DE SEGURANÇA:
#   • Nunca deixe a URL temporária no allow-list após o teste (abuso do OAuth).
#   • Não adicione wildcards (ex.: https://*.trycloudflare.com).
#   • Nunca exponha credenciais/segredos no terminal que rode o túnel.
#   • Este script NÃO inicia o túnel automaticamente — só imprime instruções.

set -euo pipefail

cat <<'EOF'
==============================================================
  TÚNEL HTTPS TEMPORÁRIO PARA HOMOLOGAÇÃO DE CONVITE (CR-009H)
==============================================================

Opção A — cloudflared (recomendada; gratuita, sem login):
  npx --yes cloudflared tunnel --url http://localhost:5173
  # Copie a URL https://*.trycloudflare.com que aparecer.

Opção B — localtunnel (leve, sem instalação):
  npx --yes localtunnel --port 5173 --subdomain criatto3d-cr009h
  # Retorna https://criatto3d-cr009h.loca.lt
  # ATENÇÃO: ao abrir no celular pela primeira vez, localtunnel pede a
  # página "Click to Continue" (IP do túnel). Navegadores embutidos de
  # apps de e-mail podem falhar — prefira cloudflared.

Opção C — ngrok (requer conta gratuita e token):
  # ngrok http 5173

Após levantar o túnel, configure a sessão de homologação:
  export VITE_APP_URL="<URL-HTTPS-DO-TUNEL>"
  bun run dev --host 0.0.0.0

Adicione no Supabase Dashboard (Authentication → URL Configuration):
  Redirect URLs:
    <URL-HTTPS-DO-TUNEL>/auth/callback
  Site URL pode continuar http://localhost:5173; o redirectTo enviado
  em invite/recovery usa VITE_APP_URL do cliente.

Encerramento:
  - Ctrl+C no túnel.
  - Remova a URL temporária de Redirect URLs no Supabase.
  - Unset VITE_APP_URL (ou feche o terminal).

EOF

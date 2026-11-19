#!/usr/bin/env bash
# CR-009I: Levantar túnel HTTPS temporário para o teste real do primeiro
# convite administrativo em dispositivo móvel.
#
# USO (ordem):
#   1. Em um terminal:
#        cp .env.homolog.example .env.local   # preencher VITE_SUPABASE_ANON_KEY
#        # editar VITE_APP_URL abaixo, depois:
#        bash scripts/tunnel-homolog.sh vite
#      (sobe o Vite em modo túnel: sem sourcemaps / @fs, 0.0.0.0:5173)
#
#   2. Em outro terminal, NA MESMA VITE_APP_URL que o vite está servindo:
#        bash scripts/tunnel-homolog.sh cloudflared
#      Copie a URL https://xxxx-yyy.trycloudflare.com impressa no console.
#
#   3. Adicione ESSA URL + "/auth/callback" ao allow-list do Supabase
#      (Authentication → URL Configuration → Redirect URLs).
#      Ajuste VITE_APP_URL em .env.local para a URL do túnel e reinicie o Vite.
#
#   4. Adicione também a URL à variável allow-list imediatamente antes do
#      convite; REMOVA logo após o teste.
#
# REGRA DE SEGURANÇA:
#   • Encerre o túnel (Ctrl+C) e remova a URL do allow-list ao final.
#   • Nunca adicione wildcard *.trycloudflare.com — sempre a URL EXATA.
#   • O servidor Vite é iniciado com CR009I_TUNNEL=1, que:
#       - desliga sourcemaps (esbuild + CSS);
#       - bloqueia /@fs/* e *.map via middleware.
#   • Não rode este script em redes públicas com dados sensíveis — é uma
#     ferramenta de homologação de curta duração.

set -euo pipefail

CMD="${1:-}"
PORT="${PORT:-5173}"

case "$CMD" in
  vite)
    echo "[cr009i] iniciando Vite em modo túnel (CR009I_TUNNEL=1, port ${PORT})"
    echo "[cr009i] sourcemaps e /@fs serão bloqueados"
    exec bun run dev:tunnel
    ;;

  cloudflared|cf)
    # cloudflared quick tunnel:
    #   - Sem login/cadastro, sem cobrança.
    #   - URL muda a cada execução (a não ser que use `cloudflared tunnel create`
    #     com conta, mas para homologação de 30 min a URL volátil é aceitável).
    #   - Para estabilidade de URL durante o teste usamos --url e deixamos o
    #     processo em primeiro plano para que Ctrl+C encerre.
    echo "[cr009i] levantando túnel cloudflared → http://localhost:${PORT}"
    echo "[cr009i] copie a URL https://*.trycloudflare.com que aparecer."
    exec npx --yes cloudflared tunnel --url "http://localhost:${PORT}" --no-autoupdate
    ;;

  lt|localtunnel)
    # Alternativa se cloudflared falhar. Retorna subdomínio determinístico.
    SUB="${TUNNEL_SUBDOMAIN:-criatto3d-cr009i}"
    echo "[cr009i] levantando localtunnel --subdomain ${SUB} → http://localhost:${PORT}"
    exec npx --yes localtunnel --port "${PORT}" --subdomain "${SUB}" --local-host localhost
    ;;

  *)
    cat <<'EOF'
Uso:
  bash scripts/tunnel-homolog.sh vite          # sobe o Vite em modo túnel
  bash scripts/tunnel-homolog.sh cloudflared   # sobe o túnel (em outro terminal)
  bash scripts/tunnel-homolog.sh lt            # alternativa localtunnel

Variáveis:
  PORT=5173              porta do Vite
  TUNNEL_SUBDOMAIN=...   (apenas localtunnel)
EOF
    exit 1
    ;;
esac

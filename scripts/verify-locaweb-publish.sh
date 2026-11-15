#!/usr/bin/env bash
# scripts/verify-locaweb-publish.sh
# -----------------------------------------------------------------------------
# Verificação pós-publicação na Locaweb.
# Uso: bash scripts/verify-locaweb-publish.sh https://criatto3d.art.br
# -----------------------------------------------------------------------------
set -euo pipefail

BASE="${1:-https://criatto3d.art.br}"
BASE="${BASE%/}"

pass=0
fail=0

check() {
  local desc="$1"; shift
  local url="$1"; shift
  local expect_code="$1"; shift
  local expect_body="${1:-}"

  local code
  code=$(curl -s -o /tmp/verify_body.txt -w "%{http_code}" --max-time 15 "$url") || true
  local body
  body=$(cat /tmp/verify_body.txt 2>/dev/null || echo "")

  local ok="yes"
  if [[ "$code" != "$expect_code" ]]; then ok="no"; fi
  if [[ -n "$expect_body" && "$body" != *"$expect_body"* ]]; then ok="no"; fi

  if [[ "$ok" == "yes" ]]; then
    echo "  ✅ $desc  ($code)"
    pass=$((pass+1))
  else
    echo "  ❌ $desc  (esperado $expect_code, recebido $code)"
    fail=$((fail+1))
  fi
}

echo "=========================================="
echo "Verificação de publicação: $BASE"
echo "=========================================="
echo ""

echo "── Rotas públicas (devem retornar 200 com SPA shell) ──"
check "Página inicial (/)"                 "$BASE/"                   200 "<div id=\"root\""
check "Página /produtos"                   "$BASE/produtos"           200 "<div id=\"root\""
check "Página /sobre"                      "$BASE/sobre"              200 "<div id=\"root\""
check "Página /contato"                    "$BASE/contato"            200 "<div id=\"root\""
check "Página /personalizados"             "$BASE/personalizados"     200 "<div id=\"root\""
check "Página /privacidade"                "$BASE/privacidade"        200 "<div id=\"root\""
check "Página /carrinho"                   "$BASE/carrinho"           200 "<div id=\"root\""
check "Rota de produto (/produto/<slug>)"  "$BASE/produto/vaso-geometrico" 200 "<div id=\"root\""
echo ""

echo "── F5/SPA fallback ──"
check "F5 em /admin (bloqueado → shell da SPA)" "$BASE/admin"          200 "<div id=\"root\""
check "F5 em /auth/login (bloqueado)"          "$BASE/auth/login"     200 "<div id=\"root\""
check "Rota inexistente (404 do app)"          "$BASE/rota-que-nao-existe" 200 "<div id=\"root\""
echo ""

echo "── Assets estáticos ──"
# Detecta assets hasheados a partir do index.html baixado
HTML_SOURCE=$(curl -s --max-time 15 "$BASE/")
JS_ASSET=$(printf '%s' "$HTML_SOURCE" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
CSS_ASSET=$(printf '%s' "$HTML_SOURCE" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.css' | head -1)
if [[ -z "$JS_ASSET" ]]; then
  echo "  ❌ JS bundle: não encontrado no index.html"; fail=$((fail+1))
else
  check "JS bundle hasheado" "$BASE$JS_ASSET" 200
fi
if [[ -z "$CSS_ASSET" ]]; then
  echo "  ❌ CSS bundle: não encontrado no index.html"; fail=$((fail+1))
else
  check "CSS bundle hasheado" "$BASE$CSS_ASSET" 200
fi
check "Logo full dark (PNG)"                 "$BASE/branding/logo-full-dark.png" 200
check "Logo mark (WEBP)"                     "$BASE/branding/logo-mark-dark.webp" 200
check "Favicon ICO"                          "$BASE/favicon.ico"        200
check "Manifest PWA"                         "$BASE/manifest.webmanifest" 200
check "robots.txt"                           "$BASE/robots.txt"         200
echo ""

echo "── Headers de segurança (.htaccess) ──"
HEADERS=$(curl -sI --max-time 15 "$BASE/")
if printf '%s' "$HEADERS" | grep -qi "X-Content-Type-Options:.*nosniff"; then
  echo "  ✅ X-Content-Type-Options: nosniff"; pass=$((pass+1))
else
  echo "  ❌ X-Content-Type-Options ausente"; fail=$((fail+1))
fi
if printf '%s' "$HEADERS" | grep -qi "X-Frame-Options:"; then
  echo "  ✅ X-Frame-Options: presente"; pass=$((pass+1))
else
  echo "  ❌ X-Frame-Options ausente"; fail=$((fail+1))
fi

echo ""
echo "=========================================="
echo "Resultado: $pass ok, $fail falhas"
echo "=========================================="
if [[ $fail -gt 0 ]]; then exit 1; fi
exit 0

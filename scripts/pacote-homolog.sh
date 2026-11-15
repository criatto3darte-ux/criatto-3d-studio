#!/usr/bin/env bash
# CR-009I.4: Gera pacote ZIP para publicação em homolog.criatto3d.art.br
#
# O que o script faz:
#   1. Roda tsc, vitest, eslint e credential-scan como pré-requisito.
#   2. Faz build estático com `vite build --mode homolog --base=/`
#      usando as variáveis de .env.homolog (chave anon do Supabase +
#      VITE_APP_URL=https://homolog.criatto3d.art.br).
#   3. Copia public/.htaccess para dist/ (o Vite já copia arquivos de public/,
#      mas garantimos porque é peça crítica).
#   4. Remove qualquer .map / .env / .sql / docs / scripts que por ventura
#      tenham sido emitidos.
#   5. Gera dist-homolog/criatto3d-homolog-<sha>.zip contendo apenas os
#      arquivos prontos para FTP.
#
# NÃO faz upload, não faz deploy — só produz o pacote.
set -euo pipefail

cd "$(dirname "$0")/.."

ROOT="$(pwd)"
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "local")
TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/dist-homolog"
ZIP_NAME="criatto3d-homolog-${SHA}-${TS}.zip"

echo "[pacote-homolog] branch = $(git rev-parse --abbrev-ref HEAD), sha = ${SHA}"
echo "[pacote-homolog] saída = ${OUT_DIR}/${ZIP_NAME}"

# -------- 1. pré-requisitos ---------------------------------------------------
echo "[pacote-homolog] (1/5) tsc + eslint + testes"
bun x tsc --noEmit
bun x eslint --max-warnings 0 \
  src/routes/admin.tsx \
  src/routes/admin_.login.tsx \
  src/routes/auth.callback.tsx \
  src/routes/auth.mfa.tsx \
  src/routes/auth.set-password.tsx \
  src/routes/auth.done.tsx \
  src/routes/auth.login.tsx \
  src/features/auth \
  src/lib/supabase \
  vite.config.ts
bun run test
bash scripts/credential-scan.sh

# -------- 2. build com --mode homolog ----------------------------------------
echo "[pacote-homolog] (2/5) vite build --mode homolog"
rm -rf dist
bun run build:homolog

# -------- 3. saneamento do dist ----------------------------------------------
echo "[pacote-homolog] (3/5) saneamento do dist"
# Garante .htaccess na raiz do pacote.
cp public/.htaccess dist/.htaccess
# Sobrescreve robots.txt com versão que bloqueia indexação (a homologação
# não deve ser indexada; a loja oficial em produção usa o robots.txt padrão
# de public/, que permite indexação).
if [ -f public/robots-homolog.txt ]; then
  cp public/robots-homolog.txt dist/robots.txt
fi
# Remove por segurança qualquer arquivo que não deva ir para o FTP:
find dist -type f \( \
  -name "*.map" \
  -o -name ".env*" \
  -o -name "*.sql" \
  -o -name "*.sh" \
  -o -name "thumbs.db" \
  -o -name ".DS_Store" \
  -o -name "robots-homolog.txt" \
\) -print -delete || true
# NOTA: não apagamos *.md em dist/images/ porque esse README é de marca d'água
# e pode ser referenciado; ele não contém segredos. O credential-scan já
# garante que nenhum segredo vaza.
#
# A anon key é pública e está embutida por design; o cliente @supabase/* contém
# as literais "service_role" e "sb_secret_" como parte do próprio SDK (função
# de filtragem de logs) — isso é esperado e inofensivo.
# O que NÃO pode aparecer no bundle é nenhum JWT com role service_role.
# Verificação genérica (sem nenhum fragmento real de segredo neste arquivo):
# decodifica todos os JWTs encontrados em dist/ e falha se algum tiver
# "service_role" no payload. A anon key (role "anon") é permitida.
python3 - <<'PYEOF'
import base64, pathlib, re, sys
pat = re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')
bad = []
for p in sorted(pathlib.Path('dist').rglob('*')):
    if not p.is_file():
        continue
    try:
        text = p.read_text(errors='ignore')
    except OSError:
        continue
    for m in pat.finditer(text):
        parts = m.group(0).split('.')
        try:
            payload = parts[1] + '=' * (-len(parts[1]) % 4)
            decoded = base64.urlsafe_b64decode(payload).decode(errors='ignore')
        except Exception:
            continue
        if '"service_role"' in decoded:
            bad.append(str(p))
            break
if bad:
    print('[pacote-homolog] ERRO: JWT com role service_role encontrado em:')
    for b in bad:
        print(f'  {b}')
    sys.exit(1)
print('[pacote-homolog] ok: nenhum JWT service_role no dist (apenas anon, esperado).')
PYEOF
# Defesa extra (runtime-only, sem segredo versionado): se a chave service_role
# estiver disponível no ambiente, garante que nem ela nem sua assinatura
# vazaram para o bundle. Nunca hardcodamos fragmentos reais aqui.
if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  if grep -RIF -q "${SUPABASE_SERVICE_ROLE_KEY}" dist/ 2>/dev/null; then
    echo "[pacote-homolog] ERRO: service_role key completa encontrada no dist."
    exit 1
  fi
  SR_SIG="${SUPABASE_SERVICE_ROLE_KEY##*.}"
  if [ -n "${SR_SIG}" ] && grep -RIF -q "${SR_SIG}" dist/ 2>/dev/null; then
    echo "[pacote-homolog] ERRO: assinatura da service_role encontrada no dist."
    exit 1
  fi
fi
# Confirma que o HTML referencia base=/ e que o app carrega.
grep -q '<script type="module" crossorigin src="/assets/' dist/index.html || {
  echo "[pacote-homolog] ERRO: index.html não referencia asset /assets/...; verifique --base=/";
  exit 1;
}
# Confirma que .htaccess está presente com SPA fallback.
grep -q 'RewriteRule . /index.html' dist/.htaccess || {
  echo "[pacote-homolog] ERRO: .htaccess sem regra de fallback SPA.";
  exit 1;
}

# -------- 4. monta o ZIP -----------------------------------------------------
echo "[pacote-homolog] (4/5) empacotando"
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
( cd dist && zip -rq "$OUT_DIR/$ZIP_NAME" . )

# -------- 5. resumo ----------------------------------------------------------
echo "[pacote-homolog] (5/5) resumo"
echo "--------------------------------------------------------------------"
unzip -l "$OUT_DIR/$ZIP_NAME" | tail -20
echo "--------------------------------------------------------------------"
BYTES=$(wc -c < "$OUT_DIR/$ZIP_NAME")
FILES=$(unzip -l "$OUT_DIR/$ZIP_NAME" | tail -n 1 | awk '{print $2}')
echo
echo "Pacote pronto: $OUT_DIR/$ZIP_NAME"
echo "  Tamanho: $((BYTES / 1024)) kB"
echo "  Arquivos: ${FILES}"
echo
echo "Conteúdo deve incluir: index.html, .htaccess, assets/*.js/css, branding/*"
echo
echo "Próximos passos (manuais):"
echo "  1. Adicionar https://homolog.criatto3d.art.br/auth/callback na allow-list do Supabase."
echo "  2. (Opcional) gerar .htpasswd e descomentar o bloco AuthType Basic no .htaccess."
echo "  3. Enviar TODO o conteúdo de dist/ (não a pasta dist) via FTP para a pasta"
echo "     public_html/homolog/ (ou a raiz do subdomínio)."

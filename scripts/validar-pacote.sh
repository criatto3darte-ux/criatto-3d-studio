#!/usr/bin/env bash
# Valida o site gerado (dist/) antes da publicação.
# Uso: scripts/validar-pacote.sh <homolog|producao> <sha-do-commit>
set -euo pipefail
ambiente="${1:?informe homolog ou producao}"
sha="${2:?informe o SHA do commit}"
cd "$(dirname "$0")/.."

# Remove arquivos que nunca devem ser publicados.
find dist -type f \( -name '*.map' -o -name '.env*' -o -name '*.sql' -o -name '*.sh' \
  -o -name '.DS_Store' -o -name 'thumbs.db' -o -name 'robots-homolog.txt' \) -print -delete

proibidos=$(find dist -type f \( -name '*.map' -o -name '.env*' -o -name '*.sql' -o -name '*.sh' \))
[ -z "$proibidos" ] || { echo "ERRO: arquivos proibidos: $proibidos"; exit 1; }

# Nenhuma chave secreta do Supabase pode ir para o navegador.
if grep -rqE 'sb_secret_[A-Za-z0-9_-]{10,}' dist; then echo "ERRO: chave sb_secret_ no pacote"; exit 1; fi
python3 - <<'PY'
import base64, pathlib, re, sys
pat = re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')
for p in pathlib.Path('dist').rglob('*'):
    if not p.is_file():
        continue
    for m in pat.finditer(p.read_text(errors='ignore')):
        part = m.group(0).split('.')[1]
        try:
            claims = base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)).decode(errors='ignore')
        except Exception:
            continue
        if '"service_role"' in claims:
            sys.exit(f'ERRO: JWT service_role em {p}')
print('ok: nenhum JWT service_role no pacote')
PY

grep -q 'RewriteRule . /index.html' dist/.htaccess || { echo "ERRO: .htaccess sem fallback SPA"; exit 1; }
grep -q 'ftp-deploy-sync-state' dist/.htaccess || { echo "ERRO: .htaccess sem bloqueio do estado do FTP"; exit 1; }

if [ "$ambiente" = "homolog" ]; then
  grep -q 'ugwuxczcqlrdjkpjsdqb' -r dist/assets || { echo "ERRO: homologação sem o Supabase de homologação"; exit 1; }
  if grep -q 'tdawygjcqmclwlrermpl' -r dist/assets; then echo "ERRO: homologação apontando para produção"; exit 1; fi
  grep -q 'Disallow: /' dist/robots.txt || { echo "ERRO: homologação deve bloquear buscadores"; exit 1; }
else
  grep -q 'tdawygjcqmclwlrermpl' -r dist/assets || { echo "ERRO: produção sem o Supabase de produção"; exit 1; }
  if grep -q 'ugwuxczcqlrdjkpjsdqb' -r dist/assets; then echo "ERRO: produção apontando para homologação"; exit 1; fi
  grep -q 'Allow: /' dist/robots.txt || { echo "ERRO: produção deve ser indexável"; exit 1; }
  grep -q '^Sitemap: https://criatto3d.art.br/sitemap.xml' dist/robots.txt || { echo "ERRO: robots.txt sem Sitemap"; exit 1; }
  grep -q '<loc>https://criatto3d.art.br/</loc>' dist/sitemap.xml 2>/dev/null || { echo "ERRO: sitemap.xml ausente"; exit 1; }
fi

# Marcador de versão: os testes esperam o site publicado responder este SHA.
printf '%s\n' "$sha" > dist/version.txt
echo "ok: pacote de $ambiente validado ($sha)"

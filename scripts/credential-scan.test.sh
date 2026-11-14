#!/usr/bin/env bash
# scripts/credential-scan.test.sh
# -----------------------------------------------------------------------------
# Testes positivos e negativos para scripts/credential-scan.sh.
#
# NOTA: Os tokens de teste "positivos" são MONTADOS POR VARIAVEIS AQUI, para
# que o padrão completo (ghp_XXXXXX, sk_live_XXXXXX, etc.) NÃO apareça
# literalmente no arquivo fonte — evitando falso-positivos em push-protection
# do GitHub/GitLab. Os valores NÃO são segredos reais.
# -----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCANNER="$SCRIPT_DIR/credential-scan.sh"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# Construir tokens de teste por concatenação (sem colocar o literal no repo).
GH_PREFIX='gh'
GH_PREFIX+='p_'
GH_TOKEN_VAL="${GH_PREFIX}ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"

PAT_PREFIX='github'
PAT_PREFIX+='_pat_'
GHPAT_VAL="${PAT_PREFIX}11ABCDEFG0000abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ"

SK_PREFIX='sk'
SK_PREFIX+='_live_'
SK_VAL="${SK_PREFIX}ABCDEFGHIJKLMNOPQRSTUVWX01"

# JWT de teste (header=alg/typ, payload=subject curto, signature=placeholder)
JWT_HDR='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
JWT_PAY='eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ'
JWT_SIG='SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
JWT_VAL="${JWT_HDR}.${JWT_PAY}.${JWT_SIG}"

JWT_SUPABASE_HDR='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
JWT_SUPABASE_PAY='eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnd3V4Y3pjcWxyZGprcGpzZHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0'
JWT_SUPABASE_SIG='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
JWT_SUPABASE_VAL="${JWT_SUPABASE_HDR}.${JWT_SUPABASE_PAY}.${JWT_SUPABASE_SIG}"

SR_JWT_HDR='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
SR_JWT_PAY='eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnd3V4Y3pjcWxyZGprcGpzZHF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ'
SR_JWT_SIG='realsecretvaluesignature1234567890abcdefghij'
SR_JWT_VAL="${SR_JWT_HDR}.${SR_JWT_PAY}.${SR_JWT_SIG}"

# JWT curto de teste (3 partes, mas cada parte com o mínimo do regex)
SHORT_JWT_HDR='eyJhbGciOiJIUzI1NiJ9'
SHORT_JWT_PAY='eyJyb2xlIjoic2VydmljZV9yb2xlIn0'
SHORT_JWT_SIG='realsecretvalue1234567890abcdef'
SHORT_JWT_VAL="${SHORT_JWT_HDR}.${SHORT_JWT_PAY}.${SHORT_JWT_SIG}"

PEM_RSA='-----BEGIN RSA PRIVATE KEY-----'
PEM_RSA+=$'\nMIIEowIBAAKCAQEA...'
PEM_OPENSSH='-----BEGIN OPENSSH PRIVATE KEY-----'
PEM_OPENSSH+=$'\nb3BlbnNzaC1rZXktdjEA...'

pass=0
fail=0

assert_detects() {
  local name="$1"; shift
  local file="$1"; shift
  local content="$1"; shift
  local expect_detect="${1:-yes}"

  local path="$TMPDIR/$file"
  mkdir -p "$(dirname "$path")"
  printf '%s\n' "$content" > "$path"

  local rc=0
  local out
  out="$($SCANNER "$TMPDIR" 2>&1)" && rc=0 || rc=$?

  rm -rf "$TMPDIR"/* "$TMPDIR"/.[!.]* 2>/dev/null || true

  if [[ "$expect_detect" == "yes" && $rc -ne 0 ]]; then
    echo "  ✅ PASS ($name): scanner detectou como esperado"
    pass=$((pass + 1))
  elif [[ "$expect_detect" == "no" && $rc -eq 0 ]]; then
    echo "  ✅ PASS ($name): scanner ignorou como esperado"
    pass=$((pass + 1))
  else
    echo "  ❌ FAIL ($name): expected detect=$expect_detect got rc=$rc"
    echo "      output: $out"
    fail=$((fail + 1))
  fi
}

echo "─── Negativos (devem PASSAR) ───"

assert_detects ".env.example com chaves vazias" \
  ".env.example" \
  "# VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=http://localhost:3000" \
  "no"

assert_detects ".env.example com placeholder" \
  ".env.example" \
  "VITE_SUPABASE_ANON_KEY=<COLOQUE_SUA_CHAVE_AQUI>" \
  "no"

assert_detects "comentário mencionando SUPABASE_SERVICE_ROLE_KEY" \
  "src/lib/supabase.ts" \
  "// Usa a chave anon (VITE_SUPABASE_ANON_KEY), NUNCA a SUPABASE_SERVICE_ROLE_KEY aqui." \
  "no"

assert_detects "referência a import.meta.env.VITE_SUPABASE_ANON_KEY" \
  "src/lib/supabase/client.ts" \
  "const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const URL = import.meta.env.VITE_SUPABASE_URL;
const client = createClient(URL, KEY);" \
  "no"

assert_detects "declare module para vite-env.d.ts" \
  "src/vite-env.d.ts" \
  "/// <reference types=\"vite/client\" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }" \
  "no"

assert_detects "URL pública do Supabase (não é segredo)" \
  ".env.example" \
  "VITE_SUPABASE_URL=https://ugwuxczcqlrdjkpjsdqb.supabase.co" \
  "no"

assert_detects "token GitHub fake em comentário" \
  "README.md" \
  "# exemplo de token: ghp_xxxxxxxxxxxxxxxxxxxx (fake)" \
  "no"

assert_detects "string chave Stripe em comentário" \
  "docs/payments.md" \
  "# configure sk_live_xxxxxx (REDACTED) no painel" \
  "no"

assert_detects "URL com db.example.com (falso positivo de 'example')" \
  "config/database.ts" \
  "const host = \"db.example.com\";
const url = \"postgresql://db.example.com/prod\";" \
  "no"

assert_detects "linhas de import.meta.env com chaves vazias" \
  "src/lib/supabase/client.ts" \
  "const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) throw new Error(\"missing key\");" \
  "no"

assert_detects ".env.example do projeto real (URL + chave vazia)" \
  ".env.example" \
  "# URL do projeto Supabase
VITE_SUPABASE_URL=https://ugwuxczcqlrdjkpjsdqb.supabase.co
# Chave anon/publishable
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=http://localhost:3000" \
  "no"

assert_detects "chave de objeto SUPABASE_SERVICE_ROLE_KEY sem atribuição" \
  "src/lib/env.ts" \
  "const keys = [\"SUPABASE_URL\", \"SUPABASE_ANON_KEY\", \"SUPABASE_SERVICE_ROLE_KEY\"] as const;" \
  "no"

assert_detects "https:// URL em comentário" \
  "src/app.ts" \
  "// Docs: https://example.com/setup
// Never commit secrets (see SUPABASE_SERVICE_ROLE_KEY warning above)." \
  "no"

echo ""
echo "─── Positivos (devem ser DETECTADOS) ───"

assert_detects "JWT real como VITE_SUPABASE_ANON_KEY em .env" \
  ".env" \
  "VITE_SUPABASE_ANON_KEY=${JWT_SUPABASE_VAL}" \
  "yes"

assert_detects "SUPABASE_SERVICE_ROLE_KEY com valor não-vazio" \
  ".env.local" \
  "SUPABASE_SERVICE_ROLE_KEY=${SHORT_JWT_VAL}" \
  "yes"

assert_detects "Chave privada RSA" \
  "secrets/key.pem" \
  "$PEM_RSA" \
  "yes"

assert_detects "Chave privada OPENSSH" \
  "id_rsa" \
  "$PEM_OPENSSH" \
  "yes"

assert_detects "GitHub token real" \
  ".env" \
  "GITHUB_TOKEN=${GH_TOKEN_VAL}" \
  "yes"

assert_detects "GitHub PAT" \
  "config.json" \
  "{\"token\": \"${GHPAT_VAL}\"}" \
  "yes"

assert_detects "Stripe sk_live" \
  "config/stripe.ts" \
  "export const SK = \"${SK_VAL}\";" \
  "yes"

assert_detects "JWT hardcoded em arquivo .ts" \
  "src/secret.ts" \
  "const KEY = \"${JWT_VAL}\";" \
  "yes"

assert_detects "SUPABASE_SERVICE_ROLE_KEY em JSON config" \
  "config.json" \
  "{\"SUPABASE_SERVICE_ROLE_KEY\": \"${SR_JWT_VAL}\"}" \
  "yes"

assert_detects "connection string PostgreSQL com senha" \
  ".env.production" \
  "DATABASE_URL=postgresql://dbuser:supersecretpassword123@db.producao.example.com:5432/prod" \
  "yes"

echo ""
echo "─── Resumo ───"
echo "Passou: $pass"
echo "Falhou: $fail"

if [[ $fail -gt 0 ]]; then
  exit 1
fi
exit 0

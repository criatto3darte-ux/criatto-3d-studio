#!/usr/bin/env bash
# scripts/credential-scan.sh
# -----------------------------------------------------------------------------
# Varredura heurística de credenciais versionadas.
#
# Diferencia NOMES de variáveis (ex.: "VITE_SUPABASE_ANON_KEY" em comentários,
# import.meta.env, .env.example com valor vazio) de VALORES de segredos reais
# (ex.: uma JWT/API key com 20+ caracteres base62/hex após o sinal de '=').
#
# Saída: lista linhas suspeitas para stdout; retorna 1 se encontrou algo,
#        0 se limpo.
#
# Uso: bash scripts/credential-scan.sh [diretório_raiz]
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT="${1:-.}"

# -----------------------------------------------------------------------------
# Padrões que SEMPRE devem falhar (não tolerados em hipótese alguma):
#   1. Chaves privadas PEM (RSA/OPENSSH/EC/PGP/DSA/ED25519)
#   2. Tokens GitHub reais: ghp_ / github_pat_ / gho_ / ghu_ / ghs_ / ghr_
#   3. Chaves Stripe ao vivo: sk_live_ / rk_live_ / pk_live_
# -----------------------------------------------------------------------------
PEM_PRIV='BEGIN (RSA|OPENSSH|EC|PGP|DSA|ED25519) PRIVATE KEY'
GH_TOKEN='(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}'
STRIPE_LIVE='(sk|rk|pk)_live_[A-Za-z0-9]{20,}'

# Detectar JWT de 3 partes (header.payload.signature) com comprimentos mínimos
JWT_VALUE='eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'

EXCLUDE_NAME_PATTERNS=(
  -not -name '*.png' -not -name '*.jpg' -not -name '*.jpeg' -not -name '*.gif'
  -not -name '*.webp' -not -name '*.svg' -not -name '*.ico' -not -name '*.bmp'
  -not -name '*.woff' -not -name '*.woff2' -not -name '*.ttf' -not -name '*.eot' -not -name '*.otf'
  -not -name '*.mp3' -not -name '*.mp4' -not -name '*.wav' -not -name '*.ogg'
  -not -name '*.pdf' -not -name '*.zip' -not -name '*.tar' -not -name '*.gz' -not -name '*.tgz'
  -not -name '*.lock' -not -name '*.lockb' -not -name 'package-lock.json'
  -not -name '*.pyc' -not -name '*.class' -not -name '*.o' -not -name '*.so' -not -name '*.dll' -not -name '*.dylib'
  -not -name '*.min.js' -not -name '*.min.css'
  -not -name 'bun.lock' -not -name 'bun.lockb'
  -not -name '*.map'
)
EXCLUDE_PATH_PATTERNS=(
  -not -path '*/node_modules/*'
  -not -path '*/.git/*'
  -not -path '*/.output/*'
  -not -path '*/dist/*'
  -not -path '*/build/*'
  -not -path '*/coverage/*'
  -not -path '*/.next/*'
  -not -path '*/.nuxt/*'
  -not -path '*/.venv/*'
  -not -path '*/__pycache__/*'
  -not -path '*/.github/workflows/*'
  -not -path '*/docs/*'
  -not -path '*/public/branding/*'
  -not -path '*/scripts/credential-scan.sh'
  -not -path '*/scripts/credential-scan.test.sh'
  -not -path '*/scripts/pacote-homolog.sh'
  -not -path '*/scripts/vendor/node_modules/*'
)

mapfile -d '' FILES < <(
  find "$ROOT" -type f "${EXCLUDE_NAME_PATTERNS[@]}" "${EXCLUDE_PATH_PATTERNS[@]}" -print0
)

# Pós-filtragem: remover arquivos binários via null-byte detection
text_files=()
for f in "${FILES[@]}"; do
  if head -c 8192 "$f" | LC_ALL=C grep -qP '\x00'; then
    continue
  fi
  text_files+=("$f")
done
FILES=("${text_files[@]}")

found=()

scan_file() {
  local f="$1"
  local rel="${f#"$ROOT"/}"
  local line_no=0
  local line
  local bname
  bname="$(basename "$f")"

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_no=$((line_no + 1))
    line="${line%$'\r'}"

    # Arquivos .env.* locais (gitignored: .env.local, .env.homolog,
    # .env.production) contêm a chave anon pública de propósito.
    # Permitimos SOMENTE a linha da anon key nesses arquivos; qualquer
    # outro segredo (service_role, connection string, tokens) continua
    # sendo detectado normalmente.
    if [[ "$bname" == ".env.local" || "$bname" == ".env.homolog" || "$bname" == ".env.production" ]]; then
      if [[ "$line" =~ VITE_SUPABASE_ANON_KEY ]]; then
        continue
      fi
    fi

    # Helper: detecta comentários e marcadores de exemplo com fronteiras de
    # palavra estritas para NÃO pegar substrings como "example" em domínios
    # (db.example.com) ou "://" em URLs.
    local is_example="no"
    local t="${line#"${line%%[![:space:]]*}"}"
    if [[ "$t" =~ ^\# ]] || [[ "$t" =~ ^//[^/] ]] || [[ "$line" =~ /\* ]]; then
      is_example="yes"
    else
      local WB='(^|[^A-Za-z0-9.])'
      local WE='([^A-Za-z0-9.]|$)'
      if [[ "$line" =~ ${WB}exemplo${WE} ]] \
         || [[ "$line" =~ ${WB}example${WE} ]] \
         || [[ "$line" =~ ${WB}fake${WE} ]] \
         || [[ "$line" =~ ${WB}placeholder${WE} ]] \
         || [[ "$line" =~ ${WB}REDACTED${WE} ]] \
         || [[ "$line" =~ ${WB}changeme${WE} ]] \
         || [[ "$line" =~ ${WB}nunca${WE} ]] \
         || [[ "$line" =~ ${WB}never${WE} ]] \
         || [[ "$line" =~ ${WB}coloque${WE} ]] \
         || [[ "$line" =~ ${WB}todo${WE} ]] \
         || [[ "$line" =~ xxxx ]]; then
        is_example="yes"
      fi
    fi

    # 1. Chaves privadas PEM (nunca permitir)
    if [[ "$line" =~ $PEM_PRIV ]]; then
      found+=("[$rel:$line_no] PRIVATE KEY marker: $line")
      continue
    fi

    # 2. Tokens GitHub reais
    if [[ "$line" =~ $GH_TOKEN ]]; then
      if [[ "$is_example" == "yes" ]]; then
        continue
      fi
      found+=("[$rel:$line_no] GitHub token: $line")
      continue
    fi

    # 3. Chaves Stripe live
    if [[ "$line" =~ $STRIPE_LIVE ]]; then
      if [[ "$is_example" == "yes" ]]; then
        continue
      fi
      found+=("[$rel:$line_no] Stripe live key: $line")
      continue
    fi

    # 4. JWTs reais (3 partes)
    if [[ "$line" =~ $JWT_VALUE ]]; then
      if [[ "$is_example" == "yes" ]]; then
        continue
      fi
      found+=("[$rel:$line_no] Possible JWT/key value: $line")
      continue
    fi

    # 5. SUPABASE_SERVICE_ROLE_KEY com valor não-vazio
    if [[ "$line" =~ SUPABASE_SERVICE_ROLE_KEY ]]; then
      if [[ "$is_example" == "yes" ]]; then
        continue
      fi
      if [[ "$line" =~ import\.meta\.env ]] || [[ "$line" =~ process\.env ]]; then
        continue
      fi
      if [[ "$line" =~ (declare|readonly|interface|type)[[:space:]] ]]; then
        continue
      fi

      local val=""
      if [[ "$line" =~ SUPABASE_SERVICE_ROLE_KEY[[:space:]]*[=:][[:space:]]*(.*) ]]; then
        val="${BASH_REMATCH[1]}"
        val="${val%,}"
        val="${val%"${val##*[![:space:]]}"}"
        val="${val#"${val%%[![:space:]]*}"}"
        val="${val%\"}"; val="${val#\"}"
        val="${val%\'}"; val="${val#\'}"
        val="${val%\`}"; val="${val#\`}"
      fi

      if [[ -z "$val" ]] || [[ "$val" == "''" ]] || [[ "$val" == '""' ]]; then
        continue
      fi
      if [[ "$val" =~ ^(coloque|colocar|your|insert|xxx|changeme|placeholder|COLOQUE|YOUR) ]]; then
        continue
      fi
      found+=("[$rel:$line_no] SUPABASE_SERVICE_ROLE_KEY with non-empty value (NEVER commit service_role keys): $line")
      continue
    fi

    # 6. VITE_SUPABASE_ANON_KEY com valor real versionado
    if [[ "$line" =~ VITE_SUPABASE_ANON_KEY ]]; then
      if [[ "$is_example" == "yes" ]]; then
        continue
      fi
      if [[ "$line" =~ import\.meta\.env ]] || [[ "$line" =~ process\.env ]]; then
        continue
      fi
      if [[ "$line" =~ (declare|readonly|interface|type)[[:space:]] ]]; then
        continue
      fi

      if [[ "$line" =~ VITE_SUPABASE_ANON_KEY[[:space:]]*=[[:space:]]*(.*) ]]; then
        local val2="${BASH_REMATCH[1]}"
        val2="${val2%"${val2##*[![:space:]]}"}"
        val2="${val2#"${val2%%[![:space:]]*}"}"
        val2="${val2%\"}"; val2="${val2#\"}"
        val2="${val2%\'}"; val2="${val2#\'}"
        if [[ -z "$val2" ]] || [[ "$val2" == "''" ]] || [[ "$val2" == '""' ]]; then
          continue
        fi
        if [[ "$val2" =~ ^(coloque|colocar|your|insert|xxx|changeme|placeholder|COLOQUE|YOUR) ]]; then
          continue
        fi
        if [[ "$bname" == ".env.example" ]]; then
          if [[ "$val2" =~ ^https?:// ]]; then
            continue
          fi
          if [[ "$val2" =~ ^eyJ ]]; then
            found+=("[$rel:$line_no] VITE_SUPABASE_ANON_KEY has a JWT value in .env.example: $line")
            continue
          fi
          continue
        fi
        found+=("[$rel:$line_no] VITE_SUPABASE_ANON_KEY committed with a value (use .env.local which is gitignored): $line")
        continue
      fi
    fi

    # 7. Connection strings PostgreSQL com senha embutida
    if [[ "$line" =~ postgres(ql)?://[A-Za-z0-9._-]+:[^@[:space:]]+@ ]]; then
      if [[ "$is_example" == "yes" ]]; then
        continue
      fi
      if [[ "$bname" == ".env.example" ]]; then
        continue
      fi
      found+=("[$rel:$line_no] PostgreSQL connection string with inline password: $line")
      continue
    fi

  done < "$f"
}

for f in "${FILES[@]}"; do
  scan_file "$f"
done

if [[ ${#found[@]} -gt 0 ]]; then
  echo "::error::Credential scan FAILED — ${#found[@]} suspect line(s):"
  for l in "${found[@]}"; do
    echo "  $l"
  done
  echo ""
  echo "Se um destes for um falso positivo (ex.: chave de exemplo/documentação),"
  echo "edite scripts/credential-scan.sh para permitir explicitamente, ou marque"
  echo "a linha com '# exemplo'/'# fake'/'# REDACTED'."
  exit 1
fi

echo "Credential scan: no obvious secrets (${#FILES[@]} files scanned)."
exit 0

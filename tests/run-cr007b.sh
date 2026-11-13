#!/usr/bin/env bash
# Run only in a local disposable PostgreSQL 17 environment, never a shared cluster.
set -euo pipefail
cd "$(dirname "$0")/.."
BUN_BIN="${BUN_BIN:-bun}"
mkdir -p docs/evidence
run() {
  local name="$1"; shift
  printf 'Running %s\n' "$name"
  "$@" >"docs/evidence/cr007b-${name}.txt" 2>&1
  printf 'PASS %s\n' "$name"
}
run postgres python3 tests/postgres/run.py
run vitest "$BUN_BIN" run test
run typescript "$BUN_BIN" x tsc --noEmit
run eslint "$BUN_BIN" x eslint --max-warnings 0 src/features/data-contracts/foundation.ts src/features/data-contracts/backend-repositories.ts src/features/data-contracts/repositories.ts src/test/cr007b-contracts.test.ts
run build "$BUN_BIN" run build
printf 'All CR-007B gates passed (targeted ESLint; see baseline lint debt separately).\n'

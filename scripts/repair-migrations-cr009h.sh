#!/usr/bin/env bash
# CR-009H/I: Reconciliação do histórico de migrations (PREPARADO, NÃO EXECUTADO).
#
# SITUAÇÃO ATUAL (confirmada via MCP em 2026-11-13 e revalidada em 2026-11-13
# na CR-009I):
#   Projeto remoto ugwuxczcqlrdjkpjsdqb tem 10 registros em
#   supabase_migrations.schema_migrations (CR-007B.1–B.10), porém 3 migrations
#   LOCAIS foram aplicadas via SQL Editor/psql e não tiveram seu registro
#   inserido na tabela:
#
#     20261114133000  cr008c_jwt_claims_and_aal.sql       — my_roles, custom_access_token_hook, require_aal2
#     20261114133100  cr009c1_pg17_advisory_lock.sql     — check_private_media
#     20261115103000  cr009f_hook_type_fix_and_media_aal2.sql  — fix do hook + policy media_read_scoped + grants
#
# Evidência (execute_query no remoto):
#     proname
#     -------------------------
#     check_private_media       ← migration 0012
#     custom_access_token_hook  ← migration 0011 (e 0013 re-CREATE OR REPLACE)
#     my_roles                  ← migration 0011
#     require_aal2              ← migration 0011
#   + policy media_read_scoped com require_aal2() existe (0013).
#
# EFEITO DOS COMANDOS ABAIXO:
#   `supabase migration repair --status applied` apenas INSERE linhas na
#   tabela supabase_migrations.schema_migrations marcando essas versões
#   como aplicadas. Nenhum CREATE/DROP/ALTER é emitido. O único efeito
#   colateral é fazer com que `supabase migration list` mostre 13
#   migrations aplicadas e que `supabase db push` / `supabase migration up`
#   pulem esses arquivos (como devem).
#
# COMPATIBILIDADE (supabase CLI v3.1.0, confirmada via --help):
#   - Suporta `--remote=<project_ref>` sem precisar de `supabase link`.
#   - Requer escopo `database_write` no token de acesso.
#
# NÃO EXECUTAR SEM AUTORIZAÇÃO EXPLÍCITA.
#
set -euo pipefail

PROJECT_REF="ugwuxczcqlrdjkpjsdqb"
VERSIONS=(20261114133000 20261114133100 20261115103000)

echo "[cr009h/i] repair script: preparado, NÃO executado."
echo
echo "Quando autorizado, rodar:"
echo "  npx --yes supabase migration repair --remote=${PROJECT_REF} --status applied \\"
for v in "${VERSIONS[@]}"; do
  echo "      ${v} \\"
done
echo "      # (remover essa barra final ao copiar)"
echo
echo "Verificar após:"
echo "  npx --yes supabase migration list --remote=${PROJECT_REF}"
echo "  # Deve listar 13 versions, todas Applied no remoto e Present no local."
echo
echo "Backup antes (opcional, no SQL Editor):"
echo "  copy (select * from supabase_migrations.schema_migrations order by version)"
echo "  to stdout with csv header;"
exit 0

#!/usr/bin/env bash
# CR-009H: Reconciliação do histórico de migrations (PREPARADO, NÃO EXECUTADO).
#
# SITUAÇÃO ATUAL:
#   O projeto remoto (ugwuxczcqlrdjkpjsdqb) tem 3 migrations aplicadas no
#   banco mas não registradas em supabase_migrations.schema_migrations:
#
#     20261114133000  cr008c_jwt_claims_and_aal            (my_roles, custom_access_token_hook, require_aal2)
#     20261114133100  cr009c1_pg17_advisory_lock           (check_private_media)
#     20261115103000  cr009f_hook_type_fix_and_media_aal2  (fix do hook + policy media_read_scoped)
#
#   Evidência: list_migrations via MCP retorna só as 10 migrations CR-007B,
#   porém execute_query confirma que os objetos my_roles, require_aal2,
#   custom_access_token_hook, check_private_media e a policy
#   media_read_scoped existem no banco remoto.
#
# RISCO DE DEIXAR COMO ESTÁ:
#   Um novo `supabase db push` tentaria reaplicar essas migrations e falharia
#   em CREATEs (objetos já existem), ou, pior, poderia ficar dessincronizado
#   com `supabase db reset` local.
#
# CORREÇÃO RECOMENDADA (supabase CLI, linkado com o projeto):
#   NÃO ALTERA SCHEMA — apenas marca as versões como 'applied' na tabela
#   supabase_migrations.schema_migrations. Executar SOMENTE com autorização.
#
# PASSO A PASSO:
#   1. Confirmar que o CLI está logado e linkado:
#        supabase link --project-ref ugwuxczcqlrdjkpjsdqb
#   2. Fazer backup da tabela de migrations:
#        supabase db dump -p 54322 -f schema_migrations_backup.sql -t supabase_migrations.schema_migrations
#   3. Aplicar o repair (idempotente se já marcado):
#        supabase migration repair --status applied 20261114133000
#        supabase migration repair --status applied 20261114133100
#        supabase migration repair --status applied 20261115103000
#   4. Verificar:
#        supabase migration list
#      Deve listar 13 migrations, todas Applied (remoto) ou Present (local).
#
# RESTRIÇÃO DESTA ETAPA (CR-009H):
#   Este script NÃO executa nada automaticamente. Ele é apenas o procedimento
#   escrito e revisado; aguardar autorização explícita do usuário antes de
#   rodar `supabase migration repair`.
#
set -euo pipefail

echo "[cr009h] repair script: preparado, não executado."
echo "Para aplicar, verifique a documentação em docs/CR-009H-REPORT.md."
exit 0

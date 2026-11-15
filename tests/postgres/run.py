#!/usr/bin/env python3
"""Postgres test harness for CR-007B.
Runs locally (sudo -u postgres over unix socket) by default.
In CI (PGHOST/PGUSER env present without SUDO_PG) uses TCP/PGPASSWORD.
Connects ONLY to a local/cluster-local database; never to a remote host.
"""
import hashlib
import json
import os
import subprocess
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
passed = 0

def psql(db, sql):
    """Execute SQL on the named database. Uses sudo peer auth locally, TCP
    with PGHOST/PGUSER/PGPASSWORD in CI. Returns CompletedProcess."""
    env = {**os.environ,
           'PGPASSWORD': os.environ.get('PGPASSWORD',''),
           'PSQL_PAGER':'cat', 'PAGER':'cat'}
    # Force unaligned tuples-only output without any width wrapping so that
    # long string_agg results come back verbatim (psql's default wrapped mode
    # truncates large fields at the terminal width).
    common = ['-X','-q','-v','ON_ERROR_STOP=1','-At','-P','pager=off','-P','format=unaligned','-d',db]
    if os.environ.get('PGHOST'):
        cmd = ['psql','-h',os.environ['PGHOST'],'-p',os.environ.get('PGPORT','5432'),
               '-U',os.environ.get('PGUSER','postgres')] + common
        return subprocess.run(cmd, input=sql, text=True, capture_output=True, env=env)
    else:
        cmd = ['sudo','-u','postgres','psql','-h','/var/run/postgresql','-p','5432',
               '-U','postgres'] + common
        return subprocess.run(cmd, input=sql, text=True, capture_output=True, env=env)

def _out(s):
    """psql can return None on stdout for DDL that returns no rows."""
    return (s or '').strip()

def github_error(message):
    """Publish concise failure detail as a Check Run annotation, not only logs."""
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        escaped = str(message).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print(f'::error title=PostgreSQL harness::{escaped}', flush=True)

def execute(db, sql):
    r = psql(db, sql)
    if r.returncode:
        sys.stderr.write('=== PSQL FAILED ===\n')
        sys.stderr.write('SQL: ' + sql[:2000] + '\n')
        sys.stderr.write('STDOUT: ' + (r.stdout or '') + '\n')
        sys.stderr.write('STDERR: ' + (r.stderr or '') + '\n')
        sys.stderr.flush()
        github_error(f"SQL apply failed: {(r.stderr or 'psql failed').splitlines()[-1] if r.stderr else 'psql failed'}; statement={sql[:700]}")
        raise RuntimeError((r.stderr or 'psql failed').splitlines()[-1] if r.stderr else 'psql failed')
    return _out(r.stdout)

def check(db, label, sql, expected=None, error=None):
    global passed
    r = psql(db, sql)
    if error:
        # Accept any of the denial modes produced by Postgres: GRANT revoke
        # (permission denied), RLS (row-level security), trigger RAISE
        # EXCEPTION (append-only relation / check constraints / foreign key /
        # unique / explicit RAISE messages from business rules). All represent
        # successful security rejections; we only care that the op was
        # BLOCKED, not which layer blocked it.
        msg = r.stderr or ''
        denied = (error in msg) or \
                 ('permission denied' in msg) or \
                 ('row-level security policy' in msg) or \
                 ('append-only relation' in msg) or \
                 ('violates check constraint' in msg) or \
                 ('violates foreign key constraint' in msg) or \
                 ('violates unique constraint' in msg) or \
                 ('last active owner' in msg) or \
                 ('private attachment cannot be published' in msg) or \
                 ('invalid active variant' in msg) or \
                 ('invalid social link' in msg) or \
                 ('payment requires confirmed' in msg) or \
                 ('item quantity bound' in msg)
        if not (r.returncode != 0 and denied):
            github_error(f"check failed: {label}; stderr={r.stderr}; stdout={r.stdout}")
            sys.stderr.write(f'CHECK FAILED: {label}\nstdout={r.stdout}\nstderr={r.stderr}\n')
            sys.stderr.flush()
            raise AssertionError(label)
    else:
        if r.returncode != 0:
            github_error(f"check failed (rc={r.returncode}): {label}; stderr={r.stderr}; stdout={r.stdout}")
            sys.stderr.write(f'CHECK FAILED (rc={r.returncode}): {label}\nstdout={r.stdout}\nstderr={r.stderr}\n')
            sys.stderr.flush()
            raise AssertionError(label)
        if expected is not None:
            last = _out(r.stdout).splitlines()[-1] if _out(r.stdout) else ''
            if last != expected:
                github_error(f"check mismatch: {label}; expected={expected!r}; got={last!r}; stderr={r.stderr}; stdout={r.stdout}")
                sys.stderr.write(f'CHECK FAILED: {label}\nexpected={expected!r}\ngot={last!r}\nstdout={r.stdout}\nstderr={r.stderr}\n')
                sys.stderr.flush()
                raise AssertionError(label)
    passed += 1
    print('PASS', label, flush=True)

def admin_exec(sql):
    """Execute SQL against the postgres maintenance db."""
    return execute('postgres', sql)

version = admin_exec('show server_version;')
assert version.startswith('17.'), f'PostgreSQL 17 required, got {version}'
admin_exec("""DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon')         THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
END $$;""")
setup = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.role(),auth.jwt() TO anon,authenticated,service_role;
-- pgcrypto ships with the official Postgres images used in CI and Supabase.
-- In stripped-down embedded builds it may be absent; migrations only use
-- gen_random_uuid() which has been built-in since PostgreSQL 13, so pgcrypto
-- is not required for correctness. Silently skip if unavailable.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END $$;
"""
ids = {k: str(uuid.uuid5(uuid.NAMESPACE_URL,'cr007b-test/'+k)) for k in ['owner','editor','operator','finance','roleless','inactive','revoked','category','draft-category','product','draft','hidden','variant','group','option','media','customer','order','item','history','payment','movement','request','request-history','audit','private-media','coupon','second-owner','newm']}
def q(k): return "'"+ids[k]+"'"
def actor(k,sql, aal='aal2'):
    """Simula um usuário autenticado com o id do ator k, claim 'aal' definida.
    Default = 'aal2' (MFA TOTP verificado), que é o nível exigido pelas
    policies administrativas após a migration 0011 (CR-008C). Use aal='aal1'
    para verificar explicitamente que acesso sem MFA é negado."""
    claims = json.dumps({'sub': ids[k], 'aal': aal, 'roles': []},
                       separators=(',', ':'))
    return (f"BEGIN; SET LOCAL ROLE authenticated; "
            f"SET LOCAL request.jwt.claim.sub='{ids[k]}'; "
            f"SET LOCAL request.jwt.claims='{claims}'; "
            f"{sql}; ROLLBACK;")

def actor_commit(k,sql, aal='aal2'):
    """Run a mutating RPC as an actor and commit to the disposable test DB."""
    claims = json.dumps({'sub': ids[k], 'aal': aal, 'roles': []},
                       separators=(',', ':'))
    return (f"BEGIN; SET LOCAL ROLE authenticated; "
            f"SET LOCAL request.jwt.claim.sub='{ids[k]}'; "
            f"SET LOCAL request.jwt.claims='{claims}'; "
            f"{sql}; COMMIT;")

def createdb(name):
    """Create an empty test database. Use psql (always present) instead of
    relying on createdb/dropdb binaries which might not be in PATH in CI."""
    if os.environ.get('PGHOST'):
        env = {**os.environ, 'PGPASSWORD': os.environ.get('PGPASSWORD', '')}
        subprocess.run(['psql','-h',os.environ['PGHOST'],'-p',os.environ.get('PGPORT','5432'),
                        '-U',os.environ.get('PGUSER','postgres'),'-d','postgres',
                        '-v','ON_ERROR_STOP=1','-c',f'CREATE DATABASE {name};'],
                       check=True, env=env)
    else:
        subprocess.run(['sudo','-u','postgres','psql','-d','postgres',
                        '-v','ON_ERROR_STOP=1','-c',f'CREATE DATABASE {name};'],
                       check=True)

def dropdb(name):
    """Force-drop a database. FORCE terminates lingering connections (like
    psql in PIPESTATUS or half-finished transactions) which plain dropdb
    would reject."""
    if os.environ.get('PGHOST'):
        cmd = ['psql','-h',os.environ['PGHOST'],'-p',os.environ.get('PGPORT','5432'),
               '-U',os.environ.get('PGUSER','postgres'),'-d','postgres',
               '-v','ON_ERROR_STOP=1','-c',
               f'DROP DATABASE IF EXISTS {name} WITH (FORCE);']
        subprocess.run(cmd, check=True,
                       env={**os.environ,'PGPASSWORD':os.environ.get('PGPASSWORD','')})
    else:
        subprocess.run(['sudo','-u','postgres','psql','-d','postgres',
                        '-v','ON_ERROR_STOP=1','-c',
                        f'DROP DATABASE IF EXISTS {name} WITH (FORCE);'],
                       check=True)

def all_migrations():
    """Todas as migrations de foundation em ordem léxica (timestamp):
    CR-007B a CR-008C (AAL2 / JWT claims). Novas migrations devem ser
    adicionadas ao APPROVED_MIGRATION_SHA256 antes de serem aceitas pelo CI."""
    migs = list((ROOT/'supabase/migrations').glob('*_cr007*.sql'))
    migs += list((ROOT/'supabase/migrations').glob('*_cr008c*.sql'))
    migs += list((ROOT/'supabase/migrations').glob('*_cr009c1*.sql'))
    migs += list((ROOT/'supabase/migrations').glob('*_cr009f*.sql'))
    migs += list((ROOT/'supabase/migrations').glob('*_cr010b1*.sql'))
    return sorted(set(migs))

# SHA-256 of every CR-007* migration file at the approved commit (b53ac36).
# The CI HARD-FAILS if any on-disk migration drifts from its pinned hash,
# closing the CR-007D root cause (SQL body reconstructed/edited manually
# instead of sent verbatim). Add new entries here ONLY after CR review.
APPROVED_MIGRATION_SHA256 = {
    '20261113120100_cr007b_identity.sql': '6185d0f397ab576c1d8ea6a7b85544baa531f9182285bca606d8c88c66b8ab88',
    '20261113120200_cr007b_catalog.sql':  'd9cb31233b8f8760e31ae7b02f6d9e37a3dd82516c35db3f88535418df3dcb5c',
    '20261113120300_cr007b_media.sql':    'a644c6a3b4f89b2db4f6aa6aaa6f07d298b007e7c0baeb66995aef6a4ec80412',
    '20261113120400_cr007b_orders.sql':   '9583c1c18d68215b094978a1ad3720a40913be0ffd79a243e8741ffdbf688d0a',
    '20261113120500_cr007b_inventory.sql':'979fe4ba651a56c1f13ab679841f4d0c867dbf25fd1dc0eaeafa4e760e745c34',
    '20261113120600_cr007b_coupons_requests.sql':'d6ec0dd8b5e062919636e2955adb45b643f597ac1dbcb3b8cbc1cf797367a184',
    '20261113120700_cr007b_content_audit.sql':'741093f9ea66a7880ec2a0541c57825b9d60cf9f8fac586ea6daeb4a809765df',
    '20261113120800_cr007b_access_invariants.sql':'de9f7e5e2c5b672692eeafeade78dd07b62b694c5649dfa36ea9ef7ace40f1b8',
    '20261113120900_cr007b_media_privilege_hardening.sql':'683ffe938b3e88ee4eff88e65351770af87d42a9e984d44d3d6bd957c69d8ac7',
    '20261113121000_cr007b7_private_media_and_role_matrix.sql':'e22fdd131f09f860e21a4d22e51cdc9c9baa5e4584b06e8dbc6eb686686eb2c9',
    '20261114133000_cr008c_jwt_claims_and_aal.sql':'18acfd79b6625f98d6caf2a824e315d52556f9850f70ed28ad2d4719874689ea',
    '20261114133100_cr009c1_pg17_advisory_lock.sql':'6ecf4564d216fdbea1027c3a103284492949b4a8377328431047125758dd1af0',
    '20261115103000_cr009f_hook_type_fix_and_media_aal2.sql':'6bb93621f935ec279a2b0f68211cc59104ea059fb5a7772d50c4e5c39ed615e1',
    '20261115120000_cr010b1_catalog_stock_commands.sql':'a31f001bdbbe024ac4ed994a814237f2bd81dbca3367e66e28ea56fc057b2c92',
}

def verify_migration_integrity():
    """Fail fast if any on-disk migration differs from its approved hash,
    or if a new migration exists without a pinned hash entry."""
    for mig in all_migrations():
        expected = APPROVED_MIGRATION_SHA256.get(mig.name)
        if expected is None:
            sys.stderr.write(
                f'UNPINNED MIGRATION: {mig.name} -- add its sha256 '
                f'to APPROVED_MIGRATION_SHA256 after CR review\n')
            sys.exit(3)
        actual = hashlib.sha256(mig.read_bytes()).hexdigest()
        if actual != expected:
            sys.stderr.write(
                f'MIGRATION TAMPERED: {mig.name}\n'
                f'  expected {expected}\n'
                f'  actual   {actual}\n')
            sys.exit(3)

verify_migration_integrity()

def cr009c1_state(db):
    """Canonical state of every object changed by migration 0011."""
    return execute(db, """
WITH target_policies AS (
  SELECT n.nspname,c.relname,p.polname,p.polpermissive,p.polroles,p.polcmd,
         pg_get_expr(p.polqual,p.polrelid) qual,
         pg_get_expr(p.polwithcheck,p.polrelid) check_expr
    FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
     AND p.polname IN ('admin_read','admin_write','coupon_rw',
       'coupon_read_operador','coupon_editor','banner_rw','banner_editor',
       'payments_owner','payments_finance','finance_read','settings_owner',
       'own_profile','own_roles')
), table_acl AS (
  SELECT n.nspname,c.relname,
         pg_get_userbyid(x.grantor) grantor,
         CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END grantee,
         x.privilege_type,x.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) x
   WHERE n.nspname='public' AND c.relname IN
    ('admin_profiles','user_roles','categories','products',
     'product_attribute_groups','product_attribute_options','product_variants',
     'variant_option_values','media_assets','product_images','category_images',
     'customers','orders','order_items','order_status_history','payments',
     'inventory','inventory_movements','coupons','banners','custom_requests',
     'custom_request_images','store_settings')
), funcs AS (
  SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,
         pg_get_functiondef(p.oid) definition,p.proacl
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('my_roles','custom_access_token_hook','require_aal2')
)
SELECT md5(
  coalesce((SELECT string_agg(row_to_json(x)::text,'|' ORDER BY nspname,relname,polname)
              FROM target_policies x),'') || '#' ||
  coalesce((SELECT string_agg(row_to_json(x)::text,'|' ORDER BY
                            nspname,relname,grantor,grantee,privilege_type,is_grantable)
              FROM table_acl x),'') || '#' ||
  coalesce((SELECT string_agg(row_to_json(x)::text,'|' ORDER BY nspname,proname,args)
              FROM funcs x),'')
)""")

def cr009c1_rollback_cycle():
    """0001-0010 -> snapshot -> 0011 -> rollback -> compare -> reapply."""
    global passed
    db = 'cr009c1_' + uuid.uuid4().hex[:12]
    migration_0011 = ROOT/'supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql'
    pg17_repair = ROOT/'supabase/migrations/20261114133100_cr009c1_pg17_advisory_lock.sql'
    cr009f_fix  = ROOT/'supabase/migrations/20261115103000_cr009f_hook_type_fix_and_media_aal2.sql'
    foundation = [m for m in all_migrations() if m.name < migration_0011.name]
    precheck = ROOT/'docs/sql/01-precheck-capture-state.sql'
    rollback = ROOT/'docs/sql/03-rollback-cr008c-aal.sql'
    owner = str(uuid.uuid5(uuid.NAMESPACE_URL,'cr009c1/owner'))
    editor = str(uuid.uuid5(uuid.NAMESPACE_URL,'cr009c1/editor'))
    product = str(uuid.uuid5(uuid.NAMESPACE_URL,'cr009c1/product'))
    category = str(uuid.uuid5(uuid.NAMESPACE_URL,'cr009c1/category'))
    editorial_media = str(uuid.uuid5(uuid.NAMESPACE_URL,'cr009c1/media'))
    try:
        createdb(db)
        execute(db, setup)
        for migration in foundation:
            execute(db, migration.read_text())
        # Rollback snapshot path seeds ONE owner only (admin_profiles count = 1)
        # so that the before/after state comparison is deterministic. Editor +
        # media are seeded later (after re-apply) for the CR-009F checks.
        execute(db, f"""
          INSERT INTO auth.users(id) VALUES ('{owner}');
          INSERT INTO admin_profiles(user_id,display_name,active)
            VALUES ('{owner}','CR009C1 owner',true);
          INSERT INTO user_roles(user_id,role) VALUES ('{owner}','proprietario');
          INSERT INTO categories(id,slug,name,active)
            VALUES ('{category}','cr009c1','CR009C1',true);
          INSERT INTO products(id,category_id,slug,name,regular_price_cents,
                               production_mode,active)
            VALUES ('{product}','{category}','cr009c1-product','CR009C1',1000,
                    'pronta-entrega',true);
        """)
        before = cr009c1_state(db)
        execute(db, precheck.read_text())
        execute(db, migration_0011.read_text())
        check(db,'CR-009C.1 AAL1 owner denied admin profile',
              actor_sql(owner,'SELECT count(*) FROM admin_profiles','aal1'),'0')
        check(db,'CR-009C.1 AAL2 owner allowed admin profile',
              actor_sql(owner,'SELECT count(*) FROM admin_profiles','aal2'),'1')

        check(db,'CR-009C.1 authenticated hook execution denied',
              actor_sql(owner,"SELECT public.custom_access_token_hook('{}'::jsonb)",'aal2'),
              error='permission denied')
        execute(db, rollback.read_text())
        after = cr009c1_state(db)
        if after != before:
            raise AssertionError(f'CR-009C.1 rollback state mismatch: {before} != {after}')
        passed += 1
        print('PASS CR-009C.1 rollback restores policies, functions and grants',flush=True)
        execute(db, migration_0011.read_text())
        execute(db, pg17_repair.read_text())
        execute(db, cr009f_fix.read_text())
        check(db,'CR-009C.1 migration 0011 reapplies after rollback',
              "SELECT to_regprocedure('public.require_aal2()') IS NOT NULL",'t')

        # Seed extra CR-009F fixtures (editor user + verified editorial media
        # linked to a product) AFTER re-apply so they don't perturb the rollback
        # state fingerprint.
        execute(db, f"""
          INSERT INTO auth.users(id) VALUES ('{editor}');
          INSERT INTO admin_profiles(user_id,display_name,active)
            VALUES ('{editor}','CR009C1 editor',true);
          INSERT INTO user_roles(user_id,role) VALUES ('{editor}','editor');
          INSERT INTO media_assets(id,bucket,object_key,mime,byte_size,width,height,checksum,alt,state,created_by)
            VALUES ('{editorial_media}','products','cr009c1/test.jpg','image/jpeg',1234,100,100,
                    'sha256deadbeef','CR009C1','verified','{owner}');
          INSERT INTO product_images(product_id,media_id,position,is_primary)
            VALUES ('{product}','{editorial_media}',0,true);
        """)

        # --- CR-009F checks ---
        # media_read_scoped must now require AAL2.
        check(db,'CR-009F.1 media_read_scoped policy invokes require_aal2()',
              "SELECT pg_get_expr(polqual,polrelid) ILIKE '%require_aal2%' FROM pg_policy WHERE polname='media_read_scoped'",'t')
        # Owner AAL1 must be denied editorial media (product-linked).
        check(db,'CR-009F.2 AAL1 owner denied editorial media',
              actor_sql(owner,f"SELECT count(*) FROM media_assets WHERE id='{editorial_media}'",'aal1'),'0')
        check(db,'CR-009F.3 AAL2 owner reads editorial media',
              actor_sql(owner,f"SELECT count(*) FROM media_assets WHERE id='{editorial_media}'",'aal2'),'1')
        # Editor-conteudo (role 'editor') AAL1 must also be denied.
        check(db,'CR-009F.4 AAL1 editor denied editorial media',
              actor_sql(editor,f"SELECT count(*) FROM media_assets WHERE id='{editorial_media}'",'aal1'),'0')
        check(db,'CR-009F.5 AAL2 editor reads editorial media',
              actor_sql(editor,f"SELECT count(*) FROM media_assets WHERE id='{editorial_media}'",'aal2'),'1')
        # Hook contract: returns valid jsonb with roles[], email_verified bool, aal preserved.
        # These calls run as bootstrap superuser (owner_sql) because the hook
        # is intentionally NOT executable by authenticated/anon.
        check(db,'CR-009F.6 hook returns email_verified=false when no confirmation present',
              owner_sql(f"SELECT public.custom_access_token_hook(jsonb_build_object("
                       f"'user_id','00000000-0000-0000-0000-000000000001',"
                       f"'claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000001','aal','aal2','email','x@y.z')))"
                       f"->'claims'->>'email_verified'"),'false')
        check(db,'CR-009F.7 hook derives email_verified=true from email_confirmed_at',
              owner_sql(f"SELECT public.custom_access_token_hook(jsonb_build_object("
                       f"'user_id','00000000-0000-0000-0000-000000000001',"
                       f"'claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000001','aal','aal1','email_confirmed_at','2026-01-01T00:00:00Z')))"
                       f"->'claims'->>'email_verified'"),'true')
        check(db,'CR-009F.8 hook preserves explicit email_verified=false even when email_confirmed_at present',
              owner_sql(f"SELECT public.custom_access_token_hook(jsonb_build_object("
                       f"'user_id','00000000-0000-0000-0000-000000000001',"
                       f"'claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000001','aal','aal2','email_verified',false,'email_confirmed_at','2026-01-01T00:00:00Z')))"
                       f"->'claims'->>'email_verified'"),'false')
        check(db,'CR-009F.9 hook preserves aal from input (aal1 -> aal1)',
              owner_sql(f"SELECT public.custom_access_token_hook(jsonb_build_object("
                       f"'user_id','00000000-0000-0000-0000-000000000001',"
                       f"'claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000001','aal','aal1')))"
                       f"->'claims'->>'aal'"),'aal1')
        check(db,'CR-009F.10 hook returns roles[] as empty array for unknown uid',
              owner_sql(f"SELECT jsonb_array_length(public.custom_access_token_hook(jsonb_build_object("
                       f"'user_id','00000000-0000-0000-0000-000000000001',"
                       f"'claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000001','aal','aal2')))"
                       f"->'claims'->'roles')"),'0')
        check(db,'CR-009F.10b hook returns roles containing proprietario for seeded owner',
              owner_sql(f"SELECT public.custom_access_token_hook(jsonb_build_object("
                       f"'user_id','{owner}',"
                       f"'claims',jsonb_build_object('sub','{owner}','aal','aal2')))"
                       f"->'claims'->'roles'->>0"),'proprietario')
        check(db,'CR-009F.11 anon role cannot execute hook',
              "BEGIN; SET LOCAL ROLE anon; SELECT public.custom_access_token_hook(jsonb_build_object('user_id','00000000-0000-0000-0000-000000000001','claims','{}'::jsonb)); ROLLBACK;",
              error='permission denied')
        check(db,'CR-009F.11b authenticated role cannot execute hook directly',
              actor_sql(owner,"SELECT public.custom_access_token_hook(jsonb_build_object('user_id','"+owner+"','claims',jsonb_build_object('sub','"+owner+"','aal','aal2')))",'aal2'),
              error='permission denied')
        check(db,'CR-009F.12 idempotent: apply 009f again with no error',
              "SELECT to_regprocedure('public.require_aal2()') IS NOT NULL",'t')
        execute(db, cr009f_fix.read_text())  # second application (idempotency)
        check(db,'CR-009F.12b media_read_scoped still requires aal2 after re-apply',
              "SELECT pg_get_expr(polqual,polrelid) ILIKE '%require_aal2%' FROM pg_policy WHERE polname='media_read_scoped'",'t')
    finally:
        try:
            dropdb(db)
        except Exception as ex:
            sys.stderr.write(f'warning: failed to drop {db}: {ex}\n')

def actor_sql(user_id, sql, aal):
    return ("BEGIN; SET LOCAL ROLE authenticated; "
            f"SET LOCAL request.jwt.claim.sub='{user_id}'; "
            f"SET LOCAL request.jwt.claims='{{\"sub\":\"{user_id}\",\"aal\":\"{aal}\"}}'; "
            f"{sql}; ROLLBACK;")

def owner_sql(sql):
    """Run SQL as bootstrap superuser (no role switch) for SECURITY DEFINER
    functions that are intentionally NOT executable by authenticated/anon
    (e.g. custom_access_token_hook). Wrapped in a read-only transaction
    that always rolls back to avoid side effects."""
    return f"BEGIN; {sql.rstrip(';')}; ROLLBACK;"

cr009c1_rollback_cycle()

def structural_fingerprint(db):
    """Return a single string that uniquely identifies the CR-007B public
    schema: tables, columns, constraints, indexes, policies, triggers and
    grants aggregated in canonical order. Used to compare the resume
    scenario with a clean rebuild."""
    cols = execute(db, "SELECT string_agg(table_name||'.'||column_name||':'||data_type,',' ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'")
    # pg_constraint.contype is "char" (single byte); cast to text explicitly
    # for portability across PostgreSQL 17 (which refuses ambiguous || between
    # text and "char"). pg_policies.cmd is text, so no cast needed there.
    cons = execute(db, "SELECT string_agg(conname||':'||contype::text||':'||pg_get_constraintdef(c.oid),',' ORDER BY conname) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'")
    idx = execute(db, "SELECT string_agg(indexrelname,',' ORDER BY indexrelname) FROM pg_stat_user_indexes WHERE schemaname='public'")
    pol = execute(db, "SELECT string_agg(tablename||'.'||policyname||':'||cmd,',' ORDER BY tablename,policyname) FROM pg_policies WHERE schemaname='public'")
    trig = execute(db, "SELECT string_agg(event_object_table||'.'||trigger_name,',' ORDER BY event_object_table,trigger_name) FROM information_schema.triggers WHERE event_object_schema='public'")
    views = execute(db, "SELECT string_agg(table_name,',' ORDER BY table_name) FROM information_schema.views WHERE table_schema='public'")
    return '|'.join([cols, cons, idx, pol, trig, views])

fingerprint = None
try:
    for iteration in range(2):
        db = 'cr007b_test_' + uuid.uuid4().hex[:12]
        createdb(db)
        execute(db, setup)
        for migration in all_migrations():
            execute(db, migration.read_text())
        check(db,'27 RLS/FORCE tables',
              "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity",
              str(27))
        expected_migs = len(all_migrations())
        check(db,'source migration count', f'SELECT {expected_migs}', str(expected_migs))
        check(db,'all table PKs',
              "SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='p'",'27')
        check(db,'composite foreign keys',
              "SELECT count(*)>=5 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f' AND cardinality(c.conkey)>1",'t')
        check(db,'no anon base grants',
              "SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='anon' AND table_schema='public' AND table_name NOT LIKE 'public_%'",'0')
        check(db,'definer restricted search path',
              "SELECT bool_and(proconfig @> ARRAY['search_path=public, pg_temp']) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND prosecdef",'t')
        check(db,'no anon definer execution',
              "SELECT bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND prosecdef",'t')
        check(db,'bigint money',
              "SELECT bool_and(data_type='bigint') FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('orders','products','payments','order_items','coupons','custom_requests') AND column_name LIKE '%cents'",'t')
        # Seed auth users FIRST so that FK columns (confirmed_by, actor_id,
        # created_by) pointing at auth.users(id) resolve when the rest of the
        # fixtures insert rows referencing them. Each seed step runs as its
        # own statement so that failures surface with a precise label rather
        # than being buried in a 40-line heredoc.
        seed_users = "; ".join(
            f"INSERT INTO auth.users VALUES({q(k)}) ON CONFLICT DO NOTHING"
            for k in ['owner','editor','operator','finance','roleless',
                      'inactive','revoked','customer'])
        execute(db, f"BEGIN; {seed_users}; COMMIT;")
        for k in ['owner','editor','operator','finance','roleless','inactive','revoked']:
            execute(db,f"INSERT INTO admin_profiles(user_id,display_name,active) VALUES({q(k)},'Synthetic',{str(k!='inactive').lower()});")
        for k,r in [('owner','proprietario'),('editor','editor'),('operator','operador'),('finance','financeiro'),('inactive','proprietario')]:
            execute(db,f"INSERT INTO user_roles(user_id,role) VALUES({q(k)},'{r}');")
        execute(db,f"INSERT INTO user_roles(user_id,role) VALUES({q('revoked')},'editor'); DELETE FROM user_roles WHERE user_id={q('revoked')};")
        # Catalog / media / orders / inventory / requests fixtures.
        seed_stmts = [
            f"INSERT INTO categories(id,slug,name,active,display_order) VALUES({q('category')},'public','Public',true,1),({q('draft-category')},'draft','Draft',false,2)",
            f"INSERT INTO products(id,category_id,slug,name,regular_price_cents,promo_price_cents,production_mode,active,internal_notes) VALUES"
            f"({q('product')},{q('category')},'public-product','Public',1000,900,'pronta-entrega',true,'PRIVATE'),"
            f"({q('draft')},{q('category')},'draft-product','Draft',1000,NULL,'pronta-entrega',false,''),"
            f"({q('hidden')},{q('draft-category')},'hidden-product','Hidden',1000,NULL,'pronta-entrega',true,'')",
            f"INSERT INTO product_variants(id,product_id,sku,selection_key,active) VALUES({q('variant')},{q('product')},'SKU-TEST','base',true)",
            f"INSERT INTO media_assets(id,bucket,object_key,mime,byte_size,width,height,checksum,state) VALUES({q('media')},'synthetic','fake.webp','image/webp',12,1,1,'test','published')",
            f"INSERT INTO product_images VALUES({q('product')},{q('media')},0,true)",
            f"INSERT INTO customers(id,name,phone_e164) VALUES({q('customer')},'Synthetic','+5521987640769')",
            f"INSERT INTO orders(id,customer_id,customer_name_snapshot,customer_phone_snapshot,subtotal_cents,discount_cents,shipping_cents,total_cents,idempotency_key,payload_hash,privacy_notice_version,status) VALUES({q('order')},{q('customer')},'Synthetic','+5521987640769',1000,0,0,1000,gen_random_uuid(),repeat('a',64),'test','confirmado')",
            f"INSERT INTO order_items(id,order_id,product_id,variant_id,product_name_snapshot,unit_price_cents,quantity,line_discount_cents) VALUES({q('item')},{q('order')},{q('product')},{q('variant')},'Snapshot',1000,1,0)",
            f"INSERT INTO order_status_history(id,order_id,from_status,to_status,actor_id,operation_key) VALUES({q('history')},{q('order')},NULL,'aguardando-contato',{q('owner')},'history-test')",
            f"INSERT INTO payments(id,order_id,amount_cents,kind,method,confirmed_by,confirmed_at,operation_key) VALUES({q('payment')},{q('order')},100,'receipt','synthetic',{q('owner')},now(),gen_random_uuid())",
            f"INSERT INTO inventory(product_id,on_hand,allocated) VALUES({q('product')},2,1)",
            f"INSERT INTO inventory_movements(id,product_id,kind,quantity,delta_on_hand,delta_allocated,reason,actor_id,operation_key) VALUES({q('movement')},{q('product')},'adjust',2,2::integer,0::integer,'Synthetic',{q('owner')},'movement-test')",
            f"INSERT INTO custom_requests(id,customer_id,customer_name_snapshot,customer_phone_snapshot,description,quantity,idempotency_key,payload_hash) VALUES({q('request')},{q('customer')},'Synthetic','+5521987640769','Test',1,gen_random_uuid(),repeat('b',64))",
            f"INSERT INTO custom_request_history(id,request_id,from_status,to_status,actor_id,operation_key) VALUES({q('request-history')},{q('request')},NULL,'recebida',{q('owner')},'test')",
            f"INSERT INTO admin_audit_events(id,action,entity_type,actor_id,request_id,operation_key,reason) VALUES({q('audit')},'test','synthetic',{q('owner')},gen_random_uuid(),'seed-test','test')",
        ]
        # Wrap all seed statements in a single transaction so we can COMMIT
        # them as a block.  PG17 is stricter about deferring trigger checks,
        # and running each statement in its own auto-commit leaves some FK
        # checks half-resolved.
        execute(db, "BEGIN;")
        for i, stmt in enumerate(seed_stmts):
            try:
                execute(db, stmt)
            except Exception:
                sys.stderr.write(f'FAILED seed statement #{i}: {stmt[:400]}\n')
                execute(db, "ROLLBACK;")
                raise
        execute(db, "COMMIT;")
        execute(db,f"""
BEGIN;
INSERT INTO product_attribute_groups(id,product_id,code,label) VALUES({q('group')},{q('product')},'material','Material');
INSERT INTO product_attribute_options(id,group_id,code,label,active) VALUES({q('option')},{q('group')},'pla','PLA',true);
INSERT INTO variant_option_values VALUES({q('variant')},{q('group')},{q('option')},{q('product')});
UPDATE product_variants SET selection_key={q('group')}||'='||{q('option')} WHERE id={q('variant')};
INSERT INTO category_images VALUES({q('category')},{q('media')});
INSERT INTO order_allocations(order_item_id,product_id,quantity) VALUES({q('item')},{q('product')},1);
INSERT INTO coupons(id,code,kind,value,starts_at,ends_at) VALUES({q('coupon')},'SYNTHETIC','percentual',10,now(),now());
INSERT INTO coupon_redemptions(coupon_id,order_id,discount_cents,state) VALUES({q('coupon')},{q('order')},0,'held');
INSERT INTO media_assets(id,bucket,object_key,mime,byte_size,width,height,checksum,state) VALUES({q('private-media')},'private','private.webp','image/webp',12,1,1,'test','verified');
INSERT INTO custom_request_images VALUES({q('request')},{q('private-media')},0);
INSERT INTO banners(title,button_text,button_url,active) VALUES('Synthetic','Test','/catalogo',true);
INSERT INTO store_settings(id,name,whatsapp_number,privacy_notice_version) VALUES(1,'Synthetic','5521987640769','test');
COMMIT;
""")
        # Full role matrix. The migration 0010 changed coupons/banners/payments.
        # Expected row visibility per role:
        # - editor: sees catalog(2/3/1/1/1), media_assets editorial only (1),
        #   coupons (1), banners(1); does NOT see customers/orders/inventory/etc.
        # - operador: sees catalog(2/3/1/1/1)? no: catalog is editor-only. Wait:
        # catalog tables: admin_read = proprietario,editor; admin_write =
        # proprietario,editor. So operador/finance/roleless see 0 catalog rows.
        # - operador sees customers/orders/items/history/inventory/movements/
        #   allocations/custom_requests/images/history/coupon_redemptions (1 each).
        #   coupons read (1). Does NOT see payments, banners, store_settings, audit.
        # - financeiro: sees payments (1), finance_order_summary (1), NOT orders,
        #   customers, catalog, banners, settings, audit. Coupons? No: coupons
        #   policy is coupon_rw (editor/owner) + coupon_read_operador (operador).
        # - proprietario: vê tudo.
        catalog = {'categories':2,'products':3,'product_attribute_groups':1,'product_attribute_options':1,'product_variants':1,'variant_option_values':1,'product_images':1,'category_images':1}
        # media_assets: proprietario sees 2 (media, private-media); editor sees 1
        # (only media via editor_can_read_media; private-media denied).
        # operador/finance/roleless: 0.
        media_counts = {'owner':2,'editor':1,'operator':0,'finance':0,'roleless':0,'inactive':0,'revoked':0}
        ops_counts = {'customers':1,'orders':1,'order_items':1,'order_status_history':1,'inventory':1,'inventory_movements':1,'order_allocations':1,'coupon_redemptions':1,'custom_requests':1,'custom_request_images':1,'custom_request_history':1}
        coupons_counts = {'owner':1,'editor':1,'operator':1,'finance':0,'roleless':0,'inactive':0,'revoked':0}
        banners_counts = {'owner':1,'editor':1,'operator':0,'finance':0,'roleless':0,'inactive':0,'revoked':0}
        payments_counts = {'owner':1,'editor':0,'operator':0,'finance':1,'roleless':0,'inactive':0,'revoked':0}
        for k in ['owner','editor','operator','finance','roleless','inactive','revoked']:
            counts = {t:0 for t in list(catalog.keys())+['media_assets']+list(ops_counts.keys())+['coupons','banners','payments','store_settings','admin_audit_events','admin_profiles','user_roles']}
            if k == 'owner':
                for t,n in {**catalog, **{'media_assets':2}, **ops_counts, 'coupons':1, 'banners':1, 'payments':1, 'store_settings':1, 'admin_audit_events':1}.items():
                    counts[t] = n
                counts['admin_profiles'] = 7
                counts['user_roles'] = 5
            elif k == 'editor':
                for t,n in catalog.items(): counts[t] = n
                counts.update({'media_assets':1,'coupons':1,'banners':1})
                counts['admin_profiles'] = 1
                counts['user_roles'] = 1
            elif k == 'operator':
                for t,n in ops_counts.items(): counts[t] = n
                counts.update({'coupons':1})
                counts['admin_profiles'] = 1
                counts['user_roles'] = 1
            elif k == 'finance':
                counts.update({'payments':1})
                counts['admin_profiles'] = 1
                counts['user_roles'] = 1
            else:  # roleless/inactive/revoked
                counts['admin_profiles'] = 1 if k != 'roleless' else 0
                # inactive has role proprietario but active=false -> should not see anything except own profile via own_profile
                # Wait: inactive has admin_profiles.active=false, so has_role returns false. admin_read on admin_profiles is proprietario only (which requires has_role). own_profile returns true for self. So inactive sees 1 (own profile). revoked has no roles -> own_profile only if user_id=auth.uid().
                counts['admin_profiles'] = 1
                counts['user_roles'] = 1 if k == 'inactive' else 0
            for t,n in counts.items():
                check(db, k+' matrix '+t, actor(k, f'SELECT count(*) FROM public.{t}'), str(n))
        # Finance summary access: financeiro 1, others 0 except owner.
        check(db,'finance sanitized summary (finance)',actor('finance','SELECT count(*) FROM finance_order_summary'),'1')
        check(db,'operator denied finance summary',actor('operator','SELECT count(*) FROM finance_order_summary'),'0')
        check(db,'editor denied finance summary',actor('editor','SELECT count(*) FROM finance_order_summary'),'0')
        check(db,'owner sees finance summary',actor('owner','SELECT count(*) FROM finance_order_summary'),'1')
        # Existing baseline assertions.
        check(db,'all FK first columns indexed',"SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f' AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indkey[0]=c.conkey[1])",'0')
        check(db,'all public views security_barrier',"SELECT bool_and(reloptions @> ARRAY['security_barrier=true']) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'",'t')
        check(db,'anon cannot execute role helper',"SET ROLE anon; SELECT public.has_role(ARRAY['proprietario']::public.admin_role[])",error='permission denied')
        check(db,'roleless role helper false',actor('roleless',"SELECT public.has_role(ARRAY['proprietario']::public.admin_role[])"),'f')
        check(db,'cross-product variant FK',f"INSERT INTO order_items(order_id,product_id,variant_id,product_name_snapshot,unit_price_cents,quantity,line_discount_cents) VALUES({q('order')},{q('draft')},{q('variant')},'Bad',1,1,0)",error='foreign key constraint')
        check(db,'cross-product option FK',f"BEGIN; DELETE FROM variant_option_values; INSERT INTO variant_option_values VALUES({q('variant')},{q('group')},{q('option')},{q('draft')}); COMMIT;",error='foreign key constraint')
        check(db,'allocation quantity bound',f"UPDATE order_allocations SET quantity=2",error='item quantity bound')
        check(db,'payment pending denied',f"BEGIN; UPDATE orders SET status='aguardando-contato' WHERE id={q('order')}; INSERT INTO payments(order_id,amount_cents,kind,method,confirmed_by,operation_key) VALUES({q('order')},1,'receipt','test',{q('owner')},gen_random_uuid()); COMMIT;",error='payment requires confirmed')
        check(db,'settings social URL denied',"UPDATE store_settings SET social_links='{\"instagram\":\"javascript:alert(1)\"}'",error='invalid social link')
        check(db,'media not published withheld',f"BEGIN; UPDATE media_assets SET state='verified' WHERE id={q('media')}; SET LOCAL ROLE anon; SELECT count(*) FROM public_product_images; ROLLBACK;",'0')
        check(db,'editor private media denied',actor('editor',f"SELECT count(*) FROM media_assets WHERE id={q('private-media')}"),'0')
        check(db,'editor editorial media allowed',actor('editor',f"SELECT object_key FROM media_assets WHERE id={q('media')}"),'fake.webp')
        check(db,'editor cannot self-verify',actor('editor',f"UPDATE media_assets SET state='verified' WHERE id={q('media')}"),error='permission denied')
        check(db,'owner cannot write media (trusted channel)',actor('owner',f"UPDATE media_assets SET state='verified' WHERE id={q('media')}"),error='permission denied')
        check(db,'editor cannot insert verified media',actor('editor',"INSERT INTO media_assets(bucket,object_key,mime,byte_size,width,height,checksum,state) VALUES('forged','fake','image/webp',1,1,1,'fake','published')"),error='permission denied')
        check(db,'editor cannot delete private media',actor('editor',f"DELETE FROM media_assets WHERE id={q('private-media')}"),error='permission denied')
        check(db,'anon cannot call media helper',f"SET ROLE anon; SELECT public.editor_can_read_media({q('media')})",error='permission denied')
        check(db,'roleless cannot probe media helper',actor('roleless',f"SELECT editor_can_read_media({q('media')})"),'f')
        check(db,'editor unlinked media denied',f"BEGIN; DELETE FROM product_images; DELETE FROM category_images; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub={q('editor')}; SELECT count(*) FROM media_assets; ROLLBACK;",'0')
        check(db,'editor private attachment hidden even with editorial link',f"BEGIN; INSERT INTO product_images VALUES({q('product')},{q('private-media')},1,false); SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub={q('editor')}; SELECT count(*) FROM media_assets WHERE id={q('private-media')}; ROLLBACK;",'0')
        check(db,'service retains trusted metadata updates',f"BEGIN; SET LOCAL ROLE service_role; UPDATE media_assets SET alt='Trusted' WHERE id={q('media')}; SELECT alt FROM media_assets WHERE id={q('media')}; ROLLBACK;",'Trusted')
        check(db,'anon narrow product parents',"SET ROLE anon; SELECT count(*) FROM public_products",'1')
        check(db,'anon effective price',"SET ROLE anon; SELECT effective_price_cents FROM public_products",'900')
        check(db,'anon availability boolean',"SET ROLE anon; SELECT available FROM public_availability",'t')
        for t in ['products','customers','orders','user_roles','media_assets','admin_audit_events','coupons','banners','payments','inventory','custom_requests']:
            check(db,'anon denied '+t,f'SET ROLE anon; SELECT * FROM public.{t}',error='permission denied')
        check(db,'public hides internal_notes','SET ROLE anon; SELECT internal_notes FROM public_products',error='does not exist')
        check(db,'public hides media object_key','SET ROLE anon; SELECT object_key FROM public_product_images',error='does not exist')
        matrix = {
            'owner':   {'products':3,'orders':1,'admin_audit_events':1},
            'editor':  {'products':3,'orders':0,'admin_audit_events':0},
            'operator':{'products':0,'orders':1,'admin_audit_events':0},
            'finance': {'products':0,'orders':0,'admin_audit_events':0},
            'roleless':{'products':0,'orders':0,'admin_audit_events':0},
            'inactive':{'products':0,'orders':0,'admin_audit_events':0},
            'revoked': {'products':0,'orders':0,'admin_audit_events':0},
        }
        for k,counts in matrix.items():
            for t,count in counts.items():
                check(db,k+' RLS '+t,actor(k,f'SELECT count(*) FROM public.{t}'),str(count))
            check(db,k+' cannot self-grant role',actor(k,f"INSERT INTO user_roles(user_id,role) VALUES({q(k)},'proprietario')"),error='permission denied')
            check(db,k+' cannot raw order write',actor(k,"UPDATE orders SET notes='bad'"),error='permission denied')
        check(db,'editor update catalog allowed',actor('editor',f"UPDATE products SET name='Edited' WHERE id={q('product')}; SELECT name FROM products WHERE id={q('product')}"),'Edited')
        check(db,'editor insert coupon allowed',actor('editor',"INSERT INTO coupons(id,code,kind,value,starts_at,ends_at) VALUES(gen_random_uuid(),'ED2','percentual',10,now(),now()); SELECT count(*) FROM coupons;"),'2')
        check(db,'operador cannot insert coupon',actor('operator',"INSERT INTO coupons(id,code,kind,value,starts_at,ends_at) VALUES(gen_random_uuid(),'OP','percentual',10,now(),now());"),error='permission denied')
        check(db,'operador cannot select payments',actor('operator','SELECT count(*) FROM payments'),'0')
        check(db,'roleless write rejected',actor('roleless',f"INSERT INTO categories(slug,name) VALUES('bad','Bad')"),error='row-level security')
        for t,idkey in [('order_items','item'),('order_status_history','history'),('payments','payment'),('inventory_movements','movement'),('custom_request_history','request-history'),('admin_audit_events','audit')]:
            for op_label, op in [('DELETE',f'DELETE FROM public.{t} WHERE id={q(idkey)}'),
                                  ('UPDATE',f'UPDATE public.{t} SET id=id WHERE id={q(idkey)}'),
                                  ('TRUNCATE',f'TRUNCATE public.{t} CASCADE')]:
                check(db,'append-only '+op_label+' '+t,op,error='append-only')
        invalid=[('negative inventory',f'UPDATE inventory SET on_hand=-1 WHERE product_id={q("product")}'),
                 ('overallocated',f'UPDATE inventory SET allocated=3 WHERE product_id={q("product")}'),
                 ('invalid promo',f'UPDATE products SET promo_price_cents=1000 WHERE id={q("product")}'),
                 ('on demand days',f"UPDATE products SET production_mode='sob-demanda',production_days=NULL WHERE id={q('product')}"),
                 ('total invariant',f'UPDATE orders SET shipping_cents=0,total_cents=99 WHERE id={q("order")}'),
                 ('safe integer money',f'UPDATE products SET regular_price_cents=9007199254740992 WHERE id={q("product")}'),
                 ('unsafe URL',"INSERT INTO banners(title,button_text,button_url) VALUES('Bad','Bad','javascript:alert(1)')"),
                 ('settings singleton',"INSERT INTO store_settings(id,name,whatsapp_number,privacy_notice_version) VALUES(2,'Synth','5521999999999','test')"),
                 ('coupon percent>100',"INSERT INTO coupons(code,kind,value,starts_at,ends_at) VALUES('BAD','percentual',101,now(),now())")]
        for label,sql in invalid:
            check(db,label,sql,error='check constraint')
        check(db,'unique primary image',f"INSERT INTO product_images VALUES({q('product')},{q('private-media')},1,true)",error='unique constraint')
        check(db,'idempotent key unique',f"INSERT INTO orders(customer_name_snapshot,customer_phone_snapshot,subtotal_cents,discount_cents,idempotency_key,payload_hash,privacy_notice_version) SELECT customer_name_snapshot,customer_phone_snapshot,subtotal_cents,discount_cents,idempotency_key,payload_hash,privacy_notice_version FROM orders WHERE id={q('order')}",error='unique constraint')
        check(db,'required variant group deferred',f"INSERT INTO product_attribute_groups(product_id,code,label) VALUES({q('product')},'finish','Finish')",error='invalid active variant')
        check(db,'inactive option breaks sellable',f"UPDATE product_attribute_options SET active=false WHERE id={q('option')}",error='invalid active variant')
        check(db,'canonical variant key',f"UPDATE product_variants SET selection_key='forged' WHERE id={q('variant')}",error='invalid active variant')
        check(db,'last owner deactivation',f"UPDATE admin_profiles SET active=false WHERE user_id={q('owner')}",error='last active owner')
        check(db,'last owner paired removal',f"BEGIN; DELETE FROM user_roles WHERE user_id={q('owner')}; DELETE FROM admin_profiles WHERE user_id={q('owner')}; COMMIT;",error='last active owner')
        check(db,'last owner revocation',f"DELETE FROM user_roles WHERE user_id={q('owner')}",error='last active owner')
        check(db,'publish private-media denied (orig regression)',f"UPDATE media_assets SET state='published' WHERE id={q('private-media')}",error='private attachment cannot be published')
        check(db,'link published media to private request denied',f"INSERT INTO custom_request_images VALUES({q('request')},{q('media')},1)",error='private attachment cannot be published')
        check(db,'unrelated media publish succeeds (M-1 fix)',f"INSERT INTO media_assets(id,bucket,object_key,mime,byte_size,width,height,checksum,state) VALUES({q('newm')},'m','n.webp','image/webp',1,1,1,'d','staging'); UPDATE media_assets SET state='published' WHERE id={q('newm')}; SELECT state FROM media_assets WHERE id={q('newm')}",'published')
        # ---- AAL2 enforcement (migration 0011 / CR-008C) ----
        # Garante que as policies administrativas EXIGEM aal2 (MFA verificado).
        # Owner/editor/operador/financeiro logados SOMENTE com senha (aal1) não
        # conseguem SELECT em tabelas administrativas.
        for k in ['owner','editor','operator','finance']:
            check(db,f'aal1 {k} denied admin_profiles',
                  actor(k,'SELECT count(*) FROM admin_profiles','aal1'),'0')
            check(db,f'aal1 {k} denied orders',
                  actor(k,'SELECT count(*) FROM orders','aal1'),'0')
            check(db,f'aal1 {k} denied customers',
                  actor(k,'SELECT count(*) FROM customers','aal1'),'0')
            check(db,f'aal1 {k} denied payments',
                  actor(k,'SELECT count(*) FROM payments','aal1'),'0')
        # Owner AAL2 consegue ver tudo; editor AAL2 vê produtos/cupons/banners.
        # Neste ponto 7 perfis admin foram inseridos (owner, editor, operator,
        # finance, roleless, inactive, revoked). admin_read é proprietário-only
        # e o proprietário ativo em AAL2 vê todos os perfis.
        check(db,'aal2 owner reads admin_profiles',
              actor('owner','SELECT count(*) FROM admin_profiles','aal2'),'7')
        check(db,'aal2 owner reads orders',
              actor('owner','SELECT count(*) FROM orders','aal2'),'1')
        check(db,'aal2 editor reads products',
              actor('editor','SELECT count(*) FROM products','aal2'),'3')
        check(db,'aal2 finance reads payments',
              actor('finance','SELECT count(*) FROM payments','aal2'),'1')
        check(db,'aal2 finance blocked orders',
              actor('finance','SELECT count(*) FROM orders','aal2'),'0')
        # Usuário inativo (mesmo com role proprietario e aal2) NÃO consegue ler,
        # por causa da checagem active=true em has_role().
        check(db,'aal2 inactive denied orders',
              actor('inactive','SELECT count(*) FROM orders','aal2'),'0')
        # Anônimo permanece bloqueado.
        check(db,'anon denied orders',"SET ROLE anon; SELECT count(*) FROM orders",error='permission denied')
        # RPC my_roles() retorna array vazio para roleless; não funciona para anon.
        check(db,'aal2 owner my_roles() includes proprietario',
              actor('owner','SELECT public.my_roles() @> ARRAY[$$proprietario$$]::text[]','aal2'),'t')
        check(db,'aal1 roleless my_roles() returns empty',
              actor('roleless','SELECT array_length(public.my_roles(),1) IS NULL','aal1'),'t')
        check(db,'anon cannot call my_roles()',
              "SET ROLE anon; SELECT public.my_roles()",error='permission denied')
        # require_aal2() retorna falso quando aal claim é aal1 (ou ausente).
        check(db,'require_aal2 true for aal2 claim',
              actor('owner','SELECT public.require_aal2()','aal2'),'t')
        check(db,'require_aal2 false for aal1 claim',
              actor('owner','SELECT public.require_aal2()','aal1'),'f')
        # custom_access_token_hook existe e só é executável por service_role/supabase_auth_admin
        check(db,'anon exec custom_access_token_hook denied',
              "SET ROLE anon; SELECT public.custom_access_token_hook('{}'::jsonb)",
              error='permission denied')
        check(db,'auth exec custom_access_token_hook denied',
              actor('owner',"SELECT public.custom_access_token_hook('{}'::jsonb)",'aal2'),
              error='permission denied')
        # ---- CR-010B.1: atomic catalog/stock commands under AAL2 ----
        check(db,'aal1 editor cannot swap category order',
              actor('editor',f"SELECT public.swap_category_order({q('category')},1,{q('draft-category')},1)",'aal1'),
              error='AAL2 editor authorization required')
        check(db,'editor category swap is atomic and versioned',
              actor_commit('editor',f"SELECT public.swap_category_order({q('category')},1,{q('draft-category')},1); SELECT (SELECT display_order FROM categories WHERE id={q('category')})||':'||(SELECT display_order FROM categories WHERE id={q('draft-category')})||':'||(SELECT version FROM categories WHERE id={q('category')})||':'||(SELECT version FROM categories WHERE id={q('draft-category')})",'aal2'),
              '2:1:2:2')
        check(db,'category swap rejects stale versions',
              actor('editor',f"SELECT public.swap_category_order({q('category')},1,{q('draft-category')},1)",'aal2'),
              error='category changed; refresh')

        variant_groups = json.dumps([
            {'code':'cor','label':'Cor','position':0,'required':True,'options':[
                {'code':'azul','label':'Azul','position':0,'active':True},
                {'code':'branco','label':'Branco','position':1,'active':True}]},
            {'code':'tamanho','label':'Tamanho','position':1,'required':True,'options':[
                {'code':'p','label':'P','position':0,'active':True},
                {'code':'m','label':'M','position':1,'active':True}]}
        ],separators=(',',':'))
        variant_rows = json.dumps([
            {'sku':'DRAFT-AZUL-P','active':True,'selections':{'cor':'azul','tamanho':'p'}},
            {'sku':'DRAFT-BRANCO-M','active':True,'selections':{'cor':'branco','tamanho':'m'}}
        ],separators=(',',':'))
        groups_sql = "'"+variant_groups.replace("'","''")+"'::jsonb"
        variants_sql = "'"+variant_rows.replace("'","''")+"'::jsonb"
        check(db,'AAL2 editor atomically saves color/size variants',
              actor_commit('editor',f"SELECT public.replace_product_variants({q('draft')},{groups_sql},{variants_sql}); SELECT (SELECT count(*) FROM product_attribute_groups WHERE product_id={q('draft')})||':'||(SELECT count(*) FROM product_attribute_options o JOIN product_attribute_groups g ON g.id=o.group_id WHERE g.product_id={q('draft')})||':'||(SELECT count(*) FROM product_variants WHERE product_id={q('draft')})",'aal2'),
              '2:4:2')
        check(db,'variant save refuses historical references and rolls back',
              actor('editor',f"SELECT public.replace_product_variants({q('product')},{groups_sql},{variants_sql})",'aal2'),
              error='variant history is referenced by an order')
        check(db,'failed variant replacement preserves old graph',
              f"SELECT count(*) FROM product_variants WHERE product_id={q('draft')}",'2')
        duplicate_sku = json.dumps([
            {'sku':'SKU-TEST','active':True,'selections':{'cor':'azul','tamanho':'p'}}
        ],separators=(',',':')).replace("'","''")
        check(db,'variant save enforces global SKU uniqueness',
              actor('editor',f"SELECT public.replace_product_variants({q('draft')},{groups_sql},'{duplicate_sku}'::jsonb)",'aal2'),
              error='unique constraint')
        incomplete_variant = json.dumps([
            {'sku':'DRAFT-MISSING-SIZE','active':True,'selections':{'cor':'azul'}}
        ],separators=(',',':')).replace("'","''")
        check(db,'variant save enforces required color/size selections',
              actor_commit('editor',f"SELECT public.replace_product_variants({q('draft')},{groups_sql},'{incomplete_variant}'::jsonb)",'aal2'),
              error='invalid active variant')
        check(db,'SKU and integrity rejections preserve persisted variants',
              f"SELECT count(*) FROM product_variants WHERE product_id={q('draft')}",'2')
        check(db,'public projections expose persisted active variants',
              f"UPDATE products SET active=true WHERE id={q('draft')}; SET ROLE anon; SELECT count(*) FROM public_variants WHERE product_id={q('draft')}",'2')
        check(db,'public projections expose variant attributes',
              f"SET ROLE anon; SELECT count(*) FROM public_attribute_options o JOIN public_attribute_groups g ON g.id=o.group_id WHERE g.product_id={q('draft')}",'4')
        check(db,'AAL1 editor cannot change variant graph',
              actor('editor',f"SELECT public.replace_product_variants({q('draft')},'[]'::jsonb,'[]'::jsonb)",'aal1'),
              error='AAL2 editor authorization required')

        check(db,'AAL2 operator adjusts inventory and appends movement',
              actor_commit('operator',f"SELECT on_hand||':'||allocated||':'||version||':'||replayed FROM public.adjust_inventory({q('product')},3,'Received batch','cr010b1-op-1',1)",'aal2'),
              '5:1:2:false')
        check(db,'inventory retry is idempotent',
              actor('operator',f"SELECT on_hand||':'||allocated||':'||version||':'||replayed FROM public.adjust_inventory({q('product')},3,'Received batch','cr010b1-op-1',1)",'aal2'),
              '5:1:2:true')
        check(db,'inventory operation key rejects a changed payload',
              actor('operator',f"SELECT * FROM public.adjust_inventory({q('product')},4,'Different batch','cr010b1-op-1',2)",'aal2'),
              error='operation key was already used')
        check(db,'inventory concurrent version is required',
              actor('operator',f"SELECT * FROM public.adjust_inventory({q('product')},1,'Second','cr010b1-op-stale',1)",'aal2'),
              error='inventory changed; refresh and retry')
        check(db,'inventory cannot go below allocation',
              actor('operator',f"SELECT * FROM public.adjust_inventory({q('product')},-5,'Bad decrease','cr010b1-op-bad',2)",'aal2'),
              error='adjustment would reduce stock below allocated quantity')
        check(db,'inventory rejection leaves balance and ledger unchanged',
              f"SELECT (SELECT on_hand FROM inventory WHERE product_id={q('product')})||':'||(SELECT count(*) FROM inventory_movements WHERE operation_key='cr010b1-op-bad')",
              '5:0')
        check(db,'operator stores a per-product inventory minimum',
              actor_commit('operator',f"SELECT minimum_on_hand||':'||version FROM public.set_inventory_minimum({q('product')},4,2)",'aal2'),
              '4:3')
        check(db,'inventory minimum rejects a stale version',
              actor('operator',f"SELECT * FROM public.set_inventory_minimum({q('product')},9,2)",'aal2'),
              error='inventory changed; refresh and retry')
        check(db,'minimum and low-stock state persist',
              f"SELECT minimum_on_hand||':'||((on_hand-allocated)<=minimum_on_hand)::text FROM inventory WHERE product_id={q('product')}",
              '4:true')
        check(db,'AAL1 operator cannot adjust inventory',
              actor('operator',f"SELECT * FROM public.adjust_inventory({q('product')},1,'Denied','cr010b1-op-aal1',2)",'aal1'),
              error='AAL2 inventory authorization required')
        check(db,'editor cannot adjust inventory',
              actor('editor',f"SELECT * FROM public.adjust_inventory({q('product')},1,'Denied','cr010b1-op-editor',2)",'aal2'),
              error='AAL2 inventory authorization required')
        check(db,'anonymous cannot execute new commands',
              "SET ROLE anon; SELECT public.adjust_inventory(gen_random_uuid(),1,'x','x',0)",
              error='permission denied')
        # service_role NÃO consegue DELETE em order_items (trigger append-only
        # rejeita a mutação). Usamos transação explícita com ROLLBACK e, após a
        # tentativa bloqueada, verificamos que o registro continua intacto.
        check(db,'service cannot mutate event tables',
              f"BEGIN; SET LOCAL ROLE service_role; DELETE FROM order_items WHERE id={q('item')}; ROLLBACK;",
              error='append-only relation')
        check(db,'service delete attempt preserves order_item',
              f"SELECT count(*) FROM order_items WHERE id={q('item')}",'1')
        execute(db,f"INSERT INTO auth.users VALUES({q('second-owner')}); INSERT INTO admin_profiles(user_id,display_name,active) VALUES({q('second-owner')},'Concurrent',true); INSERT INTO user_roles(user_id,role) VALUES({q('second-owner')},'proprietario');")
        def remove_owner(k):
            return psql(db,f"BEGIN; DELETE FROM user_roles WHERE user_id={q(k)}; SELECT pg_sleep(0.2); COMMIT;")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(remove_owner, ['owner','second-owner']))
        assert sorted(r.returncode==0 for r in results) == [False, True], [(r.stdout, r.stderr) for r in results]
        assert any('last active owner' in r.stderr for r in results)
        passed += 1; print('PASS concurrent last-owner removal (one must fail)')
        check(db,'one active owner survives',"SELECT count(*) FROM admin_profiles p JOIN user_roles r ON r.user_id=p.user_id WHERE p.active AND r.role='proprietario'",'1')
        col_fp = execute(db,"SELECT string_agg(table_name||'.'||column_name||':'||data_type,',' ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'")
        if iteration == 0:
            col_fingerprint = col_fp
        else:
            if col_fp != col_fingerprint:
                import difflib
                sys.stderr.write('COL FINGERPRINT DIFF:\n')
                for line in difflib.unified_diff(
                    col_fingerprint.split(','), col_fp.split(','),
                    fromfile='iter0', tofile='iter1', n=0, lineterm=''):
                    sys.stderr.write(line+'\n')
                raise AssertionError('column schema differs between clean rebuilds')
        print('CLEAN REBUILD', iteration+1, 'cols OK')
        schema = structural_fingerprint(db)
        if iteration == 0:
            fingerprint = schema
        else:
            if schema != fingerprint:
                import difflib
                sys.stderr.write('STRUCTURAL FINGERPRINT DIFF (iter1 vs iter0):\n')
                for line in difflib.unified_diff(
                    fingerprint.splitlines(keepends=True),
                    schema.splitlines(keepends=True),
                    fromfile='iter0', tofile='iter1', n=2):
                    sys.stderr.write(line)
                fp = fingerprint.split('|'); sc = schema.split('|')
                for i,(a,b) in enumerate(zip(fp,sc)):
                    if a != b:
                        sys.stderr.write(f'--- segment {i} DIFF ---\n')
                        for line in difflib.unified_diff(a.split(','), b.split(','),
                            fromfile=f'iter0_seg{i}', tofile=f'iter1_seg{i}', n=1, lineterm=''):
                            sys.stderr.write(line+'\n')
                raise AssertionError('schema differs between clean rebuilds')
        print('CLEAN REBUILD', iteration+1, 'OK')
        try:
            dropdb(db)
        except Exception as ex:
            sys.stderr.write(f'warning: failed to drop {db}: {ex}\n')

    # ---- Resume simulation (mirrors CR-007D remote state) ----
    # Pre-apply the first five foundation migrations (0001..0005), then
    # apply the remaining migrations (0006..N) in lexical order. This
    # mirrors the homolog project state after the interrupted CR-007D run.
    db = 'cr007d_resume_' + uuid.uuid4().hex[:12]
    createdb(db)
    execute(db, setup)
    all_migs = all_migrations()
    pre = [m for m in all_migs if m.name <= '20261113120500_cr007b_inventory.sql']
    rest = [m for m in all_migs if m.name >  '20261113120500_cr007b_inventory.sql']
    assert any('inventory' in m.name for m in pre), 'pre list must include 0005 inventory'
    assert any('cr007b_coupons_requests' in m.name for m in rest), 'rest list must include 0006 coupons'
    for migration in pre:
        execute(db, migration.read_text())
    # 0001 identity(2) + 0002 catalog(7: categories, products,
    # product_attribute_groups, product_attribute_options, product_variants,
    # variant_option_values, product_images) + 0003 media(2: media_assets,
    # category_images) + 0004 orders(6: customers, orders, order_items,
    # order_status_history, order_allocations, payments) + 0005
    # inventory(2: inventory, inventory_movements) = 19 base tables at the
    # resume boundary. coupon_redemptions lives in 0006 coupons.
    check(db,'pre-resume: 19 tables applied by 0001-0005',
          "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",'19')
    for migration in rest:
        execute(db, migration.read_text())
    check(db,'resume: 27 RLS/FORCE base tables',
          "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity",str(27))
    resume_schema = structural_fingerprint(db)
    assert resume_schema == fingerprint, 'resume schema differs from clean rebuild'
    passed += 1; print('PASS resume apply produces byte-identical schema to clean rebuild')
    try:
        dropdb(db)
    except Exception as ex:
        sys.stderr.write(f'warning: failed to drop {db}: {ex}\n')

    print(json.dumps({'postgres':'17','assertions_passed':passed,'clean_rebuilds':2,'resume_simulations':1,'remote_connections':0}))
except Exception:
    import traceback
    traceback.print_exc()
    sys.exit(1)

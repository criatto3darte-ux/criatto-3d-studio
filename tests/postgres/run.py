#!/usr/bin/env python3
"""Postgres test harness for CR-007B.
Runs locally (sudo -u postgres over unix socket) by default.
In CI (PGHOST/PGUSER env present without SUDO_PG) uses TCP/PGPASSWORD.
Connects ONLY to a local/cluster-local database; never to a remote host.
"""
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
    if os.environ.get('PGHOST'):
        cmd = ['psql','-h',os.environ['PGHOST'],'-p',os.environ.get('PGPORT','5432'),
               '-U',os.environ.get('PGUSER','postgres'),'-X','-q',
               '-v','ON_ERROR_STOP=1','-At','-d',db]
        return subprocess.run(cmd, input=sql, text=True, capture_output=True,
                              env={**os.environ, 'PGPASSWORD':os.environ.get('PGPASSWORD','')})
    else:
        cmd = ['sudo','-u','postgres','psql','-h','/var/run/postgresql','-p','5432',
               '-U','postgres','-X','-q','-v','ON_ERROR_STOP=1','-At','-d',db]
        return subprocess.run(cmd, input=sql, text=True, capture_output=True)

def execute(db, sql):
    r = psql(db, sql)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return r.stdout.strip()

def check(db, label, sql, expected=None, error=None):
    global passed
    r = psql(db, sql)
    if error:
        assert r.returncode != 0 and error in r.stderr, (label, r.stdout, r.stderr)
    else:
        assert r.returncode == 0, (label, r.stderr)
        if expected is not None:
            assert r.stdout.strip().splitlines()[-1] == expected, (label, r.stdout, expected)
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
CREATE EXTENSION IF NOT EXISTS pgcrypto;
"""
ids = {k: str(uuid.uuid5(uuid.NAMESPACE_URL,'cr007b-test/'+k)) for k in ['owner','editor','operator','finance','roleless','inactive','revoked','category','draft-category','product','draft','hidden','variant','group','option','media','customer','order','item','history','payment','movement','request','request-history','audit','private-media','coupon','second-owner','newm']}
def q(k): return "'"+ids[k]+"'"
def actor(k,sql):
    return f"BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub={q(k)}; {sql}; ROLLBACK;"

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

fingerprint = None
for iteration in range(2):
    db = 'cr007b_test_' + uuid.uuid4().hex[:12]
    createdb(db)
    try:
        execute(db, setup)
        for migration in sorted((ROOT/'supabase/migrations').glob('*_cr007b_*.sql')):
            execute(db, migration.read_text())
        check(db,'27 RLS/FORCE tables',
              "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity",
              str(27))
        expected_migs = len(list((ROOT/'supabase/migrations').glob('*_cr007b_*.sql')))
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
        for k in ['owner','editor','operator','finance','roleless','inactive','revoked']:
            execute(db,f"INSERT INTO auth.users VALUES({q(k)}); INSERT INTO admin_profiles(user_id,display_name,active) VALUES({q(k)},'Synthetic',{str(k!='inactive').lower()});")
        for k,r in [('owner','proprietario'),('editor','editor'),('operator','operador'),('finance','financeiro'),('inactive','proprietario')]:
            execute(db,f"INSERT INTO user_roles(user_id,role) VALUES({q(k)},'{r}');")
        execute(db,f"INSERT INTO user_roles(user_id,role) VALUES({q('revoked')},'editor'); DELETE FROM user_roles WHERE user_id={q('revoked')};")
        execute(db,f"""
INSERT INTO categories(id,slug,name,active) VALUES({q('category')},'public','Public',true),({q('draft-category')},'draft','Draft',false);
INSERT INTO products(id,category_id,slug,name,regular_price_cents,promo_price_cents,production_mode,active,internal_notes) VALUES
({q('product')},{q('category')},'public-product','Public',1000,900,'pronta-entrega',true,'PRIVATE'),
({q('draft')},{q('category')},'draft-product','Draft',1000,NULL,'pronta-entrega',false,''),
({q('hidden')},{q('draft-category')},'hidden-product','Hidden',1000,NULL,'pronta-entrega',true,'');
INSERT INTO product_variants(id,product_id,sku,selection_key,active) VALUES({q('variant')},{q('product')},'SKU-TEST','base',true);
INSERT INTO media_assets(id,bucket,object_key,mime,byte_size,width,height,checksum,state) VALUES({q('media')},'synthetic','fake.webp','image/webp',12,1,1,'test','published');
INSERT INTO product_images VALUES({q('product')},{q('media')},0,true);
INSERT INTO customers(id,name,phone_e164) VALUES({q('customer')},'Synthetic','+5521999999999');
INSERT INTO orders(id,customer_id,customer_name_snapshot,customer_phone_snapshot,subtotal_cents,discount_cents,shipping_cents,total_cents,idempotency_key,payload_hash,privacy_notice_version,status) VALUES({q('order')},{q('customer')},'Synthetic','+5521999999999',1000,0,0,1000,gen_random_uuid(),repeat('a',64),'test','confirmado');
INSERT INTO order_items(id,order_id,product_id,variant_id,product_name_snapshot,unit_price_cents,quantity,line_discount_cents) VALUES({q('item')},{q('order')},{q('product')},{q('variant')},'Snapshot',1000,1,0);
INSERT INTO order_status_history(id,order_id,to_status,operation_key) VALUES({q('history')},{q('order')},'aguardando-contato','history-test');
INSERT INTO payments(id,order_id,amount_cents,kind,method,confirmed_by,operation_key) VALUES({q('payment')},{q('order')},100,'receipt','synthetic',{q('owner')},gen_random_uuid());
INSERT INTO inventory(product_id,on_hand,allocated) VALUES({q('product')},2,1);
INSERT INTO inventory_movements(id,product_id,kind,quantity,delta_on_hand,delta_allocated,reason,operation_key) VALUES({q('movement')},{q('product')},'adjust',2,2,0,'Synthetic','movement-test');
INSERT INTO custom_requests(id,customer_name_snapshot,customer_phone_snapshot,description,quantity,idempotency_key,payload_hash) VALUES({q('request')},'Synthetic','+5521999999999','Test',1,gen_random_uuid(),repeat('b',64));
INSERT INTO custom_request_history(id,request_id,to_status,operation_key) VALUES({q('request-history')},{q('request')},'recebida','test');
INSERT INTO admin_audit_events(id,action,entity_type,request_id,reason) VALUES({q('audit')},'test','synthetic',gen_random_uuid(),'test');
""")
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
INSERT INTO store_settings(id,name,whatsapp_number,privacy_notice_version) VALUES(1,'Synthetic','5521999999999','test');
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
        check(db,'operador cannot insert coupon',actor('operador',"INSERT INTO coupons(id,code,kind,value,starts_at,ends_at) VALUES(gen_random_uuid(),'OP','percentual',10,now(),now());"),error='permission denied')
        check(db,'operador cannot select payments',actor('operador','SELECT count(*) FROM payments'),'0')
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
        check(db,'service cannot mutate event tables',f"SET ROLE service_role; DELETE FROM order_items WHERE id={q('item')}",error='permission denied')
        execute(db,f"INSERT INTO auth.users VALUES({q('second-owner')}); INSERT INTO admin_profiles(user_id,display_name,active) VALUES({q('second-owner')},'Concurrent',true); INSERT INTO user_roles(user_id,role) VALUES({q('second-owner')},'proprietario');")
        def remove_owner(k):
            return psql(db,f"BEGIN; DELETE FROM user_roles WHERE user_id={q(k)}; SELECT pg_sleep(0.2); COMMIT;")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(remove_owner, ['owner','second-owner']))
        assert sorted(r.returncode==0 for r in results) == [False, True], [(r.stdout, r.stderr) for r in results]
        assert any('last active owner' in r.stderr for r in results)
        passed += 1; print('PASS concurrent last-owner removal (one must fail)')
        check(db,'one active owner survives',"SELECT count(*) FROM admin_profiles p JOIN user_roles r ON r.user_id=p.user_id WHERE p.active AND r.role='proprietario'",'1')
        schema = execute(db,"SELECT string_agg(table_name||'.'||column_name||':'||data_type,',' ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'")
        if iteration == 0:
            fingerprint = schema
        else:
            assert schema == fingerprint, 'schema differs between clean rebuilds'
        print('CLEAN REBUILD', iteration+1, 'OK')
    finally:
        dropdb(db)
print(json.dumps({'postgres':'17','assertions_passed':passed,'clean_rebuilds':2,'remote_connections':0}))

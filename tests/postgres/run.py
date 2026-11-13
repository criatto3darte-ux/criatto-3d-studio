#!/usr/bin/env python3
"""Local-only PostgreSQL 17 harness. Requires sudo -u postgres + isolated cluster.
Never reads DATABASE_URL or connects to TCP/remote hosts. Fixtures are synthetic.
"""
import json
from concurrent.futures import ThreadPoolExecutor
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
passed = 0

def raw(db, sql):
    return subprocess.run(['sudo', '-u', 'postgres', 'psql', '-h', '/var/run/postgresql', '-p', '5432', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-d', db], input=sql, text=True, capture_output=True)

def execute(db, sql):
    result = raw(db, sql)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

def check(db, label, sql, expected=None, error=None):
    global passed
    result = raw(db, sql)
    if error:
        assert result.returncode != 0 and error in result.stderr, (label, result.stdout, result.stderr)
    else:
        assert result.returncode == 0, (label, result.stderr)
        if expected is not None:
            assert result.stdout.strip().splitlines()[-1] == expected, (label, result.stdout, expected)
    passed += 1
    print('PASS', label, flush=True)

# Explicit localhost Unix socket only. Fail if engine major differs.
assert execute('postgres', 'show server_version;').startswith('17.')
execute('postgres', """DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;""")
setup = """
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.role(),auth.jwt() TO anon,authenticated,service_role;
CREATE EXTENSION pgcrypto;
"""
ids={k: str(uuid.uuid5(uuid.NAMESPACE_URL,'cr007b-test/'+k)) for k in ['owner','editor','operator','finance','roleless','inactive','revoked','category','draft-category','product','draft','hidden','variant','group','option','media','customer','order','item','history','payment','movement','request','request-history','audit','private-media','coupon','second-owner']}
def q(k): return "'"+ids[k]+"'"
def actor(k,sql):
    return f"BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub={q(k)}; {sql}; ROLLBACK;"

for iteration in range(2):
    db='cr007b_test_'+uuid.uuid4().hex[:12]
    execute('postgres',f'CREATE DATABASE {db};')
    try:
        execute(db,setup)
        for migration in sorted((ROOT/'supabase/migrations').glob('*_cr007b_*.sql')):
            execute(db,migration.read_text())
        check(db,'27 RLS/FORCE tables',"SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity",'27')
        check(db,'8 applied source migrations',f"SELECT {len(list((ROOT/'supabase/migrations').glob('*_cr007b_*.sql')))}",'8')
        check(db,'all table PKs',"SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='p'",'27')
        check(db,'composite foreign keys',"SELECT count(*)>=5 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f' AND cardinality(c.conkey)>1",'t')
        check(db,'no anon base grants',"SELECT count(*) FROM information_schema.role_table_grants WHERE grantee='anon' AND table_schema='public' AND table_name NOT LIKE 'public_%'",'0')
        check(db,'definer restricted search path',"SELECT bool_and(proconfig @> ARRAY['search_path=public, pg_temp']) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND prosecdef",'t')
        check(db,'no anon definer execution',"SELECT bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND prosecdef",'t')
        check(db,'bigint money',"SELECT bool_and(data_type='bigint') FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('orders','products','payments','order_items','coupons','custom_requests') AND column_name LIKE '%cents'",'t')
        for k in ['owner','editor','operator','finance','roleless','inactive','revoked']:
            execute(db,f"INSERT INTO auth.users VALUES({q(k)}); INSERT INTO public.admin_profiles(user_id,display_name,active) VALUES({q(k)},'Synthetic',{str(k!='inactive').lower()});")
        for k,r in [('owner','proprietario'),('editor','editor'),('operator','operador'),('finance','financeiro'),('inactive','proprietario')]:
            execute(db,f"INSERT INTO public.user_roles(user_id,role) VALUES({q(k)},'{r}');")
        execute(db,f"INSERT INTO public.user_roles(user_id,role) VALUES({q('revoked')},'editor'); DELETE FROM public.user_roles WHERE user_id={q('revoked')};")
        execute(db,f"""
INSERT INTO public.categories(id,slug,name,active) VALUES({q('category')},'public','Public',true),({q('draft-category')},'draft','Draft',false);
INSERT INTO public.products(id,category_id,slug,name,regular_price_cents,promo_price_cents,production_mode,active,internal_notes) VALUES
({q('product')},{q('category')},'public-product','Public',1000,900,'pronta-entrega',true,'PRIVATE'),
({q('draft')},{q('category')},'draft-product','Draft',1000,NULL,'pronta-entrega',false,''),
({q('hidden')},{q('draft-category')},'hidden-product','Hidden',1000,NULL,'pronta-entrega',true,'');
INSERT INTO public.product_variants(id,product_id,sku,selection_key,active) VALUES({q('variant')},{q('product')},'SKU-TEST','base',true);
INSERT INTO public.media_assets(id,bucket,object_key,mime,byte_size,width,height,checksum,state) VALUES({q('media')},'synthetic','fake.webp','image/webp',12,1,1,'test','published');
INSERT INTO public.product_images VALUES({q('product')},{q('media')},0,true);
INSERT INTO public.customers(id,name,phone_e164) VALUES({q('customer')},'Synthetic','+5521999999999');
INSERT INTO public.orders(id,customer_id,customer_name_snapshot,customer_phone_snapshot,subtotal_cents,discount_cents,shipping_cents,total_cents,idempotency_key,payload_hash,privacy_notice_version,status) VALUES({q('order')},{q('customer')},'Synthetic','+5521999999999',1000,0,0,1000,gen_random_uuid(),repeat('a',64),'test','confirmado');
INSERT INTO public.order_items(id,order_id,product_id,variant_id,product_name_snapshot,unit_price_cents,quantity,line_discount_cents) VALUES({q('item')},{q('order')},{q('product')},{q('variant')},'Snapshot',1000,1,0);
INSERT INTO public.order_status_history(id,order_id,to_status,operation_key) VALUES({q('history')},{q('order')},'aguardando-contato','history-test');
INSERT INTO public.payments(id,order_id,amount_cents,kind,method,confirmed_by,operation_key) VALUES({q('payment')},{q('order')},100,'receipt','synthetic',{q('owner')},gen_random_uuid());
INSERT INTO public.inventory(product_id,on_hand,allocated) VALUES({q('product')},2,1);
INSERT INTO public.inventory_movements(id,product_id,kind,quantity,delta_on_hand,delta_allocated,reason,operation_key) VALUES({q('movement')},{q('product')},'adjust',2,2,0,'Synthetic','movement-test');
INSERT INTO public.custom_requests(id,customer_name_snapshot,customer_phone_snapshot,description,quantity,idempotency_key,payload_hash) VALUES({q('request')},'Synthetic','+5521999999999','Test',1,gen_random_uuid(),repeat('b',64));
INSERT INTO public.custom_request_history(id,request_id,to_status,operation_key) VALUES({q('request-history')},{q('request')},'recebida','test');
INSERT INTO public.admin_audit_events(id,action,entity_type,request_id,reason) VALUES({q('audit')},'test','synthetic',gen_random_uuid(),'test');
""")
        execute(db,f"""
BEGIN;
INSERT INTO public.product_attribute_groups(id,product_id,code,label) VALUES({q('group')},{q('product')},'material','Material');
INSERT INTO public.product_attribute_options(id,group_id,code,label,active) VALUES({q('option')},{q('group')},'pla','PLA',true);
INSERT INTO public.variant_option_values VALUES({q('variant')},{q('group')},{q('option')},{q('product')});
UPDATE public.product_variants SET selection_key={q('group')}||'='||{q('option')} WHERE id={q('variant')};
INSERT INTO public.category_images VALUES({q('category')},{q('media')});
INSERT INTO public.order_allocations(order_item_id,product_id,quantity) VALUES({q('item')},{q('product')},1);
INSERT INTO public.coupons(id,code,kind,value,starts_at,ends_at) VALUES({q('coupon')},'SYNTHETIC','percentual',10,now(),now());
INSERT INTO public.coupon_redemptions(coupon_id,order_id,discount_cents,state) VALUES({q('coupon')},{q('order')},0,'held');
INSERT INTO public.media_assets(id,bucket,object_key,mime,byte_size,width,height,checksum,state) VALUES({q('private-media')},'private','private.webp','image/webp',12,1,1,'test','verified');
INSERT INTO public.custom_request_images VALUES({q('request')},{q('private-media')},0);
INSERT INTO public.banners(title,button_text,button_url,active) VALUES('Synthetic','Test','/catalogo',true);
INSERT INTO public.store_settings(id,name,whatsapp_number,privacy_notice_version) VALUES(1,'Synthetic','5521999999999','test');
COMMIT;
""")
        catalog={'categories':2,'products':3,'product_attribute_groups':1,'product_attribute_options':1,'product_variants':1,'variant_option_values':1,'media_assets':2,'product_images':1,'category_images':1,'banners':1}
        operations={t:1 for t in ['customers','orders','order_items','order_status_history','inventory','inventory_movements','order_allocations','coupon_redemptions','custom_requests','custom_request_images','custom_request_history']}
        for k in ['owner','editor','operator','finance','roleless','inactive','revoked']:
            counts={**{t:(n if k in ['owner','editor'] else 0) for t,n in catalog.items()},**{t:(n if k in ['owner','operator'] else 0) for t,n in operations.items()}}
            counts.update({'payments':1 if k in ['owner','operator','finance'] else 0,'coupons':1 if k in ['owner','editor','operator'] else 0,'store_settings':1 if k=='owner' else 0,'admin_audit_events':1 if k=='owner' else 0,'admin_profiles':7 if k=='owner' else 1,'user_roles':5 if k=='owner' else 1 if k in ['editor','operator','finance','inactive'] else 0})
            assert len(counts)==27
            for t,n in counts.items():
                check(db,k+' full-matrix '+t,actor(k,f'SELECT count(*) FROM public.{t}'),str(n))
        check(db,'all FK first columns indexed',"SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f' AND NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND i.indisvalid AND i.indkey[0]=c.conkey[1])",'0')
        check(db,'all public views have security barriers',"SELECT bool_and(reloptions @> ARRAY['security_barrier=true']) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'",'t')
        check(db,'anon cannot execute role helper',"SET ROLE anon; SELECT public.has_role(ARRAY['proprietario']::public.admin_role[])",error='permission denied')
        check(db,'roleless role helper false',actor('roleless',"SELECT public.has_role(ARRAY['proprietario']::public.admin_role[])"),'f')
        check(db,'cross-product variant FK',f"INSERT INTO public.order_items(order_id,product_id,variant_id,product_name_snapshot,unit_price_cents,quantity,line_discount_cents) VALUES({q('order')},{q('draft')},{q('variant')},'Bad',1,1,0)",error='foreign key constraint')
        check(db,'cross-product option FK',f"BEGIN; DELETE FROM public.variant_option_values; INSERT INTO public.variant_option_values VALUES({q('variant')},{q('group')},{q('option')},{q('draft')}); COMMIT;",error='foreign key constraint')
        check(db,'allocation quantity bound',f"UPDATE public.order_allocations SET quantity=2",error='item quantity bound')
        check(db,'payment pending denied',f"BEGIN; UPDATE public.orders SET status='aguardando-contato' WHERE id={q('order')}; INSERT INTO public.payments(order_id,amount_cents,kind,method,confirmed_by,operation_key) VALUES({q('order')},1,'receipt','test',{q('owner')},gen_random_uuid()); COMMIT;",error='payment requires confirmed')
        check(db,'settings social URL denied',"UPDATE public.store_settings SET social_links='{\"instagram\":\"javascript:alert(1)\"}'",error='invalid social link')
        check(db,'media not published withheld',f"BEGIN; UPDATE public.media_assets SET state='verified' WHERE id={q('media')}; SET LOCAL ROLE anon; SELECT count(*) FROM public.public_product_images; ROLLBACK;",'0')
        check(db,'anon narrow product parents',"SET ROLE anon; SELECT count(*) FROM public.public_products",'1')
        check(db,'anon effective price',"SET ROLE anon; SELECT effective_price_cents FROM public.public_products",'900')
        check(db,'anon availability boolean',"SET ROLE anon; SELECT available FROM public.public_availability",'t')
        for t in ['products','customers','orders','user_roles','media_assets','admin_audit_events']:
            check(db,'anon denied '+t,f'SET ROLE anon; SELECT * FROM public.{t}',error='permission denied')
        check(db,'public hides internal column','SET ROLE anon; SELECT internal_notes FROM public.public_products',error='does not exist')
        check(db,'public hides media paths','SET ROLE anon; SELECT object_key FROM public.public_product_images',error='does not exist')
        matrix={'owner':(3,1,1),'editor':(3,0,0),'operator':(0,1,0),'finance':(0,0,0),'roleless':(0,0,0),'inactive':(0,0,0),'revoked':(0,0,0)}
        for k,counts in matrix.items():
            for t,count in zip(['products','orders','admin_audit_events'],counts):
                check(db,k+' RLS '+t,actor(k,f'SELECT count(*) FROM public.{t}'),str(count))
            check(db,k+' cannot self grant',actor(k,f"INSERT INTO public.user_roles(user_id,role) VALUES({q(k)},'proprietario')"),error='permission denied')
            check(db,k+' cannot raw order write',actor(k,"UPDATE public.orders SET notes='bad'"),error='permission denied')
        check(db,'finance sanitized summary',actor('finance','SELECT count(*) FROM public.finance_order_summary'),'1')
        check(db,'operator cannot finance summary',actor('operator','SELECT count(*) FROM public.finance_order_summary'),'0')
        check(db,'editor update allowed',actor('editor',f"UPDATE public.products SET name='Edited' WHERE id={q('product')}; SELECT name FROM public.products WHERE id={q('product')}"),'Edited')
        check(db,'roleless write rejected',actor('roleless',f"INSERT INTO public.categories(slug,name) VALUES('bad','Bad')"),error='row-level security')
        for t,idkey in [('order_items','item'),('order_status_history','history'),('payments','payment'),('inventory_movements','movement'),('custom_request_history','request-history'),('admin_audit_events','audit')]:
            for operation in [f'DELETE FROM public.{t} WHERE id={q(idkey)}', f'UPDATE public.{t} SET id=id WHERE id={q(idkey)}',f'TRUNCATE public.{t} CASCADE']:
                check(db,'append-only '+operation.split()[0]+' '+t,operation,error='append-only')
        invalid=[('negative inventory',f'UPDATE public.inventory SET on_hand=-1 WHERE product_id={q("product")}'),('overallocated',f'UPDATE public.inventory SET allocated=3 WHERE product_id={q("product")}'),('invalid promo',f'UPDATE public.products SET promo_price_cents=1000 WHERE id={q("product")}'),('on demand days',f"UPDATE public.products SET production_mode='sob-demanda',production_days=NULL WHERE id={q('product')}"),('total invariant',f'UPDATE public.orders SET shipping_cents=0,total_cents=99 WHERE id={q("order")}'),('safe integer money',f'UPDATE public.products SET regular_price_cents=9007199254740992 WHERE id={q("product")}'),('unsafe URL',"INSERT INTO public.banners(title,button_text,button_url) VALUES('Bad','Bad','javascript:alert(1)')"),('settings singleton',"INSERT INTO public.store_settings(id,name,whatsapp_number,privacy_notice_version) VALUES(2,'Synthetic','5521999999999','test')"),('coupon percent',"INSERT INTO public.coupons(code,kind,value,starts_at,ends_at) VALUES('BAD','percentual',101,now(),now())")]
        for label,sql in invalid: check(db,label,sql,error='check constraint')
        check(db,'unique primary image',f"INSERT INTO public.product_images VALUES({q('product')},{q('private-media')},1,true)",error='unique constraint')
        check(db,'idempotent key unique',f"INSERT INTO public.orders(customer_name_snapshot,customer_phone_snapshot,subtotal_cents,discount_cents,idempotency_key,payload_hash,privacy_notice_version) SELECT customer_name_snapshot,customer_phone_snapshot,subtotal_cents,discount_cents,idempotency_key,payload_hash,privacy_notice_version FROM public.orders WHERE id={q('order')}",error='unique constraint')
        check(db,'required variant group deferred',f"INSERT INTO public.product_attribute_groups(product_id,code,label) VALUES({q('product')},'finish','Finish')",error='invalid active variant')
        check(db,'inactive option cannot remain sellable',f"UPDATE public.product_attribute_options SET active=false WHERE id={q('option')}",error='invalid active variant')
        check(db,'canonical variant key',f"UPDATE public.product_variants SET selection_key='forged' WHERE id={q('variant')}",error='invalid active variant')
        check(db,'last owner deactivation',f"UPDATE public.admin_profiles SET active=false WHERE user_id={q('owner')}",error='last active owner')
        check(db,'last owner paired removal',f"BEGIN; DELETE FROM public.user_roles WHERE user_id={q('owner')}; DELETE FROM public.admin_profiles WHERE user_id={q('owner')}; COMMIT;",error='last active owner')
        check(db,'last owner revocation',f"DELETE FROM public.user_roles WHERE user_id={q('owner')}",error='last active owner')
        check(db,'private evidence blocked',f"UPDATE public.media_assets SET state='published' WHERE id={q('media')}; INSERT INTO public.custom_request_images VALUES({q('request')},{q('media')},1)",error='private attachment')
        check(db,'service cannot mutate snapshots',f"SET ROLE service_role; DELETE FROM public.order_items WHERE id={q('item')}",error='permission denied')
        execute(db,f"INSERT INTO auth.users VALUES({q('second-owner')}); INSERT INTO public.admin_profiles(user_id,display_name,active) VALUES({q('second-owner')},'Synthetic concurrent',true); INSERT INTO public.user_roles(user_id,role) VALUES({q('second-owner')},'proprietario');")
        def remove_owner(k):
            return raw(db,f"BEGIN; DELETE FROM public.user_roles WHERE user_id={q(k)}; SELECT pg_sleep(0.2); COMMIT;")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(remove_owner,['owner','second-owner']))
        assert sorted(r.returncode==0 for r in results)==[False,True], [(r.stdout,r.stderr) for r in results]
        assert any('last active owner' in r.stderr for r in results)
        passed+=1
        print('PASS concurrent last owner removal: exactly one committed',flush=True)
        check(db,'one active owner survives concurrent revocation',"SELECT count(*) FROM public.admin_profiles p JOIN public.user_roles r ON r.user_id=p.user_id WHERE p.active AND r.role='proprietario'",'1')
        # Fingerprint proves deterministic structure on two independent clean databases.
        schema=execute(db,"SELECT string_agg(table_name||'.'||column_name||':'||data_type,',' ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'")
        if iteration == 0: fingerprint=schema
        else: assert schema == fingerprint
        print('CLEAN REBUILD',iteration+1,'OK',flush=True)
    finally:
        execute('postgres',f'DROP DATABASE {db} WITH (FORCE);')
print(json.dumps({'postgres':'17','assertions_passed':passed,'clean_rebuilds':2,'remote_connections':0}))

/*
 * CR-008D security test harness.
 *
 * Boots a disposable PGlite (Postgres-compatible), applies all 11 migrations
 * in order, then simulates each role scenario by setting the JWT claims
 * session variable (mimicking what Supabase GoTrue/postgREST do) and
 * exercising RLS-visible SELECT/INSERT/UPDATE/DELETE against administrative
 * tables.
 */
import { createRequire } from "node:module";
// Vendor pglite in scripts/vendor to avoid adding it to the project lockfile
// (CI uses bun --frozen-lockfile; we only need pglite for local audit scripts).
const require = createRequire(import.meta.url);
const { PGlite } = require("./vendor/node_modules/@electric-sql/pglite/dist/index.cjs");
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIG_DIR = "supabase/migrations";

const DB = new PGlite();

async function run(sql, params) {
  try {
    if (params) return await DB.query(sql, params);
    // exec() handles multi-statement strings (DO $$, BEGIN/COMMIT, etc).
    await DB.exec(sql);
    return { rows: [], fields: [] };
  } catch (e) {
    const err = new Error(`SQL FAILED: ${e.message}\n  SQL: ${sql.slice(0, 200)}`);
    err.cause = e;
    throw err;
  }
}

// ---- Supabase auth schema shim (only what the migrations touch) ----
async function installShim() {
  await run(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY,
      email text,
      email_confirmed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    -- Minimal supabase_auth_admin role simulation.
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
    END $$;

    -- auth.uid() reads the sub claim from request.jwt.claims
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;

    CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT auth.jwt()->>'email'
    $$;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT COALESCE(auth.jwt()->>'role', 'anon')
    $$;

    -- Grant base role existence used by migrations (they REVOKE FROM anon etc., which requires role exists).
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, supabase_auth_admin;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, supabase_auth_admin;
    GRANT USAGE, CREATE ON SCHEMA auth TO service_role, supabase_auth_admin;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;
    ALTER TABLE auth.users OWNER TO service_role;
    -- Default privileges for future objects in auth
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO service_role;
  `);
}

// Helper: set the current "session" as if coming from PostgREST.
// Because pglite auto-commits each statement, SET ROLE doesn't persist across
// separate query() calls. We remember the target claims here and every probe
// wraps itself in a single transaction that re-applies SET ROLE + the claims.
let CURRENT_CTX = null;

async function become(ctx) {
  CURRENT_CTX = ctx || null;
}

/**
 * Run a single SELECT query as the CURRENT_CTX role, wrapping it in a
 * transaction so that SET ROLE + set_config apply for the duration of the
 * query. This mirrors PostgREST behavior where role + claims are established
 * per-request.
 */
async function asCtx(query, params) {
  const ctx = CURRENT_CTX || {};
  const sub = ctx.sub ?? null;
  const aal = ctx.aal ?? "aal2";
  const roles = ctx.roles ?? [];
  // All scenarios run SET ROLE authenticated (the only non-superuser role that
  // has grants on the public tables). Anonymous/expired is simulated by
  // setting claims to '{}' (no sub → auth.uid() returns NULL, so policies
  // like has_role() evaluate to false and own_profile fails).
  const claims = sub ? JSON.stringify({ sub, aal, roles }) : "{}";
  await dbExec("BEGIN");
  try {
    await dbExecParams("SELECT set_config('request.jwt.claims', $1, true)", [claims]);
    await dbExec("SET ROLE authenticated");
    return params ? await DB.query(query, params) : await DB.query(query);
  } finally {
    await dbExecSafe("ROLLBACK");
  }
}

async function dbExec(sql) { await DB.exec(sql); }
async function dbExecSafe(sql) { try { await DB.exec(sql); } catch {} }
async function dbExecParams(sql, params) { await DB.query(sql, params); }

// Helper: run SQL and return whether it's allowed (true) or denied (false).
async function allowed(sql) {
  try {
    await asCtx(sql);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function loadMigrations() {
  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  console.log("Applying", files.length, "migrations:");
  for (const f of files) {
    const sql = readFileSync(join(MIG_DIR, f), "utf8");
    // pglite supports BEGIN/COMMIT and most plpgsql.
    try {
      await run(sql);
      console.log("  ✓", f);
    } catch (e) {
      console.log("  ✗", f, "→", e.message.slice(0, 400));
      throw e;
    }
  }
}

// Seed test users + roles (as bootstrap / superuser, since pglite connects as
// the cluster owner; in Supabase this is performed via the service_role key).
async function seed() {
  await dbExecSafe("RESET ROLE");
  // Create four admin users + one non-admin authenticated user.
  for (const [id, email, display, roles, active = true] of [
    ["11111111-1111-1111-1111-111111111111", "owner@example.com",  "Dona",     ["proprietario"]],
    ["22222222-2222-2222-2222-222222222222", "editor@example.com", "Editora",  ["editor"]],
    ["33333333-3333-3333-3333-333333333333", "op@example.com",     "Operador", ["operador"]],
    ["44444444-4444-4444-4444-444444444444", "fin@example.com",    "Finanças", ["financeiro"]],
    ["55555555-5555-5555-5555-555555555555", "plain@example.com",  "Comum",    [], false],
    ["66666666-6666-6666-6666-666666666666", "inactive@example.com","Inativo", ["editor"], false],
  ]) {
    await run("INSERT INTO auth.users(id, email) VALUES ($1::uuid, $2) ON CONFLICT DO NOTHING", [id, email]);
    await run(
      "INSERT INTO public.admin_profiles(user_id, display_name, active) VALUES ($1::uuid, $2, $3) ON CONFLICT (user_id) DO UPDATE SET active=EXCLUDED.active",
      [id, display, active],
    );
    await run("DELETE FROM public.user_roles WHERE user_id=$1::uuid", [id]);
    for (const r of roles) {
      await run(
        "INSERT INTO public.user_roles(user_id, role) VALUES ($1::uuid, $2::public.admin_role)",
        [id, r],
      );
    }
  }
  // Seed catalog data as superuser (bootstrap) so RLS has rows to potentially
  // leak — empty tables would give false confidence.
  try {
    await run(`
      INSERT INTO public.categories(id,slug,name,active)
        VALUES ('80000000-0000-0000-0000-000000000001'::uuid,'cat-teste','Categoria Teste',true)
        ON CONFLICT DO NOTHING;
      INSERT INTO public.products(id,category_id,slug,name,regular_price_cents,production_mode,active)
        VALUES ('80000000-0000-0000-0000-000000000002'::uuid,'80000000-0000-0000-0000-000000000001'::uuid,'prod-teste','Produto Teste',10000,'pronta-entrega',true)
        ON CONFLICT DO NOTHING;
      INSERT INTO public.banners(id,title,button_text,button_url,active,display_order)
        VALUES ('80000000-0000-0000-0000-000000000003'::uuid,'Banner Teste','Ver','/',true,0)
        ON CONFLICT DO NOTHING;
      INSERT INTO public.coupons(id,code,kind,value,starts_at,ends_at,active,usage_limit,min_subtotal_cents)
        VALUES ('80000000-0000-0000-0000-000000000004'::uuid,'TESTE','fixo',1000,now(),now()+'30 days'::interval,true,10,0)
        ON CONFLICT DO NOTHING;
      -- Customer + order + payment so RLS has real rows to leak-check.
      INSERT INTO public.customers(id,name,phone_e164)
        VALUES ('90000000-0000-0000-0000-000000000001'::uuid,'Cliente Teste','+5521999999999')
        ON CONFLICT DO NOTHING;
      INSERT INTO public.orders(id,customer_id,customer_name_snapshot,customer_phone_snapshot,status,subtotal_cents,discount_cents,shipping_cents,total_cents,idempotency_key,payload_hash,privacy_notice_version,confirmed_at)
        VALUES ('90000000-0000-0000-0000-000000000002'::uuid,'90000000-0000-0000-0000-000000000001'::uuid,'Cliente Teste','+5521999999999','confirmado',10000,0,0,10000,'00000000-0000-0000-0000-000000000003'::uuid,
                repeat('0',64),'v1',now())
        ON CONFLICT DO NOTHING;
      INSERT INTO public.payments(id,order_id,amount_cents,kind,method,confirmed_by,confirmed_at,operation_key)
        VALUES ('90000000-0000-0000-0000-000000000004'::uuid,'90000000-0000-0000-0000-000000000002'::uuid,10000,'receipt','pix',
                '11111111-1111-1111-1111-111111111111'::uuid,now(),'00000000-0000-0000-0000-000000000005'::uuid)
        ON CONFLICT DO NOTHING;
    `);
  } catch (e) { console.log("  seed note:", e.message.slice(0,200)); }
  await dbExecSafe("RESET ROLE");
  await dbExec("SELECT set_config('request.jwt.claims', '', false)");
}

// Quick probe: for a given session, does SELECT on a table return a row?
async function canSelect(table, columns = "1") {
  try {
    const r = await asCtx(`SELECT ${columns} FROM public.${table} LIMIT 1`);
    return { ok: true, count: r.rows.length, error: null };
  } catch (e) {
    return { ok: false, count: 0, error: e.message };
  }
}

const ADMIN_TABLES = ["admin_profiles", "user_roles", "products", "categories",
  "media_assets", "orders", "customers", "coupons", "banners", "payments",
  "inventory", "store_settings", "custom_requests"];

const PUBLIC_TABLES = ["public_products", "public_categories", "public_banners", "public_store_settings"];

async function probe(label, ctx) {
  console.log(`\n── Scenario: ${label} ──`);
  await become(ctx);

  // Public catalog must always be readable (anon+authenticated).
  for (const t of PUBLIC_TABLES) {
    const r = await canSelect(t);
    console.log(`  public.${t.padEnd(24)}  ${r.ok ? `READ OK (${r.count} rows)` : "DENIED " + (r.error?.slice(0, 60) || "")}`);
  }

  for (const t of ADMIN_TABLES) {
    const r = await canSelect(t);
    console.log(`  admin.${t.padEnd(22)}  ${r.ok ? `READ OK (${r.count} rows)` : "DENIED"}`);
  }

  // RPC my_roles()
  let mrInfo = "EXEC ✗";
  try {
    const q = await asCtx("SELECT public.my_roles() AS r");
    mrInfo = "EXEC ✓ → " + JSON.stringify(q.rows[0]?.r);
  } catch {}
  console.log(`  RPC my_roles()          ${mrInfo}`);

  // custom_access_token_hook must be BLOCKED for non-service_role.
  const hook = await allowed(
    "SELECT public.custom_access_token_hook('{\"claims\":{\"sub\":\"11111111-1111-1111-1111-111111111111\"}}'::jsonb)",
  );
  console.log(`  custom_access_token_hook()  ${hook.ok ? "UNAUTHORIZED CALL ⚠ (should be denied)" : "BLOCKED ✓"}`);

  // require_aal2() visible?
  let aalInfo = "EXEC ✗";
  try {
    const q = await asCtx("SELECT public.require_aal2() AS v");
    aalInfo = "EXEC ✓ → " + q.rows[0]?.v;
  } catch {}
  console.log(`  require_aal2()          ${aalInfo}`);
}

async function main() {
  await installShim();
  await loadMigrations();
  await seed();

  // Scenario 1: anon
  await probe("ANONYMOUS (no session)", null);

  // Scenario 2: authenticated without role
  await probe("AUTHENTICATED, NO ROLE (plain user)", {
    sub: "55555555-5555-5555-5555-555555555555", aal: "aal2", roles: []
  });

  // Scenario 3: proprietario AAL1
  await probe("PROPRIETARIO AAL1 (password-only, no MFA)", {
    sub: "11111111-1111-1111-1111-111111111111", aal: "aal1", roles: ["proprietario"]
  });

  // Scenario 4: proprietario AAL2
  await probe("PROPRIETARIO AAL2 (MFA verified)", {
    sub: "11111111-1111-1111-1111-111111111111", aal: "aal2", roles: ["proprietario"]
  });

  // Scenario 5: editor AAL2
  await probe("EDITOR AAL2", {
    sub: "22222222-2222-2222-2222-222222222222", aal: "aal2", roles: ["editor"]
  });

  // Scenario 6: operador AAL2
  await probe("OPERADOR AAL2", {
    sub: "33333333-3333-3333-3333-333333333333", aal: "aal2", roles: ["operador"]
  });

  // Scenario 7: financeiro AAL2
  await probe("FINANCEIRO AAL2", {
    sub: "44444444-4444-4444-4444-444444444444", aal: "aal2", roles: ["financeiro"]
  });

  // Scenario 8: inactive user with role
  await probe("USER INACTIVE (editor role but active=false)", {
    sub: "66666666-6666-6666-6666-666666666666", aal: "aal2", roles: ["editor"]
  });

  // Scenario 9: privilege escalation — plain user trying to set request.jwt.claims themselves to fake roles.
  // In PostgREST only superuser/service_role can do set_config on that GUC to elevated values; a user cannot change the claim mid-transaction via SQL because set_config('request.jwt.claims',…) is only honoured within a transaction if we're a superuser. Let's try direct UPDATE on user_roles and see RLS.
  console.log("\n── Privilege escalation probes ──");
  await become({ sub: "55555555-5555-5555-5555-555555555555", aal: "aal2", roles: [] });
  let esc = await allowed("INSERT INTO public.user_roles(user_id, role) VALUES ('55555555-5555-5555-5555-555555555555'::uuid, 'proprietario'::public.admin_role)");
  console.log("  plain user → INSERT user_roles as proprietario:", esc.ok ? "UNAUTHORIZED ⚠" : "BLOCKED ✓", esc.error?.slice(0, 100) || "");
  esc = await allowed("UPDATE public.admin_profiles SET active=true WHERE user_id='55555555-5555-5555-5555-555555555555'::uuid");
  console.log("  plain user → UPDATE admin_profiles active=true:", esc.ok ? "UNAUTHORIZED ⚠" : "BLOCKED ✓");
  esc = await allowed("DELETE FROM public.user_roles WHERE user_id='11111111-1111-1111-1111-111111111111'");
  console.log("  plain user → DELETE owner role:", esc.ok ? "UNAUTHORIZED ⚠" : "BLOCKED ✓");
  esc = await allowed("SELECT set_config('request.jwt.claims', '{\"sub\":\"11111111-1111-1111-1111-111111111111\",\"aal\":\"aal2\",\"roles\":[\"proprietario\"]}', true)");
  console.log("  set_config jwt.claims as authenticated:", esc.ok ? "allowed (not a real risk — in PostgREST the GUC is reset per request; client SQL cannot persist role changes across requests)" : "blocked");
  let after;
  try { after = await asCtx("SELECT auth.uid() AS uid, public.has_role(ARRAY['proprietario']::public.admin_role[]) AS is_owner"); }
  catch (e) { after = { rows: [{ uid: null, is_owner: null }] }; }
  console.log("  claims rebound to plain user after txn: uid=", after.rows[0]?.uid, "has_role(proprietario)=", after.rows[0]?.is_owner);

  // Scenario 10: expired session — simulated by anon (no claims).
  await probe("EXPIRED SESSION (anon)", null);

  // Scenario 11: cross-user read (editor should see ONLY own_profile/own_roles).
  console.log("\n── Isolation ──");
  await become({ sub: "22222222-2222-2222-2222-222222222222", aal: "aal2", roles: ["editor"] });
  let other;
  try { other = await asCtx("SELECT user_id FROM public.admin_profiles"); } catch (e) { other = { rows: [], message: e.message }; }
  console.log("  editor sees admin_profiles user_ids:", (other.rows||[]).map(r => r.user_id), other.message ? "("+other.message.slice(0,80)+")" : "(own_profile only expected)");
  try { other = await asCtx("SELECT user_id, role FROM public.user_roles"); } catch (e) { other = { rows: [], message: e.message }; }
  console.log("  editor sees user_roles rows:", (other.rows||[]).map(r => `${r.user_id}:${r.role}`), other.message ? "("+other.message.slice(0,80)+")" : "(own roles only expected)");

  // Financeiro must NOT see orders/customers, MUST see payments
  console.log("\n── Financeiro matrix ──");
  await become({ sub: "44444444-4444-4444-4444-444444444444", aal: "aal2", roles: ["financeiro"] });
  const finOrders = await canSelect("orders");
  const finPayments = await canSelect("payments");
  const finProducts = await canSelect("products");
  console.log("  financeiro SELECT orders:", finOrders.ok ? `LEAK ⚠ (${finOrders.count} rows)` : "BLOCKED ✓");
  console.log("  financeiro SELECT payments:", finPayments.ok ? `OK (${finPayments.count} rows)` : "BLOCKED ✗");
  console.log("  financeiro SELECT products:", finProducts.ok ? `LEAK ⚠ (${finProducts.count} rows)` : "BLOCKED ✓");
  // Debug: check has_role(financeiro) and require_aal2 directly as financeiro
  try {
    const d = await asCtx("SELECT public.has_role(ARRAY['financeiro']::public.admin_role[]) AS is_fin, public.require_aal2() AS aal2, auth.uid() AS uid");
    console.log("  financeiro debug:", d.rows[0]);
  } catch(e){ console.log("  financeiro debug error:", e.message.slice(0,200)); }

  // Operador must NOT see payments, MUST see orders/customers
  console.log("\n── Operador matrix ──");
  await become({ sub: "33333333-3333-3333-3333-333333333333", aal: "aal2", roles: ["operador"] });
  const opOrders = await canSelect("orders");
  const opPayments = await canSelect("payments");
  const opCoupons = await canSelect("coupons");
  console.log("  operador SELECT orders:", opOrders.ok ? `OK (${opOrders.count} rows) ✓` : "BLOCKED ✗");
  console.log("  operador SELECT payments:", opPayments.ok ? `LEAK ⚠ (${opPayments.count} rows)` : "BLOCKED ✓");
  console.log("  operador SELECT coupons:", opCoupons.ok ? `OK (read-only, ${opCoupons.count} rows) ✓` : "BLOCKED ✗");
  try {
    const d = await asCtx("SELECT public.has_role(ARRAY['operador']::public.admin_role[]) AS is_op, public.require_aal2() AS aal2");
    console.log("  operador debug:", d.rows[0]);
  } catch(e){}

  // SECURITY DEFINER functions search_path audit (run as superuser, not as user).
  console.log("\n── SECURITY DEFINER search_path audit ──");
  await dbExec("RESET ROLE");
  await dbExec("SELECT set_config('request.jwt.claims', '', false)");
  const secdef = await DB.query(`
    SELECT p.proname AS name,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
           proconfig AS config
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE p.prosecdef AND n.nspname='public'
     ORDER BY p.proname
  `);
  for (const r of secdef.rows) {
    const sp = (r.config||[]).find(c => c.startsWith('search_path='));
    const ok = sp && /^search_path\s*=\s*public,\s*pg_temp\s*$/.test(sp);
    console.log(`  public.${r.name}(): search_path=${ok ? "✓ "+sp : "⚠ " + (sp||"MISSING")}`);
  }

  // Function execute grants — authenticated should NOT be able to call hook directly.
  console.log("\n── Function EXECUTE grants ──");
  const fnPrivs = await DB.query(`
    SELECT p.proname, proacl::text AS acl
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('my_roles','custom_access_token_hook','require_aal2','has_role')
     ORDER BY p.proname
  `);
  for (const r of fnPrivs.rows) {
    console.log(`  public.${r.proname}() acl: ${r.acl}`);
  }

  await DB.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

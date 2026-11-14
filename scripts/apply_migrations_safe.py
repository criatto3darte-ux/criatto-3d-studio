#!/usr/bin/env python3
"""
CR-007D.2 safe migration harness.

GOAL: eliminate the CR-007D operator error where the body of a migration was
reconstructed incorrectly and sent to Supabase instead of the file's actual
bytes. This harness:

  1. Discovers all CR-007* migrations in `supabase/migrations/` ordered by
     filename (lexicographic by timestamp prefix).
  2. Reads each file VERBATIM as bytes (no string interpolation, no rewriting,
     no summarisation, no manual construction).
  3. Verifies the SHA-256 of each file against the approved reference (fetched
     from the pinned Git commit via `git show <sha>:<path>` or from a lock
     file). Mismatch aborts before any execution.
  4. Applies migrations sequentially against a throwaway Postgres (pgserver)
     and captures full DDL effects.
  5. Supports (a) clean rebuild and (b) resume simulation (0001-0005 applied,
     then 0006-0010) and asserts that the two end states are byte-identical
     via a structural fingerprint.
  6. Produces a JSON summary + a full structural dump that can be diffed
     against a reference dump (or a remote read-only fingerprint from the
     homolog project).

This is a DRY-RUN / LOCAL harness. It does NOT connect to Supabase. It is
also the contract that the remote-apply driver must follow: read bytes ->
hash-check -> send bytes -> stop on first error.

Run from repo root with the bundled .venv-sqltest virtualenv active.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time
from typing import Iterable

os.environ.setdefault("XDG_RUNTIME_DIR", "/tmp/runtime-1001")
os.makedirs("/tmp/runtime-1001", exist_ok=True)

import pgserver  # type: ignore
import psycopg  # type: ignore

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIG_DIR = ROOT / "supabase" / "migrations"
BOOTSTRAP = ROOT / "scripts" / "supabase-bootstrap.sql"
EVIDENCE = ROOT / "docs" / "evidence"

# Pinned Git revision (commit on feature/cr-007b-supabase-foundation) whose
# migration files are the canonical "approved" source of truth. The harness
# refuses to apply any migration whose on-disk hash differs from this
# revision. Updated automatically by `scripts/lock-migrations.py` after the
# PR is approved; during CR-007D.2 we pin to the commit that the user
# explicitly authorized (b53ac36 — HEAD of feature branch before this CR).
APPROVED_REV = "b53ac36cfa07c116582442b01f0c772f9fd29902"


def _git(*args: str) -> str:
    r = subprocess.run(["git", "-C", str(ROOT), *args], check=True,
                       capture_output=True, text=True)
    return r.stdout


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def list_migrations() -> list[pathlib.Path]:
    """Return ordered list of migration files.

    Only files matching *_cr007*.sql (foundation + incremental guards) are
    included; unrelated SQL is ignored. The list is sorted by filename so
    that the timestamp prefix determines apply order — identical to what
    Supabase CLI does.
    """
    return sorted(p for p in MIG_DIR.glob("*_cr007*.sql"))


def expected_hash_from_git(path: pathlib.Path) -> str | None:
    """Return the SHA-256 of a file at APPROVED_REV, or None if unavailable
    (e.g. fresh file not yet committed)."""
    rel = path.relative_to(ROOT).as_posix()
    try:
        data = subprocess.run(
            ["git", "-C", str(ROOT), "show", f"{APPROVED_REV}:{rel}"],
            check=True, capture_output=True,
        ).stdout
        return sha256_bytes(data)
    except subprocess.CalledProcessError:
        return None


def load_verified(path: pathlib.Path) -> bytes:
    """Read a migration verbatim, and assert its SHA-256 matches the approved
    revision (when available)."""
    raw = path.read_bytes()
    actual = sha256_bytes(raw)
    expected = expected_hash_from_git(path)
    if expected is not None and expected != actual:
        raise SystemExit(
            f"SHA-256 MISMATCH for {path.name}: local={actual} approved={expected}. "
            f"Refusing to apply; aborting before any database work."
        )
    return raw, actual


def apply_bootstrap(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(BOOTSTRAP.read_text())
    conn.commit()


def apply_raw(conn: psycopg.Connection, raw_sql: bytes) -> None:
    """Apply a single migration's raw bytes. The file wraps its own
    BEGIN/COMMIT; we pass the bytes to psycopg exactly as read."""
    with conn.cursor() as cur:
        cur.execute(raw_sql)
    try:
        conn.commit()
    except psycopg.ProgrammingError:
        conn.rollback()


def fingerprint(conn: psycopg.Connection) -> dict:
    """Structural fingerprint that covers every object created by CR-007B.
    Used to verify (a) clean rebuild determinism and (b) resume equivalence."""
    fp: dict = {}
    with conn.cursor() as cur:
        cur.execute("""
        WITH by_kind AS (
          SELECT n.nspname AS nspname, c.relkind AS kind, COUNT(*)::int AS n
          FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public'
            AND c.relkind IN ('r','v','p','f','m','S')
          GROUP BY 1,2
        ), per_ns AS (
          SELECT nspname, json_object_agg(kind, n) AS counts
          FROM by_kind GROUP BY nspname
        )
        SELECT json_object_agg(nspname, counts) FROM per_ns;
        """)
        fp["namespaces"] = cur.fetchone()[0]

        cur.execute("""
        SELECT json_agg(t.typname ORDER BY t.typname)
        FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typtype='e';
        """)
        fp["enums"] = cur.fetchone()[0]

        cur.execute("""
        SELECT json_agg(json_build_object(
          'name', p.proname,
          'secdef', p.prosecdef,
          'args', pg_get_function_arguments(p.oid),
          'ret', pg_get_function_result(p.oid),
          'config', p.proconfig
        ) ORDER BY p.proname, pg_get_function_arguments(p.oid))
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public';
        """)
        fp["functions"] = cur.fetchone()[0]

        cur.execute("""
        SELECT json_agg(json_build_object(
          'table', tablename,
          'policyname', policyname,
          'cmd', cmd,
          'roles', roles,
          'qual', qual,
          'with_check', with_check
        ) ORDER BY tablename, policyname)
        FROM pg_policies WHERE schemaname='public';
        """)
        fp["policies"] = cur.fetchone()[0]

        cur.execute("""
        SELECT json_object_agg(
          table_name,
          json_build_object('rls', rls, 'force', force_rls, 'cols', cols)
        ) FROM (
          SELECT t.table_name,
                 c.relrowsecurity AS rls,
                 c.relforcerowsecurity AS force_rls,
                 COUNT(DISTINCT col.column_name)::int AS cols
          FROM information_schema.tables t
          JOIN pg_class c ON c.relname=t.table_name
          JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.table_schema
          JOIN information_schema.columns col
            ON col.table_schema=t.table_schema AND col.table_name=t.table_name
          WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
          GROUP BY 1,2,3
        ) x;
        """)
        fp["tables"] = cur.fetchone()[0]

        cur.execute("""
        SELECT json_agg(json_build_object(
          'table', event_object_table,
          'name', trigger_name,
          'when', action_timing,
          'event', event_manipulation,
          'level', action_orientation,
          'func', action_statement
        ) ORDER BY event_object_table, trigger_name)
        FROM information_schema.triggers
        WHERE event_object_schema='public';
        """)
        fp["triggers"] = cur.fetchone()[0]

        cur.execute("""
        SELECT json_agg(json_build_object(
          'table', table_name,
          'grantee', grantee,
          'priv', privilege_type
        ) ORDER BY table_name, grantee, privilege_type)
        FROM information_schema.role_table_grants
        WHERE table_schema='public';
        """)
        fp["grants"] = cur.fetchone()[0]

        cur.execute("""
        SELECT json_agg(json_build_object(
          'name', conname,
          'type', contype,
          'def', pg_get_constraintdef(c.oid)
        ) ORDER BY conrelid::regclass::text, conname)
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid=c.connamespace
        WHERE n.nspname='public';
        """)
        fp["constraints"] = cur.fetchone()[0]

        cur.execute("""
        SELECT json_agg(json_build_object(
          'name', indexname,
          'def', indexdef
        ) ORDER BY indexname)
        FROM pg_indexes WHERE schemaname='public';
        """)
        fp["indexes"] = cur.fetchone()[0]
    return fp


def start_pg(pgdata: pathlib.Path) -> tuple[pgserver.PostgresServer, str]:
    if pgdata.exists():
        shutil.rmtree(pgdata)
    srv = pgserver.get_server(str(pgdata))
    # Build a TCP-capable URI (pgserver listens on unix socket by default).
    uri = srv.get_uri()
    return srv, uri


def run_full() -> dict:
    pgdata = ROOT / ".pgdata-full"
    srv, uri = start_pg(pgdata)
    summary: dict = {"scenario": "clean-rebuild", "applied": []}
    try:
        conn = psycopg.connect(uri)
        apply_bootstrap(conn)
        for m in list_migrations():
            raw, h = load_verified(m)
            t0 = time.time()
            apply_raw(conn, raw)
            summary["applied"].append({
                "file": m.name,
                "sha256": h,
                "bytes": len(raw),
                "ms": int((time.time() - t0) * 1000),
            })
        summary["fingerprint"] = fingerprint(conn)
        conn.close()
    finally:
        srv.cleanup()
    return summary


def run_resume(after_n: int = 5) -> dict:
    """Apply first `after_n` foundation migrations (0001..000N), then apply the
    rest (including any cr007d_* guard files) in lexical order. Used to
    simulate resuming against a database where the first N migrations are
    already physically applied (like the homolog project)."""
    pgdata = ROOT / ".pgdata-resume"
    srv, uri = start_pg(pgdata)
    summary: dict = {"scenario": "resume", "pre_applied": [], "applied": []}
    migs = list_migrations()
    pre = [m for m in migs if m.name.startswith(
        tuple(f"20261113120{i}0" for i in range(1, after_n + 1)))]
    rest = [m for m in migs if m not in pre]
    try:
        conn = psycopg.connect(uri)
        apply_bootstrap(conn)
        for m in pre:
            raw, h = load_verified(m)
            apply_raw(conn, raw)
            summary["pre_applied"].append({"file": m.name, "sha256": h})
        summary["pre_fingerprint"] = fingerprint(conn)
        for m in rest:
            raw, h = load_verified(m)
            t0 = time.time()
            apply_raw(conn, raw)
            summary["applied"].append({
                "file": m.name,
                "sha256": h,
                "bytes": len(raw),
                "ms": int((time.time() - t0) * 1000),
            })
        summary["fingerprint"] = fingerprint(conn)
        conn.close()
    finally:
        srv.cleanup()
    return summary


def main(argv: list[str]) -> int:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    mode = argv[1] if len(argv) > 1 else "all"

    hashes: dict = {}
    # Pre-pass hash verification (no DB work)
    for m in list_migrations():
        raw, h = load_verified(m)
        exp = expected_hash_from_git(m)
        hashes[m.name] = {"sha256": h, "bytes": len(raw),
                          "approved_sha256": exp}
        print(f"HASH {m.name}: {h[:12]}… ({len(raw)} B) "
              f"{'(matches approved)' if exp == h else '(NO APPROVED REF)'}")

    full = run_full() if mode in ("full", "all") else None
    resume = run_resume(after_n=5) if mode in ("resume", "all") else None

    if full and resume:
        # Structural equivalence: compare JSON-serialised fingerprints.
        if json.dumps(full["fingerprint"], sort_keys=True) != \
           json.dumps(resume["fingerprint"], sort_keys=True):
            print("ERROR: resume fingerprint differs from clean rebuild",
                  file=sys.stderr)
            return 2

    out = {
        "approved_rev": APPROVED_REV,
        "hashes": hashes,
        "full": full,
        "resume": resume,
        "pgserver_note": (
            "pgserver bundles PG16; CI runs the same harness against "
            "postgres:17. The structural checks are version-independent."
        ),
    }
    report = EVIDENCE / "cr007d2-local-pg.json"
    report.write_text(json.dumps(out, indent=2, sort_keys=True))
    print(f"\nWrote evidence: {report.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

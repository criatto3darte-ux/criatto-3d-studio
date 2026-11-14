// Browser-safe Supabase client for the Criatto 3D auth-onboarding flow.
//
// - Uses the **anon** key (VITE_SUPABASE_ANON_KEY), NEVER the service_role.
// - PKCE flow (`flowType: 'pkce'`) + `persistSession: true` (default) — the
//   refresh token is stored in localStorage, but the PKCE code verifier for
//   the auth callback is exchanged in-memory via the callback route and then
//   setServerSession is used server-side to finalize (SSR safe). For the
//   onboarding flow we only need the browser client.
// - Auto-refresh tokens are enabled by default; realtime/auth state change
//   listeners are wired up by the route handlers.
import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas. " +
        "Copie .env.example para .env.local e preencha os valores antes de acessar /auth.",
    );
  }
}

let _client: SupabaseClient | null = null;

/** Returns the singleton browser Supabase client. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  assertSupabaseConfigured();
  _client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // o callback /auth/callback faz a troca manualmente.
      flowType: "pkce",
    },
  });
  return _client;
}

// ---------------- React hook: sessão atual ----------------

type SessionState =
  | { status: "loading"; session: null }
  | { status: "authenticated"; session: Session }
  | { status: "unauthenticated"; session: null };

let cached: SessionState = { status: "loading", session: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe() {
  if (listeners.size > 0) return () => {};
  // Install listener once, when the first subscriber arrives.
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      cached = data.session
        ? { status: "authenticated", session: data.session }
        : { status: "unauthenticated", session: null };
      emit();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      cached = session
        ? { status: "authenticated", session }
        : { status: "unauthenticated", session: null };
      emit();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }
  // No config: treat as unauthenticated (onboarding routes will error out).
  cached = { status: "unauthenticated", session: null };
  return () => {};
}

/** Hook que expõe a sessão atual (read-only). Não executa redirect. */
export function useSession(): SessionState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      const unsub = subscribe();
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          unsub();
          cached = { status: "loading", session: null };
          _client = null; // drop singleton for easier HMR / resubscribes
        }
      };
    },
    () => cached,
    () => cached,
  );
}

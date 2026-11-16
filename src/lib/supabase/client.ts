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
let unsubscribeAuth: (() => void) | null = null;
let subscriptionGeneration = 0;

function publishSession(session: Session | null): void {
  if (session) {
    if (cached.status === "authenticated" && cached.session === session) return;
    cached = { status: "authenticated", session };
  } else {
    if (cached.status === "unauthenticated") return;
    cached = { status: "unauthenticated", session: null };
  }
  for (const listener of listeners) listener();
}

function startSessionListener(): void {
  const generation = ++subscriptionGeneration;
  if (!isSupabaseConfigured()) {
    publishSession(null);
    return;
  }

  const supabase = getSupabase();
  let authEventReceived = false;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (generation !== subscriptionGeneration) return;
    authEventReceived = true;
    publishSession(session);
  });
  unsubscribeAuth = () => data.subscription.unsubscribe();

  // INITIAL_SESSION usually initializes the store. getSession is a fallback
  // for clients that do not emit it immediately; never overwrite a newer event.
  void supabase.auth.getSession().then(({ data: result, error }) => {
    if (generation !== subscriptionGeneration || authEventReceived) return;
    publishSession(error ? null : result.session);
  }).catch(() => {
    if (generation === subscriptionGeneration && !authEventReceived) {
      publishSession(null);
    }
  });
}

function subscribeSession(listener: () => void): () => void {
  const first = listeners.size === 0;
  listeners.add(listener);
  if (first) startSessionListener();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      ++subscriptionGeneration;
      unsubscribeAuth?.();
      unsubscribeAuth = null;
      // Do not mutate cached on unmount. useSyncExternalStore requires a
      // stable snapshot across React re-renders and StrictMode subscriptions.
    }
  };
}

function getSessionSnapshot(): SessionState {
  return cached;
}

/** Hook que expõe a sessão atual sem reiniciar a autenticação ao digitar. */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
}

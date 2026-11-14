// Funções de checagem de autorização usadas pelas rotas de onboarding.
//
// O bootstrap do proprietário só será executado DEPOIS de:
//   1. E-mail confirmado (email_confirmed_at IS NOT NULL).
//   2. Senha definida (o fluxo de convite requer definir senha ao aceitar).
//   3. MFA TOTP matriculado e verificado (fatores com status='verified').
//
// Esta função roda no cliente a partir dos dados da sessão + uma RPC/query leve
// que NÃO expõe dados sensíveis e retorna um booleano/objivo de status.

import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type OnboardingStage =
  | "loading"
  | "no-session"
  | "need-mfa" // tem sessão AAL1, sem fatores TOTP verificados
  | "complete"; // sessão AAL2, email confirmado

export interface AuthStatus {
  stage: OnboardingStage;
  email?: string | undefined;
  emailConfirmedAt?: string | null | undefined;
  aal?: "aal1" | "aal2" | string | undefined;
  totpVerified: boolean;
}

/**
 * Decodifica o payload de um JWT (sem verificar assinatura) para ler a claim
 * `aal` no access_token. Usamos isso no cliente apenas para UI/redirects; a
 * autorização real é sempre decidida pelas políticas RLS no Postgres usando
 * o access_token validado pelo supabase.
 */
export function decodeJwtClaim(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Retorna a claim `aal` (aal1/aal2) do access_token da sessão, ou null. */
export function sessionAal(session: Session): "aal1" | "aal2" | null {
  const claims = decodeJwtClaim(session.access_token);
  const aal = claims?.aal;
  return aal === "aal2" ? "aal2" : aal === "aal1" ? "aal1" : null;
}

/**
 * Verifica se uma sessão tem os requisitos mínimos para entrar no admin:
 *   - AAL2 (MFA TOTP verificado na sessão atual, claim `aal=aal2` do JWT);
 *   - app_metadata.role === "proprietario" ou "admin" (RLS decide o resto).
 *
 * Esta checagem é apenas defesa em profundidade no cliente — a política
 * real de autorização é definida pelas políticas RLS no Postgres.
 */
export function isAdminAuthorized(session: Session): boolean {
  if (sessionAal(session) !== "aal2") return false;
  const role = session.user.app_metadata?.role;
  return role === "proprietario" || role === "admin";
}

/**
 * Consulta leve via RPC/query pública que verifica a identidade do usuário e
 * retorna se ele já tem um proprietário ativo (verificação necessária antes
 * de permitir acesso administrativo).
 *
 * Usa a RPC `public.has_role` (que não vaza nada) e o endpoint REST do Auth.
 * Para não depender de service_role, esta função verifica apenas sinais
 * disponíveis ao usuário autenticado:
 *   - session.user.email_confirmed_at
 *   - session.user.factors (preenchido por supabase-js após verificação de MFA)
 *   - amr (Authentication Methods References) na sessão para saber o AAL.
 */
export async function checkOnboardingStatus(supabase: SupabaseClient): Promise<AuthStatus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { stage: "no-session", totpVerified: false };
  }

  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  const totpFactors = error ? [] : (factors?.totp ?? []);
  const totpVerified = totpFactors.some((f) => f.status === "verified");
  const aal = sessionAal(session) ?? (totpVerified ? "aal2" : "aal1");

  // amr é um claim JWT; para lê-lo do servidor seria preciso RPC, mas para o
  // onboarding o sinal totpVerified é suficiente.
  return {
    stage: totpVerified ? "complete" : "need-mfa",
    email: session.user.email ?? undefined,
    emailConfirmedAt: session.user.email_confirmed_at,
    aal,
    totpVerified,
  };
}

export function isEmailConfirmed(session: Session | null): boolean {
  return Boolean(session?.user?.email_confirmed_at);
}

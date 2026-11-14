// Funções de checagem de autorização usadas pelas rotas de onboarding e pelo
// guard do /admin.
//
// Fonte da verdade (backend/RLS):
//   - Roles ficam em public.user_roles / public.admin_profiles (bootstrap),
//     NÃO em app_metadata.role.
//   - O access_token JWT recebe a claim "roles" via custom access token hook
//     (public.custom_access_token_hook), definida em
//     supabase/migrations/20261114133000_cr008c_jwt_claims_and_aal.sql.
//   - O nível AAL2 é obrigatório no acesso administrativo (require_aal2()
//     aplicado a todas as policies admin_*/coupon/banner/payments_*).
//
// Esta checagem client-side é defesa em profundidade; a autorização real é
// sempre decidida pelas políticas RLS no Postgres usando o access_token
// validado pelo supabase.

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
  roles: string[];
}

/** Roles válidos para acesso administrativo. */
export const ADMIN_ROLES = ["proprietario", "admin", "editor", "operador", "financeiro"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Decodifica o payload de um JWT (sem verificar assinatura) para ler claims
 * (aal, roles, sub, etc). Usado apenas para UI/redirects no cliente.
 */
export function decodeJwtClaim(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf-8");
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
 * Lê as roles da claim `roles` no JWT (preenchida pelo custom access token
 * hook). Se a claim estiver ausente (token emitido antes da migration),
 * retorna array vazio. O fallback chama a RPC `public.my_roles()` quando
 * necessário, mas na maioria dos casos a claim está presente e não requer
 * round-trip.
 */
export function sessionRoles(session: Session): string[] {
  const claims = decodeJwtClaim(session.access_token);
  const raw = claims?.roles;
  if (Array.isArray(raw)) return raw.map(String);
  return [];
}

/**
 * Verifica se uma sessão tem os requisitos mínimos para entrar no admin:
 *   - AAL2 (claim aal=aal2 no JWT — ou seja, MFA verificado nesta sessão);
 *   - Pelo menos uma role administrativa reconhecida na claim `roles`
 *     (preenchida a partir de public.user_roles por custom access token hook).
 *
 * Esta checagem é apenas defesa em profundidade no cliente — a política real
 * é exigida pelas RLS (require_aal2() + has_role()).
 */
export function isAdminAuthorized(session: Session): boolean {
  if (sessionAal(session) !== "aal2") return false;
  const roles = sessionRoles(session);
  return roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r));
}

/**
 * Consulta leve que determina o estágio de onboarding do usuário.
 *
 * Usa apenas sinais disponíveis ao usuário autenticado:
 *   - sessão atual (email, email_confirmed_at)
 *   - mfa.listFactors() (precisa da sessão autenticada)
 *   - claim aal do access_token
 *   - claim roles (opcional; se presente, não faz RPC extra)
 *
 * NÃO faz mutações, NÃO consome dados sensíveis, NÃO usa service_role.
 */
export async function checkOnboardingStatus(
  supabase: SupabaseClient,
): Promise<AuthStatus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { stage: "no-session", totpVerified: false, roles: [] };
  }

  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  const totpFactors = error ? [] : factors?.totp ?? [];
  const totpVerified = totpFactors.some((f) => f.status === "verified");
  const aal = sessionAal(session) ?? (totpVerified ? "aal2" : "aal1");

  let roles = sessionRoles(session);
  if (roles.length === 0) {
    // Token antigo/claim ausente: tenta RPC (falha silenciosa se não existir).
    const { data } = await supabase.rpc("my_roles");
    if (Array.isArray(data)) roles = data.map(String);
  }

  return {
    stage: totpVerified && aal === "aal2" ? "complete" : "need-mfa",
    email: session.user.email ?? undefined,
    emailConfirmedAt: session.user.email_confirmed_at ?? null,
    aal,
    totpVerified,
    roles,
  };
}

import { describe, expect, it } from "vitest";
import { decodeJwtClaim, isAdminAuthorized, sessionAal, sessionRoles } from "./guards";
import type { Session } from "@supabase/supabase-js";

// Helper: cria um JWT fake (apenas base64url do header.payload; assinatura irrelevante para o cliente).
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64('{"alg":"HS256","typ":"JWT"}')}.${b64(JSON.stringify(payload))}.sig`;
}

function makeSession(claims: Record<string, unknown>): Session {
  return {
    access_token: makeJwt(claims),
    refresh_token: "rt",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: "u-1",
      aud: "authenticated",
      email: "owner@example.com",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  } as unknown as Session;
}

describe("jwt decode", () => {
  it("retorna null para JWT malformado", () => {
    expect(decodeJwtClaim("not-a-jwt")).toBeNull();
    expect(decodeJwtClaim("abc.def")).toBeNull();
  });

  it("lê a claim aal corretamente", () => {
    expect(sessionAal(makeSession({ aal: "aal2" }))).toBe("aal2");
    expect(sessionAal(makeSession({ aal: "aal1" }))).toBe("aal1");
    expect(sessionAal(makeSession({}))).toBeNull();
  });

  it("lê as roles da claim roles", () => {
    expect(sessionRoles(makeSession({ aal: "aal2", roles: ["proprietario"] }))).toEqual(["proprietario"]);
    expect(sessionRoles(makeSession({ aal: "aal2", roles: [] }))).toEqual([]);
    expect(sessionRoles(makeSession({ aal: "aal2" }))).toEqual([]);
    expect(
      sessionRoles(
        makeSession({ aal: "aal2", roles: ["proprietario", "editor"] }),
      ),
    ).toEqual(["proprietario", "editor"]);
  });
});

describe("isAdminAuthorized", () => {
  it("nega quando aal=aal1 mesmo com role", () => {
    expect(isAdminAuthorized(makeSession({ aal: "aal1", roles: ["proprietario"] }))).toBe(false);
  });
  it("nega quando aal=aal2 mas sem roles", () => {
    expect(isAdminAuthorized(makeSession({ aal: "aal2", roles: [] }))).toBe(false);
  });
  it("nega quando roles não são reconhecidas", () => {
    expect(isAdminAuthorized(makeSession({ aal: "aal2", roles: ["authenticated"] }))).toBe(false);
  });
  it("permite proprietario aal2", () => {
    expect(isAdminAuthorized(makeSession({ aal: "aal2", roles: ["proprietario"] }))).toBe(true);
  });
  it("permite editor aal2", () => {
    expect(isAdminAuthorized(makeSession({ aal: "aal2", roles: ["editor"] }))).toBe(true);
  });
  it("permite operador aal2", () => {
    expect(isAdminAuthorized(makeSession({ aal: "aal2", roles: ["operador"] }))).toBe(true);
  });
  it("permite financeiro aal2", () => {
    expect(isAdminAuthorized(makeSession({ aal: "aal2", roles: ["financeiro"] }))).toBe(true);
  });
  it("permite múltiplas roles contendo ao menos uma admin", () => {
    expect(isAdminAuthorized(makeSession({ aal: "aal2", roles: ["editor", "qualquer-outra"] }))).toBe(true);
  });
});

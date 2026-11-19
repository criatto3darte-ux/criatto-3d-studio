import { describe, expect, it } from "vitest";
import { sanitizeAuthError } from "./authErrors";

describe("sanitizeAuthError", () => {
  it("não revela 'e-mail existe' vs 'senha errada'", () => {
    const a = sanitizeAuthError(new Error("invalid login credentials"));
    const b = sanitizeAuthError(new Error("email not confirmed"));
    const c = sanitizeAuthError(new Error("Invalid password"));
    expect(a).toEqual(b);
    expect(a).toEqual(c);
    expect(a.toLowerCase()).not.toContain("exist");
    expect(a.toLowerCase()).not.toContain("not found");
  });

  it("trata rate limit com mensagem amigável", () => {
    const msg = sanitizeAuthError(new Error("Too many requests. Rate limit exceeded."));
    expect(msg.toLowerCase()).toContain("muitas tentativas");
  });

  it("trata falhas de rede", () => {
    const msg = sanitizeAuthError(new TypeError("Failed to fetch"));
    expect(msg.toLowerCase()).toContain("conexão");
  });

  it("cai em mensagem genérica para erros desconhecidos sem vazar detalhes", () => {
    const msg = sanitizeAuthError(new Error("Database error looking up user X"));
    expect(msg).not.toContain("Database error");
    expect(msg).not.toContain("user X");
  });

  it("aceita erros que não são instâncias de Error", () => {
    const msg = sanitizeAuthError("some string error");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(10);
  });
});

import { describe, expect, it } from "vitest";
import { checkPassword, PASSWORD_POLICY } from "./passwordPolicy";

describe("password policy", () => {
  it("rejects empty password", () => {
    const r = checkPassword("");
    expect(r.ok).toBe(false);
    expect(r.lengthOk).toBe(false);
    expect(r.classesOk).toBe(false);
  });

  it("rejects short but otherwise strong", () => {
    // 3 classes but only 11 chars
    const r = checkPassword("Abcdef1234!");
    expect(r.lengthOk).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("rejects long but single-class", () => {
    const r = checkPassword("abcdefghijklmnop");
    expect(r.lengthOk).toBe(true);
    expect(r.classesOk).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("rejects long two-class (lower+digit)", () => {
    const r = checkPassword("abcdefghij12345");
    expect(r.classesOk).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("accepts three-class 12-char", () => {
    // upper + lower + digit (no symbol)
    const r = checkPassword("Abcdefghij12");
    expect(r.lengthOk).toBe(true);
    expect(r.classCount).toBe(3);
    expect(r.classesOk).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("accepts four-class strong password", () => {
    const r = checkPassword("Criatto2026!@");
    expect(r.ok).toBe(true);
    expect(r.hasUpper).toBe(true);
    expect(r.hasLower).toBe(true);
    expect(r.hasDigit).toBe(true);
    expect(r.hasSymbol).toBe(true);
    expect(r.classCount).toBe(4);
  });

  it("reports each class independently", () => {
    const r = checkPassword("HELLO world 123");
    expect(r.hasUpper).toBe(true);
    expect(r.hasLower).toBe(true);
    expect(r.hasDigit).toBe(true);
    // space is not alphanumeric, so counts as symbol
    expect(r.hasSymbol).toBe(true);
    expect(r.classCount).toBe(4);
  });

  it("detects lower-only password", () => {
    const r = checkPassword("abcdefghijkl");
    expect(r.hasLower).toBe(true);
    expect(r.hasUpper).toBe(false);
    expect(r.hasDigit).toBe(false);
    expect(r.hasSymbol).toBe(false);
    expect(r.classCount).toBe(1);
  });

  it("respects configured min length", () => {
    expect(PASSWORD_POLICY.minLength).toBe(12);
    expect(PASSWORD_POLICY.requiredClasses).toBe(3);
  });
});

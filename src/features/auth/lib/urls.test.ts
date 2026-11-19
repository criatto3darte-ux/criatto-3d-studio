import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { AUTH_CALLBACK_PATH, getRedirectUrl } from "./urls";

describe("auth urls", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("defines the expected callback path", () => {
    expect(AUTH_CALLBACK_PATH).toBe("/auth/callback");
  });

  it("getRedirectUrl (browser) returns a full URL ending with /auth/callback", () => {
    // jsdom provides window.location (http://localhost:3000)
    const url = getRedirectUrl();
    expect(url.endsWith(AUTH_CALLBACK_PATH)).toBe(true);
    expect(url.startsWith("http://") || url.startsWith("https://")).toBe(true);
  });

  it("getRedirectUrl uses a custom path when supplied", () => {
    const url = getRedirectUrl("/auth/done");
    expect(url.endsWith("/auth/done")).toBe(true);
  });

  it("strips trailing slashes when VITE_APP_URL is used in SSR", async () => {
    // Dynamic import after overriding window to simulate SSR (no window object).
    vi.resetModules();
    const windowSpy = vi
      .spyOn(globalThis, "window", "get")
      .mockImplementation(() => undefined as unknown as Window & typeof globalThis);
    vi.stubEnv("VITE_APP_URL", "https://admin-homolog.criatto3d.com/");
    const { getAppOrigin } = await import("./urls");
    expect(getAppOrigin()).toBe("https://admin-homolog.criatto3d.com");
    windowSpy.mockRestore();
  });

  it("throws in SSR if VITE_APP_URL is missing", async () => {
    vi.resetModules();
    const windowSpy = vi
      .spyOn(globalThis, "window", "get")
      .mockImplementation(() => undefined as unknown as Window & typeof globalThis);
    vi.stubEnv("VITE_APP_URL", "");
    const { getAppOrigin } = await import("./urls");
    expect(() => getAppOrigin()).toThrow(/VITE_APP_URL/);
    windowSpy.mockRestore();
  });
});

import { defineConfig, devices } from "@playwright/test";
import type { Theme } from "./support/test";

/**
 * Testes de ponta a ponta contra um site publicado.
 *   E2E_BASE_URL  https://homolog.criatto3d.art.br (padrão) ou a produção
 *   --grep @somente-leitura  → só testes que não gravam nada (produção)
 */
export default defineConfig<{ theme: Theme }>({
  testDir: ".",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : "list",
  outputDir: "../test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://homolog.criatto3d.art.br",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: process.env.CI ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
  },
  projects: [
    // Sistema no tema oposto de propósito: o tema escolhido na loja (salvo no
    // navegador) precisa vencer a preferência do aparelho.
    { name: "desktop-claro", use: { ...devices["Desktop Chrome"], theme: "light", colorScheme: "dark" } },
    { name: "desktop-escuro", use: { ...devices["Desktop Chrome"], theme: "dark", colorScheme: "light" } },
    { name: "celular-claro", use: { ...devices["Pixel 7"], theme: "light", colorScheme: "dark" } },
    { name: "celular-escuro", use: { ...devices["Pixel 7"], theme: "dark", colorScheme: "light" } },
  ],
});

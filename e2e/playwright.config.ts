import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta contra um site publicado.
 *   E2E_BASE_URL  https://homolog.criatto3d.art.br (padrão) ou a produção
 *   --grep @somente-leitura  → só testes que não gravam nada (produção)
 */
export default defineConfig({
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
    { name: "desktop-claro", use: { ...devices["Desktop Chrome"], colorScheme: "light" } },
    { name: "celular-escuro", use: { ...devices["Pixel 7"], colorScheme: "dark" } },
  ],
});

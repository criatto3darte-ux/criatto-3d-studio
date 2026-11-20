import { expect, type Page } from "@playwright/test";
import { totp, totpSecondsLeft } from "./totp";

/** Registra erros de JavaScript e respostas >= 400 do Supabase durante o teste. */
export function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`erro de página: ${error.message}`));
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes(".supabase.co/") && response.status() >= 400) {
      problems.push(`Supabase ${response.status()}: ${response.request().method()} ${url.split("?")[0]}`);
    }
  });
  return problems;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável ${name} não definida (cadastre o Secret no GitHub).`);
  return value;
}

/** Login no painel com senha + código do autenticador (AAL2). */
export async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail", { exact: true }).fill(requireEnv("E2E_ADMIN_EMAIL"));
  await page.getByLabel("Senha", { exact: true }).fill(requireEnv("E2E_ADMIN_PASSWORD"));
  await page.getByTestId("login-submit").click();
  const code = page.getByLabel("Código de 6 dígitos");
  await code.waitFor();
  // Evita um código que expira no meio do envio.
  if (totpSecondsLeft() < 5) await page.waitForTimeout(totpSecondsLeft() * 1000 + 500);
  await code.fill(totp(requireEnv("E2E_ADMIN_TOTP_SECRET")));
  await page.getByTestId("mfa-challenge-submit").click();
  await expect(page).toHaveURL(/\/admin(\/|$|\?)/);
  await expect(page.getByText("Pedidos do dia")).toBeVisible();
}

export const QA_PRODUCT_SLUG = process.env.E2E_QA_PRODUCT_SLUG ?? "produto-qa-e2e";
export const QA_PRODUCT_NAME = process.env.E2E_QA_PRODUCT_NAME ?? "Produto QA E2E";
export const QA_BANNER_TITLE = process.env.E2E_QA_BANNER_TITLE ?? "Banner QA E2E";

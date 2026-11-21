import { expect, test } from "./support/test";
import { watchProblems } from "./support/site";

// Não grava nada: pode rodar na produção depois de cada publicação.
test.describe("Loja e painel abrem sem erros @somente-leitura", () => {
  test("página inicial, catálogo, produto, carrinho e login do painel", async ({ page, theme }) => {
    const problems = watchProblems(page);

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("link", { name: /Explorar produtos/ }).first()).toBeVisible();
    // Logo oficial: "Criatto" preto no tema claro e branco no escuro.
    // (Um logo personalizado nas configurações substitui o oficial.)
    const officialLogo = page.locator('header img[src*="/branding/logo-full-"]').filter({ visible: true });
    if (await page.locator('header img[src*="/branding/logo-full-"]').count()) {
      await expect(officialLogo).toHaveCount(1);
      await expect(officialLogo).toHaveAttribute(
        "src",
        theme === "light" ? /logo-full-light/ : /logo-full-dark/,
      );
    }

    await page.goto("/produtos");
    await expect(page.getByRole("heading", { name: "Produtos" })).toBeVisible();
    await expect(page.getByText(/produtos? encontrados?/)).toBeVisible();

    const firstProduct = page.locator('a[href^="/produto/"]').first();
    if (await firstProduct.count()) {
      await firstProduct.click();
      await expect(page.getByText(/R\$\s?\d/).first()).toBeVisible();
    }

    await page.goto("/carrinho");
    await expect(page.locator("main")).toBeVisible();

    await page.goto("/contato");
    await expect(page.locator("main")).toBeVisible();

    await page.goto("/admin/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();

    expect(problems, problems.join("\n")).toEqual([]);
  });
});

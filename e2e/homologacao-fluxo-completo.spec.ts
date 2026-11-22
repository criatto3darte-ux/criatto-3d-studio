import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { solidPng } from "./support/png";
import {
  QA_BANNER_TITLE, QA_PRODUCT_NAME, QA_PRODUCT_SLUG, loginAdmin, watchProblems,
} from "./support/site";

// Grava dados (pedido, fotos): só na homologação, nunca na produção.
test.describe.configure({ mode: "serial" });

let orderNumber = 0;

function randomPhoneDigits(): string {
  return "219" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
}

test.describe("Fluxo completo da loja e do painel", () => {
  test.skip(({ baseURL }) => !/homolog|localhost/.test(baseURL ?? ""), "Grava dados: só na homologação.");
  // Um pedido e um upload por execução: roda só no projeto de desktop.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-claro", "Fluxo que grava dados roda uma vez por execução.");
  });

  test("cliente compra pelo checkout e recebe a mensagem do WhatsApp", async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto(`/produto/${QA_PRODUCT_SLUG}`);
    await expect(page.getByRole("heading", { name: QA_PRODUCT_NAME })).toBeVisible();
    await page.getByRole("button", { name: /Adicionar ao carrinho/ }).first().click();

    await page.goto("/carrinho");
    await expect(page.getByText(QA_PRODUCT_NAME).first()).toBeVisible();
    await page.getByRole("link", { name: /Finalizar pedido pelo WhatsApp/ }).first().click();

    await page.getByLabel("Nome completo").fill("Teste Automático QA");
    await page.getByLabel("WhatsApp com DDD").pressSequentially(randomPhoneDigits());
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole("button", { name: /Registrar e continuar pelo WhatsApp/ }).click();

    const confirmation = page.getByText(/Pedido #\d+ registrado!/);
    await expect(confirmation).toBeVisible();
    orderNumber = Number((await confirmation.textContent())?.match(/#(\d+)/)?.[1]);
    expect(orderNumber).toBeGreaterThan(0);

    const whatsapp = page.getByRole("link", { name: /Abrir WhatsApp/ }).first();
    const href = (await whatsapp.getAttribute("href")) ?? "";
    expect(href).toContain("wa.me/");
    const message = decodeURIComponent(href.split("text=")[1] ?? "");
    expect(message).toContain(`Pedido nº ${orderNumber}`);
    expect(message).toContain(QA_PRODUCT_NAME);
    expect(message).toMatch(/Subtotal: R\$ \d/);
    expect(message).not.toMatch(/Supabase|servidor/i);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("admin com MFA atende e cancela o pedido", async ({ page }) => {
    test.skip(!orderNumber, "Depende do pedido criado no teste anterior.");
    const problems = watchProblems(page);
    await loginAdmin(page);
    await page.goto("/admin/pedidos");
    await changeStatus(page, "em-atendimento", "Em atendimento", "Teste automático: em atendimento");
    await changeStatus(page, "cancelado", "Cancelado", "Teste automático: cancelamento devolve o estoque");
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("admin envia, publica e remove foto do produto", async ({ page, context }) => {
    const problems = watchProblems(page);
    await loginAdmin(page);
    await page.goto("/admin/produtos");
    await page.getByRole("button", { name: `Editar ${QA_PRODUCT_NAME}` }).first().click();
    const gallery = page.getByRole("region", { name: "Fotos do produto" });
    await gallery.waitFor();

    await gallery.locator('input[type="file"]').setInputFiles({
      name: "qa-produto.png", mimeType: "image/png", buffer: solidPng(480, 480, [0, 159, 181]),
    });
    await gallery.getByRole("button", { name: /Enviar foto/ }).click();
    await expect(gallery.getByText("Foto enviada com sucesso.")).toBeVisible();
    await expect(gallery.locator("article img")).toHaveCount(1);

    // A foto aparece na página pública do produto.
    const store = await context.newPage();
    await store.goto(`/produto/${QA_PRODUCT_SLUG}`);
    await expect(store.locator('img[src*="/storage/v1/object/public/catalog-images/products/"]').first()).toBeVisible();
    await store.close();

    page.once("dialog", (dialog) => void dialog.accept());
    await gallery.getByRole("button", { name: /Remover/ }).first().click();
    await expect(gallery.getByText("Foto removida.")).toBeVisible();
    await expect(gallery.getByText("Nenhuma foto cadastrada.")).toBeVisible();
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("admin grava peso e medidas da embalagem do produto (CR-019A)", async ({ page }) => {
    const problems = watchProblems(page);
    await loginAdmin(page);
    await page.goto("/admin/produtos");
    const edit = page.getByRole("button", { name: `Editar ${QA_PRODUCT_NAME}` }).first();

    await edit.click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Como informar").selectOption("medidas");
    await dialog.getByLabel("Peso com embalagem (g)").fill("250");
    await dialog.getByLabel("Altura (cm)").fill("10");
    await dialog.getByLabel("Largura (cm)").fill("12");
    await dialog.getByLabel("Comprimento (cm)").fill("15");
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialog).toBeHidden();

    // Os valores voltam do banco; depois o produto de QA volta a "Ainda não definido".
    await edit.click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Como informar")).toHaveValue("medidas");
    await expect(dialog.getByLabel("Peso com embalagem (g)")).toHaveValue("250");
    await expect(dialog.getByLabel("Comprimento (cm)")).toHaveValue("15");
    await dialog.getByLabel("Como informar").selectOption("nenhum");
    await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("admin envia e remove imagem do banner e alterna texto/logo no topo", async ({ page }) => {
    const problems = watchProblems(page);
    await loginAdmin(page);
    await page.goto("/admin/banners");

    await page.getByRole("button", { name: `Editar ${QA_BANNER_TITLE}` }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.locator("#banner-file").setInputFiles({
      name: "qa-banner.png", mimeType: "image/png", buffer: solidPng(1600, 900, [229, 0, 126]),
    });
    // CR-018: grava a opção "logo grande" junto com a imagem.
    await dialog.getByLabel(/Logo grande da loja/).check();
    await dialog.getByRole("button", { name: /^Salvar/ }).click();
    await expect(page.getByText("Banner salvo.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Editar ${QA_BANNER_TITLE}` }).first().click();
    dialog = page.getByRole("dialog");
    // A escolha voltou do banco; restaura "texto" e remove a imagem.
    await expect(dialog.getByLabel(/Logo grande da loja/)).toBeChecked();
    await dialog.getByLabel(/Texto do banner/).check();
    await dialog.getByLabel("Remover imagem atual").check();
    await dialog.getByRole("button", { name: /^Salvar/ }).click();
    await expect(
      page.getByText(/^Banner salvo\.$|limpeza física ficou pendente/),
    ).toBeVisible();

    await page.getByRole("button", { name: `Editar ${QA_BANNER_TITLE}` }).first().click();
    await expect(page.getByRole("dialog").getByLabel(/Texto do banner/)).toBeChecked();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

async function changeStatus(page: Page, status: string, label: string, note: string) {
  const row = page.getByRole("row").filter({ hasText: `#${orderNumber}` });
  await row.getByRole("button", { name: /Ver/ }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByText(`Pedido #${orderNumber}`)).toBeVisible();
  await modal.locator("#order-next-status").selectOption(status);
  await modal.locator("#order-change-note").fill(note);
  await modal.getByRole("button", { name: "Atualizar status" }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: `#${orderNumber}` })).toContainText(label);
}

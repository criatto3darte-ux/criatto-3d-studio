import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function css(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("CR-012A layout containment contracts", () => {
  it("keeps the shared container fluid without hiding horizontal defects", () => {
    const base = css("src/styles/base.css");
    expect(base).toContain("max-width: var(--container)");
    expect(base).toContain("min-width: 0");
    expect(base).not.toContain("overflow-x: hidden");
    expect(base).not.toContain("width: 100vw");
  });

  it("keeps cart, checkout and product grids shrinkable", () => {
    for (const file of [
      "src/features/store/pages/CartPage.module.css",
      "src/features/store/pages/CheckoutPage.module.css",
      "src/features/store/pages/ProductPage.module.css",
    ]) {
      expect(css(file)).toContain("minmax(0,");
      expect(css(file)).toContain("min-width: 0");
    }
  });

  it("gives admin dialogs a viewport cap and internal scrolling", () => {
    const admin = css("src/features/admin/ui/admin.module.css");
    expect(admin).toContain("max-height: calc(100dvh - 24px)");
    expect(admin).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(admin).toContain("overflow-y: auto");
  });

  it("keeps card and form grids valid at 320px", () => {
    expect(css("src/features/store/components/ProductCard.module.css"))
      .toContain("minmax(min(220px, 100%), 1fr)");
    expect(css("src/features/admin/ui/admin.module.css"))
      .toContain("minmax(min(220px, 100%), 1fr)");
  });
});

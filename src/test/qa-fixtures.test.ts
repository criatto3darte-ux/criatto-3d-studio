import { describe, expect, it } from "vitest";
import { isQaBanner, isQaProduct } from "@/features/admin/qa-fixtures";

describe("QA fixtures are recognized in the admin", () => {
  it("marks the robot banner even when its title is split or renamed partially", () => {
    expect(isQaBanner({ title: "Banner QA E2E", highlight: "" })).toBe(true);
    expect(isQaBanner({ title: "Banner", highlight: "QA E2E" })).toBe(true);
    expect(isQaBanner({ title: "Criatto", highlight: "3D" })).toBe(false);
  });

  it("marks the robot product by slug or name", () => {
    expect(isQaProduct({ slug: "produto-qa-e2e", name: "Outro nome" })).toBe(true);
    expect(isQaProduct({ slug: "x", name: "Produto QA E2E" })).toBe(true);
    expect(isQaProduct({ slug: "guirlanda", name: "Guirlanda" })).toBe(false);
  });
});

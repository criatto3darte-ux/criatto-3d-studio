import { describe, expect, it } from "vitest";
import { toCategory, toPublicProduct } from "@/features/catalog/supabase-catalog";

const categoryRow = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "vasos",
  name: "Vasos",
  description: "Peças para casa",
  display_order: 2,
};
const category = toCategory(categoryRow);
const categories = new Map([[categoryRow.id, category]]);
const productRow = {
  id: "22222222-2222-4222-8222-222222222222",
  category_id: categoryRow.id,
  slug: "vaso-autoirrigavel",
  name: "Vaso autoirrigável",
  description: "Descrição persistida",
  tags: ["casa"],
  regular_price_cents: "12500",
  promo_price_cents: "9900",
  production_mode: "pronta-entrega" as const,
  production_days: null,
  featured: true,
  badge: "novo",
};

describe("CR-010B Supabase catalog mapping", () => {
  it("maps only the public projection and does not invent images or stock quantities", () => {
    const product = toPublicProduct(productRow, categories, true, [], []);
    expect(product).toMatchObject({
      id: productRow.id,
      category: "vasos",
      priceCents: 12500,
      promoPriceCents: 9900,
      availability: "pronta-entrega",
      stock: 1,
      images: [],
      active: true,
      featured: true,
      badge: "Novo",
    });
  });

  it("hides products when no active category mapping is present", () => {
    expect(toPublicProduct(productRow, new Map(), true, [], [])).toBeNull();
  });

  it("maps sold-out and made-to-order availability without treating a demo seed as fallback", () => {
    expect(toPublicProduct(productRow, categories, false, [], [])?.availability).toBe(
      "indisponivel",
    );
    expect(
      toPublicProduct(
        { ...productRow, production_mode: "sob-demanda", production_days: 8 },
        categories,
        false,
        [],
        [],
      ),
    ).toMatchObject({
      availability: "sob-demanda",
      productionDays: 8,
      stock: 0,
    });
  });

  it("maps real variants from the public relational projection", () => {
    const groups = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        product_id: productRow.id,
        code: "cor",
        label: "Cor",
      },
    ];
    const options = [
      { id: "44444444-4444-4444-8444-444444444444", group_id: groups[0]!.id, label: "Preto" },
      { id: "55555555-5555-4555-8555-555555555555", group_id: groups[0]!.id, label: "Branco" },
    ];
    expect(toPublicProduct(productRow, categories, true, groups, options)?.variants).toEqual([
      { id: groups[0]!.id, name: "Cor", options: options.map(({ id, label }) => ({ id, label })) },
    ]);
  });
});

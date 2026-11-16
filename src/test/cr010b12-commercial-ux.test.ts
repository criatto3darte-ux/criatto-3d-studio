import { describe, expect, it } from "vitest";
import { toCategory, toPublicProduct } from "@/features/catalog/supabase-catalog";
import { validVariants, availableQuantity } from "@/features/cart/cart.stock";
import { buildSimpleVariants, extractSimpleVariants } from "@/features/catalog/product-variants.form";

const category = toCategory({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "testes", name: "Testes", description: "", display_order: 1,
});
const row = {
  id: "22222222-2222-4222-8222-222222222222",
  category_id: category.id!,
  slug: "chaveiro", name: "Chaveiro", description: "Produto simples",
  tags: [], regular_price_cents: 1500, promo_price_cents: null,
  production_mode: "pronta-entrega" as const,
  production_days: null, featured: false, badge: null,
};

describe("CR-010B.12 — Correções do catálogo comercial", () => {
  it("permite colocar produto simples e disponível no carrinho sem SKUs", () => {
    const product = toPublicProduct(row, new Map([[category.id!, category]]),
      true, [], [], [], []);
    expect(product).not.toBeNull();
    expect(product?.variantCombinations).toBeUndefined();
    expect(validVariants(product!, {})).toBe(true);
    expect(availableQuantity([], product!)).toBe(1);
  });

  it("mantém item esgotado indisponível", () => {
    const product = toPublicProduct(row, new Map([[category.id!, category]]),
      false, [], [], [], []);
    expect(product?.availability).toBe("indisponivel");
    expect(availableQuantity([], product!)).toBe(0);
  });

  it("gera combinações válidas de cores e tamanhos a partir do formulário", () => {
    const result = buildSimpleVariants({
      colors: "Azul, Vermelho", sizes: "P, M",
    }, "chaveiro");
    expect(result.groups).toHaveLength(2);
    expect(result.variants).toHaveLength(4);
    expect(result.variants[0]?.selections).toEqual({ cor: "azul", tamanho: "p" });
    expect(extractSimpleVariants(result.groups)).toEqual({
      colors: "Azul, Vermelho", sizes: "P, M",
    });
  });

  it("produto sem cores ou tamanhos não exige SKU", () => {
    expect(buildSimpleVariants({ colors: "", sizes: "" }, "chaveiro")).toEqual({
      groups: [], variants: [],
    });
  });
});

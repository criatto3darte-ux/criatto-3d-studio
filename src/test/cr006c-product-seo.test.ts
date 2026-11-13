import { describe, expect, it } from "vitest";
import { createSeed } from "@/features/demo-data/seed";
import { publicProducts } from "@/features/demo-data/rules";
import { productMetadata } from "@/features/catalog/product.metadata";

const seed = createSeed();
const first = seed.products[0];
if (!first) throw new Error("Missing product fixture");
const product = first;
const robots = (p: typeof product | undefined, browser = true) => productMetadata(p, product.slug, browser).meta.find((m) => m.name === "robots")?.content;

describe("CR-006C product publication and server limitations", () => {
  it("permits indexing an active product from the browser's public catalog", () => {
    expect(robots(publicProducts(seed).find((p) => p.id === product.id))).toBe("index, follow");
  });
  it("permits a newly published product, without depending on the original seed list", () => {
    const added = { ...product, id: "seo-new", slug: "seo-new", active: true };
    const result = publicProducts({ ...seed, products: [...seed.products, added] }).find((p) => p.slug === "seo-new");
    expect(result?.id).toBe("seo-new");
    expect(robots(result)).toBe("index, follow");
  });
  it("hides inactive products and prevents their indexing", () => {
    const result = publicProducts({ ...seed, products: [{ ...product, active: false }] }).find((p) => p.id === product.id);
    expect(result).toBeUndefined();
    expect(robots(result)).toBe("noindex, follow");
  });
  it("hides products in inactive categories and prevents their indexing", () => {
    const result = publicProducts({ ...seed, categories: seed.categories.map((c) => ({ ...c, active: c.slug !== product.category })) }).find((p) => p.id === product.id);
    expect(result).toBeUndefined();
    expect(robots(result)).toBe("noindex, follow");
  });
  it("prevents indexing a nonexistent product", () => {
    expect(robots(publicProducts(seed).find((p) => p.slug === "does-not-exist"))).toBe("noindex, follow");
  });
  it("does not certify browser-only publication state in initial server HTML", () => {
    expect(robots(product, false)).toBe("noindex, follow");
  });
  it("does not confuse stock unavailability with being unpublished", () => {
    const result = publicProducts({ ...seed, products: [{ ...product, active: true, availability: "indisponivel" }] })[0];
    expect(robots(result)).toBe("index, follow");
  });
});
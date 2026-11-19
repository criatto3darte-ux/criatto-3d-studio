import { slugify } from "@/features/demo-data/rules";
import type { AdminVariantGroupInput, AdminVariantInput } from "./supabase-catalog";

export interface SimpleVariants {
  colors: string;
  sizes: string;
}
export function extractSimpleVariants(groups: AdminVariantGroupInput[]): SimpleVariants {
  const list = (code: string) =>
    groups.find((group) => group.code === code)?.options
      .filter((option) => option.active)
      .map((option) => option.label).join(", ") ?? "";
  return { colors: list("cor"), sizes: list("tamanho") };
}
export function buildSimpleVariants(
  values: SimpleVariants,
  productSlug: string,
): { groups: AdminVariantGroupInput[]; variants: AdminVariantInput[] } {
  const parse = (value: string) => [...new Set(value.split(",")
    .map((text) => text.trim()).filter(Boolean))];
  const colors = parse(values.colors);
  const sizes = parse(values.sizes);
  if (colors.length > 30 || sizes.length > 30 || colors.length * Math.max(1, sizes.length) > 200) {
    throw new Error("Limite: até 30 cores, 30 tamanhos e 200 combinações.");
  }
  const groups: AdminVariantGroupInput[] = [];
  if (colors.length) groups.push({
    code: "cor", label: "Cor", position: 0, required: true,
    options: colors.map((label, position) => ({
      code: slugify(label), label, position, active: true,
    })),
  });
  if (sizes.length) groups.push({
    code: "tamanho", label: "Tamanho", position: 1, required: true,
    options: sizes.map((label, position) => ({
      code: slugify(label), label, position, active: true,
    })),
  });
  const variants: AdminVariantInput[] = groups.length
    ? (colors.length ? colors : [""]).flatMap((color) =>
      (sizes.length ? sizes : [""]).map((size) => ({
        sku: [productSlug, color, size].filter(Boolean).map(slugify).join("-").slice(0, 100),
        active: true,
        selections: {
          ...(color ? { cor: slugify(color) } : {}),
          ...(size ? { tamanho: slugify(size) } : {}),
        },
      })))
    : [];
  const codes = groups.flatMap((group) => group.options.map((option) => option.code));
  if (codes.some((code) => !code || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code))) {
    throw new Error("Revise os nomes das cores e tamanhos.");
  }
  const skus = variants.map((variant) => variant.sku);
  if (new Set(skus).size !== skus.length) {
    throw new Error("Duas combinações geraram o mesmo SKU. Use nomes diferentes.");
  }
  return { groups, variants };
}

/**
 * CR-019A — pure shipping configuration rules (no I/O).
 * The same limits are enforced by the database constraints in
 * supabase/migrations/20261122120000_cr019a_shipping_config.sql.
 */

export type ShippingSize = "P" | "M" | "G";
export const SHIPPING_SIZES: readonly ShippingSize[] = ["P", "M", "G"];

export interface PackageMeasures {
  weightG: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
}

/** How a product is packed for shipping. */
export type ProductShipping =
  | { mode: "nenhum" }
  | { mode: "tamanho"; size: ShippingSize }
  | ({ mode: "medidas" } & PackageMeasures);

export interface ShippingSettings {
  originCep: string;
  pickupEnabled: boolean;
  pickupAddress: string;
  pickupHours: string;
  localDeliveryEnabled: boolean;
  melhorEnvioEnabled: boolean;
  sizes: Record<ShippingSize, PackageMeasures | null>;
}

export interface DeliveryZone {
  id?: string;
  version?: number;
  name: string;
  cepStart: string;
  cepEnd: string;
  priceCents: number;
  deliveryDays: number;
  active: boolean;
  order: number;
}

export type FieldErrors = Record<string, string>;

export const LIMITS = {
  weightG: [1, 30000],
  cm: [1, 200],
  deliveryDays: [0, 30],
  priceCents: [0, 10_000_000],
} as const;

export const DEFAULT_ORIGIN_CEP = "25030058";

/** Keeps only digits; returns the 8-digit CEP or null when it is not one. */
export function normalizeCep(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return /^\d{8}$/.test(digits) ? digits : null;
}

export function formatCep(cep: string): string {
  const digits = cep.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : cep;
}

function intInRange(value: string, [min, max]: readonly [number, number]): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

export interface MeasuresInput {
  weightG: string;
  heightCm: string;
  widthCm: string;
  lengthCm: string;
}

export const EMPTY_MEASURES: MeasuresInput = { weightG: "", heightCm: "", widthCm: "", lengthCm: "" };

export function measuresToInput(m: PackageMeasures | null): MeasuresInput {
  return m
    ? { weightG: String(m.weightG), heightCm: String(m.heightCm), widthCm: String(m.widthCm), lengthCm: String(m.lengthCm) }
    : { ...EMPTY_MEASURES };
}

function isBlank(m: MeasuresInput): boolean {
  return !m.weightG.trim() && !m.heightCm.trim() && !m.widthCm.trim() && !m.lengthCm.trim();
}

/**
 * Parses the four package fields. All blank = null (not configured);
 * otherwise every field must be a whole number inside its limit.
 */
export function parseMeasures(
  input: MeasuresInput,
  prefix: string,
  errors: FieldErrors,
  required = false,
): PackageMeasures | null {
  if (isBlank(input)) {
    if (required) errors[`${prefix}weightG`] = "Informe peso e medidas.";
    return null;
  }
  const weightG = intInRange(input.weightG, LIMITS.weightG);
  const heightCm = intInRange(input.heightCm, LIMITS.cm);
  const widthCm = intInRange(input.widthCm, LIMITS.cm);
  const lengthCm = intInRange(input.lengthCm, LIMITS.cm);
  if (weightG === null) errors[`${prefix}weightG`] = "Peso em gramas, de 1 a 30000.";
  if (heightCm === null) errors[`${prefix}heightCm`] = "Altura em cm, de 1 a 200.";
  if (widthCm === null) errors[`${prefix}widthCm`] = "Largura em cm, de 1 a 200.";
  if (lengthCm === null) errors[`${prefix}lengthCm`] = "Comprimento em cm, de 1 a 200.";
  if (weightG === null || heightCm === null || widthCm === null || lengthCm === null) return null;
  return { weightG, heightCm, widthCm, lengthCm };
}

export interface ProductShippingInput {
  mode: ProductShipping["mode"];
  size: ShippingSize | "";
  measures: MeasuresInput;
}

export function productShippingToInput(value: ProductShipping): ProductShippingInput {
  if (value.mode === "tamanho") return { mode: "tamanho", size: value.size, measures: { ...EMPTY_MEASURES } };
  if (value.mode === "medidas") return { mode: "medidas", size: "", measures: measuresToInput(value) };
  return { mode: "nenhum", size: "", measures: { ...EMPTY_MEASURES } };
}

export function parseProductShipping(input: ProductShippingInput): {
  value: ProductShipping | null;
  errors: FieldErrors;
} {
  const errors: FieldErrors = {};
  if (input.mode === "nenhum") return { value: { mode: "nenhum" }, errors };
  if (input.mode === "tamanho") {
    if (!SHIPPING_SIZES.includes(input.size as ShippingSize)) {
      errors.shippingSize = "Escolha o tamanho P, M ou G.";
      return { value: null, errors };
    }
    return { value: { mode: "tamanho", size: input.size as ShippingSize }, errors };
  }
  const measures = parseMeasures(input.measures, "shipping.", errors, true);
  return { value: measures ? { mode: "medidas", ...measures } : null, errors };
}

/** Database columns for a product's shipping profile. */
export function productShippingColumns(value: ProductShipping): {
  shipping_size: ShippingSize | null;
  weight_g: number | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
} {
  if (value.mode === "medidas") {
    return { shipping_size: null, weight_g: value.weightG, height_cm: value.heightCm, width_cm: value.widthCm, length_cm: value.lengthCm };
  }
  return { shipping_size: value.mode === "tamanho" ? value.size : null, weight_g: null, height_cm: null, width_cm: null, length_cm: null };
}

export function productShippingFromRow(row: {
  shipping_size?: string | null;
  weight_g?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  length_cm?: number | null;
}): ProductShipping {
  if (row.weight_g && row.height_cm && row.width_cm && row.length_cm) {
    return { mode: "medidas", weightG: row.weight_g, heightCm: row.height_cm, widthCm: row.width_cm, lengthCm: row.length_cm };
  }
  if (row.shipping_size === "P" || row.shipping_size === "M" || row.shipping_size === "G") {
    return { mode: "tamanho", size: row.shipping_size };
  }
  return { mode: "nenhum" };
}

export function validateShippingSettings(settings: ShippingSettings): FieldErrors {
  const errors: FieldErrors = {};
  if (!normalizeCep(settings.originCep)) errors.originCep = "Informe um CEP com 8 números.";
  if (settings.pickupAddress.length > 300) errors.pickupAddress = "Use até 300 caracteres.";
  if (settings.pickupHours.length > 200) errors.pickupHours = "Use até 200 caracteres.";
  if (settings.pickupEnabled && !settings.pickupAddress.trim()) {
    errors.pickupAddress = "Informe o endereço de retirada.";
  }
  return errors;
}

/** Two active zones may not share a CEP: the checkout must find one price. */
export function zonesOverlap(a: Pick<DeliveryZone, "cepStart" | "cepEnd">, b: Pick<DeliveryZone, "cepStart" | "cepEnd">): boolean {
  return a.cepStart <= b.cepEnd && b.cepStart <= a.cepEnd;
}

export interface ZoneInput {
  name: string;
  cepStart: string;
  cepEnd: string;
  price: string;
  deliveryDays: string;
  active: boolean;
}

export function parseZone(
  input: ZoneInput,
  parsePrice: (value: string) => number,
  others: readonly DeliveryZone[],
  selfId?: string,
): { value: Omit<DeliveryZone, "order" | "id" | "version"> | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  if (!name || name.length > 80) errors.name = "Informe um nome de até 80 caracteres.";
  const cepStart = normalizeCep(input.cepStart);
  const cepEnd = normalizeCep(input.cepEnd);
  if (!cepStart) errors.cepStart = "CEP inicial com 8 números.";
  if (!cepEnd) errors.cepEnd = "CEP final com 8 números.";
  if (cepStart && cepEnd && cepStart > cepEnd) errors.cepEnd = "O CEP final deve ser maior ou igual ao inicial.";
  const priceCents = parsePrice(input.price);
  if (Number.isNaN(priceCents) || priceCents < LIMITS.priceCents[0] || priceCents > LIMITS.priceCents[1]) {
    errors.price = "Informe o valor (ex.: 15,00). Use 0 para entrega grátis.";
  }
  const deliveryDays = intInRange(input.deliveryDays, LIMITS.deliveryDays);
  if (deliveryDays === null) errors.deliveryDays = "Prazo em dias, de 0 a 30.";
  if (!errors.cepStart && !errors.cepEnd && input.active && cepStart && cepEnd) {
    const clash = others.find((zone) => zone.active && zone.id !== selfId &&
      zonesOverlap({ cepStart, cepEnd }, zone));
    if (clash) errors.cepStart = `Esta faixa cruza com a região "${clash.name}".`;
  }
  if (Object.keys(errors).length || !cepStart || !cepEnd || deliveryDays === null) {
    return { value: null, errors };
  }
  return { value: { name, cepStart, cepEnd, priceCents, deliveryDays, active: input.active }, errors };
}

/** Active zone covering the CEP (zones never overlap; first by order wins). */
export function findZoneForCep(cep: string, zones: readonly DeliveryZone[]): DeliveryZone | null {
  const normalized = normalizeCep(cep);
  if (!normalized) return null;
  return [...zones]
    .filter((zone) => zone.active)
    .sort((a, b) => a.order - b.order)
    .find((zone) => zone.cepStart <= normalized && normalized <= zone.cepEnd) ?? null;
}

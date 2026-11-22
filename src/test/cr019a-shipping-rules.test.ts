import { describe, expect, it } from "vitest";
import { parseMoney } from "@/features/admin/ui/AdminUI";
import {
  findZoneForCep,
  formatCep,
  normalizeCep,
  parseMeasures,
  parseProductShipping,
  parseZone,
  productShippingColumns,
  productShippingFromRow,
  validateShippingSettings,
  zonesOverlap,
  type DeliveryZone,
  type FieldErrors,
  type ShippingSettings,
} from "@/features/shipping/shipping.rules";

const settings: ShippingSettings = {
  originCep: "25030058",
  pickupEnabled: false,
  pickupAddress: "",
  pickupHours: "",
  localDeliveryEnabled: false,
  melhorEnvioEnabled: false,
  sizes: { P: null, M: null, G: null },
};

const centro: DeliveryZone = {
  id: "z1", name: "Centro", cepStart: "25010000", cepEnd: "25049999",
  priceCents: 1500, deliveryDays: 1, active: true, order: 1,
};

describe("CR-019A CEP helpers", () => {
  it("normalizes and formats CEPs", () => {
    expect(normalizeCep("25030-058")).toBe("25030058");
    expect(normalizeCep(" 25.030-058 ")).toBe("25030058");
    expect(normalizeCep("2503005")).toBeNull();
    expect(formatCep("25030058")).toBe("25030-058");
  });
});

describe("CR-019A shipping settings", () => {
  it("accepts the default origin and requires an address when pickup is on", () => {
    expect(validateShippingSettings(settings)).toEqual({});
    expect(validateShippingSettings({ ...settings, pickupEnabled: true }).pickupAddress)
      .toBe("Informe o endereço de retirada.");
    expect(validateShippingSettings({ ...settings, originCep: "123" }).originCep).toBeTruthy();
  });

  it("parses package measures all-or-nothing within limits", () => {
    const errors: FieldErrors = {};
    expect(parseMeasures({ weightG: "", heightCm: "", widthCm: "", lengthCm: "" }, "p.", errors)).toBeNull();
    expect(errors).toEqual({});
    expect(parseMeasures({ weightG: "300", heightCm: "10", widthCm: "12", lengthCm: "15" }, "p.", errors))
      .toEqual({ weightG: 300, heightCm: 10, widthCm: 12, lengthCm: 15 });
    const partial: FieldErrors = {};
    expect(parseMeasures({ weightG: "300", heightCm: "", widthCm: "12", lengthCm: "999" }, "p.", partial)).toBeNull();
    expect(Object.keys(partial).sort()).toEqual(["p.heightCm", "p.lengthCm"]);
  });
});

describe("CR-019A product shipping profile", () => {
  it("maps a standard size and full measures to exclusive columns", () => {
    expect(productShippingColumns({ mode: "tamanho", size: "M" })).toEqual({
      shipping_size: "M", weight_g: null, height_cm: null, width_cm: null, length_cm: null,
    });
    expect(productShippingColumns({ mode: "medidas", weightG: 250, heightCm: 10, widthCm: 12, lengthCm: 15 }))
      .toEqual({ shipping_size: null, weight_g: 250, height_cm: 10, width_cm: 12, length_cm: 15 });
    expect(productShippingColumns({ mode: "nenhum" }).shipping_size).toBeNull();
  });

  it("reads rows back and rejects incomplete input", () => {
    expect(productShippingFromRow({ shipping_size: "G" })).toEqual({ mode: "tamanho", size: "G" });
    expect(productShippingFromRow({ weight_g: 1, height_cm: 2, width_cm: 3, length_cm: 4 }).mode).toBe("medidas");
    expect(productShippingFromRow({}).mode).toBe("nenhum");
    expect(parseProductShipping({ mode: "tamanho", size: "", measures: { weightG: "", heightCm: "", widthCm: "", lengthCm: "" } }).errors.shippingSize)
      .toBeTruthy();
    expect(parseProductShipping({ mode: "medidas", size: "", measures: { weightG: "", heightCm: "", widthCm: "", lengthCm: "" } }).value)
      .toBeNull();
  });
});

describe("CR-019A local delivery zones", () => {
  it("validates a zone and blocks overlapping active ranges", () => {
    const ok = parseZone({ name: "Jardim", cepStart: "25050-000", cepEnd: "25059-999", price: "12,00", deliveryDays: "2", active: true }, parseMoney, [centro]);
    expect(ok.errors).toEqual({});
    expect(ok.value).toMatchObject({ cepStart: "25050000", priceCents: 1200, deliveryDays: 2 });

    const clash = parseZone({ name: "Outra", cepStart: "25040-000", cepEnd: "25060-000", price: "0", deliveryDays: "1", active: true }, parseMoney, [centro]);
    expect(clash.value).toBeNull();
    expect(clash.errors.cepStart).toContain("Centro");

    const inactive = parseZone({ name: "Outra", cepStart: "25040-000", cepEnd: "25060-000", price: "0", deliveryDays: "1", active: false }, parseMoney, [centro]);
    expect(inactive.errors).toEqual({});

    const self = parseZone({ name: "Centro", cepStart: "25010-000", cepEnd: "25049-999", price: "15,00", deliveryDays: "1", active: true }, parseMoney, [centro], "z1");
    expect(self.errors).toEqual({});
  });

  it("rejects reversed ranges, bad prices and days", () => {
    const bad = parseZone({ name: "", cepStart: "25060-000", cepEnd: "25050-000", price: "abc", deliveryDays: "31", active: true }, parseMoney, []);
    expect(Object.keys(bad.errors).sort()).toEqual(["cepEnd", "deliveryDays", "name", "price"]);
  });

  it("finds the active zone for a CEP", () => {
    const off = { ...centro, id: "z2", cepStart: "25050000", cepEnd: "25059999", active: false };
    expect(findZoneForCep("25030-058", [centro, off])?.name).toBe("Centro");
    expect(findZoneForCep("25055-000", [centro, off])).toBeNull();
    expect(findZoneForCep("xx", [centro])).toBeNull();
    expect(zonesOverlap(centro, { cepStart: "25049999", cepEnd: "25050000" })).toBe(true);
  });
});

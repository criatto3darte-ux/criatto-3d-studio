import { describe, expect, it } from "vitest";
import {
  EMPTY_ADDRESS,
  deliveryPayload,
  formatDeliveryDays,
  formatDeliveryPrice,
  maskCep,
  needsAddress,
  parseQuote,
  validateAddress,
} from "@/features/checkout/delivery.logic";
import { officialOrderWhatsAppUrl, orderPayload, type OfficialOrder } from "@/features/checkout/orders.service";
import type { CartItem } from "@/shared/types/cart";
import type { Product } from "@/shared/types/catalog";

const address = {
  cep: "25030-058", street: "Rua A", number: "10", complement: "Casa 2",
  district: "Centro", city: "Duque de Caxias", state: "rj",
};
const item: CartItem = {
  key: "k", productId: "11111111-1111-4111-8111-111111111111", slug: "vaso", name: "Vaso",
  image: "", unitPriceCents: 900, quantity: 1, variants: {},
} as unknown as CartItem;
const product = { id: item.productId, variants: [], variantCombinations: [] } as unknown as Product;
const customer = { name: "Maria Souza", phone: "(21) 99999-0000", notes: "", privacyAccepted: true };

describe("CR-019B delivery rules", () => {
  it("masks CEPs and knows which methods need an address", () => {
    expect(maskCep("25030058")).toBe("25030-058");
    expect(maskCep("2503")).toBe("2503");
    expect(needsAddress("retirada")).toBe(false);
    expect(needsAddress("entrega-local")).toBe(true);
    expect(needsAddress("a-combinar")).toBe(true);
  });

  it("validates the address and sends no price to the server", () => {
    expect(validateAddress(address)).toEqual({});
    expect(Object.keys(validateAddress(EMPTY_ADDRESS)).sort())
      .toEqual(["cep", "city", "district", "number", "state", "street"]);
    const payload = deliveryPayload("entrega-local", address);
    expect(payload).toMatchObject({ method: "entrega-local", cep: "25030058", state: "RJ" });
    expect(payload).not.toHaveProperty("priceCents");
    expect(deliveryPayload("retirada", address)).toEqual({ method: "retirada", cep: "25030058" });
  });

  it("formats prices and deadlines for the customer", () => {
    expect(formatDeliveryPrice(null)).toBe("A combinar");
    expect(formatDeliveryPrice(0)).toBe("Grátis");
    expect(formatDeliveryPrice(1500)).toContain("15,00");
    expect(formatDeliveryDays(0)).toBe("No mesmo dia útil");
    expect(formatDeliveryDays(3)).toBe("Em até 3 dias úteis");
    expect(formatDeliveryDays(null)).toContain("WhatsApp");
  });

  it("keeps only well-formed options from the server quote", () => {
    const options = parseQuote({ options: [
      { method: "retirada", label: "Retirada", priceCents: 0, days: 0, detail: "Rua X" },
      { method: "entrega-local", label: "Entrega local — Centro", priceCents: 1500, days: 1, detail: "" },
      { method: "a-combinar", label: "Envio a combinar", priceCents: null, days: null, detail: "" },
      { method: "drone", label: "x", priceCents: 1, days: 1 },
      { method: "entrega-local", label: "neg", priceCents: -5, days: 1 },
    ] });
    expect(options.map((o) => o.method)).toEqual(["retirada", "entrega-local", "a-combinar"]);
    expect(parseQuote(null)).toEqual([]);
  });
});

describe("CR-019B order payload and WhatsApp message", () => {
  it("requires a full address for delivery methods", () => {
    expect(() => orderPayload([item], [product], customer, crypto.randomUUID(),
      { method: "entrega-local", address: EMPTY_ADDRESS })).toThrow("endereço");
    const payload = orderPayload([item], [product], customer, crypto.randomUUID(),
      { method: "retirada", address: EMPTY_ADDRESS });
    expect(payload.delivery).toEqual({ method: "retirada", cep: "" });
  });

  it("puts delivery, address, shipping and total in the message", () => {
    const order: OfficialOrder = {
      orderId: "o", orderNumber: 12, subtotalCents: 900, shippingCents: 1500, totalCents: 2400,
      deliveryLabel: "Entrega local — Centro", deliveryDays: 1, whatsapp: "5521987640769",
      status: "aguardando-contato",
    };
    const url = officialOrderWhatsAppUrl(order, [item], customer,
      { method: "entrega-local", address: { ...address, state: "RJ" } })!;
    const text = decodeURIComponent(url.split("text=")[1]!);
    expect(text).toContain("Pedido nº 12");
    expect(text).toContain("Entrega: Entrega local — Centro");
    expect(text).toContain("Endereço: Rua A, 10, Casa 2 — Centro, Duque de Caxias/RJ — CEP 25030-058");
    expect(text).toMatch(/Frete: R\$\s?15,00/);
    expect(text).toMatch(/\*Total: R\$\s?24,00\*/);
    expect(text).not.toContain("a combinar");
  });

  it("keeps 'a combinar' when the server returns no shipping price", () => {
    const order: OfficialOrder = {
      orderId: "o", orderNumber: 13, subtotalCents: 900, shippingCents: null, totalCents: null,
      deliveryLabel: "Envio a combinar pelo WhatsApp", deliveryDays: null, whatsapp: "5521987640769",
      status: "aguardando-contato",
    };
    const text = decodeURIComponent(officialOrderWhatsAppUrl(order, [item], customer)!.split("text=")[1]!);
    expect(text).toContain("Frete: a combinar.");
    expect(text).not.toContain("Total:");
  });
});

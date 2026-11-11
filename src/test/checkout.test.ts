import { describe, expect, it } from "vitest";
import type { CartItem } from "@/shared/types/cart";
import { buildCustomRequestMessage, buildOrderMessage, buildWhatsAppUrl, demoOrderRef, isValidBusinessNumber, maskPhone, validateName, validatePhone } from "@/features/checkout/checkout.logic";

const items: CartItem[] = [
  { key: "a|Cor:Verde", productId: "a", name: "Vaso Baby Groot", unitPriceCents: 4990, quantity: 1, variants: { Cor: "Verde" } },
  { key: "b|Cor:Preto", productId: "b", name: "Organizador de Mesa", unitPriceCents: 3990, quantity: 2, variants: { Cor: "Preto" } },
];

describe("checkout rules", () => {
  it("masks phones", () => {
    expect(maskPhone("21999999999")).toBe("(21) 99999-9999");
    expect(maskPhone("2133334444")).toBe("(21) 3333-4444");
  });
  it("validates customer phone with DDD", () => {
    expect(validatePhone("(21) 99999-9999")).toBeNull();
    expect(validatePhone("(21) 89999-9999")).not.toBeNull();
    expect(validatePhone("99999-9999")).not.toBeNull();
    expect(validatePhone("")).toBe("Informe seu WhatsApp com DDD.");
  });
  it("requires a full name", () => {
    expect(validateName("João da Silva")).toBeNull();
    expect(validateName("João")).toBe("Informe nome e sobrenome.");
    expect(validateName("Jo4o Silva")).toBe("Use apenas letras no nome.");
    expect(validateName("   ")).toBe("Informe seu nome completo.");
  });
  it("builds the order message from cart values", () => {
    const msg = buildOrderMessage(items, { name: "João da Silva", phone: "21999999999", notes: "Gostaria de confirmar o prazo de fabricação." });
    expect(msg).toContain("*NOVO PEDIDO — CRIATTO 3D*");
    expect(msg).toContain("WhatsApp: (21) 99999-9999");
    expect(msg).toContain("2. Organizador de Mesa\nQuantidade: 2\nCor: Preto\nValor unitário: R$ 39,90\nSubtotal: R$ 79,80");
    expect(msg).toContain("*TOTAL ESTIMADO: R$ 129,70*");
    expect(msg).toContain("Frete: A combinar.");
    expect(msg).toContain("*OBSERVAÇÕES*\nGostaria de confirmar o prazo de fabricação.");
    expect(msg.endsWith("Olá! Gostaria de confirmar meu pedido com a Criatto 3D.")).toBe(true);
  });
  it("omits observations when empty", () => {
    expect(buildOrderMessage(items, { name: "Ana Souza", phone: "21999999999" })).not.toContain("OBSERVAÇÕES");
  });
  it("demo reference is deterministic and labelled DEMO", () => {
    expect(demoOrderRef(items)).toMatch(/^#DEMO-\d{6}$/);
    expect(demoOrderRef(items)).toBe(demoOrderRef([...items]));
  });
  it("refuses a missing or invalid store number", () => {
    expect(buildWhatsAppUrl("", "oi")).toBeNull();
    expect(buildWhatsAppUrl("21999999999", "oi")).toBeNull();
    expect(isValidBusinessNumber("5521999999999")).toBe(true);
  });
  it("encodes the message in the wa.me URL", () => {
    const url = buildWhatsAppUrl("5521999999999", "*Total*: R$ 10 & mais\nlinha #2")!;
    expect(url).toBe("https://wa.me/5521999999999?text=*Total*%3A%20R%24%2010%20%26%20mais%0Alinha%20%232");
    expect(decodeURIComponent(url.split("text=")[1]!)).toBe("*Total*: R$ 10 & mais\nlinha #2");
  });
  it("custom request asks to send the file in the chat", () => {
    const msg = buildCustomRequestMessage({ name: "Ana Souza", phone: "21999999999", description: "Chaveiro com nome", quantity: 3, colors: "Roxo", hasReferenceImage: true });
    expect(msg).toContain("Quantidade: 3");
    expect(msg).toContain("Cor: Roxo");
    expect(msg).toContain("vou enviá-la nesta conversa");
  });
});

import { describe, expect, it } from "vitest";
import { addItem, countItems, setQuantity, subtotalCents } from "@/features/cart/cart.logic";
import { isConfirmedSale } from "@/shared/types/order";
import { formatBRL, maskPhone } from "@/shared/utils/format";

const batman = { productId: "busto-batman", name: "Busto Batman", unitPriceCents: 8990, quantity: 1, variants: {} };

describe("carrinho", () => {
  it("soma quantidades do mesmo produto com as mesmas variações", () => {
    const items = addItem(addItem([], batman), batman);
    expect(items).toHaveLength(1);
    expect(countItems(items)).toBe(2);
    expect(subtotalCents(items)).toBe(17980);
  });

  it("separa o mesmo produto com variações diferentes", () => {
    const items = addItem(addItem([], { ...batman, variants: { cor: "preto" } }), { ...batman, variants: { cor: "cinza" } });
    expect(items).toHaveLength(2);
  });

  it("remove o item quando a quantidade chega a zero", () => {
    const items = addItem([], batman);
    expect(setQuantity(items, items[0]!.key, 0)).toHaveLength(0);
  });
});

describe("pedidos", () => {
  it("só conta como venda após confirmação administrativa", () => {
    expect(isConfirmedSale("aguardando-contato")).toBe(false);
    expect(isConfirmedSale("em-atendimento")).toBe(false);
    expect(isConfirmedSale("cancelado")).toBe(false);
    expect(isConfirmedSale("confirmado")).toBe(true);
  });
});

describe("formatação", () => {
  it("formata preços em reais", () => {
    expect(formatBRL(8990)).toBe("R$ 89,90");
  });
  it("mascara o WhatsApp na listagem", () => {
    expect(maskPhone("11987654321")).toBe("(11) *****-4321");
  });
});

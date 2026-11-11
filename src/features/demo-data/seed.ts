import { categories } from "@/features/catalog/categories";
import { demoProducts } from "@/features/catalog/products.mock";
import type { OrderStatus } from "@/shared/types/order";
import type { DemoCustomer, DemoData, DemoOrder, OrderItemSnapshot } from "./model";

/**
 * DEMONSTRAÇÃO: dados iniciais fictícios. Nenhum nome, telefone ou pedido é real.
 * Datas são relativas ao dia em que a demonstração é carregada/restaurada.
 */
const customerNames = [
  "Cliente Demo Ana", "Cliente Demo Bruno", "Cliente Demo Carla", "Cliente Demo Diego",
  "Cliente Demo Elisa", "Cliente Demo Fábio", "Cliente Demo Gabi", "Cliente Demo Hugo",
];

type OrderSeed = [daysAgo: number, hour: number, customer: number, status: OrderStatus, items: [productId: string, qty: number][], shippingCents: number, received?: boolean];
const orderSeeds: OrderSeed[] = [
  [0, 9, 0, "aguardando-contato", [["p01", 1]], 0],
  [0, 11, 1, "em-atendimento", [["p04", 2], ["p06", 1]], 1500],
  [0, 14, 2, "aguardando-contato", [["p17", 5]], 0],
  [1, 10, 3, "confirmado", [["p10", 2]], 2000],
  [1, 16, 4, "em-producao", [["p18", 1]], 1800],
  [2, 13, 5, "pronto-para-entrega", [["p07", 1], ["p15", 2]], 0],
  [3, 15, 6, "enviado", [["p05", 1]], 2500, true],
  [4, 12, 7, "concluido", [["p04", 1], ["p13", 1]], 1500, true],
  [5, 9, 0, "cancelado", [["p02", 1]], 0],
  [6, 17, 1, "concluido", [["p01", 2]], 2200, true],
  [9, 10, 2, "concluido", [["p14", 1], ["p10", 1]], 1800, true],
  [12, 11, 3, "confirmado", [["p17", 10]], 0],
  [18, 14, 4, "concluido", [["p05", 1], ["p06", 2]], 2000, true],
  [24, 16, 5, "cancelado", [["p09", 3]], 0],
];

function at(base: Date, daysAgo: number, hour: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function snapshot(productId: string, quantity: number): OrderItemSnapshot {
  const p = demoProducts.find((x) => x.id === productId)!;
  const variants = Object.fromEntries(p.variants.map((g) => [g.name, g.options[0]?.label ?? ""]));
  return { productId, name: p.name, unitPriceCents: p.priceCents, quantity, variants };
}

export function createSeed(now: Date = new Date()): DemoData {
  const customers: DemoCustomer[] = customerNames.map((name, i) => ({
    id: `c${String(i + 1).padStart(2, "0")}`,
    name,
    phone: `0090000${String(1400 + i * 7).padStart(4, "0")}`,
    createdAt: at(now, 40 - i * 3, 10),
    notes: "",
  }));

  const orders: DemoOrder[] = orderSeeds.map(([daysAgo, hour, c, status, items, shippingCents, received], i) => {
    const createdAt = at(now, daysAgo, hour);
    return {
      id: `o${String(i + 1).padStart(2, "0")}`,
      number: `DEMO-${4580 + orderSeeds.length - i}`,
      createdAt,
      customerId: customers[c]!.id,
      items: items.map(([pid, q]) => snapshot(pid, q)),
      shippingCents,
      status,
      notes: "",
      paymentReceived: !!received,
      history: status === "aguardando-contato"
        ? [{ at: createdAt, to: "aguardando-contato", note: "Pedido iniciado (demonstração)" }]
        : [{ at: createdAt, to: "aguardando-contato", note: "Pedido iniciado (demonstração)" }, { at: createdAt, from: "aguardando-contato", to: status }],
    };
  });

  return {
    products: demoProducts.map((p) => ({ ...p, variants: p.variants.map((g) => ({ ...g, options: [...g.options] })), tags: [...p.tags], images: [...p.images] })),
    categories: categories.map((c) => ({ ...c })),
    orders,
    customers,
    customRequests: [
      { id: "r01", createdAt: at(now, 0, 10), customerName: "Cliente Demo Ana", productName: "Miniatura de pet", description: "Miniatura do meu cachorro a partir de fotos.", color: "Caramelo", dimensions: "10 cm de altura", quantity: 1, referenceImage: "", status: "recebida", quoteCents: null },
      { id: "r02", createdAt: at(now, 2, 15), customerName: "Cliente Demo Bruno", productName: "Peça de reposição", description: "Engrenagem de batedeira (modelo fictício).", color: "Branco", dimensions: "Ø 4 cm", quantity: 2, referenceImage: "", status: "em-analise", quoteCents: null },
      { id: "r03", createdAt: at(now, 6, 11), customerName: "Cliente Demo Carla", productName: "Topo de bolo", description: "Topo de bolo com nome e idade.", color: "Dourado", dimensions: "15 × 8 cm", quantity: 1, referenceImage: "", status: "orcamento-enviado", quoteCents: 4500 },
    ],
    banners: [
      { id: "b01", title: "Suas ideias", highlight: "ganham forma.", subtitle: "Produtos 3D criativos para transformar seu dia a dia.", image: "", buttonText: "Explorar produtos", buttonUrl: "/produtos", order: 1, active: true },
    ],
    coupons: [
      { id: "k01", code: "DEMO10", kind: "percentual", value: 10, startsAt: at(now, 5, 0).slice(0, 10), endsAt: at(now, -25, 0).slice(0, 10), active: true, usageLimit: 50 },
    ],
    settings: {
      name: "Criatto 3D",
      logo: "",
      whatsappNumber: "",
      email: "",
      instagram: "",
      tiktok: "",
      address: "",
      deliveryInfo: "",
      offersNationalShipping: false,
      serviceMessage: "",
    },
  };
}

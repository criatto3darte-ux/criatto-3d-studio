import type { Product, ProductVariantGroup } from "@/shared/types/catalog";

/**
 * DEMONSTRAÇÃO: produtos fictícios para visualizar a loja. Preços, estoques e prazos
 * não são reais. Serão substituídos pelos dados do servidor em etapa futura.
 */
const cores = (...labels: string[]): ProductVariantGroup => ({
  id: "cor",
  name: "Cor",
  options: labels.map((l) => ({ id: l.toLowerCase(), label: l })),
});
const tamanhos = (...labels: string[]): ProductVariantGroup => ({
  id: "tamanho",
  name: "Tamanho",
  options: labels.map((l) => ({ id: l.toLowerCase(), label: l })),
});

type Seed = Omit<Product, "images" | "tags"> & { tags?: string[] };
const seeds: Seed[] = [
  { id: "p01", slug: "luminaria-lua", name: "Luminária Lua", category: "decoracao", description: "Luminária com textura de superfície lunar e luz quente difusa.", priceCents: 12990, badge: "Mais Vendido", availability: "pronta-entrega", stock: 8, featured: true, variants: [tamanhos("P", "M", "G")], tags: ["luz", "abajur"] },
  { id: "p02", slug: "escultura-onda", name: "Escultura Onda", category: "decoracao", description: "Escultura de linhas fluidas para estantes e mesas.", priceCents: 7990, badge: "Novo", availability: "sob-demanda", productionDays: 5, stock: 0, featured: false, variants: [cores("Branco", "Preto", "Ciano")] },
  { id: "p03", slug: "porta-retrato-hexagonal", name: "Porta-retrato Hexagonal", category: "decoracao", description: "Porta-retrato em formato hexagonal para fotos 10×15.", priceCents: 4990, availability: "pronta-entrega", stock: 15, featured: false, variants: [cores("Branco", "Preto", "Roxo")] },
  { id: "p04", slug: "dragao-articulado", name: "Dragão Articulado", category: "geek-nerd", description: "Dragão com articulações impressas em peça única, sem montagem.", priceCents: 8990, badge: "Mais Vendido", availability: "pronta-entrega", stock: 12, featured: true, variants: [cores("Roxo", "Laranja", "Ciano"), tamanhos("M", "G")], tags: ["brinquedo", "articulado"] },
  { id: "p05", slug: "suporte-headset", name: "Suporte para Headset", category: "geek-nerd", description: "Suporte de mesa estável para headsets e fones grandes.", priceCents: 6990, badge: "Destaque", availability: "pronta-entrega", stock: 6, featured: true, variants: [cores("Preto", "Branco")], tags: ["gamer", "fone"] },
  { id: "p06", slug: "suporte-controle", name: "Suporte para Controle", category: "geek-nerd", description: "Apoio para dois controles de videogame.", priceCents: 3990, badge: "Novo", availability: "pronta-entrega", stock: 20, featured: false, variants: [cores("Preto", "Branco", "Roxo")], tags: ["gamer"] },
  { id: "p07", slug: "organizador-mesa-modular", name: "Organizador de Mesa Modular", category: "casa-organizacao", description: "Módulos encaixáveis para canetas, clipes e celular.", priceCents: 5990, badge: "Destaque", availability: "pronta-entrega", stock: 10, featured: true, variants: [cores("Branco", "Preto", "Ciano")], tags: ["escritório"] },
  { id: "p08", slug: "organizador-cabos", name: "Organizador de Cabos (kit 6)", category: "casa-organizacao", description: "Clipes adesivos para manter os cabos no lugar.", priceCents: 2490, availability: "indisponivel", stock: 0, featured: false, variants: [cores("Preto", "Branco")] },
  { id: "p09", slug: "gancho-parede", name: "Gancho de Parede Minimalista", category: "casa-organizacao", description: "Gancho discreto para chaves, bolsas e toalhas.", priceCents: 1990, availability: "pronta-entrega", stock: 30, featured: false, variants: [cores("Branco", "Preto")] },
  { id: "p10", slug: "vaso-geometrico", name: "Vaso Geométrico Low Poly", category: "vasos-jardinagem", description: "Vaso facetado com furo de drenagem e pratinho.", priceCents: 5490, badge: "Mais Vendido", availability: "pronta-entrega", stock: 9, featured: true, variants: [cores("Branco", "Laranja", "Ciano"), tamanhos("P", "M", "G")], tags: ["planta", "suculenta"] },
  { id: "p11", slug: "vaso-autoirrigavel", name: "Vaso Autoirrigável", category: "vasos-jardinagem", description: "Reservatório interno que mantém a terra úmida por mais tempo.", priceCents: 6490, badge: "Novo", availability: "sob-demanda", productionDays: 4, stock: 0, featured: false, variants: [cores("Branco", "Preto"), tamanhos("M", "G")], tags: ["planta"] },
  { id: "p12", slug: "cachepo-facetado", name: "Cachepô Facetado", category: "vasos-jardinagem", description: "Cachepô decorativo para vasos de até 12 cm.", priceCents: 3990, availability: "pronta-entrega", stock: 4, featured: false, variants: [cores("Branco", "Roxo")] },
  { id: "p13", slug: "caixa-presente-coracao", name: "Caixa Presente Coração", category: "presentes", description: "Caixinha com tampa em formato de coração.", priceCents: 3490, badge: "Novo", availability: "pronta-entrega", stock: 14, featured: false, variants: [cores("Roxo", "Laranja", "Branco")], tags: ["namorados"] },
  { id: "p14", slug: "porta-copos-hexagonal", name: "Porta-copos Hexagonal (kit 4)", category: "presentes", description: "Kit com quatro porta-copos e suporte.", priceCents: 4490, availability: "pronta-entrega", stock: 11, featured: true, variants: [cores("Preto", "Ciano", "Laranja")] },
  { id: "p15", slug: "suporte-celular-dobravel", name: "Suporte de Celular Dobrável", category: "utilitarios", description: "Suporte com três ângulos que cabe no bolso.", priceCents: 2990, availability: "pronta-entrega", stock: 25, featured: false, variants: [cores("Preto", "Branco", "Ciano")] },
  { id: "p16", slug: "porta-canetas-hexagonal", name: "Porta-canetas Hexagonal", category: "utilitarios", description: "Porta-canetas com base pesada e textura geométrica.", priceCents: 2790, badge: "Novo", availability: "sob-demanda", productionDays: 3, stock: 0, featured: false, variants: [cores("Preto", "Branco", "Roxo")] },
  { id: "p17", slug: "chaveiro-personalizado", name: "Chaveiro Personalizado", category: "personalizados", description: "Chaveiro com o nome ou texto que você escolher.", priceCents: 1990, badge: "Mais Vendido", availability: "sob-demanda", productionDays: 3, stock: 0, featured: true, variants: [cores("Preto", "Branco", "Laranja", "Ciano")], tags: ["nome", "lembrança"] },
  { id: "p18", slug: "placa-nome", name: "Placa com Nome", category: "personalizados", description: "Placa decorativa com nome em relevo para portas e quartos.", priceCents: 6990, availability: "sob-demanda", productionDays: 6, stock: 0, featured: false, variants: [cores("Branco", "Roxo", "Ciano"), tamanhos("P", "M")], tags: ["nome", "quarto"] },
];

export const demoProducts: Product[] = seeds.map((s) => ({ ...s, tags: s.tags ?? [], images: [] }));

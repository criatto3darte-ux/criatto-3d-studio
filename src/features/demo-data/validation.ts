import { z } from "zod";
import { safeEmail, safeSocialUrl, safeUrl } from "@/shared/utils/safe-url";
import { isValidBusinessNumber } from "@/features/checkout/checkout.logic";
import type { DemoData } from "./model";

const text = z.string().max(1000);
const id = z.string().min(1).max(100);
const slug = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = integer.refine((n) => n > 0);
const date = z.string().datetime({ offset: true });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(s); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const media = z.string().refine((v) => v === "" || !!safeUrl(v));
const status = z.enum(["aguardando-contato", "em-atendimento", "confirmado", "em-producao", "pronto-para-entrega", "enviado", "concluido", "cancelado"]);
const unique = <T,>(list: T[], key: (item: T) => string) => new Set(list.map(key)).size === list.length;
const variant = z.object({ id, name: z.enum(["Cor", "Tamanho", "Acabamento"]), options: z.array(z.object({ id, label: id })).min(1).max(100).refine((a) => unique(a, (v) => v.id)) });
const product = z.object({
  id, slug, name: z.string().trim().min(2).max(100), category: slug, tags: z.array(text).max(100), description: text,
  priceCents: positive, promoPriceCents: positive.optional(), images: z.array(media).max(100),
  badge: z.enum(["Mais Vendido", "Novo", "Destaque"]).optional(), availability: z.enum(["pronta-entrega", "sob-demanda", "indisponivel"]),
  productionDays: positive.optional(), stock: integer, featured: z.boolean(), active: z.boolean(),
  variants: z.array(variant).max(10).refine((a) => unique(a, (v) => v.id) && unique(a, (v) => v.name)),
}).refine((p) => p.promoPriceCents === undefined || p.promoPriceCents < p.priceCents)
  .refine((p) => p.availability !== "sob-demanda" || p.productionDays !== undefined);
const category = z.object({ slug, name: z.string().trim().min(2).max(100), description: text, image: media.optional(), active: z.boolean(), order: integer });
const customer = z.object({ id, name: z.string().trim().min(2).max(100), phone: z.string().regex(/^\d{10,13}$/), createdAt: date, notes: text });
const item = z.object({ productId: id, name: id, unitPriceCents: integer, quantity: positive, variants: z.record(id, id).refine((v) => Object.keys(v).length <= 10) });
const order = z.object({ id, number: id, createdAt: date, customerId: id, items: z.array(item).min(1).max(1000), shippingCents: integer, status, notes: text, paymentReceived: z.boolean(),
  history: z.array(z.object({ at: date, from: status.optional(), to: status, note: text.optional() })).min(1).max(1000),
}).refine((o) => o.history.at(-1)?.to === o.status && Number.isSafeInteger(o.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, o.shippingCents)))
  .refine((o) => o.history.every((h, i) => i === 0 || (h.from === o.history[i - 1]?.to && h.at >= (o.history[i - 1]?.at ?? ""))));
const request = z.object({ id, createdAt: date, customerName: id, productName: id, description: text, color: text, dimensions: text, quantity: positive, referenceImage: media,
  status: z.enum(["recebida", "em-analise", "orcamento-enviado", "aprovado", "em-producao", "concluido", "cancelado"]), quoteCents: integer.nullable() });
const banner = z.object({ id, title: z.string().trim().min(2), highlight: text, subtitle: z.string().max(160), image: media, buttonText: z.string().trim().min(1).max(100), buttonUrl: z.string().refine((v) => !!safeUrl(v)), order: integer, active: z.boolean() })
  .refine((b) => b.title.length + b.highlight.length <= 80);
const coupon = z.object({ id, code: z.string().regex(/^[A-Z0-9]{3,20}$/), kind: z.enum(["percentual", "fixo"]), value: positive, startsAt: day, endsAt: day, active: z.boolean(), usageLimit: positive.nullable() })
  .refine((c) => c.endsAt >= c.startsAt && (c.kind !== "percentual" || c.value <= 100));
const settingFields = {
  name: z.string().trim().min(2).max(100), logo: media,
  whatsappNumber: z.string().refine((v) => !v || isValidBusinessNumber(v)), email: z.string().refine((v) => !v || !!safeEmail(v)),
  instagram: z.string().refine((v) => !v || !!safeSocialUrl(v, "instagram")), tiktok: z.string().refine((v) => !v || !!safeSocialUrl(v, "tiktok")),
  address: text, deliveryInfo: z.string().max(500), offersNationalShipping: z.boolean(), serviceMessage: z.string().max(500),
};
const schemas = { products: product, categories: category, customers: customer, orders: order, customRequests: request, banners: banner, coupons: coupon };
const dataSchema = z.object({ products: z.array(product), categories: z.array(category), customers: z.array(customer), orders: z.array(order), customRequests: z.array(request), banners: z.array(banner), coupons: z.array(coupon), settings: z.object(settingFields) })
  .superRefine((d, ctx) => {
    for (const key of Object.keys(schemas) as (keyof typeof schemas)[]) {
      const list = d[key];
      const keys = list.map((v) => "id" in v ? v.id : v.slug);
      if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", path: [key], message: "Identificadores duplicados" });
    }
    if (!unique(d.products, (p) => p.slug) || !unique(d.coupons, (c) => c.code) || !unique(d.orders, (o) => o.number)) ctx.addIssue({ code: "custom", message: "Chaves duplicadas" });
    if (d.products.some((p) => !d.categories.some((c) => c.slug === p.category)) || d.orders.some((o) => !d.customers.some((c) => c.id === o.customerId))) ctx.addIssue({ code: "custom", message: "Referência inexistente" });
  });

export function isValidDemoData(value: unknown): value is DemoData { return dataSchema.safeParse(value).success; }

/** Recover each independent record; never seed missing collections or rewrite the original storage. */
export function recoverDemoData(value: unknown, fallback: DemoData): { data: DemoData; issues: string[] } {
  // JSON round-trip removes explicitly undefined optional fields (exactOptionalPropertyTypes).
  if (isValidDemoData(value)) return { data: JSON.parse(JSON.stringify(dataSchema.parse(value))) as DemoData, issues: [] };
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, unknown> = {};
  const issues: string[] = [];
  for (const key of Object.keys(schemas) as (keyof typeof schemas)[]) {
    const raw = source[key]; const list: unknown[] = []; const ids = new Set<string>(); const alternate = new Set<string>();
    if (!Array.isArray(raw)) issues.push(`${key}: coleção ausente ou inválida`);
    else raw.forEach((entry, index) => {
      const parsed = schemas[key].safeParse(entry);
      if (!parsed.success) { issues.push(`${key}[${index}]: registro inválido`); return; }
      const v = parsed.data; const identifier = "id" in v ? v.id : v.slug;
      const extra = "code" in v ? v.code : "number" in v ? v.number : "slug" in v ? v.slug : identifier;
      if (ids.has(identifier) || alternate.has(extra)) { issues.push(`${key}[${index}]: duplicado`); return; }
      ids.add(identifier); alternate.add(extra); list.push(v);
    });
    result[key] = list;
  }
  const settings = source.settings && typeof source.settings === "object" ? source.settings as Record<string, unknown> : {};
  result.settings = Object.fromEntries(Object.entries(settingFields).map(([key, schema]) => {
    const parsed = schema.safeParse(settings[key]);
    if (!parsed.success) issues.push(`settings.${key}: campo inválido`);
    return [key, parsed.success ? parsed.data : fallback.settings[key as keyof DemoData["settings"]]];
  }));
  const recovered = result as unknown as DemoData;
  recovered.products = recovered.products.filter((p) => {
    const valid = recovered.categories.some((c) => c.slug === p.category); if (!valid) issues.push(`products: categoria inexistente`); return valid;
  });
  recovered.orders = recovered.orders.filter((o) => {
    const valid = recovered.customers.some((c) => c.id === o.customerId); if (!valid) issues.push(`orders: cliente inexistente`); return valid;
  });
  return { data: recovered, issues };
}
// CR-019B — Public shipping quote for the checkout (no account).
// Returns only the delivery options the store configured for this CEP:
// pickup, local delivery by CEP range and "a combinar". Prices come from the
// database (shipping_options, service_role only); nothing is written.
import { createClient } from "npm:@supabase/supabase-js@2.76.1";

function apiKey(jsonVar: string, legacyVar: string): string {
  try {
    const value = (JSON.parse(Deno.env.get(jsonVar) ?? "{}") as Record<string, unknown>).default;
    if (typeof value === "string" && value) return value;
  } catch { /* malformed JSON: use the legacy variable */ }
  return Deno.env.get(legacyVar) ?? "";
}
const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = apiKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const origins = new Set(
  (Deno.env.get("CHECKOUT_ALLOWED_ORIGINS") ??
    "https://homolog.criatto3d.art.br,http://localhost:5173")
    .split(",").map((s) => s.trim()).filter(Boolean),
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey,authorization,content-type,x-client-info",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function output(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return output(req, 405, { error: "Método inválido." });
  const origin = req.headers.get("origin");
  if (origin && !origins.has(origin)) return output(req, 403, { error: "Origem não autorizada." });
  if (!url || !serviceKey) return output(req, 503, { error: "Cálculo de frete indisponível." });
  const text = await req.text();
  if (!text || text.length > 4000) return output(req, 413, { error: "Consulta inválida." });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return output(req, 400, { error: "Consulta inválida." }); }
  const payload = (body && typeof body === "object" && !Array.isArray(body)) ? body as Record<string, unknown> : {};
  const cep = typeof payload.cep === "string" ? payload.cep.replace(/\D/g, "") : "";
  if (!/^\d{8}$/.test(cep)) return output(req, 400, { error: "Informe um CEP com 8 números." });
  const items = Array.isArray(payload.items) ? payload.items.slice(0, 20) : [];
  const productIds = items
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).productId : null))
    .filter((id): id is string => typeof id === "string" && UUID.test(id))
    .map((productId) => ({ productId }));

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await service.rpc("shipping_options", { p_cep: cep, p_items: productIds });
  if (error || !Array.isArray(data)) return output(req, 503, { error: "Não foi possível calcular o frete agora." });
  const options = data.flatMap((option: Record<string, unknown>) => {
    const method = option.method;
    if (method !== "retirada" && method !== "entrega-local" && method !== "a-combinar") return [];
    return [{
      method,
      label: String(option.label ?? ""),
      priceCents: option.priceCents === null ? null : Number(option.priceCents),
      days: option.days === null ? null : Number(option.days),
      detail: String(option.detail ?? ""),
    }];
  });
  return output(req, 200, { cep, options });
});

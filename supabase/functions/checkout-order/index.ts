// CR-010C.1 — Public no-account checkout. PREPARED ONLY.
// Requires CHECKOUT_RATE_PEPPER and validated PG17 order migration.
import { createClient } from "npm:@supabase/supabase-js@2.76.1";
// Supabase API keys: prefer the new JSON env vars (named key "default") and
// fall back to the legacy single-string vars only while they still exist.
function apiKey(jsonVar: string, legacyVar: string): { key: string; source: string } {
  try {
    const value = (JSON.parse(Deno.env.get(jsonVar) ?? "{}") as Record<string, unknown>)
      .default;
    if (typeof value === "string" && value) return { key: value, source: jsonVar };
  } catch { /* malformed JSON: use the legacy variable */ }
  const legacy = Deno.env.get(legacyVar) ?? "";
  return { key: legacy, source: legacy ? legacyVar : "missing" };
}
const url = Deno.env.get("SUPABASE_URL") ?? "";
const secret = apiKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const serviceKey = secret.key;
console.info(`checkout-order: secret key from ${secret.source}`);
const pepper = Deno.env.get("CHECKOUT_RATE_PEPPER") ?? "";
const origins = new Set(
  (Deno.env.get("CHECKOUT_ALLOWED_ORIGINS") ??
    "https://homolog.criatto3d.art.br,http://localhost:5173")
    .split(",").map((s) => s.trim()).filter(Boolean),
);
const PHONE = /^\+55[1-9][0-9]{9,10}$/;
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
async function sha256(str: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)));
  return Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return output(req, 405, { error: "Método inválido." });
  const origin = req.headers.get("origin");
  if (origin && !origins.has(origin)) return output(req, 403, { error: "Origem não autorizada." });
  if (!url || !serviceKey || pepper.length < 32) {
    return output(req, 503, { error: "Checkout ainda não configurado." });
  }
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return output(req, 415, { error: "Use JSON para enviar o pedido." });
  }
  const bodyText = await req.text();
  if (!bodyText || bodyText.length > 14000) {
    return output(req, 413, { error: "Pedido ultrapassa o limite permitido." });
  }
  let body: unknown;
  try { body = JSON.parse(bodyText); }
  catch { return output(req, 400, { error: "Pedido inválido." }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return output(req, 400, { error: "Dados do pedido inválidos." });
  }
  const payload = body as Record<string, unknown>;
  const phone = typeof payload.customerPhone === "string" ? payload.customerPhone : "";
  const name = typeof payload.customerName === "string" ? payload.customerName.trim() : "";
  if (!PHONE.test(phone) || name.length < 3 || name.length > 100 ||
      !Array.isArray(payload.items) || payload.items.length < 1 ||
      payload.items.length > 20 || payload.privacyAccepted !== true) {
    return output(req, 400, { error: "Confira nome, telefone, itens e privacidade." });
  }
  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ip = req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const fingerprint = await sha256(pepper + ":" + ip + ":" + phone);
  const { data: allowed, error: throttleError } = await service.rpc("check_checkout_rate_limit", {
    p_fingerprint: fingerprint,
  });
  if (throttleError) return output(req, 503, { error: "Pedido temporariamente indisponível." });
  if (!allowed) return output(req, 429, { error: "Limite de tentativas atingido. Tente mais tarde." });

  const { data, error } = await service.rpc("create_checkout_order", { p_payload: payload });
  if (error) {
    if (error.code === "23514" && /delivery/.test(error.message ?? "")) return output(req, 409, {
      error: "A forma de entrega escolhida não está disponível para este CEP. Calcule o frete de novo.",
    });
    if (error.code === "23514") return output(req, 409, {
      error: "Produto indisponível ou estoque insuficiente. Atualize o carrinho.",
    });
    if (error.code === "22023" || error.code === "23505") return output(req, 400, {
      error: "Revise os dados do pedido antes de tentar novamente.",
    });
    return output(req, 503, { error: "Não foi possível confirmar o registro do pedido." });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.order_number || !result?.order_id) {
    return output(req, 503, { error: "O banco não confirmou o registro do pedido." });
  }
  const settings = await service.from("store_settings").select("whatsapp_number")
    .eq("id", 1).maybeSingle();
  const whatsapp = typeof settings.data?.whatsapp_number === "string"
    ? settings.data.whatsapp_number : "";
  const validWhatsapp = !settings.error && /^55[1-9]{2}9?\d{8}$/.test(whatsapp);
  return output(req, 200, {
    orderId: result.order_id,
    orderNumber: result.order_number,
    subtotalCents: result.subtotal_cents,
    shippingCents: result.shipping_cents ?? null,
    totalCents: result.total_cents ?? null,
    deliveryLabel: result.delivery_label ?? null,
    deliveryDays: result.delivery_days ?? null,
    whatsapp: validWhatsapp ? whatsapp : "",
    whatsappConfigured: validWhatsapp,
    status: "aguardando-contato",
    replayed: Boolean(result.replayed),
  });
});

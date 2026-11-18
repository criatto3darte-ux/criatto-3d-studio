// CR-010B.10 — Admin-only banner media management.
import { createClient } from "npm:@supabase/supabase-js@2.76.1";

const BUCKET = "catalog-images";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 5 * 1024 * 1024;
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
console.info(`banner-media: secret key from ${secret.source}`);
const allowed = new Set((Deno.env.get("CATALOG_MEDIA_ALLOWED_ORIGINS") ??
  "https://homolog.criatto3d.art.br,http://localhost:5173").split(",").map((x) => x.trim()));

function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    ...(allowed.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function reply(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}
class HttpError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function fail(message: string, status = 400): never { throw new HttpError(message, status); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return reply(req, 405, { error: "Método não permitido." });
  if (req.headers.get("origin") && !allowed.has(req.headers.get("origin")!)) {
    return reply(req, 403, { error: "Origem não autorizada." });
  }
  if (!url || !serviceKey) return reply(req, 503, { error: "Serviço indisponível." });

  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) fail("Faça login novamente.", 401);
    const jwt = auth.slice(7);
    const service = createClient(url, serviceKey, { auth: {
      persistSession: false, autoRefreshToken: false,
    } });
    const { data: user, error: userError } = await service.auth.getUser(jwt);
    if (userError || !user.user) fail("Sessão inválida.", 401);
    let aal: unknown;
    try { aal = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal; }
    catch { fail("Token inválido.", 401); }
    if (aal !== "aal2") fail("Confirme o segundo fator de autenticação.", 403);
    const uid = user.user!.id;
    const [profile, roles] = await Promise.all([
      service.from("admin_profiles").select("active").eq("user_id", uid).maybeSingle(),
      service.from("user_roles").select("role").eq("user_id", uid),
    ]);
    if (profile.error || roles.error) fail("Permissões indisponíveis.", 503);
    if (!profile.data?.active || !roles.data?.some((r) =>
      r.role === "proprietario" || r.role === "editor"
    )) fail("Acesso negado.", 403);

    const form = await req.formData();
    const action = String(form.get("operation") ?? "");
    const bannerId = String(form.get("bannerId") ?? "");
    if (!UUID.test(bannerId)) fail("Banner inválido.");
    const { data: banner, error: bannerError } = await service.from("banners")
      .select("id,media_id").eq("id", bannerId).maybeSingle();
    if (bannerError) fail("Não foi possível consultar o banner.", 503);
    if (!banner) fail("Banner não encontrado.", 404);

    async function cleanup(mediaId: string | null) {
      if (!mediaId) return;
      const [products, banners] = await Promise.all([
        service.from("product_images").select("media_id", { count: "exact", head: true }).eq("media_id", mediaId),
        service.from("banners").select("id", { count: "exact", head: true }).eq("media_id", mediaId),
      ]);
      if (products.error || banners.error) throw new Error("Falha na verificação de referências.");
      if ((products.count ?? 0) + (banners.count ?? 0) > 0) return;
      const { data: asset, error } = await service.from("media_assets")
        .select("id,bucket,object_key").eq("id", mediaId).maybeSingle();
      if (error) throw new Error("Falha ao localizar mídia.");
      if (!asset || asset.bucket !== BUCKET) return;
      const marked = await service.from("media_assets").update({ state: "delete-pending" }).eq("id", mediaId);
      if (marked.error) throw new Error("Falha ao preparar limpeza.");
      const removed = await service.storage.from(BUCKET).remove([asset.object_key]);
      if (removed.error) throw new Error("Falha ao remover arquivo; limpeza pendente.");
      const deleted = await service.from("media_assets").delete().eq("id", mediaId);
      if (deleted.error) throw new Error("Falha ao remover metadados; limpeza pendente.");
    }

    if (action === "upload") {
      const file = form.get("file");
      const width = Number(form.get("width"));
      const height = Number(form.get("height"));
      const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
      if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES ||
          file.type !== "image/webp" || !Number.isInteger(width) ||
          !Number.isInteger(height) || width < 1 || height < 1 ||
          width > 1600 || height > 1600) fail("Envie WebP válido até 5 MB.");
      const bytes = await file.arrayBuffer();
      const first = new Uint8Array(bytes.slice(0, 12));
      if (first.length < 12 ||
          String.fromCharCode(...first.slice(0, 4)) !== "RIFF" ||
          String.fromCharCode(...first.slice(8, 12)) !== "WEBP") fail("Formato inválido.");
      const { data: bucket, error: bucketError } = await service.storage.getBucket(BUCKET);
      if (bucketError || !bucket?.public) fail("Storage de imagens não configurado.", 503);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      const checksum = Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
      const key = `banners/${bannerId}/${crypto.randomUUID()}.webp`;
      const sent = await service.storage.from(BUCKET).upload(key, new Blob([bytes], {
        type: "image/webp",
      }), { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (sent.error) fail("Não foi possível armazenar imagem.", 503);
      let mediaId: string | null = null;
      try {
        const created = await service.from("media_assets").insert({
          bucket: BUCKET, object_key: key, mime: "image/webp",
          byte_size: file.size, width, height, checksum, alt, state: "published", created_by: uid,
        }).select("id").single();
        if (created.error || !created.data) throw new Error("Erro ao registrar mídia.");
        mediaId = created.data.id;
        const linked = await service.from("banners").update({ media_id: mediaId })
          .eq("id", bannerId).eq("media_id", banner.media_id ?? mediaId)
          .select("id").maybeSingle();
        // For initial image, a null-media predicate is required.
        if (!linked.data && !linked.error && !banner.media_id) {
          const initial = await service.from("banners").update({ media_id: mediaId })
            .eq("id", bannerId).is("media_id", null).select("id").maybeSingle();
          if (initial.error || !initial.data) throw new Error("Banner alterado simultaneamente.");
        } else if (linked.error || !linked.data) {
          throw new Error("Banner alterado simultaneamente.");
        }
      } catch {
        if (mediaId) await service.from("media_assets").delete().eq("id", mediaId);
        await service.storage.from(BUCKET).remove([key]);
        fail("Falha ao associar imagem. Tente novamente.", 409);
      }
      // A new image remains usable even when old-file cleanup is interrupted.
      try { await cleanup(banner.media_id); } catch { /* delete-pending is recoverable */ }
      return reply(req, 200, { ok: true, mediaId });
    }

    if (action === "clear" || action === "delete-banner") {
      const oldMediaId: string | null = banner.media_id;
      if (action === "clear") {
        const result = await service.from("banners").update({ media_id: null })
          .eq("id", bannerId).select("id").maybeSingle();
        if (result.error || !result.data) fail("Não foi possível desvincular a imagem.", 503);
      } else {
        const deleted = await service.from("banners").delete().eq("id", bannerId).select("id").maybeSingle();
        if (deleted.error || !deleted.data) fail("Não foi possível excluir o banner.", 503);
      }
      try { await cleanup(oldMediaId); }
      catch { return reply(req, 202, { ok: true, cleanupPending: true }); }
      return reply(req, 200, { ok: true });
    }
    fail("Operação inválida.");
  } catch (e) {
    return e instanceof HttpError ? reply(req, e.status, { error: e.message })
      : reply(req, 500, { error: "Erro ao processar imagem do banner." });
  }
});

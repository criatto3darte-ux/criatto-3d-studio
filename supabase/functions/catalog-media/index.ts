// CR-010B.7 — trusted media endpoint. PREPARED ONLY; do not deploy until
// catalog-images Storage and the matching SQL migration are authorized.
import { createClient } from "npm:@supabase/supabase-js@2.76.1";

const BUCKET = "catalog-images";
const MAX_BYTES = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const origins = new Set(
  (Deno.env.get("CATALOG_MEDIA_ALLOWED_ORIGINS") ??
    "https://homolog.criatto3d.art.br,http://localhost:5173")
    .split(",").map((value) => value.trim()).filter(Boolean),
);
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  return {
    ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function response(request: Request, status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(request), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function reject(message: string, status = 400): never {
  throw new MediaError(message, status);
}
class MediaError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(request) });
  }
  if (request.method !== "POST") return response(request, 405, { error: "Método não permitido." });
  const origin = request.headers.get("origin");
  if (origin && !origins.has(origin)) return response(request, 403, { error: "Origem não autorizada." });
  if (!supabaseUrl || !serviceKey || !publicKey) {
    return response(request, 503, { error: "Serviço de imagens não configurado." });
  }

  try {
    const auth = request.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) reject("Faça login para gerenciar fotos.", 401);
    const token = auth.slice(7);
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await service.auth.getUser(token);
    if (userError || !userData.user) reject("Sessão inválida.", 401);

    // JWT was validated by GoTrue above; the verified token's AAL is checked
    // alongside live database membership, not writable user_metadata claims.
    let aal = "";
    try {
      aal = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal;
    } catch { reject("Sessão inválida.", 401); }
    if (aal !== "aal2") reject("Confirme a autenticação em duas etapas.", 403);

    const uid = userData.user!.id;
    const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] =
      await Promise.all([
        service.from("admin_profiles").select("active").eq("user_id", uid).maybeSingle(),
        service.from("user_roles").select("role").eq("user_id", uid),
      ]);
    if (profileError || rolesError) reject("Não foi possível validar a permissão.", 503);
    if (!profile?.active || !(roles ?? []).some((row) =>
      row.role === "proprietario" || row.role === "editor"
    )) reject("Acesso não autorizado para imagens.", 403);

    const form = await request.formData();
    const operation = text(form.get("operation"));
    const productId = text(form.get("productId"));
    if (!UUID.test(productId)) reject("Produto inválido.");
    const { data: product, error: productError } = await service
      .from("products").select("id,archived_at").eq("id", productId).maybeSingle();
    if (productError) reject("Erro ao validar produto.", 503);
    if (!product) reject("Produto não encontrado.", 404);
    if (operation !== "cleanup-product" && product.archived_at) {
      reject("Produto arquivado não pode receber novas imagens.", 409);
    }

    async function removeAssociatedImage(mediaId: string): Promise<void> {
      const { data: linked, error: linkError } = await service.from("product_images")
        .select("media_id").eq("product_id", productId).eq("media_id", mediaId).maybeSingle();
      if (linkError) reject("Erro ao consultar vínculo da imagem.", 503);
      if (!linked) return;

      const { data: asset, error: assetError } = await service.from("media_assets")
        .select("id,bucket,object_key").eq("id", mediaId).maybeSingle();
      if (assetError || !asset || asset.bucket !== BUCKET) {
        reject("Arquivo da imagem não localizado.", 503);
      }
      const [productRefs, bannerRefs] = await Promise.all([
        service.from("product_images").select("media_id", { count: "exact", head: true }).eq("media_id", mediaId),
        service.from("banners").select("id", { count: "exact", head: true }).eq("media_id", mediaId),
      ]);
      if (productRefs.error || bannerRefs.error) reject("Erro ao verificar compartilhamento.", 503);
      const shared = (productRefs.count ?? 0) + (bannerRefs.count ?? 0) > 1;
      if (shared) {
        const detached = await service.from("product_images").delete()
          .eq("product_id", productId).eq("media_id", mediaId);
        if (detached.error) reject("Erro ao desvincular imagem compartilhada.", 503);
        return;
      }
      // Hide first; Storage and Postgres are distinct services and cannot be
      // one ACID transaction. A failed delete leaves an explicit retryable
      // delete-pending asset instead of a published ghost image.
      const mark = await service.from("media_assets")
        .update({ state: "delete-pending" }).eq("id", mediaId);
      if (mark.error) reject("Não foi possível preparar exclusão.", 503);
      const removed = await service.storage.from(BUCKET).remove([asset.object_key]);
      if (removed.error) reject("Exclusão física pendente; tente novamente.", 503);
      const detach = await service.from("product_images").delete()
        .eq("product_id", productId).eq("media_id", mediaId);
      if (detach.error) reject("Exclusão de vínculo pendente; tente novamente.", 503);
      const deleteMeta = await service.from("media_assets").delete().eq("id", mediaId);
      if (deleteMeta.error) reject("Exclusão dos metadados pendente; tente novamente.", 503);
    }

    if (operation === "cleanup-product") {
      if (!product.archived_at) reject("Arquive o produto antes de excluir suas imagens.", 409);
      const { data: links, error } = await service.from("product_images")
        .select("media_id").eq("product_id", productId);
      if (error) reject("Não foi possível localizar imagens do produto.", 503);
      let pending = 0;
      for (const link of links ?? []) {
        try { await removeAssociatedImage(link.media_id); } catch { pending++; }
      }
      return response(request, pending ? 202 : 200, {
        ok: true, cleanupPending: pending > 0, failedItems: pending,
      });
    }

    if (operation === "upload") {
      const file = form.get("file");
      const width = Number(text(form.get("width")));
      const height = Number(text(form.get("height")));
      const alt = text(form.get("alt")).trim().slice(0, 200);
      if (!(file instanceof File) || !file.size || file.size > MAX_BYTES ||
          file.type !== "image/webp" || !Number.isInteger(width) ||
          !Number.isInteger(height) || width < 1 || height < 1 ||
          width > 1600 || height > 1600) reject("Imagem WebP ou dimensões inválidas.");
      const buffer = await file.arrayBuffer();
      const header = new Uint8Array(buffer.slice(0, 12));
      if (header.length < 12 ||
          String.fromCharCode(...header.slice(0, 4)) !== "RIFF" ||
          String.fromCharCode(...header.slice(8, 12)) !== "WEBP") {
        reject("O arquivo não é WebP válido.");
      }
      const { data: bucket, error: bucketError } = await service.storage.getBucket(BUCKET);
      if (bucketError || !bucket || !bucket.public) reject("Bucket público não configurado.", 503);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
      const checksum = Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
      const key = `products/${productId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await service.storage.from(BUCKET)
        .upload(key, new Blob([buffer], { type: "image/webp" }), {
          contentType: "image/webp", upsert: false, cacheControl: "31536000",
        });
      if (uploadError) reject("Não foi possível armazenar a imagem.", 503);

      let assetId: string | null = null;
      try {
        const { data: asset, error: assetError } = await service.from("media_assets")
          .insert({
            bucket: BUCKET, object_key: key, mime: "image/webp",
            byte_size: file.size, width, height, checksum, alt,
            state: "published", created_by: uid,
          }).select("id").single();
        if (assetError || !asset) throw new Error("Falha ao registrar metadados.");
        assetId = asset.id;
        const { data: current, error: listError } = await service.from("product_images")
          .select("position").eq("product_id", productId).order("position", { ascending: false }).limit(1);
        if (listError) throw new Error("Falha ao consultar galeria.");
        const position = current?.length ? current[0].position + 1 : 0;
        const { error: linkError } = await service.from("product_images")
          .insert({ product_id: productId, media_id: assetId, position, is_primary: position === 0 });
        if (linkError) throw new Error("Falha ao vincular imagem ao produto.");
      } catch {
        if (assetId) await service.from("media_assets").delete().eq("id", assetId);
        await service.storage.from(BUCKET).remove([key]);
        reject("Não foi possível concluir o cadastro da imagem. Tente novamente.", 503);
      }
      return response(request, 200, { ok: true, mediaId: assetId });
    }

    const mediaId = text(form.get("mediaId"));
    if (!UUID.test(mediaId)) reject("Imagem inválida.");
    const { data: image, error: linkError } = await service.from("product_images")
      .select("product_id,media_id,is_primary").eq("product_id", productId)
      .eq("media_id", mediaId).maybeSingle();
    if (linkError) reject("Erro ao consultar imagem.", 503);
    if (!image) reject("Imagem não associada ao produto.", 404);

    if (operation === "primary") {
      const { error } = await service.rpc("set_catalog_primary_media", {
        p_product_id: productId, p_media_id: mediaId,
      });
      if (error) reject("Não foi possível definir a foto principal.", 503);
      return response(request, 200, { ok: true });
    }
    if (operation === "delete") {
      await removeAssociatedImage(mediaId);
      const { data: remaining } = await service.from("product_images")
        .select("media_id").eq("product_id", productId)
        .order("position").limit(1);
      if (image.is_primary && remaining?.length) {
        const result = await service.rpc("set_catalog_primary_media", {
          p_product_id: productId, p_media_id: remaining[0].media_id,
        });
        if (result.error) reject("Foto removida; atualização da principal pendente.", 503);
      }
      return response(request, 200, { ok: true });
    }
    reject("Operação de imagem desconhecida.");
  } catch (error) {
    if (error instanceof MediaError) return response(request, error.status, { error: error.message });
    return response(request, 500, { error: "Erro inesperado no serviço de imagens." });
  }
});

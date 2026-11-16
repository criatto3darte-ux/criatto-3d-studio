import { getSupabase } from "@/lib/supabase/client";

export interface CatalogImage {
  mediaId: string;
  productId: string;
  url: string;
  alt: string;
  position: number;
  primary: boolean;
}

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const BUCKET = "catalog-images";

/** Client-side optimization only; the server must independently authorize and validate. */
export async function prepareProductImage(file: File): Promise<PreparedImage> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Envie uma foto PNG, JPEG ou WebP.");
  }
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("A imagem deve ter até 12 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("O arquivo não contém uma imagem válida.");
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > 12000 || bitmap.height > 12000) {
      throw new Error("Dimensões da imagem inválidas.");
    }
    const ratio = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível processar a imagem.");
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("Falha ao otimizar a imagem.")),
        "image/webp",
        0.82,
      );
    });
    if (blob.type !== "image/webp" || !blob.size || blob.size > MAX_OUTPUT_BYTES) {
      throw new Error("Não foi possível gerar WebP de até 5 MB.");
    }
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

/** Reads only image links for catalog products explicitly published in the public view. */
export async function listPublicCatalogImages(): Promise<Map<string, CatalogImage[]>> {
  const { data, error } = await getSupabase()
    .from("public_catalog_images")
    .select("product_id,media_id,object_key,alt,position,is_primary")
    .order("position");
  // Existing deployments without the new view must keep showing the catalog.
  if (error?.code === "PGRST205" || error?.code === "42P01") return new Map();
  if (error) throw new Error("Não foi possível carregar as fotos dos produtos.");
  const result = new Map<string, CatalogImage[]>();
  for (const row of data ?? []) {
    if (typeof row.object_key !== "string" || !/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(row.object_key)) {
      continue;
    }
    const { data: image } = getSupabase().storage.from(BUCKET).getPublicUrl(row.object_key);
    const next: CatalogImage = {
      mediaId: row.media_id,
      productId: row.product_id,
      url: image.publicUrl,
      alt: row.alt ?? "",
      position: row.position,
      primary: row.is_primary,
    };
    const list = result.get(next.productId) ?? [];
    list.push(next);
    result.set(next.productId, list);
  }
  for (const list of result.values()) {
    list.sort((a, b) => Number(b.primary) - Number(a.primary) || a.position - b.position);
  }
  return result;
}

async function invokeMedia(payload: FormData | Record<string, string>) {
  const body = payload instanceof FormData ? payload : new FormData();
  if (!(payload instanceof FormData)) {
    for (const [name, value] of Object.entries(payload)) body.set(name, value);
  }
  const { data, error } = await getSupabase().functions.invoke("catalog-media", {
    body,
  });
  if (error) throw new Error("Falha ao comunicar com o serviço de imagens. Tente novamente.");
  if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Falha no serviço de imagens.");
  return data;
}

export async function uploadCatalogImage(productId: string, file: File, alt: string): Promise<string> {
  const processed = await prepareProductImage(file);
  const body = new FormData();
  body.set("operation", "upload");
  body.set("productId", productId);
  body.set("alt", alt.trim().slice(0, 200));
  body.set("width", String(processed.width));
  body.set("height", String(processed.height));
  body.set("file", processed.blob, "product.webp");
  const response = await invokeMedia(body);
  if (typeof response?.mediaId !== "string") throw new Error("O serviço não confirmou o identificador da imagem.");
  return response.mediaId;
}

/**
 * Browser-side import for image URLs that explicitly permit CORS.
 * External URLs are never kept as the catalog image source: after downloading,
 * the same authenticated upload endpoint stores a local copy in Supabase Storage.
 * Third-party sites may block CORS; the user can save the file and upload it.
 */
export async function fetchPublicImageFile(inputUrl: string): Promise<File> {
  const raw = inputUrl.trim();
  if (!raw || raw.length > 2048) throw new Error("Informe uma URL de imagem válida.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("A URL da imagem não é válida.");
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      hostname === "localhost" || hostname.endsWith(".local") ||
      hostname.endsWith(".internal") || hostname.endsWith(".localhost") ||
      /^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(hostname) ||
      hostname.includes(":")) {
    throw new Error("Use uma URL pública HTTPS, com nome de domínio, sem credenciais.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url.href, {
      method: "GET",
      mode: "cors",
      redirect: "error",
      credentials: "omit",
      signal: controller.signal,
      headers: { Accept: "image/webp,image/png,image/jpeg" },
    });
    if (!response.ok) throw new Error("A imagem não está disponível nessa URL.");
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!["image/webp", "image/png", "image/jpeg"].includes(contentType)) {
      throw new Error("A URL deve retornar uma imagem PNG, JPEG ou WebP.");
    }
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_UPLOAD_BYTES) throw new Error("A imagem ultrapassa 12 MB.");
    if (!response.body) throw new Error("O navegador não conseguiu receber a imagem.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new Error("A imagem ultrapassa 12 MB.");
      }
      chunks.push(value);
    }
    const blob = new Blob(chunks as BlobPart[], { type: contentType });
    return new File([blob], "imagem-importada", { type: contentType });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "O servidor da imagem não permite importação direta (CORS). Salve a foto e envie pelo computador.",
      );
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("A imagem demorou demais para responder. Tente outro endereço.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadCatalogImageFromUrl(
  productId: string,
  inputUrl: string,
  alt: string,
): Promise<void> {
  const file = await fetchPublicImageFile(inputUrl);
  await uploadCatalogImage(productId, file, alt);
}

export async function deleteCatalogImage(productId: string, mediaId: string): Promise<void> {
  await invokeMedia({ operation: "delete", productId, mediaId });
}

export async function makePrimaryCatalogImage(productId: string, mediaId: string): Promise<void> {
  await invokeMedia({ operation: "primary", productId, mediaId });
}

/** Administrative gallery also sees photos attached to an unpublished product. */
export async function listAdminCatalogImages(productId: string): Promise<CatalogImage[]> {
  const client = getSupabase();
  const { data: links, error: linkError } = await client.from("product_images")
    .select("product_id,media_id,position,is_primary")
    .eq("product_id", productId).order("position");
  if (linkError) throw new Error("Não foi possível consultar a galeria do produto.");
  if (!links?.length) return [];

  const { data: assets, error: assetError } = await client.from("media_assets")
    .select("id,object_key,alt,bucket,state")
    .in("id", links.map((link) => link.media_id));
  if (assetError) throw new Error("Não foi possível consultar as imagens do produto.");
  const byId = new Map((assets ?? []).map((asset) => [asset.id, asset]));
  return links.flatMap((link) => {
    const asset = byId.get(link.media_id);
    if (!asset || asset.bucket !== BUCKET || asset.state !== "published" ||
        !/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(asset.object_key)) return [];
    const { data: url } = client.storage.from(BUCKET).getPublicUrl(asset.object_key);
    return [{
      productId: link.product_id, mediaId: link.media_id, url: url.publicUrl,
      alt: asset.alt ?? "", position: link.position, primary: link.is_primary,
    }];
  }).sort((a, b) => Number(b.primary) - Number(a.primary) || a.position - b.position);
}

/** Requests best-effort physical image cleanup after product archival. */
export async function cleanupArchivedProductImages(productId: string): Promise<boolean> {
  const data = await invokeMedia({ operation: "cleanup-product", productId });
  return Boolean(data?.cleanupPending);
}

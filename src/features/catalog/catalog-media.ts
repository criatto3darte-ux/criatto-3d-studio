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

async function invokeMedia(body: FormData | Record<string, string>) {
  const { data, error } = await getSupabase().functions.invoke("catalog-media", {
    body,
  });
  if (error) throw new Error("Falha ao comunicar com o serviço de imagens. Tente novamente.");
  if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Falha no serviço de imagens.");
  return data;
}

export async function uploadCatalogImage(productId: string, file: File, alt: string): Promise<void> {
  const processed = await prepareProductImage(file);
  const body = new FormData();
  body.set("operation", "upload");
  body.set("productId", productId);
  body.set("alt", alt.trim().slice(0, 200));
  body.set("width", String(processed.width));
  body.set("height", String(processed.height));
  body.set("file", processed.blob, "product.webp");
  await invokeMedia(body);
}

export async function deleteCatalogImage(productId: string, mediaId: string): Promise<void> {
  await invokeMedia({ operation: "delete", productId, mediaId });
}

export async function makePrimaryCatalogImage(productId: string, mediaId: string): Promise<void> {
  await invokeMedia({ operation: "primary", productId, mediaId });
}

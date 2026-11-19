import { getSupabase } from "@/lib/supabase/client";
import { fetchPublicImageFile, prepareProductImage } from "@/features/catalog/catalog-media";
import type { DemoBanner } from "@/features/demo-data/model";

const BUCKET = "catalog-images";

export interface AdminBanner extends DemoBanner {
  mediaId: string | null;
  version: number;
}
export interface BannerInput {
  id?: string;
  version?: number;
  title: string;
  highlight: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  order: number;
  active: boolean;
}
function toPublicUrl(key: string | null | undefined): string {
  if (!key || !/^banners\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(key)) return "";
  return getSupabase().storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}
function message(error: unknown, fallback: string): never {
  throw new Error(error instanceof Error ? error.message : fallback);
}

export async function listAdminBanners(): Promise<AdminBanner[]> {
  const client = getSupabase();
  const { data, error } = await client.from("banners")
    .select("id,title,highlight,subtitle,button_text,button_url,display_order,active,media_id,version")
    .order("display_order", { ascending: true });
  if (error) return message(error, "Não foi possível consultar os banners.");
  const mediaIds = (data ?? []).map((banner) => banner.media_id).filter((id): id is string => !!id);
  const media = mediaIds.length
    ? await client.from("media_assets").select("id,bucket,object_key,state").in("id", mediaIds)
    : { data: [], error: null };
  if (media.error) return message(media.error, "Não foi possível consultar as imagens.");
  const byId = new Map((media.data ?? []).map((asset) => [asset.id, asset]));
  return (data ?? []).map((row) => {
    const asset = row.media_id ? byId.get(row.media_id) : null;
    return {
      id: row.id,
      title: row.title,
      highlight: row.highlight,
      subtitle: row.subtitle,
      buttonText: row.button_text,
      buttonUrl: row.button_url,
      order: row.display_order,
      active: row.active,
      mediaId: row.media_id,
      version: row.version,
      image: asset?.bucket === BUCKET && asset.state === "published"
        ? toPublicUrl(asset.object_key) : "",
    };
  });
}

/** An anonymous browser reads a narrow, public-only view, never the admin table. */
export async function listPublishedBanners(): Promise<DemoBanner[]> {
  const { data, error } = await getSupabase().from("public_site_banners")
    .select("id,title,highlight,subtitle,button_text,button_url,display_order,image_key")
    .order("display_order", { ascending: true });
  if (error?.code === "PGRST205" || error?.code === "42P01") return [];
  if (error) return message(error, "Não foi possível consultar os banners publicados.");
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    highlight: row.highlight,
    subtitle: row.subtitle,
    buttonText: row.button_text,
    buttonUrl: row.button_url,
    order: row.display_order,
    active: true,
    image: toPublicUrl(row.image_key),
  }));
}

export async function saveAdminBanner(input: BannerInput): Promise<string> {
  const client = getSupabase();
  const values = {
    title: input.title.trim(),
    highlight: input.highlight.trim(),
    subtitle: input.subtitle.trim(),
    button_text: input.buttonText.trim(),
    button_url: input.buttonUrl.trim(),
    display_order: input.order,
    active: input.active,
  };
  if (input.id) {
    const { data, error } = await client.from("banners").update(values)
      .eq("id", input.id).eq("version", input.version ?? -1).select("id").maybeSingle();
    if (error) return message(error, "Falha ao atualizar banner.");
    if (!data) throw new Error("O banner foi modificado por outro usuário. Atualize a página.");
    return data.id;
  }
  const { data, error } = await client.from("banners").insert(values).select("id").single();
  if (error || !data) return message(error, "Falha ao cadastrar banner.");
  return data.id;
}

async function invokeBannerMedia(body: FormData): Promise<{ cleanupPending?: boolean }> {
  const { data, error } = await getSupabase().functions.invoke("banner-media", { body });
  if (error) throw new Error("Serviço de imagens indisponível. Tente novamente.");
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}
function action(operation: string, bannerId: string): FormData {
  const form = new FormData();
  form.set("operation", operation);
  form.set("bannerId", bannerId);
  return form;
}
export async function uploadBannerImage(bannerId: string, file: File, alt: string): Promise<void> {
  const processed = await prepareProductImage(file);
  const form = action("upload", bannerId);
  form.set("file", processed.blob, "banner.webp");
  form.set("width", String(processed.width));
  form.set("height", String(processed.height));
  form.set("alt", alt.trim().slice(0, 200));
  await invokeBannerMedia(form);
}
export async function importBannerImageFromUrl(bannerId: string, url: string, alt: string): Promise<void> {
  const file = await fetchPublicImageFile(url);
  await uploadBannerImage(bannerId, file, alt);
}
export async function clearBannerImage(bannerId: string): Promise<boolean> {
  return Boolean((await invokeBannerMedia(action("clear", bannerId))).cleanupPending);
}
export async function deleteAdminBanner(bannerId: string): Promise<boolean> {
  return Boolean((await invokeBannerMedia(action("delete-banner", bannerId))).cleanupPending);
}

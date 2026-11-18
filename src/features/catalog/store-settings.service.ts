import { getSupabase } from "@/lib/supabase/client";
import { OFFICIAL_WHATSAPP } from "@/config/contacts";
import type { StoreSettings } from "@/features/demo-data/model";

export const DEFAULT_REAL_SETTINGS: StoreSettings = {
  name: "Criatto 3D",
  logo: "",
  whatsappNumber: OFFICIAL_WHATSAPP,
  email: "",
  instagram: "",
  tiktok: "",
  address: "",
  deliveryInfo: "",
  offersNationalShipping: false,
  serviceMessage: "",
};

type SettingsRow = {
  id: number;
  name: string;
  whatsapp_number: string;
  public_email: string | null;
  social_links: Record<string, unknown> | null;
  address: string | null;
  delivery_info: string;
  offers_national_shipping: boolean;
  service_message: string;
  version: number;
};

function normalize(row: Partial<SettingsRow> | null): StoreSettings {
  if (!row) return { ...DEFAULT_REAL_SETTINGS };
  const social = row.social_links ?? {};
  return {
    ...DEFAULT_REAL_SETTINGS,
    name: row.name ?? DEFAULT_REAL_SETTINGS.name,
    whatsappNumber: row.whatsapp_number ?? DEFAULT_REAL_SETTINGS.whatsappNumber,
    email: row.public_email ?? "",
    instagram: typeof social.instagram === "string" ? social.instagram : "",
    tiktok: typeof social.tiktok === "string" ? social.tiktok : "",
    address: row.address ?? "",
    deliveryInfo: row.delivery_info ?? "",
    offersNationalShipping: row.offers_national_shipping ?? false,
    serviceMessage: row.service_message ?? "",
  };
}

const fields = "id,name,whatsapp_number,public_email,social_links,address,delivery_info,offers_national_shipping,service_message,version";

export async function readAdminStoreSettings(): Promise<{ settings: StoreSettings; version: number | null }> {
  const { data, error } = await getSupabase().from("store_settings")
    .select(fields).eq("id", 1).maybeSingle();
  if (error) throw new Error("Não foi possível carregar as configurações do Supabase.");
  const row = data as SettingsRow | null;
  return { settings: normalize(row), version: row?.version ?? null };
}

export async function readPublicStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await getSupabase().from("public_store_settings")
    .select("name,whatsapp_number,public_email,social_links,address,delivery_info,offers_national_shipping,service_message")
    .eq("id", 1).maybeSingle();
  if (error) throw new Error("Não foi possível carregar os contatos públicos da loja.");
  return normalize(data as SettingsRow | null);
}

export async function saveRealStoreSettings(
  values: StoreSettings,
  version: number | null,
): Promise<void> {
  const client = getSupabase();
  const socialLinks: Record<string, string> = {};
  const instagram = values.instagram.trim();
  const tiktok = values.tiktok.trim();
  if (instagram) socialLinks.instagram = instagram;
  if (tiktok) socialLinks.tiktok = tiktok;
  const update = {
    name: values.name.trim(),
    whatsapp_number: values.whatsappNumber,
    public_email: values.email.trim() || null,
    social_links: socialLinks,
    address: values.address.trim() || null,
    delivery_info: values.deliveryInfo.trim(),
    offers_national_shipping: values.offersNationalShipping,
    service_message: values.serviceMessage.trim(),
  };
  if (version === null) {
    const { error } = await client.from("store_settings")
      .insert({ id: 1, ...update, privacy_notice_version: "pending-review" });
    if (error) throw new Error(error.code === "23505"
      ? "As configurações foram criadas em outra sessão. Atualize antes de salvar."
      : "Não foi possível criar as configurações no Supabase.");
  } else {
    const { data, error } = await client.from("store_settings")
      .update(update).eq("id", 1).eq("version", version).select("id").maybeSingle();
    if (error) throw new Error("Não foi possível atualizar as configurações no Supabase.");
    if (!data) throw new Error("As configurações mudaram em outra sessão. Atualize antes de salvar.");
  }
}

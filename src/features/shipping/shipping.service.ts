import { getSupabase } from "@/lib/supabase/client";
import {
  DEFAULT_ORIGIN_CEP,
  SHIPPING_SIZES,
  type DeliveryZone,
  type PackageMeasures,
  type ShippingSettings,
  type ShippingSize,
} from "./shipping.rules";

type SizeColumns = {
  [K in `size_${"p" | "m" | "g"}_${"weight_g" | "height_cm" | "width_cm" | "length_cm"}`]: number | null;
};
type SettingsRow = SizeColumns & {
  origin_cep: string;
  pickup_enabled: boolean;
  pickup_address: string;
  pickup_hours: string;
  local_delivery_enabled: boolean;
  melhor_envio_enabled: boolean;
  version: number;
};
type ZoneRow = {
  id: string;
  name: string;
  cep_start: string;
  cep_end: string;
  price_cents: number;
  delivery_days: number;
  active: boolean;
  display_order: number;
  version: number;
};

const SIZE_FIELDS = SHIPPING_SIZES.flatMap((size) => {
  const k = size.toLowerCase();
  return [`size_${k}_weight_g`, `size_${k}_height_cm`, `size_${k}_width_cm`, `size_${k}_length_cm`];
});
const SETTINGS_FIELDS = [
  "origin_cep", "pickup_enabled", "pickup_address", "pickup_hours",
  "local_delivery_enabled", "melhor_envio_enabled", ...SIZE_FIELDS, "version",
].join(",");
const ZONE_FIELDS = "id,name,cep_start,cep_end,price_cents,delivery_days,active,display_order,version";

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  originCep: DEFAULT_ORIGIN_CEP,
  pickupEnabled: false,
  pickupAddress: "",
  pickupHours: "",
  localDeliveryEnabled: false,
  melhorEnvioEnabled: false,
  sizes: { P: null, M: null, G: null },
};

function sizeFromRow(row: SettingsRow, size: ShippingSize): PackageMeasures | null {
  const k = size.toLowerCase() as "p" | "m" | "g";
  const weightG = row[`size_${k}_weight_g`];
  const heightCm = row[`size_${k}_height_cm`];
  const widthCm = row[`size_${k}_width_cm`];
  const lengthCm = row[`size_${k}_length_cm`];
  return weightG && heightCm && widthCm && lengthCm ? { weightG, heightCm, widthCm, lengthCm } : null;
}

function sizeColumns(settings: ShippingSettings): SizeColumns {
  const columns = {} as SizeColumns;
  for (const size of SHIPPING_SIZES) {
    const k = size.toLowerCase() as "p" | "m" | "g";
    const m = settings.sizes[size];
    columns[`size_${k}_weight_g`] = m?.weightG ?? null;
    columns[`size_${k}_height_cm`] = m?.heightCm ?? null;
    columns[`size_${k}_width_cm`] = m?.widthCm ?? null;
    columns[`size_${k}_length_cm`] = m?.lengthCm ?? null;
  }
  return columns;
}

function failure(error: { code?: string } | null, fallback: string): never {
  if (error?.code === "42501" || error?.code === "PGRST301") {
    throw new Error("Somente o proprietário, com o autenticador confirmado, pode alterar a entrega.");
  }
  if (error?.code === "23514") throw new Error("Os valores não atendem às regras de entrega. Revise os campos.");
  if (error?.code === "PGRST205" || error?.code === "42P01") {
    throw new Error("As configurações de entrega ainda não foram instaladas neste ambiente.");
  }
  throw new Error(fallback);
}

export async function readShippingSettings(): Promise<{ settings: ShippingSettings; version: number }> {
  const { data, error } = await getSupabase().from("shipping_settings")
    .select(SETTINGS_FIELDS).eq("id", 1).maybeSingle();
  if (error) failure(error, "Não foi possível carregar as configurações de entrega.");
  const row = data as SettingsRow | null;
  if (!row) throw new Error("Somente o proprietário, com o autenticador confirmado, pode ver a entrega.");
  return {
    version: row.version,
    settings: {
      originCep: row.origin_cep,
      pickupEnabled: row.pickup_enabled,
      pickupAddress: row.pickup_address,
      pickupHours: row.pickup_hours,
      localDeliveryEnabled: row.local_delivery_enabled,
      melhorEnvioEnabled: row.melhor_envio_enabled,
      sizes: { P: sizeFromRow(row, "P"), M: sizeFromRow(row, "M"), G: sizeFromRow(row, "G") },
    },
  };
}

export async function saveShippingSettings(settings: ShippingSettings, version: number): Promise<void> {
  const { data, error } = await getSupabase().from("shipping_settings").update({
    origin_cep: settings.originCep,
    pickup_enabled: settings.pickupEnabled,
    pickup_address: settings.pickupAddress.trim(),
    pickup_hours: settings.pickupHours.trim(),
    local_delivery_enabled: settings.localDeliveryEnabled,
    melhor_envio_enabled: settings.melhorEnvioEnabled,
    ...sizeColumns(settings),
  }).eq("id", 1).eq("version", version).select("id").maybeSingle();
  if (error) failure(error, "Não foi possível salvar as configurações de entrega.");
  if (!data) throw new Error("As configurações mudaram em outra sessão. Atualize antes de salvar.");
}

export async function listDeliveryZones(): Promise<DeliveryZone[]> {
  const { data, error } = await getSupabase().from("local_delivery_zones")
    .select(ZONE_FIELDS).order("display_order").order("cep_start");
  if (error) failure(error, "Não foi possível carregar as regiões de entrega.");
  return ((data ?? []) as ZoneRow[]).map((row) => ({
    id: row.id,
    version: row.version,
    name: row.name,
    cepStart: row.cep_start,
    cepEnd: row.cep_end,
    priceCents: row.price_cents,
    deliveryDays: row.delivery_days,
    active: row.active,
    order: row.display_order,
  }));
}

export async function saveDeliveryZone(zone: DeliveryZone): Promise<void> {
  const values = {
    name: zone.name.trim(),
    cep_start: zone.cepStart,
    cep_end: zone.cepEnd,
    price_cents: zone.priceCents,
    delivery_days: zone.deliveryDays,
    active: zone.active,
    display_order: zone.order,
  };
  const client = getSupabase();
  if (zone.id) {
    const { data, error } = await client.from("local_delivery_zones").update(values)
      .eq("id", zone.id).eq("version", zone.version ?? 0).select("id").maybeSingle();
    if (error) failure(error, "Não foi possível salvar a região.");
    if (!data) throw new Error("A região mudou em outra sessão. Atualize antes de salvar.");
    return;
  }
  const { error } = await client.from("local_delivery_zones").insert(values);
  if (error) failure(error, "Não foi possível cadastrar a região.");
}

export async function deleteDeliveryZone(zone: Pick<DeliveryZone, "id" | "version">): Promise<void> {
  if (!zone.id) return;
  const { data, error } = await getSupabase().from("local_delivery_zones").delete()
    .eq("id", zone.id).eq("version", zone.version ?? 0).select("id").maybeSingle();
  if (error) failure(error, "Não foi possível excluir a região.");
  if (!data) throw new Error("A região mudou em outra sessão. Atualize antes de excluir.");
}

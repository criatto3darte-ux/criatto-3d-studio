import { useEffect, useState } from "react";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { formatBRL } from "@/shared/utils/format";
import {
  SHIPPING_SIZES,
  formatCep,
  measuresToInput,
  normalizeCep,
  parseMeasures,
  parseZone,
  validateShippingSettings,
  type DeliveryZone,
  type FieldErrors,
  type MeasuresInput,
  type ShippingSettings,
  type ShippingSize,
  type ZoneInput,
} from "@/features/shipping/shipping.rules";
import {
  DEFAULT_SHIPPING_SETTINGS,
  deleteDeliveryZone,
  listDeliveryZones,
  readShippingSettings,
  saveDeliveryZone,
  saveShippingSettings,
} from "@/features/shipping/shipping.service";
import { Check, ConfirmDialog, DataTable, Modal, adminStyles as s, centsToInput, parseMoney } from "../ui/AdminUI";

const SIZE_LABEL: Record<ShippingSize, string> = { P: "Pequeno (P)", M: "Médio (M)", G: "Grande (G)" };

interface ZoneDraft extends ZoneInput {
  id?: string;
  version?: number;
  order: number;
}

function toZoneDraft(zone: DeliveryZone | null, nextOrder: number): ZoneDraft {
  if (!zone) {
    return { name: "", cepStart: "", cepEnd: "", price: "", deliveryDays: "1", active: true, order: nextOrder };
  }
  return {
    ...(zone.id ? { id: zone.id } : {}),
    ...(zone.version === undefined ? {} : { version: zone.version }),
    name: zone.name,
    cepStart: formatCep(zone.cepStart),
    cepEnd: formatCep(zone.cepEnd),
    price: centsToInput(zone.priceCents),
    deliveryDays: String(zone.deliveryDays),
    active: zone.active,
    order: zone.order,
  };
}

export function ShippingPage() {
  const [form, setForm] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
  const [sizes, setSizes] = useState<Record<ShippingSize, MeasuresInput>>({
    P: measuresToInput(null), M: measuresToInput(null), G: measuresToInput(null),
  });
  const [version, setVersion] = useState<number | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);
  const [zoneErrors, setZoneErrors] = useState<FieldErrors>({});
  const [toDelete, setToDelete] = useState<DeliveryZone | null>(null);

  const set = (patch: Partial<ShippingSettings>) => { setForm((f) => ({ ...f, ...patch })); setNotice(""); };

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [current, currentZones] = await Promise.all([readShippingSettings(), listDeliveryZones()]);
      setForm({ ...current.settings, originCep: formatCep(current.settings.originCep) });
      setSizes({
        P: measuresToInput(current.settings.sizes.P),
        M: measuresToInput(current.settings.sizes.M),
        G: measuresToInput(current.settings.sizes.G),
      });
      setVersion(current.version);
      setZones(currentZones);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a entrega.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  async function save() {
    if (version === null) return;
    const nextErrors: FieldErrors = {};
    const parsedSizes = {} as ShippingSettings["sizes"];
    for (const size of SHIPPING_SIZES) {
      parsedSizes[size] = parseMeasures(sizes[size], `size${size}.`, nextErrors);
    }
    const clean: ShippingSettings = {
      ...form,
      originCep: normalizeCep(form.originCep) ?? form.originCep,
      pickupAddress: form.pickupAddress.trim(),
      pickupHours: form.pickupHours.trim(),
      sizes: parsedSizes,
    };
    Object.assign(nextErrors, validateShippingSettings(clean));
    if (clean.localDeliveryEnabled && !zones.some((zone) => zone.active)) {
      nextErrors.localDelivery = "Cadastre e ative ao menos uma região antes de ligar a entrega local.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    setError("");
    try {
      await saveShippingSettings(clean, version);
      await reload();
      setNotice("Configurações de entrega salvas.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a entrega.");
    } finally {
      setBusy(false);
    }
  }

  async function saveZone() {
    if (!zoneDraft) return;
    const { value, errors: nextErrors } = parseZone(zoneDraft, parseMoney, zones, zoneDraft.id);
    setZoneErrors(nextErrors);
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      await saveDeliveryZone({
        ...value,
        order: zoneDraft.order,
        ...(zoneDraft.id ? { id: zoneDraft.id } : {}),
        ...(zoneDraft.version === undefined ? {} : { version: zoneDraft.version }),
      });
      setZoneDraft(null);
      setZones(await listDeliveryZones());
      setNotice("Região salva.");
    } catch (cause) {
      setZoneErrors({ form: cause instanceof Error ? cause.message : "Não foi possível salvar a região." });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const zone = toDelete;
    setToDelete(null);
    setBusy(true);
    setError("");
    try {
      await deleteDeliveryZone(zone);
      setZones(await listDeliveryZones());
      setNotice("Região excluída.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a região.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = loading || busy || version === null;
  const nextOrder = zones.reduce((max, zone) => Math.max(max, zone.order), 0) + 1;

  return (
    <div className={s.stack}>
      <p className={s.muted}>
        Opções de entrega que o checkout vai oferecer. Os valores são calculados pelo servidor da loja;
        só o proprietário, com o autenticador confirmado, pode alterá-los.
      </p>
      {loading && <p role="status">Carregando entrega…</p>}
      {error && <p role="alert">{error}</p>}

      <Card>
        <h2 className={s.h2}>Origem dos envios</h2>
        <div className={s.formGrid}>
          <Input label="CEP de origem" inputMode="numeric" placeholder="25030-058" value={form.originCep}
            error={errors.originCep} onChange={(e) => set({ originCep: e.target.value })}
            hint="De onde as peças saem. Usado no cálculo do frete pelas transportadoras." />
        </div>
      </Card>

      <Card>
        <h2 className={s.h2}>Retirada</h2>
        <div className={s.formGrid}>
          <Check label="Oferecer retirada (grátis)" checked={form.pickupEnabled}
            onChange={(v) => set({ pickupEnabled: v })} />
          <Input className={s.full} label="Endereço de retirada" value={form.pickupAddress} maxLength={300}
            error={errors.pickupAddress} onChange={(e) => set({ pickupAddress: e.target.value })} />
          <Input className={s.full} label="Dias e horários" placeholder="Seg. a sex., 10h às 18h" value={form.pickupHours}
            maxLength={200} error={errors.pickupHours} onChange={(e) => set({ pickupHours: e.target.value })} />
        </div>
      </Card>

      <Card>
        <h2 className={s.h2}>Entrega local</h2>
        <div className={s.stack}>
          <Check label="Oferecer entrega local nas regiões ativas abaixo" checked={form.localDeliveryEnabled}
            onChange={(v) => set({ localDeliveryEnabled: v })} />
          {errors.localDelivery && <p role="alert">{errors.localDelivery}</p>}
          <p className={s.muted}>
            Cada região é uma faixa de CEP com valor e prazo. Faixas ativas não podem se sobrepor.
          </p>
          <DataTable label="Regiões de entrega local" empty={!zones.length} head={<>
            <th>Região</th><th>Faixa de CEP</th><th>Valor</th><th>Prazo</th><th>Situação</th><th aria-label="Ações" />
          </>}>
            {zones.map((zone) => (
              <tr key={zone.id}>
                <td>{zone.name}</td>
                <td>{formatCep(zone.cepStart)} a {formatCep(zone.cepEnd)}</td>
                <td>{zone.priceCents === 0 ? "Grátis" : formatBRL(zone.priceCents)}</td>
                <td>{zone.deliveryDays === 0 ? "No mesmo dia" : `${zone.deliveryDays} dia(s) útil(eis)`}</td>
                <td>{zone.active ? "Ativa" : "Inativa"}</td>
                <td className={s.actions}>
                  <Button size="icon" variant="ghost" aria-label={`Editar ${zone.name}`} disabled={disabled}
                    onClick={() => { setZoneErrors({}); setZoneDraft(toZoneDraft(zone, nextOrder)); }}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Excluir ${zone.name}`} disabled={disabled}
                    onClick={() => setToDelete(zone)}><Trash2 size={16} /></Button>
                </td>
              </tr>
            ))}
          </DataTable>
          <div>
            <Button variant="outline" disabled={disabled}
              onClick={() => { setZoneErrors({}); setZoneDraft(toZoneDraft(null, nextOrder)); }}>
              <Plus size={16} /> Nova região
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className={s.h2}>Transportadoras (Melhor Envio)</h2>
        <p className={s.muted}>
          Cotação de Correios, Jadlog e outras para todo o Brasil. Fica disponível quando a conta do
          Melhor Envio da loja for conectada; até lá, o checkout oferece só retirada e entrega local.
        </p>
        <p><strong>Situação:</strong> aguardando a conexão da conta do Melhor Envio.</p>
      </Card>

      <Card>
        <h2 className={s.h2}>Tamanhos padrão de embalagem</h2>
        <p className={s.muted}>
          Produtos marcados como P, M ou G usam estas medidas no frete. Deixe em branco o tamanho que não usar.
        </p>
        <div className={s.stack}>
          {SHIPPING_SIZES.map((size) => (
            <fieldset key={size} className={s.formGrid}
              style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12 }}>
              <legend>{SIZE_LABEL[size]}</legend>
              <Input label="Peso (g)" inputMode="numeric" value={sizes[size].weightG} error={errors[`size${size}.weightG`]}
                onChange={(e) => setSizes((all) => ({ ...all, [size]: { ...all[size], weightG: e.target.value } }))} />
              <Input label="Altura (cm)" inputMode="numeric" value={sizes[size].heightCm} error={errors[`size${size}.heightCm`]}
                onChange={(e) => setSizes((all) => ({ ...all, [size]: { ...all[size], heightCm: e.target.value } }))} />
              <Input label="Largura (cm)" inputMode="numeric" value={sizes[size].widthCm} error={errors[`size${size}.widthCm`]}
                onChange={(e) => setSizes((all) => ({ ...all, [size]: { ...all[size], widthCm: e.target.value } }))} />
              <Input label="Comprimento (cm)" inputMode="numeric" value={sizes[size].lengthCm} error={errors[`size${size}.lengthCm`]}
                onChange={(e) => setSizes((all) => ({ ...all, [size]: { ...all[size], lengthCm: e.target.value } }))} />
            </fieldset>
          ))}
        </div>
      </Card>

      <div className={s.toolbar}>
        <Button onClick={() => void save()} disabled={disabled}>
          <Save size={18} /> {busy ? "Salvando…" : "Salvar configurações de entrega"}
        </Button>
        <span role="status" className={s.muted}>{notice}</span>
      </div>

      <Modal open={!!zoneDraft} title={zoneDraft?.id ? "Editar região" : "Nova região"}
        onClose={() => !busy && setZoneDraft(null)}
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => setZoneDraft(null)}>Cancelar</Button>
          <Button disabled={busy} onClick={() => void saveZone()}>{busy ? "Salvando…" : "Salvar região"}</Button>
        </>}>
        {zoneDraft && (
          <div className={s.formGrid}>
            <Input className={s.full} label="Nome da região" placeholder="Centro de Duque de Caxias" value={zoneDraft.name}
              error={zoneErrors.name} onChange={(e) => setZoneDraft({ ...zoneDraft, name: e.target.value })} />
            <Input label="CEP inicial" inputMode="numeric" placeholder="25010-000" value={zoneDraft.cepStart}
              error={zoneErrors.cepStart} onChange={(e) => setZoneDraft({ ...zoneDraft, cepStart: e.target.value })} />
            <Input label="CEP final" inputMode="numeric" placeholder="25099-999" value={zoneDraft.cepEnd}
              error={zoneErrors.cepEnd} onChange={(e) => setZoneDraft({ ...zoneDraft, cepEnd: e.target.value })} />
            <Input label="Valor (R$)" inputMode="decimal" placeholder="15,00" value={zoneDraft.price}
              error={zoneErrors.price} onChange={(e) => setZoneDraft({ ...zoneDraft, price: e.target.value })} />
            <Input label="Prazo (dias úteis)" inputMode="numeric" value={zoneDraft.deliveryDays}
              error={zoneErrors.deliveryDays} onChange={(e) => setZoneDraft({ ...zoneDraft, deliveryDays: e.target.value })}
              hint="0 = no mesmo dia." />
            <Check label="Região ativa" checked={zoneDraft.active}
              onChange={(v) => setZoneDraft({ ...zoneDraft, active: v })} />
            {zoneErrors.form && <p role="alert" className={s.full}>{zoneErrors.form}</p>}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!toDelete} danger title="Excluir região" confirmLabel="Excluir"
        text={`Excluir a região "${toDelete?.name ?? ""}"? Pedidos já feitos não mudam.`}
        onConfirm={() => void confirmDelete()} onCancel={() => setToDelete(null)} />
    </div>
  );
}

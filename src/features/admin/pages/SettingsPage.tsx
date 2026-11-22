import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { ThemeSegmented } from "@/shared/ui/ThemeToggle";
import { DEFAULT_REAL_SETTINGS, readAdminStoreSettings, saveRealStoreSettings } from "@/features/catalog/store-settings.service";
import { validateSettings, type Errors } from "@/features/demo-data/rules";
import type { StoreSettings } from "@/features/demo-data/model";
import { Check, TextareaField, adminStyles as s } from "../ui/AdminUI";
import { notifyStoreContentChanged } from "@/features/catalog/store-content";

export function SettingsPage() {
  const [form, setForm] = useState<StoreSettings>(DEFAULT_REAL_SETTINGS);
  const [errors, setErrors] = useState<Errors>({});
  const [version, setVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const set = (p: Partial<StoreSettings>) => { setForm((f) => ({ ...f, ...p })); setSaved(false); };

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const current = await readAdminStoreSettings();
      setVersion(current.version);
      setForm(current.settings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  async function save() {
    setSaved(false);
    const clean: StoreSettings = { ...form, name: form.name.trim(), whatsappNumber: form.whatsappNumber.replace(/\D/g, ""), email: form.email.trim(), instagram: form.instagram.trim(), tiktok: form.tiktok.trim(), logo: "" };
    const validation = validateSettings(clean);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setBusy(true);
    setError("");
    try {
      await saveRealStoreSettings(clean, version);
      const current = await readAdminStoreSettings();
      setForm(current.settings);
      setVersion(current.version);
      setSaved(true);
      notifyStoreContentChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar configurações.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.stack}>
      <p className={s.muted}>Configurações oficiais persistidas no Supabase. As redes sociais aparecem na loja após salvar.</p>
      {loading && <p role="status">Carregando configurações…</p>}
      {error && <p role="alert">{error}</p>}
      <Card>
        <h2 className={s.h2}>Loja</h2>
        <div className={s.formGrid}>
          <Input label="Nome da loja" value={form.name} error={errors.name} onChange={(e) => set({ name: e.target.value })} />

          <Input className={s.full} label="Endereço (quando aplicável)" value={form.address} maxLength={1000} error={errors.address} onChange={(e) => set({ address: e.target.value })} />
        </div>
      </Card>
      <Card>
        <h2 className={s.h2}>Contato</h2>
        <div className={s.formGrid}>
          <Input label="WhatsApp comercial" inputMode="numeric" placeholder="5511912345678" value={form.whatsappNumber} error={errors.whatsappNumber} onChange={(e) => set({ whatsappNumber: e.target.value })} hint="Vazio = finalização desativada na loja. Formato: 55 + DDD + número." />
          <Input label="E-mail comercial" type="email" value={form.email} error={errors.email} onChange={(e) => set({ email: e.target.value })} />
          <Input label="Instagram" placeholder="https://instagram.com/perfil" value={form.instagram} error={errors.instagram} onChange={(e) => set({ instagram: e.target.value })} />
          <Input label="TikTok" placeholder="https://tiktok.com/@perfil" value={form.tiktok} error={errors.tiktok} onChange={(e) => set({ tiktok: e.target.value })} />
        </div>
      </Card>
      <Card>
        <h2 className={s.h2}>Entregas e atendimento</h2>
        <div className={s.formGrid}>
          <TextareaField className={s.full} label="Informações sobre entregas" value={form.deliveryInfo} maxLength={500} error={errors.deliveryInfo} onChange={(e) => set({ deliveryInfo: e.target.value })} />
          <Check label="Oferece envio para todo o Brasil (exibe o selo na página inicial)" checked={form.offersNationalShipping} onChange={(v) => set({ offersNationalShipping: v })} />
          <TextareaField className={s.full} label="Mensagem de atendimento" value={form.serviceMessage} maxLength={500} error={errors.serviceMessage} onChange={(e) => set({ serviceMessage: e.target.value })} />
        </div>
      </Card>
      <Card>
        <h2 className={s.h2}>Banners e aparência</h2>
        <p className={s.muted}>Os banners da página inicial são gerenciados em <Link to="/admin/banners">Banners</Link>. Tema deste navegador:</p>
        <div style={{ maxWidth: 260, marginTop: 8 }}><ThemeSegmented full /></div>
      </Card>
      <div className={s.toolbar}>
        <Button onClick={() => void save()} disabled={busy || loading}><Save size={18} /> {busy ? "Salvando…" : "Salvar configurações"}</Button>
        <span role="status" className={s.muted}>{saved ? "Configurações salvas. A loja já mostra as mudanças." : ""}</span>
      </div>

    </div>
  );
}

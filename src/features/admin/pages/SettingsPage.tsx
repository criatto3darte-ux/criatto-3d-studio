import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { ThemeSegmented } from "@/shared/ui/ThemeToggle";
import { demoRepository, useDemoData, useDemoStorageStatus } from "@/features/demo-data/repository";
import { validateSettings, type Errors } from "@/features/demo-data/rules";
import type { StoreSettings } from "@/features/demo-data/model";
import { Check, ConfirmDialog, TextareaField, adminStyles as s } from "../ui/AdminUI";

export function SettingsPage() {
  const data = useDemoData();
  const storageStatus = useDemoStorageStatus();
  const [form, setForm] = useState<StoreSettings>(data.settings);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (p: Partial<StoreSettings>) => { setForm((f) => ({ ...f, ...p })); setSaved(false); };

  function save() {
    setSaved(false);
    const clean: StoreSettings = { ...form, name: form.name.trim(), whatsappNumber: form.whatsappNumber.replace(/\D/g, ""), email: form.email.trim(), instagram: form.instagram.trim(), tiktok: form.tiktok.trim(), logo: form.logo.trim() };
    const e = validateSettings(clean);
    setErrors(e);
    if (Object.keys(e).length) return;
    const persisted = demoRepository.update((d) => ({ ...d, settings: clean }));
    setForm(clean);
    setSaved(persisted);
  }

  return (
    <div className={s.stack}>
      <p className={s.muted}>Configurações salvas apenas neste navegador (demonstração). A loja pública usa os mesmos dados. Não informe contatos fictícios.</p>
      <Card>
        <h2 className={s.h2}>Loja</h2>
        <div className={s.formGrid}>
          <Input label="Nome da loja" value={form.name} error={errors.name} onChange={(e) => set({ name: e.target.value })} />
          <Input label="Logotipo (caminho ou https://)" placeholder="/images/logo.svg" value={form.logo} error={errors.logo} onChange={(e) => set({ logo: e.target.value })} />
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
        <Button onClick={save}><Save size={18} /> Salvar configurações</Button>
        <Button variant="outline" onClick={() => setConfirmReset(true)}><RotateCcw size={18} /> Restaurar dados fictícios</Button>
        <span role="status" className={s.muted}>{saved && !storageStatus.writeError && !storageStatus.recoveryRequired ? "Configurações salvas (demonstração local)." : ""}</span>
      </div>
      <ConfirmDialog open={confirmReset} danger title="Restaurar dados fictícios" confirmLabel="Restaurar" text="Todos os produtos, categorias, pedidos, clientes, banners, cupons e configurações voltarão ao estado inicial da demonstração. O carrinho e o tema não são afetados."
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { demoRepository.reset(); setForm(demoRepository.get().settings); setErrors({}); setConfirmReset(false); setSaved(false); }} />
    </div>
  );
}

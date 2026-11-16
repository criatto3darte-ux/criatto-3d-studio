import { useEffect, useState } from "react";
import { Crop, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { validateBanner, type Errors } from "@/features/demo-data/rules";
import type { DemoBanner } from "@/features/demo-data/model";
import {
  clearBannerImage,
  deleteAdminBanner,
  importBannerImageFromUrl,
  listAdminBanners,
  saveAdminBanner,
  uploadBannerImage,
  type AdminBanner,
} from "@/features/catalog/banners.service";
import { Check, ConfirmDialog, DataTable, Modal, adminStyles as s } from "../ui/AdminUI";
import { cx } from "@/shared/utils/cx";
import { ImageCropEditor } from "../components/ImageCropEditor";
import { fetchPublicImageFile } from "@/features/catalog/catalog-media";

function Preview({ banner, mobile, src }: { banner: DemoBanner; mobile?: boolean; src?: string }) {
  return (
    <div className={cx(s.previewBox, mobile && s.previewMobile)}>
      <div className={s.muted} style={{ marginBottom: 6 }}>
        {mobile ? "Prévia mobile" : "Prévia desktop"}
      </div>
      <div className={s.previewTitle}>
        {banner.title} {banner.highlight && <span className="text-gradient">{banner.highlight}</span>}
      </div>
      {banner.subtitle && <p className={s.muted}>{banner.subtitle}</p>}
      <span className={s.thumbTag} style={{ position: "static", display: "inline-block", fontSize: 12, padding: "4px 10px" }}>
        {banner.buttonText || "Explorar produtos"}
      </span>
      {src ? (
        <img className={s.previewImg} src={src} alt="Prévia da imagem do banner" />
      ) : (
        <div className={s.muted} style={{ marginTop: 8 }}>Nenhuma imagem anexada.</div>
      )}
    </div>
  );
}

export function BannersPage() {
  const [list, setList] = useState<AdminBanner[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AdminBanner | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [del, setDel] = useState<AdminBanner | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [filePreview, setFilePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [editingFile, setEditingFile] = useState<File | null>(null);

  useEffect(() => {
    if (!file) { setFilePreview(""); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function reload() {
    setState("loading");
    try {
      setList(await listAdminBanners());
      setState("ready");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao carregar banners.");
      setState("error");
    }
  }
  useEffect(() => { void reload(); }, []);

  const shown = [...list].filter((item) => item.active).sort((a, b) => a.order - b.order)[0];
  const isNew = draft !== null && !draft.id;

  function edit(banner: AdminBanner) {
    setErrors({});
    setError("");
    setNotice("");
    setFile(null);
    setImageUrl("");
    setRemoveImage(false);
    setEditingFile(null);
    setDraft({ ...banner });
  }
  function create() {
    edit({
      id: "", version: 0, mediaId: null, title: "", highlight: "",
      subtitle: "", image: "", buttonText: "Explorar produtos",
      buttonUrl: "/produtos", order: list.length + 1, active: false,
    });
  }
  function update(values: Partial<AdminBanner>) {
    setDraft((current) => current ? { ...current, ...values } : current);
  }

  async function beginImageEdit() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      if (file) {
        setEditingFile(file);
        return;
      }
      const source = imageUrl.trim() || draft.image;
      if (!source) throw new Error("Escolha uma imagem local ou informe uma URL.");
      setEditingFile(await fetchPublicImageFile(source));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    const values = {
      ...draft,
      title: draft.title.trim(),
      highlight: draft.highlight.trim(),
      subtitle: draft.subtitle.trim(),
      buttonUrl: draft.buttonUrl.trim(),
      buttonText: draft.buttonText.trim(),
    };
    const result = validateBanner(values);
    setErrors(result);
    if (Object.keys(result).length) return;
    if (file && imageUrl.trim()) {
      setError("Escolha um arquivo local ou uma URL, não os dois.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const id = await saveAdminBanner({
        ...(values.id ? { id: values.id, version: values.version } : {}),
        title: values.title,
        highlight: values.highlight,
        subtitle: values.subtitle,
        buttonText: values.buttonText,
        buttonUrl: values.buttonUrl,
        order: values.order,
        active: values.active,
      });
      try {
        if (file) await uploadBannerImage(id, file, [values.title, values.highlight].filter(Boolean).join(" "));
        else if (imageUrl.trim()) await importBannerImageFromUrl(
          id, imageUrl, [values.title, values.highlight].filter(Boolean).join(" "),
        );
        else if (removeImage && draft.mediaId) {
          const cleanupPending = await clearBannerImage(id);
          if (cleanupPending) setNotice("Imagem desvinculada; a limpeza física ficou pendente.");
        }
      } catch (cause) {
        setDraft({ ...values, id });
        setError(
          "Os dados do banner foram salvos, mas a imagem não foi atualizada: " +
          (cause instanceof Error ? cause.message : "erro desconhecido"),
        );
        await reload();
        return;
      }
      setDraft(null);
      setFile(null);
      setImageUrl("");
      setNotice("Banner salvo no Supabase.");
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o banner.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBanner() {
    if (!del) return;
    setBusy(true);
    setError("");
    try {
      const pending = await deleteAdminBanner(del.id);
      setNotice(pending
        ? "Banner excluído. Limpeza do arquivo pendente."
        : "Banner e imagem desvinculados com sucesso.");
      setDel(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir o banner.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(banner: AdminBanner, active: boolean) {
    setBusy(true);
    setError("");
    try {
      await saveAdminBanner({
        ...banner, active,
      });
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar o status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.stack}>
      <div className={s.toolbar}>
        <p className={cx(s.muted, s.grow)}>
          Banners salvos no Supabase. Envie fotos do computador ou importe por URL HTTPS pública.
        </p>
        <Button variant="outline" onClick={() => void reload()} disabled={busy}>
          <RefreshCw size={16} /> Atualizar
        </Button>
        <Button onClick={create} disabled={busy}><Plus size={18} /> Novo banner</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {state === "loading" && <p role="status">Carregando banners reais…</p>}
      {state === "ready" && (
        <DataTable label="Banners" empty={!list.length}
          head={<><th>Ordem</th><th>Título</th><th className={s.hideSm}>Imagem</th><th>Status</th><th className={s.num}>Ações</th></>}>
          {list.map((banner) => (
            <tr key={banner.id}>
              <td>{banner.order}</td>
              <td><strong>{banner.title} {banner.highlight}</strong>
                {shown?.id === banner.id && <div className={s.muted}>Exibido na loja</div>}
              </td>
              <td className={s.hideSm}>{banner.image ? "Anexada" : "Sem foto"}</td>
              <td><Check label={banner.active ? "Ativo" : "Inativo"}
                checked={banner.active} onChange={(value) => void toggle(banner, value)} /></td>
              <td className={s.num}>
                <div className={s.actions}>
                  <Button size="icon" variant="ghost" aria-label={`Editar ${banner.title}`}
                    onClick={() => edit(banner)} disabled={busy}><Pencil size={16} /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Excluir ${banner.title}`}
                    onClick={() => setDel(banner)} disabled={busy}><Trash2 size={16} /></Button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <Modal open={!!draft} title={isNew ? "Novo banner" : "Editar banner"}
        onClose={() => !busy && setDraft(null)}
        footer={<>
          <Button variant="outline" disabled={busy} onClick={() => setDraft(null)}>Cancelar</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar"}</Button>
        </>}>
        {draft && (
          <div className={s.stack}>
            <div className={s.formGrid}>
              <Input label="Título" value={draft.title} error={errors.title}
                onChange={(e) => update({ title: e.target.value })} />
              <Input label="Destaque colorido" value={draft.highlight}
                onChange={(e) => update({ highlight: e.target.value })} />
              <Input className={s.full} label="Subtítulo" value={draft.subtitle}
                error={errors.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
              <Input label="Texto do botão" value={draft.buttonText}
                error={errors.buttonText} onChange={(e) => update({ buttonText: e.target.value })} />
              <Input label="Destino do botão" value={draft.buttonUrl}
                error={errors.buttonUrl} onChange={(e) => update({ buttonUrl: e.target.value })} />
              <Input label="Ordem" type="number" min={0} value={draft.order}
                error={errors.order} onChange={(e) => update({ order: Number(e.target.value) })} />
              <Check label="Ativo" checked={draft.active} onChange={(v) => update({ active: v })} />
            </div>
            <fieldset className={s.stack} disabled={busy}
              style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 12 }}>
              <legend>Imagem do banner</legend>
              <label htmlFor="banner-file">Anexar imagem do computador</label>
              <input id="banner-file" type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (e.target.files?.[0]) setImageUrl(""); }} />
              <Input label="Ou importar imagem de URL pública HTTPS"
                type="url" placeholder="https://site.com/banner.jpg" value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setFile(null); }} />
              {draft.mediaId && <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={removeImage}
                  onChange={(e) => { setRemoveImage(e.target.checked); if (e.target.checked) { setFile(null); setImageUrl(""); } }} />
                Remover imagem atual
              </label>}
              <Button variant="outline" disabled={busy || (!file && !imageUrl.trim() && !draft.image)}
                onClick={() => void beginImageEdit()}>
                <Crop size={16}/> Ajustar enquadramento e zoom
              </Button>
              {editingFile && (
                <ImageCropEditor file={editingFile} shape="banner"
                  onCancel={() => setEditingFile(null)}
                  onApply={(adjusted) => {
                    setFile(adjusted);
                    setImageUrl("");
                    setRemoveImage(false);
                    setEditingFile(null);
                  }}
                />
              )}
              <p className={s.muted}>Até 12 MB por foto. Ajuste o enquadramento antes de salvar. O arquivo final será armazenado como WebP.</p>
            </fieldset>
            <div className={s.preview}>
              <Preview banner={draft} src={removeImage ? "" : filePreview || draft.image} />
              <Preview banner={draft} mobile src={removeImage ? "" : filePreview || draft.image} />
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} danger title="Excluir banner"
        text={`Excluir o banner "${del?.title ?? ""}" e sua imagem armazenada?`}
        confirmLabel="Excluir" onCancel={() => setDel(null)}
        onConfirm={() => void removeBanner()} />
    </div>
  );
}

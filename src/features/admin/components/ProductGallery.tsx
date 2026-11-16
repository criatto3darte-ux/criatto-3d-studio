import { useEffect, useId, useState } from "react";
import { ImagePlus, Star, Trash2, Crop } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { invalidatePublicCatalog } from "@/features/catalog/supabase-catalog";
import {
  deleteCatalogImage, listAdminCatalogImages, makePrimaryCatalogImage,
  uploadCatalogImage, uploadCatalogImageFromUrl, type CatalogImage,
} from "@/features/catalog/catalog-media";
import styles from "./ProductGallery.module.css";
import { ImageCropEditor } from "./ImageCropEditor";
import { fetchPublicImageFile } from "@/features/catalog/catalog-media";

interface Props {
  productId: string;
  productName: string;
}

export function ProductGallery({ productId, productName }: Props) {
  const fileId = useId();
  const [photos, setPhotos] = useState<CatalogImage[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [replacePhoto, setReplacePhoto] = useState<CatalogImage | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [alt, setAlt] = useState(productName);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reload() {
    setLoading(true);
    try {
      setPhotos(await listAdminCatalogImages(productId));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as fotos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [productId]);

  async function execute(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      invalidatePublicCatalog();
      setNotice(success);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A operação não foi concluída.");
    } finally {
      setBusy(false);
    }
  }

  async function editExisting(photo: CatalogImage) {
    setBusy(true);
    setError("");
    try {
      const candidate = await fetchPublicImageFile(photo.url);
      setReplacePhoto(photo);
      setEditingFile(candidate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir esta imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.gallery} aria-label="Fotos do produto">
      <h3>Fotos do produto</h3>
      <p className={styles.hint}>
        PNG, JPEG ou WebP até 12 MB. As imagens são otimizadas em WebP e publicadas na loja.
        É necessário ter o serviço de mídia e o bucket de catálogo ativados.
      </p>
      {loading && <p role="status">Carregando galeria…</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className={styles.grid}>
        {photos.map((photo) => (
          <article className={styles.photo} key={photo.mediaId}>
            <img src={photo.url} alt={photo.alt || productName} loading="lazy" width={240} height={240} />
            <div className={styles.actions}>
              <Button
                size="sm" variant={photo.primary ? "primary" : "outline"}
                disabled={busy || photo.primary}
                onClick={() => void execute(
                  () => makePrimaryCatalogImage(productId, photo.mediaId),
                  "Foto principal atualizada.",
                )}
              >
                <Star size={14} /> {photo.primary ? "Principal" : "Definir principal"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => void editExisting(photo)}>
                <Crop size={14}/> Ajustar
              </Button>
              <Button
                size="sm" variant="outline"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Remover esta foto do produto?")) return;
                  void execute(
                    () => deleteCatalogImage(productId, photo.mediaId),
                    "Foto removida.",
                  );
                }}
              >
                <Trash2 size={14} /> Remover
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!loading && photos.length === 0 && <p className={styles.hint}>Nenhuma foto cadastrada.</p>}
      {editingFile && (
        <ImageCropEditor file={editingFile} shape="product"
          onCancel={() => { setEditingFile(null); setReplacePhoto(null); }}
          onApply={(adjusted) => {
            if (!replacePhoto) {
              setFile(adjusted);
              setImageUrl("");
              setEditingFile(null);
              return;
            }
            const old = replacePhoto;
            setEditingFile(null);
            setReplacePhoto(null);
            void execute(async () => {
              const newId = await uploadCatalogImage(productId, adjusted, old.alt || productName);
              if (old.primary) await makePrimaryCatalogImage(productId, newId);
              await deleteCatalogImage(productId, old.mediaId);
            }, "Imagem reenquadrada e substituída.");
          }}
        />
      )}
      <div className={styles.upload}>
        <label htmlFor={fileId}>Adicionar imagem</label>
        <input
          id={fileId} type="file" accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            if (selected) setImageUrl("");
          }}
        />
        <Input
          label="URL pública HTTPS (alternativa ao arquivo local)"
          type="url" inputMode="url" placeholder="https://exemplo.com/imagem.jpg"
          value={imageUrl} disabled={busy}
          onChange={(event) => {
            setImageUrl(event.target.value);
            if (event.target.value) {
              setFile(null);
              const local = document.getElementById(fileId) as HTMLInputElement | null;
              if (local) local.value = "";
            }
          }}
        />
        {file && !editingFile && (
          <Button variant="outline" disabled={busy}
            onClick={() => { setReplacePhoto(null); setEditingFile(file); }}>
            <Crop size={16}/> Ajustar posição e zoom
          </Button>
        )}
        <Input
          label="Texto alternativo da foto" maxLength={200} value={alt}
          onChange={(event) => setAlt(event.target.value)}
        />
        <Button
          disabled={(!file && !imageUrl.trim()) || busy}
          onClick={() => {
            if (!file && !imageUrl.trim()) return;
            void execute(async () => {
              if (file) {
                await uploadCatalogImage(productId, file, alt);
              } else {
                await uploadCatalogImageFromUrl(productId, imageUrl, alt);
              }
              setImageUrl("");
              setFile(null);
              const input = document.getElementById(fileId) as HTMLInputElement | null;
              if (input) input.value = "";
            }, "Foto enviada com sucesso.");
          }}
        >
          <ImagePlus size={17} /> {busy ? "Enviando…" : file ? "Enviar foto" : "Importar imagem da URL"}
        </Button>
      </div>
    </section>
  );
}

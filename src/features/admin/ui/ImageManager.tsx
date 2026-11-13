import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Star, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { adminStyles as s } from "./AdminUI";
import { safeUrl } from "@/shared/utils/safe-url";

/**
 * Demo image manager. Saved images are paths/URLs only. Files picked from the computer become
 * temporary object URLs (preview only): they are never written to LocalStorage.
 */
export function ImageManager({ images, onChange }: { images: string[]; onChange: (next: string[]) => void }) {
  const [path, setPath] = useState("");
  const [err, setErr] = useState("");
  const created = useRef<string[]>([]);
  useEffect(() => () => created.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function addPath() {
    const v = path.trim();
    if (!safeUrl(v)) { setErr("Use um caminho local (/images/produtos/foto.jpg) ou https://."); return; }
    onChange([...images, v]); setPath(""); setErr("");
  }
  function addFiles(files: FileList | null) {
    if (!files) return;
    const urls = [...files].filter((f) => f.type.startsWith("image/")).map((f) => URL.createObjectURL(f));
    created.current.push(...urls);
    onChange([...images, ...urls]);
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= images.length) return;
    const next = [...images]; [next[i], next[j]] = [next[j]!, next[i]!]; onChange(next);
  };
  const hasTemp = images.some((u) => u.startsWith("blob:"));

  return (
    <div className={s.field}>
      <span className={s.label}>Imagens</span>
      {images.length > 0 && (
        <ul className={s.thumbs} style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {images.map((src, i) => (
            <li key={src + i} className={s.thumb}>
              {i === 0 && <span className={s.thumbTag}>Principal</span>}
              <img src={created.current.includes(src) ? src : safeUrl(src)} alt={`Imagem ${i + 1}`} />
              <div className={s.thumbBar}>
                <Button size="icon" variant="ghost" aria-label="Mover para a esquerda" onClick={() => move(i, -1)} disabled={i === 0}><ArrowLeft size={14} /></Button>
                <Button size="icon" variant="ghost" aria-label="Definir como principal" onClick={() => onChange([src, ...images.filter((_, k) => k !== i)])} disabled={i === 0}><Star size={14} /></Button>
                <Button size="icon" variant="ghost" aria-label="Mover para a direita" onClick={() => move(i, 1)} disabled={i === images.length - 1}><ArrowRight size={14} /></Button>
                <Button size="icon" variant="ghost" aria-label="Remover imagem" onClick={() => onChange(images.filter((_, k) => k !== i))}><Trash2 size={14} /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={s.toolbar}>
        <Input className={s.grow} label="Caminho ou URL da imagem" placeholder="/images/produtos/luminaria.jpg" value={path} onChange={(e) => setPath(e.target.value)} error={err} />
        <Button variant="outline" onClick={addPath}>Adicionar</Button>
        <label className={s.check} style={{ height: 44 }}>
          <input type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} aria-label="Selecionar imagens do computador" />
        </label>
      </div>
      <span className={s.hint}>
        Arquivos selecionados do computador servem só para pré-visualização: não são enviados a um servidor, não aparecem em outros dispositivos e somem ao recarregar a página. {hasTemp && "Remova-os antes de salvar."}
      </span>
    </div>
  );
}

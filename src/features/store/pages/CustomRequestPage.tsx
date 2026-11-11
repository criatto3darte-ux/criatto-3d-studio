import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ImagePlus, Lightbulb } from "lucide-react";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { DemoNotice } from "@/shared/ui/DemoNotice";
import { PageHeader } from "../components/Section";
import styles from "./InfoPages.module.css";

const MAX_FILE_MB = 5;
interface Errors { description?: string; quantity?: string; file?: string }

export function CustomRequestPage() {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dims, setDims] = useState({ w: "", h: "", d: "" });
  const [colors, setColors] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  // Local preview only — the file never leaves the browser.
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f: File | undefined) {
    if (!f) { setFile(null); return; }
    if (!f.type.startsWith("image/")) { setErrors((e) => ({ ...e, file: "Envie um arquivo de imagem (JPG, PNG ou WebP)." })); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setErrors((e) => ({ ...e, file: `A imagem deve ter até ${MAX_FILE_MB} MB.` })); return; }
    setErrors(({ file: _f, ...rest }) => rest);
    setFile(f);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (description.trim().length < 10) next.description = "Descreva sua ideia com pelo menos 10 caracteres.";
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1 || q > 999) next.quantity = "Informe uma quantidade entre 1 e 999.";
    setErrors(next);
    if (Object.keys(next).length === 0) setSent(true);
  }

  function reset() {
    setDescription(""); setQuantity("1"); setDims({ w: "", h: "", d: "" }); setColors(""); setFile(null); setSent(false);
  }

  return (
    <div className="container">
      <PageHeader eyebrow="Sob medida" title="Produtos personalizados" text="Conte sua ideia e prepararemos uma peça exclusiva para você." />
      <div className={styles.grid2}>
        <div className={styles.panel}>
          {sent ? (
            <div className={styles.form}>
              <div className={styles.success} role="status">
                <CheckCircle2 size={22} color="var(--color-success)" aria-hidden="true" />
                <div>
                  <strong>Solicitação de demonstração registrada.</strong>
                  <p className={styles.muted}>Nada foi enviado: nesta etapa o formulário apenas simula a solicitação. O envio real pelo WhatsApp chega em uma etapa futura.</p>
                </div>
              </div>
              <Button variant="outline" onClick={reset}>Fazer outra solicitação</Button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={submit} noValidate>
              <div className={styles.field}>
                <label htmlFor="desc" className={styles.label}>Descreva o produto *</label>
                <textarea id="desc" className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: chaveiro com o nome “Ana” e um coração ao lado" aria-invalid={!!errors.description || undefined} aria-describedby={errors.description ? "desc-err" : undefined} maxLength={1000} />
                {errors.description && <span id="desc-err" className={styles.error}>{errors.description}</span>}
              </div>
              <Input label="Quantidade *" type="number" inputMode="numeric" min={1} max={999} value={quantity} onChange={(e) => setQuantity(e.target.value)} {...(errors.quantity ? { error: errors.quantity } : {})} />
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className={styles.label} style={{ marginBottom: 6 }}>Dimensões aproximadas (cm)</legend>
                <div className={styles.row3}>
                  <Input aria-label="Largura em cm" placeholder="Largura" inputMode="decimal" value={dims.w} onChange={(e) => setDims({ ...dims, w: e.target.value })} />
                  <Input aria-label="Altura em cm" placeholder="Altura" inputMode="decimal" value={dims.h} onChange={(e) => setDims({ ...dims, h: e.target.value })} />
                  <Input aria-label="Profundidade em cm" placeholder="Profundidade" inputMode="decimal" value={dims.d} onChange={(e) => setDims({ ...dims, d: e.target.value })} />
                </div>
              </fieldset>
              <Input label="Cores desejadas" placeholder="Ex.: roxo e branco" value={colors} onChange={(e) => setColors(e.target.value)} maxLength={120} />
              <div className={styles.file}>
                <label htmlFor="ref" className={styles.label}><ImagePlus size={16} style={{ verticalAlign: "-3px" }} /> Imagem de referência (opcional)</label>
                <input id="ref" type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])} />
                <span className={styles.hint}>Até {MAX_FILE_MB} MB. A imagem fica só no seu navegador e não é enviada a nenhum serviço.</span>
                {errors.file && <span className={styles.error}>{errors.file}</span>}
                {preview && <img src={preview} alt="Pré-visualização da referência" className={styles.preview} />}
              </div>
              <Button type="submit" size="lg">Solicitar orçamento</Button>
              <DemoNotice>Formulário de demonstração: nenhuma informação é enviada ou armazenada.</DemoNotice>
            </form>
          )}
        </div>
        <aside className={styles.panel}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}><Lightbulb size={18} style={{ verticalAlign: "-3px" }} /> Dicas para um bom pedido</h2>
          <ul className={styles.list}>
            {["Diga para que a peça será usada.", "Informe as medidas máximas, se houver.", "Uma imagem de referência ajuda muito.", "Peças personalizadas são feitas sob encomenda."].map((t) => (
              <li key={t}><CheckCircle2 size={16} aria-hidden="true" /> {t}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

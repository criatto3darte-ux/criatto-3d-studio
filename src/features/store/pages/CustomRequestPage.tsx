import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Lightbulb } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/shared/ui/Input";
import { NAME_MAX, NOTES_MAX, buildCustomRequestMessage, maskPhone, validateName, validatePhone } from "@/features/checkout/checkout.logic";
import { WhatsAppAction } from "@/features/checkout/WhatsAppAction";
import { PageHeader } from "../components/Section";
import styles from "./InfoPages.module.css";

const MAX_FILE_MB = 5;
interface Errors { name?: string; phone?: string; description?: string; quantity?: string; file?: string }

export function CustomRequestPage() {
  // All fields stay in memory only; nothing is stored or uploaded.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dims, setDims] = useState({ w: "", h: "", d: "" });
  const [colors, setColors] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Local preview only — the file never leaves the browser and is never turned into a public link.
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f: File | undefined) {
    if (!f) { setFile(null); return; }
    if (!f.type.startsWith("image/")) { setErrors((e) => ({ ...e, file: "Escolha um arquivo de imagem (JPG, PNG ou WebP)." })); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setErrors((e) => ({ ...e, file: `A imagem deve ter até ${MAX_FILE_MB} MB.` })); return; }
    setErrors(({ file: _f, ...rest }) => rest);
    setFile(f);
  }

  const dimensions = [dims.w && `L ${dims.w}`, dims.h && `A ${dims.h}`, dims.d && `P ${dims.d}`].filter(Boolean).join(" × ");
  const qty = Number(quantity);
  const message = useMemo(
    () => buildCustomRequestMessage({ name, phone, description, quantity: Number.isInteger(qty) && qty > 0 ? qty : 1, ...(dimensions ? { dimensions: `${dimensions} cm` } : {}), colors, notes, hasReferenceImage: !!file }),
    [name, phone, description, qty, dimensions, colors, notes, file],
  );

  function validate(): boolean {
    const next: Errors = {};
    const n = validateName(name); if (n) next.name = n;
    const p = validatePhone(phone); if (p) next.phone = p;
    if (description.trim().length < 10) next.description = "Descreva sua ideia com pelo menos 10 caracteres.";
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) next.quantity = "Informe uma quantidade entre 1 e 999.";
    setErrors((e) => ({ ...(e.file ? { file: e.file } : {}), ...next }));
    if (Object.keys(next).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return false;
    }
    return true;
  }

  return (
    <div className="container">
      <PageHeader eyebrow="Sob medida" title="Produtos personalizados" text="Conte sua ideia e envie a solicitação de orçamento pelo WhatsApp." />
      <div className={styles.grid2}>
        <form ref={formRef} className={`${styles.panel} ${styles.form}`} noValidate onSubmit={(e) => e.preventDefault()}>
          <Input label="Nome completo *" autoComplete="name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} {...(errors.name ? { error: errors.name } : {})} />
          <Input label="WhatsApp com DDD *" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(21) 99999-9999" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} {...(errors.phone ? { error: errors.phone } : {})} />
          <div className={styles.field}>
            <label htmlFor="desc" className={styles.label}>Descreva o produto *</label>
            <textarea id="desc" className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: chaveiro com o nome “Ana” e um coração ao lado" aria-invalid={!!errors.description || undefined} aria-describedby={errors.description ? "desc-err" : undefined} maxLength={1000} />
            {errors.description && <span id="desc-err" className={styles.error}>{errors.description}</span>}
          </div>
          <Input label="Quantidade *" type="number" inputMode="numeric" min={1} max={999} value={quantity} onChange={(e) => setQuantity(e.target.value)} {...(errors.quantity ? { error: errors.quantity } : {})} />
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className={styles.label} style={{ marginBottom: 6 }}>Tamanho aproximado (cm)</legend>
            <div className={styles.row3}>
              <Input aria-label="Largura em cm" placeholder="Largura" inputMode="decimal" maxLength={6} value={dims.w} onChange={(e) => setDims({ ...dims, w: e.target.value.replace(/[^\d,.]/g, "") })} />
              <Input aria-label="Altura em cm" placeholder="Altura" inputMode="decimal" maxLength={6} value={dims.h} onChange={(e) => setDims({ ...dims, h: e.target.value.replace(/[^\d,.]/g, "") })} />
              <Input aria-label="Profundidade em cm" placeholder="Profundidade" inputMode="decimal" maxLength={6} value={dims.d} onChange={(e) => setDims({ ...dims, d: e.target.value.replace(/[^\d,.]/g, "") })} />
            </div>
          </fieldset>
          <Input label="Cores desejadas" placeholder="Ex.: roxo e branco" value={colors} onChange={(e) => setColors(e.target.value)} maxLength={120} />
          <div className={styles.field}>
            <label htmlFor="obs" className={styles.label}>Observações (opcional)</label>
            <textarea id="obs" className={styles.textarea} style={{ minHeight: 80 }} value={notes} maxLength={NOTES_MAX} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className={styles.file}>
            <label htmlFor="ref" className={styles.label}><ImagePlus size={16} style={{ verticalAlign: "-3px" }} /> Imagem de referência (opcional)</label>
            <input id="ref" type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])} />
            <span className={styles.hint}>A imagem fica só no seu navegador. Ela <strong>não</strong> é anexada automaticamente: envie o arquivo diretamente na conversa do WhatsApp.</span>
            {errors.file && <span className={styles.error}>{errors.file}</span>}
            {preview && <img src={preview} alt="Pré-visualização da referência" className={styles.preview} />}
          </div>
          <p className={styles.hint}>Seus dados serão usados apenas para atendimento e orçamento. Veja a <Link to="/privacidade" style={{ textDecoration: "underline" }}>Política de Privacidade</Link>.</p>
          <WhatsAppAction
            message={message}
            validate={validate}
            label="Solicitar orçamento pelo WhatsApp"
            openedText={file ? "Abrimos o WhatsApp com a mensagem pronta. Envie a mensagem e, em seguida, anexe a imagem de referência na conversa." : "Abrimos o WhatsApp com a mensagem pronta. Confira e toque em enviar."}
          />
        </form>
        <aside className={styles.panel}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}><Lightbulb size={18} style={{ verticalAlign: "-3px" }} /> Dicas para um bom pedido</h2>
          <ul className={styles.list}>
            {["Diga para que a peça será usada.", "Informe as medidas máximas, se houver.", "Uma imagem de referência ajuda muito — envie na conversa.", "Peças personalizadas são feitas sob encomenda."].map((t) => (
              <li key={t}><CheckCircle2 size={16} aria-hidden="true" /> {t}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

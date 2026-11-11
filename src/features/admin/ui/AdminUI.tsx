import { useEffect, useId, useRef, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { X } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { cx } from "@/shared/utils/cx";
import styles from "./admin.module.css";

export { styles as adminStyles };

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string | undefined }) {
  return (
    <Card className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </Card>
  );
}

export function SelectField({ label, error, hint, children, className, id, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string | undefined; hint?: string | undefined }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={fid} className={styles.label}>{label}</label>
      <select id={fid} className={styles.select} aria-invalid={!!error || undefined} {...rest}>{children}</select>
      {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

export function TextareaField({ label, error, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string | undefined }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={fid} className={styles.label}>{label}</label>
      <textarea id={fid} className={styles.textarea} aria-invalid={!!error || undefined} {...rest} />
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

/** Native <dialog>: focus trap, Esc to close and backdrop handled by the browser. */
export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-label={title}>
      {open && (
        <>
          <div className={styles.dialogHead}>
            <h2>{title}</h2>
            <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X size={20} /></Button>
          </div>
          <div className={styles.dialogBody}>{children}</div>
          {footer && <div className={styles.dialogFoot}>{footer}</div>}
        </>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel = "Confirmar", danger, onConfirm, onCancel, children }: { open: boolean; title: string; text: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void; children?: ReactNode }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} footer={
      <>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
      </>
    }>
      <p style={{ margin: 0 }}>{text}</p>
      {children}
    </Modal>
  );
}

export function DataTable({ head, children, empty, label }: { head: ReactNode; children: ReactNode; empty?: boolean; label: string }) {
  return (
    <div className={styles.tableWrap} role="region" aria-label={label} tabIndex={0}>
      <table className={styles.table}>
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <div className={styles.empty}>Nenhum registro encontrado.</div>}
    </div>
  );
}

export function BarChart({ data, alt }: { data: { label: string; value: number; display?: string }[]; alt?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={styles.bars} role="img" aria-label={data.map((d) => `${d.label}: ${d.display ?? d.value}`).join("; ")}>
      {data.map((d, i) => (
        <div key={d.label + i} className={styles.bar} title={`${d.label}: ${d.display ?? d.value}`}>
          <div className={cx(styles.barFill, alt && styles.barFillAlt)} style={{ height: `${(d.value / max) * 100}%` }} />
          <span className={styles.barLabel}>{i % Math.max(1, Math.ceil(data.length / 6)) ? "" : d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className={styles.muted}>Sem dados.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((i) => (
        <div key={i.label} className={styles.hbar}>
          <span>{i.label}</span><strong>{i.value}</strong>
          <div className={styles.hbarTrack}><div className={styles.hbarFill} style={{ width: `${(i.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", withTime ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Parses "12,90" / "12.90" / "1.234,56" into cents; returns NaN for invalid input. */
export function parseMoney(v: string): number {
  const t = v.trim().replace(/\s|R\$/g, "");
  if (!t) return NaN;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  return Math.round(Number(normalized) * 100);
}
export function centsToInput(c: number | undefined | null): string {
  return c === undefined || c === null ? "" : (c / 100).toFixed(2).replace(".", ",");
}

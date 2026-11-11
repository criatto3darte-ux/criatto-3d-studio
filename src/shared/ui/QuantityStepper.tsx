import { Minus, Plus } from "lucide-react";
import styles from "./QuantityStepper.module.css";

export function QuantityStepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button type="button" className={styles.btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Diminuir quantidade"><Minus size={16} /></button>
      <output className={styles.value} aria-live="polite">{value}</output>
      <button type="button" className={styles.btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Aumentar quantidade"><Plus size={16} /></button>
    </div>
  );
}

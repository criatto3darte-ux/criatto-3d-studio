import { useRef, useState, type MouseEvent } from "react";
import { Button } from "@/shared/ui/Button";
import { AlertTriangle, CheckCircle2, MessageCircle } from "lucide-react";
import { storeConfig } from "@/shared/config/store.config";
import { buildWhatsAppUrl, isValidBusinessNumber } from "./checkout.logic";
import styles from "./WhatsAppAction.module.css";

/**
 * "Finalizar pelo WhatsApp" as a real link opened by the user's click (no pop-up blocking).
 * `validate` runs first; returning false cancels navigation so the form can show errors.
 */
export function WhatsAppAction({ message, validate, label = "Finalizar pelo WhatsApp", openedText }: { message: string; validate: () => boolean; label?: string; openedText: string }) {
  const [opened, setOpened] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const configured = isValidBusinessNumber(storeConfig.whatsappNumber);
  const url = buildWhatsAppUrl(storeConfig.whatsappNumber, message);

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!url || !validate()) { e.preventDefault(); setOpened(false); return; }
    setOpened(true);
  }

  return (
    <div className={styles.wrap}>
      {configured && url ? (
        <a className={styles.btn} href={url} target="_blank" rel="noopener noreferrer" onClick={onClick}>
          <MessageCircle size={20} aria-hidden="true" /> {label}
        </a>
      ) : (
        <>
          <button type="button" className={styles.btn} disabled aria-disabled="true" aria-describedby="wa-unconfigured">
            <MessageCircle size={20} aria-hidden="true" /> {label}
          </button>
          <p id="wa-unconfigured" className={styles.warn} role="note">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>O WhatsApp comercial da loja ainda não foi configurado, por isso a finalização está desativada. Você pode conferir seus dados e a prévia da mensagem.</span>
          </p>
          <Button variant="outline" onClick={() => { if (validate() && detailsRef.current) detailsRef.current.open = true; }}>Verificar dados e ver prévia</Button>
        </>
      )}
      <div aria-live="polite">
        {opened && (
          <p className={styles.ok}><CheckCircle2 size={18} aria-hidden="true" /><span>{openedText}</span></p>
        )}
      </div>
      <details ref={detailsRef} className={styles.preview}>
        <summary>Ver prévia da mensagem</summary>
        <pre className={styles.pre}>{message}</pre>
      </details>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { FlaskConical, Info, X } from "lucide-react";
import styles from "./PublicDemoBanner.module.css";

/**
 * Banner fixo mantém o limite comercial visível enquanto o checkout transacional
 * (CR-010C) e o fluxo real de pedidos ainda não foram entregues.
 */
export function PublicDemoBanner() {
  const search = useSearch({ strict: false }) as { adminDisabled?: string } | undefined;
  const fromAdmin = search?.adminDisabled === "1";
  const liveCheckout = import.meta.env.VITE_ENABLE_LIVE_CHECKOUT === "true";
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (fromAdmin) {
      setDismissed(false);
    }
  }, [fromAdmin]);

  if (dismissed) return null;

  return (
    <div className={styles.banner} role="region" aria-label="Aviso de versão demonstrativa">
      <div className={styles.inner}>
        <span className={styles.icon} aria-hidden="true">
          <FlaskConical size={16} />
        </span>
        <div className={styles.text}>
          <strong>Loja em homologação comercial.</strong> O catálogo publicado é consultado no
          Supabase.{" "}
          {liveCheckout
            ? "Os pedidos de teste são registrados antes do atendimento pelo WhatsApp."
            : "Pedidos ainda não são processados; entre em contato pelo WhatsApp para informações."}{" "}
          {fromAdmin && (
            <>
              <Info size={14} aria-hidden="true" />{" "}
              <em>A área administrativa será disponibilizada após a homologação.</em>{" "}
            </>
          )}
          <Link to="/sobre" className={styles.link}>
            Saiba mais →
          </Link>
        </div>
        <button
          type="button"
          aria-label="Fechar aviso"
          className={styles.close}
          onClick={() => setDismissed(true)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

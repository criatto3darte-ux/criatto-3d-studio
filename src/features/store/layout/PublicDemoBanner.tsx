import { useEffect, useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import { FlaskConical, Info, X } from "lucide-react";
import styles from "./PublicDemoBanner.module.css";

/**
 * Banner fixo no topo da loja indicando que é uma versão demonstrativa
 * (sem pedidos reais, sem pagamento). Aparece SEMPRE nesta publicação inicial.
 * Se a query ?adminDisabled=1 vier de um redirecionamento do painel, também
 * mostra o aviso de que o admin não está disponível publicamente.
 */
export function PublicDemoBanner() {
  const search = useSearch({ strict: false }) as { adminDisabled?: string } | undefined;
  const fromAdmin = search?.adminDisabled === "1";
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
          <strong>Loja em versão demonstrativa.</strong>{" "}
          Produtos, preços e imagens são fictícios. Nenhum pedido será cobrado
          ou processado; o checkout apenas simula o fluxo.{" "}
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

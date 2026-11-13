import { Link } from "@tanstack/react-router";
import { isValidBusinessNumber } from "@/features/checkout/checkout.logic";
import { Logo } from "@/shared/ui/Logo";
import { useStoreCatalog, useStoreSettings } from "@/features/catalog/catalog.service";
import { storeNav } from "./nav";
import styles from "./StoreFooter.module.css";
import { safeEmail, safeSocialUrl } from "@/shared/utils/safe-url";

export function StoreFooter() {
  const { whatsappNumber, email, instagram, tiktok } = useStoreSettings();
  const { categories } = useStoreCatalog();
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div>
            <Logo compact />
            <p className={styles.about}>Produtos criativos fabricados por impressão 3D, com qualidade, precisão e atendimento personalizado.</p>
          </div>
          <nav aria-label="Rodapé">
            <h2 className={styles.title}>Navegação</h2>
            <ul className={styles.list}>
              {storeNav.map((i) => <li key={i.to}><Link to={i.to}>{i.label}</Link></li>)}
            </ul>
          </nav>
          <div>
            <h2 className={styles.title}>Categorias</h2>
            <ul className={styles.list}>
              {categories.map((c) => <li key={c.slug}><Link to="/produtos" search={{ categoria: c.slug }}>{c.name}</Link></li>)}
            </ul>
          </div>
          <div>
            <h2 className={styles.title}>Atendimento</h2>
            <ul className={styles.list}>
              <li><Link to="/carrinho">Meu carrinho</Link></li>
              <li><Link to="/personalizados">Solicitar personalizado</Link></li>
              <li><Link to="/contato">Fale conosco</Link></li>
              <li><Link to="/privacidade">Política de Privacidade</Link></li>
              {isValidBusinessNumber(whatsappNumber) && <li><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
              {safeEmail(email) && <li><a href={`mailto:${email}`}>{email}</a></li>}
              {safeSocialUrl(instagram, "instagram") && <li><a href={safeSocialUrl(instagram, "instagram")} target="_blank" rel="noopener noreferrer">Instagram</a></li>}
              {safeSocialUrl(tiktok, "tiktok") && <li><a href={safeSocialUrl(tiktok, "tiktok")} target="_blank" rel="noopener noreferrer">TikTok</a></li>}
            </ul>
          </div>
        </div>
        <div className={styles.bottom}>
          <span>© {new Date().getFullYear()} Criatto 3D. Todos os direitos reservados.</span>
          <span>Pedidos finalizados pelo WhatsApp, sem cadastro.</span>
        </div>
      </div>
    </footer>
  );
}

import { Link } from "@tanstack/react-router";
import { Logo } from "@/shared/ui/Logo";
import { storeNav } from "./nav";
import styles from "./StoreFooter.module.css";

export function StoreFooter() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div>
            <Logo compact />
            <p className={styles.about}>Produtos criativos fabricados por impressão 3D, com qualidade, precisão e atendimento personalizado.</p>
          </div>
          <div>
            <h2 className={styles.title}>Navegação</h2>
            <ul className={styles.list}>
              {storeNav.map((i) => (
                <li key={i.to}><Link to={i.to}>{i.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={styles.title}>Atendimento</h2>
            <ul className={styles.list}>
              <li><Link to="/carrinho">Meu carrinho</Link></li>
              <li><Link to="/personalizados">Solicitar personalizado</Link></li>
              <li><Link to="/contato">Fale conosco</Link></li>
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

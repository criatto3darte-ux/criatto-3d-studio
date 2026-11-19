import { useEffect, useState, type ReactNode } from "react";
import { useHydrated } from "@tanstack/react-router";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronsLeft, ChevronsRight, CircleHelp, ExternalLink, LogOut, Menu } from "lucide-react";
import { Logo } from "@/shared/ui/Logo";
import { Button, buttonClass } from "@/shared/ui/Button";
import { ThemeSegmented, ThemeToggleButton } from "@/shared/ui/ThemeToggle";
import { adminNav, findAdminNav } from "./nav";
import styles from "./AdminLayout.module.css";
import { cx } from "@/shared/utils/cx";
import { getSupabase } from "@/lib/supabase/client";
import { clearLegacyDemoData } from "@/features/admin/admin-metrics";


export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const current = findAdminNav(pathname);
  const hydrated = useHydrated();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panel, setPanel] = useState<"none" | "help">("none");
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await getSupabase().auth.signOut();
      await navigate({ to: "/admin/login", search: { mode: "login" }, replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    // Remove dados de demonstração antigos deixados no navegador.
    clearLegacyDemoData(typeof window === "undefined" ? undefined : window.localStorage);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setPanel("none");
  }, [pathname]);

  return (
    <div className={cx(styles.shell, collapsed && styles.collapsed)}>
      {mobileOpen && (
        <button
          className={styles.backdrop}
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cx(styles.sidebar, mobileOpen && styles.mobileOpen)}
        aria-label="Menu administrativo"
      >
        <Link to="/admin" className={styles.brand} aria-label="Painel Criatto 3D">
          <Logo showText={!collapsed} />
        </Link>
        <nav className={styles.nav}>
          {adminNav.map((item) => {
            const Icon = item.icon;
            const active = current.to === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cx(styles.item, active && styles.itemActive)}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={21} />
                <span className={styles.label}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.bottom}>
          <div className={styles.themeBox}>
            <ThemeSegmented full />
          </div>
          <div className={styles.profile}>
            <span className={styles.avatar} aria-hidden="true">
              AD
            </span>
            <span className={styles.profileText}>
              <strong>Administrador</strong>
              <small>Acesso administrativo</small>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair do painel"
              title="Sair do painel"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              <LogOut size={19} />
            </Button>
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <Button
            variant="ghost"
            size="icon"
            className={styles.mobileOnly}
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={24} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={styles.hideMobile}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronsRight size={22} /> : <ChevronsLeft size={22} />}
          </Button>
          <div className={styles.titles}>
            <h1>{current.to === "/admin" ? "Painel Administrativo" : current.label}</h1>
            <p>{current.subtitle}</p>
          </div>
          <div className={styles.headerActions}>
            <Button variant="ghost" size="icon" className={styles.hideMobile} aria-label="Ajuda" aria-expanded={panel === "help"} onClick={() => setPanel((p) => (p === "help" ? "none" : "help"))}>
              <CircleHelp size={21} />
            </Button>
            <span className={styles.hideMobile}>
              <ThemeToggleButton />
            </span>
            <Link
              to="/"
              className={buttonClass("outline", "md", styles.storeLink)}
              target="_blank"
              rel="noopener"
              aria-label="Ver Loja (abre em nova aba)"
            >
              <span className={styles.storeLabel}>Ver Loja</span>{" "}
              <ExternalLink size={16} aria-hidden="true" />
            </Link>
            {panel === "help" && (
              <div className={styles.popover} role="dialog" aria-label="Ajuda">
                <h2>Ajuda</h2>
                <p>Gerencie o catálogo, estoque, banners, configurações e pedidos registrados pela loja. Alterações administrativas autorizadas são persistidas no Supabase.</p>
              </div>
            )}
          </div>
        </header>
        <div className={styles.content}>
          {/* Aguarda a hidratação antes de renderizar os módulos administrativos. */}
          <div style={{ marginTop: 24 }}>{hydrated ? children : <p aria-busy="true">Carregando painel administrativo…</p>}</div>
        </div>
      </div>
    </div>
  );
}

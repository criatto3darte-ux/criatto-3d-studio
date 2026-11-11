import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronsLeft, ChevronsRight, CircleHelp, ExternalLink, Menu } from "lucide-react";
import { Logo } from "@/shared/ui/Logo";
import { Button, buttonClass } from "@/shared/ui/Button";
import { ThemeSegmented, ThemeToggleButton } from "@/shared/ui/ThemeToggle";
import { DemoNotice } from "@/shared/ui/DemoNotice";
import { adminNav, findAdminNav } from "./nav";
import styles from "./AdminLayout.module.css";
import { cx } from "@/shared/utils/cx";

const demoNotifications = [
  { title: "Novo pedido iniciado (#4588)", time: "há 5 min" },
  { title: "Solicitação de personalização recebida", time: "há 1 h" },
  { title: "Estoque baixo: Organizador de Mesa", time: "ontem" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = findAdminNav(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panel, setPanel] = useState<"none" | "notifications" | "help">("none");

  useEffect(() => {
    setMobileOpen(false);
    setPanel("none");
  }, [pathname]);

  return (
    <div className={cx(styles.shell, collapsed && styles.collapsed)}>
      {mobileOpen && <button className={styles.backdrop} aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <aside className={cx(styles.sidebar, mobileOpen && styles.mobileOpen)} aria-label="Menu administrativo">
        <Link to="/admin" className={styles.brand} aria-label="Painel Criatto 3D">
          <Logo showText={!collapsed} />
        </Link>
        <nav className={styles.nav}>
          {adminNav.map((item) => {
            const Icon = item.icon;
            const active = current.to === item.to;
            return (
              <Link key={item.to} to={item.to} className={cx(styles.item, active && styles.itemActive)} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined}>
                <Icon size={21} />
                <span className={styles.label}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={styles.bottom}>
          <div className={styles.themeBox}><ThemeSegmented full /></div>
          <div className={styles.profile}>
            <span className={styles.avatar} aria-hidden="true">AD</span>
            <span className={styles.profileText}>
              <strong>Administrador</strong>
              <small>Perfil demonstrativo</small>
            </span>
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <Button variant="ghost" size="icon" className={styles.mobileOnly} aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
            <Menu size={24} />
          </Button>
          <Button variant="ghost" size="icon" className={styles.hideMobile} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronsRight size={22} /> : <ChevronsLeft size={22} />}
          </Button>
          <div className={styles.titles}>
            <h1>{current.to === "/admin" ? "Painel Administrativo" : current.label}</h1>
            <p>{current.subtitle}</p>
          </div>
          <div className={styles.headerActions}>
            <Button variant="ghost" size="icon" className={styles.bell} aria-label="Notificações" aria-expanded={panel === "notifications"} onClick={() => setPanel((p) => (p === "notifications" ? "none" : "notifications"))}>
              <Bell size={21} />
              <span className={styles.bellDot} aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" className={styles.hideMobile} aria-label="Ajuda" aria-expanded={panel === "help"} onClick={() => setPanel((p) => (p === "help" ? "none" : "help"))}>
              <CircleHelp size={21} />
            </Button>
            <span className={styles.hideMobile}><ThemeToggleButton /></span>
            <Link to="/" className={buttonClass("outline", "md", styles.storeLink)} target="_blank" rel="noopener" aria-label="Ver Loja (abre em nova aba)">
              <span className={styles.storeLabel}>Ver Loja</span> <ExternalLink size={16} aria-hidden="true" />
            </Link>
            {panel === "notifications" && (
              <div className={styles.popover} role="dialog" aria-label="Notificações">
                <h2>Notificações (demonstração)</h2>
                <ul>
                  {demoNotifications.map((n) => (
                    <li key={n.title}>{n.title}<small>{n.time}</small></li>
                  ))}
                </ul>
              </div>
            )}
            {panel === "help" && (
              <div className={styles.popover} role="dialog" aria-label="Ajuda">
                <h2>Ajuda</h2>
                <p>Este painel está em modo demonstração. Nenhuma alteração é enviada a um servidor e todos os números são simulados.</p>
              </div>
            )}
          </div>
        </header>
        <div className={styles.content}>
          <DemoNotice />
          <div style={{ marginTop: 24 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

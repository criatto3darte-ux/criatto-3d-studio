import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart, X } from "lucide-react";
import { Logo } from "@/shared/ui/Logo";
import { Input } from "@/shared/ui/Input";
import { Button, buttonClass } from "@/shared/ui/Button";
import { ThemeToggleButton } from "@/shared/ui/ThemeToggle";
import { useCart } from "@/features/cart/CartContext";
import { storeNav } from "./nav";
import styles from "./StoreHeader.module.css";
import { cx } from "@/shared/utils/cx";
import { useStoreSettings } from "@/features/catalog/catalog.service";

function SearchForm({ onDone, className }: { onDone?: () => void; className?: string | undefined }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    navigate({ to: "/produtos", search: term ? { q: term } : {} });
    onDone?.();
  }
  return (
    <form role="search" onSubmit={submit} className={className}>
      <Input
        aria-label="Buscar produtos"
        placeholder="Buscar produtos..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        trailing={<button type="submit" className={styles.searchBtn} aria-label="Pesquisar"><Search size={18} /></button>}
      />
    </form>
  );
}

export function StoreHeader() {
  const settings = useStoreSettings();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <header className={styles.header}>
      <div className={cx("container", styles.inner)}>
        <Link to="/" aria-label={`${settings.name} — página inicial`} onClick={() => setOpen(false)}>
          <Logo name={settings.name} logo={settings.logo} />
        </Link>
        <nav className={styles.nav} aria-label="Principal">
          {storeNav.map((item) => (
            <Link key={item.to} to={item.to} className={cx(styles.link, isActive(item.to) && styles.active)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <SearchForm className={styles.search} />
          <ThemeToggleButton />
          <Link to="/carrinho" className={cx(buttonClass("ghost", "icon"), styles.cart)} aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`}>
            <ShoppingCart size={24} />
            <span className={styles.count} aria-hidden="true">{count}</span>
          </Link>
          <Button variant="ghost" size="icon" className={styles.menuBtn} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </Button>
        </div>
      </div>
      {open && (
        <div id="mobile-menu" className={styles.mobilePanel}>
          <SearchForm onDone={() => setOpen(false)} />
          <nav aria-label="Menu móvel">
            {storeNav.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={cx(styles.mobileLink, isActive(item.to) && styles.active)} style={{ display: "block" }}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

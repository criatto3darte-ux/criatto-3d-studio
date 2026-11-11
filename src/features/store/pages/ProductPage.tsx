import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, PackageCheck, ShoppingCart } from "lucide-react";
import type { Product } from "@/shared/types/catalog";
import { Button, buttonClass } from "@/shared/ui/Button";
import { DemoNotice } from "@/shared/ui/DemoNotice";
import { QuantityStepper } from "@/shared/ui/QuantityStepper";
import { formatBRL } from "@/shared/utils/format";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { effectivePriceCents } from "@/features/demo-data/rules";
import { PriceTag } from "../components/PriceTag";
import { canPurchase, relatedProducts } from "@/features/catalog/catalog.logic";
import { useCart } from "@/features/cart/CartContext";
import { MAX_ITEM_QUANTITY } from "@/features/cart/cart.logic";
import { ProductMedia } from "../components/ProductMedia";
import { AvailabilityBadge } from "../components/AvailabilityBadge";
import { ProductGrid } from "../components/ProductCard";
import { Section } from "../components/Section";
import styles from "./ProductPage.module.css";
import { cx } from "@/shared/utils/cx";

const VIEWS = 4;

export function ProductPage({ product }: { product: Product }) {
  const cart = useCart();
  const catalog = useStoreCatalog();
  const category = { slug: product.category, name: catalog.categoryName(product.category) };
  const [view, setView] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.variants.map((g) => [g.name, g.options[0]?.label ?? ""])),
  );
  const purchasable = canPurchase(product);
  const views = Math.max(product.images.length, VIEWS);

  function addToCart() {
    cart.add({ productId: product.id, name: product.name, unitPriceCents: effectivePriceCents(product), quantity: qty, variants: selected, ...(product.images[0] ? { image: product.images[0] } : {}) });
    setAdded(true);
  }

  return (
    <div className="container">
      <nav aria-label="Você está em" className={styles.crumbs}>
        <Link to="/">Início</Link> / <Link to="/produtos">Produtos</Link> / <Link to="/produtos" search={{ categoria: category.slug }}>{category.name}</Link> / <span aria-current="page">{product.name}</span>
      </nav>
      <div className={styles.grid}>
        <div>
          <div className={styles.main}><ProductMedia product={product} index={view} eager /></div>
          <div className={styles.thumbs}>
            {Array.from({ length: views }, (_, i) => (
              <button key={i} type="button" className={styles.thumb} aria-pressed={view === i} aria-label={`Ver imagem ${i + 1}`} onClick={() => setView(i)}>
                <ProductMedia product={product} index={i} showTag={false} />
              </button>
            ))}
          </div>
        </div>
        <div className={styles.info}>
          <div className={styles.meta}>
            <Link to="/produtos" search={{ categoria: category.slug }} className={styles.muted}>{category.name}</Link>
            <AvailabilityBadge product={product} />
          </div>
          <h1 className={styles.title}>{product.name}</h1>
          <PriceTag product={product} className={styles.price} />
          <p className={styles.muted}>{product.description}</p>

          {product.availability === "pronta-entrega" && (
            <p className={styles.notice}><PackageCheck size={18} aria-hidden="true" /> Pronta entrega · {product.stock} em estoque (demonstração)</p>
          )}
          {product.availability === "sob-demanda" && (
            <p className={styles.notice}><Clock size={18} aria-hidden="true" /> Sob encomenda · produção em até {product.productionDays ?? "—"} dias úteis</p>
          )}
          {!purchasable && <p className={styles.notice}>Produto indisponível no momento.</p>}

          {product.variants.map((g) => (
            <fieldset key={g.id} className={styles.group}>
              <legend className={styles.legend}>{g.name}: <span className={styles.muted}>{selected[g.name]}</span></legend>
              <div className={styles.options}>
                {g.options.map((o) => (
                  <button key={o.id} type="button" className={styles.chip} aria-pressed={selected[g.name] === o.label} onClick={() => { setSelected((s) => ({ ...s, [g.name]: o.label })); setAdded(false); }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}

          <div>
            <div className={styles.legend}>Quantidade</div>
            <div className={styles.buy}>
              <QuantityStepper label="Quantidade" value={qty} max={MAX_ITEM_QUANTITY} onChange={(v) => { setQty(v); setAdded(false); }} />
              <Button size="lg" disabled={!purchasable} onClick={addToCart}><ShoppingCart size={20} /> Adicionar ao carrinho</Button>
            </div>
          </div>
          <div aria-live="polite">
            {added && (
              <p className={styles.added}><CheckCircle2 size={18} /> Adicionado ao carrinho. <Link to="/carrinho" className={cx(buttonClass("ghost", "sm"))}>Ver carrinho</Link></p>
            )}
          </div>
          <DemoNotice>Produto de demonstração: preço, estoque e prazo são fictícios.</DemoNotice>
        </div>
      </div>
      {relatedProducts(catalog.products, product).length > 0 && (
        <Section id="relacionados" title="Produtos relacionados">
          <ProductGrid products={relatedProducts(catalog.products, product)} />
        </Section>
      )}
    </div>
  );
}

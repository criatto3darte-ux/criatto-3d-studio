import { Link } from "@tanstack/react-router";
import { MessageCircle, ShoppingCart, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/shared/ui/Button";
import { DemoNotice } from "@/shared/ui/DemoNotice";
import { QuantityStepper } from "@/shared/ui/QuantityStepper";
import { formatBRL } from "@/shared/utils/format";
import { useCart } from "@/features/cart/CartContext";
import { MAX_ITEM_QUANTITY } from "@/features/cart/cart.logic";
import { useDemoData } from "@/features/demo-data/repository";
import { ProductMedia } from "../components/ProductMedia";
import { PageHeader } from "../components/Section";
import styles from "./CartPage.module.css";

export function CartPage() {
  const demoProducts = useDemoData().products;
  const { items, count, subtotalCents, setQuantity, remove, clear } = useCart();

  return (
    <div className="container">
      <PageHeader eyebrow="Seu pedido" title="Carrinho" text="Revise os itens antes de finalizar." />
      {items.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingCart size={44} strokeWidth={1.4} aria-hidden="true" />
          <h2 style={{ fontSize: 20 }}>Seu carrinho está vazio</h2>
          <p className={styles.muted}>Explore o catálogo e adicione os produtos que você gostou.</p>
          <Link to="/produtos" className={buttonClass("primary")}>Explorar produtos</Link>
        </div>
      ) : (
        <div className={styles.layout}>
          <div>
            <ul className={styles.list}>
              {items.map((item) => {
                const product = demoProducts.find((p) => p.id === item.productId);
                const slug = product?.slug;
                return (
                  <li key={item.key} className={styles.item}>
                    <div className={styles.thumb}>{product && <ProductMedia product={product} showTag={false} />}</div>
                    <div>
                      {slug ? <Link to="/produto/$slug" params={{ slug }} className={styles.name}>{item.name}</Link> : <span className={styles.name}>{item.name}</span>}
                      <div className={styles.variants}>{Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
                      <div className={styles.unit}>{formatBRL(item.unitPriceCents)} cada</div>
                      <div className={styles.controls}>
                        <QuantityStepper label={`Quantidade de ${item.name}`} value={item.quantity} max={MAX_ITEM_QUANTITY} onChange={(q) => setQuantity(item.key, q)} />
                      </div>
                    </div>
                    <div className={styles.right}>
                      <span className={styles.line}>{formatBRL(item.unitPriceCents * item.quantity)}</span>
                      <Button variant="ghost" size="sm" onClick={() => remove(item.key)} aria-label={`Remover ${item.name}`}><Trash2 size={16} /> Remover</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link to="/produtos" className={buttonClass("outline")}>Continuar comprando</Link>
              <Button variant="ghost" onClick={clear}>Esvaziar carrinho</Button>
            </div>
          </div>
          <aside className={styles.summary} aria-label="Resumo do pedido">
            <h2 style={{ fontSize: 18 }}>Resumo</h2>
            <div className={styles.row}><span>Itens</span><span>{count}</span></div>
            <div className={styles.row}><span>Subtotal</span><span>{formatBRL(subtotalCents)}</span></div>
            <div className={styles.row}><span>Frete</span><span className={styles.muted}>A combinar</span></div>
            <hr style={{ border: 0, borderTop: "1px solid var(--color-border)", width: "100%", margin: 0 }} />
            <div className={styles.row}><span>Total estimado</span><span className={styles.total}>{formatBRL(subtotalCents)}</span></div>
            <Link to="/checkout" className={buttonClass("primary", "lg", styles.checkoutBtn)}><MessageCircle size={20} /> Finalizar pelo WhatsApp</Link>
            <p className={styles.muted}>Sem cadastro. Você confirma o pedido conversando com a loja.</p>
            <DemoNotice>Carrinho de demonstração salvo apenas neste navegador.</DemoNotice>
          </aside>
        </div>
      )}
    </div>
  );
}

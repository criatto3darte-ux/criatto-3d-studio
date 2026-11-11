import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, ShoppingCart } from "lucide-react";
import { Input } from "@/shared/ui/Input";
import { buttonClass } from "@/shared/ui/Button";
import { formatBRL } from "@/shared/utils/format";
import { useCart } from "@/features/cart/CartContext";
import { demoProducts } from "@/features/catalog/products.mock";
import { NAME_MAX, NOTES_MAX, buildOrderMessage, maskPhone, validateName, validatePhone } from "@/features/checkout/checkout.logic";
import { WhatsAppAction } from "@/features/checkout/WhatsAppAction";
import { ProductMedia } from "../components/ProductMedia";
import { PageHeader } from "../components/Section";
import styles from "./CheckoutPage.module.css";

interface Errors { name?: string; phone?: string }

export function CheckoutPage() {
  const { items, count, subtotalCents } = useCart();
  // Personal data lives only in component memory: never written to storage or logs.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const message = useMemo(() => buildOrderMessage(items, { name, phone, notes }), [items, name, phone, notes]);

  function check(focus: boolean): boolean {
    const next: Errors = {};
    const n = validateName(name);
    const p = validatePhone(phone);
    if (n) next.name = n;
    if (p) next.phone = p;
    setErrors(next);
    setTouched(true);
    if (focus) (n ? nameRef : p ? phoneRef : null)?.current?.focus();
    return !n && !p;
  }

  if (items.length === 0) {
    return (
      <div className="container">
        <PageHeader eyebrow="Finalizar pedido" title="Seu carrinho está vazio" text="Adicione produtos ao carrinho para finalizar pelo WhatsApp." />
        <Link to="/produtos" className={buttonClass("primary")}><ShoppingCart size={18} /> Explorar produtos</Link>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="container">
      <PageHeader eyebrow="Finalizar pedido" title="Finalizar pelo WhatsApp" text="Sem cadastro: informe seus dados e conclua a compra conversando com a Criatto 3D." />
      <div className={styles.layout}>
        <form className={styles.panel} noValidate onSubmit={(e) => e.preventDefault()} aria-labelledby="dados-title">
          <h2 id="dados-title" className={styles.h2}>Seus dados</h2>
          {touched && errorCount > 0 && <p className={styles.errorSummary} role="alert">Corrija {errorCount === 1 ? "o campo destacado" : "os campos destacados"} para continuar.</p>}
          <Input ref={nameRef} label="Nome completo *" autoComplete="name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} onBlur={() => touched && check(false)} {...(errors.name ? { error: errors.name } : {})} />
          <Input ref={phoneRef} label="WhatsApp com DDD *" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="(21) 99999-9999" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} onBlur={() => touched && check(false)} {...(errors.phone ? { error: errors.phone } : { hint: "Usado só para falar com você sobre este pedido." })} />
          <div className={styles.field}>
            <label htmlFor="obs" className={styles.label}>Observações (opcional)</label>
            <textarea id="obs" className={styles.textarea} value={notes} maxLength={NOTES_MAX} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: gostaria de confirmar o prazo de fabricação" />
            <span className={styles.hint}>{notes.length}/{NOTES_MAX}</span>
          </div>
          <p className={styles.privacy}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Seus dados serão usados apenas para atendimento e processamento deste pedido. Eles não ficam salvos neste site. Saiba mais na <Link to="/privacidade">Política de Privacidade</Link>.</span>
          </p>
          <Link to="/carrinho" className={styles.back}><ArrowLeft size={14} style={{ verticalAlign: "-2px" }} /> Voltar ao carrinho</Link>
        </form>

        <aside className={`${styles.panel} ${styles.sticky}`} aria-labelledby="resumo-title">
          <h2 id="resumo-title" className={styles.h2}>Resumo do pedido</h2>
          <ul className={styles.items}>
            {items.map((item) => {
              const product = demoProducts.find((p) => p.id === item.productId);
              return (
                <li key={item.key} className={styles.item}>
                  <div className={styles.thumb}>{product && <ProductMedia product={product} showTag={false} />}</div>
                  <div>
                    <div className={styles.name}>{item.name}</div>
                    <div className={styles.meta}>{Object.entries(item.variants).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
                    <div className={styles.meta}>{item.quantity} × {formatBRL(item.unitPriceCents)}</div>
                  </div>
                  <span className={styles.line}>{formatBRL(item.unitPriceCents * item.quantity)}</span>
                </li>
              );
            })}
          </ul>
          <hr className={styles.hr} />
          <div className={styles.row}><span>Itens</span><span>{count}</span></div>
          <div className={styles.row}><span>Subtotal</span><span>{formatBRL(subtotalCents)}</span></div>
          <div className={styles.row}><span>Frete</span><span>A combinar</span></div>
          <div className={styles.row}><strong>Total estimado</strong><span className={styles.total}>{formatBRL(subtotalCents)}</span></div>
          <WhatsAppAction
            message={message}
            validate={() => check(true)}
            openedText="Abrimos o WhatsApp em uma nova aba com a mensagem pronta. Confira e toque em enviar: o pedido só é confirmado na conversa com a loja. Seu carrinho continua aqui caso queira ajustar algo."
          />
        </aside>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, MessageCircle } from "lucide-react";
import { Button, buttonClass } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { PageHeader } from "../components/Section";
import { useReconciledCart } from "@/features/cart/useReconciledCart";
import { useStoreCatalog } from "@/features/catalog/catalog.service";
import { useCart } from "@/features/cart/CartContext";
import {
  maskPhone,
  onlyDigits,
  validateName,
  validatePhone,
} from "@/features/checkout/checkout.logic";
import {
  createOfficialOrder,
  orderPayload,
  officialOrderWhatsAppUrl,
  type CheckoutCustomer,
  type OfficialOrder,
} from "@/features/checkout/orders.service";
import { formatBRL } from "@/shared/utils/format";
import styles from "./CheckoutPage.module.css";
import type { CartItem } from "@/shared/types/cart";

const LIVE_CHECKOUT_ENABLED = import.meta.env.VITE_ENABLE_LIVE_CHECKOUT === "true";

/** No customer account; persisted transaction must precede the WhatsApp link. */
export function CheckoutPage() {
  const { products } = useStoreCatalog();
  const { lines, blocked, catalogState } = useReconciledCart();
  const cart = useCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OfficialOrder | null>(null);
  const [submittedItems, setSubmittedItems] = useState<CartItem[] | null>(null);
  const [submittedCustomer, setSubmittedCustomer] = useState<CheckoutCustomer | null>(null);

  const items = lines.map(({ item }) => item);
  const customer = { name, phone, notes, privacyAccepted };
  const ready =
    LIVE_CHECKOUT_ENABLED &&
    catalogState === "ready" &&
    !blocked &&
    items.length > 0 &&
    !validateName(name) &&
    !validatePhone(phone) &&
    privacyAccepted &&
    !submitting;
  const completedItems = submittedItems ?? items;
  const completedCustomer = submittedCustomer ?? customer;
  const whatsappLink = order
    ? officialOrderWhatsAppUrl(order, completedItems, completedCustomer)
    : null;

  async function submit() {
    if (!ready) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = orderPayload(items, products, customer, key);
      const saved = await createOfficialOrder(payload);
      setSubmittedItems(items);
      setSubmittedCustomer(customer);
      setOrder(saved);
      cart.clear();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar o pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <PageHeader
        eyebrow="Finalizar pedido"
        title="Checkout pelo WhatsApp"
        text="Revise os dados. O pedido será registrado antes de abrir a conversa com a loja."
      />
      {!LIVE_CHECKOUT_ENABLED && (
        <p role="status" className={styles.errorSummary}>
          Checkout comercial ainda em homologação. Nenhum pedido será criado nesta versão.
        </p>
      )}
      <div className={styles.layout}>
        <section className={styles.panel} aria-label="Seus dados">
          <h2 className={styles.h2}>Dados para contato</h2>
          <Input
            label="Nome completo"
            value={name}
            maxLength={100}
            error={(name && validateName(name)) || undefined}
            onChange={(event) => setName(event.target.value)}
            disabled={!!order || submitting}
          />
          <Input
            label="WhatsApp com DDD"
            value={phone}
            placeholder="(21) 99999-9999"
            inputMode="tel"
            error={(phone && validatePhone(phone)) || undefined}
            onChange={(event) => setPhone(maskPhone(onlyDigits(event.target.value)))}
            disabled={!!order || submitting}
          />
          <div className={styles.field}>
            <label className={styles.label} htmlFor="checkout-notes">
              Observações (opcional)
            </label>
            <textarea
              id="checkout-notes"
              className={styles.textarea}
              value={notes}
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!!order || submitting}
            />
          </div>
          <label className={styles.privacy}>
            <input
              type="checkbox"
              checked={privacyAccepted}
              disabled={!!order || submitting}
              onChange={(event) => setPrivacyAccepted(event.target.checked)}
            />
            Autorizo o uso do meu nome e telefone para atendimento e acompanhamento deste pedido.
          </label>
          {error && (
            <p role="alert" className={styles.errorSummary}>
              {error}
            </p>
          )}
          {order && (
            <div role="status">
              <p>
                <CheckCircle2 size={20} /> Pedido #{order.orderNumber} registrado no Supabase.
              </p>
              <p className={styles.hint}>Status: aguardando contato. Frete a combinar.</p>
              {whatsappLink && <a className={buttonClass("primary")} href={whatsappLink}
                target="_blank" rel="noopener noreferrer" onClick={(event) => {
                  event.preventDefault();
                  const href = event.currentTarget.href;
                  const opened = window.open("about:blank", "_blank");
                  if (!opened) {
                    window.location.assign(href);
                    return;
                  }
                  opened.opener = null;
                  opened.location.href = href;
                  cart.clear();
                }}>
                <MessageCircle size={18}/> Abrir WhatsApp e enviar pedido
              </a>}
              {!whatsappLink && <p className={styles.errorSummary}>
                Pedido salvo, mas o WhatsApp comercial não está disponível.
                Entre em contato diretamente com a loja, informando #{order.orderNumber}.
              </p>}
            </div>
          )}
          {!order && (
            <Button size="lg" disabled={!ready} onClick={() => void submit()}>
              <MessageCircle size={18} />{" "}
              {submitting ? "Registrando pedido…" : "Registrar e continuar pelo WhatsApp"}
            </Button>
          )}
          {!LIVE_CHECKOUT_ENABLED && (
            <p className={styles.hint}>
              A funcionalidade será habilitada após a validação transacional e as configurações de
              privacidade.
            </p>
          )}
          <Link to="/carrinho" className={styles.back}>
            <ArrowLeft size={16} /> Voltar ao carrinho
          </Link>
        </section>
        <aside className={styles.panel} aria-label="Resumo">
          <h2 className={styles.h2}>Resumo do pedido</h2>
          <ul className={styles.items}>
            {completedItems.map((item) => (
              <li className={styles.item} key={item.key}>
                <div>
                  <p className={styles.name}>{item.name}</p>
                  <p className={styles.meta}>
                    {item.quantity} un.{" "}
                    {Object.entries(item.variants)
                      .map(([group, value]) => `${group}: ${value}`)
                      .join(" · ")}
                  </p>
                </div>
                <span className={styles.line}>
                  {formatBRL(item.quantity * item.unitPriceCents)}
                </span>
              </li>
            ))}
          </ul>
          <hr className={styles.hr} />
          <div className={styles.row}>
            <span>Subtotal</span>
            <strong className={styles.total}>
              {formatBRL(order?.subtotalCents ?? cart.subtotalCents)}
            </strong>
          </div>
          <div className={styles.row}>
            <span>Frete</span>
            <span>A combinar</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
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
  quoteShipping,
  type CheckoutCustomer,
  type CheckoutDelivery,
  type OfficialOrder,
} from "@/features/checkout/orders.service";
import {
  EMPTY_ADDRESS,
  UF,
  formatDeliveryDays,
  formatDeliveryPrice,
  maskCep,
  needsAddress,
  validateAddress,
  type AddressErrors,
  type DeliveryAddress,
  type DeliveryMethod,
  type DeliveryOption,
} from "@/features/checkout/delivery.logic";
import { normalizeCep } from "@/features/shipping/shipping.rules";
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
  const [cep, setCep] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [options, setOptions] = useState<DeliveryOption[] | null>(null);
  const [method, setMethod] = useState<DeliveryMethod | null>(null);
  const [address, setAddress] = useState<DeliveryAddress>(EMPTY_ADDRESS);
  const [addressTouched, setAddressTouched] = useState(false);
  const [submittedDelivery, setSubmittedDelivery] = useState<CheckoutDelivery | null>(null);

  const items = lines.map(({ item }) => item);
  const itemsSignature = items.map((item) => `${item.productId}:${item.quantity}`).join("|");
  // O prazo depende dos itens: mudou o carrinho, o frete é calculado de novo.
  useEffect(() => {
    if (order) return;
    setOptions(null);
    setMethod(null);
  }, [itemsSignature, order]);

  const selected = options?.find((option) => option.method === method) ?? null;
  const addressErrors: AddressErrors = needsAddress(method) ? validateAddress(address) : {};
  const deliveryReady = !!selected && Object.keys(addressErrors).length === 0;

  async function calculate() {
    const normalized = normalizeCep(cep);
    if (!normalized) {
      setQuoteError("Informe o CEP com 8 números.");
      return;
    }
    setQuoting(true);
    setQuoteError("");
    try {
      const next = await quoteShipping(normalized, items);
      setOptions(next);
      setMethod(next[0]?.method ?? null);
      setAddress((current) => ({ ...current, cep: maskCep(normalized) }));
    } catch (cause) {
      setOptions(null);
      setMethod(null);
      setQuoteError(cause instanceof Error ? cause.message : "Não foi possível calcular o frete.");
    } finally {
      setQuoting(false);
    }
  }
  const customer = { name, phone, notes, privacyAccepted };
  const ready =
    LIVE_CHECKOUT_ENABLED &&
    catalogState === "ready" &&
    !blocked &&
    items.length > 0 &&
    !validateName(name) &&
    !validatePhone(phone) &&
    privacyAccepted &&
    deliveryReady &&
    !submitting;
  const completedItems = submittedItems ?? items;
  const completedCustomer = submittedCustomer ?? customer;
  const whatsappLink = order
    ? officialOrderWhatsAppUrl(order, completedItems, completedCustomer, submittedDelivery)
    : null;

  async function submit() {
    if (!ready || !method) return;
    setSubmitting(true);
    setError("");
    try {
      const delivery: CheckoutDelivery = { method, address };
      const payload = orderPayload(items, products, customer, key, delivery);
      const saved = await createOfficialOrder(payload);
      setSubmittedItems(items);
      setSubmittedCustomer(customer);
      setSubmittedDelivery(delivery);
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
          A finalização de pedidos está temporariamente indisponível. Fale com a loja pelo WhatsApp.
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
          <h2 className={styles.h2}>Entrega</h2>
          <div className={styles.cepRow}>
            <Input
              label="CEP de entrega"
              value={cep}
              placeholder="00000-000"
              inputMode="numeric"
              autoComplete="postal-code"
              error={quoteError || undefined}
              onChange={(event) => { setCep(maskCep(event.target.value)); setQuoteError(""); }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void calculate(); } }}
              disabled={!!order || submitting || quoting}
            />
            <Button variant="outline" onClick={() => void calculate()}
              disabled={!!order || submitting || quoting || items.length === 0}>
              {quoting ? "Calculando…" : "Calcular frete"}
            </Button>
          </div>
          {options && (
            <fieldset className={styles.options} disabled={!!order || submitting}>
              <legend className={styles.label}>Escolha a forma de entrega</legend>
              {options.map((option) => (
                <label key={option.method} className={styles.option}>
                  <input type="radio" name="delivery-method" value={option.method}
                    checked={method === option.method}
                    onChange={() => setMethod(option.method)} />
                  <span className={styles.optionText}>
                    <strong>{option.label}</strong>
                    <span className={styles.hint}>{formatDeliveryDays(option.days)}</span>
                    {option.detail && <span className={styles.hint}>{option.detail}</span>}
                  </span>
                  <strong className={styles.optionPrice}>{formatDeliveryPrice(option.priceCents)}</strong>
                </label>
              ))}
            </fieldset>
          )}
          {needsAddress(method) && (
            <div className={styles.address}>
              <Input className={styles.wide} label="Rua" value={address.street} maxLength={200}
                autoComplete="address-line1"
                error={(addressTouched && addressErrors.street) || undefined}
                onChange={(event) => setAddress({ ...address, street: event.target.value })}
                onBlur={() => setAddressTouched(true)} disabled={!!order || submitting} />
              <Input label="Número" value={address.number} maxLength={20}
                error={(addressTouched && addressErrors.number) || undefined}
                onChange={(event) => setAddress({ ...address, number: event.target.value })}
                onBlur={() => setAddressTouched(true)} disabled={!!order || submitting} />
              <Input label="Complemento (opcional)" value={address.complement} maxLength={100}
                autoComplete="address-line2"
                onChange={(event) => setAddress({ ...address, complement: event.target.value })}
                disabled={!!order || submitting} />
              <Input label="Bairro" value={address.district} maxLength={100}
                error={(addressTouched && addressErrors.district) || undefined}
                onChange={(event) => setAddress({ ...address, district: event.target.value })}
                onBlur={() => setAddressTouched(true)} disabled={!!order || submitting} />
              <Input label="Cidade" value={address.city} maxLength={100} autoComplete="address-level2"
                error={(addressTouched && addressErrors.city) || undefined}
                onChange={(event) => setAddress({ ...address, city: event.target.value })}
                onBlur={() => setAddressTouched(true)} disabled={!!order || submitting} />
              <div className={styles.field}>
                <label className={styles.label} htmlFor="checkout-state">Estado</label>
                <select id="checkout-state" className={styles.select} value={address.state}
                  autoComplete="address-level1"
                  onChange={(event) => { setAddress({ ...address, state: event.target.value }); setAddressTouched(true); }}
                  disabled={!!order || submitting}>
                  <option value="">Escolha…</option>
                  {UF.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
                {addressTouched && addressErrors.state && <span className={styles.hint}>{addressErrors.state}</span>}
              </div>
              <p className={styles.hint}>CEP {address.cep}. Para trocar o CEP, calcule o frete de novo.</p>
            </div>
          )}
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
            Autorizo o uso do meu nome, telefone e endereço para atendimento, entrega e acompanhamento
            deste pedido.
          </label>
          {error && (
            <p role="alert" className={styles.errorSummary}>
              {error}
            </p>
          )}
          {order && (
            <div role="status">
              <p>
                <CheckCircle2 size={20} /> Pedido #{order.orderNumber} registrado!
              </p>
              <p className={styles.hint}>
                Status: aguardando contato.{" "}
                {order.totalCents !== null
                  ? `Total com frete: ${formatBRL(order.totalCents)}.`
                  : "Frete a combinar pelo WhatsApp."}
              </p>
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
            <span>Frete{(order?.deliveryLabel ?? selected?.label) ? ` · ${order?.deliveryLabel ?? selected?.label}` : ""}</span>
            <span>
              {order
                ? formatDeliveryPrice(order.shippingCents)
                : selected
                  ? formatDeliveryPrice(selected.priceCents)
                  : "Calcule pelo CEP"}
            </span>
          </div>
          {(order ? order.totalCents !== null : selected?.priceCents !== null && selected !== null) && (
            <div className={styles.row}>
              <span>Total</span>
              <strong className={styles.total}>
                {formatBRL(order?.totalCents ?? cart.subtotalCents + (selected?.priceCents ?? 0))}
              </strong>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

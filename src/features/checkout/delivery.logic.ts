/**
 * CR-019B — delivery choice in the checkout (pure rules, no I/O).
 * Prices shown here come from the server quote; the order total is
 * recomputed by the server when the order is created.
 */
import { formatBRL } from "@/shared/utils/format";
import { formatCep, normalizeCep } from "@/features/shipping/shipping.rules";

export type DeliveryMethod = "retirada" | "entrega-local" | "a-combinar";

export interface DeliveryOption {
  method: DeliveryMethod;
  label: string;
  priceCents: number | null;
  days: number | null;
  detail: string;
}

export interface DeliveryAddress {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export const EMPTY_ADDRESS: DeliveryAddress = {
  cep: "", street: "", number: "", complement: "", district: "", city: "", state: "",
};

export const UF = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE",
  "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export function maskCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function needsAddress(method: DeliveryMethod | null): boolean {
  return method === "entrega-local" || method === "a-combinar";
}

export type AddressErrors = Partial<Record<keyof DeliveryAddress, string>>;

export function validateAddress(address: DeliveryAddress): AddressErrors {
  const errors: AddressErrors = {};
  if (!normalizeCep(address.cep)) errors.cep = "Informe o CEP com 8 números.";
  if (!address.street.trim()) errors.street = "Informe a rua.";
  else if (address.street.trim().length > 200) errors.street = "Use até 200 caracteres.";
  if (!address.number.trim()) errors.number = "Informe o número (ou s/n).";
  else if (address.number.trim().length > 20) errors.number = "Use até 20 caracteres.";
  if (address.complement.trim().length > 100) errors.complement = "Use até 100 caracteres.";
  if (!address.district.trim()) errors.district = "Informe o bairro.";
  else if (address.district.trim().length > 100) errors.district = "Use até 100 caracteres.";
  if (!address.city.trim()) errors.city = "Informe a cidade.";
  else if (address.city.trim().length > 100) errors.city = "Use até 100 caracteres.";
  if (!(UF as readonly string[]).includes(address.state.trim().toUpperCase())) errors.state = "Escolha o estado.";
  return errors;
}

/** Delivery part of the order payload (no prices: the server sets them). */
export function deliveryPayload(method: DeliveryMethod, address: DeliveryAddress) {
  const cep = normalizeCep(address.cep) ?? "";
  if (method === "retirada") return { method, cep };
  return {
    method,
    cep,
    street: address.street.trim(),
    number: address.number.trim(),
    complement: address.complement.trim(),
    district: address.district.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
  };
}

export function formatDeliveryPrice(priceCents: number | null): string {
  if (priceCents === null) return "A combinar";
  return priceCents === 0 ? "Grátis" : formatBRL(priceCents);
}

export function formatDeliveryDays(days: number | null): string {
  if (days === null) return "Prazo combinado pelo WhatsApp";
  if (days === 0) return "No mesmo dia útil";
  return days === 1 ? "Em até 1 dia útil" : `Em até ${days} dias úteis`;
}

export function formatAddress(address: DeliveryAddress): string {
  const complement = address.complement.trim() ? `, ${address.complement.trim()}` : "";
  return `${address.street.trim()}, ${address.number.trim()}${complement} — ${address.district.trim()}, ` +
    `${address.city.trim()}/${address.state.trim().toUpperCase()} — CEP ${formatCep(normalizeCep(address.cep) ?? address.cep)}`;
}

/** Parses the server quote, keeping only well-formed options. */
export function parseQuote(data: unknown): DeliveryOption[] {
  if (!data || typeof data !== "object" || !Array.isArray((data as { options?: unknown }).options)) return [];
  return ((data as { options: unknown[] }).options).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const o = raw as Record<string, unknown>;
    if (o.method !== "retirada" && o.method !== "entrega-local" && o.method !== "a-combinar") return [];
    const price = o.priceCents === null ? null : Number(o.priceCents);
    const days = o.days === null ? null : Number(o.days);
    if (price !== null && (!Number.isSafeInteger(price) || price < 0)) return [];
    if (days !== null && (!Number.isSafeInteger(days) || days < 0)) return [];
    return [{
      method: o.method,
      label: typeof o.label === "string" ? o.label.slice(0, 120) : "",
      priceCents: price,
      days,
      detail: typeof o.detail === "string" ? o.detail.slice(0, 520) : "",
    }];
  });
}

import type { CartItem } from "@/shared/types/cart";
import { formatBRL } from "@/shared/utils/format";
import { subtotalCents } from "@/features/cart/cart.logic";

export const NAME_MAX = 100;
export const NOTES_MAX = 500;

export function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

/** Formats as (DD) 99999-9999 / (DD) 9999-9999 while typing. */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** Brazilian phone with DDD: 10 digits (landline) or 11 digits starting with 9 (mobile). */
export function isValidCustomerPhone(value: string): boolean {
  const d = onlyDigits(value);
  if (!/^[1-9][1-9]/.test(d)) return false;
  if (d.length === 11) return d[2] === "9";
  return d.length === 10 && /[2-5]/.test(d[2] ?? "");
}

const NAME_RE = /^[\p{L}][\p{L}'’.\- ]*$/u;
/** Full name: at least two words, letters only, up to NAME_MAX chars. */
export function validateName(value: string): string | null {
  const v = value.trim().replace(/\s+/g, " ");
  if (!v) return "Informe seu nome completo.";
  if (v.length > NAME_MAX) return `Use no máximo ${NAME_MAX} caracteres.`;
  if (!NAME_RE.test(v)) return "Use apenas letras no nome.";
  if (v.split(" ").filter((w) => w.length >= 2).length < 2) return "Informe nome e sobrenome.";
  return null;
}

export function validatePhone(value: string): string | null {
  if (!onlyDigits(value)) return "Informe seu WhatsApp com DDD.";
  return isValidCustomerPhone(value) ? null : "WhatsApp inválido. Use DDD + número, ex.: (21) 99999-9999.";
}

/** Store number: digits only, Brazil country code 55 + DDD + 8/9 digits. */
export function isValidBusinessNumber(value: string): boolean {
  return /^55[1-9]{2}9?\d{8}$/.test(value);
}

/** Removes control characters and trims; keeps line breaks in free text. */
export function sanitizeText(v: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
}

/**
 * Demonstration reference derived from the cart contents (same cart = same code).
 * It is NOT an official or persistent order number.
 */
export function demoOrderRef(items: CartItem[]): string {
  let h = 0x811c9dc5;
  for (const ch of items.map((i) => `${i.key}x${i.quantity}`).join(";")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `#DEMO-${String(h % 1_000_000).padStart(6, "0")}`;
}

export interface Customer { name: string; phone: string; notes?: string }

export function buildOrderMessage(items: CartItem[], customer: Customer): string {
  const lines: string[] = ["*NOVO PEDIDO — CRIATTO 3D*", "", `Pedido demonstrativo: ${demoOrderRef(items)}`, "", "*CLIENTE*", `Nome: ${sanitizeText(customer.name, NAME_MAX).replace(/\s+/g, " ")}`, `WhatsApp: ${maskPhone(customer.phone)}`, "", "*PRODUTOS*"];
  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name}`, `Quantidade: ${item.quantity}`);
    for (const [k, v] of Object.entries(item.variants)) lines.push(`${k}: ${v}`);
    lines.push(`Valor unitário: ${formatBRL(item.unitPriceCents)}`, `Subtotal: ${formatBRL(item.unitPriceCents * item.quantity)}`, "");
  });
  lines.push(`*TOTAL ESTIMADO: ${formatBRL(subtotalCents(items))}*`, "", "Frete: A combinar.");
  const notes = customer.notes ? sanitizeText(customer.notes, NOTES_MAX) : "";
  if (notes) lines.push("", "*OBSERVAÇÕES*", notes);
  lines.push("", "Olá! Gostaria de confirmar meu pedido com a Criatto 3D.");
  return lines.join("\n");
}

export interface CustomRequest {
  name: string;
  phone: string;
  description: string;
  quantity: number;
  dimensions?: string;
  colors?: string;
  notes?: string;
  hasReferenceImage: boolean;
}

export function buildCustomRequestMessage(r: CustomRequest): string {
  const lines = ["*SOLICITAÇÃO DE PERSONALIZADO — CRIATTO 3D*", "", "*CLIENTE*", `Nome: ${sanitizeText(r.name, NAME_MAX).replace(/\s+/g, " ")}`, `WhatsApp: ${maskPhone(r.phone)}`, "", "*PRODUTO*", `Descrição: ${sanitizeText(r.description, 1000)}`, `Quantidade: ${r.quantity}`];
  if (r.dimensions) lines.push(`Tamanho: ${r.dimensions}`);
  const colors = r.colors ? sanitizeText(r.colors, 120) : "";
  if (colors) lines.push(`Cor: ${colors}`);
  const notes = r.notes ? sanitizeText(r.notes, NOTES_MAX) : "";
  if (notes) lines.push("", "*OBSERVAÇÕES*", notes);
  if (r.hasReferenceImage) lines.push("", "Tenho uma imagem de referência e vou enviá-la nesta conversa.");
  lines.push("", "Olá! Gostaria de um orçamento para este produto personalizado.");
  return lines.join("\n");
}

/** Official wa.me link; null when the store number is missing/invalid (never a fake contact). */
export function buildWhatsAppUrl(businessNumber: string, message: string): string | null {
  if (!isValidBusinessNumber(businessNumber)) return null;
  return `https://wa.me/${businessNumber}?text=${encodeURIComponent(message)}`;
}

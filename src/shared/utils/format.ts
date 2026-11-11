const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/\u00a0/g, " ");
}

/** Masks a phone for listings: keeps DDD and last 4 digits. */
export function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 8) return "****";
  const local = d.length > 11 ? d.slice(-11) : d;
  return `(${local.slice(0, 2)}) *****-${local.slice(-4)}`;
}

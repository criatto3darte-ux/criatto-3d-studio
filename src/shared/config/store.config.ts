/**
 * Commercial settings for the storefront. Values here are placeholders until the
 * store owner provides the real ones; in a later stage they will come from the
 * admin "Configurações" screen backed by the server.
 */
export const storeConfig = {
  name: "Criatto 3D",
  tagline: "Produtos 3D",
  /** WhatsApp in international format, digits only (ex.: 5511999999999). Empty = not configured. */
  whatsappNumber: "",
  /** Only show "Envio para todo o Brasil" when the business really offers it. */
  offersNationalShipping: false,
  social: { instagram: "", tiktok: "" },
} as const;

export type StoreConfig = typeof storeConfig;

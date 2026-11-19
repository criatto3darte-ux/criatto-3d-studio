/**
 * Configuração centralizada dos canais de atendimento OFICIAIS da Criatto 3D.
 *
 * Esta é a ÚNICA fonte de verdade para o número de WhatsApp e outros canais.
 * NÃO espalhe o número diretamente pelos componentes — sempre importe daqui.
 *
 * Para a publicação demonstrativa (sem backend conectado), esta configuração
 * é usada como fallback quando o StoreSettings vindo do repositório estiver
 * vazio. Quando a integração com o Supabase estiver ativa, o StoreSettings
 * do banco tem precedência.
 */

/**
 * Número comercial oficial no formato internacional, só dígitos:
 *   Código do país (55) + DDD (21) + número com 9 (987640769)
 */
export const OFFICIAL_WHATSAPP = "5521987640769" as const;

export const OFFICIAL_WHATSAPP_DISPLAY = "+55 21 98764-0769" as const;

export const OFFICIAL_WHATSAPP_URL = `https://wa.me/${OFFICIAL_WHATSAPP}` as const;

/**
 * Outros canais oficiais (preencher quando estiverem definidos).
 * Deixe como "" enquanto não houver canal oficial — a UI só mostra o que
 * estiver preenchido.
 */
export const OFFICIAL_EMAIL = "" as string; // TODO: definir e-mail comercial
export const OFFICIAL_INSTAGRAM = "" as string; // TODO: ex.: "https://instagram.com/criatto3d"
export const OFFICIAL_TIKTOK = "" as string; // TODO: ex.: "https://tiktok.com/@criatto3d"
export const OFFICIAL_ADDRESS = "" as string; // TODO: endereço físico, se aplicável

/** Horário/mensagem de atendimento (exibido na página de contato e hero). */
export const OFFICIAL_SERVICE_MESSAGE = "" as string;

/** Validação de número comercial (reexportada de checkout.logic). */
export { isValidBusinessNumber } from "@/features/checkout/checkout.logic";
import { isValidBusinessNumber } from "@/features/checkout/checkout.logic";

/**
 * Merge entre configuração oficial (fallback para demo) e StoreSettings
 * persistido (vindo do admin/demo ou, futuramente, do Supabase).
 * Campos não configurados no StoreSettings herdam do OFFICIAL_*.
 */
export interface ContactConfig {
  whatsappNumber: string;
  email: string;
  instagram: string;
  tiktok: string;
  address: string;
  serviceMessage: string;
  offersNationalShipping: boolean;
}

export function resolveContactSettings(
  persisted: Partial<ContactConfig> | null | undefined,
): ContactConfig {
  const p = persisted ?? {};
  return {
    whatsappNumber:
      typeof p.whatsappNumber === "string" && isValidBusinessNumber(p.whatsappNumber)
        ? p.whatsappNumber
        : (isValidBusinessNumber(OFFICIAL_WHATSAPP) ? OFFICIAL_WHATSAPP : ""),
    email: (typeof p.email === "string" && p.email.trim() ? p.email : OFFICIAL_EMAIL).trim(),
    instagram: (typeof p.instagram === "string" && p.instagram.trim() ? p.instagram : OFFICIAL_INSTAGRAM).trim(),
    tiktok: (typeof p.tiktok === "string" && p.tiktok.trim() ? p.tiktok : OFFICIAL_TIKTOK).trim(),
    address: (typeof p.address === "string" && p.address.trim() ? p.address : OFFICIAL_ADDRESS).trim(),
    serviceMessage: (typeof p.serviceMessage === "string" && p.serviceMessage.trim() ? p.serviceMessage : OFFICIAL_SERVICE_MESSAGE).trim(),
    offersNationalShipping: typeof p.offersNationalShipping === "boolean" ? p.offersNationalShipping : false,
  };
}

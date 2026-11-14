// Helpers de URL para o fluxo de convite/MFA (PKCE).
//
// Estratégia de redirecionamento:
//   - O callback sempre cai em /auth/callback (nesta app).
//   - O `redirectTo` do invite usa a mesma origem do navegador (window.location.origin),
//     para que funcione tanto em localhost quanto em homologação publicada —
//     desde que a origem esteja em Supabase > Auth > URL Configuration.
//   - Fora do browser (SSR) usamos VITE_APP_URL; se não estiver definido, falha cedo.

export const AUTH_CALLBACK_PATH = "/auth/callback";

export function getAppOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const appUrl = import.meta.env.VITE_APP_URL;
  if (!appUrl) {
    throw new Error(
      "VITE_APP_URL não está definido; necessário para construir URLs de callback no servidor.",
    );
  }
  return appUrl.replace(/\/$/, "");
}

export function getRedirectUrl(path: string = AUTH_CALLBACK_PATH): string {
  return `${getAppOrigin()}${path}`;
}

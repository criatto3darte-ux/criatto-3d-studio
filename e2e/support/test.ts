import { test as base, expect } from "@playwright/test";

export type Theme = "light" | "dark";

/**
 * O site usa o tema salvo em localStorage ("criatto3d:theme"); sem valor salvo
 * abre no escuro e ignora o tema do sistema. Cada projeto define o tema aqui,
 * para todas as páginas do contexto.
 */
export const test = base.extend<{ theme: Theme }>({
  theme: ["dark", { option: true }],
  context: async ({ context, theme }, use) => {
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("criatto3d:theme", t);
      } catch {
        /* armazenamento indisponível */
      }
    }, theme);
    await use(context);
  },
});

export { expect };

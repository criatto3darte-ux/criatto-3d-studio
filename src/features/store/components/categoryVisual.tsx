import { Boxes, Gamepad2, Gift, Lamp, Sparkles, Sprout, Wrench, type LucideIcon } from "lucide-react";
import type { CategorySlug } from "@/shared/types/catalog";

export const categoryVisual: Record<CategorySlug, { icon: LucideIcon; accent: string }> = {
  decoracao: { icon: Lamp, accent: "var(--color-orange)" },
  "geek-nerd": { icon: Gamepad2, accent: "var(--color-purple)" },
  "casa-organizacao": { icon: Boxes, accent: "var(--color-blue)" },
  "vasos-jardinagem": { icon: Sprout, accent: "var(--color-green)" },
  presentes: { icon: Gift, accent: "var(--color-magenta)" },
  utilitarios: { icon: Wrench, accent: "var(--color-yellow)" },
  personalizados: { icon: Sparkles, accent: "var(--color-primary)" },
};

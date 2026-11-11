import { Boxes, Shapes, Gamepad2, Gift, Lamp, Sparkles, Sprout, Wrench, type LucideIcon } from "lucide-react";
import type { CategorySlug } from "@/shared/types/catalog";

const known: Record<string, { icon: LucideIcon; accent: string }> = {
  decoracao: { icon: Lamp, accent: "var(--color-orange)" },
  "geek-nerd": { icon: Gamepad2, accent: "var(--color-purple)" },
  "casa-organizacao": { icon: Boxes, accent: "var(--color-blue)" },
  "vasos-jardinagem": { icon: Sprout, accent: "var(--color-green)" },
  presentes: { icon: Gift, accent: "var(--color-magenta)" },
  utilitarios: { icon: Wrench, accent: "var(--color-yellow)" },
  personalizados: { icon: Sparkles, accent: "var(--color-primary)" },
};

const fallback = { icon: Shapes, accent: "var(--color-primary)" };

/** Visual for a category; categories created in the admin get a neutral fallback. */
export function categoryVisualFor(slug: CategorySlug): { icon: LucideIcon; accent: string } {
  return known[slug] ?? fallback;
}

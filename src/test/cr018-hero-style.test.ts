import { describe, expect, it } from "vitest";
import { toHeroStyle } from "@/features/catalog/banners.service";

describe("CR-018 banner hero style", () => {
  it("only accepts logo explicitly and defaults everything else to texto", () => {
    expect(toHeroStyle("logo")).toBe("logo");
    expect(toHeroStyle("texto")).toBe("texto");
    expect(toHeroStyle(undefined)).toBe("texto");
    expect(toHeroStyle(null)).toBe("texto");
    expect(toHeroStyle("LOGO")).toBe("texto");
  });
});

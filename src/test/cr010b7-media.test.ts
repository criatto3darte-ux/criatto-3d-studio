import { describe, expect, it } from "vitest";
import { prepareProductImage } from "@/features/catalog/catalog-media";

describe("CR-010B.7 image ingestion client", () => {
  it("rejects SVG and other unapproved formats without attempting to decode them", async () => {
    const svg = new File(["<svg/>"], "test.svg", { type: "image/svg+xml" });
    await expect(prepareProductImage(svg)).rejects.toThrow("PNG, JPEG ou WebP");
  });

  it("rejects an empty photo before reading image data", async () => {
    const file = new File([], "empty.webp", { type: "image/webp" });
    await expect(prepareProductImage(file)).rejects.toThrow("até 12 MB");
  });

  it("rejects an oversized photo before invoking browser decoding", async () => {
    const file = new File([new Uint8Array(12 * 1024 * 1024 + 1)], "huge.webp", {
      type: "image/webp",
    });
    await expect(prepareProductImage(file)).rejects.toThrow("até 12 MB");
  });
});

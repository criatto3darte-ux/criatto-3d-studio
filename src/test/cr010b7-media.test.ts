import { describe, expect, it } from "vitest";
import {
  detectImageType,
  prepareProductImage,
  validateImageFile,
} from "@/features/catalog/catalog-media";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
// "RIFF" + size + "WEBP" + "VP8 " chunk start.
const WEBP = [
  0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
];

function file(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("CR-010B.7 image ingestion client", () => {
  it("rejects SVG and other unapproved formats without attempting to decode them", async () => {
    const svg = new File(["<svg/>"], "test.svg", { type: "image/svg+xml" });
    await expect(prepareProductImage(svg)).rejects.toThrow("PNG, JPEG ou WebP");
  });

  it("rejects an empty photo before reading image data", async () => {
    const empty = new File([], "empty.webp", { type: "image/webp" });
    await expect(prepareProductImage(empty)).rejects.toThrow("vazio");
  });

  it("rejects an oversized photo before invoking browser decoding", async () => {
    const huge = new File([new Uint8Array(12 * 1024 * 1024 + 1)], "huge.webp", {
      type: "image/webp",
    });
    await expect(prepareProductImage(huge)).rejects.toThrow("o limite é 12 MB");
  });
});

describe("CR-013A image type detection by content", () => {
  it("recognizes PNG, JPEG and WebP signatures", async () => {
    expect(await detectImageType(file(PNG, "a.png", "image/png"))).toBe("image/png");
    expect(await detectImageType(file(JPEG, "a.jpg", "image/jpeg"))).toBe("image/jpeg");
    expect(await detectImageType(file(WEBP, "a.webp", "image/webp"))).toBe("image/webp");
  });

  it("accepts a small WebP whose browser MIME type is empty", async () => {
    const result = await validateImageFile(file(WEBP, "foto.webp", ""));
    expect(result.type).toBe("image/webp");
  });

  it("accepts a WebP reported as application/octet-stream", async () => {
    const result = await validateImageFile(file(WEBP, "foto.webp", "application/octet-stream"));
    expect(result.type).toBe("image/webp");
  });

  it("does not trust an image MIME type when the content is not an image", async () => {
    const fake = file([0x3c, 0x73, 0x76, 0x67, 0x2f, 0x3e], "fake.webp", "image/webp");
    await expect(validateImageFile(fake)).rejects.toThrow("PNG, JPEG ou WebP");
  });

  it("keeps size and type errors distinct", async () => {
    const huge = new File([new Uint8Array(13 * 1024 * 1024)], "huge.png", { type: "image/png" });
    await expect(validateImageFile(huge)).rejects.toThrow("A imagem tem 13 MB; o limite é 12 MB.");
    await expect(validateImageFile(file([1, 2, 3], "x.webp", ""))).rejects.not.toThrow("12 MB");
  });
});

import { describe, expect, it } from "vitest";
import { parseCachedContent } from "@/features/catalog/store-content";

const settings = {
  name: "Criatto 3D", logo: "", whatsappNumber: "5521987640769", email: "", instagram: "",
  tiktok: "", address: "", deliveryInfo: "", offersNationalShipping: false, serviceMessage: "",
};
const banner = {
  id: "b1", title: "Criatto", highlight: "3D", subtitle: "", image: "", buttonText: "Explorar produtos",
  buttonUrl: "/produtos", order: 1, active: true, heroStyle: "logo",
};

describe("store content cache", () => {
  it("restores the last confirmed settings and banner as ready", () => {
    const parsed = parseCachedContent(JSON.stringify({ settings, banner }));
    expect(parsed?.state).toBe("ready");
    expect(parsed?.banner?.heroStyle).toBe("logo");
    expect(parsed?.settings.whatsappNumber).toBe("5521987640769");
  });

  it("keeps a confirmed 'no banner' state", () => {
    const parsed = parseCachedContent(JSON.stringify({ settings, banner: null }));
    expect(parsed?.state).toBe("ready");
    expect(parsed?.banner).toBeUndefined();
  });

  it("discards missing, malformed or tampered cache", () => {
    expect(parseCachedContent(null)).toBeNull();
    expect(parseCachedContent("{")).toBeNull();
    expect(parseCachedContent(JSON.stringify({ banner }))).toBeNull();
    expect(parseCachedContent(JSON.stringify({ settings: { ...settings, name: 42 }, banner }))).toBeNull();
    expect(parseCachedContent(JSON.stringify({ settings, banner: { ...banner, title: { x: 1 } } }))).toBeNull();
    expect(parseCachedContent("x".repeat(20_001))).toBeNull();
  });

  it("never restores a custom logo URL from storage", () => {
    const parsed = parseCachedContent(JSON.stringify({ settings: { ...settings, logo: "https://evil.example/x.png" }, banner }));
    expect(parsed?.settings.logo).toBe("");
  });
});

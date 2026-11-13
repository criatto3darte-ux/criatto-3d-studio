/** Persisted media/links allow HTTPS or an unambiguous root-relative path only. */
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || value.length > 2048 || value !== value.trim()) return undefined;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return undefined; }
  if (/[\s\\\u0000-\u001f\u007f]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded)) return undefined;
  if (decoded.startsWith("/")) {
    if (decoded.startsWith("//")) return undefined;
    try {
      const parsed = new URL(value, "https://internal.invalid");
      return parsed.origin === "https://internal.invalid" ? value : undefined;
    } catch { return undefined; }
  }
  if (!value.startsWith("https://")) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname && !parsed.username && !parsed.password ? value : undefined;
  } catch { return undefined; }
}

export function safeSocialUrl(value: unknown, service: "instagram" | "tiktok"): string | undefined {
  const url = safeUrl(value);
  if (!url) return undefined;
  const pattern = service === "instagram"
    ? /^https:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/
    : /^https:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/;
  return pattern.test(url) ? url : undefined;
}

export function safeEmail(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 254 && /^[a-zA-Z0-9.!#$'*+\/=^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value) ? value : undefined;
}
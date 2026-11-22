/**
 * Shared public store content (settings + hero banner) and storefront freshness.
 *
 * - One request for the whole page instead of one per component.
 * - The last confirmed content is cached in this browser, so a returning
 *   visitor sees the saved banner/settings at once (no placeholder text);
 *   a first visit shows a neutral loading state, never the default texts.
 * - Content and catalog are revalidated when the tab gets focus, when the
 *   admin saves in another tab of this browser, and every minute while
 *   the page is visible, so panel changes reach the open store quickly.
 */
import { useSyncExternalStore } from "react";
import { listPublishedBanners } from "@/features/catalog/banners.service";
import {
  DEFAULT_REAL_SETTINGS,
  readPublicStoreSettings,
} from "@/features/catalog/store-settings.service";
import type { DemoBanner, HeroStyle, StoreSettings } from "@/features/demo-data/model";

export interface StoreContent {
  /** "loading" only before the first confirmed content in this browser. */
  state: "loading" | "ready";
  settings: StoreSettings;
  banner: DemoBanner | undefined;
}

export const STORE_CONTENT_CACHE_KEY = "criatto3d:store-content:v1";
export const CONTENT_CHANGED_KEY = "criatto3d:content-changed";
export const REVALIDATE_MS = 60_000;

const LOADING: StoreContent = { state: "loading", settings: DEFAULT_REAL_SETTINGS, banner: undefined };

const str = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.length <= max ? value : null;

/** Validates cached JSON; anything unexpected is discarded (never trusted). */
export function parseCachedContent(raw: string | null): StoreContent | null {
  if (!raw || raw.length > 20_000) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== "object") return null;
  const { settings, banner } = data as { settings?: unknown; banner?: unknown };
  if (!settings || typeof settings !== "object") return null;
  const s = settings as Record<string, unknown>;
  const parsedSettings: StoreSettings = { ...DEFAULT_REAL_SETTINGS };
  for (const key of ["name", "whatsappNumber", "email", "instagram", "tiktok", "address", "deliveryInfo", "serviceMessage"] as const) {
    const value = str(s[key], 1000);
    if (value === null) return null;
    parsedSettings[key] = value;
  }
  if (typeof s.offersNationalShipping !== "boolean") return null;
  parsedSettings.offersNationalShipping = s.offersNationalShipping;
  parsedSettings.logo = "";

  let parsedBanner: DemoBanner | undefined;
  if (banner !== null && banner !== undefined) {
    if (typeof banner !== "object") return null;
    const b = banner as Record<string, unknown>;
    const fields = {
      id: str(b.id, 100), title: str(b.title, 200), highlight: str(b.highlight, 200),
      subtitle: str(b.subtitle, 400), image: str(b.image, 2048), buttonText: str(b.buttonText, 200),
      buttonUrl: str(b.buttonUrl, 2048),
    };
    if (Object.values(fields).some((value) => value === null)) return null;
    const heroStyle: HeroStyle = b.heroStyle === "logo" ? "logo" : "texto";
    parsedBanner = {
      id: fields.id!, title: fields.title!, highlight: fields.highlight!, subtitle: fields.subtitle!,
      image: fields.image!, buttonText: fields.buttonText!, buttonUrl: fields.buttonUrl!,
      order: typeof b.order === "number" ? b.order : 0, active: true, heroStyle,
    };
  }
  return { state: "ready", settings: parsedSettings, banner: parsedBanner };
}

function readCache(): StoreContent | null {
  try {
    return typeof localStorage === "undefined" ? null : parseCachedContent(localStorage.getItem(STORE_CONTENT_CACHE_KEY));
  } catch {
    return null;
  }
}

function writeCache(content: StoreContent): void {
  try {
    localStorage.setItem(STORE_CONTENT_CACHE_KEY, JSON.stringify({ settings: content.settings, banner: content.banner ?? null }));
  } catch { /* storage unavailable: the page still works without cache */ }
}

let snapshot: StoreContent | null = null;
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function current(): StoreContent {
  if (!snapshot) snapshot = readCache() ?? LOADING;
  return snapshot;
}

function publish(next: StoreContent): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Fetches settings and banner together; on failure keeps what is shown. */
export function refreshStoreContent(): Promise<void> {
  if (request) return request;
  request = Promise.all([readPublicStoreSettings(), listPublishedBanners()])
    .then(([settings, banners]) => {
      const next: StoreContent = { state: "ready", settings, banner: banners[0] };
      writeCache(next);
      publish(next);
    })
    .catch(() => {
      const shown = current();
      if (shown.state === "loading") publish({ ...LOADING, state: "ready" });
    })
    .finally(() => { request = null; });
  return request;
}

/** Called by the admin after saving banners or settings. */
export function notifyStoreContentChanged(): void {
  try { localStorage.setItem(CONTENT_CHANGED_KEY, String(Date.now())); } catch { /* ignore */ }
  void refreshStoreContent();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) void refreshStoreContent();
  return () => listeners.delete(listener);
}

export function useStoreContent(): StoreContent {
  return useSyncExternalStore(subscribe, current, () => LOADING);
}

/**
 * Keeps an open storefront in sync with the panel. Returns a cleanup.
 * `refreshCatalog` reloads products/categories without blanking the page.
 */
export function startStorefrontRevalidation(refreshCatalog: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  let last = Date.now();
  const revalidate = () => {
    last = Date.now();
    void refreshStoreContent();
    refreshCatalog();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible" && Date.now() - last > 5_000) revalidate();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONTENT_CHANGED_KEY) revalidate();
  };
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") revalidate();
  }, REVALIDATE_MS);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener("storage", onStorage);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener("storage", onStorage);
  };
}

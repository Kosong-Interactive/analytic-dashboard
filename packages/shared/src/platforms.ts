import { storeValues, type CountryCode, type Store } from "./store.js";

/** Whether a metric exists on a platform, and in what form. `false` means the platform never publishes it. */
export interface PlatformCapabilities {
  /** Star rating and its scale. */
  rating: { scale: number } | false;
  ratingCount: boolean;
  reviewCount: boolean;
  /** Install counts are only ever published as ranges, never as exact downloads. */
  installs: "range" | false;
  /** Chart positions this system collects for the platform (not what the store itself has). */
  chartRank: boolean;
}

export interface PlatformDefinition {
  id: Store;
  label: string;
  /** Mobile stores share rating semantics; a future PC platform will not. */
  kind: "mobile";
  /** Markets with country-scoped observations for this platform. */
  markets: readonly CountryCode[];
  capabilities: PlatformCapabilities;
}

/**
 * The one place that says what each platform is and publishes. Add a platform here (and in the
 * database enum) only when its adapter and observation semantics exist.
 */
export const platformRegistry = {
  google_play: {
    id: "google_play",
    label: "Google Play",
    kind: "mobile",
    markets: ["id", "us"],
    capabilities: { rating: { scale: 5 }, ratingCount: true, reviewCount: true, installs: "range", chartRank: true },
  },
  app_store: {
    id: "app_store",
    label: "App Store",
    kind: "mobile",
    markets: ["id", "us"],
    // Apple never publishes installs; chart positions come from the classic RSS Games feeds.
    capabilities: { rating: { scale: 5 }, ratingCount: true, reviewCount: false, installs: false, chartRank: true },
  },
} as const satisfies Record<Store, PlatformDefinition>;

export const platformIds: readonly Store[] = storeValues;

export function platformDefinition(id: Store): PlatformDefinition {
  return platformRegistry[id];
}

export function platformLabel(id: Store): string {
  return platformRegistry[id].label;
}

export type PlatformCapability = keyof PlatformCapabilities;

export function supports(id: Store, capability: PlatformCapability): boolean {
  return platformRegistry[id].capabilities[capability] !== false;
}

/** Platforms among `ids` that publish the capability, for "Only X publishes …" notes. */
export function platformsSupporting(ids: readonly Store[], capability: PlatformCapability): Store[] {
  return ids.filter((id) => supports(id, capability));
}

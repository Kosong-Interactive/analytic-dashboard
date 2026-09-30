export type PlatformMode = "mobile" | "desktop";

export type NavKey =
  | "overview"
  | "trending"
  | "releases"
  | "genres"
  | "mechanics"
  | "games"
  | "steam-overview"
  | "steam-trending"
  | "steam-releases"
  | "steam-genres"
  | "steam-mechanics"
  | "steam-games"
  | "steam-charts";

export interface NavEntry {
  key: NavKey;
  label: string;
  href: string;
  mode: PlatformMode;
  /** The same menu in the other mode; absent for menus that exist on one side only. */
  counterpart?: NavKey;
}

/** Menu order is display order. Mobile and Desktop menus never appear together. */
export const NAV_ENTRIES: readonly NavEntry[] = [
  { key: "overview", label: "Overview", href: "/", mode: "mobile", counterpart: "steam-overview" },
  { key: "trending", label: "Trending Games", href: "/trending", mode: "mobile", counterpart: "steam-trending" },
  { key: "releases", label: "New Releases", href: "/new-releases", mode: "mobile", counterpart: "steam-releases" },
  { key: "genres", label: "Genres", href: "/genres", mode: "mobile", counterpart: "steam-genres" },
  { key: "mechanics", label: "Mechanics", href: "/mechanics", mode: "mobile", counterpart: "steam-mechanics" },
  { key: "games", label: "Games", href: "/games", mode: "mobile", counterpart: "steam-games" },
  { key: "steam-overview", label: "Overview", href: "/steam", mode: "desktop", counterpart: "overview" },
  { key: "steam-trending", label: "Trending Games", href: "/steam/trending", mode: "desktop", counterpart: "trending" },
  { key: "steam-releases", label: "New Releases", href: "/steam/new-releases", mode: "desktop", counterpart: "releases" },
  { key: "steam-genres", label: "Genres", href: "/steam/genres", mode: "desktop", counterpart: "genres" },
  { key: "steam-mechanics", label: "Mechanics", href: "/steam/mechanics", mode: "desktop", counterpart: "mechanics" },
  { key: "steam-games", label: "Games", href: "/steam/games", mode: "desktop", counterpart: "games" },
  { key: "steam-charts", label: "Steam Charts", href: "/steam/charts", mode: "desktop" },
];

const byKey = new Map(NAV_ENTRIES.map((entry) => [entry.key, entry]));

export const MODE_TITLES: Record<PlatformMode, string> = { mobile: "Mobile", desktop: "Desktop" };

/** The mode comes from the page being shown, never from client state, so shared URLs keep it. */
export function platformModeOf(key: NavKey): PlatformMode {
  return byKey.get(key)?.mode ?? "mobile";
}

export function navItemsFor(mode: PlatformMode): NavEntry[] {
  return NAV_ENTRIES.filter((entry) => entry.mode === mode);
}

export function overviewHrefFor(mode: PlatformMode): string {
  return mode === "mobile" ? "/" : "/steam";
}

/**
 * Where the Mobile|Desktop switch leads. The equivalent menu when there is one; otherwise (detail
 * pages, Watchlist, Compare, Research, Steam Charts) the target mode's Overview. Only `country`
 * travels; store, sort, and page filters do not apply on the other side.
 */
export function platformSwitchHref(input: {
  active: NavKey;
  target: PlatformMode;
  country: string;
  noCounterpart?: boolean;
}): string {
  const current = byKey.get(input.active);
  let path = overviewHrefFor(input.target);
  if (current && current.mode === input.target) {
    path = input.noCounterpart ? overviewHrefFor(input.target) : current.href;
  } else if (current?.counterpart && !input.noCounterpart) {
    path = byKey.get(current.counterpart)?.href ?? path;
  }
  return input.country === "id" ? path : `${path}?country=${input.country}`;
}

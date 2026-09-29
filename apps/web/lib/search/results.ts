import { z } from "zod";

import { countryLabels, platformLabels } from "../overview/filters";

/** Imported by the client palette, so this module must stay free of server-only code. */

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;

export const searchTextSchema = z.string().trim().min(SEARCH_MIN_LENGTH).max(SEARCH_MAX_LENGTH);

/** Label types that have a page to open. Monetization clues are not browsable, so they are not searched. */
export const searchLabelTypes = [
  "genre",
  "subgenre",
  "core_mechanic",
  "meta_mechanic",
  "theme",
  "multiplayer_mode",
] as const;
export type SearchLabelType = (typeof searchLabelTypes)[number];

const labelTypeNames: Record<SearchLabelType, string> = {
  genre: "Genre",
  subgenre: "Subgenre",
  core_mechanic: "Core mechanic",
  meta_mechanic: "Meta mechanic",
  theme: "Theme",
  multiplayer_mode: "Multiplayer mode",
};

export type SearchKind = "page" | "game" | "developer" | "label";

export interface SearchItem {
  kind: SearchKind;
  /** Stable within one response; used for React keys and `aria-activedescendant`. */
  id: string;
  title: string;
  detail: string;
  href: string;
  iconUrl?: string | null;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  items: SearchItem[];
}

/** Structural subset of the database result, so this module is testable without a database. */
export interface CatalogResultInput {
  games: Array<{
    storeAppId: string;
    title: string;
    developerName: string | null;
    store: "app_store" | "google_play";
    country: string;
    iconUrl: string | null;
  }>;
  developers: Array<{ developerName: string; listings: number }>;
  labels: Array<{ type: string; slug: string; displayName: string }>;
}

const PAGES: Array<{ title: string; href: string; keywords: string }> = [
  { title: "Overview", href: "/", keywords: "overview home dashboard market" },
  { title: "Trending Games", href: "/trending", keywords: "trending trend score momentum" },
  { title: "New Releases", href: "/new-releases", keywords: "new releases released launch" },
  { title: "Genres", href: "/genres", keywords: "genres subgenres categories" },
  { title: "Mechanics", href: "/mechanics", keywords: "mechanics themes multiplayer" },
  { title: "Games", href: "/games", keywords: "games explorer browse all tracked catalogue" },
  { title: "Watchlist", href: "/watchlist", keywords: "watchlist watching priority notes" },
  { title: "Compare", href: "/compare", keywords: "compare side by side versus" },
];

export function matchPages(text: string): SearchItem[] {
  const needle = text.trim().toLocaleLowerCase();
  if (!needle) return [];
  return PAGES.filter(
    (page) => page.title.toLocaleLowerCase().includes(needle) || page.keywords.includes(needle),
  ).map((page) => ({ kind: "page", id: `page:${page.href}`, title: page.title, detail: "Page", href: page.href }));
}

function isSearchLabelType(type: string): type is SearchLabelType {
  return (searchLabelTypes as readonly string[]).includes(type);
}

/** Genres and core mechanics filter the Games explorer; other types open their roll-up tab. */
export function labelHref(type: SearchLabelType, slug: string): string {
  switch (type) {
    case "genre":
      return `/games?genre=${encodeURIComponent(slug)}`;
    case "core_mechanic":
      return `/games?mechanic=${encodeURIComponent(slug)}`;
    case "subgenre":
      return "/genres?type=subgenre";
    case "meta_mechanic":
    case "theme":
    case "multiplayer_mode":
      return `/mechanics?type=${type}`;
  }
}

function storefront(country: string): string {
  return countryLabels[country as keyof typeof countryLabels] ?? country.toUpperCase();
}

export function buildSearchGroups(text: string, result: CatalogResultInput): SearchGroup[] {
  const groups: SearchGroup[] = [
    { kind: "page", label: "Pages", items: matchPages(text) },
    {
      kind: "game",
      label: "Games",
      items: result.games.map((game) => ({
        kind: "game",
        id: `game:${game.storeAppId}`,
        title: game.title,
        detail: `${game.developerName ?? "Unknown developer"} · ${platformLabels[game.store]} · ${storefront(game.country)}`,
        href: `/games/${game.storeAppId}`,
        iconUrl: game.iconUrl,
      })),
    },
    {
      kind: "developer",
      label: "Developers",
      items: result.developers.map((developer) => ({
        kind: "developer",
        id: `developer:${developer.developerName}`,
        title: developer.developerName,
        detail: `${developer.listings} tracked ${developer.listings === 1 ? "listing" : "listings"} · opens in Games`,
        href: `/games?q=${encodeURIComponent(developer.developerName)}`,
      })),
    },
    {
      kind: "label",
      label: "Labels",
      items: result.labels.flatMap((label) =>
        isSearchLabelType(label.type)
          ? [
              {
                kind: "label" as const,
                id: `label:${label.type}:${label.slug}`,
                title: label.displayName,
                detail: labelTypeNames[label.type],
                href: labelHref(label.type, label.slug),
              },
            ]
          : [],
      ),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
}

/** Runtime check for the palette, which receives the response as untrusted JSON. */
export const searchResponseSchema = z.object({
  query: z.string(),
  groups: z.array(
    z.object({
      kind: z.enum(["page", "game", "developer", "label"]),
      label: z.string(),
      items: z.array(
        z.object({
          kind: z.enum(["page", "game", "developer", "label"]),
          id: z.string(),
          title: z.string(),
          detail: z.string(),
          href: z.string().startsWith("/"),
          iconUrl: z.string().nullable().optional(),
        }),
      ),
    }),
  ),
});

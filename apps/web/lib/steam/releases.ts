import { countryCodeSchema } from "@analytic-dashboard/shared";
import type { SteamGameListRow, SteamLabelMembershipRow } from "@analytic-dashboard/db";
import { z } from "zod";

import { toSteamGameRows, type SteamGameRow } from "./games-list";

const DAY_MS = 86_400_000;

export const steamWindowValues = [7, 30, 90] as const;
export type SteamReleaseWindow = (typeof steamWindowValues)[number];

export const steamReleaseSortValues = ["newest", "players", "positive", "reviews"] as const;
export type SteamReleaseSort = (typeof steamReleaseSortValues)[number];

export const steamReleaseSortLabels: Record<SteamReleaseSort, string> = {
  newest: "Newest",
  players: "Players now",
  positive: "Positive reviews",
  reviews: "Most reviewed",
};

export const STEAM_RELEASES_PAGE_SIZE = 20;

const queryShape = z.object({
  country: countryCodeSchema.catch("id"),
  days: z.coerce
    .number()
    .refine((value): value is SteamReleaseWindow => (steamWindowValues as readonly number[]).includes(value))
    .catch(30),
  sort: z.enum(steamReleaseSortValues).catch("newest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export type SteamReleasesQuery = z.infer<typeof queryShape>;

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseSteamReleasesQuery(params: RawSearchParams): SteamReleasesQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return queryShape.parse({
    country: first(params.country),
    days: first(params.days),
    sort: first(params.sort),
    page: first(params.page),
  });
}

export function steamReleasesHref(current: SteamReleasesQuery, change: Partial<SteamReleasesQuery> = {}): string {
  const next = { ...current, ...(change.page === undefined ? { page: 1 } : {}), ...change };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.days !== 30) query.set("days", String(next.days));
  if (next.sort !== "newest") query.set("sort", next.sort);
  if (next.page !== 1) query.set("page", String(next.page));
  const text = query.toString();
  return text ? `/steam/new-releases?${text}` : "/steam/new-releases";
}

export interface SteamReleasesList {
  rows: SteamGameRow[];
  total: number;
  tracked: number;
  /** Tracked games without a Steam release date; they can never appear here. */
  withoutReleaseDate: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

function descNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

const sorters: Record<SteamReleaseSort, (a: SteamGameRow, b: SteamGameRow) => number> = {
  newest: (a, b) => (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0),
  players: (a, b) => descNullsLast(a.snapshot?.currentPlayers ?? null, b.snapshot?.currentPlayers ?? null),
  positive: (a, b) => descNullsLast(a.positive, b.positive),
  reviews: (a, b) => descNullsLast(a.snapshot?.reviewTotal ?? null, b.snapshot?.reviewTotal ?? null),
};

/**
 * "Newly released" requires a Steam release date inside the window. Discovery time is a different
 * signal and is never used as a substitute. Future dates (upcoming games) are excluded.
 */
export function buildSteamReleasesList(input: {
  games: readonly SteamGameListRow[];
  membership: readonly SteamLabelMembershipRow[];
  query: SteamReleasesQuery;
  asOf: Date;
}): SteamReleasesList {
  const { query, asOf } = input;
  const all = toSteamGameRows(input.games, input.membership, query.country);
  const windowStart = asOf.getTime() - query.days * DAY_MS;

  const rows = all
    .filter((row) => {
      const time = row.releaseDate?.getTime();
      return time !== undefined && time >= windowStart && time <= asOf.getTime();
    })
    .sort(
      (a, b) =>
        sorters[query.sort](a, b) ||
        (b.releaseDate?.getTime() ?? 0) - (a.releaseDate?.getTime() ?? 0) ||
        a.title.localeCompare(b.title),
    );

  const pageCount = Math.max(1, Math.ceil(rows.length / STEAM_RELEASES_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * STEAM_RELEASES_PAGE_SIZE;
  return {
    rows: rows.slice(start, start + STEAM_RELEASES_PAGE_SIZE),
    total: rows.length,
    tracked: all.length,
    withoutReleaseDate: all.filter((row) => row.releaseDate === null).length,
    page,
    pageCount,
    pageSize: STEAM_RELEASES_PAGE_SIZE,
  };
}

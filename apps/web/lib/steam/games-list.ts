import type { SteamGameListRow, SteamLabelMembershipRow } from "@analytic-dashboard/db";

import type { FilterOption } from "../explorer/list";
import { matchesPriceFilter } from "../format/price";
import { positiveRatio } from "./format";
import { STEAM_GAMES_PAGE_SIZE, type SteamGameSort, type SteamGamesQuery } from "./games-query";

const DAY_MS = 86_400_000;

export interface SteamLabelChip {
  slug: string;
  displayName: string;
  source: SteamLabelMembershipRow["source"];
}

export interface SteamGameRow extends SteamGameListRow {
  genres: SteamLabelChip[];
  mechanics: SteamLabelChip[];
  /** Every label the game carries as `type:slug`, so any taxonomy label can filter the list. */
  labelKeys: string[];
  /** Share of positive reviews, 0–1; null when Steam gave no review reading. */
  positive: number | null;
  /** Price in the selected country's currency, or null when Steam gave none. Zero is free. */
  price: number | null;
  currency: string | null;
  /** Best (lowest) rank across the two charts, or null when the game is in neither. */
  bestRank: number | null;
}

export interface SteamGamesList {
  rows: SteamGameRow[];
  total: number;
  tracked: number;
  page: number;
  pageCount: number;
  pageSize: number;
  options: { genres: FilterOption[]; mechanics: FilterOption[]; tags: FilterOption[] };
}

function descNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function ascNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

const time = (date: Date | null) => (date === null ? null : date.getTime());

/** Missing values sort last for every key, so an unmeasured game never outranks a measured one. */
const sorters: Record<SteamGameSort, (a: SteamGameRow, b: SteamGameRow) => number> = {
  players: (a, b) => descNullsLast(a.snapshot?.currentPlayers ?? null, b.snapshot?.currentPlayers ?? null),
  positive: (a, b) => descNullsLast(a.positive, b.positive),
  reviews: (a, b) => descNullsLast(a.snapshot?.reviewTotal ?? null, b.snapshot?.reviewTotal ?? null),
  chart: (a, b) => ascNullsLast(a.bestRank, b.bestRank),
  newest: (a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime(),
  released: (a, b) => descNullsLast(time(a.releaseDate), time(b.releaseDate)),
  name: (a, b) => a.title.localeCompare(b.title),
};

function matchesReleased(row: SteamGameRow, query: SteamGamesQuery, asOf: Date): boolean {
  if (query.released === "any") return true;
  if (query.released === "unknown") return row.releaseDate === null;
  if (row.releaseDate === null) return false;
  const released = row.releaseDate.getTime();
  // Future dates are upcoming releases, not releases.
  return released <= asOf.getTime() && released >= asOf.getTime() - Number(query.released) * DAY_MS;
}

function matchesChart(row: SteamGameRow, query: SteamGamesQuery): boolean {
  return query.chart === "any" || row.charts[query.chart] !== null;
}

function matchesText(row: SteamGameRow, text: string): boolean {
  if (!text) return true;
  return row.title.toLocaleLowerCase().includes(text.toLocaleLowerCase());
}

function countOptions(values: Iterable<{ value: string; label: string }>): FilterOption[] {
  const counts = new Map<string, FilterOption>();
  for (const { value, label } of values) {
    const current = counts.get(value);
    if (current) current.count += 1;
    else counts.set(value, { value, label, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Rows for every tracked game, with labels and the price of the selected country. Unfiltered. */
export function toSteamGameRows(
  games: readonly SteamGameListRow[],
  membership: readonly SteamLabelMembershipRow[],
  country: SteamGamesQuery["country"],
): SteamGameRow[] {
  const labelsById = new Map<string, { genres: SteamLabelChip[]; mechanics: SteamLabelChip[]; keys: string[] }>();
  for (const row of membership) {
    const entry = labelsById.get(row.steamAppId) ?? { genres: [], mechanics: [], keys: [] };
    entry.keys.push(`${row.type}:${row.slug}`);
    const chip = { slug: row.slug, displayName: row.displayName, source: row.source };
    if (row.type === "genre") entry.genres.push(chip);
    else if (row.type === "core_mechanic") entry.mechanics.push(chip);
    labelsById.set(row.steamAppId, entry);
  }
  const byName = (a: SteamLabelChip, b: SteamLabelChip) => a.displayName.localeCompare(b.displayName);
  const priceCountry = country === "id" ? "id" : "us";

  return games.map((game) => {
    const labels = labelsById.get(game.steamAppId);
    const price = game.prices[priceCountry];
    const ranks = [game.charts.most_played?.rank, game.charts.top_sellers?.rank].filter(
      (rank): rank is number => rank !== undefined,
    );
    return {
      ...game,
      genres: [...(labels?.genres ?? [])].sort(byName),
      mechanics: [...(labels?.mechanics ?? [])].sort(byName),
      labelKeys: labels?.keys ?? [],
      positive: positiveRatio(game.snapshot),
      // A free game is price 0; otherwise only a real reading counts, never a guess.
      price: game.isFree ? 0 : (price?.finalPrice ?? null),
      currency: price?.currency ?? null,
      bestRank: ranks.length === 0 ? null : Math.min(...ranks),
    };
  });
}

/** Filters, sorts, and paginates the tracked Steam games. Filtering never treats a missing value as zero. */
export function buildSteamGamesList(input: {
  games: readonly SteamGameListRow[];
  membership: readonly SteamLabelMembershipRow[];
  query: SteamGamesQuery;
  asOf: Date;
}): SteamGamesList {
  const { query, asOf } = input;
  const all = toSteamGameRows(input.games, input.membership, query.country);

  const filtered = all
    .filter((row) => matchesText(row, query.q))
    .filter((row) => !query.tag || row.tags.includes(query.tag))
    .filter((row) => !query.genre || row.genres.some((label) => label.slug === query.genre))
    .filter((row) => !query.mechanic || row.mechanics.some((label) => label.slug === query.mechanic))
    .filter((row) => !query.label || row.labelKeys.includes(query.label))
    .filter((row) => matchesReleased(row, query, asOf))
    .filter((row) => query.minPositive === 0 || (row.positive !== null && row.positive * 100 >= query.minPositive))
    .filter(
      (row) =>
        query.minReviews === 0 ||
        (row.snapshot?.reviewTotal != null && row.snapshot.reviewTotal >= query.minReviews),
    )
    .filter((row) => matchesPriceFilter(row.price, query.price))
    .filter((row) => matchesChart(row, query))
    .sort(
      (a, b) =>
        sorters[query.sort](a, b) ||
        descNullsLast(a.snapshot?.currentPlayers ?? null, b.snapshot?.currentPlayers ?? null) ||
        a.title.localeCompare(b.title) ||
        a.externalId.localeCompare(b.externalId),
    );

  const pageCount = Math.max(1, Math.ceil(filtered.length / STEAM_GAMES_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * STEAM_GAMES_PAGE_SIZE;

  return {
    rows: filtered.slice(start, start + STEAM_GAMES_PAGE_SIZE),
    total: filtered.length,
    tracked: all.length,
    page,
    pageCount,
    pageSize: STEAM_GAMES_PAGE_SIZE,
    options: {
      genres: countOptions(all.flatMap((row) => row.genres.map((l) => ({ value: l.slug, label: l.displayName })))),
      mechanics: countOptions(all.flatMap((row) => row.mechanics.map((l) => ({ value: l.slug, label: l.displayName })))),
      tags: countOptions(all.flatMap((row) => row.tags.map((tag) => ({ value: tag, label: tag })))).slice(0, 60),
    },
  };
}

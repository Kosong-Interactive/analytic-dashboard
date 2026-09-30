import type { TrendingScore } from "@analytic-dashboard/analytics";

import { matchesPriceFilter } from "../format/price";
import type { MembershipRow } from "../labels/aggregate";
import { toTrendingRow, type OverviewCandidate, type TrendingRow } from "../overview/view-model";
import { EXPLORER_PAGE_SIZE, type ExplorerQuery, type ExplorerSort } from "./query";

const DAY_MS = 86_400_000;

export interface ExplorerLabel {
  slug: string;
  displayName: string;
  source: MembershipRow["source"];
}

export interface ExplorerRow extends TrendingRow {
  genres: ExplorerLabel[];
  mechanics: ExplorerLabel[];
  /** How the game carries the label filter, when one is set: rule, AI, or manual, with confidence. */
  matchedLabel: { source: MembershipRow["source"]; confidence: number } | null;
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface ExplorerList {
  rows: ExplorerRow[];
  /** Games matching the filters, before pagination. */
  total: number;
  /** All tracked games in the selected storefronts, before filters. */
  tracked: number;
  page: number;
  pageCount: number;
  pageSize: number;
  options: { categories: FilterOption[]; genres: FilterOption[]; mechanics: FilterOption[] };
}

function descNullsLast(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function time(date: Date | null): number | null {
  return date === null ? null : date.getTime();
}

/** Missing values sort last for every key, so an unmeasured game never outranks a measured one. */
const sorters: Record<ExplorerSort, (a: ExplorerRow, b: ExplorerRow) => number> = {
  most_rated: (a, b) => descNullsLast(a.ratingCount, b.ratingCount),
  rating: (a, b) => descNullsLast(a.rating, b.rating),
  score: (a, b) => descNullsLast(a.score, b.score),
  newest: (a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime(),
  released: (a, b) => descNullsLast(time(a.releaseDate), time(b.releaseDate)),
  name: (a, b) => a.title.localeCompare(b.title),
};

function matchesReleased(row: ExplorerRow, query: ExplorerQuery, asOf: Date): boolean {
  if (query.released === "any") return true;
  if (query.released === "unknown") return row.releaseDate === null;
  if (row.releaseDate === null) return false;
  const released = row.releaseDate.getTime();
  // Future dates are pre-registration listings, not releases.
  return released <= asOf.getTime() && released >= asOf.getTime() - Number(query.released) * DAY_MS;
}

function matchesMomentum(row: ExplorerRow, query: ExplorerQuery): boolean {
  switch (query.momentum) {
    case "any":
      return true;
    case "scored":
      return row.score !== null;
    case "unscored":
      return row.score === null;
    case "growing":
      return row.score !== null && row.score >= 31;
    case "trending":
      return row.score !== null && row.score >= 61;
  }
}

function matchesLabels(row: ExplorerRow, query: ExplorerQuery): boolean {
  const all = [...row.genres, ...row.mechanics];
  switch (query.labels) {
    case "any":
      return true;
    case "labelled":
      return all.length > 0;
    case "unlabelled":
      return all.length === 0;
    case "confirmed":
      return all.some((label) => label.source === "manual");
  }
}

function matchesText(row: ExplorerRow, text: string): boolean {
  if (!text) return true;
  const needle = text.toLocaleLowerCase();
  return (
    row.title.toLocaleLowerCase().includes(needle) ||
    (row.developer?.toLocaleLowerCase().includes(needle) ?? false)
  );
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

/**
 * Filters, sorts, and paginates the tracked games of one selection. Labels come from the
 * membership query, which already applies manual precedence and the confidence threshold.
 */
export function buildExplorerList(input: {
  candidates: readonly OverviewCandidate[];
  scores: readonly TrendingScore[];
  membership: readonly MembershipRow[];
  query: ExplorerQuery;
  asOf: Date;
}): ExplorerList {
  const { candidates, scores, membership, query, asOf } = input;
  const scoreById = new Map(scores.map((score) => [score.id, score]));
  const labelsById = new Map<string, { genres: ExplorerLabel[]; mechanics: ExplorerLabel[] }>();
  const matchedById = new Map<string, ExplorerRow["matchedLabel"]>();
  for (const row of membership) {
    if (query.label && row.type === query.label.type && row.slug === query.label.slug) {
      matchedById.set(row.storeAppId, { source: row.source, confidence: row.confidence });
    }
    const entry = labelsById.get(row.storeAppId) ?? { genres: [], mechanics: [] };
    const label = { slug: row.slug, displayName: row.displayName, source: row.source };
    if (row.type === "genre") entry.genres.push(label);
    else if (row.type === "core_mechanic") entry.mechanics.push(label);
    labelsById.set(row.storeAppId, entry);
  }

  const all: ExplorerRow[] = candidates.map((candidate) => {
    const labels = labelsById.get(candidate.storeAppId);
    const byName = (a: ExplorerLabel, b: ExplorerLabel) => a.displayName.localeCompare(b.displayName);
    return {
      ...toTrendingRow(candidate, scoreById.get(candidate.storeAppId), 0),
      genres: [...(labels?.genres ?? [])].sort(byName),
      mechanics: [...(labels?.mechanics ?? [])].sort(byName),
      matchedLabel: matchedById.get(candidate.storeAppId) ?? null,
    };
  });

  const filtered = all
    .filter((row) => matchesText(row, query.q))
    .filter((row) => !query.category || row.category === query.category)
    .filter((row) => !query.genre || row.genres.some((label) => label.slug === query.genre))
    .filter((row) => !query.mechanic || row.mechanics.some((label) => label.slug === query.mechanic))
    .filter((row) => !query.label || row.matchedLabel !== null)
    .filter((row) => matchesReleased(row, query, asOf))
    .filter((row) => query.minRating === 0 || (row.rating !== null && row.rating >= query.minRating))
    .filter((row) => matchesMomentum(row, query))
    .filter((row) => matchesLabels(row, query))
    .filter((row) => matchesPriceFilter(row.price, query.price))
    .sort(
      (a, b) =>
        sorters[query.sort](a, b) ||
        descNullsLast(a.ratingCount, b.ratingCount) ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );

  const pageCount = Math.max(1, Math.ceil(filtered.length / EXPLORER_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * EXPLORER_PAGE_SIZE;

  return {
    rows: filtered
      .slice(start, start + EXPLORER_PAGE_SIZE)
      .map((row, index) => ({ ...row, rank: start + index + 1 })),
    total: filtered.length,
    tracked: candidates.length,
    page,
    pageCount,
    pageSize: EXPLORER_PAGE_SIZE,
    options: {
      categories: countOptions(
        all.flatMap((row) => (row.category ? [{ value: row.category, label: row.category }] : [])),
      ),
      genres: countOptions(all.flatMap((row) => row.genres.map((l) => ({ value: l.slug, label: l.displayName })))),
      mechanics: countOptions(
        all.flatMap((row) => row.mechanics.map((l) => ({ value: l.slug, label: l.displayName }))),
      ),
    },
  };
}

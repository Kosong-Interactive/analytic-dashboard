import type { TrendingScore } from "@analytic-dashboard/analytics";
import { supports } from "@analytic-dashboard/shared";
import { z } from "zod";

import type { MembershipRow } from "../labels/aggregate";
import { parseOverviewFilters, type OverviewFilters } from "../overview/filters";
import { toTrendingRow, type OverviewCandidate, type TrendingRow } from "../overview/view-model";

export const MAX_COMPARED = 4;

export type CompareQuery = OverviewFilters & { ids: string[]; q: string };

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Ids may be repeated or comma-separated; invalid and duplicate ids are dropped, order is kept. */
export function parseCompareIds(raw: string | string[] | undefined): string[] {
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((value) => value.split(","));
  const ids: string[] = [];
  for (const value of values) {
    const id = z.uuid().safeParse(value.trim());
    if (id.success && !ids.includes(id.data) && ids.length < MAX_COMPARED) ids.push(id.data);
  }
  return ids;
}

/** Adds the id, or removes it when already selected. Adding beyond the cap is ignored. */
export function toggleCompareId(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((other) => other !== id);
  return ids.length >= MAX_COMPARED ? [...ids] : [...ids, id];
}

export function parseCompareQuery(params: RawSearchParams): CompareQuery {
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  return { ...parseOverviewFilters(params), ids: parseCompareIds(params.ids), q: (q ?? "").trim().slice(0, 80) };
}

export function compareHref(current: CompareQuery, change: Partial<CompareQuery>): string {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.ids.length > 0) query.set("ids", next.ids.join(","));
  if (next.country !== "id") query.set("country", next.country);
  if (next.platform !== "all") query.set("platform", next.platform);
  if (next.q) query.set("q", next.q);
  const text = query.toString();
  return text ? `/games/compare?${text}` : "/games/compare";
}

/** Candidate row plus install ranges, which only some platforms publish. */
export type CompareCandidate = Omit<OverviewCandidate, "snapshots"> & {
  snapshots: ReadonlyArray<{
    capturedAt: Date;
    rating: number | null;
    ratingCount: number | null;
    minInstalls: number | null;
    maxInstalls: number | null;
  }>;
};

export interface CompareLabel {
  slug: string;
  displayName: string;
  source: MembershipRow["source"];
  /** Present on every compared game. */
  shared: boolean;
}

export interface CompareGame {
  row: TrendingRow;
  latestObservationAt: Date | null;
  /** Install range; `null` for a platform that never publishes installs (see the platform registry). */
  installs: { min: number | null; max: number | null } | null;
  genres: CompareLabel[];
  mechanics: CompareLabel[];
}

export interface Comparison {
  games: CompareGame[];
  /** Requested ids that are not tracked (or were removed); shown instead of silently dropped. */
  missingIds: string[];
  mixedStores: boolean;
  mixedCountries: boolean;
}

function latestSnapshot(candidate: CompareCandidate) {
  return [...candidate.snapshots].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
}

/**
 * Side-by-side view of up to four listings. Each listing keeps its own store and country, and
 * its Trend Score stays relative to its own storefront cohort.
 */
export function buildComparison(input: {
  ids: readonly string[];
  candidates: readonly CompareCandidate[];
  scores: readonly TrendingScore[];
  membership: readonly MembershipRow[];
}): Comparison {
  const candidateById = new Map(input.candidates.map((candidate) => [candidate.storeAppId, candidate]));
  const scoreById = new Map(input.scores.map((score) => [score.id, score]));
  const present = input.ids.filter((id) => candidateById.has(id));

  const labelsOf = (id: string, type: string) =>
    input.membership.filter((row) => row.storeAppId === id && row.type === type);
  const isShared = (type: string, slug: string) =>
    present.length > 1 &&
    present.every((id) => labelsOf(id, type).some((row) => row.slug === slug));
  const toLabels = (id: string, type: string): CompareLabel[] =>
    labelsOf(id, type)
      .map((row) => ({ slug: row.slug, displayName: row.displayName, source: row.source, shared: isShared(type, row.slug) }))
      .sort((a, b) => Number(b.shared) - Number(a.shared) || a.displayName.localeCompare(b.displayName));

  const games = present.map((id): CompareGame => {
    const candidate = candidateById.get(id)!;
    const latest = latestSnapshot(candidate);
    return {
      row: toTrendingRow(candidate, scoreById.get(id), 0),
      latestObservationAt: latest?.capturedAt ?? null,
      installs:
        supports(candidate.store, "installs")
          ? { min: latest?.minInstalls ?? null, max: latest?.maxInstalls ?? null }
          : null,
      genres: toLabels(id, "genre"),
      mechanics: toLabels(id, "core_mechanic"),
    };
  });

  return {
    games,
    missingIds: input.ids.filter((id) => !candidateById.has(id)),
    mixedStores: new Set(games.map((game) => game.row.store)).size > 1,
    mixedCountries: new Set(games.map((game) => game.row.country)).size > 1,
  };
}

/** Tracked games matching a title or developer search, excluding those already compared. */
export function searchCandidates(
  candidates: readonly OverviewCandidate[],
  text: string,
  exclude: readonly string[],
  limit = 8,
): OverviewCandidate[] {
  if (!text) return [];
  const needle = text.toLocaleLowerCase();
  return candidates
    .filter(
      (candidate) =>
        !exclude.includes(candidate.storeAppId) &&
        (candidate.title.toLocaleLowerCase().includes(needle) ||
          (candidate.developerName?.toLocaleLowerCase().includes(needle) ?? false)),
    )
    .sort((a, b) => a.title.localeCompare(b.title))
    .slice(0, limit);
}

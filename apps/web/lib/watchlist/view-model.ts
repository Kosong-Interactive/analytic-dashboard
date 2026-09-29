import type { TrendingScore } from "@analytic-dashboard/analytics";
import { z } from "zod";

import { parseOverviewFilters, type OverviewFilters } from "../overview/filters";
import { toTrendingRow, type OverviewCandidate, type TrendingRow } from "../overview/view-model";
import type { WatchlistStatus } from "./status";

export const watchlistViewValues = ["active", "priority", "archived", "all"] as const;
export type WatchlistViewFilter = (typeof watchlistViewValues)[number];

export const watchlistViewLabels: Record<WatchlistViewFilter, string> = {
  active: "Active",
  priority: "Priority",
  archived: "Archived",
  all: "All",
};

export type WatchlistQuery = OverviewFilters & { view: WatchlistViewFilter };

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseWatchlistQuery(params: RawSearchParams): WatchlistQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return {
    ...parseOverviewFilters(params),
    view: z.enum(watchlistViewValues).catch("active").parse(first(params.view)),
  };
}

export function watchlistHref(current: WatchlistQuery, change: Partial<WatchlistQuery>): string {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.country !== "id") query.set("country", next.country);
  if (next.platform !== "all") query.set("platform", next.platform);
  if (next.view !== "active") query.set("view", next.view);
  const text = query.toString();
  return text ? `/watchlist?${text}` : "/watchlist";
}

/** Structural subset of the database entry row, so this module is testable without a database. */
export interface WatchlistEntryInput {
  storeAppId: string;
  status: WatchlistStatus;
  note: string | null;
  addedBy: string;
  addedAt: Date;
  updatedBy: string;
  updatedAt: Date;
  baselineCapturedAt: Date | null;
  baselineRating: number | null;
  baselineRatingCount: number | null;
  store: "app_store" | "google_play";
  country: string;
  title: string;
  developerName: string | null;
  iconUrl: string | null;
}

export interface WatchlistRow {
  entry: WatchlistEntryInput;
  /** Current metrics and score; `null` when the listing has no observations in this selection. */
  current: TrendingRow | null;
  /** Rating-count change since the game was added; `null` when either reading is missing. */
  ratingCountSinceAdded: number | null;
  ratingSinceAdded: number | null;
}

export interface WatchlistView {
  rows: WatchlistRow[];
  counts: Record<WatchlistViewFilter, number>;
}

function difference(now: number | null | undefined, then: number | null): number | null {
  if (now === null || now === undefined || then === null) return null;
  return now - then;
}

function matchesView(status: WatchlistStatus, view: WatchlistViewFilter): boolean {
  switch (view) {
    case "all":
      return true;
    case "active":
      return status !== "archived";
    case "priority":
      return status === "priority";
    case "archived":
      return status === "archived";
  }
}

/** Joins entries to the current selection's metrics. Priority entries come first, then recent changes. */
export function buildWatchlistView(input: {
  entries: readonly WatchlistEntryInput[];
  candidates: readonly OverviewCandidate[];
  scores: readonly TrendingScore[];
  view: WatchlistViewFilter;
}): WatchlistView {
  const candidateById = new Map(input.candidates.map((candidate) => [candidate.storeAppId, candidate]));
  const scoreById = new Map(input.scores.map((score) => [score.id, score]));

  const rows = input.entries
    .filter((entry) => matchesView(entry.status, input.view))
    .map((entry): WatchlistRow => {
      const candidate = candidateById.get(entry.storeAppId);
      const current = candidate ? toTrendingRow(candidate, scoreById.get(entry.storeAppId), 0) : null;
      return {
        entry,
        current,
        ratingCountSinceAdded: difference(current?.ratingCount, entry.baselineRatingCount),
        ratingSinceAdded: difference(current?.rating, entry.baselineRating),
      };
    })
    .sort(
      (a, b) =>
        Number(b.entry.status === "priority") - Number(a.entry.status === "priority") ||
        b.entry.updatedAt.getTime() - a.entry.updatedAt.getTime() ||
        a.entry.title.localeCompare(b.entry.title),
    );

  const counts: Record<WatchlistViewFilter, number> = { active: 0, priority: 0, archived: 0, all: 0 };
  for (const entry of input.entries) {
    for (const view of watchlistViewValues) if (matchesView(entry.status, view)) counts[view] += 1;
  }
  return { rows, counts };
}

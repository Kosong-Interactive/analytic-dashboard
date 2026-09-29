import { createHash } from "node:crypto";

import {
  OPPORTUNITY_SCORE_V1,
  scoreOpportunities,
  scoreTrending,
  type OpportunityResult,
  type OpportunityScoreConfig,
  type OpportunityStorefront,
  type SourceFreshness,
} from "@analytic-dashboard/analytics";
import type {
  LabelMembershipRow,
  OpportunityRowInput,
  ResearchRunInput,
  SourceHealthRow,
  StoreId,
  TrendCandidateRow,
} from "@analytic-dashboard/db";

const DAY_MS = 86_400_000;
/** Same freshness rule as the dashboard: no successful collection within 12 hours is stale. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
const RANK_CHART = "TOP_FREE";
const WINDOW_DAYS = 7;

export interface ResearchStore {
  loadCandidates(store: StoreId, country: string, asOf: Date): Promise<TrendCandidateRow[]>;
  loadMembership(store: StoreId, country: string): Promise<LabelMembershipRow[]>;
  loadHealth(country: string): Promise<SourceHealthRow[]>;
  record(input: { run: ResearchRunInput; opportunities: OpportunityRowInput[] }): Promise<{ created: boolean }>;
  recordFailure(input: Omit<ResearchRunInput, "inputHash"> & { errorSample: string }): Promise<void>;
}

export interface ResearchSummary {
  formulaVersion: string;
  storefronts: Array<{
    store: StoreId;
    country: string;
    trackedGames: number;
    cohortsEvaluated: number;
    opportunitiesScored: number;
    /** False when an identical run already existed, so nothing was written. */
    created: boolean;
    topOpportunities: string[];
  }>;
  errorCount: number;
  errorSample: string | null;
}

const ERROR_SAMPLE_MAX_LENGTH = 300;

function freshnessOf(health: readonly SourceHealthRow[], store: StoreId, asOf: Date): SourceFreshness {
  const rows = health.filter((row) => row.source === store);
  if (rows.length === 0) return "never";
  if (rows.some((row) => row.latestStatus === "failed")) return "failed";
  const collected = rows.flatMap((row) => (row.lastCollectedAt ? [row.lastCollectedAt.getTime()] : []));
  if (collected.length === 0) return "never";
  return asOf.getTime() - Math.max(...collected) > STALE_AFTER_MS ? "stale" : "fresh";
}

/** Builds the analytics input for one storefront from stored observations and resolved labels. */
export function toStorefront(input: {
  store: StoreId;
  country: string;
  candidates: readonly TrendCandidateRow[];
  membership: readonly LabelMembershipRow[];
  health: readonly SourceHealthRow[];
  asOf: Date;
}): OpportunityStorefront {
  const { candidates, membership, asOf } = input;
  const scores = new Map(scoreTrending(candidates, { asOf, rankChartType: RANK_CHART }).map((s) => [s.id, s.score]));
  const labels = new Map<string, LabelMembershipRow[]>();
  for (const row of membership) labels.set(row.storeAppId, [...(labels.get(row.storeAppId) ?? []), row]);
  const windowStart = asOf.getTime() - WINDOW_DAYS * DAY_MS;
  const observed = candidates.flatMap((c) => c.snapshots.map((s) => s.capturedAt.getTime()));

  return {
    store: input.store,
    country: input.country,
    historyDays: observed.length === 0 ? null : (asOf.getTime() - Math.min(...observed)) / DAY_MS,
    freshness: freshnessOf(input.health, input.store, asOf),
    games: candidates.map((candidate) => {
      const latest = [...candidate.snapshots].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
      return {
        id: candidate.storeAppId,
        title: candidate.title,
        releaseDate: candidate.releaseDate,
        trendScore: scores.get(candidate.storeAppId) ?? null,
        rating: latest?.rating ?? null,
        ratingCount: latest?.ratingCount ?? null,
        inTrackedChart: candidate.ranks.some((rank) => rank.capturedAt.getTime() >= windowStart),
        labels: (labels.get(candidate.storeAppId) ?? []).map((row) => ({
          type: row.type,
          slug: row.slug,
          displayName: row.displayName,
          confidence: row.confidence,
          manual: row.source === "manual",
        })),
      };
    }),
  };
}

export function toOpportunityRow(result: OpportunityResult): OpportunityRowInput {
  return {
    opportunityKey: result.key,
    dimensions: result.dimensions,
    memberCount: result.memberCount,
    score: result.score,
    reason: result.reason,
    weightCoverage: result.weightCoverage,
    confidence: result.confidence.value,
    confidenceBand: result.confidence.band,
    insightType: result.insightType,
    components: result.components,
    facts: { ...result.facts, confidenceFactors: result.confidence.factors },
    comparables: result.comparables.map((c) => ({ ...c, releaseDate: c.releaseDate?.toISOString() ?? null })),
    positives: result.positives,
    counterSignals: result.counterSignals,
    caveats: result.caveats,
  };
}

/** Identical results give an identical hash, so a rerun over unchanged data writes nothing. */
function resultHash(rows: readonly OpportunityRowInput[]): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

/**
 * Deterministic opportunity research for every storefront of each market. Reads stored data
 * only. Stores are loaded per market so cross-store confirmation compares the same cohort on the
 * other store; each storefront is persisted as its own run.
 */
export async function runResearch(
  store: ResearchStore,
  options: {
    countries: readonly string[];
    stores: readonly StoreId[];
    taxonomyVersion: string;
    asOf: Date;
    config?: OpportunityScoreConfig;
  },
): Promise<ResearchSummary> {
  const config = options.config ?? OPPORTUNITY_SCORE_V1;
  const summary: ResearchSummary = { formulaVersion: config.version, storefronts: [], errorCount: 0, errorSample: null };
  const errors: string[] = [];

  for (const country of options.countries) {
    let storefronts: OpportunityStorefront[];
    try {
      const health = await store.loadHealth(country);
      storefronts = await Promise.all(
        options.stores.map(async (storeId) =>
          toStorefront({
            store: storeId,
            country,
            candidates: await store.loadCandidates(storeId, country, options.asOf),
            membership: await store.loadMembership(storeId, country),
            health,
            asOf: options.asOf,
          }),
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${country}: ${message}`);
      for (const storeId of options.stores) {
        await store
          .recordFailure({
            formulaVersion: config.version,
            taxonomyVersion: options.taxonomyVersion,
            store: storeId,
            country,
            windowDays: WINDOW_DAYS,
            asOf: options.asOf,
            trackedGames: 0,
            historyDays: null,
            freshness: "never",
            errorSample: message.slice(0, ERROR_SAMPLE_MAX_LENGTH),
          })
          .catch((recordError: unknown) => {
            errors.push(`${storeId}:${country} failure record: ${recordError instanceof Error ? recordError.message : "Unknown error"}`);
          });
      }
      continue;
    }

    const results = scoreOpportunities(storefronts, { asOf: options.asOf, config });
    for (const [index, storeId] of options.stores.entries()) {
      const storefront = storefronts[index];
      if (!storefront) continue;
      const ofStorefront = results.filter((r) => r.store === storeId && r.country === country);
      const rows = ofStorefront.map(toOpportunityRow);
      try {
        const written = await store.record({
          run: {
            formulaVersion: config.version,
            taxonomyVersion: options.taxonomyVersion,
            store: storeId,
            country,
            windowDays: WINDOW_DAYS,
            asOf: options.asOf,
            inputHash: resultHash(rows),
            trackedGames: storefront.games.length,
            historyDays: storefront.historyDays,
            freshness: storefront.freshness,
          },
          opportunities: rows,
        });
        summary.storefronts.push({
          store: storeId,
          country,
          trackedGames: storefront.games.length,
          cohortsEvaluated: rows.length,
          opportunitiesScored: rows.filter((r) => r.score !== null).length,
          created: written.created,
          topOpportunities: ofStorefront
            .filter((r) => r.score !== null)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .slice(0, 3)
            .map((r) => `${r.key} ${Math.round(r.score ?? 0)} (${r.confidence.band})`),
        });
      } catch (error) {
        errors.push(`${storeId}:${country}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
  }

  summary.errorCount = errors.length;
  summary.errorSample = errors.length > 0 ? errors.join("; ").slice(0, ERROR_SAMPLE_MAX_LENGTH) : null;
  return summary;
}

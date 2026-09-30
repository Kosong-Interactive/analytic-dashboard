import { createHash } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  steamApps,
  steamChartEntries,
  steamCollectorRuns,
  steamPrices,
  steamSnapshots,
} from "../schema/index";
import type { CollectorRunFinalStatus } from "./collector-runs";
import type { DatabaseExecutor } from "./executor";
import { SNAPSHOT_HEARTBEAT_MS } from "./snapshot-policy";

/** Structural Steam listing, kept independent of the collector package. */
export interface PersistableSteamListing {
  externalId: string;
  title: string;
  description: string | null;
  developerNames: string[];
  publisherNames: string[];
  genres: string[];
  categories: string[];
  tags: string[];
  releaseState: "released" | "early_access" | "upcoming" | "unknown";
  releaseDate: string | null;
  supportedOperatingSystems: { windows: boolean; macos: boolean; linux: boolean };
  isFree: boolean;
  headerImageUrl: string | null;
  storeUrl: string;
  source: string;
  capturedAt: string;
}

export interface SteamReviewTotals {
  capturedAt: string;
  purchaseScope: string;
  languageScope: string[];
  offTopicActivityFiltered: boolean;
  positive: number;
  negative: number;
  total: number;
}

export interface SteamSnapshotInput {
  steamAppId: string;
  capturedAt: Date;
  reviews: SteamReviewTotals | null;
  players: { capturedAt: string; currentPlayers: number } | null;
}

export interface SteamChartEntryInput {
  steamAppId: string;
  chart: "top_sellers" | "most_played" | "steam_deck";
  rank: number;
  lastWeekRank: number | null;
  capturedAt: Date;
}

export interface SteamPriceInput {
  steamAppId: string;
  country: string;
  currency: string;
  initialPrice: number;
  finalPrice: number;
  discountPercent: number;
  capturedAt: Date;
}

export interface PersistSteamAppsResult {
  /** `externalId` → `steam_apps.id`. */
  ids: Map<string, string>;
  created: number;
  metadataChanged: number;
}

/** Hash of the listing fields that describe the game; volatile capture times are excluded. */
export function steamMetadataHash(listing: PersistableSteamListing): string {
  const { capturedAt: _capturedAt, ...described } = listing;
  return createHash("sha256").update(JSON.stringify(described)).digest("hex");
}

/**
 * Upserts listings by Steam App ID. Metadata is rewritten only when its hash changes; every
 * observed listing has `last_seen_at` moved forward. Safe to rerun.
 */
export async function persistSteamApps(
  db: DatabaseExecutor,
  listings: readonly PersistableSteamListing[],
): Promise<PersistSteamAppsResult> {
  const unique = [...new Map(listings.map((listing) => [listing.externalId, listing])).values()];
  if (unique.length === 0) return { ids: new Map(), created: 0, metadataChanged: 0 };

  const existing = await db
    .select({ externalId: steamApps.externalId, metadataHash: steamApps.metadataHash })
    .from(steamApps)
    .where(inArray(steamApps.externalId, unique.map((listing) => listing.externalId)));
  const previousHash = new Map(existing.map((row) => [row.externalId, row.metadataHash]));

  const rows = await db
    .insert(steamApps)
    .values(
      unique.map((listing) => {
        const seenAt = new Date(listing.capturedAt);
        return {
          externalId: listing.externalId,
          title: listing.title,
          description: listing.description,
          developerNames: listing.developerNames,
          publisherNames: listing.publisherNames,
          genres: listing.genres,
          categories: listing.categories,
          tags: listing.tags,
          releaseState: listing.releaseState,
          releaseDate: listing.releaseDate ? new Date(listing.releaseDate) : null,
          supportsWindows: listing.supportedOperatingSystems.windows,
          supportsMacos: listing.supportedOperatingSystems.macos,
          supportsLinux: listing.supportedOperatingSystems.linux,
          isFree: listing.isFree,
          headerImageUrl: listing.headerImageUrl,
          storeUrl: listing.storeUrl,
          source: listing.source,
          metadataHash: steamMetadataHash(listing),
          firstSeenAt: seenAt,
          lastSeenAt: seenAt,
        };
      }),
    )
    .onConflictDoUpdate({
      target: steamApps.externalId,
      set: {
        title: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.title} else excluded.title end`,
        description: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.description} else excluded.description end`,
        developerNames: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.developerNames} else excluded.developer_names end`,
        publisherNames: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.publisherNames} else excluded.publisher_names end`,
        genres: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.genres} else excluded.genres end`,
        categories: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.categories} else excluded.categories end`,
        tags: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.tags} else excluded.tags end`,
        releaseState: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.releaseState} else excluded.release_state end`,
        releaseDate: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.releaseDate} else excluded.release_date end`,
        supportsWindows: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.supportsWindows} else excluded.supports_windows end`,
        supportsMacos: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.supportsMacos} else excluded.supports_macos end`,
        supportsLinux: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.supportsLinux} else excluded.supports_linux end`,
        isFree: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.isFree} else excluded.is_free end`,
        headerImageUrl: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.headerImageUrl} else excluded.header_image_url end`,
        storeUrl: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.storeUrl} else excluded.store_url end`,
        source: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.source} else excluded.source end`,
        updatedAt: sql`case when ${steamApps.metadataHash} = excluded.metadata_hash then ${steamApps.updatedAt} else now() end`,
        metadataHash: sql`excluded.metadata_hash`,
        lastSeenAt: sql`greatest(${steamApps.lastSeenAt}, excluded.last_seen_at)`,
      },
    })
    .returning({ id: steamApps.id, externalId: steamApps.externalId, metadataHash: steamApps.metadataHash });

  return {
    ids: new Map(rows.map((row) => [row.externalId, row.id])),
    created: rows.filter((row) => !previousHash.has(row.externalId)).length,
    metadataChanged: rows.filter((row) => {
      const before = previousHash.get(row.externalId);
      return before !== undefined && before !== row.metadataHash;
    }).length,
  };
}

type SnapshotDecision = "first" | "changed" | "heartbeat" | "unchanged" | "stale";

/** Review totals or player count changing (including gaining or losing a value) counts as a change. */
export function decideSteamSnapshotWrite(
  latest: { capturedAt: Date; reviewPositive: number | null; reviewNegative: number | null; currentPlayers: number | null } | null,
  incoming: SteamSnapshotInput,
  heartbeatMs: number = SNAPSHOT_HEARTBEAT_MS,
): SnapshotDecision {
  if (!latest) return "first";
  const elapsed = incoming.capturedAt.getTime() - latest.capturedAt.getTime();
  if (elapsed <= 0) return "stale";
  const changed =
    latest.reviewPositive !== (incoming.reviews?.positive ?? null) ||
    latest.reviewNegative !== (incoming.reviews?.negative ?? null) ||
    latest.currentPlayers !== (incoming.players?.currentPlayers ?? null);
  if (changed) return "changed";
  return elapsed >= heartbeatMs ? "heartbeat" : "unchanged";
}

/** Change-only review/player snapshots. Returns how many rows were written. */
export async function persistSteamSnapshots(
  db: DatabaseExecutor,
  inputs: readonly SteamSnapshotInput[],
): Promise<{ written: number; skipped: number }> {
  const withSignal = inputs.filter((input) => input.reviews !== null || input.players !== null);
  if (withSignal.length === 0) return { written: 0, skipped: inputs.length };

  const latest = await db
    .selectDistinctOn([steamSnapshots.steamAppId], {
      steamAppId: steamSnapshots.steamAppId,
      capturedAt: steamSnapshots.capturedAt,
      reviewPositive: steamSnapshots.reviewPositive,
      reviewNegative: steamSnapshots.reviewNegative,
      currentPlayers: steamSnapshots.currentPlayers,
    })
    .from(steamSnapshots)
    .where(inArray(steamSnapshots.steamAppId, [...new Set(withSignal.map((input) => input.steamAppId))]))
    .orderBy(steamSnapshots.steamAppId, desc(steamSnapshots.capturedAt));
  const latestById = new Map(latest.map((row) => [row.steamAppId, row]));

  const toWrite = withSignal.filter((input) => {
    const decision = decideSteamSnapshotWrite(latestById.get(input.steamAppId) ?? null, input);
    return decision === "first" || decision === "changed" || decision === "heartbeat";
  });
  if (toWrite.length === 0) return { written: 0, skipped: inputs.length };

  const written = await db
    .insert(steamSnapshots)
    .values(
      toWrite.map((input) => ({
        steamAppId: input.steamAppId,
        capturedAt: input.capturedAt,
        reviewPositive: input.reviews?.positive ?? null,
        reviewNegative: input.reviews?.negative ?? null,
        reviewTotal: input.reviews?.total ?? null,
        reviewsCapturedAt: input.reviews ? new Date(input.reviews.capturedAt) : null,
        reviewPurchaseScope: input.reviews?.purchaseScope ?? null,
        reviewLanguageScope: input.reviews?.languageScope ?? null,
        reviewOffTopicFiltered: input.reviews?.offTopicActivityFiltered ?? null,
        currentPlayers: input.players?.currentPlayers ?? null,
        playersCapturedAt: input.players ? new Date(input.players.capturedAt) : null,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: steamSnapshots.id });
  return { written: written.length, skipped: inputs.length - written.length };
}

export async function persistSteamChartEntries(
  db: DatabaseExecutor,
  entries: readonly SteamChartEntryInput[],
): Promise<number> {
  if (entries.length === 0) return 0;
  const written = await db
    .insert(steamChartEntries)
    .values(entries.map((entry) => ({ ...entry })))
    .onConflictDoNothing()
    .returning({ id: steamChartEntries.id });
  return written.length;
}

/** Change-only regional prices per app and country, with the daily heartbeat. */
export async function persistSteamPrices(
  db: DatabaseExecutor,
  prices: readonly SteamPriceInput[],
): Promise<{ written: number; skipped: number }> {
  if (prices.length === 0) return { written: 0, skipped: 0 };

  const latest = await db
    .selectDistinctOn([steamPrices.steamAppId, steamPrices.country], {
      steamAppId: steamPrices.steamAppId,
      country: steamPrices.country,
      currency: steamPrices.currency,
      initialPrice: steamPrices.initialPrice,
      finalPrice: steamPrices.finalPrice,
      discountPercent: steamPrices.discountPercent,
      capturedAt: steamPrices.capturedAt,
    })
    .from(steamPrices)
    .where(inArray(steamPrices.steamAppId, [...new Set(prices.map((price) => price.steamAppId))]))
    .orderBy(steamPrices.steamAppId, steamPrices.country, desc(steamPrices.capturedAt));
  const latestByKey = new Map(latest.map((row) => [`${row.steamAppId}:${row.country}`, row]));

  const toWrite = prices.filter((price) => {
    const previous = latestByKey.get(`${price.steamAppId}:${price.country}`);
    if (!previous) return true;
    const elapsed = price.capturedAt.getTime() - previous.capturedAt.getTime();
    if (elapsed <= 0) return false;
    const changed =
      previous.currency !== price.currency ||
      Number(previous.initialPrice) !== round2(price.initialPrice) ||
      Number(previous.finalPrice) !== round2(price.finalPrice) ||
      previous.discountPercent !== price.discountPercent;
    return changed || elapsed >= SNAPSHOT_HEARTBEAT_MS;
  });
  if (toWrite.length === 0) return { written: 0, skipped: prices.length };

  const written = await db
    .insert(steamPrices)
    .values(
      toWrite.map((price) => ({
        steamAppId: price.steamAppId,
        country: price.country,
        currency: price.currency,
        initialPrice: round2(price.initialPrice).toFixed(2),
        finalPrice: round2(price.finalPrice).toFixed(2),
        discountPercent: price.discountPercent,
        capturedAt: price.capturedAt,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: steamPrices.id });
  return { written: written.length, skipped: prices.length - written.length };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function startSteamCollectorRun(
  db: DatabaseExecutor,
  input: { jobType: string; startedAt: Date; metadata?: Record<string, unknown> },
): Promise<string> {
  const [run] = await db
    .insert(steamCollectorRuns)
    .values({ jobType: input.jobType, startedAt: input.startedAt, metadata: input.metadata ?? {} })
    .returning({ id: steamCollectorRuns.id });
  if (!run) throw new Error("Steam collector run was not created");
  return run.id;
}

/** Finishes a run once; a second call is a no-op and returns false. */
export async function finishSteamCollectorRun(
  db: DatabaseExecutor,
  runId: string,
  input: {
    status: CollectorRunFinalStatus;
    finishedAt: Date;
    discoveredCount: number;
    changedCount: number;
    retryCount: number;
    errorCount: number;
    errorSample: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<boolean> {
  const updated = await db
    .update(steamCollectorRuns)
    .set({
      status: input.status,
      finishedAt: input.finishedAt,
      discoveredCount: input.discoveredCount,
      changedCount: input.changedCount,
      retryCount: input.retryCount,
      errorCount: input.errorCount,
      errorSample: input.errorSample,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    })
    .where(and(eq(steamCollectorRuns.id, runId), eq(steamCollectorRuns.status, "running")))
    .returning({ id: steamCollectorRuns.id });
  return updated.length === 1;
}

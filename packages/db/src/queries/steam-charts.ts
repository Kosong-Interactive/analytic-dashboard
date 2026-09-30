import { and, asc, desc, eq, inArray, max } from "drizzle-orm";

import { steamApps, steamChartEntries, steamPrices, steamSnapshots } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";

export type SteamChartName = "most_played" | "top_sellers";

export interface SteamLatestSnapshot {
  capturedAt: Date;
  reviewPositive: number | null;
  reviewNegative: number | null;
  reviewTotal: number | null;
  reviewsCapturedAt: Date | null;
  currentPlayers: number | null;
  playersCapturedAt: Date | null;
}

export interface SteamRegionalPrice {
  country: string;
  currency: string;
  initialPrice: number;
  finalPrice: number;
  discountPercent: number;
  capturedAt: Date;
}

export interface SteamGameSummary {
  steamAppId: string;
  externalId: string;
  title: string;
  headerImageUrl: string | null;
  isFree: boolean;
  releaseState: string;
  releaseDate: Date | null;
  /** Null when Steam has no reading yet; never coerced to zero. */
  snapshot: SteamLatestSnapshot | null;
  /** Latest price per storefront country, keyed by lowercase country code. */
  prices: Record<string, SteamRegionalPrice>;
}

export interface SteamChartRow extends SteamGameSummary {
  rank: number;
  lastWeekRank: number | null;
}

export interface SteamChartView {
  chart: SteamChartName;
  /** Capture time of the newest run of this chart; null when it was never collected. */
  capturedAt: Date | null;
  rows: SteamChartRow[];
}

const PRICE_COUNTRIES = ["id", "us"];

/** Latest reading per game; `null` means every tracked game. */
export async function loadLatestSteamSnapshots(db: DatabaseExecutor, appIds: string[] | null) {
  if (appIds !== null && appIds.length === 0) return new Map<string, SteamLatestSnapshot>();
  const rows = await db
    .selectDistinctOn([steamSnapshots.steamAppId], {
      steamAppId: steamSnapshots.steamAppId,
      capturedAt: steamSnapshots.capturedAt,
      reviewPositive: steamSnapshots.reviewPositive,
      reviewNegative: steamSnapshots.reviewNegative,
      reviewTotal: steamSnapshots.reviewTotal,
      reviewsCapturedAt: steamSnapshots.reviewsCapturedAt,
      currentPlayers: steamSnapshots.currentPlayers,
      playersCapturedAt: steamSnapshots.playersCapturedAt,
    })
    .from(steamSnapshots)
    .where(appIds === null ? undefined : inArray(steamSnapshots.steamAppId, appIds))
    .orderBy(steamSnapshots.steamAppId, desc(steamSnapshots.capturedAt));
  return new Map(rows.map(({ steamAppId, ...snapshot }) => [steamAppId, snapshot]));
}

async function loadLatestPrices(db: DatabaseExecutor, appIds: string[]) {
  const byApp = new Map<string, Record<string, SteamRegionalPrice>>();
  if (appIds.length === 0) return byApp;
  const rows = await db
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
    .where(and(inArray(steamPrices.steamAppId, appIds), inArray(steamPrices.country, PRICE_COUNTRIES)))
    .orderBy(steamPrices.steamAppId, steamPrices.country, desc(steamPrices.capturedAt));
  for (const row of rows) {
    const prices = byApp.get(row.steamAppId) ?? {};
    prices[row.country] = {
      country: row.country,
      currency: row.currency,
      initialPrice: Number(row.initialPrice),
      finalPrice: Number(row.finalPrice),
      discountPercent: row.discountPercent,
      capturedAt: row.capturedAt,
    };
    byApp.set(row.steamAppId, prices);
  }
  return byApp;
}

/** The newest capture of one Steam chart with each game's latest reviews, players, and ID/US prices. */
export async function loadSteamChart(db: DatabaseExecutor, chart: SteamChartName): Promise<SteamChartView> {
  const [latest] = await db
    .select({ capturedAt: max(steamChartEntries.capturedAt) })
    .from(steamChartEntries)
    .where(eq(steamChartEntries.chart, chart));
  const capturedAt = latest?.capturedAt ?? null;
  if (!capturedAt) return { chart, capturedAt: null, rows: [] };

  const entries = await db
    .select({
      rank: steamChartEntries.rank,
      lastWeekRank: steamChartEntries.lastWeekRank,
      steamAppId: steamApps.id,
      externalId: steamApps.externalId,
      title: steamApps.title,
      headerImageUrl: steamApps.headerImageUrl,
      isFree: steamApps.isFree,
      releaseState: steamApps.releaseState,
      releaseDate: steamApps.releaseDate,
    })
    .from(steamChartEntries)
    .innerJoin(steamApps, eq(steamApps.id, steamChartEntries.steamAppId))
    .where(and(eq(steamChartEntries.chart, chart), eq(steamChartEntries.capturedAt, capturedAt)))
    .orderBy(asc(steamChartEntries.rank));

  const appIds = entries.map((entry) => entry.steamAppId);
  const [snapshots, prices] = await Promise.all([loadLatestSteamSnapshots(db, appIds), loadLatestPrices(db, appIds)]);

  return {
    chart,
    capturedAt,
    rows: entries.map((entry) => ({
      ...entry,
      snapshot: snapshots.get(entry.steamAppId) ?? null,
      prices: prices.get(entry.steamAppId) ?? {},
    })),
  };
}

export interface SteamGameDetail extends SteamGameSummary {
  description: string | null;
  developerNames: string[];
  publisherNames: string[];
  genres: string[];
  categories: string[];
  tags: string[];
  supportsWindows: boolean;
  supportsMacos: boolean;
  supportsLinux: boolean;
  storeUrl: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Oldest first. Snapshots are stored on change, so a gap means "unchanged". */
  snapshots: Array<SteamLatestSnapshot>;
  /** Oldest first. */
  ranks: Array<{ chart: string; rank: number; capturedAt: Date }>;
}

/** Everything the Steam game page shows, in a constant number of queries. */
export async function loadSteamGameDetail(
  db: DatabaseExecutor,
  externalId: string,
  since: Date,
): Promise<SteamGameDetail | null> {
  const [app] = await db.select().from(steamApps).where(eq(steamApps.externalId, externalId)).limit(1);
  if (!app) return null;

  const [latestSnapshots, prices, history, ranks] = await Promise.all([
    loadLatestSteamSnapshots(db, [app.id]),
    loadLatestPrices(db, [app.id]),
    db
      .select({
        capturedAt: steamSnapshots.capturedAt,
        reviewPositive: steamSnapshots.reviewPositive,
        reviewNegative: steamSnapshots.reviewNegative,
        reviewTotal: steamSnapshots.reviewTotal,
        reviewsCapturedAt: steamSnapshots.reviewsCapturedAt,
        currentPlayers: steamSnapshots.currentPlayers,
        playersCapturedAt: steamSnapshots.playersCapturedAt,
      })
      .from(steamSnapshots)
      .where(eq(steamSnapshots.steamAppId, app.id))
      .orderBy(asc(steamSnapshots.capturedAt)),
    db
      .select({ chart: steamChartEntries.chart, rank: steamChartEntries.rank, capturedAt: steamChartEntries.capturedAt })
      .from(steamChartEntries)
      .where(eq(steamChartEntries.steamAppId, app.id))
      .orderBy(asc(steamChartEntries.capturedAt)),
  ]);

  return {
    steamAppId: app.id,
    externalId: app.externalId,
    title: app.title,
    headerImageUrl: app.headerImageUrl,
    isFree: app.isFree,
    releaseState: app.releaseState,
    releaseDate: app.releaseDate,
    description: app.description,
    developerNames: app.developerNames,
    publisherNames: app.publisherNames,
    genres: app.genres,
    categories: app.categories,
    tags: app.tags,
    supportsWindows: app.supportsWindows,
    supportsMacos: app.supportsMacos,
    supportsLinux: app.supportsLinux,
    storeUrl: app.storeUrl,
    firstSeenAt: app.firstSeenAt,
    lastSeenAt: app.lastSeenAt,
    snapshot: latestSnapshots.get(app.id) ?? null,
    prices: prices.get(app.id) ?? {},
    snapshots: history.filter((row) => row.capturedAt >= since),
    ranks: ranks.filter((row) => row.capturedAt >= since),
  };
}

import { and, eq, max } from "drizzle-orm";

import { steamApps, steamChartEntries } from "../schema/index";
import type { DatabaseExecutor } from "../repositories/executor";
import {
  loadLatestSteamPrices,
  loadLatestSteamSnapshots,
  type SteamChartName,
  type SteamLatestSnapshot,
  type SteamRegionalPrice,
} from "./steam-charts";

export interface SteamChartPosition {
  rank: number;
  lastWeekRank: number | null;
}

export interface SteamGameListRow {
  steamAppId: string;
  externalId: string;
  title: string;
  headerImageUrl: string | null;
  isFree: boolean;
  releaseState: string;
  releaseDate: Date | null;
  tags: string[];
  firstSeenAt: Date;
  /** Null when Steam has no reading yet; never coerced to zero. */
  snapshot: SteamLatestSnapshot | null;
  /** Latest price per storefront country, keyed by lowercase country code. */
  prices: Record<string, SteamRegionalPrice>;
  /** Position in the newest capture of each chart; null when the game is not in it. */
  charts: Record<SteamChartName, SteamChartPosition | null>;
}

export interface SteamGameList {
  games: SteamGameListRow[];
  /** Capture time of the newest run of each chart, null when never collected. */
  chartCapturedAt: Record<SteamChartName, Date | null>;
}

const CHARTS: SteamChartName[] = ["most_played", "top_sellers"];

/**
 * Every tracked Steam game with its latest reading, prices, and chart positions, in a constant
 * number of queries. Filtering, sorting, and paging happen in the view-model.
 */
export async function loadSteamGameList(db: DatabaseExecutor): Promise<SteamGameList> {
  const [apps, snapshots, prices, captures] = await Promise.all([
    db
      .select({
        steamAppId: steamApps.id,
        externalId: steamApps.externalId,
        title: steamApps.title,
        headerImageUrl: steamApps.headerImageUrl,
        isFree: steamApps.isFree,
        releaseState: steamApps.releaseState,
        releaseDate: steamApps.releaseDate,
        tags: steamApps.tags,
        firstSeenAt: steamApps.firstSeenAt,
      })
      .from(steamApps),
    loadLatestSteamSnapshots(db, null),
    loadLatestSteamPrices(db, null),
    Promise.all(
      CHARTS.map((chart) =>
        db
          .select({ capturedAt: max(steamChartEntries.capturedAt) })
          .from(steamChartEntries)
          .where(eq(steamChartEntries.chart, chart)),
      ),
    ),
  ]);

  const chartCapturedAt: SteamGameList["chartCapturedAt"] = { most_played: null, top_sellers: null };
  const positions = new Map<string, Record<SteamChartName, SteamChartPosition | null>>();
  await Promise.all(
    CHARTS.map(async (chart, index) => {
      const capturedAt = captures[index]?.[0]?.capturedAt ?? null;
      chartCapturedAt[chart] = capturedAt;
      if (!capturedAt) return;
      const entries = await db
        .select({
          steamAppId: steamChartEntries.steamAppId,
          rank: steamChartEntries.rank,
          lastWeekRank: steamChartEntries.lastWeekRank,
        })
        .from(steamChartEntries)
        .where(and(eq(steamChartEntries.chart, chart), eq(steamChartEntries.capturedAt, capturedAt)));
      for (const entry of entries) {
        const current = positions.get(entry.steamAppId) ?? { most_played: null, top_sellers: null };
        current[chart] = { rank: entry.rank, lastWeekRank: entry.lastWeekRank };
        positions.set(entry.steamAppId, current);
      }
    }),
  );

  return {
    chartCapturedAt,
    games: apps.map((app) => ({
      ...app,
      snapshot: snapshots.get(app.steamAppId) ?? null,
      prices: prices.get(app.steamAppId) ?? {},
      charts: positions.get(app.steamAppId) ?? { most_played: null, top_sellers: null },
    })),
  };
}

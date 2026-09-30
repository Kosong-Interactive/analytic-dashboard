import { and, asc, desc, eq, gte, inArray, max, or, sql } from "drizzle-orm";

import {
  steamApps,
  steamAppLabels,
  steamChartEntries,
  steamClassificationRuns,
  taxonomyLabels,
} from "../schema/index";
import type { LabelType } from "../repositories/classification";
import type { DatabaseExecutor } from "../repositories/executor";
import { loadLatestSteamSnapshots, type SteamLatestSnapshot } from "./steam-charts";

export interface SteamLabelMembershipQuery {
  taxonomyVersion: string;
  types: readonly LabelType[];
  /** Automated labels below this confidence count as not assigned. Manual labels always count. */
  minConfidence: number;
}

export interface SteamLabelMembershipRow {
  steamAppId: string;
  type: LabelType;
  slug: string;
  displayName: string;
  confidence: number;
  source: "rule" | "ai" | "manual";
}

const SOURCE_PRIORITY = { manual: 3, ai: 2, rule: 1 } as const;

/**
 * Which Steam games carry which labels: one row per (game, label), manual over AI over rule, then
 * the most confident. A manual rejection removes the label, and a game the AI has classified
 * ignores its rule labels, exactly as for mobile.
 */
export async function loadSteamLabelMembership(
  db: DatabaseExecutor,
  query: SteamLabelMembershipQuery,
): Promise<SteamLabelMembershipRow[]> {
  if (query.types.length === 0) return [];

  const rows = await db
    .select({
      steamAppId: steamAppLabels.steamAppId,
      labelId: taxonomyLabels.id,
      type: taxonomyLabels.type,
      slug: taxonomyLabels.slug,
      displayName: taxonomyLabels.displayName,
      confidence: steamAppLabels.confidence,
      source: steamAppLabels.source,
    })
    .from(steamAppLabels)
    .innerJoin(taxonomyLabels, eq(taxonomyLabels.id, steamAppLabels.labelId))
    .where(
      and(
        eq(steamAppLabels.taxonomyVersion, query.taxonomyVersion),
        eq(taxonomyLabels.isActive, true),
        inArray(taxonomyLabels.type, [...query.types]),
        or(eq(steamAppLabels.source, "manual"), gte(steamAppLabels.confidence, query.minConfidence.toFixed(3))),
        sql`not (${steamAppLabels.source} = 'rule' and exists (
          select 1 from ${steamClassificationRuns}
          where ${steamClassificationRuns.steamAppId} = ${steamAppLabels.steamAppId}
            and ${steamClassificationRuns.source} = 'ai'
            and ${steamClassificationRuns.taxonomyVersion} = ${steamAppLabels.taxonomyVersion}
        ))`,
      ),
    );

  const best = new Map<string, SteamLabelMembershipRow>();
  for (const row of rows) {
    const candidate: SteamLabelMembershipRow = {
      steamAppId: row.steamAppId,
      type: row.type,
      slug: row.slug,
      displayName: row.displayName,
      confidence: Number(row.confidence),
      source: row.source,
    };
    const key = `${row.steamAppId}:${row.labelId}`;
    const current = best.get(key);
    if (
      !current ||
      SOURCE_PRIORITY[candidate.source] > SOURCE_PRIORITY[current.source] ||
      (candidate.source === current.source && candidate.confidence > current.confidence)
    ) {
      best.set(key, candidate);
    }
  }
  return [...best.values()].filter((row) => !(row.source === "manual" && row.confidence === 0));
}

export interface SteamLabelGame {
  steamAppId: string;
  externalId: string;
  title: string;
  headerImageUrl: string | null;
  snapshot: SteamLatestSnapshot | null;
  /** Rank in the newest Most Played chart, or null when the game is not in it. */
  mostPlayedRank: number | null;
}

/** Every tracked Steam game with its latest reading, the base set label statistics are computed over. */
export async function loadSteamLabelGames(db: DatabaseExecutor): Promise<SteamLabelGame[]> {
  const [apps, snapshots, [latest]] = await Promise.all([
    db
      .select({
        steamAppId: steamApps.id,
        externalId: steamApps.externalId,
        title: steamApps.title,
        headerImageUrl: steamApps.headerImageUrl,
      })
      .from(steamApps),
    loadLatestSteamSnapshots(db, null),
    db.select({ capturedAt: max(steamChartEntries.capturedAt) }).from(steamChartEntries).where(eq(steamChartEntries.chart, "most_played")),
  ]);

  const ranks = new Map<string, number>();
  if (latest?.capturedAt) {
    const entries = await db
      .select({ steamAppId: steamChartEntries.steamAppId, rank: steamChartEntries.rank })
      .from(steamChartEntries)
      .where(and(eq(steamChartEntries.chart, "most_played"), eq(steamChartEntries.capturedAt, latest.capturedAt)));
    for (const entry of entries) ranks.set(entry.steamAppId, entry.rank);
  }

  return apps.map((app) => ({
    ...app,
    snapshot: snapshots.get(app.steamAppId) ?? null,
    mostPlayedRank: ranks.get(app.steamAppId) ?? null,
  }));
}

export interface SteamListingLabelRow {
  labelId: string;
  type: LabelType;
  slug: string;
  displayName: string;
  source: "rule" | "ai" | "manual";
  confidence: number;
  evidence: unknown;
  /** Rules or prompt version that produced the label; "none" for manual ones. */
  version: string;
  model: string | null;
}

/** Every label of one Steam game with full provenance. Rule labels an AI result replaced are left out. */
export async function loadSteamGameLabels(
  db: DatabaseExecutor,
  query: { steamAppId: string; taxonomyVersion: string },
): Promise<SteamListingLabelRow[]> {
  const rows = await db
    .select({
      labelId: taxonomyLabels.id,
      type: taxonomyLabels.type,
      slug: taxonomyLabels.slug,
      displayName: taxonomyLabels.displayName,
      source: steamAppLabels.source,
      confidence: steamAppLabels.confidence,
      evidence: steamAppLabels.evidence,
      version: steamAppLabels.promptVersion,
      model: steamAppLabels.model,
    })
    .from(steamAppLabels)
    .innerJoin(taxonomyLabels, eq(taxonomyLabels.id, steamAppLabels.labelId))
    .where(
      and(
        eq(steamAppLabels.steamAppId, query.steamAppId),
        eq(steamAppLabels.taxonomyVersion, query.taxonomyVersion),
        sql`not (${steamAppLabels.source} = 'rule' and exists (
          select 1 from ${steamClassificationRuns}
          where ${steamClassificationRuns.steamAppId} = ${steamAppLabels.steamAppId}
            and ${steamClassificationRuns.source} = 'ai'
            and ${steamClassificationRuns.taxonomyVersion} = ${steamAppLabels.taxonomyVersion}
        ))`,
      ),
    )
    .orderBy(asc(taxonomyLabels.type), desc(steamAppLabels.confidence), asc(taxonomyLabels.slug));
  return rows.map((row) => ({ ...row, confidence: Number(row.confidence) }));
}

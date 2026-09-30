import "server-only";

import { loadSteamChart, loadSteamGameDetail, loadSteamSourceHealth } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { toSteamSourceStatus } from "../overview/view-model";
import type { SteamQuery } from "./query";

export async function getSteamChart(query: SteamQuery, asOf: Date = new Date()) {
  const db = getDatabase();
  const [chart, health] = await Promise.all([loadSteamChart(db, query.chart), loadSteamSourceHealth(db)]);
  return { chart, source: toSteamSourceStatus(health, asOf), asOf };
}

const HISTORY_DAYS = 30;

export async function getSteamGame(externalId: string, asOf: Date = new Date()) {
  const db = getDatabase();
  const since = new Date(asOf.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const [game, health] = await Promise.all([
    loadSteamGameDetail(db, externalId, since),
    loadSteamSourceHealth(db),
  ]);
  return game ? { game, source: toSteamSourceStatus(health, asOf), asOf } : null;
}

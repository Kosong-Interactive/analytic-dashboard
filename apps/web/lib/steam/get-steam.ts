import "server-only";

import {
  loadSteamChart,
  loadSteamGameDetail,
  loadSteamGameLabels,
  loadSteamGameList,
  loadSteamLabelMembership,
  loadSteamSourceHealth,
} from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { MIN_LABEL_CONFIDENCE, TAXONOMY_VERSION } from "../labels/constants";
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
  if (!game) return null;
  const labels = await loadSteamGameLabels(db, { steamAppId: game.steamAppId, taxonomyVersion: TAXONOMY_VERSION });
  return { game, labels, source: toSteamSourceStatus(health, asOf), asOf };
}

/** All tracked Steam games with labels, for Games, New Releases, Overview, and Trending. */
export async function getSteamGameCatalog(country: SteamQuery["country"], asOf: Date = new Date()) {
  const db = getDatabase();
  const [list, membership, health] = await Promise.all([
    loadSteamGameList(db),
    loadSteamLabelMembership(db, {
      taxonomyVersion: TAXONOMY_VERSION,
      types: ["genre", "subgenre", "core_mechanic", "meta_mechanic", "theme", "multiplayer_mode"],
      minConfidence: MIN_LABEL_CONFIDENCE,
    }),
    loadSteamSourceHealth(db),
  ]);
  return { ...list, membership, country, source: toSteamSourceStatus(health, asOf), asOf };
}

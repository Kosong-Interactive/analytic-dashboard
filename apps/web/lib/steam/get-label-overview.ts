import "server-only";

import { loadSteamLabelGames, loadSteamLabelMembership, loadSteamSourceHealth, type LabelType } from "@analytic-dashboard/db";

import { getDatabase } from "../database";
import { MIN_LABEL_CONFIDENCE, STEAM_TAXONOMY_VERSION } from "../labels/constants";
import { toSteamSourceStatus } from "../overview/view-model";
import { buildSteamLabelOverview } from "./label-overview";
import type { SteamLabelQuery } from "./label-query";

export async function getSteamLabelOverview<T extends LabelType>(query: SteamLabelQuery<T>, asOf: Date = new Date()) {
  const db = getDatabase();
  const [games, membership, health] = await Promise.all([
    loadSteamLabelGames(db),
    loadSteamLabelMembership(db, {
      taxonomyVersion: STEAM_TAXONOMY_VERSION,
      types: [query.type],
      minConfidence: MIN_LABEL_CONFIDENCE,
    }),
    loadSteamSourceHealth(db),
  ]);
  return {
    asOf,
    source: toSteamSourceStatus(health, asOf),
    ...buildSteamLabelOverview({ games, membership, sort: query.sort }),
  };
}

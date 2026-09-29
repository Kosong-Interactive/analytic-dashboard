import "server-only";

import { loadGameHistory } from "@analytic-dashboard/db";
import { countryCodeSchema } from "@analytic-dashboard/shared";
import { z } from "zod";

import { getDatabase } from "../database";
import { loadScoredSelection } from "../scoring/load-scored";
import { buildGameDetail, HISTORY_DAYS, type GameDetailView } from "./view-model";

const RANK_CHART = "TOP_FREE";
export const gameIdSchema = z.uuid();

/** `null` when the id is malformed or unknown, so the page can answer 404. Reads only. */
export async function getGameDetail(
  rawId: string,
  asOf: Date = new Date(),
): Promise<GameDetailView | null> {
  const id = gameIdSchema.safeParse(rawId);
  if (!id.success) return null;

  const since = new Date(asOf.getTime() - HISTORY_DAYS * 86_400_000);
  const history = await loadGameHistory(getDatabase(), { storeAppId: id.data, since });
  if (!history) return null;

  // The score is relative to the game's cohort, so the cohort is scored as a whole.
  const country = countryCodeSchema.safeParse(history.listing.country);
  const score = country.success
    ? (
        await loadScoredSelection(
          { country: country.data, platform: history.listing.store },
          asOf,
        )
      ).scores.find((row) => row.id === id.data)
    : undefined;

  return buildGameDetail({ history, score, rankChartType: RANK_CHART, asOf });
}

import "server-only";

import {
  clearSteamManualLabel,
  findSteamAppId,
  loadTaxonomyLabels,
  setSteamManualLabel,
} from "@analytic-dashboard/db";

import { getCurrentUser } from "../auth/session";
import { getDatabase } from "../database";
import { STEAM_TAXONOMY_VERSION } from "../labels/constants";
import { steamManualLabelInputSchema } from "./manual-label-input";

export type SteamManualLabelResult = { ok: true } | { ok: false; error: string };

/** Validates and stores one manual Steam label decision; automated rows remain untouched. */
export async function applySteamManualLabel(raw: unknown): Promise<SteamManualLabelResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };

  const parsed = steamManualLabelInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That Steam label change was not valid." };
  const { steamAppId, labelId, intent } = parsed.data;

  const db = getDatabase();
  const [trackedId, taxonomy] = await Promise.all([
    findSteamAppId(db, steamAppId),
    loadTaxonomyLabels(db, STEAM_TAXONOMY_VERSION),
  ]);
  if (!trackedId) return { ok: false, error: "This Steam game is no longer tracked." };
  if (!taxonomy.some((label) => label.id === labelId)) {
    return { ok: false, error: "That label is not part of the current Steam taxonomy." };
  }

  try {
    if (intent === "clear") {
      await clearSteamManualLabel(db, { steamAppId, labelId, taxonomyVersion: STEAM_TAXONOMY_VERSION });
    } else {
      await setSteamManualLabel(db, {
        steamAppId,
        labelId,
        taxonomyVersion: STEAM_TAXONOMY_VERSION,
        decision: intent,
        actor: user.email ?? user.id,
        decidedAt: new Date(),
      });
    }
    return { ok: true };
  } catch (error) {
    console.error("Steam manual label change failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "The change could not be saved. Try again." };
  }
}

export async function listSteamTaxonomyOptions() {
  return loadTaxonomyLabels(getDatabase(), STEAM_TAXONOMY_VERSION);
}

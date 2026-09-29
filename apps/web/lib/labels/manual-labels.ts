import "server-only";

import {
  clearManualLabel,
  findListingAppId,
  loadTaxonomyLabels,
  setManualLabel,
} from "@analytic-dashboard/db";
import { z } from "zod";

import { getCurrentUser } from "../auth/session";
import { getDatabase } from "../database";
import { TAXONOMY_VERSION } from "./constants";

export const manualLabelInputSchema = z.object({
  storeAppId: z.uuid(),
  labelId: z.uuid(),
  intent: z.enum(["confirm", "reject", "clear"]),
});

export type ManualLabelResult = { ok: true } | { ok: false; error: string };

/**
 * Applies one person's decision on a label. The app id is looked up from the listing and the
 * label must exist in the active taxonomy, so a crafted form cannot write arbitrary rows.
 */
export async function applyManualLabel(raw: unknown): Promise<ManualLabelResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };

  const parsed = manualLabelInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That label change was not valid." };
  const { storeAppId, labelId, intent } = parsed.data;

  const db = getDatabase();
  const [appId, taxonomy] = await Promise.all([
    findListingAppId(db, storeAppId),
    loadTaxonomyLabels(db, TAXONOMY_VERSION),
  ]);
  if (!appId) return { ok: false, error: "This game is no longer tracked." };
  if (!taxonomy.some((label) => label.id === labelId)) {
    return { ok: false, error: "That label is not part of the current taxonomy." };
  }

  try {
    if (intent === "clear") {
      await clearManualLabel(db, { appId, labelId, taxonomyVersion: TAXONOMY_VERSION });
    } else {
      await setManualLabel(db, {
        appId,
        labelId,
        taxonomyVersion: TAXONOMY_VERSION,
        decision: intent,
        actor: user.email ?? user.id,
        decidedAt: new Date(),
      });
    }
    return { ok: true };
  } catch (error) {
    // Only the error name is logged; the message can include query details.
    console.error("manual label change failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "The change could not be saved. Try again." };
  }
}

export async function listTaxonomyOptions() {
  return loadTaxonomyLabels(getDatabase(), TAXONOMY_VERSION);
}

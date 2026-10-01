import "server-only";

import {
  loadDesktopOpportunityDecisions,
  recordDesktopOpportunityDecision,
  type DesktopOpportunityDecisionRow,
} from "@analytic-dashboard/db";

import { getCurrentUser } from "../auth/session";
import { getDatabase } from "../database";
import { STEAM_TAXONOMY_VERSION, TAXONOMY_VERSION } from "../labels/constants";
import { desktopOpportunityDecisionSchema } from "./desktop-decision-input";
import { getPlatformDatasets } from "./get-compare";
import { buildLabelEvidence, OPPORTUNITY_MODES } from "./opportunities";

export type DesktopOpportunityDecisionResult = { ok: true } | { ok: false; error: string };

/** Recomputes server-side evidence and appends a decision only while the label is still a surfaced opportunity. */
export async function applyDesktopOpportunityDecision(raw: unknown): Promise<DesktopOpportunityDecisionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };
  const parsed = desktopOpportunityDecisionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That Desktop opportunity decision was not valid." };

  try {
    const input = parsed.data;
    const { datasets, asOf } = await getPlatformDatasets(input.country);
    const evidence = buildLabelEvidence({
      datasets,
      type: input.labelType,
      slug: input.labelSlug,
      asOf,
    });
    if (!evidence || !OPPORTUNITY_MODES.includes(evidence.row.opportunity.mode)) {
      return { ok: false, error: "This label no longer qualifies as a Desktop opportunity." };
    }

    await recordDesktopOpportunityDecision(getDatabase(), {
      country: input.country,
      labelType: input.labelType,
      labelSlug: input.labelSlug,
      labelDisplayName: evidence.row.displayName,
      formulaVersion: evidence.row.opportunity.formulaVersion,
      steamTaxonomyVersion: STEAM_TAXONOMY_VERSION,
      mobileTaxonomyVersion: TAXONOMY_VERSION,
      status: input.status,
      note: input.note,
      owner: input.owner,
      actor: user.email ?? user.id,
      evidence: {
        capturedAt: asOf.toISOString(),
        mode: evidence.row.opportunity.mode,
        confidence: evidence.row.opportunity.confidence,
        measured: evidence.row.opportunity.measured,
        total: evidence.row.opportunity.total,
        reasons: evidence.row.opportunity.reasons,
        caveats: evidence.caveats,
        platforms: evidence.row.platforms,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("desktop opportunity decision failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "The decision could not be saved. Try again." };
  }
}

export async function getDesktopOpportunityDecisions(input: {
  country: "id" | "us";
  labelType: DesktopOpportunityDecisionRow["labelType"];
  labelSlug: string;
}): Promise<DesktopOpportunityDecisionRow[]> {
  return loadDesktopOpportunityDecisions(getDatabase(), input);
}

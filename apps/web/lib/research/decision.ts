import "server-only";

import { recordOpportunityDecision } from "@analytic-dashboard/db";

import { getCurrentUser } from "../auth/session";
import { getDatabase } from "../database";
import { opportunityDecisionSchema } from "./decision-input";

export type OpportunityDecisionResult = { ok: true } | { ok: false; error: string };

/** Validates and appends one team decision; earlier decisions remain unchanged. */
export async function applyOpportunityDecision(raw: unknown): Promise<OpportunityDecisionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };
  const parsed = opportunityDecisionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That research decision was not valid." };

  try {
    const saved = await recordOpportunityDecision(getDatabase(), {
      ...parsed.data,
      actor: user.email ?? user.id,
    });
    return saved ? { ok: true } : { ok: false, error: "This opportunity is no longer available." };
  } catch (error) {
    console.error("opportunity decision failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "The decision could not be saved. Try again." };
  }
}

"use server";

import { revalidatePath } from "next/cache";

import {
  applyDesktopOpportunityDecision,
  type DesktopOpportunityDecisionResult,
} from "@/lib/steam/desktop-decisions";
import { desktopOpportunityDecisionFormInput } from "@/lib/steam/desktop-decision-input";

export type DesktopOpportunityDecisionActionState = DesktopOpportunityDecisionResult | { ok: null };

export async function saveDesktopOpportunityDecision(
  _previous: DesktopOpportunityDecisionActionState,
  formData: FormData,
): Promise<DesktopOpportunityDecisionActionState> {
  const input = desktopOpportunityDecisionFormInput(formData);
  const result = await applyDesktopOpportunityDecision(input);
  if (result.ok && typeof input.labelType === "string" && typeof input.labelSlug === "string") {
    revalidatePath(`/steam/opportunities/${input.labelType}/${input.labelSlug}`);
    revalidatePath("/steam");
  }
  return result;
}

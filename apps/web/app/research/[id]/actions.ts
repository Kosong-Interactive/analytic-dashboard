"use server";

import { revalidatePath } from "next/cache";

import { applyOpportunityDecision, type OpportunityDecisionResult } from "@/lib/research/decision";
import { opportunityDecisionFormInput } from "@/lib/research/decision-input";

export type OpportunityDecisionActionState = OpportunityDecisionResult | { ok: null };

export async function saveOpportunityDecision(
  _previous: OpportunityDecisionActionState,
  formData: FormData,
): Promise<OpportunityDecisionActionState> {
  const input = opportunityDecisionFormInput(formData);
  const result = await applyOpportunityDecision(input);
  if (result.ok && typeof input.opportunityId === "string") {
    revalidatePath(`/research/${input.opportunityId}`);
    revalidatePath("/");
  }
  return result;
}

"use client";

import { useActionState } from "react";

import {
  saveDesktopOpportunityDecision,
  type DesktopOpportunityDecisionActionState,
} from "@/app/steam/opportunities/[type]/[slug]/actions";
import {
  DESKTOP_OPPORTUNITY_NOTE_MAX,
  DESKTOP_OPPORTUNITY_OWNER_MAX,
} from "@/lib/steam/desktop-decision-input";
import {
  opportunityDecisionActionLabels,
  opportunityDecisionValues,
  type OpportunityDecisionStatus,
} from "@/lib/research/detail-view-model";
import type { CompareType } from "@/lib/steam/platform-compare";
import { cn } from "@/lib/utils";

const initialState: DesktopOpportunityDecisionActionState = { ok: null };
const buttonTone: Record<OpportunityDecisionStatus, string> = {
  shortlisted: "border-star/50 text-star hover:bg-star/10",
  rejected: "border-down/50 text-down hover:bg-down/10",
  prototype: "border-up/50 text-up hover:bg-up/10",
};

export function DesktopDecisionForm({
  country,
  labelType,
  labelSlug,
}: {
  country: "id" | "us";
  labelType: CompareType;
  labelSlug: string;
}) {
  const [state, action, pending] = useActionState(saveDesktopOpportunityDecision, initialState);
  return (
    <form action={action} className="flex flex-col gap-3 border-t border-line-soft p-4">
      <input type="hidden" name="country" value={country} />
      <input type="hidden" name="labelType" value={labelType} />
      <input type="hidden" name="labelSlug" value={labelSlug} />
      <label className="flex flex-col gap-1 text-xs text-dim">
        Owner (optional)
        <input
          name="owner"
          maxLength={DESKTOP_OPPORTUNITY_OWNER_MAX}
          placeholder="Team or person responsible"
          className="h-9 rounded-md border border-line-strong bg-surface-alt px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-dim">
        Decision note
        <textarea
          name="note"
          maxLength={DESKTOP_OPPORTUNITY_NOTE_MAX}
          rows={4}
          placeholder="Why should the team shortlist, reject, or prototype this direction?"
          className="min-h-24 rounded-md border border-line-strong bg-surface-alt px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        {opportunityDecisionValues.map((status) => (
          <button
            key={status}
            type="submit"
            name="status"
            value={status}
            disabled={pending}
            className={cn(
              "h-9 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50",
              buttonTone[status],
            )}
          >
            {opportunityDecisionActionLabels[status]}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="min-h-5 text-xs">
        {pending ? <span className="text-dim">Saving decision…</span> : null}
        {state.ok === true ? <span className="text-up">Decision saved to the history.</span> : null}
        {state.ok === false ? <span className="text-down">{state.error}</span> : null}
      </div>
    </form>
  );
}

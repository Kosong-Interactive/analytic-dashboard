import type { MarketHomeCountry } from "@analytic-dashboard/shared";
import type { DesktopOpportunityDecisionRow } from "@analytic-dashboard/db";

import { opportunityDecisionLabels } from "@/lib/research/detail-view-model";
import type { CompareType } from "@/lib/steam/platform-compare";
import { cn } from "@/lib/utils";

import { Panel } from "../overview/panel";
import { DesktopDecisionForm } from "./desktop-decision-form";

export const desktopDecisionTone = {
  shortlisted: "border-star/50 bg-star/10 text-star",
  rejected: "border-down/50 bg-down/10 text-down",
  prototype: "border-up/50 bg-up/10 text-up",
} as const;

function formatDecisionDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export function DesktopDecisionPanel({
  decisions,
  country,
  marketLabel,
  labelType,
  labelSlug,
}: {
  decisions: DesktopOpportunityDecisionRow[];
  country: MarketHomeCountry;
  /** Name of the mobile market the decision applies to, such as World. */
  marketLabel: string;
  labelType: CompareType;
  labelSlug: string;
}) {
  const current = decisions[0] ?? null;
  return (
    <Panel
      title="Team decision"
      description={`The latest decision applies to this label and the ${marketLabel} mobile market; every change remains in history`}
      action={
        current ? (
          <span className={cn("rounded-full border px-2 py-1 text-[13px] font-medium", desktopDecisionTone[current.status])}>
            {opportunityDecisionLabels[current.status]}
          </span>
        ) : null
      }
    >
      {current ? (
        <div className="border-t border-line-soft px-4 py-3 text-sm leading-5 text-ink-soft">
          Latest decision by {current.actor}{current.owner ? ` · owner: ${current.owner}` : ""} · {formatDecisionDate(current.createdAt)} UTC
          {current.note ? <p className="mt-1 text-ink">{current.note}</p> : null}
          <p className="mt-1 text-[13px] text-dim">
            Evidence: {current.formulaVersion} · Steam {current.steamTaxonomyVersion} · mobile {current.mobileTaxonomyVersion}
          </p>
        </div>
      ) : (
        <p className="border-t border-line-soft px-4 py-3 text-sm text-dim">No team decision has been recorded.</p>
      )}
      <DesktopDecisionForm country={country} labelType={labelType} labelSlug={labelSlug} />
      {decisions.length > 0 ? (
        <div className="border-t border-line-soft px-4 py-3">
          <p className="mb-2 text-[13px] font-medium uppercase tracking-wider text-dim">Decision history</p>
          <ol className="flex flex-col gap-2">
            {decisions.map((decision) => (
              <li key={decision.id} className="rounded-md border border-line-soft bg-surface-alt px-3 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{opportunityDecisionLabels[decision.status]}</span>
                  <span className="text-dim">{formatDecisionDate(decision.createdAt)} UTC</span>
                </div>
                <p className="mt-1 text-dim">{decision.actor}{decision.owner ? ` · owner: ${decision.owner}` : ""}</p>
                {decision.note ? <p className="mt-1 leading-5 text-ink-soft">{decision.note}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Panel>
  );
}

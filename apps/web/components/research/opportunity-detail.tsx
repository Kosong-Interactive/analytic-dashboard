import Link from "next/link";

import { platformLabel } from "@analytic-dashboard/shared";

import { formatCount, formatRelative } from "@/lib/format/format";
import { countryLabels } from "@/lib/overview/filters";
import {
  opportunityDecisionLabels,
  type OpportunityDecisionStatus,
  type OpportunityDetailView,
} from "@/lib/research/detail-view-model";
import { cn } from "@/lib/utils";

import { EmptyState, Panel } from "../overview/panel";
import { DecisionForm } from "./decision-form";

const decisionTone: Record<OpportunityDecisionStatus, string> = {
  shortlisted: "border-star/40 bg-star/10 text-star",
  rejected: "border-down/40 bg-down/10 text-down",
  prototype: "border-up/40 bg-up/10 text-up",
};

function countryLabel(country: string): string {
  return countryLabels[country as keyof typeof countryLabels] ?? country.toUpperCase();
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(value);
}

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function rawValue(key: OpportunityDetailView["components"][number]["key"], value: number | null): string {
  if (value === null) return "—";
  if (["newEntrantPerformance", "competitionGap", "crossStoreConfirmation", "studioFit"].includes(key)) {
    return `${Math.round(value * 100)}%`;
  }
  return value.toFixed(1);
}

function SummaryCards({ view }: { view: OpportunityDetailView }) {
  const cards = [
    { label: "Opportunity Score", value: view.score === null ? "Pending" : Math.round(view.score).toString() },
    { label: "Research Confidence", value: `${Math.round(view.confidence * 100)}%`, detail: view.confidenceBand },
    { label: "Observed cohort", value: `${view.memberCount}`, detail: "tracked games" },
    { label: "History", value: view.historyDays === null ? "—" : `${view.historyDays.toFixed(1)}d`, detail: `${view.windowDays}-day window` },
    { label: "Score coverage", value: percent(view.weightCoverage), detail: "measurable weight" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-[10px] border border-line bg-surface p-4">
          <dt className="text-[11px] uppercase tracking-wider text-dim">{card.label}</dt>
          <dd className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</dd>
          {card.detail ? <p className="mt-1 text-xs capitalize text-dim">{card.detail}</p> : null}
        </div>
      ))}
    </dl>
  );
}

function Lines({ lines, empty, tone }: { lines: string[]; empty: string; tone?: string }) {
  if (lines.length === 0) return <p className="text-xs text-dim">{empty}</p>;
  return (
    <ul className={cn("flex flex-col gap-2 text-xs leading-5 text-ink-soft", tone)}>
      {lines.map((line) => (
        <li key={line} className="border-l border-line-strong pl-3">
          {line}
        </li>
      ))}
    </ul>
  );
}

function ScoreBreakdown({ view }: { view: OpportunityDetailView }) {
  return (
    <Panel
      title="Score calculation"
      description={`${view.formulaVersion} · missing components remain missing and are never converted to zero`}
    >
      <div className="overflow-x-auto border-t border-line-soft">
        <table className="w-full min-w-[650px] border-collapse text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wider text-dim">
            <tr>
              <th className="px-4 py-3 font-medium">Component</th>
              <th className="px-4 py-3 text-right font-medium">Raw evidence</th>
              <th className="px-4 py-3 text-right font-medium">Storefront percentile</th>
              <th className="px-4 py-3 text-right font-medium">Configured weight</th>
              <th className="px-4 py-3 text-right font-medium">Score contribution</th>
            </tr>
          </thead>
          <tbody>
            {view.components.map((component) => (
              <tr key={component.key} className="border-t border-line-soft">
                <th className="px-4 py-3 font-medium text-ink">{component.label}</th>
                <td className="px-4 py-3 text-right text-ink-soft">{rawValue(component.key, component.raw)}</td>
                <td className="px-4 py-3 text-right text-ink-soft">{percent(component.normalized)}</td>
                <td className="px-4 py-3 text-right text-ink-soft">{percent(component.weight)}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {component.contribution === null ? "—" : `${component.contribution.toFixed(1)} pts`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view.pendingReason ? (
        <p className="border-t border-star/30 bg-star/5 px-4 py-3 text-xs leading-5 text-ink-soft">
          Score pending: {view.pendingReason}.
        </p>
      ) : null}
    </Panel>
  );
}

function MarketFacts({ view }: { view: OpportunityDetailView }) {
  const facts = [
    ["Games with Trend Score", `${view.facts.scoredMembers} of ${view.memberCount}`],
    ["Median Trend Score", view.facts.medianTrendScore === null ? "—" : view.facts.medianTrendScore.toFixed(1)],
    ["Recent releases", String(view.facts.newEntrants)],
    ["Recent releases with momentum", String(view.facts.newEntrantsWithMomentum)],
    ["Sampled catalogue share", percent(view.facts.catalogueShare)],
    ["Top-three rating share", percent(view.facts.topThreeRatingShare)],
    ["Median rating", view.facts.medianRating === null ? "—" : view.facts.medianRating.toFixed(1)],
    ["Other-store demand percentile", percent(view.facts.otherStorePercentile)],
  ];
  return (
    <Panel title="Observed market evidence" description="Facts from the sampled catalogue, not total market estimates">
      <dl className="grid grid-cols-1 border-t border-line-soft sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
            <dt className="text-xs text-dim">{label}</dt>
            <dd className="text-xs font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function Comparables({ view }: { view: OpportunityDetailView }) {
  return (
    <Panel title="Comparable games" description="Highest observed momentum inside this cohort">
      {view.comparables.length === 0 ? (
        <EmptyState title="No comparable games stored">The calculation did not retain comparable listings.</EmptyState>
      ) : (
        <ul className="divide-y divide-line-soft border-t border-line-soft">
          {view.comparables.map((game) => (
            <li key={game.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/games/${game.id}`} className="text-sm font-medium underline-offset-2 hover:underline">
                  {game.title}
                </Link>
                <p className="mt-0.5 text-[11px] text-dim">
                  {game.releaseDate ? `Released ${formatDate(game.releaseDate)}` : "Release date unavailable"}
                </p>
              </div>
              <div className="flex gap-5 text-right text-xs">
                <div><p className="text-dim">Trend Score</p><p className="mt-0.5 font-medium">{game.trendScore === null ? "—" : Math.round(game.trendScore)}</p></div>
                <div><p className="text-dim">Rating</p><p className="mt-0.5 font-medium">{game.rating === null ? "—" : game.rating.toFixed(1)}</p></div>
                <div><p className="text-dim">Ratings</p><p className="mt-0.5 font-medium">{formatCount(game.ratingCount)}</p></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function DecisionPanel({ view }: { view: OpportunityDetailView }) {
  const current = view.currentDecision;
  return (
    <Panel
      title="Team decision"
      description="Market evidence informs the decision; it does not predict commercial success"
      action={current ? <span className={cn("rounded-full border px-2 py-1 text-[11px] font-medium", decisionTone[current.status])}>{opportunityDecisionLabels[current.status]}</span> : null}
    >
      {current ? (
        <div className="border-t border-line-soft px-4 py-3 text-xs leading-5 text-ink-soft">
          Latest decision by {current.actor}{current.owner ? ` · owner: ${current.owner}` : ""} · {formatDate(current.createdAt)}
          {current.note ? <p className="mt-1 text-ink">{current.note}</p> : null}
        </div>
      ) : (
        <p className="border-t border-line-soft px-4 py-3 text-xs text-dim">No team decision has been recorded.</p>
      )}
      <DecisionForm opportunityId={view.id} />
      {view.decisions.length > 0 ? (
        <div className="border-t border-line-soft px-4 py-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-dim">Decision history</p>
          <ol className="flex flex-col gap-2">
            {view.decisions.map((decision) => (
              <li key={decision.id} className="rounded-md border border-line-soft bg-surface-alt px-3 py-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{opportunityDecisionLabels[decision.status]}</span>
                  <span className="text-dim">{formatDate(decision.createdAt)}</span>
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

export function OpportunityDetail({ view, now }: { view: OpportunityDetailView; now: Date }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href={`/?country=${view.country}&platform=${view.store}`} className="text-xs text-dim underline-offset-2 hover:underline">← Back to Overview</Link>
          <h1 className="text-[22px] font-semibold tracking-tight">{view.title}</h1>
          <p className="text-[13px] text-dim">
            {platformLabel(view.store)} · {countryLabel(view.country)}{view.insight ? ` · ${view.insight}` : " · Candidate awaiting score"}
          </p>
        </div>
        <div className="text-right text-xs leading-5 text-dim">
          <p>Calculated {formatRelative(view.asOf, now)}</p>
          <p>{formatDate(view.asOf)} UTC · source {view.freshness}</p>
        </div>
      </div>

      <SummaryCards view={view} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-4 xl:col-span-8">
          <ScoreBreakdown view={view} />
          <MarketFacts view={view} />
          <Comparables view={view} />
        </div>
        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel title="Why now" description="Positive signals retained by the calculation">
            <div className="border-t border-line-soft p-4"><Lines lines={view.positives} empty="No positive signal is measurable yet." /></div>
          </Panel>
          <Panel title="Risks and counter-signals" description="Evidence that argues against overconfidence">
            <div className="border-t border-line-soft p-4"><Lines lines={view.risks} empty="No counter-signal was retained." tone="text-down" /></div>
          </Panel>
          <Panel title="Coverage caveats" description={`${view.trackedGames} tracked games · taxonomy ${view.taxonomyVersion}`}>
            <div className="border-t border-line-soft p-4"><Lines lines={view.caveats} empty="No caveat was retained." /></div>
          </Panel>
          <DecisionPanel view={view} />
        </div>
      </div>
    </>
  );
}

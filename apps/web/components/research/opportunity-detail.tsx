import Link from "next/link";

import { platformLabel } from "@analytic-dashboard/shared";
import type { StudioFitResult } from "@analytic-dashboard/analytics";

import { formatCount, formatRelative, formatSigned } from "@/lib/format/format";
import { countryLabels } from "@/lib/overview/filters";
import {
  opportunityDecisionLabels,
  type OpportunityDecisionStatus,
  type OpportunityDetailView,
} from "@/lib/research/detail-view-model";
import { cn } from "@/lib/utils";
import { capabilityLabels, monetizationLabels, type StudioProfileView } from "@/lib/research/studio-profile";
import type { ResearchBriefView } from "@/lib/research/research-brief-view";
import type { OpportunityHistoryView } from "@/lib/research/history-view-model";

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
    { label: "Research Confidence", value: `${Math.round(view.confidence * 100)}%`, detail: view.confidenceBand },
    { label: "Observed cohort", value: `${view.memberCount}`, detail: "tracked games" },
    { label: "History", value: view.historyDays === null ? "—" : `${view.historyDays.toFixed(1)}d`, detail: `${view.windowDays}-day window` },
    { label: "Score coverage", value: percent(view.weightCoverage), detail: "measurable weight" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-[10px] border border-line bg-surface p-4">
          <dt className="text-[13px] uppercase tracking-wider text-dim">{card.label}</dt>
          <dd className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</dd>
          {card.detail ? <p className="mt-1 text-sm capitalize text-dim">{card.detail}</p> : null}
        </div>
      ))}
    </dl>
  );
}

function RecommendationPanel({
  view,
  profile,
  studioFit,
}: {
  view: OpportunityDetailView;
  profile: StudioProfileView | null;
  studioFit: StudioFitResult | null;
}) {
  const value = (score: number | null | undefined) => score == null ? "Pending" : Math.round(score).toString();
  return (
    <Panel
      title="Recommendation Priority"
      description="Market attractiveness and studio feasibility stay separate · recommendation_priority_v1"
      action={<Link href="/settings/studio-fit" className="text-sm text-accent underline-offset-2 hover:underline">Configure Studio Fit</Link>}
    >
      <div className="grid grid-cols-1 border-t border-line-soft md:grid-cols-3">
        <div className="border-b border-line-soft p-4 md:border-b-0 md:border-r">
          <p className="text-[13px] uppercase tracking-wider text-dim">Market Opportunity</p>
          <p className="mt-2 text-4xl font-semibold">{value(view.score)}</p>
          <p className="mt-1 text-sm text-dim">{view.formulaVersion} · storefront evidence</p>
        </div>
        <div className="border-b border-line-soft p-4 md:border-b-0 md:border-r">
          <p className="text-[13px] uppercase tracking-wider text-dim">Studio Fit</p>
          <p className="mt-2 text-4xl font-semibold">{value(studioFit?.score)}</p>
          <p className="mt-1 text-sm text-dim">
            {profile ? `profile v${profile.version} · ${Math.round((studioFit?.coverage ?? 0) * 100)}% measurable` : "profile not configured"}
          </p>
        </div>
        <div className="p-4">
          <p className="text-[13px] uppercase tracking-wider text-dim">Recommendation Priority</p>
          <p className="mt-2 text-4xl font-semibold text-accent">{value(studioFit?.recommendationPriority)}</p>
          <p className="mt-1 text-sm text-dim">65% market · 35% fit · requires both scores</p>
        </div>
      </div>
      {!profile ? (
        <p className="border-t border-star/30 bg-star/5 px-4 py-3 text-sm text-ink-soft">Configure the studio profile before feasibility can be measured.</p>
      ) : studioFit?.reason ? (
        <p className="border-t border-star/30 bg-star/5 px-4 py-3 text-sm text-ink-soft">Studio Fit pending: {studioFit.reason}.</p>
      ) : null}
      {profile && studioFit ? (
        <div className="grid grid-cols-1 border-t border-line-soft xl:grid-cols-2">
          <div className="p-4 xl:border-r xl:border-line-soft">
            <p className="text-[13px] font-medium uppercase tracking-wider text-dim">Measured fit</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm leading-5 text-ink-soft">
              {studioFit.components.map((component) => (
                <li key={component.key} className="flex justify-between gap-4"><span>{component.evidence}</span><span>{component.value === null ? "—" : percent(component.value)}</span></li>
              ))}
            </ul>
            {studioFit.gaps.length > 0 ? <div className="mt-3"><Lines lines={studioFit.gaps} empty="" tone="text-down" /></div> : null}
          </div>
          <div className="p-4">
            <p className="text-[13px] font-medium uppercase tracking-wider text-dim">Profile context</p>
            <p className="mt-2 text-sm leading-5 text-ink-soft">{profile.teamSize} people · {profile.targetDurationMonths} month target · 2D {capabilityLabels[profile.capability2d]} · 3D {capabilityLabels[profile.capability3d]}</p>
            <p className="mt-1 text-sm leading-5 text-ink-soft">Backend {capabilityLabels[profile.onlineBackendCapability]} · Content {capabilityLabels[profile.contentProductionCapability]} · Live-ops {capabilityLabels[profile.liveOpsCapability]}</p>
            <p className="mt-1 text-sm leading-5 text-dim">Monetization: {profile.monetizationCapabilities.length === 0 ? "not configured" : profile.monetizationCapabilities.map((item) => monetizationLabels[item]).join(", ")}</p>
            <p className="mt-3 text-[13px] leading-5 text-dim">{studioFit.caveats[0]}</p>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function Lines({ lines, empty, tone }: { lines: string[]; empty: string; tone?: string }) {
  if (lines.length === 0) return <p className="text-sm text-dim">{empty}</p>;
  return (
    <ul className={cn("flex flex-col gap-2 text-sm leading-5 text-ink-soft", tone)}>
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
        <table className="w-full min-w-[650px] border-collapse text-left text-sm">
          <thead className="text-[13px] uppercase tracking-wider text-dim">
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
        <p className="border-t border-star/30 bg-star/5 px-4 py-3 text-sm leading-5 text-ink-soft">
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
            <dt className="text-sm text-dim">{label}</dt>
            <dd className="text-sm font-medium text-ink">{value}</dd>
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
                <Link href={`/games/${game.id}`} className="text-base font-medium underline-offset-2 hover:underline">
                  {game.title}
                </Link>
                <p className="mt-0.5 text-[13px] text-dim">
                  {game.releaseDate ? `Released ${formatDate(game.releaseDate)}` : "Release date unavailable"}
                </p>
              </div>
              <div className="flex gap-5 text-right text-sm">
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
      action={current ? <span className={cn("rounded-full border px-2 py-1 text-[13px] font-medium", decisionTone[current.status])}>{opportunityDecisionLabels[current.status]}</span> : null}
    >
      {current ? (
        <div className="border-t border-line-soft px-4 py-3 text-sm leading-5 text-ink-soft">
          Latest decision by {current.actor}{current.owner ? ` · owner: ${current.owner}` : ""} · {formatDate(current.createdAt)}
          {current.note ? <p className="mt-1 text-ink">{current.note}</p> : null}
        </div>
      ) : (
        <p className="border-t border-line-soft px-4 py-3 text-sm text-dim">No team decision has been recorded.</p>
      )}
      <DecisionForm opportunityId={view.id} />
      {view.decisions.length > 0 ? (
        <div className="border-t border-line-soft px-4 py-3">
          <p className="mb-2 text-[13px] font-medium uppercase tracking-wider text-dim">Decision history</p>
          <ol className="flex flex-col gap-2">
            {view.decisions.map((decision) => (
              <li key={decision.id} className="rounded-md border border-line-soft bg-surface-alt px-3 py-2 text-sm">
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

function CitationLinks({ ids }: { ids: string[] }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {ids.map((id) => (
        <a key={id} href={`#evidence-${id}`} className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[11.5px] text-accent">
          {id}
        </a>
      ))}
    </span>
  );
}

function ResearchBriefPanel({ brief, score }: { brief: ResearchBriefView | null; score: number | null }) {
  if (!brief) {
    return (
      <Panel title="AI Research Brief" description="Generated asynchronously from stored evidence only">
        <EmptyState title={score === null ? "Brief waits for a measurable market signal" : "Brief has not been generated yet"}>
          {score === null
            ? "The AI job will not turn a pending opportunity into a recommendation."
            : "The scheduled research job will draft a cited brief without blocking this page."}
        </EmptyState>
      </Panel>
    );
  }
  return (
    <Panel title="AI Research Brief" description={`${brief.promptVersion} · ${brief.model} · generated ${formatDate(brief.createdAt)} UTC`}>
      <div className="border-t border-line-soft p-4">
        <p className="text-base leading-6 text-ink">{brief.summary.text}<CitationLinks ids={brief.summary.evidenceIds} /></p>
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wider text-up">Opportunity signals</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm leading-5 text-ink-soft">
              {brief.opportunitySignals.map((item) => (
                <li key={`${item.text}:${item.evidenceIds.join()}`} className="border-l border-up/40 pl-3">{item.text}<CitationLinks ids={item.evidenceIds} /></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-medium uppercase tracking-wider text-down">Counter-signals</p>
            {brief.counterSignals.length === 0 ? <p className="mt-2 text-sm text-dim">No additional counter-signal was drafted.</p> : (
              <ul className="mt-2 flex flex-col gap-2 text-sm leading-5 text-ink-soft">
                {brief.counterSignals.map((item) => (
                  <li key={`${item.text}:${item.evidenceIds.join()}`} className="border-l border-down/40 pl-3">{item.text}<CitationLinks ids={item.evidenceIds} /></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-line-soft p-4">
        <p className="text-[13px] font-medium uppercase tracking-wider text-dim">Validation questions</p>
        <ol className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {brief.validationQuestions.map((item, index) => (
            <li key={`${item.question}:${item.evidenceIds.join()}`} className="rounded-md border border-line-soft bg-surface-alt p-3">
              <p className="text-sm font-medium text-ink">{index + 1}. {item.question}</p>
              <p className="mt-1 text-sm leading-5 text-dim">{item.why}<CitationLinks ids={item.evidenceIds} /></p>
            </li>
          ))}
        </ol>
      </div>
      <details className="border-t border-line-soft p-4">
        <summary className="cursor-pointer text-sm font-medium text-accent">View supplied evidence registry</summary>
        <dl className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
          {brief.evidence.map((item) => (
            <div id={`evidence-${item.id}`} key={item.id} className="rounded-md border border-line-soft bg-surface-alt p-3 text-sm">
              <dt className="font-medium text-ink">{item.label} <span className="font-normal text-accent">{item.id}</span></dt>
              <dd className="mt-1 leading-5 text-dim">{item.value}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="border-t border-star/30 bg-star/5 px-4 py-3 text-[13px] leading-5 text-ink-soft">AI summarizes supplied evidence; it does not alter the score or the team decision and is not a forecast of commercial success.</p>
    </Panel>
  );
}

function durabilityStatus(window: OpportunityHistoryView["windows"][number]): string {
  if (window.status === "ready") return "Measured";
  if (window.status === "unavailable") return "Not measurable";
  return `${window.daysUntilReady}d until sufficient coverage`;
}

function HistoryPanel({ history }: { history: OpportunityHistoryView | null }) {
  if (!history) {
    return (
      <Panel title="Opportunity history" description="30/90-day durability, acceleration, and material changes">
        <EmptyState title="History could not be validated">
          The current research result remains available, but malformed historical evidence is not shown.
        </EmptyState>
      </Panel>
    );
  }

  const recent = history.timeline.slice(-12);
  const acceleration = history.acceleration;
  return (
    <Panel
      title="Opportunity history"
      description={`${history.version} · same storefront, market, formula, taxonomy, and opportunity dimensions only`}
    >
      <div className="grid grid-cols-1 border-t border-line-soft md:grid-cols-3">
        {history.windows.map((window) => (
          <div key={window.windowDays} className="border-b border-line-soft p-4 md:border-b-0 md:border-r">
            <p className="text-[13px] uppercase tracking-wider text-dim">{window.windowDays}-day durability</p>
            <p className="mt-2 text-3xl font-semibold">
              {window.durableShare === null ? "Pending" : `${Math.round(window.durableShare * 100)}%`}
            </p>
            <p className="mt-1 text-sm text-dim">
              {durabilityStatus(window)} · {window.sampleCount} scored snapshots · {window.observedDays.toFixed(1)}d observed
            </p>
            {window.averageScore !== null ? (
              <p className="mt-2 text-[13px] text-ink-soft">
                Average {window.averageScore.toFixed(1)} · change {formatSigned(window.scoreChange, 1)} pts
              </p>
            ) : null}
          </div>
        ))}
        <div className="p-4">
          <p className="text-[13px] uppercase tracking-wider text-dim">7-day acceleration</p>
          <p className="mt-2 text-3xl font-semibold capitalize">
            {acceleration.direction ?? (acceleration.status === "collecting" ? "Collecting" : "Pending")}
          </p>
          <p className="mt-1 text-sm text-dim">
            {acceleration.status === "ready"
              ? `${formatSigned(acceleration.value, 1)} pts versus the preceding 7-day change`
              : `Requires ${acceleration.requiredHistoryDays} days of comparable score history`}
          </p>
          {acceleration.status === "ready" ? (
            <p className="mt-2 text-[13px] text-ink-soft">
              Latest 7d {formatSigned(acceleration.recentChange, 1)} · prior 7d {formatSigned(acceleration.previousChange, 1)}
            </p>
          ) : null}
        </div>
      </div>

      {history.alerts.length > 0 ? (
        <div className="border-t border-line-soft p-4">
          <p className="text-[13px] font-medium uppercase tracking-wider text-dim">Latest material changes</p>
          <ul className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-2">
            {history.alerts.map((alert) => (
              <li
                key={alert.key}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm leading-5",
                  alert.severity === "high" ? "border-down/40 bg-down/10" : "border-star/40 bg-star/10",
                )}
              >
                <p className="font-medium text-ink">{alert.title}</p>
                <p className="text-dim">{alert.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="border-t border-line-soft px-4 py-3 text-sm text-dim">
          {history.points.length < 2
            ? "Collecting a second comparable research snapshot before change detection starts."
            : "No material change was detected in the latest comparable research run."}
        </p>
      )}

      {recent.length > 0 ? (
        <div className="border-t border-line-soft p-4">
          {recent.length >= 2 ? (
            <div className="flex h-28 items-end gap-1" aria-hidden="true">
              {recent.map((point) => (
                <div key={point.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-dim">{point.score === null ? "—" : Math.round(point.score)}</span>
                  <div
                    className={cn("w-full max-w-8 rounded-t-sm", point.score === null ? "h-1 bg-line-strong" : "bg-accent/70")}
                    style={point.score === null ? undefined : { height: `${Math.max(4, point.score)}%` }}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <details className={recent.length >= 2 ? "mt-3" : undefined}>
            <summary className="cursor-pointer text-sm font-medium text-accent">View accessible snapshot timeline</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead className="text-[13px] uppercase tracking-wider text-dim">
                  <tr><th className="py-2 font-medium">Calculated</th><th className="py-2 text-right font-medium">Score</th><th className="py-2 text-right font-medium">Change</th><th className="py-2 text-right font-medium">Confidence</th></tr>
                </thead>
                <tbody>
                  {[...recent].reverse().map((point) => (
                    <tr key={point.id} className="border-t border-line-soft">
                      <td className="py-2 text-ink-soft">{formatDate(point.asOf)}</td>
                      <td className="py-2 text-right font-medium">{point.score === null ? "—" : point.score.toFixed(1)}</td>
                      <td className="py-2 text-right text-ink-soft">{formatSigned(point.delta, 1)}</td>
                      <td className="py-2 text-right text-ink-soft">{Math.round(point.confidence * 100)}% · {point.confidenceBand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {history.skipped > 0 ? <p className="mt-2 text-[13px] text-down">{history.skipped} malformed historical snapshot(s) were hidden.</p> : null}
        </div>
      ) : null}
      <p className="border-t border-line-soft px-4 py-3 text-[13px] leading-5 text-dim">
        Durability is the share of measurable snapshots at or above a 60 Opportunity Score. It is an internal research signal, not a probability of commercial success.
      </p>
    </Panel>
  );
}

export function OpportunityDetail({
  view,
  profile,
  studioFit,
  brief,
  history,
  now,
}: {
  view: OpportunityDetailView;
  profile: StudioProfileView | null;
  studioFit: StudioFitResult | null;
  brief: ResearchBriefView | null;
  history: OpportunityHistoryView | null;
  now: Date;
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link href={`/?country=${view.country}&platform=${view.store}`} className="text-sm text-dim underline-offset-2 hover:underline">← Back to Overview</Link>
          <h1 className="text-[26px] font-semibold tracking-tight">{view.title}</h1>
          <p className="text-[15px] text-dim">
            {platformLabel(view.store)} · {countryLabel(view.country)}{view.insight ? ` · ${view.insight}` : " · Candidate awaiting score"}
          </p>
        </div>
        <div className="text-right text-sm leading-5 text-dim">
          <p>Calculated {formatRelative(view.asOf, now)}</p>
          <p>{formatDate(view.asOf)} UTC · source {view.freshness}</p>
        </div>
      </div>

      <RecommendationPanel view={view} profile={profile} studioFit={studioFit} />
      <SummaryCards view={view} />

      <HistoryPanel history={history} />

      <ResearchBriefPanel brief={brief} score={view.score} />

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

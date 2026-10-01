import Link from "next/link";

import { platformLabel } from "@analytic-dashboard/shared";

import { formatRelative } from "@/lib/format/format";
import { countryLabels } from "@/lib/overview/filters";
import type { ConfidenceBand, OpportunitiesView, OpportunityCard, OpportunityPreview } from "@/lib/research/view-model";
import { cn } from "@/lib/utils";

import { LinkButton } from "../common/link-button";
import { EmptyState, Panel } from "./panel";

const bandStyles: Record<ConfidenceBand, { label: string; text: string }> = {
  high: { label: "High confidence", text: "text-up" },
  medium: { label: "Medium confidence", text: "text-star" },
  low: { label: "Low confidence", text: "text-dim" },
};

function market(country: string): string {
  return countryLabels[country as keyof typeof countryLabels] ?? country.toUpperCase();
}

function EvidenceList({ title, lines, tone }: { title: string; lines: string[]; tone?: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-medium uppercase tracking-wider text-dim">{title}</p>
      <ul className={cn("flex flex-col gap-1 text-xs leading-5", tone ?? "text-ink-soft")}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function Card({ card, asOf }: { card: OpportunityCard; asOf: Date }) {
  const band = bandStyles[card.confidenceBand];
  return (
    <li className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface-alt/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-semibold">{card.title}</h3>
          <p className="text-[11.5px] text-dim">
            {platformLabel(card.store)} · {market(card.country)}
            {card.insight ? ` · ${card.insight}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-[22px] font-semibold leading-none tracking-tight">{Math.round(card.score)}</span>
          <span className="text-[11px] text-dim">Opportunity Score</span>
        </div>
      </div>

      <p className="text-xs">
        <span className={band.text}>
          {band.label} ({Math.round(card.confidence * 100)}%)
        </span>
        {card.earlySignal ? <span className="text-dim"> · early signal, not a strong recommendation</span> : null}
        <span className="text-dim"> · {Math.round(card.weightCoverage * 100)}% of score weight measurable</span>
      </p>

      <EvidenceList title="Why now" lines={card.whyNow} />
      <EvidenceList title="Risks" lines={card.risks} tone="text-down" />

      {card.changeAlert ? (
        <div className={cn(
          "rounded-md border px-3 py-2 text-xs leading-5",
          card.changeAlert.severity === "high"
            ? "border-down/40 bg-down/10 text-down"
            : "border-star/40 bg-star/10 text-ink-soft",
        )}>
          <p className="font-medium">Material change · {card.changeAlert.title}</p>
          <p className="mt-0.5 text-[11px] opacity-80">{card.changeAlert.detail}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1 text-xs">
        <p className="text-dim">
          Observed competition: {card.memberCount} tracked games, {Math.round(card.catalogueShare * 100)}% of the sampled
          catalogue
        </p>
        {card.comparables.length > 0 ? (
          <p className="text-ink-soft">
            Comparable:{" "}
            {card.comparables.map((game, index) => (
              <span key={game.id}>
                {index > 0 ? ", " : ""}
                <Link href={`/games/${game.id}`} className="underline-offset-2 hover:underline">
                  {game.title}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3 text-[11px] text-dim">
        <span>Calculated {formatRelative(card.asOf, asOf)}</span>
        <span className="flex flex-wrap items-center justify-end gap-2">
          {card.browseHref ? (
            <LinkButton href={card.browseHref} variant="secondary">
              Browse games
            </LinkButton>
          ) : null}
          <LinkButton href={`/research/${card.id}`}>
            View evidence
          </LinkButton>
        </span>
      </div>
    </li>
  );
}

function PreviewCard({ preview, asOf }: { preview: OpportunityPreview; asOf: Date }) {
  return (
    <li className="flex flex-col gap-3 rounded-[10px] border border-star/40 bg-star/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-star">Candidate preview · awaiting score</p>
          <h3 className="text-sm font-semibold">{preview.title}</h3>
          <p className="text-[11.5px] text-dim">
            {platformLabel(preview.store)} · {market(preview.country)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end text-right">
          <span className="text-sm font-semibold text-dim">Pending</span>
          <span className="text-[11px] text-dim">Opportunity Score</span>
        </div>
      </div>

      <p className="text-xs leading-5 text-ink-soft">
        This is a real tracked market cohort, shown as an early research preview. It is not a development recommendation
        until enough demand history is available.
      </p>

      <div className="flex flex-col gap-1 text-xs">
        <p className="text-dim">
          Observed competition: {preview.memberCount} tracked games, {Math.round(preview.catalogueShare * 100)}% of the
          sampled catalogue
        </p>
        {preview.comparables.length > 0 ? (
          <p className="text-ink-soft">
            Comparable:{" "}
            {preview.comparables.map((game, index) => (
              <span key={game.id}>
                {index > 0 ? ", " : ""}
                <Link href={`/games/${game.id}`} className="underline-offset-2 hover:underline">
                  {game.title}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {preview.reason ? <p className="text-xs text-dim">Why pending: {preview.reason}</p> : null}
      <EvidenceList title="Caveats" lines={preview.caveats.slice(0, 2)} />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3 text-[11px] text-dim">
        <span>Evaluated {formatRelative(preview.asOf, asOf)}</span>
        <span className="flex flex-wrap items-center justify-end gap-2">
          {preview.browseHref ? (
            <LinkButton href={preview.browseHref} variant="secondary">
              Browse cohort
            </LinkButton>
          ) : null}
          <LinkButton href={`/research/${preview.id}`}>
            View evidence
          </LinkButton>
        </span>
      </div>
    </li>
  );
}

function emptyMessage(view: OpportunitiesView): { title: string; body: string } {
  switch (view.state.kind) {
    case "no_runs":
      return {
        title: "Research has not run yet",
        body: "Opportunities are calculated once a day after collection and classification. Nothing is calculated when this page opens.",
      };
    case "failed":
      return {
        title: "The latest research run failed",
        body: "Check the Daily research workflow. Earlier results reappear here once a run succeeds.",
      };
    case "awaiting_scores": {
      const history = view.state.historyDays === null ? "no" : `${view.state.historyDays.toFixed(1)} days of`;
      return {
        title: "No opportunity scored yet",
        body: `${view.state.cohorts} genre and mechanic cohorts are tracked, but an Opportunity Score needs measurable demand. Trend Scores need about 3.5 days of history; there is ${history} history so far.`,
      };
    }
    case "ready":
      return { title: "No opportunities", body: "" };
  }
}

/** Evidence-backed research directions, placed after the KPI cards. Scores are internal and versioned. */
export function OpportunitiesPanel({ view, asOf }: { view: OpportunitiesView; asOf: Date }) {
  const failedRuns = view.runs.filter((run) => run.failed);
  const empty = emptyMessage(view);
  return (
    <Panel
      title="Game Opportunities"
      description="Research directions from observed signals · opportunity_score_v1 · not a forecast of commercial success"
    >
      {failedRuns.length > 0 && view.cards.length > 0 ? (
        <p role="status" className="mx-4 mb-3 rounded-md border border-star/40 bg-star/10 px-3 py-2 text-xs text-ink-soft">
          The latest research run failed for {failedRuns.map((run) => platformLabel(run.store)).join(" and ")}; showing the
          last successful results.
        </p>
      ) : null}
      {view.cards.length === 0 && view.preview ? (
        <>
          <div className="border-t border-line-soft px-4 pt-4">
            <p className="text-xs leading-5 text-dim">{empty.body}</p>
          </div>
          <ul className="grid grid-cols-1 gap-3 p-4" aria-label="Game opportunity candidate preview">
            <PreviewCard preview={view.preview} asOf={asOf} />
          </ul>
        </>
      ) : view.cards.length === 0 ? (
        <EmptyState title={empty.title}>{empty.body}</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 border-t border-line-soft p-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Game opportunities">
          {view.cards.map((card) => (
            <Card key={card.id} card={card} asOf={asOf} />
          ))}
        </ul>
      )}
      <p className="border-t border-line-soft px-4 py-3 text-xs leading-5 text-dim">
        Opportunity Score combines demand momentum, new-entrant performance, observed competition, cross-store
        confirmation, and ratings within each storefront; Research Confidence is reported separately. Competition is
        measured in the sampled catalogue only. Material-change alerts compare like-for-like formula and taxonomy
        versions; missing history remains pending rather than becoming zero.
      </p>
    </Panel>
  );
}

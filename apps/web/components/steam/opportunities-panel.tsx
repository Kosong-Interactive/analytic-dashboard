import type { PlatformLabelSignal } from "@analytic-dashboard/analytics";
import Link from "next/link";

import { formatRelative } from "@/lib/format/format";
import { getPlatformDatasets } from "@/lib/steam/get-compare";
import { selectOpportunities, type SteamOpportunityCard } from "@/lib/steam/opportunities";
import {
  compareTypeLabels,
  COMPARED_PLATFORMS,
  modeHints,
  modeLabels,
  platformColumnLabels,
  type ComparedPlatform,
} from "@/lib/steam/platform-compare";

import { EmptyState, Panel } from "../overview/panel";

export function percentileText(value: number): string {
  return `top ${Math.max(1, Math.round((1 - value) * 100))}%`;
}

export function signalLine(platform: ComparedPlatform, signal: PlatformLabelSignal | undefined, available: boolean): string {
  const name = platformColumnLabels[platform];
  if (!available) return `${name}: unavailable`;
  if (!signal) return `${name}: no tracked games`;
  const rank = signal.momentumPercentile === null ? "not ranked yet" : `momentum ${percentileText(signal.momentumPercentile)}`;
  return `${name}: ${rank} · ${signal.members} game${signal.members === 1 ? "" : "s"}${signal.newEntrants > 0 ? ` · ${signal.newEntrants} new` : ""}`;
}

export function evidenceHref(card: Pick<SteamOpportunityCard, "type" | "slug">, country: "id" | "us"): string {
  const base = `/steam/opportunities/${card.type}/${card.slug}`;
  return country === "id" ? base : `${base}?country=${country}`;
}

function Card({ card, available, country }: { card: SteamOpportunityCard; available: readonly ComparedPlatform[]; country: "id" | "us" }) {
  return (
    <li className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface-alt px-4 py-3.5">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] text-dim">{compareTypeLabels[card.type].replace(/s$/, "")}</p>
        <h3 className="text-sm font-semibold">{card.displayName}</h3>
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded border border-line-strong/70 px-1.5 py-px text-ink-soft" title={modeHints[card.mode]}>
            {modeLabels[card.mode]}
          </span>
          {card.confidence === "low" ? (
            <span
              className="rounded border border-line-strong/70 px-1.5 py-px text-dim"
              title="Fewer than two platforms could be measured, so treat this as an early signal"
            >
              Early signal
            </span>
          ) : null}
          <span className="text-dim">{card.measured} of {card.total} platforms measured</span>
        </p>
      </div>
      <p className="text-xs leading-5 text-ink-soft">{modeHints[card.mode]}.</p>
      <ul className="flex flex-col gap-0.5 text-[11.5px] text-ink-soft" aria-label="Evidence">
        {COMPARED_PLATFORMS.map((platform) => (
          <li key={platform}>{signalLine(platform, card.platforms[platform], available.includes(platform))}</li>
        ))}
      </ul>
      <details className="text-[11.5px] text-dim">
        <summary className="cursor-pointer list-none text-ink-soft underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
          Risks and caveats ({card.caveats.length})
        </summary>
        <ul className="mt-1 flex flex-col gap-1">
          {card.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      </details>
      <Link href={evidenceHref(card, country)} className="text-xs text-ink-soft underline-offset-2 hover:underline">
        View evidence
      </Link>
    </li>
  );
}

/** Loaded behind Suspense on the Desktop Overview, so the rest of the page never waits for the three platforms. */
export async function SteamOpportunitiesSection({ country }: { country: "id" | "us" }) {
  const { datasets, asOf, steamSource } = await getPlatformDatasets(country);
  const list = selectOpportunities({ datasets, asOf });

  return (
    <Panel
      title="Game Opportunities"
      description="Research directions from labels that stand out on Steam and mobile · platform_opportunity_v1"
      action={
        <Link href="/steam/compare" className="text-xs text-ink-soft underline-offset-2 hover:underline">
          Platform comparison
        </Link>
      }
    >
      {list.cards.length === 0 ? (
        <EmptyState title="No cross-platform direction yet">
          {list.available.length === 0
            ? "No platform could be loaded right now."
            : list.mobileMeasured
              ? "No label is strong on one platform and thinly represented, confirmed, or in conflict on another yet."
              : "Mobile Trend Scores need about 3.5 days of history, and directions need a measured strong side. They appear as soon as one platform stands out against another."}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 border-t border-line-soft p-4 md:grid-cols-2 xl:grid-cols-3">
          {list.cards.map((card) => (
            <Card key={card.key} card={card} available={list.available} country={country} />
          ))}
        </ul>
      )}
      <p className="border-t border-line-soft px-4 py-3 text-xs leading-5 text-dim">
        Steam collected {formatRelative(steamSource?.lastCollectedAt ?? null, asOf)} · mobile ranks as of{" "}
        {asOf.toISOString().slice(0, 16).replace("T", " ")} UTC · {list.candidates} of {list.assessed} labels reach a
        direction. Each platform is ranked against its own labels, never on one shared score, and a platform that is
        unavailable or not yet measurable counts as missing, not as weak. These are research signals from sampled charts,
        not market facts, and no Shortlist or Reject decision is stored for Desktop yet.
      </p>
    </Panel>
  );
}

export function SteamOpportunitiesFallback() {
  return (
    <div role="status" aria-live="polite" className="rounded-[10px] border border-line bg-surface p-4">
      <span className="sr-only">Loading game opportunities</span>
      <div className="h-4 w-48 animate-pulse rounded bg-surface-alt" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="h-40 animate-pulse rounded-[10px] bg-surface-alt" />
        ))}
      </div>
    </div>
  );
}

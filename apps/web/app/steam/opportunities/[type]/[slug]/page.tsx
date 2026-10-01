import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { DesktopDecisionPanel } from "@/components/steam/desktop-decision-panel";
import { percentileText, signalLine } from "@/components/steam/opportunities-panel";
import { requireUser } from "@/lib/auth/session";
import { formatRelative } from "@/lib/format/format";
import { getPlatformDatasets } from "@/lib/steam/get-compare";
import { getDesktopOpportunityDecisions } from "@/lib/steam/desktop-decisions";
import { buildLabelEvidence, OPPORTUNITY_MODES } from "@/lib/steam/opportunities";
import {
  compareTypeLabels,
  compareTypeValues,
  modeHints,
  modeLabels,
  platformColumnLabels,
  type CompareType,
} from "@/lib/steam/platform-compare";
import { parseSteamQuery } from "@/lib/steam/query";

interface EvidencePageProps {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const slugPattern = /^[a-z][a-z0-9_]{0,63}$/;

function isCompareType(value: string): value is CompareType {
  return (compareTypeValues as readonly string[]).includes(value);
}

export const metadata = { title: "Opportunity Evidence · Game Analytic" };

export default async function OpportunityEvidencePage({ params, searchParams }: EvidencePageProps) {
  const { type, slug } = await params;
  await requireUser(`/steam/opportunities/${type}/${slug}`);
  if (!isCompareType(type) || !slugPattern.test(slug)) notFound();
  const { country } = parseSteamQuery({ country: (await searchParams).country });
  const { datasets, asOf, steamSource } = await getPlatformDatasets(country);
  const evidence = buildLabelEvidence({ datasets, type, slug, asOf });
  if (!evidence) notFound();
  const decisions = await getDesktopOpportunityDecisions({ country, labelType: type, labelSlug: slug });
  const { row } = evidence;
  const countryQuery = country === "id" ? "" : `&country=${country}`;

  return (
    <AppShell filters={{ country, platform: "all" }} active="steam-overview" noCounterpart>
      <div className="flex flex-col gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-dim">
          <Link href={country === "id" ? "/steam" : `/steam?country=${country}`} className="hover:text-ink">Overview</Link>
          <ChevronRight aria-hidden className="size-3" />
          <Link href={`/steam/compare?type=${type}${countryQuery}`} className="hover:text-ink">Platform comparison</Link>
          <ChevronRight aria-hidden className="size-3" />
          <span aria-current="page" className="truncate text-ink-soft">{row.displayName}</span>
        </nav>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-dim">{compareTypeLabels[type].replace(/s$/, "")}</p>
          <h1 className="text-[26px] font-semibold tracking-tight">{row.displayName}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded border border-line-strong/70 px-1.5 py-px text-ink-soft">{modeLabels[row.opportunity.mode]}</span>
            <span className="text-dim">{row.opportunity.confidence} confidence · {row.measured} of {row.total} platforms measured</span>
          </p>
          <p className="text-[15px] text-dim">{modeHints[row.opportunity.mode]}.</p>
        </div>
      </div>

      <Panel title="Why this signal" description={`${row.opportunity.formulaVersion} · within-platform ranks, never one shared score`}>
        <ul className="flex flex-col gap-1 border-t border-line-soft px-4 py-3 text-[15px] text-ink-soft">
          {row.opportunity.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </Panel>

      {OPPORTUNITY_MODES.includes(row.opportunity.mode) ? (
        <DesktopDecisionPanel
          decisions={decisions}
          country={country}
          labelType={type}
          labelSlug={slug}
        />
      ) : null}

      <Panel title="Platform signals" description="Each platform ranks this label against its own labels by median trend score">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[15px]">
            <caption className="sr-only">Signals for {row.displayName} by platform</caption>
            <thead>
              <tr className="h-[34px] border-y border-line bg-surface-alt text-[13px] font-medium text-dim">
                <th scope="col" className="pl-4 text-left font-medium">Platform</th>
                <th scope="col" className="text-right font-medium">Tracked games</th>
                <th scope="col" className="text-right font-medium">Share of catalogue</th>
                <th scope="col" className="text-right font-medium">Scored games</th>
                <th scope="col" className="text-right font-medium">Median score</th>
                <th scope="col" className="text-left font-medium">Momentum rank</th>
                <th scope="col" className="pr-4 text-right font-medium">New (7 days)</th>
              </tr>
            </thead>
            <tbody>
              {evidence.platforms.map(({ platform, available, signal }) => (
                <tr key={platform} className="h-10 border-b border-line-soft">
                  <th scope="row" className="pl-4 text-left font-medium">{platformColumnLabels[platform]}</th>
                  {!available ? (
                    <td colSpan={6} className="px-2 text-dim">Unavailable: could not be loaded</td>
                  ) : !signal ? (
                    <td colSpan={6} className="px-2 text-dim">No tracked games carry this label</td>
                  ) : (
                    <>
                      <td className="px-2 text-right font-mono text-sm">{signal.members}</td>
                      <td className="px-2 text-right font-mono text-sm">{(signal.share * 100).toFixed(1)}%</td>
                      <td className="px-2 text-right font-mono text-sm">{signal.scoredMembers}</td>
                      <td className="px-2 text-right font-mono text-sm">{signal.momentum === null ? "—" : Math.round(signal.momentum)}</td>
                      <td className="px-2 text-sm">
                        {signal.momentumPercentile === null ? <span className="text-dim">Not ranked yet</span> : percentileText(signal.momentumPercentile)}
                      </td>
                      <td className="px-2 pr-4 text-right font-mono text-sm">{signal.newEntrants}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {evidence.platforms.map(({ platform, available, signal, games }) => (
          <Panel key={platform} title={`Comparable games · ${platformColumnLabels[platform]}`} description={signalLine(platform, signal, available)}>
            {games.length === 0 ? (
              <EmptyState title={available ? "No tracked games" : "Unavailable"}>
                {available ? "No tracked game on this platform carries the label." : "This platform could not be loaded."}
              </EmptyState>
            ) : (
              <ul className="flex flex-col border-t border-line-soft text-[15px]">
                {games.map((game) => (
                  <li key={game.id} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
                    <Link href={game.href} className="truncate hover:underline">{game.title}</Link>
                    <span className="shrink-0 font-mono text-sm text-dim">{game.score === null ? "not scored" : `score ${Math.round(game.score)}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ))}
      </div>

      <Panel title="Risks and caveats" description="What limits this signal">
        <ul className="flex flex-col gap-1 border-t border-line-soft px-4 py-3 text-[15px] text-ink-soft">
          {evidence.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
        <p className="border-t border-line-soft px-4 py-3 text-sm leading-5 text-dim">
          Steam collected {formatRelative(steamSource?.lastCollectedAt ?? null, asOf)}; mobile ranks as of{" "}
          {asOf.toISOString().slice(0, 16).replace("T", " ")} UTC. Labels are inferences from titles, tags, and
          descriptions, and a label&apos;s rank is a research signal, not a market fact or a prediction.{" "}
          <Link href={`/steam/games?label=${type}:${slug}${countryQuery}`} className="text-ink-soft underline-offset-2 hover:underline">
            Browse the Steam games with this label
          </Link>
          .
        </p>
      </Panel>
    </AppShell>
  );
}

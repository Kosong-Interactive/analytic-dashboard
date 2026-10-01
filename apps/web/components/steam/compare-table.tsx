import type { PlatformLabelSignal } from "@analytic-dashboard/analytics";
import Link from "next/link";

import {
  COMPARED_PLATFORMS,
  modeHints,
  modeLabels,
  platformColumnLabels,
  type ComparedPlatform,
  type PlatformComparisonRow,
} from "@/lib/steam/platform-compare";

function percentileText(value: number): string {
  return `Top ${Math.max(1, Math.round((1 - value) * 100))}%`;
}

function Cell({ signal, available }: { signal: PlatformLabelSignal | undefined; available: boolean }) {
  if (!available) return <span className="text-dim" title="This platform could not be loaded">Unavailable</span>;
  if (!signal) return <span className="text-dim" title="No tracked game of this platform carries the label">No games</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-mono text-sm">
        {signal.momentumPercentile === null ? (
          <span className="text-dim" title={`Needs ${3} scored games and at least 5 labels to rank`}>Not ranked yet</span>
        ) : (
          <>
            {percentileText(signal.momentumPercentile)}
            <span className="ml-1.5 text-dim">median {Math.round(signal.momentum ?? 0)}</span>
          </>
        )}
      </span>
      <span className="text-[13px] text-dim">
        {signal.members} game{signal.members === 1 ? "" : "s"} · {signal.scoredMembers} scored
        {signal.newEntrants > 0 ? ` · ${signal.newEntrants} new` : ""}
      </span>
    </span>
  );
}

/**
 * Each cell ranks the label inside its own platform; the three scores are never put on one scale.
 * All values are text, so rank is never carried by colour or position alone.
 */
export function PlatformCompareTable({
  rows,
  available,
  caption,
  gamesHref,
}: {
  rows: PlatformComparisonRow[];
  available: readonly ComparedPlatform[];
  caption: string;
  gamesHref: (row: PlatformComparisonRow) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-[15px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="h-[34px] border-y border-line bg-surface-alt text-[13px] font-medium text-dim">
            <th scope="col" className="pl-4 text-left font-medium">Label</th>
            {COMPARED_PLATFORMS.map((platform) => (
              <th key={platform} scope="col" className="text-left font-medium">
                {platformColumnLabels[platform]} · momentum rank
              </th>
            ))}
            <th scope="col" className="text-left font-medium">Signal</th>
            <th scope="col" className="pr-4 text-right font-medium">Platforms measured</th>
          </tr>
        </thead>
        <tbody className="[&_td]:px-2 [&_td]:align-top">
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-line-soft hover:bg-[#13161a]">
              <td className="py-3 pl-4 font-medium">
                <Link href={gamesHref(row)} className="hover:underline">
                  {row.displayName}
                  <span className="sr-only"> — view Steam games</span>
                </Link>
              </td>
              {COMPARED_PLATFORMS.map((platform) => (
                <td key={platform} className="py-3">
                  <Cell signal={row.platforms[platform]} available={available.includes(platform)} />
                </td>
              ))}
              <td className="py-3">
                <details>
                  <summary className="cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">
                    <span className="rounded border border-line-strong/70 px-1.5 py-px text-ink-soft" title={modeHints[row.opportunity.mode]}>
                      {modeLabels[row.opportunity.mode]}
                    </span>
                    <span className="ml-1.5 text-[13px] text-dim">{row.opportunity.confidence} confidence</span>
                  </summary>
                  <ul className="mt-1.5 flex max-w-[16rem] flex-col gap-0.5 text-[13.5px] text-ink-soft">
                    <li>{modeHints[row.opportunity.mode]}</li>
                    {row.opportunity.reasons.map((reason) => (
                      <li key={reason} className="text-dim">{reason}</li>
                    ))}
                  </ul>
                </details>
              </td>
              <td className="py-3 pr-4 text-right font-mono text-sm text-ink-soft">
                {row.measured} of {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { trendTier } from "@analytic-dashboard/analytics";
import Link from "next/link";

import type { LabelStats } from "@/lib/labels/aggregate";
import { cn } from "@/lib/utils";

import { GameIcon } from "../games/game-icon";
import { tierStyles } from "../overview/score-breakdown";

function percent(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

function Momentum({ label }: { label: LabelStats }) {
  if (label.momentum === null) {
    return <span className="text-dim" title="No member game has a Trend Score yet">—</span>;
  }
  const style = tierStyles[trendTier(label.momentum)];
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      {Math.round(label.momentum)}
      <span className={cn("font-sans text-[11px]", style.text)}>{style.label}</span>
      <span className="font-sans text-[11px] text-dim">({label.scoredGames} scored)</span>
    </span>
  );
}

function ShareBar({ label, max }: { label: LabelStats; max: number }) {
  const width = max === 0 ? 0 : (label.share / max) * 100;
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-2 w-24 shrink-0 rounded-sm bg-[#1a1d22] sm:w-32">
        <span className="block h-2 rounded-sm bg-accent" style={{ width: `${width}%` }} />
      </span>
      <span className="font-mono text-xs text-ink-soft">{percent(label.share)}</span>
    </span>
  );
}

function TopGames({ label }: { label: LabelStats }) {
  return (
    <span className="flex items-center gap-1.5">
      {label.topGames.map((game) => (
        <Link key={game.id} href={`/games/${game.id}`} title={game.title} className="rounded-[22%] focus-visible:outline-2 focus-visible:outline-accent">
          <GameIcon title={game.title} iconUrl={game.iconUrl} size={24} />
          <span className="sr-only">{game.title}</span>
        </Link>
      ))}
    </span>
  );
}

/** Table from `md` up, cards below; every value is text, so the bar is never the only encoding. */
export function LabelTable({
  labels,
  caption,
  hrefFor,
}: {
  labels: LabelStats[];
  caption: string;
  /** Games list for one label; the name links there. */
  hrefFor: (label: LabelStats) => string;
}) {
  const max = Math.max(0, ...labels.map((l) => l.share));
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="h-[34px] border-y border-line bg-surface-alt text-left text-[11px] text-dim">
              <th scope="col" className="pl-4 font-medium">Label</th>
              <th scope="col" className="px-2 text-right font-medium">Games</th>
              <th scope="col" className="px-2 font-medium">Share of tracked</th>
              <th scope="col" className="px-2 text-right font-medium">New (7d)</th>
              <th scope="col" className="px-2 text-right font-medium">Avg rating</th>
              <th scope="col" className="px-2 font-medium">Momentum</th>
              <th scope="col" className="pr-4 font-medium">Top games</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label.slug} className="h-11 border-b border-line-soft hover:bg-[#13161a]">
                <th scope="row" className="pl-4 text-left font-medium">
                  <Link href={hrefFor(label)} className="underline-offset-2 hover:underline">
                    {label.displayName}
                  </Link>
                </th>
                <td className="px-2 text-right font-mono text-xs">{label.games}</td>
                <td className="px-2"><ShareBar label={label} max={max} /></td>
                <td className="px-2 text-right font-mono text-xs text-ink-soft">{label.newlyDiscovered7d}</td>
                <td className="px-2 text-right font-mono text-xs">{label.averageRating === null ? "—" : label.averageRating.toFixed(2)}</td>
                <td className="px-2"><Momentum label={label} /></td>
                <td className="pr-4"><TopGames label={label} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden" aria-label={caption}>
        {labels.map((label) => (
          <li key={label.slug} className="flex flex-col gap-2 border-t border-line-soft px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Link href={hrefFor(label)} className="font-medium underline-offset-2 hover:underline">
                {label.displayName}
              </Link>
              <TopGames label={label} />
            </div>
            <ShareBar label={label} max={max} />
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-[11px] text-dim">Games</dt><dd className="font-mono">{label.games}</dd></div>
              <div><dt className="text-[11px] text-dim">New (7d)</dt><dd className="font-mono">{label.newlyDiscovered7d}</dd></div>
              <div><dt className="text-[11px] text-dim">Avg rating</dt><dd className="font-mono">{label.averageRating === null ? "—" : label.averageRating.toFixed(2)}</dd></div>
            </dl>
            <Momentum label={label} />
          </li>
        ))}
      </ul>
    </>
  );
}

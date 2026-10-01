import Link from "next/link";

import { formatCount } from "@/lib/format/format";
import type { SteamLabelStats } from "@/lib/steam/label-overview";
import { formatRatio } from "@/lib/steam/format";
import { cn } from "@/lib/utils";

const HEADERS = ["Label", "Share of tracked", "Games", "Players now", "Positive reviews", "In Most Played", "Top games"];
const NUMERIC = new Set([2, 3, 4, 5]);

function percent(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

/** Every value is text, so the share bar is never the only encoding. */
export function SteamLabelTable({
  labels,
  caption,
  hrefFor,
}: {
  labels: SteamLabelStats[];
  caption: string;
  /** Games list filtered to one label. */
  hrefFor: (label: SteamLabelStats) => string;
}) {
  const maxShare = Math.max(0, ...labels.map((label) => label.share));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-[15px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="h-[34px] border-y border-line bg-surface-alt text-[13px] font-medium text-dim">
            {HEADERS.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-2 font-medium",
                  index === 0 && "pl-4",
                  index === HEADERS.length - 1 && "pr-4",
                  NUMERIC.has(index) ? "text-right" : "text-left",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:px-2">
          {labels.map((label) => (
            <tr key={`${label.type}:${label.slug}`} className="h-[46px] border-b border-line-soft hover:bg-[#13161a]">
              <td className="pl-4 font-medium">
                <Link href={hrefFor(label)} className="hover:underline">
                  {label.displayName}
                  <span className="sr-only"> — view games</span>
                </Link>
              </td>
              <td>
                <span className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-24 shrink-0 rounded-sm bg-[#1a1d22] sm:w-32">
                    <span
                      className="block h-2 rounded-sm bg-accent"
                      style={{ width: `${maxShare === 0 ? 0 : (label.share / maxShare) * 100}%` }}
                    />
                  </span>
                  <span className="font-mono text-sm text-ink-soft">{percent(label.share)}</span>
                </span>
              </td>
              <td className="text-right font-mono text-sm">{label.games}</td>
              <td className="text-right font-mono text-sm">{formatCount(label.currentPlayers)}</td>
              <td className="text-right font-mono text-sm">{formatRatio(label.averagePositive)}</td>
              <td className="text-right font-mono text-sm text-ink-soft">{label.onMostPlayed}</td>
              <td className="pr-4">
                <span className="flex max-w-[22rem] flex-wrap gap-x-3 gap-y-0.5 text-sm">
                  {label.topGames.map((game) => (
                    <Link key={game.externalId} href={`/steam/games/${game.externalId}`} className="truncate text-ink-soft hover:underline">
                      {game.title}
                    </Link>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

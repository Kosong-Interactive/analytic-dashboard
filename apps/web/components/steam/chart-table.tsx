import type { SteamChartRow } from "@analytic-dashboard/db";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import Link from "next/link";

import { formatCount } from "@/lib/format/format";
import { formatPrice, formatRatio, positiveRatio, rankChange } from "@/lib/steam/format";
import type { SteamQuery } from "@/lib/steam/query";
import { cn } from "@/lib/utils";

import { SteamThumb } from "./steam-thumb";

function Change({ rank, lastWeekRank }: { rank: number; lastWeekRank: number | null }) {
  const value = rankChange(rank, lastWeekRank);
  if (value === null) return <span className="text-dim" title="Steam gave no last-week rank">—</span>;
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  const color = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-dim";
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-xs", color)}>
      <Icon aria-hidden className="size-[11px]" strokeWidth={2.4} />
      {Math.abs(value)}
      <span className="sr-only">{value > 0 ? " places up" : value < 0 ? " places down" : " unchanged"}</span>
    </span>
  );
}

function gameHref(row: SteamChartRow, query: SteamQuery): string {
  return query.country === "id" ? `/steam/games/${row.externalId}` : `/steam/games/${row.externalId}?country=${query.country}`;
}

const HEADERS = ["#", "Game", "Players now", "Positive reviews", "Reviews", "Price", "Vs last week"];

export function SteamChartTable({ rows, query, caption }: { rows: SteamChartRow[]; query: SteamQuery; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="h-[34px] border-y border-line bg-surface-alt text-[11px] font-medium text-dim">
            {HEADERS.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-2 font-medium",
                  index === 0 && "pl-4",
                  index === HEADERS.length - 1 && "pr-4",
                  index >= 2 && index <= 4 ? "text-right" : "text-left",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:px-2">
          {rows.map((row) => (
            <tr key={row.steamAppId} className="h-[52px] border-b border-line-soft hover:bg-[#13161a]">
              <td className="pl-4 font-mono text-xs text-dim">{row.rank}</td>
              <td>
                <Link href={gameHref(row, query)} className="flex items-center gap-2.5 font-medium hover:underline">
                  <SteamThumb imageUrl={row.headerImageUrl} width={64} />
                  <span className="max-w-[18rem] truncate">{row.title}</span>
                </Link>
              </td>
              <td className="text-right font-mono text-xs">{formatCount(row.snapshot?.currentPlayers ?? null)}</td>
              <td className="text-right font-mono text-xs">{formatRatio(positiveRatio(row.snapshot))}</td>
              <td className="text-right font-mono text-xs text-ink-soft">{formatCount(row.snapshot?.reviewTotal ?? null)}</td>
              <td className="whitespace-nowrap font-mono text-xs text-ink-soft">
                {formatPrice(row.prices[query.country], row.isFree)}
              </td>
              <td className="pr-4"><Change rank={row.rank} lastWeekRank={row.lastWeekRank} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { ArrowDown, ArrowUp, Minus, Star } from "lucide-react";

import { formatCount, formatSigned, initials } from "@/lib/format/format";
import { countryLabels, platformLabels } from "@/lib/overview/filters";
import type { OverviewFilters } from "@/lib/overview/filters";
import type { OverviewData, TrendingRow } from "@/lib/overview/view-model";
import { cn } from "@/lib/utils";

import { EmptyState, Panel } from "./panel";
import { ScoreBreakdown } from "./score-breakdown";

const HEADERS: Array<{ label: string; align?: "right" }> = [
  { label: "#" },
  { label: "Game" },
  { label: "Developer" },
  { label: "Platform" },
  { label: "Category" },
  { label: "Rating", align: "right" },
  { label: "Ratings", align: "right" },
  { label: "Ratings / day", align: "right" },
  { label: "Rank change (7d)" },
  { label: "Trend score" },
];

function RankChange({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-dim" title="No chart position history for this game">—</span>;
  }
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

function Row({ row }: { row: TrendingRow }) {
  return (
    <tr className="h-[46px] border-b border-line-soft hover:bg-[#13161a]">
      <td className="pl-4 font-mono text-xs text-dim">{row.rank}</td>
      <td>
        <a
          href={row.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 font-medium hover:underline"
        >
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-accent/80 font-mono text-[11px] font-medium text-canvas"
          >
            {initials(row.title)}
          </span>
          <span className="max-w-[16rem] truncate">{row.title}</span>
        </a>
      </td>
      <td className="max-w-[9rem] truncate text-dim">{row.developer ?? "—"}</td>
      <td className="text-[11.5px] text-ink-soft">{platformLabels[row.store]}</td>
      <td className="max-w-[9rem] truncate text-[11.5px] text-ink-soft">{row.category ?? "—"}</td>
      <td className="text-right font-mono text-xs">
        {row.rating === null ? (
          "—"
        ) : (
          <span className="inline-flex items-center gap-1">
            <Star aria-hidden className="size-[11px] fill-star text-star" />
            {row.rating.toFixed(1)}
          </span>
        )}
      </td>
      <td className="text-right font-mono text-xs text-ink-soft">{formatCount(row.ratingCount)}</td>
      <td
        className={cn(
          "text-right font-mono text-xs",
          row.ratingCountPerDay !== null && row.ratingCountPerDay < 0 ? "text-down" : "text-up",
        )}
      >
        {row.ratingCountPerDay === null ? <span className="text-dim">—</span> : formatSigned(row.ratingCountPerDay, 1)}
      </td>
      <td>
        <RankChange value={row.rankChange} />
      </td>
      <td className="pr-4">
        <ScoreBreakdown row={row} />
      </td>
    </tr>
  );
}

function historyNote(historyDays: number | null): string {
  if (historyDays === null) return "No observations have been collected for this selection yet.";
  return `Collected history so far: ${historyDays.toFixed(1)} days. Scores need at least half of the 7-day window (3.5 days) and three comparable games.`;
}

export function TrendingTable({
  data,
  filters,
}: {
  data: OverviewData;
  filters: OverviewFilters;
}) {
  const { trending, kpis } = data;
  const description = `Ranked by Trend Score · ${countryLabels[filters.country]} · ${platformLabels[filters.platform]} · last 7 days · scored within each store`;

  return (
    <Panel title="Trending Games" description={description}>
      {trending.length === 0 ? (
        <EmptyState title="No games scored yet">{historyNote(data.historyDays)}</EmptyState>
      ) : (
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full border-collapse text-[13px]">
            <caption className="sr-only">
              Top {trending.length} of {kpis.scoredCount} scored games by Trend Score
            </caption>
            <thead>
              <tr className="h-[34px] border-y border-line bg-surface-alt text-[11px] font-medium text-dim">
                {HEADERS.map((header, index) => (
                  <th
                    key={header.label}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-2 font-medium",
                      index === 0 && "pl-4",
                      index === HEADERS.length - 1 && "pr-4",
                      header.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_td]:px-2">
              {trending.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-line-soft px-4 py-3 text-xs text-dim">
        {kpis.scoredCount > 0
          ? `Showing ${trending.length} of ${kpis.scoredCount} scored games (${kpis.tracked - kpis.scoredCount} tracked games lack enough history to score).`
          : `${kpis.tracked} tracked games, none scored yet.`}
      </p>
    </Panel>
  );
}

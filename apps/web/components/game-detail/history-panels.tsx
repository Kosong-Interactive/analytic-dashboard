import { formatCount } from "@/lib/format/format";
import type { GameDetailView, SeriesPoint } from "@/lib/games/view-model";

import { EmptyState, Panel } from "../overview/panel";
import { HistoryChart } from "./history-chart";

/** Plain-language reading of a series, so the chart is never the only way to get the data. */
function summarize(points: SeriesPoint[], format: (v: number) => string, lowerIsBetter = false): string {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return "No observations yet.";
  if (points.length === 1) return `One observation so far: ${format(last.value)} on ${last.at.slice(0, 10)}.`;
  const delta = last.value - first.value;
  let direction = "unchanged";
  if (delta !== 0) {
    const better = lowerIsBetter ? delta < 0 : delta > 0;
    direction = better ? "up" : "down";
  }
  return `${format(first.value)} on ${first.at.slice(0, 10)} → ${format(last.value)} on ${last.at.slice(0, 10)} (${direction}, ${points.length} observations).`;
}

function ChartPanel({
  title,
  description,
  points,
  summary,
  emptyText,
  invert,
  decimals,
  label,
}: {
  title: string;
  description: string;
  points: SeriesPoint[];
  summary: string;
  emptyText: string;
  invert?: boolean;
  decimals?: number;
  label: string;
}) {
  return (
    <Panel title={title} description={description}>
      {points.length < 2 ? (
        <EmptyState title={points.length === 0 ? "No history yet" : "Only one observation"}>
          {points.length === 0 ? emptyText : summary}
        </EmptyState>
      ) : (
        <div className="px-2 pb-3">
          <HistoryChart points={points} label={label} invert={invert} decimals={decimals} />
          <p className="px-2 text-xs text-dim">{summary}</p>
        </div>
      )}
    </Panel>
  );
}

export function HistoryPanels({ view }: { view: GameDetailView }) {
  const { series } = view;
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartPanel
        title="Ratings over time"
        description="Total store ratings · stored on change, drawn as steps"
        points={series.ratingCount}
        summary={summarize(series.ratingCount, formatCount)}
        emptyText="The store has not reported a rating count for this listing yet."
        label="Ratings"
      />
      <ChartPanel
        title="Chart rank over time"
        description="Top Free games chart · lower is better"
        points={series.rank}
        summary={summarize(series.rank, (v) => `#${v}`, true)}
        emptyText="This listing has not appeared in a tracked chart. App Store charts are not collected yet."
        invert
        label="Rank"
      />
      <ChartPanel
        title="Average rating over time"
        description="Store rating out of 5"
        points={series.rating}
        summary={summarize(series.rating, (v) => v.toFixed(2))}
        emptyText="The store has not reported a rating for this listing yet."
        decimals={2}
        label="Rating"
      />
    </div>
  );
}

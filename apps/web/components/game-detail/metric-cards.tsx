import { formatCount, formatRelative, formatSigned } from "@/lib/format/format";
import type { GameDetailView } from "@/lib/games/view-model";
import { cn } from "@/lib/utils";

import { tierStyles } from "../overview/score-breakdown";

function rawOf(view: GameDetailView, component: string): number | null {
  return view.score.components.find((c) => c.component === component)?.raw ?? null;
}

export function MetricCards({ view }: { view: GameDetailView }) {
  const { latest, score, asOf } = view;
  const perDay = rawOf(view, "ratingCountVelocity7d");
  const rankGain = rawOf(view, "rankGain7d");
  const tier = score.tier ? tierStyles[score.tier] : null;

  const items = [
    {
      label: "Rating",
      value: latest.rating === null ? "—" : latest.rating.toFixed(2),
      note: latest.rating === null ? "not reported" : "out of 5, latest observation",
    },
    {
      label: "Ratings",
      value: formatCount(latest.ratingCount),
      note: latest.ratingCount === null ? "not reported" : "total ratings on the store",
    },
    {
      label: "Ratings / day",
      value: perDay === null ? "—" : formatSigned(perDay, 1),
      note: perDay === null ? "needs 3.5+ days of history" : "average over the last 7 days",
    },
    {
      label: "Chart rank",
      value: latest.rank ? `#${latest.rank.rank}` : "—",
      note: latest.rank ? `${latest.rank.chartType.replace("_", " ").toLowerCase()} · ${formatRelative(latest.rank.capturedAt, asOf)}` : "not seen in a tracked chart",
    },
    {
      label: "Rank change (7d)",
      value: rankGain === null ? "—" : formatSigned(rankGain),
      note: rankGain === null ? "not measurable yet" : "positions; positive means rising",
    },
    {
      label: "Trend score",
      value: score.value === null ? "—" : String(Math.round(score.value)),
      note: tier ? tier.label : "not scored yet",
      tone: tier?.text,
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <li key={item.label} className="flex flex-col justify-between gap-2 rounded-[10px] border border-line bg-surface px-4 py-3.5">
          <span className="text-xs text-dim">{item.label}</span>
          <div className="flex flex-col gap-1">
            <span className="text-[22px] font-semibold leading-none tracking-tight">{item.value}</span>
            <span className={cn("text-xs text-dim", item.tone)}>{item.note}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

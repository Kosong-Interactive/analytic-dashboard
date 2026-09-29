import type { TrendComponent, TrendTier } from "@analytic-dashboard/analytics";

import { formatCount, formatSigned } from "@/lib/format/format";
import type { TrendingRow } from "@/lib/overview/view-model";
import { cn } from "@/lib/utils";

export const tierStyles: Record<TrendTier, { label: string; text: string; bar: string }> = {
  exploding: { label: "Exploding", text: "text-tier-exploding", bar: "bg-tier-exploding" },
  trending: { label: "Trending", text: "text-tier-trending", bar: "bg-tier-trending" },
  growing: { label: "Growing", text: "text-tier-growing", bar: "bg-tier-growing" },
  low: { label: "Low", text: "text-tier-low", bar: "bg-tier-low" },
};

const componentLabels: Record<TrendComponent, string> = {
  rankGain7d: "Chart rank gain (7d)",
  reviewVelocity7d: "Review velocity (7d)",
  ratingCountVelocity7d: "Rating-count velocity (7d)",
  countryBreadthGrowth: "Country breadth growth",
  discoveryRecency: "Discovery recency",
  ratingMomentum: "Rating momentum (7d)",
};

function describeRaw(component: TrendComponent, raw: number | null): string {
  if (raw === null) return "not measurable yet";
  switch (component) {
    case "rankGain7d":
      return `${formatSigned(raw)} positions`;
    case "reviewVelocity7d":
    case "ratingCountVelocity7d":
      return `${formatSigned(raw, 1)} per day`;
    case "countryBreadthGrowth":
      return `${formatSigned(raw)} storefronts`;
    case "discoveryRecency":
      return `${Math.round(raw * 100)}% of horizon left`;
    case "ratingMomentum":
      return `${formatSigned(raw, 2)} stars`;
  }
}

export function ScoreBreakdown({ row }: { row: TrendingRow }) {
  const style = tierStyles[row.tier];
  const measured = row.components.filter((c) => c.contribution !== null);

  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"
        aria-label={`Trend score ${Math.round(row.score)}, ${style.label}. Show score breakdown`}
      >
        <span className="w-[22px] text-right font-mono text-[12.5px] font-medium">
          {Math.round(row.score)}
        </span>
        <span className="h-1 w-11 shrink-0 rounded-sm bg-[#22262c]" aria-hidden>
          <span
            className={cn("block h-1 rounded-sm", style.bar)}
            style={{ width: `${Math.min(100, Math.max(0, row.score))}%` }}
          />
        </span>
        <span className={cn("text-[11px]", style.text)}>{style.label}</span>
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-line-strong bg-surface-alt p-3 text-left shadow-xl">
        <p className="text-xs font-medium">How this score was built</p>
        <p className="mt-1 text-[11px] leading-4 text-dim">
          trend_score_v1 · based on {Math.round(row.weightCoverage * 100)}% of the score weight.
          Unmeasurable components are left out, not counted as zero.
        </p>
        <table className="mt-2 w-full text-[11px]">
          <caption className="sr-only">Trend score components</caption>
          <thead className="text-dim">
            <tr>
              <th scope="col" className="pb-1 text-left font-medium">Component</th>
              <th scope="col" className="pb-1 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {row.components.map((c) => (
              <tr key={c.component} className="border-t border-line-soft align-top">
                <th scope="row" className="py-1 pr-2 text-left font-normal text-ink-soft">
                  {componentLabels[c.component]}
                  <span className="block text-dim">
                    {describeRaw(c.component, c.raw)} · weight {Math.round(c.weight * 100)}%
                  </span>
                </th>
                <td className="py-1 text-right font-mono">
                  {c.contribution === null ? "—" : c.contribution.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong">
              <th scope="row" className="pt-1 text-left font-medium">Total</th>
              <td className="pt-1 text-right font-mono font-medium">
                {measured.length === 0 ? "—" : row.score.toFixed(1)}
              </td>
            </tr>
          </tfoot>
        </table>
        {row.latestObservationAt ? (
          <p className="mt-2 text-[11px] text-dim">
            Newest observation: {row.latestObservationAt.toISOString().slice(0, 16).replace("T", " ")} UTC
            {" · "}
            {formatCount(row.ratingCount)} ratings
          </p>
        ) : null}
      </div>
    </details>
  );
}

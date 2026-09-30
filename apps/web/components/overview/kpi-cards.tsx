import { formatRelative } from "@/lib/format/format";
import type { OverviewData } from "@/lib/overview/view-model";

import { InfoHint } from "../common/info-hint";

interface Kpi {
  label: string;
  tip: string;
  value: string;
  note: string;
}

export function KpiCards({ data }: { data: OverviewData }) {
  const { kpis, asOf } = data;
  const items: Kpi[] = [
    {
      label: "Games Tracked",
      tip: "Listings observed by this system for the selected storefront. A sampled set, not the full store catalogue.",
      value: kpis.tracked.toLocaleString("en-US"),
      note: "sampled from discovery seeds and charts",
    },
    {
      label: "Newly Discovered",
      tip: "Listings first observed by this system in the last 24 hours. This is not the store release date.",
      value: kpis.newlyDiscovered24h.toLocaleString("en-US"),
      note: "first observed in the last 24h",
    },
    {
      label: "Trending Games",
      tip: "Games with a Trend Score of 61 or higher. Trend Score is an internal, versioned score, not an official store label.",
      value: kpis.scoredCount === 0 ? "—" : kpis.trendingCount.toLocaleString("en-US"),
      note:
        kpis.scoredCount === 0
          ? "no games scored yet"
          : `of ${kpis.scoredCount.toLocaleString("en-US")} scored games`,
    },
    {
      label: "Last Collected",
      tip: "Finish time of the newest collector run that produced data for the selected sources.",
      value: formatRelative(kpis.lastCollectedAt, asOf),
      note: kpis.lastCollectedAt ? kpis.lastCollectedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "no successful run yet",
    },
  ];

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex h-[108px] flex-col justify-between rounded-[10px] border border-line bg-surface px-4 py-3.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-dim">{item.label}</span>
            <InfoHint label={item.label}>{item.tip}</InfoHint>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[26px] font-semibold leading-none tracking-tight">
              {item.value}
            </span>
            <span className="text-xs text-dim">{item.note}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

import { formatRelative } from "@/lib/format/format";
import { countryLabels } from "@/lib/overview/filters";
import type { OverviewData, SourceState } from "@/lib/overview/view-model";
import { cn } from "@/lib/utils";

import { EmptyState, Panel } from "./panel";

const STATE: Record<SourceState, { label: string; dot: string; text: string }> = {
  fresh: { label: "Fresh", dot: "bg-up", text: "text-up" },
  stale: { label: "Stale", dot: "bg-star", text: "text-star" },
  failed: { label: "Last run failed", dot: "bg-down", text: "text-down" },
  never: { label: "No data yet", dot: "bg-dim", text: "text-dim" },
};

const SOURCE_LABEL = { app_store: "App Store", google_play: "Google Play" } as const;
const JOB_LABEL: Record<string, string> = {
  "discovery.search": "keyword discovery",
  "discovery.chart": "chart discovery",
};

export function CoveragePanel({ data }: { data: OverviewData }) {
  const { sources, asOf } = data;

  return (
    <Panel
      title="Data coverage"
      description="Freshness of each collection source"
      className="xl:col-span-5"
    >
      {sources.length === 0 ? (
        <EmptyState title="No collector runs recorded">
          Run the collector or enable the scheduled workflow to populate this panel.
        </EmptyState>
      ) : (
        <ul>
          {sources.map((source) => {
            const state = STATE[source.state];
            return (
              <li
                key={source.key}
                className="flex items-center gap-3 border-t border-line-soft px-4 py-3"
              >
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", state.dot)} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px]">
                    {SOURCE_LABEL[source.source]}
                    <span className="text-dim">
                      {" "}
                      · {JOB_LABEL[source.jobType] ?? source.jobType} ·{" "}
                      {countryLabels[source.country as keyof typeof countryLabels] ?? source.country}
                    </span>
                  </span>
                  <span className="text-[11.5px] text-dim">
                    Last collected {formatRelative(source.lastCollectedAt, asOf)}
                    {source.latestErrorCount > 0
                      ? ` · latest run had ${source.latestErrorCount} error${source.latestErrorCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </div>
                <span className={cn("text-xs", state.text)}>{state.label}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-line-soft px-4 py-3 text-xs leading-5 text-dim">
        Coverage is sampled from discovery seeds, known IDs, and store charts. It is a research
        signal, not a complete catalogue, and install figures are ranges.
      </p>
    </Panel>
  );
}

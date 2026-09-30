import { formatRelative } from "@/lib/format/format";
import type { SteamSourceStatus } from "@/lib/overview/view-model";
import { cn } from "@/lib/utils";

const STATE = {
  fresh: { label: "fresh", dot: "bg-up" },
  stale: { label: "stale", dot: "bg-star" },
  failed: { label: "last run failed", dot: "bg-down" },
  never: { label: "no data yet", dot: "bg-dim" },
} as const;

/** Steam is one global source, so freshness is a single line with a warning when it is not fresh. */
export function SteamFreshness({ source, capturedAt, asOf }: { source: SteamSourceStatus; capturedAt: Date | null; asOf: Date }) {
  const state = STATE[source.state];
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-1.5 rounded-full", state.dot)} />
          Steam Global: collected {formatRelative(source.lastCollectedAt, asOf)} · {state.label}
        </span>
        {source.trackedGames > 0 ? <span>{source.trackedGames.toLocaleString("en-US")} games tracked</span> : null}
        {source.latestErrorCount > 0 ? (
          <span>
            latest run had {source.latestErrorCount} error{source.latestErrorCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {capturedAt ? <span>Chart captured {capturedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span> : null}
      </p>
      {source.state !== "fresh" ? (
        <p role="status" className="rounded-md border border-star/40 bg-star/10 px-3 py-2 text-xs text-ink-soft">
          Steam data is not fresh. Values below are the last successful collection.
        </p>
      ) : null}
    </div>
  );
}

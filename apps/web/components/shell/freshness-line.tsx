import { formatRelative } from "@/lib/format/format";
import type { StoreFreshness } from "@/lib/freshness/summary";
import { platformLabels } from "@/lib/overview/filters";
import type { SourceState } from "@/lib/overview/view-model";
import { cn } from "@/lib/utils";

const STATE: Record<SourceState, { label: string; dot: string }> = {
  fresh: { label: "fresh", dot: "bg-up" },
  stale: { label: "stale", dot: "bg-star" },
  failed: { label: "last run failed", dot: "bg-down" },
  never: { label: "no data yet", dot: "bg-dim" },
};

/** Store freshness next to derived results; a stale or failed source is called out, not hidden. */
export function FreshnessLine({ freshness, asOf }: { freshness: StoreFreshness[]; asOf: Date }) {
  const degraded = freshness.filter((store) => store.state !== "fresh");
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim" aria-label="Data freshness">
        {freshness.map((store) => (
          <li key={store.store} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-1.5 rounded-full", STATE[store.state].dot)} />
            {platformLabels[store.store]}: collected {formatRelative(store.lastCollectedAt, asOf)} ·{" "}
            {STATE[store.state].label}
          </li>
        ))}
      </ul>
      {degraded.length > 0 ? (
        <p role="status" className="rounded-md border border-star/40 bg-star/10 px-3 py-2 text-xs text-ink-soft">
          {degraded.map((store) => platformLabels[store.store]).join(" and ")}{" "}
          {degraded.length === 1 ? "data is" : "data are"} not fresh. Results below may be partial or out of date; other
          stores are shown as collected.
        </p>
      ) : null}
    </div>
  );
}

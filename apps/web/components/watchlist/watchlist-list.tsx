import Link from "next/link";

import { formatCount, formatRelative, formatSigned } from "@/lib/format/format";
import { platformLabels } from "@/lib/overview/filters";
import { watchlistStatusLabels } from "@/lib/watchlist/status";
import type { WatchlistRow } from "@/lib/watchlist/view-model";
import { cn } from "@/lib/utils";

import { GameIcon } from "../games/game-icon";
import { Rating } from "../games/game-table";
import { ScoreBreakdown } from "../overview/score-breakdown";
import { EntryEditor } from "./entry-editor";

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] text-dim">{label}</dt>
      <dd className="font-mono text-sm text-ink-soft">{children}</dd>
    </div>
  );
}

function Signed({ value, digits = 0 }: { value: number | null; digits?: number }) {
  if (value === null) return <span className="text-dim">—</span>;
  return <span className={cn(value > 0 && "text-up", value < 0 && "text-down")}>{formatSigned(value, digits)}</span>;
}

/** One card per entry: listing context, movement since it was added, current score, and the editor. */
export function WatchlistList({ rows, asOf }: { rows: WatchlistRow[]; asOf: Date }) {
  return (
    <ul aria-label="Watchlist entries">
      {rows.map(({ entry, current, ratingCountSinceAdded, ratingSinceAdded }) => (
        <li
          key={entry.storeAppId}
          className="grid grid-cols-1 gap-4 border-t border-line-soft px-4 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1.3fr)]"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <Link href={`/games/${entry.storeAppId}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
              <GameIcon title={entry.title} iconUrl={entry.iconUrl} size={36} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] font-medium">{entry.title}</span>
                <span className="truncate text-[13.5px] text-dim">
                  {entry.developerName ?? "Unknown developer"} · {platformLabels[entry.store]}
                </span>
              </span>
            </Link>
            <p className="text-[13.5px] text-dim">
              <span
                className={cn(
                  "mr-1.5 rounded border px-1.5 py-px text-[13px]",
                  entry.status === "priority" ? "border-accent/60 text-accent" : "border-line-strong text-ink-soft",
                )}
              >
                {watchlistStatusLabels[entry.status]}
              </span>
              Added by {entry.addedBy} {formatRelative(entry.addedAt, asOf)}
              {entry.updatedBy !== entry.addedBy || entry.updatedAt.getTime() !== entry.addedAt.getTime()
                ? ` · updated by ${entry.updatedBy} ${formatRelative(entry.updatedAt, asOf)}`
                : ""}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <dl className="grid grid-cols-3 gap-2">
              <Metric label="Rating">
                <Rating value={current?.rating ?? null} />
              </Metric>
              <Metric label="Ratings">{formatCount(current?.ratingCount ?? null)}</Metric>
              <Metric label="Ratings / day">
                <Signed value={current?.ratingCountPerDay ?? null} digits={1} />
              </Metric>
              <Metric label="Ratings since added">
                <Signed value={ratingCountSinceAdded} />
              </Metric>
              <Metric label="Rating since added">
                <Signed value={ratingSinceAdded} digits={2} />
              </Metric>
              <Metric label="Rank change (7d)">
                <Signed value={current?.rankChange ?? null} />
              </Metric>
            </dl>
            {current ? (
              <ScoreBreakdown row={current} />
            ) : (
              <p className="text-[13.5px] text-dim">No observations in this storefront selection.</p>
            )}
            <p className="text-[13px] text-dim">
              {entry.baselineCapturedAt
                ? `Baseline observed ${entry.baselineCapturedAt.toISOString().slice(0, 10)}`
                : "No observation existed when this game was added, so there is no baseline."}
            </p>
          </div>

          <EntryEditor storeAppId={entry.storeAppId} title={entry.title} status={entry.status} note={entry.note} />
        </li>
      ))}
    </ul>
  );
}

import { Star } from "lucide-react";
import Link from "next/link";

import { formatCount, formatRelative, initials } from "@/lib/format/format";
import { platformLabels } from "@/lib/overview/filters";
import type { OverviewData } from "@/lib/overview/view-model";

import { EmptyState, Panel } from "./panel";

export function DiscoveredList({ data }: { data: OverviewData }) {
  const { discovered, asOf } = data;

  return (
    <Panel
      title="Newly Discovered"
      description="First observed by this system. Release date is shown only when the store provides one."
      className="xl:col-span-7"
    >
      {discovered.length === 0 ? (
        <EmptyState title="Nothing discovered yet">
          Games appear here after the first collection run for this selection.
        </EmptyState>
      ) : (
        <ul>
          {discovered.map((game) => (
            <li
              key={game.id}
              className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5"
            >
              <span
                aria-hidden
                className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-accent/80 font-mono text-xs font-medium text-canvas"
              >
                {initials(game.title)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Link href={`/games/${game.id}`} className="truncate font-medium hover:underline">
                    {game.title}
                  </Link>
                  <span className="shrink-0 text-[11.5px] text-dim">{game.category ?? "—"}</span>
                </div>
                <p className="truncate text-[11.5px] text-dim">
                  {game.developer ?? "Unknown developer"} · discovered {formatRelative(game.firstSeenAt, asOf)}
                  {game.releaseDate
                    ? ` · released ${game.releaseDate.toISOString().slice(0, 10)}`
                    : ""}
                </p>
              </div>
              <span className="hidden text-[11.5px] text-ink-soft sm:inline">
                {platformLabels[game.store]}
              </span>
              <span className="inline-flex w-14 items-center justify-end gap-1 font-mono text-xs">
                {game.rating === null ? (
                  "—"
                ) : (
                  <>
                    <Star aria-hidden className="size-[11px] fill-star text-star" />
                    {game.rating.toFixed(1)}
                  </>
                )}
              </span>
              <span className="w-16 text-right font-mono text-xs text-ink-soft">
                {formatCount(game.ratingCount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

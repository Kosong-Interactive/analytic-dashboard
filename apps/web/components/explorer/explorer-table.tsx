import Link from "next/link";

import { formatCount, formatRelative } from "@/lib/format/format";
import type { ExplorerLabel, ExplorerRow } from "@/lib/explorer/list";
import { platformLabels } from "@/lib/overview/filters";
import { cn } from "@/lib/utils";

import { GameIcon } from "../games/game-icon";
import { Rating } from "../games/game-table";
import { ScoreBreakdown } from "../overview/score-breakdown";
import { RowActions, type RowActionContext } from "./row-actions";

const HEADERS = ["#", "Game", "Platform", "Category", "Genre · mechanic", "Released", "Rating", "Ratings", "Trend score", "First seen", "Action"];
const LABEL_HEADER = "Label";

const sourceNames = { rule: "Rule", ai: "AI", manual: "Confirmed" } as const;

/** How a game carries the label filter; an inference is never shown as a store fact. */
function MatchedLabel({ matched }: { matched: ExplorerRow["matchedLabel"] }) {
  if (!matched) return <span className="text-dim">—</span>;
  if (matched.source === "manual") return <span className="text-[11.5px] text-up">Confirmed manually</span>;
  return (
    <span className="whitespace-nowrap text-[11.5px] text-ink-soft">
      {sourceNames[matched.source]} · {Math.round(matched.confidence * 100)}%
    </span>
  );
}
/** Hidden until there is room, so the Action column always stays visible. */
const WIDE_ONLY = new Set(["First seen"]);
const RIGHT_ALIGNED = new Set(["Rating", "Ratings"]);

function releaseText(row: ExplorerRow): string {
  return row.releaseDate ? row.releaseDate.toISOString().slice(0, 10) : "—";
}

function Labels({ labels }: { labels: ExplorerLabel[] }) {
  if (labels.length === 0) return <span className="text-dim">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <span
          key={label.slug}
          className="rounded border border-line-strong/70 px-1.5 py-px text-[11px] text-ink-soft"
          title={label.source === "manual" ? "Confirmed manually" : `Inferred (${label.source})`}
        >
          {label.displayName}
          {label.source === "manual" ? <span className="sr-only"> (confirmed)</span> : null}
        </span>
      ))}
    </span>
  );
}

function GameLink({ row }: { row: ExplorerRow }) {
  return (
    <Link href={`/games/${row.id}`} className="flex min-w-0 items-center gap-2.5 hover:underline">
      <GameIcon title={row.title} iconUrl={row.iconUrl} size={28} />
      <span className="flex min-w-0 flex-col">
        <span className="max-w-[13rem] truncate font-medium">{row.title}</span>
        <span className="max-w-[13rem] truncate text-[11.5px] text-dim">{row.developer ?? "Unknown developer"}</span>
      </span>
    </Link>
  );
}

/** A table from `lg` up and a stack of cards below it, so small screens never need sideways scrolling. */
export function ExplorerTable({
  rows,
  caption,
  asOf,
  actions,
  showMatchedLabel = false,
}: {
  rows: ExplorerRow[];
  caption: string;
  asOf: Date;
  actions: RowActionContext;
  /** Adds a column saying how each game carries the label filter. */
  showMatchedLabel?: boolean;
}) {
  const headers = showMatchedLabel ? [...HEADERS.slice(0, 5), LABEL_HEADER, ...HEADERS.slice(5)] : HEADERS;
  return (
    <>
      <div className="hidden lg:block lg:overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="h-[34px] border-y border-line bg-surface-alt text-[11px] font-medium text-dim">
              {headers.map((header, index) => (
                <th
                  key={header}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-2 font-medium",
                    index === 0 && "pl-4",
                    index === headers.length - 1 && "pr-4",
                    RIGHT_ALIGNED.has(header) ? "text-right" : "text-left",
                    WIDE_ONLY.has(header) && "hidden 2xl:table-cell",
                  )}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_td]:px-2">
            {rows.map((row) => (
              <tr key={row.id} className="h-[52px] border-b border-line-soft hover:bg-[#13161a]">
                <td className="pl-4 font-mono text-xs text-dim">{row.rank}</td>
                <td><GameLink row={row} /></td>
                <td className="whitespace-nowrap text-[11.5px] text-ink-soft">{platformLabels[row.store]}</td>
                <td className="max-w-[8rem] truncate text-[11.5px] text-ink-soft">{row.category ?? "—"}</td>
                <td className="max-w-[12rem]"><Labels labels={[...row.genres, ...row.mechanics]} /></td>
                {showMatchedLabel ? <td><MatchedLabel matched={row.matchedLabel} /></td> : null}
                <td className="whitespace-nowrap font-mono text-xs text-ink-soft">{releaseText(row)}</td>
                <td className="text-right font-mono text-xs"><Rating value={row.rating} /></td>
                <td className="text-right font-mono text-xs text-ink-soft">{formatCount(row.ratingCount)}</td>
                <td><ScoreBreakdown row={row} /></td>
                <td className="hidden whitespace-nowrap text-xs text-dim 2xl:table-cell">{formatRelative(row.firstSeenAt, asOf)}</td>
                <td className="pr-4"><RowActions id={row.id} title={row.title} context={actions} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="lg:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2.5 border-t border-line-soft px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="w-6 pt-1.5 font-mono text-xs text-dim">{row.rank}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <GameLink row={row} />
                  <RowActions id={row.id} title={row.title} context={actions} />
                </div>
                <p className="truncate pl-[38px] text-[11.5px] text-dim">
                  {platformLabels[row.store]}
                  {row.category ? ` · ${row.category}` : ""} · released {releaseText(row)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 pl-[32px]">
              <Labels labels={[...row.genres, ...row.mechanics]} />
            </div>
            <dl className="grid grid-cols-3 gap-2 pl-[32px] text-xs">
              <div>
                <dt className="text-[11px] text-dim">Rating</dt>
                <dd className="font-mono"><Rating value={row.rating} /></dd>
              </div>
              <div>
                <dt className="text-[11px] text-dim">Ratings</dt>
                <dd className="font-mono text-ink-soft">{formatCount(row.ratingCount)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-dim">First seen</dt>
                <dd className="text-ink-soft">{formatRelative(row.firstSeenAt, asOf)}</dd>
              </div>
              {showMatchedLabel ? (
                <div className="col-span-3">
                  <dt className="text-[11px] text-dim">Label</dt>
                  <dd>
                    <MatchedLabel matched={row.matchedLabel} />
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="pl-[32px]">
              <ScoreBreakdown row={row} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

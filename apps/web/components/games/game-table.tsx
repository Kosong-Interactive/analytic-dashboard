import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, Star } from "lucide-react";

import { formatCount, formatSigned } from "@/lib/format/format";
import { formatUpfrontPrice } from "@/lib/format/price";
import { platformLabels } from "@/lib/overview/filters";
import type { TrendingRow } from "@/lib/overview/view-model";
import { cn } from "@/lib/utils";

import { ScoreBreakdown } from "../overview/score-breakdown";
import { GameIcon } from "./game-icon";

type Header = { label: string; align?: "right" };

const HEADERS: Header[] = [
  { label: "#" },
  { label: "Game" },
  { label: "Developer" },
  { label: "Platform" },
  { label: "Category" },
  { label: "Price", align: "right" },
  { label: "Rating", align: "right" },
  { label: "Ratings", align: "right" },
  { label: "Ratings / day", align: "right" },
  { label: "Rank change (7d)" },
  { label: "Trend score" },
];

function RankChange({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-dim" title="No chart position history for this game">—</span>;
  }
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  const color = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-dim";
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-xs", color)}>
      <Icon aria-hidden className="size-[11px]" strokeWidth={2.4} />
      {Math.abs(value)}
      <span className="sr-only">{value > 0 ? " places up" : value < 0 ? " places down" : " unchanged"}</span>
    </span>
  );
}

export function Rating({ value }: { value: number | null }) {
  if (value === null) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1">
      <Star aria-hidden className="size-[11px] fill-star text-star" />
      {value.toFixed(1)}
    </span>
  );
}

function PerDay({ value }: { value: number | null }) {
  if (value === null) return <span className="text-dim">—</span>;
  return (
    <span className={value < 0 ? "text-down" : "text-up"}>{formatSigned(value, 1)}</span>
  );
}

function GameLink({ row }: { row: TrendingRow }) {
  return (
    <Link href={`/games/${row.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
      <GameIcon title={row.title} iconUrl={row.iconUrl} size={28} />
      <span className="max-w-[16rem] truncate">{row.title}</span>
    </Link>
  );
}

/** A table from `md` up and a stack of cards below it, so small screens never need sideways scrolling. */
const RELEASE_HEADER: Header = { label: "Released" };

function releaseText(row: TrendingRow): string {
  return row.releaseDate ? row.releaseDate.toISOString().slice(0, 10) : "—";
}

export function GameTable({
  rows,
  caption,
  showRelease = false,
}: {
  rows: TrendingRow[];
  caption: string;
  /** Adds the store release date column, used by New Releases. */
  showRelease?: boolean;
}) {
  const headers = showRelease ? [...HEADERS.slice(0, 4), RELEASE_HEADER, ...HEADERS.slice(4)] : HEADERS;
  return (
    <>
      <div className="hidden md:block md:overflow-x-auto xl:overflow-visible">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="h-[34px] border-y border-line bg-surface-alt text-[11px] font-medium text-dim">
              {headers.map((header, index) => (
                <th
                  key={header.label}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-2 font-medium",
                    index === 0 && "pl-4",
                    index === headers.length - 1 && "pr-4",
                    header.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_td]:px-2">
            {rows.map((row) => (
              <tr key={row.id} className="h-[46px] border-b border-line-soft hover:bg-[#13161a]">
                <td className="pl-4 font-mono text-xs text-dim">{row.rank}</td>
                <td><GameLink row={row} /></td>
                <td className="max-w-[9rem] truncate text-dim">{row.developer ?? "—"}</td>
                <td className="text-[11.5px] text-ink-soft">{platformLabels[row.store]}</td>
                {showRelease ? (
                  <td className="whitespace-nowrap font-mono text-xs text-ink-soft">{releaseText(row)}</td>
                ) : null}
                <td className="max-w-[9rem] truncate text-[11.5px] text-ink-soft">{row.category ?? "—"}</td>
                <td className="whitespace-nowrap text-right font-mono text-xs text-ink-soft">{formatUpfrontPrice(row.price, row.currency)}</td>
                <td className="text-right font-mono text-xs"><Rating value={row.rating} /></td>
                <td className="text-right font-mono text-xs text-ink-soft">{formatCount(row.ratingCount)}</td>
                <td className="text-right font-mono text-xs"><PerDay value={row.ratingCountPerDay} /></td>
                <td><RankChange value={row.rankChange} /></td>
                <td className="pr-4"><ScoreBreakdown row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2.5 border-t border-line-soft px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="w-5 pt-1 font-mono text-xs text-dim">{row.rank}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <GameLink row={row} />
                <p className="truncate pl-[38px] text-[11.5px] text-dim">
                  {row.developer ?? "Unknown developer"} · {platformLabels[row.store]}
                  {row.category ? ` · ${row.category}` : ""}
                  {` · ${formatUpfrontPrice(row.price, row.currency)}`}
                  {showRelease ? ` · released ${releaseText(row)}` : ""}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-4 gap-2 pl-[30px] text-xs">
              <div>
                <dt className="text-[11px] text-dim">Rating</dt>
                <dd className="font-mono"><Rating value={row.rating} /></dd>
              </div>
              <div>
                <dt className="text-[11px] text-dim">Ratings</dt>
                <dd className="font-mono text-ink-soft">{formatCount(row.ratingCount)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-dim">Per day</dt>
                <dd className="font-mono"><PerDay value={row.ratingCountPerDay} /></dd>
              </div>
              <div>
                <dt className="text-[11px] text-dim">Rank 7d</dt>
                <dd><RankChange value={row.rankChange} /></dd>
              </div>
            </dl>
            <div className="pl-[30px]">
              <ScoreBreakdown row={row} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

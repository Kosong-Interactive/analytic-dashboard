import Link from "next/link";

import { formatCount, formatRelative } from "@/lib/format/format";
import { formatUpfrontPrice } from "@/lib/format/price";
import type { SteamGameRow } from "@/lib/steam/games-list";
import type { SteamGamesQuery } from "@/lib/steam/games-query";
import { formatRatio } from "@/lib/steam/format";
import { cn } from "@/lib/utils";

import { Labels } from "../explorer/explorer-table";
import { SteamThumb } from "./steam-thumb";

const HEADERS = [
  "#",
  "Game",
  "Genre · mechanic",
  "Released",
  "Price",
  "Players now (Global)",
  "Positive reviews (Global)",
  "Reviews (Global)",
  "Chart",
  "First seen",
];
const RIGHT_ALIGNED = new Set(["Price", "Players now (Global)", "Positive reviews (Global)", "Reviews (Global)"]);
/** Hidden until there is room. */
const WIDE_ONLY = new Set(["First seen"]);

function releaseText(row: SteamGameRow): string {
  return row.releaseDate ? row.releaseDate.toISOString().slice(0, 10) : "—";
}

function gameHref(row: SteamGameRow, query: SteamGamesQuery): string {
  const base = `/steam/games/${row.externalId}`;
  return query.country === "id" ? base : `${base}?country=${query.country}`;
}

/** Position in the newest capture of each chart; missing means "not in that chart", never rank 0. */
function ChartCell({ row }: { row: SteamGameRow }) {
  const { most_played: played, top_sellers: sellers } = row.charts;
  if (!played && !sellers) return <span className="text-dim">—</span>;
  return (
    <span className="flex flex-col font-mono text-xs text-ink-soft">
      {played ? <span>Played #{played.rank}</span> : null}
      {sellers ? <span>Sellers #{sellers.rank}</span> : null}
    </span>
  );
}

function GameLink({ row, query }: { row: SteamGameRow; query: SteamGamesQuery }) {
  return (
    <Link href={gameHref(row, query)} className="flex min-w-0 items-center gap-2.5 hover:underline">
      <SteamThumb imageUrl={row.headerImageUrl} width={64} />
      <span className="max-w-[14rem] truncate font-medium">{row.title}</span>
    </Link>
  );
}

/** A table from `lg` up and a stack of cards below it, so small screens never need sideways scrolling. */
export function SteamGamesTable({
  rows,
  query,
  caption,
  asOf,
  firstRank,
}: {
  rows: SteamGameRow[];
  query: SteamGamesQuery;
  caption: string;
  asOf: Date;
  /** Position of the first row in the whole result, so page 2 continues the numbering. */
  firstRank: number;
}) {
  return (
    <>
      <div className="hidden lg:block lg:overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="h-[34px] border-y border-line bg-surface-alt text-[11px] font-medium text-dim">
              {HEADERS.map((header, index) => (
                <th
                  key={header}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-2 font-medium",
                    index === 0 && "pl-4",
                    index === HEADERS.length - 1 && "pr-4",
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
            {rows.map((row, index) => (
              <tr key={row.steamAppId} className="h-[52px] border-b border-line-soft hover:bg-[#13161a]">
                <td className="pl-4 font-mono text-xs text-dim">{firstRank + index}</td>
                <td><GameLink row={row} query={query} /></td>
                <td className="max-w-[12rem]"><Labels labels={[...row.genres, ...row.mechanics]} /></td>
                <td className="whitespace-nowrap font-mono text-xs text-ink-soft">{releaseText(row)}</td>
                <td className="whitespace-nowrap text-right font-mono text-xs text-ink-soft">{formatUpfrontPrice(row.price, row.currency)}</td>
                <td className="text-right font-mono text-xs">{formatCount(row.snapshot?.currentPlayers ?? null)}</td>
                <td className="text-right font-mono text-xs">{formatRatio(row.positive)}</td>
                <td className="text-right font-mono text-xs text-ink-soft">{formatCount(row.snapshot?.reviewTotal ?? null)}</td>
                <td><ChartCell row={row} /></td>
                <td className="hidden whitespace-nowrap pr-4 text-xs text-dim 2xl:table-cell">{formatRelative(row.firstSeenAt, asOf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="lg:hidden" aria-label={caption}>
        {rows.map((row, index) => (
          <li key={row.steamAppId} className="flex flex-col gap-2.5 border-t border-line-soft px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="w-6 pt-1.5 font-mono text-xs text-dim">{firstRank + index}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <GameLink row={row} query={query} />
                <p className="truncate text-[11.5px] text-dim">Steam · released {releaseText(row)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 pl-[32px]">
              <Labels labels={[...row.genres, ...row.mechanics]} />
            </div>
            <dl className="grid grid-cols-2 gap-2 pl-[32px] text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[11px] text-dim">Price</dt>
                <dd className="font-mono text-ink-soft">{formatUpfrontPrice(row.price, row.currency)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-dim">Players now (Global)</dt>
                <dd className="font-mono">{formatCount(row.snapshot?.currentPlayers ?? null)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-dim">Positive reviews (Global)</dt>
                <dd className="font-mono">{formatRatio(row.positive)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-dim">Reviews (Global)</dt>
                <dd className="font-mono text-ink-soft">{formatCount(row.snapshot?.reviewTotal ?? null)}</dd>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-[11px] text-dim">Chart</dt>
                <dd><ChartCell row={row} /></dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

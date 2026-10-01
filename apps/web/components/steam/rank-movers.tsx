import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";

import type { RankMover } from "@/lib/steam/rank-movers";
import { cn } from "@/lib/utils";

/** One side of the rank-mover list. Places are shown as text, so colour is never the only signal. */
export function RankMoversTable({ title, movers, country }: { title: string; movers: RankMover[]; country: "id" | "us" }) {
  const up = title === "Rising";
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <div className="flex flex-col">
      <h3 className="px-4 py-2.5 text-xs font-medium text-dim">{title}</h3>
      {movers.length === 0 ? (
        <p className="border-t border-line-soft px-4 py-4 text-xs text-dim">No games {up ? "moved up" : "moved down"}.</p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">{title} games by chart position change</caption>
          <thead>
            <tr className="h-[30px] border-y border-line bg-surface-alt text-[11px] font-medium text-dim">
              <th scope="col" className="pl-4 text-left font-medium">Game</th>
              <th scope="col" className="text-right font-medium">Last week</th>
              <th scope="col" className="text-right font-medium">Now</th>
              <th scope="col" className="pr-4 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {movers.map((mover) => (
              <tr key={mover.steamAppId} className="h-9 border-b border-line-soft">
                <td className="max-w-[16rem] truncate pl-4">
                  <Link
                    href={country === "id" ? `/steam/games/${mover.externalId}` : `/steam/games/${mover.externalId}?country=${country}`}
                    className="hover:underline"
                  >
                    {mover.title}
                  </Link>
                </td>
                <td className="text-right font-mono text-xs text-ink-soft">#{mover.lastWeekRank}</td>
                <td className="text-right font-mono text-xs">#{mover.rank}</td>
                <td className="pr-4 text-right">
                  <span className={cn("inline-flex items-center gap-1 font-mono text-xs", up ? "text-up" : "text-down")}>
                    <Icon aria-hidden className="size-[11px]" strokeWidth={2.4} />
                    {Math.abs(mover.change)}
                    <span className="sr-only">{up ? " places up" : " places down"}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

import Link from "next/link";

import { formatCount } from "@/lib/format/format";
import { steamComponentLabels, steamTierLabels, type SteamTrendRow } from "@/lib/steam/trend";
import { cn } from "@/lib/utils";

import { SteamThumb } from "./steam-thumb";

/** Below this share of measurable weight a high score is only an early signal. */
const EARLY_SIGNAL_BELOW = 0.75;

const tierText = { exploding: "text-up", trending: "text-up", growing: "text-star", low: "text-dim" } as const;

function rawText(component: string, raw: number | null): string {
  if (raw === null) return "not measurable yet";
  switch (component) {
    case "rankGain":
      return `${raw > 0 ? "+" : raw < 0 ? "−" : ""}${Math.abs(raw)} places`;
    case "playerMomentum7d":
      return `${raw > 0 ? "+" : raw < 0 ? "−" : ""}${Math.abs(raw * 100).toFixed(0)}%`;
    case "reviewVelocity7d":
      return `${formatCount(raw)} / day`;
    case "sentimentMomentum7d":
      return `${raw > 0 ? "+" : raw < 0 ? "−" : ""}${Math.abs(raw).toFixed(1)} pts`;
    case "chartBreadth":
      return `${Math.round(raw * 2)} of 2 charts`;
    default:
      return `${Math.round(raw * 100)}%`;
  }
}

/** Every component's raw value and points are text, so the score is never a number without its reasons. */
export function SteamTrendTable({
  rows,
  country,
  caption,
}: {
  rows: SteamTrendRow[];
  country: "id" | "us";
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[15px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="h-[34px] border-y border-line bg-surface-alt text-[13px] font-medium text-dim">
            <th scope="col" className="pl-4 text-left font-medium">#</th>
            <th scope="col" className="text-left font-medium">Game</th>
            <th scope="col" className="text-right font-medium">Players now (Global)</th>
            <th scope="col" className="text-left font-medium">Steam Trend Score</th>
            <th scope="col" className="text-right font-medium">Measured</th>
            <th scope="col" className="pr-4 text-left font-medium">Why</th>
          </tr>
        </thead>
        <tbody className="[&_td]:px-2 [&_td]:align-top">
          {rows.map(({ game, score, tier }, index) => (
            <tr key={game.steamAppId} className="border-b border-line-soft hover:bg-[#13161a]">
              <td className="h-[52px] pl-4 font-mono text-sm text-dim">{index + 1}</td>
              <td className="py-2">
                <Link
                  href={country === "id" ? `/steam/games/${game.externalId}` : `/steam/games/${game.externalId}?country=${country}`}
                  className="flex items-center gap-2.5 font-medium hover:underline"
                >
                  <SteamThumb imageUrl={game.headerImageUrl} width={64} />
                  <span className="max-w-[16rem] truncate">{game.title}</span>
                </Link>
              </td>
              <td className="py-3 text-right font-mono text-sm">{formatCount(game.snapshot?.currentPlayers ?? null)}</td>
              <td className="py-3">
                <span className="inline-flex items-center gap-2 font-mono text-sm">
                  {Math.round(score.score ?? 0)}
                  {tier ? <span className={cn("font-sans text-[13px]", tierText[tier])}>{steamTierLabels[tier]}</span> : null}
                  {score.weightCoverage < EARLY_SIGNAL_BELOW ? (
                    <span
                      className="rounded border border-line-strong/70 px-1.5 py-px font-sans text-[12px] text-dim"
                      title="Less than 75% of the score weight is measurable yet, so treat this as an early signal"
                    >
                      Early signal
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="py-3 text-right font-mono text-sm text-ink-soft" title="Share of the score weight that could be measured">
                {Math.round(score.weightCoverage * 100)}%
              </td>
              <td className="py-2 pr-4">
                <details>
                  <summary className="cursor-pointer list-none text-sm text-ink-soft underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                    Score breakdown
                  </summary>
                  <ul className="mt-1.5 flex flex-col gap-1 text-[13.5px] text-ink-soft">
                    {score.components.map((item) => (
                      <li key={item.component} className="flex flex-wrap gap-x-2">
                        <span className="text-ink">{steamComponentLabels[item.component]}</span>
                        <span className="text-dim">{rawText(item.component, item.raw)}</span>
                        <span className="font-mono">
                          {item.contribution === null ? "not counted" : `+${item.contribution.toFixed(1)} pts`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

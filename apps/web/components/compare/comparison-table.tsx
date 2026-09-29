import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { CompareGame, CompareLabel, Comparison } from "@/lib/compare/comparison";
import { formatCount, formatRelative, formatSigned } from "@/lib/format/format";
import { formatInstallRange } from "@/lib/games/view-model";
import { countryLabels, platformLabels } from "@/lib/overview/filters";
import { cn } from "@/lib/utils";

import { GameIcon } from "../games/game-icon";
import { Rating } from "../games/game-table";
import { ScoreBreakdown } from "../overview/score-breakdown";

function Missing({ children = "—" }: { children?: ReactNode }) {
  return <span className="text-dim">{children}</span>;
}

function dateText(date: Date | null): ReactNode {
  return date ? date.toISOString().slice(0, 10) : <Missing />;
}

function Labels({ labels }: { labels: CompareLabel[] }) {
  if (labels.length === 0) return <Missing />;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((label) => (
        <span
          key={label.slug}
          className={cn(
            "rounded border px-1.5 py-px text-[11px]",
            label.shared ? "border-accent/60 text-accent" : "border-line-strong/70 text-ink-soft",
          )}
        >
          {label.displayName}
          {label.shared ? <span className="sr-only"> (shared by every compared game)</span> : null}
          {label.source === "manual" ? <span className="sr-only"> (confirmed)</span> : null}
        </span>
      ))}
    </span>
  );
}

interface MetricRow {
  label: string;
  /** Shown under the label when the values are not directly comparable. */
  caution?: string;
  render: (game: CompareGame) => ReactNode;
}

function metricRows(comparison: Comparison, asOf: Date): MetricRow[] {
  const storeCaution = comparison.mixedStores
    ? "Stores count ratings differently; compare within a store only."
    : undefined;
  return [
    { label: "Platform", render: (g) => platformLabels[g.row.store] },
    {
      label: "Storefront",
      render: (g) => countryLabels[g.row.country as keyof typeof countryLabels] ?? g.row.country,
    },
    { label: "Developer", render: (g) => g.row.developer ?? <Missing /> },
    { label: "Store category", render: (g) => g.row.category ?? <Missing /> },
    { label: "Released (store date)", render: (g) => dateText(g.row.releaseDate) },
    { label: "First seen by us", render: (g) => dateText(g.row.firstSeenAt) },
    { label: "Last observed", render: (g) => formatRelative(g.latestObservationAt, asOf) },
    { label: "Rating", caution: storeCaution, render: (g) => <Rating value={g.row.rating} /> },
    { label: "Ratings", caution: storeCaution, render: (g) => formatCount(g.row.ratingCount) },
    {
      label: "Ratings / day (7d)",
      caution: storeCaution,
      render: (g) => (g.row.ratingCountPerDay === null ? <Missing /> : formatSigned(g.row.ratingCountPerDay, 1)),
    },
    {
      label: "Installs",
      caution: comparison.mixedStores ? "Only Google Play publishes install ranges." : undefined,
      render: (g) => {
        if (g.installs === null) return <Missing>Not published by the App Store</Missing>;
        return formatInstallRange(g.installs.min, g.installs.max) ?? <Missing />;
      },
    },
    {
      label: "Rank change (7d)",
      render: (g) => (g.row.rankChange === null ? <Missing /> : formatSigned(g.row.rankChange)),
    },
    {
      label: "Trend Score",
      caution: "Each score is relative to its own store and country.",
      render: (g) => <ScoreBreakdown row={g.row} />,
    },
    { label: "Genre", render: (g) => <Labels labels={g.genres} /> },
    { label: "Core mechanic", render: (g) => <Labels labels={g.mechanics} /> },
  ];
}

function GameHeading({ game, removeHref }: { game: CompareGame; removeHref: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <Link href={`/games/${game.row.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
        <GameIcon title={game.row.title} iconUrl={game.row.iconUrl} size={32} />
        <span className="truncate text-[13px] font-medium">{game.row.title}</span>
      </Link>
      <Link
        href={removeHref}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-line-strong text-dim hover:text-ink"
      >
        <X aria-hidden className="size-3" />
        <span className="sr-only">Remove {game.row.title} from the comparison</span>
      </Link>
    </div>
  );
}

export function ComparisonTable({
  comparison,
  asOf,
  removeHref,
}: {
  comparison: Comparison;
  asOf: Date;
  removeHref: (id: string) => string;
}) {
  const rows = metricRows(comparison, asOf);
  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <caption className="sr-only">Comparison of {comparison.games.length} games</caption>
          <thead>
            <tr className="border-y border-line bg-surface-alt">
              <th scope="col" className="w-44 px-4 py-2 text-left text-[11px] font-medium text-dim">
                Metric
              </th>
              {comparison.games.map((game) => (
                <th key={game.row.id} scope="col" className="px-3 py-2 text-left font-normal">
                  <GameHeading game={game} removeHref={removeHref(game.row.id)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((metric) => (
              <tr key={metric.label} className="border-b border-line-soft align-top">
                <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-ink-soft">
                  {metric.label}
                  {metric.caution ? <span className="mt-0.5 block text-[11px] font-normal text-star">{metric.caution}</span> : null}
                </th>
                {comparison.games.map((game) => (
                  <td key={game.row.id} className="px-3 py-2.5 text-xs text-ink-soft">
                    {metric.render(game)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="lg:hidden" aria-label={`Comparison of ${comparison.games.length} games`}>
        {comparison.games.map((game) => (
          <li key={game.row.id} className="flex flex-col gap-3 border-t border-line-soft px-4 py-3">
            <GameHeading game={game} removeHref={removeHref(game.row.id)} />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              {rows.map((metric) => (
                <div key={metric.label} className={cn(metric.label === "Trend Score" && "col-span-2")}>
                  <dt className="text-[11px] text-dim">{metric.label}</dt>
                  <dd className="text-ink-soft">{metric.render(game)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

import { trendTier } from "@analytic-dashboard/analytics";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import type { LabelStats } from "@/lib/labels/aggregate";
import type { LabelFilter } from "@/lib/explorer/query";

import { tierStyles } from "../overview/score-breakdown";

const typeNames: Record<LabelFilter["type"], string> = {
  genre: "Genre",
  subgenre: "Subgenre",
  core_mechanic: "Core mechanic",
  meta_mechanic: "Meta mechanic",
  theme: "Theme",
  multiplayer_mode: "Multiplayer mode",
};

/** The roll-up page a label belongs to, with its type tab selected. */
export function labelPageHref(filter: LabelFilter, country: string, platform: string): string {
  const onGenres = filter.type === "genre" || filter.type === "subgenre";
  const query = new URLSearchParams();
  if (country !== "id") query.set("country", country);
  if (platform !== "all") query.set("platform", platform);
  if (filter.type !== "genre" && filter.type !== "core_mechanic") query.set("type", filter.type);
  const text = query.toString();
  const path = onGenres ? "/genres" : "/mechanics";
  return text ? `${path}?${text}` : path;
}

/** Header for Games opened from a Genres or Mechanics row: the same figures as that row. */
export function LabelSummary({
  filter,
  displayName,
  stats,
  backHref,
}: {
  filter: LabelFilter;
  displayName: string;
  stats: LabelStats | null;
  backHref: string;
}) {
  const momentum = stats?.momentum ?? null;
  const tier = momentum === null ? null : tierStyles[trendTier(momentum)];
  const items = [
    { label: "Games", value: stats ? String(stats.games) : "0", note: stats ? `${Math.round(stats.share * 100)}% of tracked games` : "none in this storefront" },
    { label: "New in 7 days", value: stats ? String(stats.newlyDiscovered7d) : "—", note: "first observed by us" },
    {
      label: "Average rating",
      value: stats?.averageRating == null ? "—" : stats.averageRating.toFixed(2),
      note: stats?.averageRating == null ? "not reported" : "members that report a rating",
    },
    {
      label: "Momentum",
      value: momentum === null ? "—" : String(Math.round(momentum)),
      note: tier ? `${tier.label} · ${stats?.scoredGames ?? 0} scored` : "no member scored yet",
    },
    {
      label: "Confirmed manually",
      value: stats ? `${Math.round(stats.manualShare * 100)}%` : "—",
      note: "the rest are inferred",
    },
  ];

  return (
    <section aria-label={`${displayName} summary`} className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] uppercase tracking-wider text-dim">{typeNames[filter.type]}</p>
          <h2 className="text-lg font-semibold tracking-tight">{displayName}</h2>
        </div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-ink-soft underline-offset-2 hover:underline">
          <ChevronLeft aria-hidden className="size-3.5" />
          Back to {filter.type === "genre" || filter.type === "subgenre" ? "Genres" : "Mechanics"}
        </Link>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-dim">{item.label}</dt>
            <dd className="text-lg font-semibold leading-tight">{item.value}</dd>
            <dd className="text-[11px] text-dim">{item.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

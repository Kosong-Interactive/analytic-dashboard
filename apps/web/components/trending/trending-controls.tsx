import { X } from "lucide-react";
import Link from "next/link";

import { priceFilterLabels, priceFilterValues } from "@/lib/format/price";
import {
  ratingOptions,
  scoreOptions,
  sortLabels,
  sortValues,
  trendingHref,
  type TrendingQuery,
} from "@/lib/trending/query";
import { cn } from "@/lib/utils";

const selectClass =
  "h-8 rounded-md border border-line-strong bg-surface px-2 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-accent";

/** A plain GET form: filters live in the URL, so a view can be shared and needs no client JavaScript. */
export function TrendingControls({ query }: { query: TrendingQuery }) {
  const chips: Array<{ label: string; remove: Partial<TrendingQuery> }> = [];
  if (query.minRating > 0) chips.push({ label: `Rating ≥ ${query.minRating}`, remove: { minRating: 0 } });
  if (query.minScore > 0) chips.push({ label: `Trend Score ≥ ${query.minScore}`, remove: { minScore: 0 } });
  if (query.price !== "all") chips.push({ label: `Harga: ${priceFilterLabels[query.price]}`, remove: { price: "all" } });
  if (query.includeUnscored) chips.push({ label: "Including unscored", remove: { includeUnscored: false } });

  return (
    <div className="flex flex-col gap-3">
      <form
        method="get"
        action="/trending"
        className="flex flex-wrap items-end gap-3 rounded-[10px] border border-line bg-surface p-3"
      >
        {query.country !== "id" ? <input type="hidden" name="country" value={query.country} /> : null}
        {query.platform !== "all" ? <input type="hidden" name="platform" value={query.platform} /> : null}
        {query.sort !== "score" ? <input type="hidden" name="sort" value={query.sort} /> : null}

        <label className="flex flex-col gap-1 text-[13px] text-dim">
          Minimum rating
          <select name="minRating" defaultValue={String(query.minRating)} className={selectClass}>
            {ratingOptions.map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "Any" : `${value}+`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-dim">
          Minimum Trend Score
          <select name="minScore" defaultValue={String(query.minScore)} className={selectClass}>
            {scoreOptions.map((value) => (
              <option key={value} value={value}>
                {value === 0 ? "Any" : `${value}+`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-dim">
          Harga
          <select name="price" defaultValue={query.price} className={selectClass}>
            {priceFilterValues.map((value) => (
              <option key={value} value={value}>
                {priceFilterLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-8 items-center gap-2 text-[15px] text-ink-soft">
          <input
            type="checkbox"
            name="includeUnscored"
            value="1"
            defaultChecked={query.includeUnscored}
            className="size-4 accent-accent"
          />
          Include games not scored yet
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="h-8 rounded-md bg-accent px-3 text-[15px] font-medium text-canvas hover:opacity-90"
          >
            Apply
          </button>
          <Link
            href={trendingHref(query, {
              minRating: 0,
              minScore: 0,
              price: "all",
              includeUnscored: false,
            })}
            className="flex h-8 items-center rounded-md border border-line-strong px-3 text-[15px] text-ink-soft hover:bg-surface-alt"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.length === 0 ? <li className="text-sm text-dim">No filters applied</li> : null}
          {chips.map((chip) => (
            <li key={chip.label}>
              <Link
                href={trendingHref(query, chip.remove)}
                className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line-strong bg-surface-alt px-2 text-sm text-ink-soft hover:text-ink"
              >
                {chip.label}
                <X aria-hidden className="size-3" />
                <span className="sr-only">Remove filter</span>
              </Link>
            </li>
          ))}
        </ul>

        <nav aria-label="Sort by" className="flex items-center gap-2 text-sm text-dim">
          <span>Sort by</span>
          <div className="flex flex-wrap gap-0.5 rounded-lg border border-line-strong/60 bg-surface p-0.5">
            {sortValues.map((value) => (
              <Link
                key={value}
                href={trendingHref(query, { sort: value })}
                aria-current={query.sort === value ? "true" : undefined}
                className={cn(
                  "flex h-[26px] items-center rounded-md px-2.5 text-sm",
                  query.sort === value ? "bg-line text-ink" : "text-dim hover:text-ink",
                )}
              >
                {sortLabels[value]}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

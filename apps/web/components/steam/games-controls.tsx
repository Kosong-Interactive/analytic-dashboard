import { X } from "lucide-react";
import Link from "next/link";

import type { SteamGamesList } from "@/lib/steam/games-list";
import {
  chartFilterLabels,
  chartFilterValues,
  clearedSteamGameFilters,
  positiveOptions,
  reviewCountOptions,
  steamGameSortLabels,
  steamGameSortValues,
  steamGamesHref,
  type SteamGamesQuery,
} from "@/lib/steam/games-query";
import { releasedLabels, releasedValues } from "@/lib/explorer/query";
import { priceFilterLabels, priceFilterValues } from "@/lib/format/price";

import { EnumSelect, fieldClass, OptionSelect } from "../filters/fields";
import { MobileDisclosure } from "../shell/mobile-disclosure";
import { SegmentedLinks } from "../shell/segmented-links";

function optionLabel(options: SteamGamesList["options"]["genres"], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** A plain GET form: filters live in the URL, so a view can be shared and needs no client JavaScript. */
export function SteamGamesControls({ query, options }: { query: SteamGamesQuery; options: SteamGamesList["options"] }) {
  const chips: Array<{ label: string; remove: Partial<SteamGamesQuery> }> = [];
  if (query.q) chips.push({ label: `“${query.q}”`, remove: { q: "" } });
  if (query.genre) chips.push({ label: `Genre: ${optionLabel(options.genres, query.genre)}`, remove: { genre: undefined } });
  if (query.mechanic) {
    chips.push({ label: `Mechanic: ${optionLabel(options.mechanics, query.mechanic)}`, remove: { mechanic: undefined } });
  }
  if (query.label) chips.push({ label: `Label: ${query.label.split(":")[1]?.replace(/_/g, " ") ?? query.label}`, remove: { label: undefined } });
  if (query.tag) chips.push({ label: `Tag: ${query.tag}`, remove: { tag: "" } });
  if (query.released !== "any") chips.push({ label: `Released: ${releasedLabels[query.released]}`, remove: { released: "any" } });
  if (query.minPositive > 0) chips.push({ label: `Positive ≥ ${query.minPositive}%`, remove: { minPositive: 0 } });
  if (query.minReviews > 0) chips.push({ label: `Reviews ≥ ${query.minReviews.toLocaleString("en-US")}`, remove: { minReviews: 0 } });
  if (query.price !== "all") chips.push({ label: `Harga: ${priceFilterLabels[query.price]}`, remove: { price: "all" } });
  if (query.chart !== "any") chips.push({ label: chartFilterLabels[query.chart], remove: { chart: "any" } });

  return (
    <div className="flex flex-col gap-3">
      <MobileDisclosure label={chips.length > 0 ? `Filters (${chips.length} active)` : "Filters"}>
        <form
          method="get"
          action="/steam/games"
          role="search"
          aria-label="Filter Steam games"
          className="grid grid-cols-2 gap-3 rounded-[10px] border border-line bg-surface p-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {query.country !== "id" ? <input type="hidden" name="country" value={query.country} /> : null}
          {query.label ? <input type="hidden" name="label" value={query.label} /> : null}
          {query.sort !== "players" ? <input type="hidden" name="sort" value={query.sort} /> : null}

          <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[11px] text-dim xl:col-span-1">
            Title
            <input type="search" name="q" defaultValue={query.q} maxLength={80} placeholder="Search tracked games" className={fieldClass} />
          </label>
          <OptionSelect label="Genre" name="genre" value={query.genre ?? ""} options={options.genres} />
          <OptionSelect label="Core mechanic" name="mechanic" value={query.mechanic ?? ""} options={options.mechanics} />
          <OptionSelect label="Steam tag" name="tag" value={query.tag} options={options.tags} />
          <EnumSelect label="Released" name="released" value={query.released} values={releasedValues} labels={releasedLabels} />
          <label className="flex min-w-0 flex-col gap-1 text-[11px] text-dim">
            Positive reviews
            <select name="minPositive" defaultValue={String(query.minPositive)} className={fieldClass}>
              {positiveOptions.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "Any" : `${value}%+`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[11px] text-dim">
            Minimum reviews
            <select name="minReviews" defaultValue={String(query.minReviews)} className={fieldClass}>
              {reviewCountOptions.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "Any" : `${value.toLocaleString("en-US")}+`}
                </option>
              ))}
            </select>
          </label>
          <EnumSelect label="Harga" name="price" value={query.price} values={priceFilterValues} labels={priceFilterLabels} />
          <EnumSelect label="Chart" name="chart" value={query.chart} values={chartFilterValues} labels={chartFilterLabels} />
          <div className="col-span-2 flex items-end gap-2 lg:col-span-1">
            <button type="submit" className="h-8 rounded-md bg-accent px-3 text-[13px] font-medium text-canvas hover:opacity-90">
              Apply
            </button>
            <Link
              href={steamGamesHref(query, clearedSteamGameFilters)}
              className="flex h-8 items-center rounded-md border border-line-strong px-3 text-[13px] text-ink-soft hover:bg-surface-alt"
            >
              Clear
            </Link>
          </div>
        </form>
      </MobileDisclosure>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.length === 0 ? <li className="text-xs text-dim">No filters applied</li> : null}
          {chips.map((chip) => (
            <li key={chip.label}>
              <Link
                href={steamGamesHref(query, chip.remove)}
                className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line-strong bg-surface-alt px-2 text-xs text-ink-soft hover:text-ink"
              >
                {chip.label}
                <X aria-hidden className="size-3" />
                <span className="sr-only">Remove filter</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 text-xs text-dim">
          <span>Sort by</span>
          <SegmentedLinks
            label="Sort by"
            items={steamGameSortValues.map((sort) => ({
              key: sort,
              label: steamGameSortLabels[sort],
              href: steamGamesHref(query, { sort }),
              active: query.sort === sort,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

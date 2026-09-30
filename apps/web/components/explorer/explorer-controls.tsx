import { X } from "lucide-react";
import Link from "next/link";

import type { ExplorerList, FilterOption } from "@/lib/explorer/list";
import {
  clearedExplorerFilters,
  explorerHref,
  explorerRatingOptions,
  explorerSortLabels,
  explorerSortValues,
  labelStatusLabels,
  labelStatusValues,
  momentumLabels,
  momentumValues,
  releasedLabels,
  releasedValues,
  type ExplorerQuery,
} from "@/lib/explorer/query";

import { MobileDisclosure } from "../shell/mobile-disclosure";
import { SegmentedLinks } from "../shell/segmented-links";

const fieldClass =
  "h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-accent";

function OptionSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: FilterOption[];
}) {
  // Keep a selected value that no longer has members visible, so the form never silently drops it.
  const withSelected =
    value && !options.some((option) => option.value === value) ? [{ value, label: value, count: 0 }, ...options] : options;
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] text-dim">
      {label}
      <select name={name} defaultValue={value} className={fieldClass}>
        <option value="">Any</option>
        {withSelected.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function EnumSelect<T extends string>({
  label,
  name,
  value,
  values,
  labels,
}: {
  label: string;
  name: string;
  value: T;
  values: readonly T[];
  labels: Record<T, string>;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] text-dim">
      {label}
      <select name={name} defaultValue={value} className={fieldClass}>
        {values.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function optionLabel(options: FilterOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** A plain GET form: filters live in the URL, so a view can be shared and needs no client JavaScript. */
export function ExplorerControls({
  query,
  options,
  labelName,
}: {
  query: ExplorerQuery;
  options: ExplorerList["options"];
  /** Display name of the label filter, when one is active. */
  labelName?: string;
}) {
  const chips: Array<{ label: string; remove: Partial<ExplorerQuery> }> = [];
  if (query.label && labelName) chips.push({ label: `Label: ${labelName}`, remove: { label: undefined } });
  if (query.q) chips.push({ label: `“${query.q}”`, remove: { q: "" } });
  if (query.category) chips.push({ label: `Category: ${query.category}`, remove: { category: "" } });
  if (query.genre) chips.push({ label: `Genre: ${optionLabel(options.genres, query.genre)}`, remove: { genre: undefined } });
  if (query.mechanic) {
    chips.push({ label: `Mechanic: ${optionLabel(options.mechanics, query.mechanic)}`, remove: { mechanic: undefined } });
  }
  if (query.released !== "any") chips.push({ label: `Released: ${releasedLabels[query.released]}`, remove: { released: "any" } });
  if (query.minRating > 0) chips.push({ label: `Rating ≥ ${query.minRating}`, remove: { minRating: 0 } });
  if (query.momentum !== "any") chips.push({ label: `Momentum: ${momentumLabels[query.momentum]}`, remove: { momentum: "any" } });
  if (query.labels !== "any") chips.push({ label: `Labels: ${labelStatusLabels[query.labels]}`, remove: { labels: "any" } });

  return (
    <div className="flex flex-col gap-3">
      <MobileDisclosure label={chips.length > 0 ? `Filters (${chips.length} active)` : "Filters"}>
        <form
          method="get"
          action="/games"
          role="search"
          aria-label="Filter games"
          className="grid grid-cols-2 gap-3 rounded-[10px] border border-line bg-surface p-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {query.country !== "id" ? <input type="hidden" name="country" value={query.country} /> : null}
          {query.platform !== "all" ? <input type="hidden" name="platform" value={query.platform} /> : null}
          {query.sort !== "most_rated" ? <input type="hidden" name="sort" value={query.sort} /> : null}
          {query.compare.length > 0 ? <input type="hidden" name="compare" value={query.compare.join(",")} /> : null}
          {query.label && labelName ? (
            <input type="hidden" name="label" value={`${query.label.type}:${query.label.slug}`} />
          ) : null}

          <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[11px] text-dim xl:col-span-1">
            Title or developer
            <input type="search" name="q" defaultValue={query.q} maxLength={80} placeholder="Search tracked games" className={fieldClass} />
          </label>
          <OptionSelect label="Store category" name="category" value={query.category} options={options.categories} />
          <OptionSelect label="Genre" name="genre" value={query.genre ?? ""} options={options.genres} />
          <OptionSelect label="Core mechanic" name="mechanic" value={query.mechanic ?? ""} options={options.mechanics} />
          <EnumSelect label="Released" name="released" value={query.released} values={releasedValues} labels={releasedLabels} />
          <label className="flex min-w-0 flex-col gap-1 text-[11px] text-dim">
            Minimum rating
            <select name="minRating" defaultValue={String(query.minRating)} className={fieldClass}>
              {explorerRatingOptions.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "Any" : `${value}+`}
                </option>
              ))}
            </select>
          </label>
          <EnumSelect label="Momentum" name="momentum" value={query.momentum} values={momentumValues} labels={momentumLabels} />
          <EnumSelect label="Classification" name="labels" value={query.labels} values={labelStatusValues} labels={labelStatusLabels} />
          <div className="col-span-2 flex items-end gap-2 lg:col-span-1">
            <button type="submit" className="h-8 rounded-md bg-accent px-3 text-[13px] font-medium text-canvas hover:opacity-90">
              Apply
            </button>
            <Link
              href={explorerHref(query, clearedExplorerFilters)}
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
                href={explorerHref(query, chip.remove)}
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
            items={explorerSortValues.map((sort) => ({
              key: sort,
              label: explorerSortLabels[sort],
              href: explorerHref(query, { sort }),
              active: query.sort === sort,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

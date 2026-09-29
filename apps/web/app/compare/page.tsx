import Link from "next/link";

import { ComparisonTable } from "@/components/compare/comparison-table";
import { GameIcon } from "@/components/games/game-icon";
import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";
import { compareHref, MAX_COMPARED, parseCompareQuery } from "@/lib/compare/comparison";
import { getCompare } from "@/lib/compare/get-compare";
import { countryLabels, platformLabels } from "@/lib/overview/filters";

export const metadata = { title: "Compare · Game Analytic" };

interface ComparePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const fieldClass =
  "h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-accent";

export default async function ComparePage({ searchParams }: ComparePageProps) {
  await requireUser("/compare");
  const query = parseCompareQuery(await searchParams);
  const { asOf, comparison, results } = await getCompare(query);
  const full = query.ids.length >= MAX_COMPARED;

  return (
    <AppShell filters={query} active="compare" buildHref={(change) => compareHref(query, change)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Compare</h1>
        <p className="text-[13px] text-dim">
          Up to {MAX_COMPARED} tracked games side by side, each with its own store and country context.
        </p>
      </div>

      <Panel
        title="Add a game"
        description={`Searching ${countryLabels[query.country]} · ${platformLabels[query.platform]}; change the storefront in the top bar`}
      >
        <form method="get" action="/compare" role="search" className="flex flex-wrap items-end gap-2 border-t border-line-soft px-4 py-3">
          {query.ids.length > 0 ? <input type="hidden" name="ids" value={query.ids.join(",")} /> : null}
          {query.country !== "id" ? <input type="hidden" name="country" value={query.country} /> : null}
          {query.platform !== "all" ? <input type="hidden" name="platform" value={query.platform} /> : null}
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-dim">
            Title or developer
            <input type="search" name="q" defaultValue={query.q} maxLength={80} disabled={full} className={fieldClass} />
          </label>
          <button
            type="submit"
            disabled={full}
            className="h-8 rounded-md bg-accent px-3 text-[13px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
          >
            Search
          </button>
        </form>
        {full ? (
          <p className="border-t border-line-soft px-4 py-3 text-xs text-dim">
            {MAX_COMPARED} games are selected. Remove one to add another.
          </p>
        ) : null}
        {!full && query.q ? (
          results.length === 0 ? (
            <p className="border-t border-line-soft px-4 py-3 text-xs text-dim">No tracked game matches “{query.q}”.</p>
          ) : (
            <ul aria-label="Search results">
              {results.map((result) => (
                <li key={result.storeAppId} className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <GameIcon title={result.title} iconUrl={result.iconUrl} size={24} />
                    <span className="truncate text-[13px]">{result.title}</span>
                    <span className="truncate text-[11.5px] text-dim">
                      {result.developerName ?? "Unknown developer"} · {platformLabels[result.store]}
                    </span>
                  </span>
                  <Link
                    href={compareHref(query, { ids: [...query.ids, result.storeAppId], q: "" })}
                    className="h-7 shrink-0 rounded-md border border-line-strong px-2 text-[11px] leading-7 text-ink-soft hover:bg-surface-alt hover:text-ink"
                  >
                    Add<span className="sr-only"> {result.title} to the comparison</span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Panel>

      {comparison.missingIds.length > 0 ? (
        <p role="status" className="rounded-md border border-star/40 bg-star/10 px-3 py-2 text-xs text-ink-soft">
          {comparison.missingIds.length === 1 ? "One selected game is" : `${comparison.missingIds.length} selected games are`}{" "}
          no longer tracked and cannot be shown.{" "}
          <Link href={compareHref(query, { ids: query.ids.filter((id) => !comparison.missingIds.includes(id)) })} className="underline">
            Remove from the selection
          </Link>
        </p>
      ) : null}

      <Panel
        title="Comparison"
        description={
          comparison.mixedStores || comparison.mixedCountries
            ? "Mixed storefronts: raw counts are shown per store and are not directly comparable"
            : "Same storefront: values are measured the same way"
        }
      >
        {comparison.games.length === 0 ? (
          <EmptyState title="No games selected">
            Search above, or use “Compare” on a game page or the Watchlist. Links keep the selection, so a comparison can
            be shared.
          </EmptyState>
        ) : (
          <ComparisonTable
            comparison={comparison}
            asOf={asOf}
            removeHref={(id) => compareHref(query, { ids: query.ids.filter((other) => other !== id) })}
          />
        )}
      </Panel>

      <p className="text-xs leading-5 text-dim">
        Highlighted labels are shared by every compared game. Labels are inferences unless confirmed manually. Trend
        Scores are percentiles within each game’s own storefront, so a score compares momentum, not size. A dash means the
        value is missing, never zero.
      </p>
    </AppShell>
  );
}

import { EmptyState, Panel } from "@/components/overview/panel";
import { AppShell } from "@/components/shell/app-shell";
import { SegmentedLinks } from "@/components/shell/segmented-links";
import { PlatformCompareTable } from "@/components/steam/compare-table";
import { requireUser } from "@/lib/auth/session";
import {
  compareHref,
  compareSortLabels,
  compareSortValues,
  parseCompareQuery,
} from "@/lib/steam/compare-query";
import { modeLabels } from "@/lib/steam/platform-compare";
import { getPlatformComparison } from "@/lib/steam/get-compare";
import {
  compareTypeLabels,
  compareTypeValues,
  platformColumnLabels,
  COMPARED_PLATFORMS,
} from "@/lib/steam/platform-compare";

export const metadata = { title: "Platform Comparison · Game Analytic" };

interface ComparePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SteamComparePage({ searchParams }: ComparePageProps) {
  await requireUser("/steam/compare");
  const query = parseCompareQuery(await searchParams);
  const { comparison } = await getPlatformComparison(query);
  const missing = COMPARED_PLATFORMS.filter((platform) => !comparison.available.includes(platform));
  const mobileCountry = query.country === "id" ? "Indonesia" : "US store";

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active="steam-genres"
      noCounterpart
      buildHref={(change) => compareHref(query, { country: change.country })}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Platform Comparison</h1>
        <p className="text-[15px] text-dim">
          How each {compareTypeLabels[query.type].toLowerCase()} label ranks inside Steam (Global), Google Play, and App Store (
          {mobileCountry})
        </p>
      </div>

      {missing.length > 0 ? (
        <p role="status" className="rounded-md border border-star/40 bg-star/10 px-3 py-2 text-sm text-ink-soft">
          {missing.map((platform) => platformColumnLabels[platform]).join(" and ")} could not be loaded and{" "}
          {missing.length === 1 ? "is" : "are"} left out of the coverage count; the rest is shown as collected.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Label type"
          items={compareTypeValues.map((type) => ({
            key: type,
            label: compareTypeLabels[type],
            href: compareHref(query, { type }),
            active: query.type === type,
          }))}
        />
        <div className="flex items-center gap-2 text-sm text-dim">
          <span>Sort by</span>
          <SegmentedLinks
            label="Sort by"
            items={compareSortValues.map((sort) => ({
              key: sort,
              label: compareSortLabels[sort],
              href: compareHref(query, { sort }),
              active: query.sort === sort,
            }))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-dim">
        <span>Signal</span>
        <SegmentedLinks
          label="Signal"
          items={[
            { key: "all", label: "All", href: compareHref(query, { mode: "all" }), active: query.mode === "all" },
            ...(["confirmed_cross_platform", "steam_to_mobile", "mobile_to_steam", "conflicting", "steam_only", "mobile_only"] as const).map((mode) => ({
              key: mode,
              label: modeLabels[mode],
              href: compareHref(query, { mode }),
              active: query.mode === mode,
            })),
          ]}
        />
      </div>

      <Panel
        title={compareTypeLabels[query.type]}
        description={`${comparison.rows.length} labels · ${comparison.formulaVersion} · each platform ranked against its own labels`}
      >
        {comparison.rows.length === 0 ? (
          <EmptyState title={query.mode === "all" ? "No labels to compare yet" : "No label has this signal"}>
            {query.mode === "all"
              ? "Labels appear after the classification jobs have run and games carry labels on at least one platform."
              : "Signals that need a measured mobile side appear once mobile Trend Scores exist (about 3.5 days of history). Choose another signal or All."}
          </EmptyState>
        ) : (
          <PlatformCompareTable
            rows={comparison.rows}
            available={comparison.available}
            caption={`${compareTypeLabels[query.type]} compared across platforms, sorted by ${compareSortLabels[query.sort]}`}
            gamesHref={(row) => {
              const params = new URLSearchParams({ label: row.key });
              if (query.country !== "id") params.set("country", query.country);
              return `/steam/games?${params.toString()}`;
            }}
          />
        )}
        <p className="border-t border-line-soft px-4 py-3 text-sm leading-5 text-dim">
          Each cell ranks a label by the <em>median</em> trend score of its games, against the other labels of the same
          platform only: the Steam, Google Play, and App Store scores come from different formulas and are never put on one
          scale. A label needs three scored games to be ranked and a platform needs five ranked labels, otherwise the cell
          says &ldquo;Not ranked yet&rdquo;. A platform without the label is shown as missing, not as weak evidence. Steam
          is global; mobile follows the selected country. Labels are inferences from titles, tags, and descriptions, and the
          ranks are research signals, not market facts. The signal names a situation (for example Steam → mobile when a
          label is strong on Steam but thinly represented on mobile) from those within-platform ranks and the number of
          tracked games; it is a research direction with its evidence, not a recommendation or a prediction, and coverage
          shows how many platforms could be measured.
        </p>
      </Panel>
    </AppShell>
  );
}

import type { LabelType } from "@analytic-dashboard/db";

import { MIN_LABEL_CONFIDENCE } from "@/lib/labels/constants";
import { getSteamLabelOverview } from "@/lib/steam/get-label-overview";
import {
  steamLabelHref,
  steamLabelSortLabels,
  steamLabelSortValues,
  type SteamLabelPageConfig,
  type SteamLabelQuery,
} from "@/lib/steam/label-query";

import { EmptyState, Panel } from "../overview/panel";
import { AppShell } from "../shell/app-shell";
import { SegmentedLinks } from "../shell/segmented-links";
import type { NavKey } from "../shell/sidebar";
import { SteamFreshness } from "./freshness";
import { SteamLabelTable } from "./label-table";

interface SteamLabelPageProps<T extends LabelType> {
  config: SteamLabelPageConfig<T>;
  query: SteamLabelQuery<T>;
  active: NavKey;
  title: string;
  intro: string;
}

export async function SteamLabelPage<T extends LabelType>({ config, query, active, title, intro }: SteamLabelPageProps<T>) {
  const view = await getSteamLabelOverview(query);
  const typeLabel = config.typeLabels[query.type];

  return (
    <AppShell
      filters={{ country: query.country, platform: "all" }}
      active={active}
      buildHref={(change) => steamLabelHref(config, query, { country: change.country })}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        <p className="text-[13px] text-dim">{intro} · Steam Global</p>
      </div>

      <SteamFreshness source={view.source} capturedAt={null} asOf={view.asOf} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Label type"
          items={config.types.map((type) => ({
            key: type,
            label: config.typeLabels[type],
            href: steamLabelHref(config, query, { type }),
            active: query.type === type,
          }))}
        />
        <div className="flex items-center gap-2 text-xs text-dim">
          <span>Sort by</span>
          <SegmentedLinks
            label="Sort by"
            items={steamLabelSortValues.map((sort) => ({
              key: sort,
              label: steamLabelSortLabels[sort],
              href: steamLabelHref(config, query, { sort }),
              active: query.sort === sort,
            }))}
          />
        </div>
      </div>

      <Panel
        title={typeLabel}
        description={`${view.labelled} of ${view.tracked} tracked Steam games carry at least one of these labels`}
      >
        {view.labels.length === 0 ? (
          <EmptyState title="No labels yet">
            Steam labels are assigned by the “Classify Steam games with rules” step after each collection run. If this
            stays empty, check that step in the scheduled workflow.
          </EmptyState>
        ) : (
          <SteamLabelTable
            labels={view.labels}
            caption={`${typeLabel} sorted by ${steamLabelSortLabels[query.sort]}`}
            hrefFor={(label) => {
              const params = new URLSearchParams({ label: `${label.type}:${label.slug}` });
              if (query.country !== "id") params.set("country", query.country);
              return `/steam/games?${params.toString()}`;
            }}
          />
        )}
      </Panel>

      <p className="text-xs leading-5 text-dim">
        Steam labels come from Steam user tags and keyword rules (taxonomy v1, 75% confidence because user tags are
        community-voted and noisy), replaced by an AI classification once a game has one; the AI must quote the game&apos;s
        title, tags, or description as evidence. Labels below {Math.round(MIN_LABEL_CONFIDENCE * 100)}% are not
        counted. Only games from the sampled Most Played and Top Sellers charts are tracked, so shares describe that
        sample, not the Steam catalog. Players and reviews are Steam&apos;s own figures; “—” means Steam gave no value.
      </p>
    </AppShell>
  );
}

import type { LabelType } from "@analytic-dashboard/db";

import { MIN_LABEL_CONFIDENCE } from "@/lib/labels/constants";
import { getLabelOverview } from "@/lib/labels/get-label-overview";
import {
  labelHref,
  labelSortLabels,
  labelSortValues,
  type LabelPageConfig,
  type LabelQuery,
} from "@/lib/labels/query";
import { countryLabels, platformLabels } from "@/lib/overview/filters";

import { EmptyState, Panel } from "../overview/panel";
import { AppShell } from "../shell/app-shell";
import { SegmentedLinks } from "../shell/segmented-links";
import type { NavKey } from "../shell/sidebar";
import { LabelTable } from "./label-table";

interface LabelPageProps<T extends LabelType> {
  config: LabelPageConfig<T>;
  query: LabelQuery<T>;
  active: NavKey;
  title: string;
  intro: string;
}

export async function LabelPage<T extends LabelType>({ config, query, active, title, intro }: LabelPageProps<T>) {
  const view = await getLabelOverview(query);
  const typeLabel = config.typeLabels[query.type];

  return (
    <AppShell filters={query} active={active} buildHref={(change) => labelHref(config, query, change)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        <p className="text-[13px] text-dim">
          {intro} · {countryLabels[query.country]} · {platformLabels[query.platform]}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedLinks
          label="Label type"
          items={config.types.map((type) => ({
            key: type,
            label: config.typeLabels[type],
            href: labelHref(config, query, { type }),
            active: query.type === type,
          }))}
        />
        <div className="flex items-center gap-2 text-xs text-dim">
          <span>Sort by</span>
          <SegmentedLinks
            label="Sort by"
            items={labelSortValues.map((sort) => ({
              key: sort,
              label: labelSortLabels[sort],
              href: labelHref(config, query, { sort }),
              active: query.sort === sort,
            }))}
          />
        </div>
      </div>

      <Panel
        title={typeLabel}
        description={`${view.labelled} of ${view.tracked} tracked games carry at least one of these labels`}
      >
        {view.labels.length === 0 ? (
          <EmptyState title="No labels yet">
            Labels are assigned by the classification job after each collection run. If this stays empty, check the
            “Classify games with rules” step in the scheduled workflow.
          </EmptyState>
        ) : (
          <LabelTable labels={view.labels} caption={`${typeLabel} sorted by ${labelSortLabels[query.sort]}`} />
        )}
      </Panel>

      <p className="text-xs leading-5 text-dim">
        Labels come from store-declared genres and keyword rules (taxonomy v1), replaced by an AI classification once a game has one; manual labels take precedence over both.
        Automated labels below {Math.round(MIN_LABEL_CONFIDENCE * 100)}% confidence are not counted. Labels are
        inferences, not store facts: open a game to see the evidence behind each one. Momentum is the average Trend
        Score of member games and stays empty until they have enough history.
      </p>
    </AppShell>
  );
}

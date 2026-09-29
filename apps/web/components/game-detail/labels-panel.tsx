import type { ListingLabelRow } from "@analytic-dashboard/db";

import { MIN_LABEL_CONFIDENCE } from "@/lib/labels/constants";
import { cn } from "@/lib/utils";

import { EmptyState, Panel } from "../overview/panel";

const TYPE_LABELS: Record<ListingLabelRow["type"], string> = {
  genre: "Genre",
  subgenre: "Subgenre",
  core_mechanic: "Core mechanics",
  meta_mechanic: "Meta mechanics",
  theme: "Themes",
  multiplayer_mode: "Multiplayer",
  monetization_clue: "Monetization clues",
};

const SOURCE_LABELS: Record<ListingLabelRow["source"], string> = {
  rule: "Rule",
  ai: "AI",
  manual: "Manual",
};

const evidenceSchemaGuard = (value: unknown): Array<{ field: string; excerpt: string }> =>
  Array.isArray(value)
    ? value.flatMap((item) =>
        item && typeof item === "object" && "excerpt" in item && "field" in item
          ? [{ field: String(item.field), excerpt: String(item.excerpt) }]
          : [],
      )
    : [];

function LabelChip({ label }: { label: ListingLabelRow }) {
  const weak = label.source !== "manual" && label.confidence < MIN_LABEL_CONFIDENCE;
  const evidence = evidenceSchemaGuard(label.evidence);
  return (
    <li>
      <details className="group">
        <summary
          className={cn(
            "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs [&::-webkit-details-marker]:hidden",
            weak ? "border-line text-dim" : "border-line-strong text-ink-soft",
            "focus-visible:outline-2 focus-visible:outline-accent",
          )}
        >
          {label.displayName}
          <span className="font-mono text-[11px] text-dim">{Math.round(label.confidence * 100)}%</span>
          <span className="sr-only">confidence, {SOURCE_LABELS[label.source]} label. Show evidence</span>
        </summary>
        <div className="mt-1.5 max-w-md rounded-md border border-line bg-surface-alt p-2.5 text-[11px] leading-4 text-ink-soft">
          <p className="text-dim">
            {SOURCE_LABELS[label.source]} · {label.version}
            {label.model ? ` · ${label.model}` : ""}
            {weak ? " · below the counting threshold" : ""}
          </p>
          {evidence.length === 0 ? (
            <p className="mt-1">No evidence recorded.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1">
              {evidence.map((item, index) => (
                <li key={index}>
                  <span className="text-dim">{item.field.replace("_", " ")}:</span> {item.excerpt}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

export function LabelsPanel({ labels }: { labels: ListingLabelRow[] }) {
  const types = Object.keys(TYPE_LABELS) as Array<ListingLabelRow["type"]>;
  return (
    <Panel
      title="Classification"
      description="Inferred labels with confidence and evidence · open a label to see why it was assigned"
    >
      {labels.length === 0 ? (
        <EmptyState title="Not classified yet">
          Labels are assigned by the classification job after the next collection run.
        </EmptyState>
      ) : (
        <dl className="grid gap-3 border-t border-line-soft px-4 py-4 md:grid-cols-2">
          {types.map((type) => {
            const ofType = labels.filter((label) => label.type === type);
            if (ofType.length === 0) return null;
            return (
              <div key={type} className="flex flex-col gap-1.5">
                <dt className="text-[11px] text-dim">{TYPE_LABELS[type]}</dt>
                <dd>
                  <ul className="flex flex-wrap items-start gap-1.5">
                    {ofType.map((label) => (
                      <LabelChip key={`${label.source}:${label.slug}`} label={label} />
                    ))}
                  </ul>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <p className="border-t border-line-soft px-4 py-3 text-xs text-dim">
        Labels are inferences from store data and keywords, not store facts. Dimmed labels are below{" "}
        {Math.round(MIN_LABEL_CONFIDENCE * 100)}% confidence and are not counted in genre or mechanic views.
      </p>
    </Panel>
  );
}

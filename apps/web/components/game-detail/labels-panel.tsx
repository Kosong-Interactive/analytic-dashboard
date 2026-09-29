import { MIN_LABEL_CONFIDENCE } from "@/lib/labels/constants";
import type { LabelRowInput, LabelStatus, ResolvedLabel } from "@/lib/labels/resolve";
import { cn } from "@/lib/utils";

import { EmptyState, Panel } from "../overview/panel";
import { AddLabelForm, LabelActions } from "./label-actions";

export const TYPE_LABELS: Record<string, string> = {
  genre: "Genre",
  subgenre: "Subgenre",
  core_mechanic: "Core mechanics",
  meta_mechanic: "Meta mechanics",
  theme: "Themes",
  multiplayer_mode: "Multiplayer",
  monetization_clue: "Monetization clues",
};

const SOURCE_LABELS: Record<LabelRowInput["source"], string> = { rule: "Rule", ai: "AI", manual: "Manual" };

const STATUS_TEXT: Record<LabelStatus, string> = {
  confirmed: "Confirmed",
  rejected: "Rejected",
  counted: "",
  weak: "Below threshold",
};

function evidenceOf(value: unknown): Array<{ field: string; excerpt: string }> {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        item && typeof item === "object" && "excerpt" in item && "field" in item
          ? [{ field: String(item.field), excerpt: String(item.excerpt) }]
          : [],
      )
    : [];
}

function Provenance({ row, title }: { row: LabelRowInput; title: string }) {
  const evidence = evidenceOf(row.evidence);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-dim">
        {title}: {SOURCE_LABELS[row.source]}
        {row.source === "manual" ? "" : ` · ${row.version} · ${Math.round(row.confidence * 100)}%`}
        {row.model ? ` · ${row.model}` : ""}
      </p>
      {evidence.length === 0 ? (
        <p>No evidence recorded.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {evidence.map((item, index) => (
            <li key={index}>
              <span className="text-dim">{item.field.replace("_", " ")}:</span> {item.excerpt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LabelChip({ label, storeAppId }: { label: ResolvedLabel; storeAppId: string }) {
  const confidence = label.automated ? `${Math.round(label.automated.confidence * 100)}%` : null;
  return (
    <li>
      <details>
        <summary
          className={cn(
            "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs [&::-webkit-details-marker]:hidden",
            "focus-visible:outline-2 focus-visible:outline-accent",
            label.status === "confirmed" && "border-accent/60 text-ink",
            label.status === "counted" && "border-line-strong text-ink-soft",
            label.status === "weak" && "border-line text-dim",
            label.status === "rejected" && "border-line text-dim line-through",
          )}
        >
          {label.displayName}
          {label.status === "confirmed" ? <span className="text-[11px] text-accent">✓</span> : null}
          {confidence && label.status !== "confirmed" ? (
            <span className="font-mono text-[11px] text-dim no-underline">{confidence}</span>
          ) : null}
          <span className="sr-only">
            {STATUS_TEXT[label.status] || "Counted"}. Show evidence and actions
          </span>
        </summary>
        <div className="mt-1.5 max-w-md rounded-md border border-line bg-surface-alt p-2.5 text-[11px] leading-4 text-ink-soft">
          {STATUS_TEXT[label.status] ? <p className="mb-1 font-medium text-ink">{STATUS_TEXT[label.status]}</p> : null}
          <div className="flex flex-col gap-2">
            {label.manual ? <Provenance row={label.manual} title="Decision" /> : null}
            {label.automated ? <Provenance row={label.automated} title="Detected by" /> : null}
          </div>
          <LabelActions storeAppId={storeAppId} labelId={label.labelId} status={label.status} />
        </div>
      </details>
    </li>
  );
}

export function LabelsPanel({
  storeAppId,
  labels,
  options,
}: {
  storeAppId: string;
  labels: ResolvedLabel[];
  options: Array<{ id: string; type: string; displayName: string }>;
}) {
  const types = Object.keys(TYPE_LABELS);
  const present = new Set(labels.filter((l) => l.status !== "rejected").map((l) => l.labelId));
  const addOptions = types
    .map((type) => ({
      group: TYPE_LABELS[type] ?? type,
      labels: options.filter((o) => o.type === type && !present.has(o.id)),
    }))
    .filter((group) => group.labels.length > 0);

  return (
    <Panel
      title="Classification"
      description="Inferred labels with confidence and evidence · open a label to see why, or to correct it"
    >
      {labels.length === 0 ? (
        <EmptyState title="Not classified yet">
          Labels are assigned by the classification job after the next collection run. You can add one below.
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
                      <LabelChip key={label.labelId} label={label} storeAppId={storeAppId} />
                    ))}
                  </ul>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <div className="border-t border-line-soft px-4 py-3">
        <AddLabelForm storeAppId={storeAppId} options={addOptions} />
      </div>
      <p className="border-t border-line-soft px-4 py-3 text-xs leading-5 text-dim">
        Labels are inferences from store data and keywords, not store facts. Dimmed labels are below{" "}
        {Math.round(MIN_LABEL_CONFIDENCE * 100)}% confidence and are not counted. Your confirmations and rejections
        are recorded with your email, override automated labels in every view, and are never overwritten by
        reclassification.
      </p>
    </Panel>
  );
}

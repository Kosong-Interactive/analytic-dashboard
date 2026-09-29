import { MIN_LABEL_CONFIDENCE } from "./constants";

export interface LabelRowInput {
  labelId: string;
  type: string;
  slug: string;
  displayName: string;
  source: "rule" | "ai" | "manual";
  confidence: number;
  evidence: unknown;
  version: string;
  model: string | null;
}

export type LabelStatus =
  | "confirmed" // a person asserted it
  | "rejected" // a person said it does not apply
  | "counted" // automated and strong enough to count
  | "weak"; // automated but below the counting threshold

export interface ResolvedLabel {
  labelId: string;
  type: string;
  slug: string;
  displayName: string;
  status: LabelStatus;
  /** Confidence of the best automated label, if any; kept visible next to a manual decision. */
  automated: LabelRowInput | null;
  manual: LabelRowInput | null;
}

const statusOrder: Record<LabelStatus, number> = { confirmed: 0, counted: 1, weak: 2, rejected: 3 };

/** One entry per label, combining automated and manual rows the same way the roll-ups do. */
export function resolveListingLabels(rows: readonly LabelRowInput[]): ResolvedLabel[] {
  const byLabel = new Map<string, { automated: LabelRowInput | null; manual: LabelRowInput | null; first: LabelRowInput }>();
  for (const row of rows) {
    const entry = byLabel.get(row.labelId) ?? { automated: null, manual: null, first: row };
    if (row.source === "manual") entry.manual = row;
    else if (!entry.automated || rank(row) > rank(entry.automated)) entry.automated = row;
    byLabel.set(row.labelId, entry);
  }

  return [...byLabel.values()]
    .map(({ automated, manual, first }): ResolvedLabel => {
      let status: LabelStatus;
      if (manual) status = manual.confidence > 0 ? "confirmed" : "rejected";
      else status = (automated?.confidence ?? 0) >= MIN_LABEL_CONFIDENCE ? "counted" : "weak";
      return { labelId: first.labelId, type: first.type, slug: first.slug, displayName: first.displayName, status, automated, manual };
    })
    .sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        (b.automated?.confidence ?? 0) - (a.automated?.confidence ?? 0) ||
        a.displayName.localeCompare(b.displayName),
    );
}

function rank(row: LabelRowInput): number {
  return (row.source === "ai" ? 10 : 0) + row.confidence;
}

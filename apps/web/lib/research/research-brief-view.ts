import { z } from "zod";

const evidenceIdSchema = z.string().regex(/^[a-z][a-z0-9_.-]{2,79}$/);
const citedStatementSchema = z.object({
  text: z.string().min(1).max(600),
  evidenceIds: z.array(evidenceIdSchema).min(1).max(4),
});
const briefSchema = z.object({
  summary: citedStatementSchema,
  opportunitySignals: z.array(citedStatementSchema).min(1).max(4),
  counterSignals: z.array(citedStatementSchema).max(4),
  validationQuestions: z.array(z.object({
    question: z.string().min(1).max(300),
    why: z.string().min(1).max(400),
    evidenceIds: z.array(evidenceIdSchema).min(1).max(4),
  })).min(2).max(5),
});
const evidenceSchema = z.array(z.object({
  id: evidenceIdSchema,
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(400),
})).min(3).max(60);

export interface StoredResearchBriefInput {
  id: string;
  promptVersion: string;
  model: string;
  brief: unknown;
  evidence: unknown;
  createdAt: Date;
}

export interface ResearchBriefView {
  id: string;
  promptVersion: string;
  model: string;
  summary: z.infer<typeof citedStatementSchema>;
  opportunitySignals: Array<z.infer<typeof citedStatementSchema>>;
  counterSignals: Array<z.infer<typeof citedStatementSchema>>;
  validationQuestions: Array<{ question: string; why: string; evidenceIds: string[] }>;
  evidence: Array<{ id: string; label: string; value: string }>;
  createdAt: Date;
}

/** Stored AI output remains hidden if its schema or citation registry no longer validates. */
export function buildResearchBriefView(row: StoredResearchBriefInput | null): ResearchBriefView | null {
  if (!row) return null;
  const brief = briefSchema.safeParse(row.brief);
  const evidence = evidenceSchema.safeParse(row.evidence);
  if (!brief.success || !evidence.success) return null;
  const allowed = new Set(evidence.data.map((item) => item.id));
  const citations = [
    brief.data.summary.evidenceIds,
    ...brief.data.opportunitySignals.map((item) => item.evidenceIds),
    ...brief.data.counterSignals.map((item) => item.evidenceIds),
    ...brief.data.validationQuestions.map((item) => item.evidenceIds),
  ];
  if (citations.some((ids) => ids.some((id) => !allowed.has(id)))) return null;
  return { id: row.id, promptVersion: row.promptVersion, model: row.model, ...brief.data, evidence: evidence.data, createdAt: row.createdAt };
}

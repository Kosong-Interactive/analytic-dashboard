import { createHash } from "node:crypto";

import { z } from "zod";

export const RESEARCH_BRIEF_PROMPT_VERSION = "research-brief-v1";

const evidenceIdSchema = z.string().regex(/^[a-z][a-z0-9_.-]{2,79}$/);
const evidenceSchema = z.object({
  id: evidenceIdSchema,
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(400),
});

export const researchBriefInputSchema = z.object({
  opportunityId: z.uuid(),
  title: z.string().min(1).max(200),
  platform: z.string().min(1).max(40),
  market: z.string().min(1).max(20),
  asOf: z.string().datetime(),
  evidence: z.array(evidenceSchema).min(3).max(60),
}).superRefine((value, context) => {
  const ids = new Set<string>();
  for (const item of value.evidence) {
    if (ids.has(item.id)) context.addIssue({ code: "custom", message: `Duplicate evidence id: ${item.id}` });
    ids.add(item.id);
  }
});

export type ResearchBriefInput = z.infer<typeof researchBriefInputSchema>;

const citedStatementSchema = z.object({
  text: z.string().min(1).max(600),
  evidenceIds: z.array(evidenceIdSchema).min(1).max(4),
});

const researchBriefSchema = z.object({
  summary: citedStatementSchema,
  opportunitySignals: z.array(citedStatementSchema).min(1).max(4),
  counterSignals: z.array(citedStatementSchema).max(4),
  validationQuestions: z.array(
    z.object({
      question: z.string().min(1).max(300),
      why: z.string().min(1).max(400),
      evidenceIds: z.array(evidenceIdSchema).min(1).max(4),
    }),
  ).min(2).max(5),
});

export type ResearchBrief = z.infer<typeof researchBriefSchema>;

export class ResearchBriefResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchBriefResponseError";
  }
}

export function buildResearchBriefSystemInstruction(): string {
  return [
    "You draft an internal game research brief from a closed evidence registry.",
    "Rules:",
    "- Use only facts present in the supplied evidence registry.",
    "- Every statement and validation question must cite one or more supplied evidence ids.",
    "- Do not invent market size, revenue, exact downloads, retention, CPI, LTV, production cost, or games absent from the registry.",
    "- Keep sampled-catalogue, storefront, freshness, and missing-data caveats intact.",
    "- Treat scores as internal research signals, not forecasts of commercial success.",
    "- Do not change the team's Shortlist, Reject, or Prototype decision.",
    "- Ask concrete validation questions that can reduce uncertainty.",
    "- Return JSON only and follow the schema exactly.",
  ].join("\n");
}

export function buildResearchBriefPrompt(input: ResearchBriefInput): string {
  return JSON.stringify(researchBriefInputSchema.parse(input));
}

export function researchBriefJsonSchema(input: ResearchBriefInput): Record<string, unknown> {
  const evidenceIds = input.evidence.map((item) => item.id);
  const citations = {
    type: "array",
    minItems: 1,
    maxItems: 4,
    items: { type: "string", enum: evidenceIds },
  };
  const statement = {
    type: "object",
    properties: {
      text: { type: "string" },
      evidenceIds: citations,
    },
    required: ["text", "evidenceIds"],
  };
  return {
    type: "object",
    properties: {
      summary: statement,
      opportunitySignals: { type: "array", minItems: 1, maxItems: 4, items: statement },
      counterSignals: { type: "array", maxItems: 4, items: statement },
      validationQuestions: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            why: { type: "string" },
            evidenceIds: citations,
          },
          required: ["question", "why", "evidenceIds"],
        },
      },
    },
    required: ["summary", "opportunitySignals", "counterSignals", "validationQuestions"],
  };
}

/** Re-validates the model output and rejects every citation not present in the supplied registry. */
export function parseResearchBriefResponse(raw: string, input: ResearchBriefInput): ResearchBrief {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ResearchBriefResponseError("Model output was not valid JSON");
  }
  const parsed = researchBriefSchema.safeParse(json);
  if (!parsed.success) throw new ResearchBriefResponseError("Model output did not match the research brief schema");

  const allowed = new Set(input.evidence.map((item) => item.id));
  const citationGroups = [
    parsed.data.summary.evidenceIds,
    ...parsed.data.opportunitySignals.map((item) => item.evidenceIds),
    ...parsed.data.counterSignals.map((item) => item.evidenceIds),
    ...parsed.data.validationQuestions.map((item) => item.evidenceIds),
  ];
  if (citationGroups.some((ids) => ids.some((id) => !allowed.has(id)))) {
    throw new ResearchBriefResponseError("Model output cited evidence outside the supplied registry");
  }
  return parsed.data;
}

export function researchBriefInputHash(input: ResearchBriefInput): string {
  return createHash("sha256")
    .update(JSON.stringify({ promptVersion: RESEARCH_BRIEF_PROMPT_VERSION, input: researchBriefInputSchema.parse(input) }))
    .digest("hex");
}

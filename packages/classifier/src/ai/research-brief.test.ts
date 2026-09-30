import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildResearchBriefPrompt,
  parseResearchBriefResponse,
  researchBriefInputHash,
  researchBriefJsonSchema,
  ResearchBriefResponseError,
  type ResearchBriefInput,
} from "./research-brief.js";

const input: ResearchBriefInput = {
  opportunityId: "00000000-0000-4000-8000-000000000001",
  title: "Puzzle + Matching",
  platform: "google_play",
  market: "id",
  asOf: "2026-09-30T00:00:00.000Z",
  evidence: [
    { id: "market.score", label: "Market Opportunity", value: "78 of 100" },
    { id: "research.confidence", label: "Research Confidence", value: "64% (medium)" },
    { id: "risk.1", label: "Counter-signal", value: "Recent entrants have not gained momentum" },
  ],
};

const response = {
  summary: { text: "Worth validating, with moderate confidence.", evidenceIds: ["market.score", "research.confidence"] },
  opportunitySignals: [{ text: "Observed signal is above average.", evidenceIds: ["market.score"] }],
  counterSignals: [{ text: "Recent entrants are weak.", evidenceIds: ["risk.1"] }],
  validationQuestions: [
    { question: "Can a prototype differentiate?", why: "The market signal alone is insufficient.", evidenceIds: ["market.score"] },
    { question: "Is entrant momentum improving?", why: "Current entrants are weak.", evidenceIds: ["risk.1"] },
  ],
};

describe("research brief contract", () => {
  it("builds a closed evidence prompt and deterministic hash", () => {
    assert.deepEqual(JSON.parse(buildResearchBriefPrompt(input)), input);
    assert.equal(researchBriefInputHash(input), researchBriefInputHash(structuredClone(input)));
    assert.deepEqual((researchBriefJsonSchema(input).properties as Record<string, unknown>).summary !== undefined, true);
  });

  it("accepts cited output and rejects unknown evidence ids", () => {
    assert.equal(parseResearchBriefResponse(JSON.stringify(response), input).validationQuestions.length, 2);
    assert.throws(
      () => parseResearchBriefResponse(JSON.stringify({ ...response, summary: { text: "Invented", evidenceIds: ["revenue.estimate"] } }), input),
      ResearchBriefResponseError,
    );
  });

  it("rejects malformed output and uncited statements", () => {
    assert.throws(() => parseResearchBriefResponse("not-json", input), ResearchBriefResponseError);
    assert.throws(
      () => parseResearchBriefResponse(JSON.stringify({ ...response, summary: { text: "No citation", evidenceIds: [] } }), input),
      ResearchBriefResponseError,
    );
  });
});

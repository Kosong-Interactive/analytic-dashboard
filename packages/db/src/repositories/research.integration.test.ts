import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { createDatabaseConnection } from "../client";
import type { DatabaseExecutor } from "./executor";
import {
  loadLatestOpportunities,
  loadOpportunityDecisions,
  loadOpportunityDetail,
  recordFailedResearchRun,
  recordOpportunityDecision,
  recordResearchRun,
  type OpportunityRowInput,
} from "./research";

// Needs a migrated PostgreSQL. Every test rolls back, so nothing is left behind.
const connectionString = process.env.TEST_DATABASE_URL;
const connection = connectionString ? createDatabaseConnection(connectionString) : null;

class Rollback extends Error {}

async function inRolledBackTransaction(run: (tx: DatabaseExecutor) => Promise<void>): Promise<void> {
  const database = connection?.db;
  assert.ok(database);
  await assert.rejects(
    () =>
      database.transaction(async (tx) => {
        await run(tx);
        throw new Rollback();
      }),
    Rollback,
  );
}

const run = {
  formulaVersion: "opportunity-test",
  taxonomyVersion: "taxonomy-test",
  store: "google_play" as const,
  country: "id",
  windowDays: 7,
  trackedGames: 50,
  historyDays: 7,
  freshness: "fresh",
};

function opportunity(key: string, score: number | null): OpportunityRowInput {
  return {
    opportunityKey: key,
    dimensions: [{ type: "genre", slug: key, displayName: key }],
    memberCount: 6,
    score,
    reason: score === null ? "demand is not measurable yet" : null,
    weightCoverage: 0.7,
    confidence: 0.5,
    confidenceBand: "medium",
    insightType: score === null ? null : "build_opportunity",
    components: [],
    facts: {},
    comparables: [],
    positives: [],
    counterSignals: [],
    caveats: [],
  };
}

after(async () => {
  await connection?.client.end();
});

describe("research repository", { skip: connection === null }, () => {
  it("skips a rerun with identical inputs and keeps earlier runs", async () => {
    await inRolledBackTransaction(async (tx) => {
      const first = await recordResearchRun(tx, {
        run: { ...run, asOf: new Date("2026-10-01T02:00:00Z"), inputHash: "h1" },
        opportunities: [opportunity("puzzle", 70), opportunity("rpg", null)],
      });
      const again = await recordResearchRun(tx, {
        run: { ...run, asOf: new Date("2026-10-01T03:00:00Z"), inputHash: "h1" },
        opportunities: [opportunity("puzzle", 70)],
      });
      assert.equal(first.created, true);
      assert.deepEqual(again, { created: false, runId: null });

      const later = await recordResearchRun(tx, {
        run: { ...run, asOf: new Date("2026-10-02T02:00:00Z"), inputHash: "h2" },
        opportunities: [opportunity("puzzle", 60), opportunity("arcade", 80), opportunity("rpg", null)],
      });
      assert.equal(later.created, true);

      const latest = await loadLatestOpportunities(tx, { stores: ["google_play"], country: "id", formulaVersion: "opportunity-test", limit: 5 });
      assert.deepEqual(latest.opportunities.map((o) => `${o.opportunityKey}:${o.score}`), ["arcade:80", "puzzle:60"]);
      assert.equal(latest.preview, null);
      assert.equal(latest.runs[0]?.cohortsEvaluated, 3);
      assert.equal(latest.runs[0]?.opportunitiesScored, 2);
    });
  });

  it("returns one real unscored cohort as a preview when no opportunity can be scored", async () => {
    await inRolledBackTransaction(async (tx) => {
      await recordResearchRun(tx, {
        run: { ...run, asOf: new Date("2026-10-01T02:00:00Z"), inputHash: "preview" },
        opportunities: [opportunity("small", null), { ...opportunity("large", null), memberCount: 20 }],
      });

      const latest = await loadLatestOpportunities(tx, { stores: ["google_play"], country: "id", formulaVersion: "opportunity-test", limit: 5 });
      assert.deepEqual(latest.opportunities, []);
      assert.equal(latest.preview?.opportunityKey, "large");
      assert.equal(latest.preview?.score, null);
      assert.equal(latest.preview?.reason, "demand is not measurable yet");
    });
  });

  it("reports a newer failed run while still showing the last successful results", async () => {
    await inRolledBackTransaction(async (tx) => {
      await recordResearchRun(tx, {
        run: { ...run, asOf: new Date("2026-10-01T02:00:00Z"), inputHash: "h1" },
        opportunities: [opportunity("puzzle", 70)],
      });
      await recordFailedResearchRun(tx, { ...run, asOf: new Date("2026-10-02T02:00:00Z"), errorSample: "load failed" });
      const latest = await loadLatestOpportunities(tx, { stores: ["google_play"], country: "id", formulaVersion: "opportunity-test", limit: 5 });
      assert.equal(latest.runs[0]?.status, "failed");
      assert.deepEqual(latest.opportunities.map((o) => o.opportunityKey), ["puzzle"]);
    });
  });

  it("loads full evidence and appends decision history", async () => {
    await inRolledBackTransaction(async (tx) => {
      await recordResearchRun(tx, {
        run: { ...run, asOf: new Date("2026-10-01T02:00:00Z"), inputHash: "detail" },
        opportunities: [opportunity("puzzle", 70)],
      });
      const latest = await loadLatestOpportunities(tx, { stores: ["google_play"], country: "id", formulaVersion: "opportunity-test", limit: 5 });
      const opportunityId = latest.opportunities[0]?.id;
      assert.ok(opportunityId);

      const detail = await loadOpportunityDetail(tx, opportunityId);
      assert.equal(detail?.formulaVersion, "opportunity-test");
      assert.equal(detail?.score, 70);

      const saved = await recordOpportunityDecision(tx, {
        opportunityId,
        status: "shortlisted",
        note: "Validate demand",
        owner: "Core team",
        actor: "tester@example.com",
      });
      assert.equal(saved, true);
      const decisions = await loadOpportunityDecisions(tx, opportunityId);
      assert.equal(decisions.length, 1);
      assert.equal(decisions[0]?.status, "shortlisted");
      assert.equal(decisions[0]?.actor, "tester@example.com");
    });
  });
});

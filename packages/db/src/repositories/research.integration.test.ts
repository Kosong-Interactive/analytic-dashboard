import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { createDatabaseConnection } from "../client";
import type { DatabaseExecutor } from "./executor";
import {
  loadCohortOpportunityDecisions,
  loadLatestOpportunities,
  loadMarketOpportunityIndex,
  loadOpportunitiesByIds,
  loadOpportunityHistories,
  loadOpportunityDecisions,
  loadOpportunityDetail,
  recordFailedResearchRun,
  recordOpportunityDecision,
  recordResearchRun,
  type OpportunityRowInput,
} from "./research";
import { createStudioProfileVersion, loadLatestStudioProfile } from "./studio-profiles";
import { loadLatestResearchBrief, loadResearchBriefInputHashes, recordResearchBrief } from "./research-briefs";
import {
  loadDesktopOpportunityDecisions,
  loadLatestDesktopOpportunityDecisions,
  recordDesktopOpportunityDecision,
} from "./desktop-opportunity-decisions";

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

      const puzzle = latest.opportunities.find((row) => row.opportunityKey === "puzzle");
      assert.ok(puzzle);
      const history = await loadOpportunityHistories(tx, [{
        store: puzzle.store,
        country: puzzle.country,
        formulaVersion: puzzle.formulaVersion,
        taxonomyVersion: puzzle.taxonomyVersion,
        opportunityKey: puzzle.opportunityKey,
        asOf: puzzle.asOf,
      }]);
      assert.deepEqual(history.map((row) => row.score), [70, 60]);
      assert.equal(history.every((row) => row.formulaVersion === "opportunity-test"), true);
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

  it("appends Desktop decisions with evidence and loads the latest decision per label", async () => {
    await inRolledBackTransaction(async (tx) => {
      const base = {
        country: "id",
        labelType: "genre" as const,
        labelSlug: "survival",
        labelDisplayName: "Survival",
        formulaVersion: "platform_opportunity_v1",
        steamTaxonomyVersion: "taxonomy-v2",
        mobileTaxonomyVersion: "taxonomy-v1",
        note: "Validate the adaptation",
        owner: "Prototype team",
        actor: "tester@example.com",
        evidence: { mode: "steam_to_mobile", measured: 2 },
      };
      await recordDesktopOpportunityDecision(tx, {
        ...base,
        status: "shortlisted",
        createdAt: new Date("2026-10-01T03:00:00Z"),
      });
      await recordDesktopOpportunityDecision(tx, {
        ...base,
        status: "prototype",
        note: "Prototype approved",
        createdAt: new Date("2026-10-01T04:00:00Z"),
      });

      const history = await loadDesktopOpportunityDecisions(tx, {
        country: "id",
        labelType: "genre",
        labelSlug: "survival",
      });
      assert.equal(history.length, 2);
      assert.equal(history[0]?.status, "prototype");
      assert.deepEqual(history[0]?.evidence, { mode: "steam_to_mobile", measured: 2 });

      const latest = await loadLatestDesktopOpportunityDecisions(tx, {
        country: "id",
        labels: [
          { labelType: "genre", labelSlug: "survival" },
          { labelType: "theme", labelSlug: "fantasy" },
        ],
      });
      assert.equal(latest.get("genre:survival")?.status, "prototype");
      assert.equal(latest.has("theme:fantasy"), false);
    });
  });

  it("appends studio profile versions and loads only the latest", async () => {
    await inRolledBackTransaction(async (tx) => {
      const baseProfile = {
        teamSize: 5,
        targetDurationMonths: 8,
        supportedPlatforms: ["google_play"],
        inputMethods: ["touch"],
        capability2d: "strong" as const,
        capability3d: "none" as const,
        onlineBackendCapability: "basic" as const,
        contentProductionCapability: "strong" as const,
        liveOpsCapability: "basic" as const,
        monetizationCapabilities: ["ads"],
        preferredLabels: ["genre:puzzle"],
        avoidedLabels: [],
        createdBy: "tester@example.com",
      };
      const first = await createStudioProfileVersion(tx, baseProfile, "integration-test");
      const second = await createStudioProfileVersion(
        tx,
        { ...baseProfile, teamSize: 7, createdBy: "lead@example.com" },
        "integration-test",
      );

      assert.equal(first.version, 1);
      assert.equal(second.version, 2);
      const latest = await loadLatestStudioProfile(tx, "integration-test");
      assert.equal(latest?.version, 2);
      assert.equal(latest?.teamSize, 7);
      assert.equal(latest?.createdBy, "lead@example.com");
    });
  });

  it("stores a cited AI brief idempotently and loads the latest version", async () => {
    await inRolledBackTransaction(async (tx) => {
      await recordResearchRun(tx, {
        run: { ...run, asOf: new Date("2026-10-01T02:00:00Z"), inputHash: "brief-source" },
        opportunities: [opportunity("brief-puzzle", 76)],
      });
      const latest = await loadLatestOpportunities(tx, {
        stores: ["google_play"],
        country: "id",
        formulaVersion: "opportunity-test",
        limit: 5,
      });
      const opportunityId = latest.opportunities[0]?.id;
      assert.ok(opportunityId);
      const input = {
        opportunityId,
        inputHash: "brief-input-hash",
        promptVersion: "research-brief-test",
        model: "fake-model",
        brief: { summary: { text: "Validate this signal", evidenceIds: ["market.score"] } },
        evidence: [{ id: "market.score", label: "Market Opportunity", value: "76 of 100" }],
        inputTokens: 100,
        outputTokens: 20,
      };
      assert.equal(await recordResearchBrief(tx, input), true);
      assert.equal(await recordResearchBrief(tx, input), false);
      const hashes = await loadResearchBriefInputHashes(tx, "research-brief-test", [opportunityId]);
      assert.equal(hashes.has(`${opportunityId}:brief-input-hash`), true);
      const brief = await loadLatestResearchBrief(tx, opportunityId);
      assert.equal(brief?.model, "fake-model");
    });
  });

  it("indexes the latest run of every storefront of a market and loads full rows by id", async () => {
    await inRolledBackTransaction(async (tx) => {
      await recordResearchRun(tx, {
        run: { ...run, country: "sg", asOf: new Date("2026-10-01T02:00:00Z"), inputHash: "old" },
        opportunities: [opportunity("puzzle", 10)],
      });
      await recordResearchRun(tx, {
        run: { ...run, country: "sg", asOf: new Date("2026-10-02T02:00:00Z"), inputHash: "sg" },
        opportunities: [opportunity("puzzle", 70), opportunity("rpg", null)],
      });
      await recordResearchRun(tx, {
        run: { ...run, country: "th", asOf: new Date("2026-10-02T02:00:00Z"), inputHash: "th" },
        opportunities: [opportunity("puzzle", 50)],
      });
      await recordResearchRun(tx, {
        run: { ...run, country: "us", asOf: new Date("2026-10-02T02:00:00Z"), inputHash: "us" },
        opportunities: [opportunity("puzzle", 99)],
      });

      const { runs, index } = await loadMarketOpportunityIndex(tx, {
        stores: ["google_play"],
        countries: ["sg", "th", "vn"],
        formulaVersion: "opportunity-test",
      });
      assert.deepEqual(runs.map((r) => r.country).sort(), ["sg", "th"]);
      assert.deepEqual(
        index.map((row) => `${row.country}:${row.opportunityKey}:${row.score}`).sort(),
        ["sg:puzzle:70", "sg:rpg:null", "th:puzzle:50"],
      );

      const full = await loadOpportunitiesByIds(tx, index.map((row) => row.id));
      const rpg = full.find((row) => row.opportunityKey === "rpg");
      assert.equal(rpg?.score, null);
      assert.equal(full.find((row) => row.country === "th")?.score, 50);
    });
  });

  it("reads team decisions by cohort across the storefronts of a market", async () => {
    await inRolledBackTransaction(async (tx) => {
      for (const [country, hash] of [["sg", "sg"], ["th", "th"], ["us", "us"]] as const) {
        await recordResearchRun(tx, {
          run: { ...run, country, asOf: new Date("2026-10-02T02:00:00Z"), inputHash: hash },
          opportunities: [opportunity("puzzle", 60)],
        });
      }
      const { index } = await loadMarketOpportunityIndex(tx, {
        stores: ["google_play"],
        countries: ["sg", "th", "us"],
        formulaVersion: "opportunity-test",
      });
      const idOf = (country: string) => index.find((row) => row.country === country)?.id ?? "";
      for (const country of ["sg", "us"]) {
        await recordOpportunityDecision(tx, {
          opportunityId: idOf(country),
          status: "shortlisted",
          note: null,
          owner: null,
          actor: "tester@example.com",
        });
      }

      const sea = await loadCohortOpportunityDecisions(tx, {
        store: "google_play",
        countries: ["sg", "th", "vn"],
        formulaVersion: "opportunity-test",
        opportunityKey: "puzzle",
      });
      assert.deepEqual(sea.map((d) => d.opportunityId), [idOf("sg")]);
    });
  });
});

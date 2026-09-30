import "server-only";

import { scoreStudioFit, type StudioFitResult } from "@analytic-dashboard/analytics";
import { loadLatestResearchBrief, loadOpportunityDecisions, loadOpportunityDetail, loadOpportunityHistories } from "@analytic-dashboard/db";
import { z } from "zod";

import { getDatabase } from "../database";
import { buildOpportunityDetailView, type OpportunityDetailView } from "./detail-view-model";
import { getStudioProfile } from "./studio-profile-service";
import type { StudioProfileView } from "./studio-profile";
import { buildResearchBriefView, type ResearchBriefView } from "./research-brief-view";
import { buildOpportunityHistoryView, type OpportunityHistoryView } from "./history-view-model";

export const opportunityIdSchema = z.uuid();

export type OpportunityDetailResult =
  | { kind: "ready"; view: OpportunityDetailView; profile: StudioProfileView | null; studioFit: StudioFitResult | null; brief: ResearchBriefView | null; history: OpportunityHistoryView | null }
  | { kind: "not_found" }
  | { kind: "invalid_evidence" };

export async function getOpportunityDetail(id: string): Promise<OpportunityDetailResult> {
  if (!opportunityIdSchema.safeParse(id).success) return { kind: "not_found" };
  const db = getDatabase();
  const row = await loadOpportunityDetail(db, id);
  if (!row) return { kind: "not_found" };
  const [decisions, profile, storedBrief, storedHistory] = await Promise.all([
    loadOpportunityDecisions(db, id),
    getStudioProfile(),
    loadLatestResearchBrief(db, id),
    loadOpportunityHistories(db, [{
      store: row.store,
      country: row.country,
      formulaVersion: row.formulaVersion,
      taxonomyVersion: row.taxonomyVersion,
      opportunityKey: row.opportunityKey,
      asOf: row.asOf,
    }]),
  ]);
  const view = buildOpportunityDetailView(row, decisions);
  if (!view) return { kind: "invalid_evidence" };
  const studioFit = profile
    ? scoreStudioFit(profile, { store: view.store, dimensions: view.dimensions, marketScore: view.score })
    : null;
  return {
    kind: "ready",
    view,
    profile,
    studioFit,
    brief: buildResearchBriefView(storedBrief),
    history: buildOpportunityHistoryView(storedHistory, row.id),
  };
}

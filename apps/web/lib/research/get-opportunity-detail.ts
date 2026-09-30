import "server-only";

import { loadOpportunityDecisions, loadOpportunityDetail } from "@analytic-dashboard/db";
import { z } from "zod";

import { getDatabase } from "../database";
import { buildOpportunityDetailView, type OpportunityDetailView } from "./detail-view-model";

export const opportunityIdSchema = z.uuid();

export type OpportunityDetailResult =
  | { kind: "ready"; view: OpportunityDetailView }
  | { kind: "not_found" }
  | { kind: "invalid_evidence" };

export async function getOpportunityDetail(id: string): Promise<OpportunityDetailResult> {
  if (!opportunityIdSchema.safeParse(id).success) return { kind: "not_found" };
  const db = getDatabase();
  const row = await loadOpportunityDetail(db, id);
  if (!row) return { kind: "not_found" };
  const decisions = await loadOpportunityDecisions(db, id);
  const view = buildOpportunityDetailView(row, decisions);
  return view ? { kind: "ready", view } : { kind: "invalid_evidence" };
}

import { z } from "zod";

import { opportunityDecisionValues } from "./detail-view-model";

export const OPPORTUNITY_NOTE_MAX = 2000;
export const OPPORTUNITY_OWNER_MAX = 200;

export const opportunityDecisionSchema = z.object({
  opportunityId: z.uuid(),
  status: z.enum(opportunityDecisionValues),
  note: z
    .string()
    .max(OPPORTUNITY_NOTE_MAX)
    .transform((value) => value.trim() || null),
  owner: z
    .string()
    .max(OPPORTUNITY_OWNER_MAX)
    .transform((value) => value.trim() || null),
});

export function opportunityDecisionFormInput(formData: FormData): Record<string, unknown> {
  const value = (name: string) => {
    const entry = formData.get(name);
    return typeof entry === "string" ? entry : "";
  };
  return {
    opportunityId: value("opportunityId"),
    status: value("status"),
    note: value("note"),
    owner: value("owner"),
  };
}

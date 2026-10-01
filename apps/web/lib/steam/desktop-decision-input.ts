import { marketHomeCountrySchema } from "@analytic-dashboard/shared";
import { z } from "zod";

import { opportunityDecisionValues } from "../research/detail-view-model";
import { compareTypeValues } from "./platform-compare";

export const DESKTOP_OPPORTUNITY_NOTE_MAX = 2000;
export const DESKTOP_OPPORTUNITY_OWNER_MAX = 200;

export const desktopOpportunityDecisionSchema = z.object({
  country: marketHomeCountrySchema,
  labelType: z.enum(compareTypeValues),
  labelSlug: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  status: z.enum(opportunityDecisionValues),
  note: z
    .string()
    .max(DESKTOP_OPPORTUNITY_NOTE_MAX)
    .transform((value) => value.trim() || null),
  owner: z
    .string()
    .max(DESKTOP_OPPORTUNITY_OWNER_MAX)
    .transform((value) => value.trim() || null),
});

export function desktopOpportunityDecisionFormInput(formData: FormData): Record<string, unknown> {
  const value = (name: string) => {
    const entry = formData.get(name);
    return typeof entry === "string" ? entry : "";
  };
  return {
    country: value("country"),
    labelType: value("labelType"),
    labelSlug: value("labelSlug"),
    status: value("status"),
    note: value("note"),
    owner: value("owner"),
  };
}

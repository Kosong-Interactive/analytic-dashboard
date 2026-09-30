import { z } from "zod";

export const capabilityLevels = ["none", "basic", "strong"] as const;
export type CapabilityLevel = (typeof capabilityLevels)[number];
export const capabilityLabels: Record<CapabilityLevel, string> = {
  none: "Not available",
  basic: "Basic",
  strong: "Strong",
};

export const studioPlatformValues = ["google_play", "app_store"] as const;
export const inputMethodValues = ["touch", "keyboard_mouse", "controller"] as const;
export const inputMethodLabels: Record<(typeof inputMethodValues)[number], string> = {
  touch: "Touch",
  keyboard_mouse: "Keyboard & mouse",
  controller: "Controller",
};
export const monetizationValues = ["ads", "in_app_purchases", "premium", "subscription"] as const;
export const monetizationLabels: Record<(typeof monetizationValues)[number], string> = {
  ads: "Ads",
  in_app_purchases: "In-app purchases",
  premium: "Premium",
  subscription: "Subscription",
};

const labelKeySchema = z.string().regex(/^[a-z_]+:[a-z0-9_]+$/);
const studioProfileBaseSchema = z.object({
    teamSize: z.coerce.number().int().min(1).max(500),
    targetDurationMonths: z.coerce.number().int().min(1).max(120),
    supportedPlatforms: z.array(z.enum(studioPlatformValues)).min(1),
    inputMethods: z.array(z.enum(inputMethodValues)).min(1),
    capability2d: z.enum(capabilityLevels),
    capability3d: z.enum(capabilityLevels),
    onlineBackendCapability: z.enum(capabilityLevels),
    contentProductionCapability: z.enum(capabilityLevels),
    liveOpsCapability: z.enum(capabilityLevels),
    monetizationCapabilities: z.array(z.enum(monetizationValues)),
    preferredLabels: z.array(labelKeySchema),
    avoidedLabels: z.array(labelKeySchema),
  });

function validateDirectionOverlap(
  value: Pick<z.infer<typeof studioProfileBaseSchema>, "preferredLabels" | "avoidedLabels">,
  context: z.RefinementCtx,
) {
    const avoided = new Set(value.avoidedLabels);
    for (const key of value.preferredLabels) {
      if (avoided.has(key)) context.addIssue({ code: "custom", message: `${key} cannot be both preferred and avoided` });
    }
}

export const studioProfileSchema = studioProfileBaseSchema.superRefine(validateDirectionOverlap);

export type StudioProfileForm = z.infer<typeof studioProfileSchema>;

export interface StudioProfileView extends StudioProfileForm {
  id: string;
  version: number;
  createdBy: string;
  createdAt: Date;
}

export const storedStudioProfileSchema = studioProfileBaseSchema
  .extend({
    id: z.uuid(),
    version: z.number().int().positive(),
    createdBy: z.string(),
    createdAt: z.date(),
  })
  .superRefine(validateDirectionOverlap);

export function studioProfileFormInput(formData: FormData): Record<string, unknown> {
  const value = (name: string) => {
    const entry = formData.get(name);
    return typeof entry === "string" ? entry : "";
  };
  const values = (name: string) => formData.getAll(name).filter((entry): entry is string => typeof entry === "string");
  return {
    teamSize: value("teamSize"),
    targetDurationMonths: value("targetDurationMonths"),
    supportedPlatforms: values("supportedPlatforms"),
    inputMethods: values("inputMethods"),
    capability2d: value("capability2d"),
    capability3d: value("capability3d"),
    onlineBackendCapability: value("onlineBackendCapability"),
    contentProductionCapability: value("contentProductionCapability"),
    liveOpsCapability: value("liveOpsCapability"),
    monetizationCapabilities: values("monetizationCapabilities"),
    preferredLabels: values("preferredLabels"),
    avoidedLabels: values("avoidedLabels"),
  };
}

import { desc, eq } from "drizzle-orm";

import { studioProfiles } from "../schema/index";
import type { DatabaseExecutor } from "./executor";

export type StudioCapabilityLevel = "none" | "basic" | "strong";

export interface StudioProfileInput {
  teamSize: number;
  targetDurationMonths: number;
  supportedPlatforms: unknown;
  inputMethods: unknown;
  capability2d: StudioCapabilityLevel;
  capability3d: StudioCapabilityLevel;
  onlineBackendCapability: StudioCapabilityLevel;
  contentProductionCapability: StudioCapabilityLevel;
  liveOpsCapability: StudioCapabilityLevel;
  monetizationCapabilities: unknown;
  preferredLabels: unknown;
  avoidedLabels: unknown;
  createdBy: string;
}

export interface StudioProfileRow extends StudioProfileInput {
  id: string;
  profileKey: string;
  version: number;
  createdAt: Date;
}

export async function loadLatestStudioProfile(
  db: DatabaseExecutor,
  profileKey = "default",
): Promise<StudioProfileRow | null> {
  const [row] = await db
    .select()
    .from(studioProfiles)
    .where(eq(studioProfiles.profileKey, profileKey))
    .orderBy(desc(studioProfiles.version))
    .limit(1);
  return (row as StudioProfileRow | undefined) ?? null;
}

/** Appends a new profile version; previous versions remain available for auditability. */
export async function createStudioProfileVersion(
  db: DatabaseExecutor,
  input: StudioProfileInput,
  profileKey = "default",
): Promise<StudioProfileRow> {
  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: studioProfiles.version })
      .from(studioProfiles)
      .where(eq(studioProfiles.profileKey, profileKey))
      .orderBy(desc(studioProfiles.version))
      .limit(1);
    const [created] = await tx
      .insert(studioProfiles)
      .values({ ...input, profileKey, version: (latest?.version ?? 0) + 1 })
      .returning();
    if (!created) throw new Error("studio profile insert returned no row");
    return created as StudioProfileRow;
  });
}

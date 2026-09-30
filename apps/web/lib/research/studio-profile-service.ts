import "server-only";

import { createStudioProfileVersion, loadLatestStudioProfile, loadTaxonomyLabels } from "@analytic-dashboard/db";

import { getCurrentUser } from "../auth/session";
import { getDatabase } from "../database";
import { TAXONOMY_VERSION } from "../labels/constants";
import { storedStudioProfileSchema, studioProfileSchema, type StudioProfileView } from "./studio-profile";

export type StudioProfileSaveResult = { ok: true; version: number } | { ok: false; error: string };

export async function getStudioProfile(): Promise<StudioProfileView | null> {
  const row = await loadLatestStudioProfile(getDatabase());
  if (!row) return null;
  const parsed = storedStudioProfileSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export async function saveStudioProfile(raw: unknown): Promise<StudioProfileSaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };
  const parsed = studioProfileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the profile fields and remove conflicting preferences." };

  const db = getDatabase();
  const taxonomy = await loadTaxonomyLabels(db, TAXONOMY_VERSION);
  const allowed = new Set(taxonomy.map((label) => `${label.type}:${label.slug}`));
  if ([...parsed.data.preferredLabels, ...parsed.data.avoidedLabels].some((key) => !allowed.has(key))) {
    return { ok: false, error: "One selected direction is not part of the current taxonomy." };
  }

  try {
    const created = await createStudioProfileVersion(db, {
      ...parsed.data,
      createdBy: user.email ?? user.id,
    });
    return { ok: true, version: created.version };
  } catch (error) {
    console.error("studio profile save failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "The studio profile could not be saved. Try again." };
  }
}

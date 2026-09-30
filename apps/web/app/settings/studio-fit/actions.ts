"use server";

import { revalidatePath } from "next/cache";

import { studioProfileFormInput } from "@/lib/research/studio-profile";
import { saveStudioProfile, type StudioProfileSaveResult } from "@/lib/research/studio-profile-service";

export type StudioProfileActionState = StudioProfileSaveResult | { ok: null };

export async function updateStudioProfile(
  _previous: StudioProfileActionState,
  formData: FormData,
): Promise<StudioProfileActionState> {
  const result = await saveStudioProfile(studioProfileFormInput(formData));
  if (result.ok) {
    revalidatePath("/settings/studio-fit");
    revalidatePath("/research/[id]", "page");
  }
  return result;
}

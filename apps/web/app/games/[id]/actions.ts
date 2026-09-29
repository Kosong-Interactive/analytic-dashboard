"use server";

import { revalidatePath } from "next/cache";

import { applyManualLabel, type ManualLabelResult } from "@/lib/labels/manual-labels";

export type LabelActionState = ManualLabelResult | { ok: null };

export async function changeLabel(_previous: LabelActionState, formData: FormData): Promise<LabelActionState> {
  const storeAppId = String(formData.get("storeAppId") ?? "");
  const result = await applyManualLabel({
    storeAppId,
    labelId: formData.get("labelId"),
    intent: formData.get("intent"),
  });
  if (result.ok) {
    // Roll-up pages read the same labels, so they are refreshed too.
    revalidatePath(`/games/${storeAppId}`);
    revalidatePath("/genres");
    revalidatePath("/mechanics");
  }
  return result;
}

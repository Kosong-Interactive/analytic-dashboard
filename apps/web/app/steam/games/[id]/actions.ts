"use server";

import { revalidatePath } from "next/cache";

import { applySteamManualLabel, type SteamManualLabelResult } from "@/lib/steam/manual-labels";

export type SteamLabelActionState = SteamManualLabelResult | { ok: null };

export async function changeSteamLabel(
  _previous: SteamLabelActionState,
  formData: FormData,
): Promise<SteamLabelActionState> {
  const result = await applySteamManualLabel({
    steamAppId: formData.get("steamAppId"),
    labelId: formData.get("labelId"),
    intent: formData.get("intent"),
  });
  if (result.ok) {
    const externalId = String(formData.get("externalId") ?? "");
    if (/^[1-9][0-9]{0,11}$/.test(externalId)) revalidatePath(`/steam/games/${externalId}`);
    revalidatePath("/steam");
    revalidatePath("/steam/games");
    revalidatePath("/steam/genres");
    revalidatePath("/steam/mechanics");
  }
  return result;
}

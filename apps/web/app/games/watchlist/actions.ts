"use server";

import { revalidatePath } from "next/cache";

import { applyWatchlistChange, type WatchlistChangeResult } from "@/lib/watchlist/changes";
import { watchlistFormInput } from "@/lib/watchlist/input";

export type WatchlistActionState = WatchlistChangeResult | { ok: null };

export async function changeWatchlist(
  _previous: WatchlistActionState,
  formData: FormData,
): Promise<WatchlistActionState> {
  const input = watchlistFormInput(formData);
  const result = await applyWatchlistChange(input);
  if (result.ok) {
    revalidatePath("/games/watchlist");
    revalidatePath("/games");
    if (typeof input.storeAppId === "string") revalidatePath(`/games/${input.storeAppId}`);
  }
  return result;
}

import "server-only";

import { addWatchlistEntry, removeWatchlistEntry, updateWatchlistEntry } from "@analytic-dashboard/db";

import { getCurrentUser } from "../auth/session";
import { getDatabase } from "../database";
import { watchlistChangeSchema } from "./input";

export type WatchlistChangeResult = { ok: true } | { ok: false; error: string };

/** Applies one watchlist change for the signed-in person, who is recorded as the actor. */
export async function applyWatchlistChange(raw: unknown): Promise<WatchlistChangeResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Sign in again." };

  const parsed = watchlistChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That watchlist change was not valid." };
  const change = parsed.data;
  const actor = user.email ?? user.id;
  const db = getDatabase();

  try {
    switch (change.intent) {
      case "add":
        await addWatchlistEntry(db, { storeAppId: change.storeAppId, actor });
        return { ok: true };
      case "update": {
        const found = await updateWatchlistEntry(db, {
          storeAppId: change.storeAppId,
          actor,
          status: change.status,
          note: change.note,
        });
        return found ? { ok: true } : { ok: false, error: "This game is no longer on the watchlist." };
      }
      case "remove":
        await removeWatchlistEntry(db, change.storeAppId);
        return { ok: true };
    }
  } catch (error) {
    // Only the error name is logged; the message can include query details.
    console.error("watchlist change failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, error: "The change could not be saved. Try again." };
  }
}

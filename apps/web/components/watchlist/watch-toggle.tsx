"use client";

import { Star } from "lucide-react";
import { useActionState, useOptimistic } from "react";

import { changeWatchlist, type WatchlistActionState } from "@/app/games/watchlist/actions";
import { cn } from "@/lib/utils";

const initial: WatchlistActionState = { ok: null };

/**
 * A star in a game list row: adds to the team watchlist, or removes it again. The star flips
 * immediately; the list re-render confirms it, and a failed save flips it back.
 */
export function WatchToggle({ storeAppId, title, watched: saved }: { storeAppId: string; title: string; watched: boolean }) {
  const [watched, setWatched] = useOptimistic(saved);
  const [state, action, pending] = useActionState(async (previous: WatchlistActionState, formData: FormData) => {
    setWatched(formData.get("intent") === "add");
    return changeWatchlist(previous, formData);
  }, initial);
  const label = watched ? `Remove ${title} from the watchlist` : `Add ${title} to the watchlist`;

  return (
    <form action={action} className="inline-flex items-center">
      <input type="hidden" name="storeAppId" value={storeAppId} />
      <button
        type="submit"
        name="intent"
        value={watched ? "remove" : "add"}
        disabled={pending}
        aria-busy={pending}
        aria-pressed={watched}
        aria-label={label}
        title={state.ok === false ? state.error : watched ? "On the watchlist" : "Add to watchlist"}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md border hover:bg-surface-alt disabled:opacity-50",
          watched ? "border-star/50 text-star" : "border-line-strong text-dim hover:text-ink",
          state.ok === false && "border-down text-down",
        )}
      >
        <Star aria-hidden className={cn("size-3.5", watched && "fill-star")} />
      </button>
      {state.ok === false ? (
        <span role="alert" className="sr-only">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

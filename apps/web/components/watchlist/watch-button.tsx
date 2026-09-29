"use client";

import Link from "next/link";
import { useActionState } from "react";

import { changeWatchlist, type WatchlistActionState } from "@/app/watchlist/actions";
import { watchlistStatusLabels, type WatchlistStatus } from "@/lib/watchlist/status";

const initial: WatchlistActionState = { ok: null };

/** Adds the listing to the team watchlist, or shows its status with a link to edit it there. */
export function WatchButton({ storeAppId, status }: { storeAppId: string; status: WatchlistStatus | null }) {
  const [state, action, pending] = useActionState(changeWatchlist, initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 sm:justify-end">
      <input type="hidden" name="storeAppId" value={storeAppId} />
      {status === null ? (
        <button
          type="submit"
          name="intent"
          value="add"
          disabled={pending}
          className="h-8 rounded-md bg-accent px-3 text-xs font-medium text-canvas hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add to watchlist"}
        </button>
      ) : (
        <>
          <Link href="/watchlist" className="text-xs text-ink-soft underline-offset-2 hover:underline">
            On watchlist · {watchlistStatusLabels[status]}
          </Link>
          <button
            type="submit"
            name="intent"
            value="remove"
            disabled={pending}
            className="h-7 rounded-md border border-line-strong px-2 text-[11px] text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-50"
          >
            {pending ? "Removing…" : "Remove"}
          </button>
        </>
      )}
      {state.ok === false ? (
        <span role="alert" className="text-[11px] text-down">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

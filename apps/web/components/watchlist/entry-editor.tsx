"use client";

import { useActionState } from "react";

import { changeWatchlist, type WatchlistActionState } from "@/app/games/watchlist/actions";
import { WATCHLIST_NOTE_MAX, watchlistStatusLabels, watchlistStatusValues, type WatchlistStatus } from "@/lib/watchlist/status";

const initial: WatchlistActionState = { ok: null };
const buttonClass =
  "h-7 rounded-md border border-line-strong px-2 text-[11px] text-ink-soft hover:bg-surface hover:text-ink disabled:opacity-50";

/** Status and note for one entry. Save and Remove submit the same form with different intents. */
export function EntryEditor({
  storeAppId,
  title,
  status,
  note,
}: {
  storeAppId: string;
  title: string;
  status: WatchlistStatus;
  note: string | null;
}) {
  const [state, action, pending] = useActionState(changeWatchlist, initial);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="storeAppId" value={storeAppId} />
      <label className="flex flex-col gap-1 text-[11px] text-dim">
        <span>
          Note <span className="sr-only">for {title}</span>
        </span>
        <textarea
          name="note"
          defaultValue={note ?? ""}
          maxLength={WATCHLIST_NOTE_MAX}
          rows={2}
          placeholder="Why is this game worth watching?"
          className="min-h-14 rounded-md border border-line-strong bg-surface px-2 py-1.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-dim">
          Status
          <select
            name="status"
            defaultValue={status}
            className="h-7 rounded-md border border-line-strong bg-surface px-2 text-xs text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {watchlistStatusValues.map((value) => (
              <option key={value} value={value}>
                {watchlistStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" name="intent" value="update" disabled={pending} className={buttonClass}>
          Save
        </button>
        <button type="submit" name="intent" value="remove" disabled={pending} className={buttonClass}>
          Remove
        </button>
        {pending ? <span className="text-[11px] text-dim">Saving…</span> : null}
        {state.ok === true ? <span className="text-[11px] text-up">Saved</span> : null}
        {state.ok === false ? (
          <span role="alert" className="text-[11px] text-down">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** Shared by server code and client forms, so it has no imports. */
export const watchlistStatusValues = ["watching", "priority", "archived"] as const;
export type WatchlistStatus = (typeof watchlistStatusValues)[number];

export const watchlistStatusLabels: Record<WatchlistStatus, string> = {
  watching: "Watching",
  priority: "Priority",
  archived: "Archived",
};

export const WATCHLIST_NOTE_MAX = 2000;

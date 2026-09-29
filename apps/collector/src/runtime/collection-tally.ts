import type { CollectorEvents } from "@analytic-dashboard/collectors";

export interface CollectionTallySnapshot {
  invalidSkipped: number;
  nonGameSkipped: number;
  retryCount: number;
}

export interface CollectionTally {
  events: CollectorEvents;
  /** Returns what was counted since the previous call and resets the counters. */
  take(): CollectionTallySnapshot;
}

/** Jobs run sequentially, so one tally shared by the collectors can be drained per job. */
export function createCollectionTally(): CollectionTally {
  let current: CollectionTallySnapshot = emptySnapshot();

  return {
    events: {
      onSkipped(reason) {
        if (reason === "invalid") current.invalidSkipped += 1;
        else current.nonGameSkipped += 1;
      },
      onRetry() {
        current.retryCount += 1;
      },
    },
    take() {
      const snapshot = current;
      current = emptySnapshot();
      return snapshot;
    },
  };
}

function emptySnapshot(): CollectionTallySnapshot {
  return { invalidSkipped: 0, nonGameSkipped: 0, retryCount: 0 };
}

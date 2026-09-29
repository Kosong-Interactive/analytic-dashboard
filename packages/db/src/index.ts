export {
  createDatabaseConnection,
  type Database,
  type DatabaseConnectionOptions,
} from "./client";

export * from "./schema/index";

export {
  finishCollectorRun,
  startCollectorRun,
  type CollectorRunFinalStatus,
  type CollectorRunSource,
  type FinishCollectorRunInput,
  type StartCollectorRunInput,
} from "./repositories/collector-runs";
export type { DatabaseExecutor } from "./repositories/executor";
export {
  normalizeAppName,
  persistChartEntries,
  persistStoreApps,
  storeListingKey,
  type ChartEntryInput,
  type PersistChartEntriesInput,
  type PersistStoreAppsResult,
  type PersistableStoreApp,
} from "./repositories/store-app-persistence";
export {
  SNAPSHOT_HEARTBEAT_MS,
  decideSnapshotWrite,
  type SnapshotDecision,
} from "./repositories/snapshot-policy";
export {
  loadTrendCandidates,
  type TrendCandidateRow,
  type TrendInputsQuery,
  type TrendRankReading,
  type TrendSnapshotReading,
} from "./queries/trend-inputs";
export {
  loadSourceHealth,
  type SourceHealthRow,
} from "./queries/source-health";
export {
  loadGameHistory,
  type GameChartRow,
  type GameHistory,
  type GameHistoryQuery,
  type GameSiblingListing,
  type GameSnapshotRow,
} from "./queries/game-history";

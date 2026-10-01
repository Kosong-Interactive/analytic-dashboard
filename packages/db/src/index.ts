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
export {
  clearManualLabel,
  loadInputHashes,
  loadRuleInputHashes,
  loadSteamInputHashes,
  loadTaxonomyLabels,
  replaceAutomatedLabels,
  replaceSteamAutomatedLabels,
  replaceRuleLabels,
  setManualLabel,
  syncTaxonomyLabels,
  type AutomatedLabelRow,
  type AutomatedSource,
  type LabelType,
  type ManualDecision,
  type RuleLabelRow,
  type TaxonomyLabelInput,
} from "./repositories/classification";
export {
  loadClassificationInputs,
  loadSteamClassificationInputs,
  type SteamClassificationInputRow,
  type ClassificationInputRow,
  type ClassificationListingRow,
} from "./queries/classification-inputs";
export {
  loadLabelMembership,
  type LabelMembershipQuery,
  type LabelMembershipRow,
} from "./queries/label-membership";
export { findListingAppId, loadListingLabels, type ListingLabelRow } from "./queries/listing-labels";
export {
  addWatchlistEntry,
  findWatchlistEntry,
  loadWatchlist,
  removeWatchlistEntry,
  updateWatchlistEntry,
  type WatchlistEntryRow,
  type WatchlistStatus,
} from "./repositories/watchlist";
export { loadListingContexts, type ListingContextRow } from "./queries/listing-contexts";
export {
  escapeLikePattern,
  searchCatalog,
  type CatalogDeveloperHit,
  type CatalogGameHit,
  type CatalogLabelHit,
  type CatalogSearchQuery,
  type CatalogSearchResult,
} from "./queries/catalog-search";
export {
  loadLatestOpportunities,
  loadOpportunityHistories,
  loadOpportunityDecisions,
  loadOpportunityDetail,
  recordFailedResearchRun,
  recordOpportunityDecision,
  recordResearchRun,
  type OpportunityDecisionRow,
  type OpportunityDecisionStatus,
  type OpportunityDetailRow,
  type OpportunityHistoryIdentity,
  type OpportunityHistoryRow,
  type OpportunityRowInput,
  type ResearchRunInput,
  type ResearchRunSummary,
  type StoredOpportunity,
  type StoredOpportunityPreview,
} from "./repositories/research";
export {
  loadDesktopOpportunityDecisions,
  loadLatestDesktopOpportunityDecisions,
  recordDesktopOpportunityDecision,
  type DesktopOpportunityDecisionRow,
  type DesktopOpportunityDecisionStatus,
  type DesktopOpportunityIdentity,
  type DesktopOpportunityLabelType,
} from "./repositories/desktop-opportunity-decisions";
export {
  createStudioProfileVersion,
  loadLatestStudioProfile,
  type StudioCapabilityLevel,
  type StudioProfileInput,
  type StudioProfileRow,
} from "./repositories/studio-profiles";
export {
  loadLatestResearchBrief,
  loadResearchBriefCandidates,
  loadResearchBriefInputHashes,
  recordResearchBrief,
  type ResearchBriefRow,
} from "./repositories/research-briefs";
export {
  decideSteamSnapshotWrite,
  finishSteamCollectorRun,
  persistSteamApps,
  persistSteamChartEntries,
  persistSteamPrices,
  persistSteamSnapshots,
  startSteamCollectorRun,
  steamMetadataHash,
  type PersistSteamAppsResult,
  type PersistableSteamListing,
  type SteamChartEntryInput,
  type SteamPriceInput,
  type SteamReviewTotals,
  type SteamSnapshotInput,
} from "./repositories/steam-persistence";
export { loadSteamSourceHealth, type SteamSourceHealthRow } from "./queries/steam-source-health";
export {
  loadLatestSteamSnapshots,
  loadSteamChart,
  loadSteamGameDetail,
  type SteamChartName,
  type SteamChartRow,
  type SteamChartView,
  type SteamGameDetail,
  type SteamGameSummary,
  type SteamLatestSnapshot,
  type SteamRegionalPrice,
} from "./queries/steam-charts";
export {
  loadSteamLabelGames,
  loadSteamLabelMembership,
  type SteamLabelGame,
  type SteamLabelMembershipQuery,
  type SteamLabelMembershipRow,
} from "./queries/steam-labels";
export {
  loadSteamGameList,
  loadSteamSnapshotHistory,
  type SteamHistoryReading,
  type SteamChartPosition,
  type SteamGameList,
  type SteamGameListRow,
} from "./queries/steam-games";
export { loadSteamGameLabels, type SteamListingLabelRow } from "./queries/steam-labels";

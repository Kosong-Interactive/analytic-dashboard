/** Structural subset of a stored research row, so this package never depends on the database package. */
export interface MarketOpportunityLike {
  id: string;
  store: string;
  country: string;
  opportunityKey: string;
  score: number | null;
  confidence: number;
  memberCount: number;
}

export interface MarketOpportunity<T extends MarketOpportunityLike> {
  /**
   * The storefront row shown for the cohort: the one whose score is the (lower) median of the
   * scored storefronts, so its evidence and comparables belong to one real listing. Without any
   * score it is the storefront with the most tracked games.
   */
  opportunity: T;
  /** Storefronts of the market that evaluated the cohort. */
  evaluatedStorefronts: number;
  /** Storefronts that produced a score for the cohort. */
  scoredStorefronts: number;
}

/**
 * Combines per-storefront research rows into one market view. A cohort is one opportunity per
 * platform: the same label combination evaluated in several storefronts is counted once, and its
 * market score is the median storefront score. Unscored storefronts are left out of the median
 * rather than counted as zero, and raw counts are never summed.
 */
export function aggregateMarketOpportunities<T extends MarketOpportunityLike>(
  rows: readonly T[],
  priority: readonly string[],
): MarketOpportunity<T>[] {
  const rank = (country: string) => {
    const index = priority.indexOf(country);
    return index === -1 ? priority.length : index;
  };

  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = `${row.store}:${row.opportunityKey}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const aggregated = [...groups.values()].map((members): MarketOpportunity<T> => {
    const scored = members
      .filter((member) => member.score !== null)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || rank(a.country) - rank(b.country));
    const fallback = [...members].sort((a, b) => b.memberCount - a.memberCount || rank(a.country) - rank(b.country))[0];
    const shown = scored.length > 0 ? scored[Math.floor((scored.length - 1) / 2)] : fallback;
    if (!shown) throw new Error("A market opportunity group cannot be empty");
    return { opportunity: shown, evaluatedStorefronts: members.length, scoredStorefronts: scored.length };
  });

  return aggregated.sort(
    (a, b) =>
      (b.opportunity.score ?? -1) - (a.opportunity.score ?? -1) ||
      b.opportunity.confidence - a.opportunity.confidence ||
      a.opportunity.opportunityKey.localeCompare(b.opportunity.opportunityKey),
  );
}

import type { SteamLatestSnapshot, SteamRegionalPrice } from "@analytic-dashboard/db";

/** Share of positive reviews, or null when Steam gave no review reading (never zero). */
export function positiveRatio(snapshot: SteamLatestSnapshot | null): number | null {
  if (!snapshot || snapshot.reviewTotal === null || snapshot.reviewPositive === null) return null;
  if (snapshot.reviewTotal === 0) return null;
  return snapshot.reviewPositive / snapshot.reviewTotal;
}

export function formatRatio(ratio: number | null): string {
  return ratio === null ? "—" : `${(ratio * 100).toFixed(1)}%`;
}

export function formatPrice(price: SteamRegionalPrice | undefined, isFree: boolean): string {
  if (isFree) return "Free";
  if (!price) return "—";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: price.currency === "IDR" ? 0 : 2,
  }).format(price.finalPrice);
  return price.discountPercent > 0 ? `${amount} (−${price.discountPercent}%)` : amount;
}

/** Positive means the game moved up the chart versus last week. */
export function rankChange(rank: number, lastWeekRank: number | null): number | null {
  if (lastWeekRank === null) return null;
  return lastWeekRank - rank;
}

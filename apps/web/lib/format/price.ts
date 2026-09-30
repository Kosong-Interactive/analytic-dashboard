/** Shown for a missing price. Missing is not free, so it never reads as "Gratis". */
export const MISSING_PRICE = "—";

function group(integer: string, separator: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Upfront store price. `0` is free, `null` is unknown. IDR has no decimals ("Rp 15.000"), USD keeps
 * cents ("$4.99"), and any other currency is shown as the amount followed by its code.
 */
export function formatUpfrontPrice(price: number | null, currency: string | null): string {
  if (price === null) return MISSING_PRICE;
  if (price === 0) return "Gratis";

  const code = currency?.toUpperCase() ?? null;
  if (code === "IDR") return `Rp ${group(Math.round(price).toString(), ".")}`;
  if (code === "USD") {
    const [integer = "0", cents = "00"] = price.toFixed(2).split(".");
    return `$${group(integer, ",")}.${cents}`;
  }
  const amount = Number.isInteger(price) ? price.toString() : price.toFixed(2);
  return code ? `${amount} ${code}` : amount;
}

export const priceFilterValues = ["all", "free", "paid"] as const;
export type PriceFilter = (typeof priceFilterValues)[number];

export const priceFilterLabels: Record<PriceFilter, string> = {
  all: "Semua",
  free: "Gratis",
  paid: "Berbayar",
};

/** A game with no price reading matches neither "Gratis" nor "Berbayar". */
export function matchesPriceFilter(price: number | null, filter: PriceFilter): boolean {
  if (filter === "all") return true;
  if (price === null) return false;
  return filter === "free" ? price === 0 : price > 0;
}

export interface PriceChange {
  at: Date;
  from: number | null;
  to: number | null;
  currency: string | null;
}

/**
 * Price changes between consecutive readings, oldest first. Readings without a price are skipped
 * so a missing value is never reported as a change to or from zero.
 */
export function detectPriceChanges(
  readings: ReadonlyArray<{ capturedAt: Date; price: number | null; currency: string | null }>,
): PriceChange[] {
  const changes: PriceChange[] = [];
  let previous: { price: number; currency: string | null } | null = null;
  for (const reading of readings) {
    if (reading.price === null) continue;
    if (previous && (previous.price !== reading.price || previous.currency !== reading.currency)) {
      changes.push({ at: reading.capturedAt, from: previous.price, to: reading.price, currency: reading.currency });
    }
    previous = { price: reading.price, currency: reading.currency };
  }
  return changes;
}
